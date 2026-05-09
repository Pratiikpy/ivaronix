import type { LoadedSkill } from './loader.js';
import type { ScanResult } from './scanner.js';

export type Severity = 'block' | 'warn';

export interface SandboxViolation {
  severity: Severity;
  code: string;
  message: string;
}

export interface SandboxContext {
  /** Caller's passport trust score (-∞..∞). 0 if no passport. */
  callerTrustScore: number;
  /** Whether the run was launched with --receipt */
  receiptRequested: boolean;
  /** Whether burn mode is on for this run */
  burnEnabled: boolean;
  /** Optional scanner result; when provided, a manifestHash mismatch becomes a block. */
  scan?: ScanResult;
  /** Strict mode treats every "warn" as a "block". Used for compute_tee_required + audit profiles. */
  strict?: boolean;
  /**
   * Inference provider this run will use. When the manifest declares
   * `compute_tee_required: true` and the provider is anything other than `0g`,
   * the sandbox blocks. When omitted, the check is skipped (legacy callers).
   * Callers that route to non-0G providers MUST populate this field.
   */
  providerKind?: '0g' | 'nvidia' | 'openai' | 'ollama';
}

export interface SandboxDecision {
  allow: boolean;
  violations: SandboxViolation[];
  /** True iff every violation is severity=warn (and strict is off). */
  warningsOnly: boolean;
}

/**
 * Evaluate the skill's og.permissions block against the run-time context.
 * Returns a decision with structured violations. The CLI prints them and
 * exits 1 on `allow=false`.
 *
 * Day 10 enforcement is policy-only — no kernel/seccomp sandbox yet. The
 * goal is to make the boundary auditable and to fail loudly when a skill
 * exceeds its declared capabilities.
 */
export function evaluateSandbox(skill: LoadedSkill, ctx: SandboxContext): SandboxDecision {
  const v: SandboxViolation[] = [];
  const p = skill.manifest.og.permissions;
  const strict = !!ctx.strict;

  // 1. passport_min_trust — block when the caller doesn't meet the minimum
  if (p.passport_min_trust > 0 && ctx.callerTrustScore < p.passport_min_trust) {
    v.push({
      severity: 'block',
      code: 'passport.trust-too-low',
      message: `skill requires passport_min_trust=${p.passport_min_trust} but caller has trustScore=${ctx.callerTrustScore}`,
    });
  }

  // 2. receipt_required — must be on
  if (p.receipt_required && !ctx.receiptRequested) {
    v.push({
      severity: 'block',
      code: 'receipt.required',
      message: `skill requires a receipt; pass --receipt to enable`,
    });
  }

  // 3. compute_tee_required — must be honored. The check fires when the caller
  //    has declared a non-0G provider and the manifest requires TEE attestation.
  //    When providerKind is omitted (legacy CLI path that always uses 0G),
  //    the check is skipped — the consensus path enforces TEE downstream.
  if (p.compute_tee_required && ctx.providerKind !== undefined && ctx.providerKind !== '0g') {
    v.push({
      severity: 'block',
      code: 'compute.tee-required',
      message: `skill requires TEE-attested compute but the configured provider is "${ctx.providerKind}" — only "0g" attests via TEE`,
    });
  }

  // 4. burn.auto_enable contract — when the manifest auto-enables burn mode and the
  //    operator has explicitly turned it off, treat as a violation. This is hard
  //    to detect from the run-context shape (we only see "burnEnabled"), so we
  //    only warn; the CLI can decide.
  if (skill.manifest.og.burn.auto_enable && !ctx.burnEnabled) {
    v.push({
      severity: strict ? 'block' : 'warn',
      code: 'burn.disabled-on-burn-skill',
      message: `skill prescribes burn mode (auto_enable=true) but burn was disabled for this run`,
    });
  }

  // 5. scanner verdict
  //    - revoked or registered-but-mismatched → block (tampering or kill-switch)
  //    - not registered → warn (local-only manifest, safe to run)
  if (ctx.scan) {
    if (ctx.scan.revoked) {
      v.push({
        severity: 'block',
        code: 'registry.revoked',
        message: ctx.scan.reason ?? 'on-chain version was revoked',
      });
    } else if (ctx.scan.registered && !ctx.scan.matches) {
      v.push({
        severity: 'block',
        code: 'registry.manifest-mismatch',
        message: ctx.scan.reason ?? 'local manifest differs from on-chain canonical record',
      });
    } else if (!ctx.scan.registered) {
      v.push({
        severity: strict ? 'block' : 'warn',
        code: 'registry.not-registered',
        message: ctx.scan.reason ?? 'skill version is not registered on SkillRegistry',
      });
    }
  }

  // 6. shell_access / writes_files / wallet_access — informational for now, since
  //    runSkill itself does not expose shell or fs to the model. They flip from
  //    "warn" to "block" once Day 11's lifecycle hooks expose those tools.
  if (p.shell_access !== 'none') {
    v.push({
      severity: 'warn',
      code: 'shell.access-declared',
      message: `skill declares shell_access=${p.shell_access}; lifecycle hooks (Day 11) will enforce`,
    });
  }
  if (p.writes_files) {
    v.push({
      severity: 'warn',
      code: 'fs.writes-declared',
      message: `skill declares writes_files=true; lifecycle hooks (Day 11) will enforce`,
    });
  }
  if (p.wallet_access) {
    v.push({
      severity: 'warn',
      code: 'wallet.access-declared',
      message: `skill declares wallet_access=true; lifecycle hooks (Day 11) will enforce`,
    });
  }

  const blocking = v.filter((x) => (strict ? true : x.severity === 'block'));
  return {
    allow: blocking.length === 0,
    violations: v,
    warningsOnly: v.every((x) => x.severity === 'warn') && !strict,
  };
}
