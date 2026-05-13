# 0G KV self-host

> FINAL_BUILD_PLAN.md Block F · operator-hosted 0G KV server for real
> durable Ivaronix memory.

## Why this exists

Until 0G Foundation ships a hosted KV endpoint, the operator self-hosts
the KV server stack. The deployed Studio's `HttpKvClient` (in
`packages/og-kv/src/index.ts`) talks to this stack via REST on
`http://localhost:1995` (or wherever the operator hosts it).

Without this stack running, `createKvClient()` returns
`InMemoryKvClient` — a Map-backed stub that does NOT survive process
restarts and does NOT participate in cross-session reads. With the
stack running + `KV_REMOTE_URL` set, memory is real.

## What's in the box

| Container | Purpose | Port |
|---|---|---|
| `mongo` | EverMemOS metadata store | 27017 |
| `elasticsearch` | Full-text search index | 9200 |
| `milvus` | Vector embeddings index | 19530 |
| `redis` | Hot cache | 6379 |
| `evermemos` | REST API server (the thing Studio talks to) | **1995** |

Total footprint: ~4 GB RAM, ~8 GB disk for indexed data on a typical
operator-side workload.

## Bring-up

```bash
cd infra/0g-kv

# 1. Provide chain auth for zgs_kv (signs commits to the KV log contract)
cp ../../.env .env.kv  # carries IVARONIX_SIGNER_KEY

# 2. Start the stack
docker compose up -d

# 3. Wait for evermemos to be ready (~30-60s)
docker compose logs -f evermemos | grep "listening on :1995"

# 4. Register the operator user (one-shot)
curl http://localhost:1995/api/v1/users/register -X POST -H "Content-Type: application/json" -d '{"wallet": "0xYOUR_OPERATOR_WALLET"}'
# → returns { "api_key": "...", "user_id": "..." }

# 5. Wire Studio to use the real backend
echo "KV_REMOTE_URL=http://localhost:1995" >> ../../apps/studio/.env.local
echo "KV_API_KEY=<api_key_from_step_4>" >> ../../apps/studio/.env.local

# 6. Restart Studio
pnpm --filter @ivaronix/studio dev
```

After step 6, the Studio's `/memory` page reads/writes through the
real backend. Memory survives process restarts. Cross-session reads
return what was written. Studio's chain-grant middleware
(`apps/studio/src/lib/memory-grant-check.ts`) cross-checks
CapabilityRegistryV2 grants on every read so revocations on chain
become immediate read failures.

## Operator runbook

### Topping up the zgs_kv signer

The `IVARONIX_SIGNER_KEY` wallet signs every KV log commit on chain.
Keep it funded:

```bash
IVARONIX_NETWORK=testnet pnpm ivaronix doctor balance
# → should show > 0.05 OG for ongoing operations
```

### Logs

```bash
docker compose logs -f evermemos     # API access + auth events
docker compose logs -f mongo         # metadata writes
docker compose logs -f elasticsearch # text-index health
```

### Tear down

```bash
docker compose down                  # stop containers, keep volumes
docker compose down -v               # stop + wipe volumes (destructive)
```

## Multi-user isolation

Each Studio user registers a wallet → receives a unique Bearer API key.
Studio's `/api/memory/key` endpoint (SIWE-gated) handles issuance per
the chain-grant cross-check (Block F D-7). User A's API key cannot read
User B's memories — enforced at both the EverMemOS user_id layer AND
the Studio middleware that cross-references `CapabilityRegistryV2.hasGrant`
on every read.

## Honest caveats

- **No 0G Foundation-hosted endpoint exists** as of this build. Self-host is
  the only path. v1.1 expects 0G to ship a managed endpoint; until then,
  operator-side is reality.
- **The 4 GB stack is a real cost** for operators. Lighter footprint is
  v1.1 work (potentially replacing MongoDB + Elastic + Milvus with a
  single embedded store).
- **Process restart on evermemos** mid-write may lose the last few keys
  in flight. The 0G chain anchor lags by ~1 block; recovery scans the
  KV log contract on bring-up.

## v1.1 backlog

- Foundation-hosted KV endpoint integration (when 0G ships one)
- Single-binary embedded store (drop MongoDB + Elastic + Milvus)
- Per-user encryption at rest (currently API-key gated, not content-encrypted)
- Multi-region replication for enterprise SLAs
