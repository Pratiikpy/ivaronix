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
  /** Independent verify result, populated by `ivaronix receipt verify --tee-independent` */
  independentVerified: z.boolean().nullable().optional(),
});

export const ReceiptV1Schema = z.object({
  version: z.literal('1.0'),
  id: z.string().regex(/^rcpt_[0-9A-HJ-NP-Z]{26}$/), // ULID after 'rcpt_'
  type: ReceiptTypeSchema,
  parentReceiptId: z.string().nullable().optional(),

  agent: z.object({
    passportId: z.string(),
    ownerWallet: HexAddress,
    trustScoreAtTime: z.number().int(),
  }),

  request: z.object({
    skillId: z.string(),
    skillVersion: z.string(),
    skillManifestHash: Sha256Hex,
    userPromptHash: Sha256Hex,
    inputArtifacts: z.array(InputArtifact),
    policyDecision: z.enum(['approved', 'approved-with-flags', 'denied']),
    approvalChain: z.array(ApprovalChainItem),
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
      })
      .optional(),
  }),

  routerTrace: z.object({
    requestId: z.string(),
    zgResKey: z.string().optional(),
    x0gTrace: z.record(z.string(), z.unknown()).default({}),
    rateLimit: z.object({
      limitRequests: z.number().nullable().optional(),
      remainingRequests: z.number().nullable().optional(),
      resetRequests: z.number().nullable().optional(),
    }),
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
      })
      .optional(),
  }),

  storage: z.object({
    receiptRoot: HexHash,
    receiptTxHash: HexHash.optional(),
    evidenceRoot: HexHash.optional(),
    proofDownloadVerified: z.boolean().default(false),
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
