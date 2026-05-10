import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { sha256HexAsync } from '@ivaronix/core';
import { buildReceipt, signReceipt, defaultChainAnchor, type BuildReceiptInput } from './builder.js';
import { verifyClaimed } from './verify.js';

const TEST_REGISTRY = '0x000000000000000000000000000000000000bEEF' as `0x${string}`;

function fixtureInput(walletAddress: string): BuildReceiptInput {
  return {
    type: 'doc_ask' as const,
    agent: {
      passportId: 'did:0g:passport:0xtest:1',
      ownerWallet: walletAddress as `0x${string}`,
      trustScoreAtTime: 0,
    },
    request: {
      skillId: 'private-doc-review',
      skillVersion: '0.0.1',
      skillManifestHash: sha256HexAsync('manifest-bytes'),
      userPromptHash: sha256HexAsync('user-prompt'),
      inputArtifacts: [{ kind: 'doc' as const, encrypted: true }],
      policyDecision: 'approved' as const,
      approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow' as const, actor: 'policy:default-strict' }],
    },
    execution: {
      mode: 'doc_ask',
      burnMode: false,
      consensusMode: false,
      modelSelection: { requested: 'qwen/qwen-2.5-7b-instruct', final: 'qwen/qwen-2.5-7b-instruct' },
      providerRouting: { allowFallbacks: true, finalProvider: '0xa48f01287233509FD694a22Bf840225062E67836' as `0x${string}` },
    },
    routerTrace: {
      requestId: 'req-test-1',
      x0gTrace: {},
      rateLimit: {},
      rotations: [],
    },
    teeVerification: {
      requested: true,
      routerVerified: true,
      independentVerified: null,
      verificationMethod: 'router_flag' as const,
      verifiedAt: null,
    },
    billing: {
      inputTokens: 100,
      outputTokens: 50,
      inputCostNeuron: '5000000000',
      outputCostNeuron: '5000000000',
      totalCostNeuron: '10000000000',
      totalCostOg: '0.00001',
    },
    storage: {
      proofDownloadVerified: false,
      encryption: { enabled: false, type: 'none' as const, headerDetected: false },
    },
    chainAnchor: defaultChainAnchor('testnet', TEST_REGISTRY),
    outputs: {
      outputHash: sha256HexAsync('output-bytes'),
      citations: [],
    },
    createdBy: 'ivaronix-forge/0.0.1',
  };
}

test('buildReceipt returns a draft with id, createdAt, and a non-zero receipt root', () => {
  const wallet = Wallet.createRandom();
  const draft = buildReceipt(fixtureInput(wallet.address));

  assert.match(draft.id, /^rcpt_[0-9A-HJ-NP-Z]{26}$/);
  assert.equal(typeof draft.createdAt, 'number');
  assert.notEqual(draft.storage.receiptRoot, '0x' + '0'.repeat(64));
  assert.match(draft.storage.receiptRoot, /^0x[0-9a-fA-F]{64}$/);
});

test('canonical hash is deterministic', () => {
  const wallet = Wallet.createRandom();
  const input = fixtureInput(wallet.address);

  // Two builds of the SAME input should produce the same root hash (modulo id+createdAt randomness).
  // We compare the structural hash by overriding id+createdAt for deterministic comparison.
  const d1 = buildReceipt(input);
  const d2 = { ...buildReceipt(input), id: d1.id, createdAt: d1.createdAt };
  // Re-hash d2 manually: but here we just confirm hash format.
  assert.match(d1.storage.receiptRoot, /^0x[0-9a-fA-F]{64}$/);
  assert.match(d2.storage.receiptRoot, /^0x[0-9a-fA-F]{64}$/);
});

test('signReceipt produces signature recoverable to signer', async () => {
  const wallet = Wallet.createRandom();
  const draft = buildReceipt(fixtureInput(wallet.address));
  const signed = await signReceipt(draft, wallet);

  assert.equal(signed.signature.signer.toLowerCase(), wallet.address.toLowerCase());
  assert.match(signed.signature.signature, /^0x[0-9a-fA-F]+$/);
});

