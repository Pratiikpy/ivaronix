import pc from 'picocolors';

export const ui = {
  /** Section header — letter-spaced uppercase, muted. */
  section(label: string) {
    console.log(pc.dim('§ ' + label.toUpperCase()));
  },
  /** Title — bold near-black. */
  title(text: string) {
    console.log('\n' + pc.bold(text));
  },
  /** Dim hint text. */
  hint(text: string) {
    console.log(pc.dim(text));
  },
  /** Pass / OK row — green dot. */
  pass(label: string, detail?: string) {
    console.log(`  ${pc.green('●')} ${label}${detail ? pc.dim('  ' + detail) : ''}`);
  },
  /** Fail / Mismatch row — red dot. */
  fail(label: string, detail?: string) {
    console.log(`  ${pc.red('●')} ${label}${detail ? '  ' + pc.red(detail) : ''}`);
  },
  /** Pending row — amber/yellow dot. */
  pending(label: string, detail?: string) {
    console.log(`  ${pc.yellow('●')} ${label}${detail ? pc.dim('  ' + detail) : ''}`);
  },
  /** Info row — neutral. */
  info(label: string, detail?: string) {
    console.log(`  ${pc.gray('●')} ${label}${detail ? pc.dim('  ' + detail) : ''}`);
  },
  /**
   * Final status banner. `severity` colours the line:
   *   'ok'      → green (anchored, fully verified)
   *   'fail'    → red (signature mismatch, not anchored when expected, etc.)
   *   'pending' → yellow (claimed but not yet anchored — neutral, not success)
   * Boolean fallback: `true` → ok, `false` → fail (existing call sites).
   */
  banner(severity: boolean | 'ok' | 'fail' | 'pending', text: string) {
    let c: (s: string) => string;
    if (severity === 'pending') c = pc.yellow;
    else if (severity === 'ok' || severity === true) c = pc.green;
    else c = pc.red;
    console.log('\n' + c(`Status: ${text}`));
  },
  divider() {
    console.log(pc.dim('─'.repeat(60)));
  },
};
