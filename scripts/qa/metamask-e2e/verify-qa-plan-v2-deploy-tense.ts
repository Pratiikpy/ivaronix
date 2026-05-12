/**
 * iter-129 closure regression for QA plan V2-deploy-tense drift.
 *
 * iter-128 caught literal PENDING markers. iter-129 catches a different
 * phrasing of the same drift class: sections that describe V2-contract
 * deploys as future events ("still on V1", "redeploy day", etc.) when
 * the V2 contract is already in contracts/deployments/testnet.json.
 *
 * The drift caught + fixed iter-129: the "Mainnet-Redeploy-Day Test
 * Rows" section title said "the 4 contracts still on V1" and the intro
 * said the V2 contracts had not shipped yet. All 4 V2 contracts
 * (CapabilityRegistryV2 / MemoryAccessLogV2 / SkillRegistryV2 /
 * SubscriptionEscrowV2) shipped 2026-05-12 per B-V2-15/16/17/18.
 *
 * Allow-marker: qa-plan-v2-tense-allow:<reason> on the same line.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const QA_PLAN = resolve(REPO_ROOT, 'Ivaronix_User_QA_Test_Plan.md');

let asserts = 0;
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};

const FORBIDDEN_PHRASES = [
  /still on V1/i,
  /still V1 only/i,
  /on each V2 redeploy/i,
  /when each V2 redeploys/i,
  /test on redeploy day/i,
];

const qaSrc = readFileSync(QA_PLAN, 'utf8');
const lines = qaSrc.split(/\r?\n/);

const violations: { line: number; phrase: string; snippet: string }[] = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  if (/qa-plan-v2-tense-allow:/.test(line)) continue;
  for (const re of FORBIDDEN_PHRASES) {
    const mm = re.exec(line);
    if (mm) {
      violations.push({
        line: i + 1,
        phrase: mm[0]!,
        snippet: line.slice(0, 160) + (line.length > 160 ? '...' : ''),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`\nFAIL: ${violations.length} future-tense V2-deploy phrase(s) in QA plan:`);
  for (const v of violations) {
    console.error(`  line ${v.line}: matched "${v.phrase}"`);
    console.error(`    ${v.snippet}`);
  }
  console.error(`\nAll 4 V2 contracts shipped 2026-05-12 per B-V2-15/16/17/18 in USER_TODO.md.`);
  console.error(`If the phrase is intentional, add qa-plan-v2-tense-allow:<reason> on the same line.`);
  process.exit(1);
}

ok(`no future-tense V2-deploy phrasing left in QA plan`);
console.log(`\n[verify-qa-plan-v2-deploy-tense] ${asserts}/1 assertions passed`);
