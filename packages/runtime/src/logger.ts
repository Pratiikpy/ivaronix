/**
 * Logger interface used by the pipeline. CLI passes a UI-bound implementation
 * that prints colorized rows to stdout; Studio passes a collector that
 * captures lines to return as JSON. Tests can pass a noop.
 */
export interface PipelineLogger {
  info(label: string, detail?: string): void;
  pass(label: string, detail?: string): void;
  fail(label: string, detail?: string): void;
}

export const noopLogger: PipelineLogger = {
  info: () => {},
  pass: () => {},
  fail: () => {},
};

/** A logger that captures every entry into a structured array. */
export interface CapturedEntry {
  level: 'info' | 'pass' | 'fail';
  label: string;
  detail: string | null;
}

export function createCaptureLogger(): { logger: PipelineLogger; entries: CapturedEntry[] } {
  const entries: CapturedEntry[] = [];
  const push = (level: CapturedEntry['level']) => (label: string, detail?: string) => {
    entries.push({ level, label, detail: detail ?? null });
  };
  return {
    entries,
    logger: { info: push('info'), pass: push('pass'), fail: push('fail') },
  };
}
