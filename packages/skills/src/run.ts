import type { ConsensusTier } from '@ivaronix/core';
import type { Keyring } from '@ivaronix/og-router';
import { runConsensus, type ConsensusResult } from '@ivaronix/consensus';
import type { LoadedSkill } from './loader.js';

export interface RunSkillInput {
  skill: LoadedSkill;
  /** Plaintext document/code/data for the skill to analyze. */
  context: string;
  /** Raw bytes of the input (for sensitive-content gates). */
  rawBytes: Buffer | Uint8Array;
  /** User's free-form question or instruction. */
  userPrompt: string;
  /** Optional override of the skill's default consensus tier. */
  tierOverride?: ConsensusTier;
  /** Router keyring (with auto-rotation). */
  keyring: Keyring;
  /** Model id (defaults to qwen-2.5-7b). */
  model?: string;
  /**
   * Optional operator signer private key. Forwarded to gate 2 for
   * exact-match private-key detection (zero false positives).
   * Per planning-003 §A.5.15.
   */
  signerPrivateKey?: string;
}

export interface RunSkillResult extends ConsensusResult {
  skillId: string;
  skillVersion: string;
  skillManifestHash: `sha256:${string}`;
  /** Skill-prescribed default tier (informational; actual tier is in `tier`). */
  defaultTier: ConsensusTier;
}

/**
 * Run a loaded skill — composes the skill's system prompt body with the user's
 * question, runs through the chosen consensus tier, returns full result.
 *
 * The skill's prompt body becomes the *role-shared instruction prefix*.
 * Each role (analyst/critic/judge in Standard tier) still gets its own role
 * frame on top — the skill prompt is the *what* and the role prompt is the *how*.
 */
export async function runSkill(input: RunSkillInput): Promise<RunSkillResult> {
  const { skill, context, rawBytes, userPrompt, tierOverride, keyring, model, signerPrivateKey } = input;

  const tier: ConsensusTier = tierOverride ?? skill.manifest.og.consensus.default_tier;

  // The skill body is the canonical instruction for this skill. We prepend it
  // to the doc context so every role inherits it.
  const enrichedContext = `${skill.systemPromptBody}\n\n--- INPUT START ---\n${context}\n--- INPUT END ---`;

  const consensus = await runConsensus({
    tier,
    keyring,
    model: model ?? 'qwen/qwen-2.5-7b-instruct',
    context: enrichedContext,
    userPrompt,
    rawBytes,
    signerPrivateKey,
  });

  return {
    ...consensus,
    skillId: skill.id,
    skillVersion: skill.manifest.version,
    skillManifestHash: skill.manifestHash,
    defaultTier: skill.manifest.og.consensus.default_tier,
  };
}
