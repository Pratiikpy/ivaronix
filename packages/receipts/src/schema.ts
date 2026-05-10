import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Action Receipt schema (RECEIPTS_SPEC.md v1.0)
// ─────────────────────────────────────────────────────────────────────────────

export const ReceiptTypeSchema = z.enum([
  'doc_ask',
  'audit',
  'consensus',
  'burn',
  'memory_access',
  'skill_exec',
  'code_change',
  'passport_update',
  'swarm',
  // Slot 9 (PASS 76 B-1): SubscriptionEscrow check-in tick.
  'subscription_skill_exec',
  // Slots 10-11: Confidential Data Room (Track 5 economy surface — multi-party rooms with grant-gated reads).
  'doc_room_create',
  'doc_room_read',
  // Slot 12: Memory consolidation rollup (planning-01 §2B). The agent
  // reads its own past receipts and signs a window summary.
  'memory_consolidation',
]);

export const NetworkSchema = z.enum(['testnet', 'mainnet']);

const HexHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'must be 0x + 64 hex chars');
const HexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'must be 0x + 40 hex chars');
const Sha256Hex = z.string().regex(/^sha256:[0-9a-f]{64}$/, 'must be sha256:<64-hex>');

const InputArtifact = z.object({
  kind: z.enum(['doc', 'repo', 'file', 'memory', 'url']),
  storageRoot: HexHash.optional(),
  encrypted: z.boolean().optional(),
  url: z.string().url().optional(),
});

const ApprovalChainItem = z.object({
  gate: z.string(),
  decision: z.enum(['auto-allow', 'allow', 'deny', 'approved-with-flags']),
  actor: z.string(),
});

const ConsensusRoleAttestation = z.object({
  role: z.string(),
  attestationHash: HexHash,
  providerAddress: HexAddress,
  /** chat ID returned by Router (ZG-Res-Key header) — required for independent verify via broker.processResponse */
  chatId: z.string().optional(),
  /**
   * The role's response content. Required as the third argument to
   * `broker.inference.processResponse(providerAddress, chatId, content)` —
   * without it, independent verify can only confirm the chat ID was billed,
   * not that the content corresponds to it. Persisted on the receipt so
   * offline verify (e.g. `ivaronix receipt verify --tee-independent` on a
   * saved receipt) reaches the same depth as the live-inference path.
   * Optional for backwards compatibility — older receipts produced before
   * this field shipped will omit it; their independent verify falls back
   * to the 2-arg form with a warning.
   */
  content: z.string().optional(),
  /** Independent verify result, populated by `ivaronix receipt verify --tee-independent` */
  independentVerified: z.boolean().nullable().optional(),
});

