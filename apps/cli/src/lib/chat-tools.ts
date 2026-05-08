import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolDef } from '@ivaronix/og-router';
import type { LoadedSkill, SkillManifest } from '@ivaronix/skills';

/**
 * Tool catalog the model can invoke during `ivaronix chat`.
 *
 * Every tool execution is recorded into the message history so the next
 * router call sees the result. Each tool is bounded (file size cap, exec
 * timeout, no shell-meta in run_bash arguments) — this is a cooperative
 * sandbox, not a security boundary. The agent sees tool errors as plain
 * text and can decide whether to retry.
 */

const execFileAsync = promisify(execFile);

const MAX_FILE_BYTES = 64 * 1024; // 64KB read cap
const MAX_LIST_ENTRIES = 200;
const MAX_BASH_TIMEOUT_MS = 20_000;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', '.turbo', '.ivaronix']);

export const TOOL_DEFS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file relative to the working directory. Returns up to 64KB.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path, relative or absolute' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write contents to a file. Creates parent directories. Overwrites existing files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path, relative or absolute' },
          content: { type: 'string', description: 'Full file contents' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files under a directory matching an optional extension filter. Recurses up to depth 3.',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Directory path; defaults to "."' },
          ext: { type: 'string', description: 'Optional extension filter, e.g. ".ts" or ".sol"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search for a regex across files in the working directory. Returns up to 50 hits.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regular expression (JS syntax)' },
          dir: { type: 'string', description: 'Directory to search; defaults to "."' },
          ext: { type: 'string', description: 'Optional extension filter' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_bash',
      description: 'Run a small shell command (cap 20s). Use SPARINGLY — prefer read_file/grep where possible. The argument list is the literal argv; no shell metacharacters.',
      parameters: {
        type: 'object',
        properties: {
          cmd: { type: 'string', description: 'Executable name, e.g. "git" or "ls"' },
          args: { type: 'array', items: { type: 'string' }, description: 'Argument list' },
        },
        required: ['cmd', 'args'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch text from a URL. HTTPS only, 30s timeout, returns up to 32KB.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'HTTPS URL' } },
        required: ['url'],
      },
    },
  },
];

export interface ToolExecResult {
  ok: boolean;
  output: string;
}

function safeRel(cwd: string, target: string): string {
  return relative(cwd, target) || target;
}

/**
 * Normalize a path the model gave us. On Windows, models often emit
 * Git-Bash style `/c/Users/...` — Node's path.resolve treats that as
 * relative-to-current-drive (returning `C:\c\Users\...`, the wrong path).
 * Convert to native drive notation before resolving.
 */
function normalizePath(p: string): string {
  if (process.platform !== 'win32') return p;
  const m = p.match(/^\/([a-zA-Z])\/(.*)$/);
  if (m) return `${m[1]!.toUpperCase()}:/${m[2]!}`;
  return p;
}

async function readFileTool(cwd: string, path: string): Promise<ToolExecResult> {
  try {
    const abs = resolve(cwd, normalizePath(path));
    const stat = statSync(abs);
    if (!stat.isFile()) return { ok: false, output: `not a file: ${path}` };
    if (stat.size > MAX_FILE_BYTES) {
      const head = readFileSync(abs).slice(0, MAX_FILE_BYTES).toString('utf8');
      return { ok: true, output: `[truncated to ${MAX_FILE_BYTES} bytes / ${stat.size}]\n${head}` };
    }
    return { ok: true, output: readFileSync(abs, 'utf8') };
  } catch (err) {
    return { ok: false, output: (err as Error).message };
  }
}

function writeFileTool(cwd: string, path: string, content: string): ToolExecResult {
  try {
    const abs = resolve(cwd, normalizePath(path));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
    return { ok: true, output: `wrote ${content.length} bytes to ${safeRel(cwd, abs)}` };
  } catch (err) {
    return { ok: false, output: (err as Error).message };
  }
}

function* walk(root: string, maxDepth: number, depth = 0): Iterable<string> {
  if (depth > maxDepth) return;
  let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
    const full = join(root, e.name);
    if (e.isDirectory()) yield* walk(full, maxDepth, depth + 1);
    else if (e.isFile()) yield full;
  }
}

function listFilesTool(cwd: string, dir: string, ext?: string): ToolExecResult {
  try {
    const root = resolve(cwd, normalizePath(dir || '.'));
    if (!existsSync(root)) return { ok: false, output: `no such dir: ${dir}` };
    const out: string[] = [];
    for (const f of walk(root, 3)) {
      if (ext && !f.endsWith(ext)) continue;
      out.push(safeRel(cwd, f));
      if (out.length >= MAX_LIST_ENTRIES) break;
    }
    return { ok: true, output: out.length ? out.join('\n') : '(no matches)' };
  } catch (err) {
    return { ok: false, output: (err as Error).message };
  }
}

function grepTool(cwd: string, pattern: string, dir?: string, ext?: string): ToolExecResult {
  try {
    const re = new RegExp(pattern, 'g');
    const root = resolve(cwd, normalizePath(dir || '.'));
    const hits: string[] = [];
    for (const f of walk(root, 3)) {
      if (ext && !f.endsWith(ext)) continue;
      let body: string;
      try { body = readFileSync(f, 'utf8'); } catch { continue; }
      const lines = body.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i] ?? '')) {
          hits.push(`${safeRel(cwd, f)}:${i + 1}: ${(lines[i] ?? '').slice(0, 240)}`);
          re.lastIndex = 0;
          if (hits.length >= 50) break;
        }
      }
      if (hits.length >= 50) break;
    }
    return { ok: true, output: hits.length ? hits.join('\n') : '(no matches)' };
  } catch (err) {
    return { ok: false, output: (err as Error).message };
  }
}

