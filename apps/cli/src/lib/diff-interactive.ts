/**
 * Interactive unified-diff applier (PASS 77 F-codediff, A2).
 *
 * Parses a unified diff (as emitted by `git diff` or our `code-edit` skill)
 * into per-file, per-hunk records, then walks them with a y/N/a/q prompt.
 * Approved hunks are reassembled into a filtered diff and applied via
 * `git apply` so atomicity and gitignore semantics are preserved.
 *
 * Pattern lifted from OpenCode's interactive edit flow + Hermes' approval
 * pattern. Pure stdlib + readline — no external prompt dep.
 */

import { createInterface } from 'node:readline';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface Hunk {
  header: string; // the @@ -A,B +C,D @@ ... line
  body: string[]; // lines inside the hunk (with leading +/-/' ')
  added: number;
  removed: number;
}

export interface FileDiff {
  /** The full file-level header block (diff --git, ---, +++) — all of it. */
  header: string[];
  /** Source path (a/foo.ts → foo.ts). Best-effort, used for prompt display. */
  path: string;
  hunks: Hunk[];
}

/**
 * Parse a unified diff into FileDiffs. Tolerates leading non-diff text
 * (e.g. fence lines) by skipping until the first `diff --git`.
 */
export function parseUnifiedDiff(diff: string): FileDiff[] {
  const lines = diff.split('\n');
  const files: FileDiff[] = [];
  let i = 0;
  // Skip preamble until first `diff --git` (or `--- a/...` if no git header)
  while (i < lines.length && !lines[i]!.startsWith('diff --git') && !lines[i]!.startsWith('--- ')) {
    i++;
  }
  while (i < lines.length) {
    if (!lines[i]!.startsWith('diff --git') && !lines[i]!.startsWith('--- ')) { i++; continue; }
    // Header block: everything until first @@ or next file header
    const header: string[] = [];
    while (i < lines.length && !lines[i]!.startsWith('@@')) {
      // If we hit a new file header without seeing any @@, push and break
      if (header.length > 0 && (lines[i]!.startsWith('diff --git'))) break;
      header.push(lines[i]!);
      i++;
    }
    // Derive path from `+++ b/<path>` or `--- a/<path>`
    let path = '(unknown)';
    for (const h of header) {
      const m = h.match(/^\+\+\+\s+b\/(.+)$/) ?? h.match(/^---\s+a\/(.+)$/);
      if (m && m[1] && m[1] !== '/dev/null') { path = m[1]; break; }
    }
    // Hunks
    const hunks: Hunk[] = [];
    while (i < lines.length && lines[i]!.startsWith('@@')) {
      const headerLine = lines[i]!;
      i++;
      const body: string[] = [];
      let added = 0;
      let removed = 0;
      while (i < lines.length && !lines[i]!.startsWith('@@') && !lines[i]!.startsWith('diff --git')) {
        const ln = lines[i]!;
        // Hunk body lines start with ' ', '+', '-', or '\' (no newline marker)
        if (ln.startsWith('+') && !ln.startsWith('+++')) added++;
        else if (ln.startsWith('-') && !ln.startsWith('---')) removed++;
        body.push(ln);
        i++;
      }
      hunks.push({ header: headerLine, body, added, removed });
    }
    if (hunks.length > 0) {
      files.push({ header, path, hunks });
    }
  }
  return files;
}

/** Format a hunk as a colored preview string (no extra deps — uses ANSI escapes). */
export function renderHunk(file: FileDiff, idx: number, total: number): string {
  const hunk = file.hunks[idx]!;
  const out: string[] = [];
  out.push(`\x1b[1m${file.path}\x1b[0m  hunk ${idx + 1}/${total}  +${hunk.added} -${hunk.removed}`);
  out.push(`\x1b[36m${hunk.header}\x1b[0m`);
  for (const ln of hunk.body) {
    if (ln.startsWith('+')) out.push(`\x1b[32m${ln}\x1b[0m`);
    else if (ln.startsWith('-')) out.push(`\x1b[31m${ln}\x1b[0m`);
    else out.push(`\x1b[2m${ln}\x1b[0m`);
  }
  return out.join('\n');
}

