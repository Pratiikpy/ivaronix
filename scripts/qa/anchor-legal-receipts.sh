#!/usr/bin/env bash
# Anchor the legal-cluster receipts on Galileo testnet · fire 8/10 of the
# LEGAL VERTICAL HARD-LAUNCH PIVOT (2026-05-14).
#
# Already anchored before this script ran:
#   - private-doc-review · sample-lease.txt · tx 0x04309b31...
#   - contract-renewal-clause-detector · sample-vendor-contract.txt · rcpt_01KRK5AYXFAK7434XWBHZ6GEMP (id 54)
#
# Remaining: 11 receipts to reach the directive's target of 13 (12 across
# the 4 new skills + 1 private-doc-review v0.4.0 refresh proof).
#
# Output: append-only log at QA_PROOF_PACK/legal-cluster/anchor-run.log
set -u  # don't -e — we want partial success captured even if one anchor fails

cd "$(dirname "$0")/../.."
REPO_ROOT="$PWD"
LOG_FILE="$REPO_ROOT/QA_PROOF_PACK/legal-cluster/anchor-run.log"

declare -a runs=(
  "contract-renewal-clause-detector|seed-skills/contract-renewal-clause-detector/tests/sample-vendor-contract.txt|Scan this contract for auto-renewal and price-uplift clauses."
  "contract-renewal-clause-detector|seed-skills/contract-renewal-clause-detector/tests/sample-vendor-contract.txt|Find every renewal-trap clause in this MSA."
  "nda-triage-reviewer|seed-skills/nda-triage-reviewer/tests/sample-standard-mutual-nda.txt|Triage this NDA."
  "nda-triage-reviewer|seed-skills/nda-triage-reviewer/tests/sample-aggressive-one-way-nda.txt|Triage this NDA."
  "nda-triage-reviewer|seed-skills/nda-triage-reviewer/tests/sample-buried-nonsolicit-nda.txt|Triage this NDA."
  "term-sheet-risk-scanner|seed-skills/term-sheet-risk-scanner/tests/sample-yc-safe.txt|Scan this term sheet for founder-impact terms."
  "term-sheet-risk-scanner|seed-skills/term-sheet-risk-scanner/tests/sample-standard-series-a.txt|Scan this term sheet for founder-impact terms."
  "term-sheet-risk-scanner|seed-skills/term-sheet-risk-scanner/tests/sample-aggressive-series-b.txt|Scan this term sheet for founder-impact terms."
  "legal-citation-verifier|seed-skills/legal-citation-verifier/tests/sample-all-real-citations.txt|Verify every citation in this brief."
  "legal-citation-verifier|seed-skills/legal-citation-verifier/tests/sample-two-hallucinated-cases.txt|Verify every citation in this brief."
  "legal-citation-verifier|seed-skills/legal-citation-verifier/tests/sample-real-case-wrong-court.txt|Verify every citation in this brief."
)

echo "==== anchor-run started · $(date -u +%Y-%m-%dT%H:%M:%SZ) ====" >> "$LOG_FILE"

i=0
for run in "${runs[@]}"; do
  i=$((i + 1))
  skill="${run%%|*}"
  rest="${run#*|}"
  vector="${rest%%|*}"
  question="${rest#*|}"
  echo "" >> "$LOG_FILE"
  echo "--- $i/${#runs[@]} · $skill · $(basename "$vector") · $(date -u +%H:%M:%SZ) ---" >> "$LOG_FILE"
  pnpm --filter @ivaronix/cli dev doc ask "$REPO_ROOT/$vector" "$question" --skill "$skill" 2>&1 \
    | grep -E "receiptId|receiptRoot|tx hash|block |gas used|receipt on-chain id|Status:|FAIL|fail|ANCHORED" \
    >> "$LOG_FILE"
done

echo "" >> "$LOG_FILE"
echo "==== anchor-run done · $(date -u +%Y-%m-%dT%H:%M:%SZ) ====" >> "$LOG_FILE"
echo "DONE: ${#runs[@]} anchor attempts complete"
