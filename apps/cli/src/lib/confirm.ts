import { createInterface } from 'node:readline/promises';

/**
 * Interactive yes/no confirm for destructive CLI commands.
 * HALF_BAKED §I-19 closure (sweep 169) — passport revoke / delegate
 * revoke / memory forget all spend gas or destroy state and previously
 * fired with no confirmation. A mistyped argument + enter could revoke
 * the wrong grant or burn the wrong note.
 *
 * Default behavior:
 *   - If stdin is NOT a TTY (CI / piped) → throws unless --yes passed
 *     in the caller's options. The caller is expected to short-circuit
 *     with the --yes path before reaching this helper.
 *   - If TTY → reads a single line, returns true on /^y(es)?$/i.
 *
 * The caller passes the prompt text. Returns true to proceed, false to
 * abort. Idempotent if the prompt is empty.
 */
export async function confirmAction(prompt: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    // Non-interactive environment. Callers SHOULD have a --yes path
    // that skips this; if we got here without one, treat as a refusal.
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = (await rl.question(`${prompt} [y/N]: `)).trim();
    return /^y(es)?$/i.test(ans);
  } finally {
    rl.close();
  }
}