/** Reassemble selected hunks into a unified diff string. */
export function buildFilteredDiff(files: FileDiff[], accept: boolean[][]): string {
  const out: string[] = [];
  for (let f = 0; f < files.length; f++) {
    const file = files[f]!;
    const keepIdx: number[] = [];
    for (let h = 0; h < file.hunks.length; h++) {
      if (accept[f]![h]) keepIdx.push(h);
    }
    if (keepIdx.length === 0) continue;
    out.push(...file.header);
    for (const h of keepIdx) {
      const hunk = file.hunks[h]!;
      out.push(hunk.header, ...hunk.body);
    }
  }
  return out.join('\n') + '\n';
}

interface PromptResult {
  decision: 'yes' | 'no' | 'all' | 'quit';
}

async function promptHunk(): Promise<PromptResult> {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question('apply this hunk? [y/N/a=all-remaining/q=quit] ', (ans) => {
      rl.close();
      const a = (ans ?? '').trim().toLowerCase();
      if (a === 'y' || a === 'yes') res({ decision: 'yes' });
      else if (a === 'a' || a === 'all') res({ decision: 'all' });
      else if (a === 'q' || a === 'quit') res({ decision: 'quit' });
      else res({ decision: 'no' });
    });
  });
}

export interface InteractiveResult {
  acceptedHunks: number;
  rejectedHunks: number;
  filteredDiff: string;
  applied: boolean;
  applyOutput: string;
  quit: boolean;
}

/** Run the y/N/a/q loop and apply accepted hunks via `git apply`. */
export async function runInteractiveApply(diff: string, gitRoot: string): Promise<InteractiveResult> {
  const files = parseUnifiedDiff(diff);
  const accept: boolean[][] = files.map((f) => f.hunks.map(() => false));

  let acceptAll = false;
  let quit = false;

  outer: for (let f = 0; f < files.length; f++) {
    const file = files[f]!;
    for (let h = 0; h < file.hunks.length; h++) {
      const total = file.hunks.length;
      process.stdout.write('\n' + renderHunk(file, h, total) + '\n');
      if (acceptAll) { accept[f]![h] = true; continue; }
      const r = await promptHunk();
      if (r.decision === 'all') { accept[f]![h] = true; acceptAll = true; }
      else if (r.decision === 'yes') accept[f]![h] = true;
      else if (r.decision === 'quit') { quit = true; break outer; }
      else accept[f]![h] = false;
    }
  }

  const acceptedHunks = accept.flat().filter((b) => b).length;
  const rejectedHunks = accept.flat().filter((b) => !b).length;

  if (acceptedHunks === 0) {
    return { acceptedHunks: 0, rejectedHunks, filteredDiff: '', applied: false, applyOutput: '(nothing to apply)', quit };
  }

  const filtered = buildFilteredDiff(files, accept);
  // Stage to a temp file + git apply --check + git apply
  const tmp = mkdtempSync(join(tmpdir(), 'ivaronix-diff-'));
  const patchPath = join(tmp, 'patch.diff');
  writeFileSync(patchPath, filtered, 'utf8');

  const check = spawnSync('git', ['apply', '--check', patchPath], { cwd: gitRoot, encoding: 'utf8' });
  if (check.status !== 0) {
    return {
      acceptedHunks,
      rejectedHunks,
      filteredDiff: filtered,
      applied: false,
      applyOutput: `git apply --check failed:\n${check.stderr || check.stdout}`,
      quit,
    };
  }

  const apply = spawnSync('git', ['apply', patchPath], { cwd: gitRoot, encoding: 'utf8' });
  return {
    acceptedHunks,
    rejectedHunks,
    filteredDiff: filtered,
    applied: apply.status === 0,
    applyOutput: apply.status === 0 ? '(applied successfully)' : (apply.stderr || apply.stdout),
    quit,
  };
}
