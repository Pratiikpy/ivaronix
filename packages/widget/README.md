# @ivaronix/widget

Embeddable Ivaronix receipt verifier. Drop a verifiable receipt summary on any React or HTML page.

## React

```tsx
import { ReceiptVerifier } from '@ivaronix/widget';

export function MyPage() {
  return <ReceiptVerifier id="1004" />;
}
```

Props:

- `id` — receipt id (numeric) or `receiptRoot` (`0x…64`-hex).
- `origin` — Studio origin. Default `https://ivaronix.studio`. Override for self-hosted deployments or local dev (`http://localhost:3300`).
- `width` / `height` — number → px, string passed through. Defaults to 100% × 420 with `maxWidth: 600`.
- `title` — accessibility label.
- `style` — inline style escape hatch.

## Vanilla HTML

```html
<script
  src="https://ivaronix.studio/embed.js"
  data-receipt-id="1004"
></script>
```

`data-width` and `data-height` override the iframe size.

## What it shows

Each embed renders only on-chain-verifiable facts:

- Status chip — `FULLY VERIFIED`, `ANCHORED`, or `CLAIMED` based on the receipt's TEE attestation state.
- Tier badge — `TIER 1 · TEE` (router/compute attested) or `TIER 2 · EXTERNAL` (external-signed). Honest marking per CLAUDE.md §6.
- Receipt id, skill name, headline.
- Network, anchor tx (clickable to chainscan).
- "View full receipt" CTA back to the canonical Studio page.

No client connection. No analytics. No cookies. The third-party visitor sees the receipt exactly as a Studio visitor would.
