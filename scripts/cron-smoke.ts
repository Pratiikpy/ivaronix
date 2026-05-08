import { parseCron, nextFireAfter } from '../apps/cli/src/lib/cron.js';
const cases = ['0 9 * * 1-5', '*/30 * * * *', '0 0 * * 0', '0 12 1 * *', '15 9 * * 1,3,5'];
for (const c of cases) {
  const p = parseCron(c);
  const next = nextFireAfter(p);
  console.log(c.padEnd(20), '→', next.toISOString());
}
