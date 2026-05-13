# Privacy Leak Audit · Plan §1381

> "Private input does not appear on public proof pages."
> Audit run iter-146 against receipts that processed a test-phrase fixture.

## Method

The test fixture `QA_PROOF_PACK/multi-wallet/fixtures/iter-134-room-doc.md` deliberately contains the canary string `PRIVATE_TEST_PHRASE_DO_NOT_LEAK`. Three receipts processed this fixture during iters 134-136:

- `rcpt_01KRFC89GHCCKSFTJN593JSJF8` (V2 id=10 · Wallet B · private-doc-review)
- `rcpt_01KRFCB8BBRY9RDCD23HGK0M4P` (V2 id=11 · Wallet B · content-pitch-review)
- `rcpt_01KRFBKZYN7SVFKW3SSYF2VF8F` (V3 id=6 · Wallet B · doc_room_read)

Audit:
1. grep the local receipt JSON for the canary phrase
2. curl the production `/r/<id>` HTML for the phrase
3. curl the production `/r/<id>/opengraph-image` (verify default headline used, not leaked content)
4. curl `/embed/r/<id>` for the phrase

## Results

| Surface | Receipt 10 | Receipt 11 | Receipt 6 |
|---|:---:|:---:|:---:|
| Local JSON `outputs.wording.headline` | ✅ no leak | ❌ **LEAK** (1 occurrence) | ✅ no leak |
| Production `/r/<id>` HTML | ✅ no leak | ✅ no leak | ✅ no leak |
| Production `/r/<id>/opengraph-image` | ✅ default headline | ✅ default headline | ✅ default headline |
| Production `/embed/r/<id>` | ✅ no leak | ✅ no leak | ✅ no leak |

## The leak

Receipt #11's `outputs.wording.headline` contains the canary string at position 24:

```
1. **Compliance Risk**: PRIVATE_TEST_PHRASE_DO_NOT_LEAK: this string must NOT
appear in any public surface (OG image, headline, public receipt). If it does,
the Burn-Mode privacy story is broken.
```

The LLM (content-pitch-review skill, qwen-2.5-7b-instruct) read the test instructions in the fixture and quoted them back into its analysis output. The `outputs.wording.headline` is `finalOutput.slice(0, 200).replace(/\n+/g, ' ')` per `apps/cli/src/commands/doc.ts:648` — so the phrase landed in the headline.

## Why the public threat model is intact

`apps/studio/src/app/r/[id]/opengraph-image.tsx:36`:

```ts
if (local?.body.outputs?.wording?.headline) headline = local.body.outputs.wording.headline;
```

The OG image renderer ONLY uses the receipt's headline if a LOCAL receipt JSON file exists on the server. On the production Vercel deployment:
- No `.ivaronix/receipts/anchored/` directory exists (operator-side only)
- The lookup returns null
- The default headline `"Verified action receipt on 0G testnet"` is used
- The OG image renders the safe default text, not the leaked headline

Same logic applies to the `/r/<id>` server-render: it reads chain state (receiptRoot hash only, no headline string on chain) + falls back to default if no local JSON.

## Threat model boundary (per `docs/CRYPTO_NOTES.md` + `docs/PRIVACY_NOTES.md`)

- **In scope:** operator-side disclosure via the receipt's PUBLIC surfaces (chain anchor, OG image, embed, /r/<id> HTML). All four PASS the audit.
- **Out of scope:** local-machine compromise. The operator's local receipt JSON is in their own filesystem; if attacker has filesystem access, they can read the LLM's output regardless of any privacy gate.
- **Burn Mode coverage:** Burn Mode encrypts the INPUT doc (so the ciphertext on 0G Storage doesn't leak plaintext). It does NOT scrub the LLM's analysis output. If the LLM quotes from the input, the output captures the quote.

## Plan §1381 verdict

✅ **PASS** — Private input does not appear on public proof pages. The local-machine leak in receipt JSON is operator-side custody, which falls outside the public threat model.

## Recommendations for follow-up

1. Add `PRIVATE_TEST_PHRASE_DO_NOT_LEAK` style canary strings to the `doNotSay` list in `apps/cli/src/commands/doc.ts:649` for test fixtures specifically. The list currently has `['truth score', 'verified by AI', 'guaranteed safe']` — would need an env-var or fixture-detection mechanism to extend it at runtime.

2. The local receipt JSON write should optionally redact the headline if a `--scrub-headlines` flag is passed. Operators who want even-stricter local-machine custody could enable it.

3. Add a regression: `verify-receipt-headline-no-leak.ts` that scans `.ivaronix/receipts/anchored/*.json` for known canary phrases and warns. Not a blocker (operator-side), but a useful test-hygiene tool.

iter-146 audit complete. Privacy story is intact at the public threat model layer per plan §1381.
