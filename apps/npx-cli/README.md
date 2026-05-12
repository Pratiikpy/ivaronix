# ivaronix

> Run a 0G-anchored audit, get a public receipt URL.

`npx ivaronix` is the zero-install entry to the Ivaronix CLI. Every command writes a receipt to 0G Chain you can replay on any machine.

## Install / run

No install needed — `npx` fetches and runs:

```bash
npx ivaronix doctor --network
npx ivaronix doc ask contract.pdf "find risky clauses" --skill private-doc-review --consensus
```

For a permanent install:

```bash
pnpm add -g ivaronix
```

## What you'll see

A single audit produces a receipt anchored on 0G Galileo testnet, with a public proof URL anyone can verify:

```
$ npx ivaronix doc ask sample-lease.txt "is this auto-renew?" --quick
  → drafting   ✓ 0.4s
  → consensus  ✓ 1.8s · 1 reviewer · convergence 1.000
  → anchor     ✓ 2.1s · receipt id 1644 · tx 0xb77087ee…

  Receipt:    https://ivaronix.vercel.app/r/1644
  Tx hash:    https://chainscan-galileo.0g.ai/tx/0xb77087ee…
  Cost:       0.0001 OG
```

The receipt URL renders the answer, the TIER 1 / TIER 2 verification chip, the on-chain anchor, and an independent re-verify path (`broker.processResponse`).

## Common commands

- `npx ivaronix doctor` — environment + 0G Router + chain reachability.
- `npx ivaronix doc ask <file> "<question>"` — TEE-attested doc Q&A with consensus.
- `npx ivaronix receipt show <id>` — read any receipt back from chain.
- `npx ivaronix receipt verify <id> --tee-independent` — re-run the TEE attestation locally; no Ivaronix infrastructure needed.
- `npx ivaronix skill list` — first-party + community-imported skills.
- `npx ivaronix passport mint <handle>` — claim an ERC-7857 Agent Passport.
- `npx ivaronix mem grant <agent> --scope all` — grant a third-party agent access to your memory.

## Setup

A first run will prompt you to drop a few values into `.env` (the CLI prints exact lines):

- `IVARONIX_SIGNER_KEY` — the EVM key Ivaronix uses to sign receipts and pay testnet gas. Generate fresh: `node -e 'const{Wallet}=require("ethers");const w=Wallet.createRandom();console.log(w.address);console.log(w.privateKey);'`. Top up at the [Galileo faucet](https://faucet.0g.ai).
- `IVARONIX_ROUTER_KEY` — your 0G Router credential (TIER 1 TEE-attested inference path). Legacy alias `ZG_API_SECRET` still resolves via the alias chain.
- `IVARONIX_NETWORK=testnet` — switch to `mainnet` once the operator has redeployed (USER_TODO §B-V2-3).

## Source + docs

- Source: <https://github.com/Pratiikpy/ivaronix>
- Receipt verifier widget: `@ivaronix/widget` on npm
- 0G primitive depth proof: <https://ivaronix.vercel.app/0g> (post-rename · planning-003 §A.5.17)

## License

Apache-2.0.
