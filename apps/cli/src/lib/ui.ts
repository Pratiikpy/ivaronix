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
  /** Final status banner. */
  banner(ok: boolean, text: string) {
    const c = ok ? pc.green : pc.red;
    console.log('\n' + c(`Status: ${text}`));
  },
  divider() {
    console.log(pc.dim('─'.repeat(60)));
  },
};
