# Brand assets — separate license

> Closes planning-003 §A.5.8 (and the §1 "no public lies" rule). The repo's MIT grant covers code, not the brand. This doc names the rule so a hostile fork can't lean on the LICENSE-default-MIT defense.

## What's reserved

Everything under `brand/` is reserved:

- The bracketed-"i" mark (SVG, PNG, all sizes).
- `brand/Ivaronix.html` — the canonical visual reference.
- `brand/tokens.css` + `brand/tokens.json` — the design-token source of truth (planning-003 §A.3.3).
- The wordmark "IVARONIX" in all weights and tracking variants.
- The favicon set + apple-touch-icon set generated from the mark.
- The OG image templates at `apps/studio/src/app/opengraph-image.tsx` + `apps/studio/src/app/0g/opengraph-image.tsx` + `apps/studio/src/app/r/[id]/opengraph-image.tsx`.
- Any future logo variant, color palette extension, or typeface-pairing decision shipped under `brand/`.

## What you can do without asking

- **Cite or review** Ivaronix in blog posts, talks, papers, comparative benchmarks. Use the mark inline; attribute the project; do not imply endorsement.
- **Build on the open-source code.** Fork `ivaronix-x` for your own product, rename it, ship it under your own mark.
- **Embed the receipt-verifier widget** on your site or app via `@ivaronix/widget`. The widget chrome (logo + "View Ivaronix receipt →" link) is the intended brand surface for embedders; keep it intact.
- **Reproduce screenshots** of the Studio UI in your own writing, with attribution.

## What you can't do

- **Distribute a fork at a confusable domain** (`ivaronix-x.app`, `ivaronix.studio`, `myivaronix.app`, `ivaronix-fork.app`, `ivronix.com`, etc.) with any of the brand assets attached. Pick a different mark for your distribution.
- **Imply endorsement** by Ivaronix or its contributors, e.g. "powered by Ivaronix" on a derivative product without attribution that makes the fork relationship clear.
- **Ship the receipt-verifier widget without its chrome,** removing the "View Ivaronix receipt →" CTA or the embedded mark.
- **Sell merchandise** with the mark.

## What this is NOT

Not legal advice. Not a registered trademark filing. Not a substitute for an actual lawyer's review of your specific use case. If you're not sure, open an issue at <https://github.com/Pratiikpy/ivaronix/issues> and ask.

## Why this exists

The `LICENSE` file's MIT grant covers the code in this repo — generously, intentionally. But MIT doesn't carve out brand. By default that means a hostile fork could ship at a confusable domain with the same logo and the same wordmark, and the project would have no leverage. That outcome would erode trust in every receipt anchored under the Ivaronix mark — including receipts already on chain.

This doc puts the brand rule in writing so a fork's choice to use it anyway is an explicit step, not an oversight.

## See also

- `LICENSE` — the MIT grant for code, with the §A.5.8 "brand assets (separate license)" appendix.
- `brand/Ivaronix.html` — the canonical visual reference; treat as source of truth for color/typography/spacing per CLAUDE.md §10.
- `brand/tokens.css` + `brand/tokens.json` — the design-token contract.