async function runBashTool(cwd: string, cmd: string, args: string[]): Promise<ToolExecResult> {
  // Defense in depth: argv is literal, no shell. Reject obviously dangerous executables.
  const banned = new Set(['rm', 'rmdir', 'del', 'format', 'mkfs', 'dd', 'shutdown', 'reboot']);
  if (banned.has(cmd.toLowerCase())) return { ok: false, output: `command "${cmd}" not allowed` };
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: MAX_BASH_TIMEOUT_MS,
      maxBuffer: 256 * 1024,
      windowsHide: true,
    });
    const out = (stdout || '') + (stderr ? `\n[stderr]\n${stderr}` : '');
    return { ok: true, output: out.slice(0, MAX_FILE_BYTES) };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    return { ok: false, output: (e.stdout ?? '') + (e.stderr ?? '') + '\n' + e.message };
  }
}

async function webFetchTool(url: string): Promise<ToolExecResult> {
  try {
    if (!/^https:/i.test(url)) return { ok: false, output: 'web_fetch requires https:// URL' };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30_000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false, output: `HTTP ${res.status}` };
    const text = (await res.text()).slice(0, 32 * 1024);
    return { ok: true, output: text };
  } catch (err) {
    return { ok: false, output: (err as Error).message };
  }
}

/** Render `{{argName}}` placeholders in a shell argv against parsed JSON args. */
function renderShellArgs(template: string[], args: Record<string, unknown>): string[] {
  return template.map((piece) =>
    piece.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_, key: string) => {
      const v = args[key];
      return v === undefined || v === null ? '' : String(v);
    }),
  );
}

type CustomTool = NonNullable<NonNullable<SkillManifest['og']['tools']>['custom']>[number];

/**
 * Build the active tool catalog for the current skill. Without a skill, all 6
 * built-in tools are exposed. With a skill, the manifest's `og.tools` block
 * narrows builtins and adds custom tools.
 */
export function buildSkillToolCatalog(skill: LoadedSkill | null): {
  defs: ToolDef[];
  customByName: Map<string, CustomTool>;
} {
  const customByName = new Map<string, CustomTool>();
  if (!skill || !skill.manifest.og.tools) return { defs: TOOL_DEFS, customByName };
  const cfg = skill.manifest.og.tools;
  const allowedBuiltins = cfg.builtins ?? ['read_file', 'write_file', 'list_files', 'grep', 'run_bash', 'web_fetch'];
  const builtinDefs = TOOL_DEFS.filter((d) => allowedBuiltins.includes(d.function.name as typeof allowedBuiltins[number]));
  const customDefs: ToolDef[] = (cfg.custom ?? []).map((c) => {
    customByName.set(c.name, c);
    return {
      type: 'function' as const,
      function: {
        name: c.name,
        description: c.description,
        parameters: c.parameters as ToolDef['function']['parameters'],
      },
    };
  });
  return { defs: [...builtinDefs, ...customDefs], customByName };
}

export async function dispatchTool(
  cwd: string,
  name: string,
  argsRaw: string,
  customByName: Map<string, CustomTool> = new Map(),
): Promise<ToolExecResult> {
  // Custom tool path
  const custom = customByName.get(name);
  if (custom) {
    let parsed: Record<string, unknown> = {};
    try { parsed = argsRaw ? (JSON.parse(argsRaw) as Record<string, unknown>) : {}; }
    catch { return { ok: false, output: `bad tool arguments JSON: ${argsRaw}` }; }
    if (custom.runner.type === 'shell') {
      const banned = new Set(['rm', 'rmdir', 'del', 'format', 'mkfs', 'dd', 'shutdown', 'reboot']);
      if (banned.has(custom.runner.cmd.toLowerCase())) return { ok: false, output: `command "${custom.runner.cmd}" not allowed` };
      const argv = renderShellArgs(custom.runner.args, parsed);
      try {
        const { stdout, stderr } = await execFileAsync(custom.runner.cmd, argv, {
          cwd,
          timeout: custom.runner.timeout_ms,
          maxBuffer: 256 * 1024,
          windowsHide: true,
        });
        const out = (stdout || '') + (stderr ? `\n[stderr]\n${stderr}` : '');
        return { ok: true, output: out.slice(0, MAX_FILE_BYTES) };
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message: string };
        return { ok: false, output: (e.stdout ?? '') + (e.stderr ?? '') + '\n' + e.message };
      }
    }
    if (custom.runner.type === 'builtin') {
      return dispatchTool(cwd, custom.runner.tool, argsRaw, customByName);
    }
  }

  // Built-in path
  let args: Record<string, unknown>;
  try { args = argsRaw ? (JSON.parse(argsRaw) as Record<string, unknown>) : {}; }
  catch { return { ok: false, output: `bad tool arguments JSON: ${argsRaw}` }; }

  switch (name) {
    case 'read_file':
      return readFileTool(cwd, String(args.path));
    case 'write_file':
      return writeFileTool(cwd, String(args.path), String(args.content ?? ''));
    case 'list_files':
      return listFilesTool(cwd, String(args.dir ?? '.'), args.ext ? String(args.ext) : undefined);
    case 'grep':
      return grepTool(cwd, String(args.pattern), args.dir ? String(args.dir) : undefined, args.ext ? String(args.ext) : undefined);
    case 'run_bash':
      return runBashTool(cwd, String(args.cmd), Array.isArray(args.args) ? args.args.map(String) : []);
    case 'web_fetch':
      return webFetchTool(String(args.url));
    default:
      return { ok: false, output: `unknown tool: ${name}` };
  }
}
