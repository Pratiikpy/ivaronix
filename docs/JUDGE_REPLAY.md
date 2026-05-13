# Judge replay · 60-second verify path

> One-page reproduction guide. Tested on a clean clone — every command works copy-paste.

## What this proves

The receipt at the link below was created by Ivaronix, anchored on 0G Chain, signed by an `AgentPassport`-resolvable wallet, and re-verifies independently from any machine in under 10 seconds.

You don't need an account, a wallet, or to trust us.

## Path A · zero-install (60 seconds)

Open in any browser:

```
https://ivaronix.vercel.app/r/1004
```

What you'll see:

- **TIER 1 chip (green)** — inference ran inside a TEE on 0G Compute.
- **0GM chip (green)** — model source is 0G's hosted compute, not external.
- **Anchor tx hash** — clickable → opens Galileo chainscan → you'll see the on-chain anchor event.
- **Receipt body** — what skill ran, what the analysis found, when, who signed.

The page works without any auth. The receipt is public by design; what stays private is the *input* (covered by Burn Mode — the session key is destroyed after the run).

## Path B · independent CLI verify (5 minutes)

Re-run the broker's `processResponse` against the actual 0G Compute provider on your machine. This is the gold-standard verification path — no competitor in this hackathon ships it.

```bash
# Clone + install (one-time)
git clone https://github.com/Pratiikpy/ivaronix.git
cd ivaronix
pnpm install
cp .env.example .env
# Edit .env — set IVARONIX_SIGNER_KEY to ANY funded Galileo wallet
# (you can generate one with: node -e 'const{Wallet}=require("ethers");const w=Wallet.createRandom();console.log(w.address);console.log(w.privateKey);')
# Faucet: https://faucet.0g.ai · promo code: 0G-APAC-HACKATHON

# Re-verify the receipt — runs all 6 checks: schema, hash, signature,
# anchor, payment, TEE attestation
pnpm ivaronix receipt verify 1004 --tee-independent
```

Expected output:

```
✓ Schema       canonical-json + Zod
✓ Hash         keccak256(canonical-json-without-signature) matches receiptRoot
✓ Signature    ECDSA recovered → agent.ownerWallet
✓ Anchor       ReceiptRegistry on Galileo (chainId 16602)
✓ TEE          broker.processResponse re-run against 0G Compute provider
→ FULLY VERIFIED ✓
```

The TEE step is the kill-shot — your machine queries the actual TEE provider, decodes the attestation envelope, and confirms the response came from the same isolated enclave that ran the inference.

## Path C · fresh receipt (30 seconds in browser)

Want a fresh receipt with your own document?

```
https://ivaronix.vercel.app/?demo=true
```

Click "Run review →". The pipeline:
1. Encrypts your file in the browser (Burn Mode).
2. Uploads ciphertext to 0G Storage.
3. Runs the specialist skill inside a TEE on 0G Compute.
4. Signs + anchors the receipt on 0G Chain.
5. Renders the proof page at a public URL.

The demo path is operator-subsidised — the receipt's `billing.payment.subsidised` is `true`, the operator paid the OG gas + creator/treasury fees. The cryptographic guarantees are identical to a user-paid run; only the payer is different.

For a paid run with your own wallet, click "Run on my own doc" instead — connect MetaMask, switch to Galileo (chainId 16602), pay ~0.001 OG per run.

## Galileo halt fallback

If Galileo testnet is temporarily halted at the time you read this (~3 days/year historically), the pre-anchored backup receipt IDs are documented in `apps/studio/src/lib/demo-fallback.ts`. Path A still works against pre-anchored state; only Path C (fresh anchor) is gated on chain liveness.

## Mainnet receipts

Once mainnet deploy lands (gated on operator funding the Aristotle deployer wallet — see `contracts/deployments/mainnet.json`), Path A works against `https://ivaronix.vercel.app/r/<mainnet-id>` and Path B works with `IVARONIX_NETWORK=mainnet`. The 6 verifier checks return identical semantics on either chain — same code, same proof shape.

## Questions

| Question | Where to look |
|---|---|
| What is each receipt field? | `docs/RECEIPT_SCHEMA.md` |
| What is the threat model? | `SECURITY.md` |
| How do the 0G primitives integrate? | `README.md` "Built on 0G" |
| Why this design? | `apps/studio/src/app/thesis/page.tsx` (live: `/thesis`) |
| What's NOT shipped yet? | `docs/HALF_BAKED.md` + `docs/USER_TODO.md` |
| Why not 0G DA in v1? | `README.md` "0G DA · honest roadmap" |

## What this is NOT

- It is NOT a vendor data room. The receipt page is public by design; private inputs use Burn Mode.
- It is NOT a directory of every skill on every chain. The on-chain `SkillRegistry` indexes only Ivaronix-signed first-party + per-wallet sandbox skills.
- It is NOT a finished product. The v1.1 backlog is in `docs/USER_TODO.md §B-V3-*`.

If any step above fails, please open an issue at the repo with the exact command you ran and the output. The build is no-compromise — if Path A or B doesn't work, that's a bug we want to fix.