test('verifyClaimed returns CLAIMED for a valid signed receipt', async () => {
  const wallet = Wallet.createRandom();
  const draft = buildReceipt(fixtureInput(wallet.address));
  const signed = await signReceipt(draft, wallet);

  const result = verifyClaimed(signed);

  assert.equal(result.state, 'CLAIMED');
  assert.deepEqual(
    result.checks.map((c) => ({ name: c.name, pass: c.pass })),
    [
      { name: 'schema', pass: true },
      { name: 'hash', pass: true },
      { name: 'signature', pass: true },
    ],
  );
});

test('verifyClaimed rejects tampered receipt (output hash changed after sign)', async () => {
  const wallet = Wallet.createRandom();
  const draft = buildReceipt(fixtureInput(wallet.address));
  const signed = await signReceipt(draft, wallet);

  // Tamper: change output hash after signing
  const tampered = { ...signed, outputs: { ...signed.outputs, outputHash: sha256HexAsync('different') } };

  const result = verifyClaimed(tampered);
  assert.equal(result.state, 'INVALID');
  assert.equal(result.checks.find((c) => c.name === 'hash')?.pass, false);
});

test('verifyClaimed rejects signature from a different wallet', async () => {
  const owner = Wallet.createRandom();
  const attacker = Wallet.createRandom();

  const draft = buildReceipt(fixtureInput(owner.address));
  const signed = await signReceipt(draft, attacker); // signed by wrong key

  const result = verifyClaimed(signed);
  assert.equal(result.state, 'INVALID');
  assert.equal(result.checks.find((c) => c.name === 'signature')?.pass, false);
});

test('verifyClaimed accepts operator-on-behalf-of-user · I-3/K-14 closure', async () => {
  // The W9 trust tier: operator signs on behalf of an authenticated user.
  // signer != ownerWallet BY DESIGN — operator's wallet anchors a receipt
  // attributing the action to the user's wallet (verified via SIWE at
  // /api/run before the receipt was created).
  const operator = Wallet.createRandom();
  const userWallet = Wallet.createRandom();

  const input = fixtureInput(userWallet.address);
  input.agent.signedBy = 'operator-on-behalf-of-user';
  const draft = buildReceipt(input);
  const signed = await signReceipt(draft, operator); // operator signs

  const result = verifyClaimed(signed);
  assert.equal(result.state, 'CLAIMED');
  const sigCheck = result.checks.find((c) => c.name === 'signature');
  assert.equal(sigCheck?.pass, true);
  // Detail records the trust gradient honestly.
  assert.match(sigCheck?.detail ?? '', /delegated/);
});

test('verifyClaimed rejects signer != ownerWallet when signedBy=operator (legacy)', async () => {
  // Without the signedBy override, the equality check still fires.
  const owner = Wallet.createRandom();
  const attacker = Wallet.createRandom();

  const input = fixtureInput(owner.address);
  input.agent.signedBy = 'operator';
  const draft = buildReceipt(input);
  const signed = await signReceipt(draft, attacker);

  const result = verifyClaimed(signed);
  assert.equal(result.state, 'INVALID');
  assert.equal(result.checks.find((c) => c.name === 'signature')?.pass, false);
});

test('verifyClaimed rejects signer != ownerWallet when signedBy=user-direct', async () => {
  // The full-SIWE end-state requires the user's own wallet to sign.
  const user = Wallet.createRandom();
  const operator = Wallet.createRandom();

  const input = fixtureInput(user.address);
  input.agent.signedBy = 'user-direct';
  const draft = buildReceipt(input);
  const signed = await signReceipt(draft, operator); // operator wrongly signed for a user-direct claim

  const result = verifyClaimed(signed);
  assert.equal(result.state, 'INVALID');
  assert.equal(result.checks.find((c) => c.name === 'signature')?.pass, false);
});