export const ReceiptV1Schema = z.object({
  version: z.literal('1.0'),
  id: z.string().regex(/^rcpt_[0-9A-HJ-NP-Z]{26}$/), // ULID after 'rcpt_'
  type: ReceiptTypeSchema,
  parentReceiptId: z.string().nullable().optional(),

  agent: z.object({
    // J-6 tightening (sweep 152): empty passportId would canonical-hash
    // and anchor as a "valid" receipt with no signing identity. Real
    // shape today is `did:0g:passport:0x<40hex>:<tokenId>`; .min(1)
    // catches the empty-string bug without locking in the DID format,
    // which may evolve (e.g. ENS-style names in a future passport release).
    passportId: z.string().min(1),
    ownerWallet: HexAddress,
    trustScoreAtTime: z.number().int(),
    /**
     * W9 · trust-tier marker: who actually held the signing key.
     *  - 'operator'                       → server-side operator key (legacy default)
     *  - 'operator-on-behalf-of-user'     → ownerWallet is user's; operator anchored on behalf (current SIWE-precursor path)
     *  - 'user-direct'                    → user's wallet signed the receipt body itself (full SIWE end-state)
     *
     * Optional in the input — older code paths and tests don't set it.
     * When absent, render it as 'operator' (consumer side default).
     */
    signedBy: z.enum(['operator', 'operator-on-behalf-of-user', 'user-direct']).optional(),
  }),

  request: z.object({
    // J-6 tightening (sweep 152): empty skillId/skillVersion gets
    // canonical-hashed + anchored. .min(1) at minimum; max bounds match
    // the SkillManifestSchema constraints (skillId ≤ 80, version ≤ 40).
    skillId: z.string().min(1).max(80),
    skillVersion: z.string().min(1).max(40),
    skillManifestHash: Sha256Hex,
    userPromptHash: Sha256Hex,
    inputArtifacts: z.array(InputArtifact),
    policyDecision: z.enum(['approved', 'approved-with-flags', 'denied']),
    approvalChain: z.array(ApprovalChainItem),
    /**
     * Prior receipt ids this run consumed as context — the lineage trail.
     * Populated by `memory_consolidation` (planning-01 §2B) and any future
     * receipt that derives its output from earlier receipts. The chain
     * itself stores ids 0..N-1; this field records *which* of those the
     * agent read as input.
     */
    priorReceiptIds: z.array(z.string()).optional(),
    /**
     * 0G Persistent Memory query record (planning-002 W4). Populated only
     * when the run was configured with `ZG_MEMORY_URL` AND the sidecar at
     * that URL returned results. Records the search method, k, and how
     * many memories actually surfaced — so a verifier can confirm the
     * model's context was conditioned on real prior memories vs starting
     * from blank.
     */
    memoryQuery: z
      .object({
        method: z.enum(['keyword', 'vector', 'hybrid', 'rrf', 'agentic']),
        k: z.number().int().min(0).max(50),
        retrievedCount: z.number().int().min(0).max(50),
        ok: z.boolean(),
      })
      .optional(),
  }),

  execution: z.object({
    mode: z.string(),
    burnMode: z.boolean(),
    consensusMode: z.boolean(),
    modelSelection: z.object({
      requested: z.string(),
      final: z.string(),
    }),
    providerRouting: z.object({
      requestedSort: z.enum(['latency', 'price']).nullable().optional(),
      requestedProvider: HexAddress.nullable().optional(),
      allowFallbacks: z.boolean(),
      finalProvider: HexAddress,
    }),
    consensus: z
      .object({
        roles: z.array(z.string()),
        convergenceScore: z.number().min(0).max(1),
        agreementSummary: z.string(),
        disagreementSummary: z.string(),
        individualAttestations: z.array(ConsensusRoleAttestation),
        /**
         * The aggregation policy that was applied to the reviewer outputs
         * (planning-003 §A.4.4 · zer0Gig Efficiency Game). Optional so
         * older receipts (pre-policy) parse unchanged. When present,
         * verifiers can re-run the policy against `individualAttestations`
         * to confirm the recorded `decision` matches what the policy
         * would have produced. Defaults: 'majority' for tiers ≥2 reviewers,
         * meaningless for `quick` (1 reviewer).
         */
        policyApplied: z
          .enum(['unanimous', 'majority', 'first-objection', 'weighted'])
          .optional(),
        /**
         * How many reviewers dissented from the final decision under the
         * applied policy. Zero on a clean unanimous run; equal to
         * `roles.length - 1` worst-case under `first-objection` if every
         * reviewer flagged a different concern.
         */
        dissents: z.number().int().min(0).optional(),
      })
      .optional(),
  }),

  /**
   * Per-run outcome record (planning-003 §A.4.4 · zer0Gig Efficiency Game).
   *
   * `attempts` = how many model retries the run consumed. 1 = first-pass
   * success; 2+ = the model output failed validation and was re-prompted.
   * `firstAttemptScore` is the reviewer-convergence score on the first
   * attempt (filled when `attempts > 1` so the receipt records what the
   * first try produced before the retry overrode it).
   *
   * `finalScore` is the score that gates the fee split. TIER 1 first-attempt
   * with finalScore ≥ 0.85 settles at 95% creator share; TIER 1 retry at
   * 85%; TIER 2 (any) at 70%; a `failed` outcome routes 100% to treasury.
   *
   * `retryReason` names what triggered the retry — `'json-malformed'`,
   * `'gate-rejected'`, `'consensus-low-convergence'`, `'tee-attestation-failed'`.
   * Surfaces on /r/<id> as a small chip when present so a reviewer can
   * see why a run cost more than a clean first-pass.
   */
  outcome: z
    .object({
      attempts: z.number().int().min(1).default(1),
      firstAttemptScore: z.number().min(0).max(1).optional(),
      finalScore: z.number().min(0).max(1).optional(),
      retryReason: z
        .enum([
          'json-malformed',
          'gate-rejected',
          'consensus-low-convergence',
          'tee-attestation-failed',
          'router-rotation',
          'other',
        ])
        .optional(),
      status: z.enum(['ok', 'failed', 'partial']).default('ok'),
    })
    .optional(),

  routerTrace: z.object({
    requestId: z.string(),
    zgResKey: z.string().optional(),
    x0gTrace: z.record(z.string(), z.unknown()).default({}),
    rateLimit: z.object({
      limitRequests: z.number().nullable().optional(),
      remainingRequests: z.number().nullable().optional(),
      resetRequests: z.number().nullable().optional(),
    }),
    /**
     * Credential rotations that happened mid-run (planning-003 §A.5.14).
     * `Keyring.invalidate(label, reason)` distinguishes 402 (depleted),
     * 429 (rate-limited), and 'auth' (rejected) failure modes; this
     * field records each rotation so the receipt body explains why a
     * given run swapped credentials. Empty array on the happy path.
     *
     * `fromCredential` / `toCredential` are the human label only — the
     * secret never leaves the keyring. Studio /r/<id> renders the list
     * as a small chip when non-empty.
     */
    rotations: z
      .array(
        z.object({
          fromCredential: z.string(),
          toCredential: z.string(),
          reason: z.enum(['402', '429', 'auth']),
          atMs: z.number().int().nonnegative(),
        }),
      )
      .default([]),
  }),

  teeVerification: z.object({
    requested: z.boolean(),
    routerVerified: z.boolean(),
    independentVerified: z.boolean().nullable(),
    providerAddress: HexAddress.optional(),
    verificationMethod: z.enum([
      'router_flag',
      'compute_sdk_process_response',
      // External providers (TIER 2 — no TEE; signed + chain-anchored only).
      // Used when receipts are anchored from inference done outside 0G Compute.
      'external-signed',
    ]),
    verifiedAt: z.number().nullable(),
    attestationHash: HexHash.optional(),
    /**
     * Trust tier for the public Proof URL. Optional + defaulted in the verifier
     * UI so older receipts (which omit this field) still render correctly:
     *   - "tier-1-tee"               0G Router + TEE attestation in the receipt
     *   - "tier-2-external-signed"   non-0G provider (NVIDIA NIM, OpenAI, ...);
     *                                receipt is signed + chain-anchored but the
     *                                inference itself is outside the TEE
     */
    tier: z.enum(['tier-1-tee', 'tier-2-external-signed']).optional(),
    providerKind: z.enum(['0g-router', 'nvidia-nim', 'openai', 'anthropic', 'ollama']).optional(),
  }),

  billing: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    inputCostNeuron: z.string(),
    outputCostNeuron: z.string(),
    totalCostNeuron: z.string(),
    totalCostOg: z.string(),
    /**
     * Track 3 (Agentic Economy) settlement: when the executing skill's
     * manifest declares `og.creator.fee_split`, this records the
     * per-actor allocation in neuron + the creator's passport address.
     * Optional — older receipts (and receipts for skills without a
     * fee_split) omit it. Sum of allocations equals `totalCostNeuron`.
     */
    feeSplit: z
      .object({
        creatorBps: z.number().int().min(0).max(10000),
        treasuryBps: z.number().int().min(0).max(10000),
        creatorNeuron: z.string(),
        treasuryNeuron: z.string(),
        creatorPassport: z.string().optional(),
        // planning-002 W5 · Efficiency Game: TIER 1 receipts apply a 100%
        // multiplier to the declared creator bps; TIER 2 apply 85%. The
        // declared* fields preserve the manifest-stated split so the
        // delta is auditable from the receipt body alone.
        tier: z.enum(['TIER_1', 'TIER_2']).optional(),
        tierMultiplierBps: z.number().int().min(0).max(10000).optional(),
        declaredCreatorBps: z.number().int().min(0).max(10000).optional(),
        declaredTreasuryBps: z.number().int().min(0).max(10000).optional(),
      })
      .optional(),
  }),

  storage: z.object({
    receiptRoot: HexHash,
    receiptTxHash: HexHash.optional(),
    evidenceRoot: HexHash.optional(),
    proofDownloadVerified: z.boolean().default(false),
    /**
     * planning-002 W3 · 0G DA dispersal record. Populated only when the
     * runtime was configured with `ZG_DA_URL` AND the DA Client node at
     * that URL accepted the blob. When unset, the receipt body omits the
     * field — no fabricated claim. The request_id is the load-bearing
     * handle for retrieve via `da.RetrieveBlob(storage_root, epoch, quorum_id)`.
     */
    daBlobRef: z
      .object({
        endpoint: z.string(),
        requestIdHex: z.string().regex(/^0x[0-9a-f]+$/i),
        status: z.enum(['UNKNOWN', 'PROCESSING', 'CONFIRMED', 'FAILED', 'INSUFFICIENT_SIGNATURES']),
        blobBytes: z.number().int().nonnegative(),
        dispersedAt: z.number().int(),
      })
      .optional(),
    encryption: z.object({
      enabled: z.boolean(),
      type: z.enum(['aes-256-gcm', 'wallet', 'none']),
      headerDetected: z.boolean(),
      keyFingerprint: Sha256Hex.optional(),
    }),
  }),

  burn: z
    .object({
      sessionKeyDestroyedAt: z.number(),
      localCleanupStatus: z.enum(['completed', 'partial', 'failed']),
      tempPathsZeroed: z.array(z.string()),
      wording: z.string(),
    })
    .optional(),

  chainAnchor: z.object({
    network: NetworkSchema,
    chainId: z.number().int(),
    rpcUrlHash: Sha256Hex,
    registryAddress: HexAddress,
    anchorTxHash: HexHash.optional(),
    anchorBlockNumber: z.number().int().optional(),
    anchorTimestamp: z.number().int().optional(),
  }),

  outputs: z.object({
    outputHash: Sha256Hex,
    summaryHash: Sha256Hex.optional(),
    citations: z.array(Sha256Hex).default([]),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    wording: z
      .object({
        headline: z.string().max(200),
        doNotSay: z.array(z.string()),
      })
      .optional(),
  }),

  createdAt: z.number().int(),
  createdBy: z.string(),
  signature: z
    .object({
      method: z.literal('eth_personal_sign'),
      signer: HexAddress,
      signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
    })
    .optional(),
});

export type ReceiptV1 = z.infer<typeof ReceiptV1Schema>;
export type UnsignedReceiptV1 = Omit<ReceiptV1, 'signature'>;
