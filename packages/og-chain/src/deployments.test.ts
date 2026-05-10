/**
 * Unit tests for the deployments-manifest accessor.
 *
 * Locks in the canonical-first / legacy-fallback walk-up behavior shipped
 * with the contracts/deployments path move (cron-sweep ENV-PATH-1,
 * 2026-05-10). Without these, a future refactor of findDeploymentsDir()
 * could silently fall through to legacy or break path resolution.
 *
 * Test runner: Node's built-in node:test via tsx (matches packages/core,
 * consensus, skills, memory, receipts convention).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadDeployments, getDeployedAddress } from './deployments.js';

const FIXTURE_MANIFEST = {
  network: 'testnet',
  chainId: 16602,
  deployer: '0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef',
  deployedAt: '2026-05-10',
  contracts: {
    ReceiptRegistryV2: {
      address: '0xf675d4183b34fe8d1981FA9c117065aAcff690ab',
      txHash: '0xabc',
      explorer: 'https://chainscan-galileo.0g.ai/tx/0xabc',
    },
  },
} as const;

function makeTempRepo(layout: 'canonical' | 'legacy' | 'both' | 'none'): string {
  const root = mkdtempSync(resolve(tmpdir(), 'og-chain-deploys-'));
  if (layout === 'canonical' || layout === 'both') {
    mkdirSync(resolve(root, 'contracts', 'deployments'), { recursive: true });
    writeFileSync(
      resolve(root, 'contracts', 'deployments', 'testnet.json'),
      JSON.stringify(FIXTURE_MANIFEST),
    );
  }
  if (layout === 'legacy' || layout === 'both') {
    mkdirSync(resolve(root, 'deployments'), { recursive: true });
    const legacy = layout === 'both'
      ? { ...FIXTURE_MANIFEST, contracts: { LegacyOnly: FIXTURE_MANIFEST.contracts.ReceiptRegistryV2 } }
      : FIXTURE_MANIFEST;
    writeFileSync(resolve(root, 'deployments', 'testnet.json'), JSON.stringify(legacy));
  }
  return root;
}

test('loadDeployments resolves canonical contracts/deployments path', () => {
  const root = makeTempRepo('canonical');
  try {
    const manifest = loadDeployments('testnet', root);
    assert.ok(manifest, 'manifest should resolve');
    assert.equal(manifest.chainId, 16602);
    assert.ok(manifest.contracts.ReceiptRegistryV2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadDeployments falls back to legacy deployments/ path with warning', () => {
  const root = makeTempRepo('legacy');
  const originalWarn = console.warn;
  let warned = false;
  console.warn = (msg: string) => {
    if (typeof msg === 'string' && msg.includes('legacy')) warned = true;
  };
  try {
    const manifest = loadDeployments('testnet', root);
    assert.ok(manifest, 'legacy path should still resolve');
    assert.equal(warned, true, 'legacy fallback must log deprecation warning');
  } finally {
    console.warn = originalWarn;
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadDeployments prefers canonical over legacy when both exist', () => {
  const root = makeTempRepo('both');
  try {
    const manifest = loadDeployments('testnet', root);
    assert.ok(manifest);
    assert.ok(
      manifest.contracts.ReceiptRegistryV2,
      'canonical fixture has ReceiptRegistryV2; legacy has LegacyOnly · canonical must win',
    );
    assert.equal(manifest.contracts.LegacyOnly, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadDeployments returns null when neither path exists', () => {
  const root = makeTempRepo('none');
  try {
    const manifest = loadDeployments('testnet', root);
    assert.equal(manifest, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getDeployedAddress returns address for known contract', () => {
  const root = makeTempRepo('canonical');
  try {
    const addr = getDeployedAddress('testnet', 'ReceiptRegistryV2', root);
    assert.equal(addr, '0xf675d4183b34fe8d1981FA9c117065aAcff690ab');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getDeployedAddress returns null for unknown contract', () => {
  const root = makeTempRepo('canonical');
  try {
    const addr = getDeployedAddress('testnet', 'NotDeployedYet', root);
    assert.equal(addr, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getDeployedAddress returns null when deployments dir missing', () => {
  const root = makeTempRepo('none');
  try {
    const addr = getDeployedAddress('testnet', 'ReceiptRegistryV2', root);
    assert.equal(addr, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('real-repo resolution: testnet manifest has all 8 deployed contracts', () => {
  // Smoke against the live contracts/deployments/testnet.json. Verifies the
  // manifest shape matches docs/numbers.json contracts.list.
  const manifest = loadDeployments('testnet');
  assert.ok(manifest, 'real testnet manifest should load from cwd walk-up');
  const expected = [
    'ReceiptRegistry',
    'ReceiptRegistryV2',
    'AgentPassportINFT',
    'AgentPassportINFTV2',
    'Erc7857Verifier',
    'CapabilityRegistry',
    'SkillRegistry',
    'MemoryAccessLog',
  ];
  for (const name of expected) {
    assert.ok(
      manifest.contracts[name],
      `numbers.json claims ${name} is deployed; testnet.json must have it too`,
    );
  }
});
