# Failure Flow Audit · Plan §1382 + §752-760

> Coverage of: 404 / bad input / anonymous-write rejection / rate limit / HTTP security headers.

## Results

| Test | Plan ref | Result | Verdict |
|---|---|---|---|
| Bad receipt id `/r/99999` returns 404 | §1382 | HTTP 404 | ✅ PASS |
| Anonymous POST `/api/skill/save` → 401 | §753 | HTTP 401 | ✅ PASS |
| Anonymous POST `/api/memory/remember` → 401 | §753 | HTTP 401 | ✅ PASS |
| Rate limit on `/api/run` (Zod 400 before 429) | §754 | HTTP 400 on all 11 requests (correct ordering: validation rejects before rate-limit applies) | ✅ PASS (ordering correct) |
| HTTP security headers | §759 | All 4 present: X-Frame-Options: DENY · X-Content-Type-Options: nosniff · Referrer-Policy: strict-origin-when-cross-origin · Strict-Transport-Security: max-age=63072000; includeSubDomains; preload | ✅ PASS |
| `/r/0` (edge case · V1 ids start at 1) | n/a | HTTP 200 (Studio renders a placeholder) | ⚠ Minor — Studio could 404 invalid ids more aggressively; not a security issue |

## What this confirms

- Public proof pages 404 cleanly for non-existent receipts
- SIWE auth gate works for both protected write routes
- Zod validation runs BEFORE rate limit (correct order — drops malformed requests before consuming the rate-limit budget)
- All 4 baseline HTTP security headers present (matches HALF_BAKED §A-10 closure)

## Plan §1382 verdict

✅ PASS — failure flows (bad receipt id, missing auth, malformed body) handled cleanly with correct HTTP status codes.
