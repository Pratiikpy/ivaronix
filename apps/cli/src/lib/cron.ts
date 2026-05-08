/**
 * Tiny cron-expression parser. Supports the 5-field syntax:
 *   minute  hour  day-of-month  month  day-of-week
 * and these field forms: `*`, `*\/N`, `N`, `N-M`, `N,M,O`.
 *
 * Used by `ivaronix daemon start --cron "0 9 * * 1-5"` (weekdays at 9am).
 * Local timezone — same convention as the `CronCreate` MCP tool.
 */

interface CronField {
  values: number[]; // sorted ascending
}

function expandField(spec: string, min: number, max: number): CronField {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) out.add(i);
      continue;
    }
    const stepMatch = part.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/);
    if (stepMatch) {
      const [, base, stepStr] = stepMatch;
      const step = parseInt(stepStr!, 10);
      let lo = min, hi = max;
      if (base !== '*') {
        const m = base!.match(/^(\d+)(?:-(\d+))?$/);
        if (!m) throw new Error(`bad cron step: ${part}`);
        lo = parseInt(m[1]!, 10);
        hi = m[2] ? parseInt(m[2], 10) : max;
      }
      for (let i = lo; i <= hi; i += step) out.add(i);
      continue;
    }
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1]!, 10);
      const hi = parseInt(rangeMatch[2]!, 10);
      for (let i = lo; i <= hi; i++) out.add(i);
      continue;
    }
    if (/^\d+$/.test(part)) {
      out.add(parseInt(part, 10));
      continue;
    }
    throw new Error(`bad cron field: ${part}`);
  }
  for (const v of out) {
    if (v < min || v > max) throw new Error(`cron value ${v} out of range [${min}-${max}]`);
  }
  return { values: [...out].sort((a, b) => a - b) };
}

export interface ParsedCron {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

export function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`cron expression must have 5 fields, got ${parts.length}`);
  return {
    minute: expandField(parts[0]!, 0, 59),
    hour: expandField(parts[1]!, 0, 23),
    dayOfMonth: expandField(parts[2]!, 1, 31),
    month: expandField(parts[3]!, 1, 12),
    dayOfWeek: expandField(parts[4]!, 0, 6), // 0 = Sunday
  };
}

/** Compute the next fire time at or after `from` (exclusive of `from`). */
export function nextFireAfter(parsed: ParsedCron, from: Date = new Date()): Date {
  const t = new Date(from.getTime() + 60_000); // start at next minute boundary
  t.setSeconds(0, 0);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    const minute = t.getMinutes();
    const hour = t.getHours();
    const dom = t.getDate();
    const month = t.getMonth() + 1;
    const dow = t.getDay();
    if (
      parsed.minute.values.includes(minute) &&
      parsed.hour.values.includes(hour) &&
      parsed.dayOfMonth.values.includes(dom) &&
      parsed.month.values.includes(month) &&
      parsed.dayOfWeek.values.includes(dow)
    ) {
      return new Date(t.getTime());
    }
    t.setTime(t.getTime() + 60_000);
  }
  throw new Error('no fire time found within 1 year');
}
