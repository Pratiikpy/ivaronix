# Iter-156 · Audit tier 6-role consensus · FULLY VERIFIED

Plan §804 "Consensus tier `audit` | 6 roles — adds `red-team-critic` on top of high-stakes. Composition is monotone (quick ⊂ standard ⊂ high-stakes ⊂ audit)."

## Run

`ivaronix doc ask <fixture> "What is most concerning?" --audit`

- Receipt: `rcpt_01KRFPWZ8XC7R0VMY0G55DS4EA`
- Receipt root: `0x35d5a3030482ead83bc1f6d481e435f829a8fe19795d86d58965e17413fab829`
- Anchor tx: `0xf1a6eaf4daac34ea9b655e03ff8a70b530dd6f19186c45ecb2bf5dfe581200d1`
- Block: 33034142 · V2 id=12
- Passport updated: receiptCount 1633, trustScore 1633

## 6 roles fired (matches plan §804 composition)

| Role | Source |
|---|---|
| analyst | inherited from quick tier |
| critic | inherited from standard tier |
| risk-reviewer | inherited from high-stakes tier |
| evidence-checker | inherited from high-stakes tier |
| **red-team-critic** | added by audit tier (the marginal role) |
| judge | inherited from standard tier |

## TEE-independent verification

`ivaronix receipt verify 12 --tee-independent` output:

```
schema                 PASS
hash                   PASS
signature              PASS
                    → CLAIMED
chain anchor          PASS  (id=12 block≈1778643798) · V2
                    → ANCHORED
tee:analyst          PASS  (provider 0xa48f0128…)
tee:critic           PASS  (provider 0xa48f0128…)
tee:risk-reviewer    PASS  (provider 0xa48f0128…)
tee:evidence-checker  PASS  (provider 0xa48f0128…)
tee:red-team-critic  PASS  (provider 0xa48f0128…)
tee:judge            PASS  (provider 0xa48f0128…)
                    → FULLY VERIFIED

Status: → FULLY VERIFIED ✓
```

Every single role's TEE attestation INDEPENDENTLY re-verified via `broker.processResponse` against the live 0G Compute provider at `0xa48f0128...`. This is the strictest correctness proof the protocol allows.

## Verdict

✅ PASS — Audit tier (6-role consensus) works end-to-end with full TEE verification at every role. Composition is monotone per plan §804: quick(1) ⊂ standard(3) ⊂ high-stakes(5) ⊂ audit(6).

This proves plan §2.1's headline claim: "independent TEE re-verify via broker.processResponse" works at the audit tier where 6 distinct roles all need their attestations to match the actual 0G Compute provider's records.

Receipt #12 joins the FULLY-VERIFIED list (previously #994 #1004 #1056 #1069 #10 #11 from earlier iters).
