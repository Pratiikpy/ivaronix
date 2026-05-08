import type { PolicySetT, PolicyRuleT, PolicyMatch } from './schema.js';
import { z } from 'zod';

/**
 * Policy evaluator — Phase 3 design. Given a `PolicySet` and a candidate
 * action, returns the first matching rule's decision (allow / deny /
 * require_approval / log_only). On no match, returns the policy set's
 * `defaultEffect`.
 *
 * The evaluator is pure (no I/O); the caller is responsible for fetching
 * the team's PolicySet and supplying the candidate fields.
 */

export interface EvalCandidate {
  skillId?: string;
  mode?: 'doc' | 'code' | 'audit' | 'swarm' | 'watch' | 'chat';
  tier?: 'quick' | 'standard' | 'high-stakes';
  caller?: string;
  network?: 'testnet' | 'mainnet';
  callerTrustScore?: number;
  todaySpendOg?: number;
}

export interface EvalDecision {
  effect: PolicyRuleT['effect'];
  rule: PolicyRuleT | null;
  reason: string;
  approvers: string[];
}

function matchesGlob(spec: string | undefined, value: string | undefined): boolean {
  if (!spec) return true;
  if (!value) return false;
  if (spec === '*' || spec === value) return true;
  if (spec.endsWith('/*')) return value.startsWith(spec.slice(0, -1));
  return false;
}

function matches(rule: PolicyRuleT, c: EvalCandidate): boolean {
  const m: z.infer<typeof PolicyMatch> = rule.match;
  if (m.skillId && !matchesGlob(m.skillId, c.skillId)) return false;
  if (m.mode && m.mode !== c.mode) return false;
  if (m.tier && m.tier !== c.tier) return false;
  if (m.network && m.network !== c.network) return false;
  if (m.caller && !matchesGlob(m.caller, c.caller)) return false;
  return true;
}

export function evaluatePolicy(set: PolicySetT, c: EvalCandidate): EvalDecision {
  for (const rule of set.rules) {
    if (!matches(rule, c)) continue;
    if (rule.minTrustScore > 0 && (c.callerTrustScore ?? 0) < rule.minTrustScore) {
      return {
        effect: 'deny',
        rule,
        reason: `caller trustScore ${c.callerTrustScore ?? 0} < required ${rule.minTrustScore}`,
        approvers: [],
      };
    }
    if (rule.dailyCapOg > 0 && (c.todaySpendOg ?? 0) >= rule.dailyCapOg) {
      return {
        effect: 'deny',
        rule,
        reason: `daily spend cap ${rule.dailyCapOg} OG reached (${c.todaySpendOg} OG today)`,
        approvers: [],
      };
    }
    return {
      effect: rule.effect,
      rule,
      reason: rule.description ?? `matched rule ${rule.id}`,
      approvers: rule.approvers,
    };
  }
  return {
    effect: set.defaultEffect,
    rule: null,
    reason: `no rule matched; defaultEffect=${set.defaultEffect}`,
    approvers: [],
  };
}

/** Convenience: build a starter policy set for a new team. */
export function defaultPolicySet(teamId: string, ownerWallet: string): PolicySetT {
  return {
    teamId,
    version: '0.0.1',
    rules: [
      {
        id: 'mainnet-high-stakes-requires-approval',
        match: { network: 'mainnet', tier: 'high-stakes' },
        effect: 'require_approval',
        approvers: ['role:admin'],
        minTrustScore: 0,
        dailyCapOg: 0,
        ttlSeconds: 0,
        description: 'Mainnet high-stakes runs require admin sign-off',
      },
      {
        id: 'mainnet-daily-cap-1og',
        match: { network: 'mainnet' },
        effect: 'allow',
        approvers: [],
        minTrustScore: 0,
        dailyCapOg: 1,
        ttlSeconds: 0,
        description: '1 OG/day per caller cap on mainnet',
      },
      {
        id: 'auditor-readonly',
        match: { caller: '*', mode: 'code' },
        effect: 'deny',
        approvers: [],
        minTrustScore: 0,
        dailyCapOg: 0,
        ttlSeconds: 0,
        description: 'Auditors cannot run write modes',
      },
    ],
    defaultEffect: 'allow',
    updatedBy: ownerWallet,
    updatedAt: Date.now(),
  };
}
