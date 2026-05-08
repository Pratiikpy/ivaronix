# Ivaronix · QA Test Progress

> Live tracker for the QA mission. Source of truth: `docs/QA_MISSION.md`.
> Started: 2026-05-08
> Engineer: agent (cron-paced 1m ticks until TIER 1 PRIMARY green)

## Legend

- ✅ **pass** — feature works end-to-end; visible proof captured
- ❌ **fail** — feature broken; root-cause fixed in commit; re-tested green
- ⏸ **blocked** — cannot run in this environment; reason + unblock action recorded
- ⏳ **in-progress** — currently being verified

Each row carries the commit hash that the test ran against (so re-runs are reproducible).

---

## Tier 1 — PRIMARY (must finish all)

### Setup (§0)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Health + bootstrap (§1.1)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Killer demo (§1.2)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Debug subtree (§1.3)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Stats + indexer (§1.4)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Memory + sessions (§1.5)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Compute + model (§1.6)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Doc / code / audit / swarm / watch (§1.7)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Daemon + native-host pairing (§1.8)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### PR-with-receipts (§1.9)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Export / import (§1.10)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Passport + skill (§1.11)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Receipt verification (§1.12)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### OpenClaw + DA + serve (§1.13)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### chat-v2 (§1.14)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Studio routes (§2)

| Route | Disconnected | Connected | Mobile | Notes |
|---|---|---|---|---|

### Cross-surface integrity (§3)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### MCP server (§4)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Telegram bot (§5)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Foundry (§6)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Workspace typecheck (§7)

| Package | Status | Proof / notes | Commit |
|---|---|---|---|

### Edge cases (§8)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Honesty contract (§9)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

---

## Tier 2 — AGGRESSIVE (only after Tier 1 fully green)

### Performance (§20)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Operational (§21)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

### Polish (§22)

| Test | Status | Proof / notes | Commit |
|---|---|---|---|

---

## Issues found + fixes shipped

| # | Surface | Issue | Severity | Fix commit | Re-test |
|---|---|---|---|---|---|

---

## Skip log (every blocked test must appear here)

| Test | Why blocked | Unblock action | Commit at time of block |
|---|---|---|---|

---

## Session summary

- Tests attempted: 0
- ✅ pass: 0
- ❌ fail (now fixed): 0
- ⏸ blocked: 0
- Issues fixed: 0
- TIER 1 PRIMARY green: NO

When TIER 1 reaches all-green, this section becomes the demo-ready proof. Until then, every cron tick adds rows.
