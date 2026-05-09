import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSandbox, type SandboxContext } from './sandbox.js';
import { SkillManifestSchema, type SkillManifest } from './manifest.js';
import type { LoadedSkill } from './loader.js';

function buildSkill(overrides: Partial<{
  compute_tee_required: boolean;
  passport_min_trust: number;
  receipt_required: boolean;
}> = {}): LoadedSkill {
  const manifest: SkillManifest = SkillManifestSchema.parse({
    name: 'sandbox-test-skill',
    description: 'Fixture skill for sandbox unit tests.',
    og: {
      permissions: {
        compute_tee_required: overrides.compute_tee_required ?? true,
        passport_min_trust: overrides.passport_min_trust ?? 0,
        receipt_required: overrides.receipt_required ?? true,
      },
    },
  });
  return {
    id: 'sandbox-test-skill',
    manifest,
    systemPromptBody: '',
    rootPath: '/tmp/sandbox-test-skill',
    manifestHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  };
}

const baseCtx: SandboxContext = {
  callerTrustScore: 100,
  receiptRequested: true,
  burnEnabled: false,
};

// S-1 regression coverage — the dead branch `&& false` used to skip the
// compute_tee_required check entirely. These tests assert the check now fires
// for non-0G providers and stays silent for 0G or omitted-providerKind paths.

test('S-1 · compute_tee_required + provider=nvidia → blocks', () => {
  const skill = buildSkill({ compute_tee_required: true });
  const decision = evaluateSandbox(skill, { ...baseCtx, providerKind: 'nvidia' });
  assert.equal(decision.allow, false);
  const codes = decision.violations.map((v) => v.code);
  assert.ok(codes.includes('compute.tee-required'), `expected compute.tee-required violation; got ${codes.join(', ')}`);
  const violation = decision.violations.find((v) => v.code === 'compute.tee-required');
  assert.equal(violation?.severity, 'block');
  assert.match(violation?.message ?? '', /nvidia/);
});

test('S-1 · compute_tee_required + provider=openai → blocks', () => {
  const skill = buildSkill({ compute_tee_required: true });
  const decision = evaluateSandbox(skill, { ...baseCtx, providerKind: 'openai' });
  assert.equal(decision.allow, false);
  assert.ok(decision.violations.some((v) => v.code === 'compute.tee-required'));
});

test('S-1 · compute_tee_required + provider=ollama → blocks', () => {
  const skill = buildSkill({ compute_tee_required: true });
  const decision = evaluateSandbox(skill, { ...baseCtx, providerKind: 'ollama' });
  assert.equal(decision.allow, false);
  assert.ok(decision.violations.some((v) => v.code === 'compute.tee-required'));
});

test('S-1 · compute_tee_required + provider=0g → allows', () => {
  const skill = buildSkill({ compute_tee_required: true });
  const decision = evaluateSandbox(skill, { ...baseCtx, providerKind: '0g' });
  assert.equal(decision.allow, true);
  assert.equal(decision.violations.length, 0);
});

test('S-1 · compute_tee_required + omitted providerKind → allows (legacy CLI path)', () => {
  // CLI doc-ask never set providerKind before this fix; the runtime path always
  // does. When omitted, the sandbox skips the check — consensus enforces TEE
  // downstream. This test guards against re-introducing a false-positive that
  // would break every existing CLI invocation.
  const skill = buildSkill({ compute_tee_required: true });
  const decision = evaluateSandbox(skill, { ...baseCtx });
  assert.equal(decision.allow, true);
});

test('S-1 · compute_tee_required=false + provider=nvidia → allows (skill opts in to non-TEE)', () => {
  const skill = buildSkill({ compute_tee_required: false });
  const decision = evaluateSandbox(skill, { ...baseCtx, providerKind: 'nvidia' });
  assert.equal(decision.allow, true);
});

test('S-1 · violation message names the provider for operator triage', () => {
  const skill = buildSkill({ compute_tee_required: true });
  const decision = evaluateSandbox(skill, { ...baseCtx, providerKind: 'nvidia' });
  const violation = decision.violations.find((v) => v.code === 'compute.tee-required');
  assert.match(violation?.message ?? '', /TEE/);
  assert.match(violation?.message ?? '', /0g/);
});

test('S-1 · multiple violations stack (low trust + non-TEE provider)', () => {
  const skill = buildSkill({ compute_tee_required: true, passport_min_trust: 500 });
  const decision = evaluateSandbox(skill, {
    ...baseCtx,
    callerTrustScore: 10,
    providerKind: 'nvidia',
  });
  assert.equal(decision.allow, false);
  const codes = decision.violations.map((v) => v.code);
  assert.ok(codes.includes('passport.trust-too-low'));
  assert.ok(codes.includes('compute.tee-required'));
});

// Defense-in-depth: assert the source file no longer carries `&& false` as a
// permission gate. Reading the file at test time catches future regressions
// where the dead branch is accidentally reintroduced.
test('S-1 · sandbox.ts source contains no `&& false` placeholder gate', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(here, 'sandbox.ts'), 'utf8');
  assert.ok(
    !/&&\s*false\s*\/\*/.test(src),
    'sandbox.ts must not gate permission checks behind `&& false /* placeholder */` — see HALF_BAKED.md S-1',
  );
});
