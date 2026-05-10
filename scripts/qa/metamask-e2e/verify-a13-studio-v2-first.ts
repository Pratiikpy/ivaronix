/**
 * A.1.3 regression · Studio reads queries V2 first, V1 fallback across
 * all 8 surfaces + the /onboard mint write path.
 *
 * Closes WT 19, 28, 37, 41, 45, 51 from wanderingthoughts.md. Without
 * this, every Studio surface that reads receipts on a network where K-2
 * V2 is deployed would silently miss V2 anchors (home counter, /agents,
 * /global, /embed/r/[id], /r/[id]/print, /r/[id]/opengraph-image,
 * /thesis, /api/dashboard/[addr]). And `/onboard` would mint new
 * AgentPassports on V1, defeating the K-1 security upgrade.
 *
 * Source-file regression assertions only — runs offline. Live verification
 * happens by visiting `https://<host>/r/<v2-id>` and confirming the page
 * renders rather than 404s. Studio dev server smoke not required for the
 * regression to fail correctly when a future PR re-introduces a direct
 * `getReceiptRegistry()` call in a read path.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

interface SurfaceCheck {
  path: string;
  expectV2Helper: RegExp;
  forbidV1Direct: RegExp[];
}

const SURFACES: SurfaceCheck[] = [
  {
    path: 'apps/studio/src/app/page.tsx',
    expectV2Helper: /\bunifiedNextId\b/,
    forbidV1Direct: [/\breg\.nextId\(\)/, /\bgetReceiptRegistry\b/],
  },
  {
    path: 'apps/studio/src/app/global/page.tsx',
    expectV2Helper: /\bunifiedNextId\b/,
    forbidV1Direct: [/\bgetReceiptRegistry\b/],
  },
  {
    path: 'apps/studio/src/app/thesis/page.tsx',
    expectV2Helper: /\bunifiedNextId\b/,
    forbidV1Direct: [/\bgetReceiptRegistry\b/],
  },
  {
    path: 'apps/studio/src/app/r/[id]/print/page.tsx',
    expectV2Helper: /\bunifiedGetReceipt\b|\bunifiedFindByReceiptRoot\b/,
    forbidV1Direct: [/\bgetReceiptRegistry\b/],
  },
  {
    path: 'apps/studio/src/app/r/[id]/opengraph-image.tsx',
    expectV2Helper: /\bunifiedGetReceipt\b|\bunifiedFindByReceiptRoot\b/,
    forbidV1Direct: [/\bgetReceiptRegistry\b/],
  },
  {
    path: 'apps/studio/src/app/embed/r/[id]/page.tsx',
    expectV2Helper: /\bunifiedGetReceipt\b|\bunifiedFindByReceiptRoot\b/,
    forbidV1Direct: [/\bgetReceiptRegistry\b/],
  },
  {
    path: 'apps/studio/src/app/agent/[handle]/page.tsx',
    expectV2Helper: /\bunifiedFindByAgent\b/,
    forbidV1Direct: [/\bgetReceiptRegistry\b/, /\breg\.findByAgent\(/],
  },
  {
    path: 'apps/studio/src/app/api/dashboard/[addr]/route.ts',
    expectV2Helper: /\bunifiedFindByAgent\b/,
    forbidV1Direct: [/\bgetReceiptRegistry\b/, /\bregistry\.findByAgent\(/],
  },
];

let failures = 0;
function check(label: string, pass: boolean, detail = ''): void {
  if (pass) {
    console.log(`  PASS · ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL · ${label}${detail ? ` · ${detail}` : ''}`);
  }
}

console.log('A.1.3 · Studio surfaces V2-first regression\n');

// 1. chain.ts exposes the unified helpers.
const chainTs = resolve(REPO_ROOT, 'apps/studio/src/lib/chain.ts');
const chainSrc = existsSync(chainTs) ? readFileSync(chainTs, 'utf8') : '';
check('chain.ts exists', existsSync(chainTs));
check('chain.ts exports unifiedNextId', /export\s+async\s+function\s+unifiedNextId/.test(chainSrc));
check('chain.ts exports unifiedGetReceipt', /export\s+async\s+function\s+unifiedGetReceipt/.test(chainSrc));
check('chain.ts exports unifiedFindByReceiptRoot', /export\s+async\s+function\s+unifiedFindByReceiptRoot/.test(chainSrc));
check('chain.ts exports unifiedFindByAgent', /export\s+async\s+function\s+unifiedFindByAgent/.test(chainSrc));
check('chain.ts exports UnifiedReceipt type with registryVersion', /interface\s+UnifiedReceipt[\s\S]{0,300}registryVersion/.test(chainSrc));
check(
  'unifiedNextId returns {v2, v1, total}',
  /unifiedNextId\([^)]*\)[\s\S]{0,500}\{\s*v2[^}]*v1[^}]*total[^}]*\}/.test(chainSrc),
);

// 2. Each surface uses the helper and avoids the direct V1 client call.
for (const s of SURFACES) {
  const abs = resolve(REPO_ROOT, s.path);
  const src = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  check(`${s.path} exists`, existsSync(abs));
  check(`${s.path} uses V2-first helper`, s.expectV2Helper.test(src), `expected ${s.expectV2Helper}`);
  for (const forbidden of s.forbidV1Direct) {
    check(`${s.path} no longer uses ${forbidden}`, !forbidden.test(src));
  }
}

// 3. /onboard mints V2-first.
const onboardPage = resolve(REPO_ROOT, 'apps/studio/src/app/onboard/page.tsx');
const onboardSrc = existsSync(onboardPage) ? readFileSync(onboardPage, 'utf8') : '';
check('onboard/page.tsx exists', existsSync(onboardPage));
check(
  'onboard mint targets V2 first via getDeployedAddress(net, "AgentPassportINFTV2")',
  /getDeployedAddress\(\s*net\s*,\s*['"]AgentPassportINFTV2['"]\s*\)/.test(onboardSrc),
);
check(
  'onboard falls back to V1 on networks without V2',
  /getDeployedAddress\(\s*net\s*,\s*['"]AgentPassportINFT['"]\s*\)/.test(onboardSrc),
);

console.log();
if (failures > 0) {
  console.error(`A.1.3 · ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('A.1.3 · all assertions passed · Studio reads + onboard mint are V2-first');
