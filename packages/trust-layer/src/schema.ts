import { z } from 'zod';

/**
 * Trust Layer schemas — PRD §3.5 (Phase 3).
 *
 * "Teams, DAOs, regulated industries. Policy engine, approval gates, team
 * memory, agent fleet management, spend limits, compliance exports, audit
 * log dashboards. Realistic enterprise revenue line; not built at MVP but
 * **designed in schema now**."
 *
 * The PRD locks the surface here. Day-30+ implementation maps each schema
 * to a contract / Studio surface / API endpoint.
 */

// ─── Team / Organization ─────────────────────────────────────────────────────
export const TeamRole = z.enum(['owner', 'admin', 'member', 'auditor']);

export const TeamMember = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  role: TeamRole,
  passportTokenId: z.bigint().nullable(),
  joinedAt: z.number().int(),
  lastActiveAt: z.number().int().nullable(),
});

export const Team = z.object({
  id: z.string().regex(/^team_[A-Z0-9]{26}$/), // ulid-form
  name: z.string().min(1).max(80),
  slug: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
  ownerWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  members: z.array(TeamMember),
  createdAt: z.number().int(),
});

// ─── Policy engine ───────────────────────────────────────────────────────────
export const PolicyEffect = z.enum(['allow', 'deny', 'require_approval', 'log_only']);

export const PolicyMatch = z.object({
  /** Skill id glob, e.g. "github-audit" or "code-edit/*" */
  skillId: z.string().optional(),
  /** Run mode: "doc" / "code" / "audit" / "swarm" / "watch" / "chat" */
  mode: z.enum(['doc', 'code', 'audit', 'swarm', 'watch', 'chat']).optional(),
  /** Tier ladder */
  tier: z.enum(['quick', 'standard', 'high-stakes']).optional(),
  /** Wallet glob — `*` for any team member */
  caller: z.string().optional(),
  /** Network */
  network: z.enum(['testnet', 'mainnet']).optional(),
});

export const PolicyRule = z.object({
  id: z.string(),
  match: PolicyMatch,
  effect: PolicyEffect,
  /** Approval chain — list of roles or wallet addresses that must sign before allow */
  approvers: z.array(z.string()).default([]),
  /** Required min trustScore on the caller's passport */
  minTrustScore: z.number().int().default(0),
  /** Daily spend cap in OG; 0 = unlimited */
  dailyCapOg: z.number().nonnegative().default(0),
  /** TTL in seconds; 0 = never expires */
  ttlSeconds: z.number().int().default(0),
  description: z.string().max(500).optional(),
});

export const PolicySet = z.object({
  teamId: z.string(),
  version: z.string(),
  rules: z.array(PolicyRule),
  defaultEffect: PolicyEffect.default('allow'),
  updatedBy: z.string(),
  updatedAt: z.number().int(),
});

// ─── Approval chain (per receipt) ─────────────────────────────────────────────
export const ApprovalGate = z.object({
  gate: z.string(),
  decision: z.enum(['auto-allow', 'allowed', 'denied', 'pending']),
  actor: z.string(),
  signature: z.string().optional(),
  signedAt: z.number().int().optional(),
  reason: z.string().optional(),
});

// ─── Spend limit ledger ──────────────────────────────────────────────────────
export const SpendLedgerEntry = z.object({
  teamId: z.string(),
  caller: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  costOg: z.number().nonnegative(),
  receiptIds: z.array(z.string()),
});

// ─── Audit export ────────────────────────────────────────────────────────────
export const AuditExportRequest = z.object({
  teamId: z.string(),
  fromIso: z.string(),
  toIso: z.string(),
  format: z.enum(['json', 'csv', 'pdf']),
  includeBurnReceipts: z.boolean().default(true),
  requestedBy: z.string(),
  requestedAt: z.number().int(),
});

export const AuditExportRow = z.object({
  receiptId: z.string(),
  receiptType: z.string(),
  caller: z.string(),
  skillId: z.string().nullable(),
  costOg: z.number(),
  txHash: z.string().nullable(),
  blockNumber: z.number().int().nullable(),
  timestamp: z.string(),
  approvalChain: z.array(ApprovalGate),
});

export type TeamT = z.infer<typeof Team>;
export type PolicySetT = z.infer<typeof PolicySet>;
export type PolicyRuleT = z.infer<typeof PolicyRule>;
export type ApprovalGateT = z.infer<typeof ApprovalGate>;
export type SpendLedgerEntryT = z.infer<typeof SpendLedgerEntry>;
export type AuditExportRequestT = z.infer<typeof AuditExportRequest>;
export type AuditExportRowT = z.infer<typeof AuditExportRow>;
