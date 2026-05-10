# Wander cycle · autonomous receipt-anchoring agent

> Closes planning-003 §A.4.1 (wandering thought #67). Provus has 30,000+ mainnet TXs from a 15-second autonomous loop. Ivaronix's wander-cycle does the same shape: every N minutes, generate a synthetic lease, run `private-doc-review` on it, anchor a receipt. 12 cycles/hour × 24h × 30 days = ~8,640 receipts/month. Three months = ~25,920 mainnet receipts.

## What it does

Each cycle:
1. Generates a synthetic lease document (`synthetic-leases.ts` rotates rent ranges, term lengths, and red-flag clauses so no two cycles produce identical docs).
2. Writes the lease to `.ivaronix/wander-cycle/in/synthetic-lease-<seed>.txt`.
3. Invokes `ivaronix doc ask <lease> "<question>" --skill private-doc-review --quick` via the workspace CLI.
4. Parses the receipt id + tx hash from the CLI output.
5. Appends one JSONL line to `docs/wander-cycle-history.jsonl` (timestamp, seed, receipt id, tx hash, duration, cost estimate, optional error tail).

Each receipt anchors via `private-doc-review`'s 90/10 fee split, so the operator wallet earns 90% of each receipt's billing.estimatedCostOg.

## Usage

### One iteration (operator can run today)

```bash
pnpm wander:cycle
```

Generates a fresh lease, anchors a real receipt on Galileo testnet (~0.0001 OG cost, ~10 seconds), appends to history. Exits 0 on success.

### Continuous loop

```bash
pnpm wander:loop                   # 5-minute cadence (default)
pnpm wander:loop --interval 600    # 10-minute cadence
pnpm wander:loop --max-cycles 100  # stop after 100 cycles
```

The loop is a long-lived Node process. Trap on SIGINT / SIGTERM for clean shutdown after the current cycle completes.

### Replay (deterministic)

```bash
pnpm wander:cycle --seed 42
```

The synthetic lease generator uses a seeded mulberry32 PRNG, so a given seed always produces the same document. Useful for debugging a specific receipt's content.

### Dry run (lease only, no anchor)

```bash
pnpm wander:cycle --dry-run --seed 42
```

Generates the lease and prints it to stdout without invoking the CLI. Use for inspecting what the synthetic generator produces.

## Operator setup

### Cost on testnet

- Each cycle anchors one receipt at ~0.0001 OG.
- 5-min cadence × 24h = 288 cycles/day × 0.0001 = ~0.029 OG/day.
- 30-day month = ~0.86 OG/month.
- Allocate 1 OG to the CI wallet from the operator's 69 OG balance (per USER_TODO §A-1).

### Daemonising

Pick one of three patterns based on the operator's OS:

#### systemd (Linux)

```ini
# /etc/systemd/system/ivaronix-wander.service
[Unit]
Description=Ivaronix wander-cycle agent
After=network.target

[Service]
Type=simple
User=ivaronix
WorkingDirectory=/opt/ivaronix
EnvironmentFile=/opt/ivaronix/.env
ExecStart=/usr/bin/pnpm wander:loop --interval 300
Restart=on-failure
RestartSec=30s

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ivaronix-wander
sudo systemctl start ivaronix-wander
sudo systemctl status ivaronix-wander
journalctl -u ivaronix-wander -f
```

#### Docker (cross-platform)

```dockerfile
# scripts/wander-cycle/Dockerfile (queued)
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile=false
CMD ["pnpm", "wander:loop"]
```

```bash
docker build -t ivaronix-wander -f scripts/wander-cycle/Dockerfile .
docker run -d --restart unless-stopped --env-file .env --name ivaronix-wander ivaronix-wander
docker logs -f ivaronix-wander
```

#### Windows Task Scheduler

```
Action: Start a program
Program/script: pnpm
Arguments: wander:loop
Start in: C:\Users\prate\Downloads\oglabs
Trigger: On startup; restart on failure every 1 minute
```

### Mainnet promotion

After mainnet redeploy lands (USER_TODO §A-V2-K1 + §A-V2-K2), set `IVARONIX_NETWORK=mainnet` (or legacy `OG_NETWORK=mainnet`) in the wander-cycle env. The CLI's V2-first read pattern (planning-003 §A.1.2) means receipts anchor on `ReceiptRegistryV2` mainnet automatically. Cost on mainnet pending estimate; allocate 3 OG to cover ~90 days of continuous cycles.

## History file

`docs/wander-cycle-history.jsonl` (one line per cycle):

```json
{"ts":"2026-05-10T03:42:18.123Z","seed":1715315338123,"leaseFile":"synthetic-lease-1715315338123.txt","redFlagCount":5,"exitCode":0,"receiptId":"1645","txHash":"0xb77087ee...","durationMs":8421,"costOgEstimate":0.0001}
```

Use `jq` for analytics:

```bash
# Total receipts anchored by the cycle
wc -l docs/wander-cycle-history.jsonl

# Total OG spent
jq -s 'map(.costOgEstimate) | add' docs/wander-cycle-history.jsonl

# Failure rate
jq -s 'map(select(.exitCode != 0)) | length' docs/wander-cycle-history.jsonl

# Last 5 receipt IDs
tail -5 docs/wander-cycle-history.jsonl | jq -r '.receiptId'
```

## Headline narrative

After 90 days of testnet cycles + mainnet promotion + 90 days of mainnet cycles:

> 1,644 manual + 26,000 autonomous = 27,644 receipts on mainnet · proof of continuous architecture, not a demo with traffic.

That's the comparison Provus's "30,000+ TXs" gets answered with.

## Troubleshooting

- `cycle.ts` fails with "Skill not found": ensure `pnpm install` ran and `seed-skills/private-doc-review/` exists.
- CLI hangs > 2min: `cycle.ts` has a 120-second hard timeout. Check Router credentials (`pnpm doctor router`) — likely 402 (depleted) or 429 (rate limited).
- History file grows unbounded: rotate with `mv docs/wander-cycle-history.jsonl docs/wander-cycle-history.$(date +%Y-%m).jsonl` monthly.

## Related

- Planning-003 §A.4.1 (this item)
- USER_TODO §B-V2-7 (CI wallet setup) + §B-V2-3 (mainnet promotion)
- `private-doc-review/SKILL.md` — the skill the cycle invokes
- `docs/MARKETPLACE_DESIGN.md` — why the operator wallet earns 90% of each receipt
