/**
 * Ivaronix lifecycle hooks (Day 11)
 *
 * Hooks are typed TypeScript modules referenced **by name** in a skill's
 * manifest under `og.hooks`. There is no arbitrary-code-execution surface —
 * the runtime resolves the name to a registered implementation in
 * `packages/skills/src/hooks/builtin/`. This is the safety boundary: a
 * forked skill cannot ship its own hook code via the manifest; it can only
 * subscribe to hooks the runtime has already vetted.
 *
 * (Day 19+ adds an opt-in WASM hook module path with capability-based
 * sandboxing; that is intentionally out of scope here.)
 */

import type { ConsensusTier } from '@ivaronix/core';
import type { LoadedSkill } from '../loader.js';

/** Lifecycle event kinds. */
export type HookEventKind =
  | 'session.start'       // CLI run begins
  | 'consensus.pre'       // about to call the router (last-mile gate)
  | 'consensus.post'      // router returned a result
  | 'receipt.pre-anchor'  // receipt signed locally; about to anchor
  | 'receipt.post-anchor' // receipt anchored on chain
  | 'session.end';        // CLI run finished

export interface HookContextBase {
  skill: LoadedSkill;
  network: 'testnet' | 'mainnet';
  /** Caller's wallet address. */
  caller: `0x${string}` | null;
  /** Caller's passport trust score (0 if no passport). */
  trustScore: number;
}

export interface HookEvent_SessionStart extends HookContextBase {
  kind: 'session.start';
  command: string;
  argv: readonly string[];
  startedAt: number;
}

export interface HookEvent_PreConsensus extends HookContextBase {
  kind: 'consensus.pre';
  /** The plaintext context that will be sent to the router. Hooks may patch it. */
  context: string;
  userPrompt: string;
  tier: ConsensusTier;
  estimatedCostOg: number;
}

export interface HookEvent_PostConsensus extends HookContextBase {
  kind: 'consensus.post';
  ms: number;
  inputTokens: number;
  outputTokens: number;
  costOg: number;
  convergenceScore: number | null;
}

export interface HookEvent_PreAnchor extends HookContextBase {
  kind: 'receipt.pre-anchor';
  receiptId: string;
  receiptRoot: string;
}

export interface HookEvent_PostAnchor extends HookContextBase {
  kind: 'receipt.post-anchor';
  receiptId: string;
  txHash: string;
  blockNumber: number;
}

export interface HookEvent_SessionEnd extends HookContextBase {
  kind: 'session.end';
  totalMs: number;
  receiptsAnchored: string[];
  exitCode: number;
}

export type HookEvent =
  | HookEvent_SessionStart
  | HookEvent_PreConsensus
  | HookEvent_PostConsensus
  | HookEvent_PreAnchor
  | HookEvent_PostAnchor
  | HookEvent_SessionEnd;

export interface HookResult {
  /** Allow downstream action to proceed. Only meaningful for pre-* events. */
  allow: boolean;
  /** Replacement payload (e.g., redacted `context`). Only respected for pre-* events. */
  patch?: Partial<Pick<HookEvent_PreConsensus, 'context' | 'userPrompt'>>;
  /** Free-form log lines emitted by the hook. */
  logs?: string[];
  /** Human-readable reason when allow=false or when emitting an audit-worthy decision. */
  reason?: string;
}

export interface BuiltinHook {
  /** Stable identifier; matches the string in manifest `og.hooks.*` */
  name: string;
  /** Events this hook handles. */
  subscribes: readonly HookEventKind[];
  /** Implementation. */
  run(event: HookEvent): Promise<HookResult> | HookResult;
}
