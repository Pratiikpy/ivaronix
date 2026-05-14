# P14 · Performance baseline · 2026-05-14T00:12:40.525Z

Target: https://ivaronix.vercel.app
Method: Playwright + Web Performance API (FCP/LCP via performance.getEntriesByType). No Lighthouse dep.

## Thresholds (from test plan §P14)

| Metric | Desktop | Mobile |
|---|---|---|
| FCP | < 2,000 ms | < 3,000 ms |
| LCP | < 2,500 ms | < 4,000 ms |
| Receipt page | < 1,000 ms cached · < 3,000 ms cold | — |
| Bundle first-load JS | < 300,000 bytes gzip | — |

## Desktop (1440×900 / 375×812)

| Page | TTFB | FCP | LCP | load | JS | total | status | FCP/LCP gate |
|---|---:|---:|---:|---:|---:|---:|---|---|
| / | 172 ms | 1376 ms | — | 1408 ms | 534 KB | 710 KB | 200 | FCP ✓ · LCP — |
| /r/1004 | 524 ms | 1536 ms | — | 1611 ms | 535 KB | 703 KB | 200 | FCP ✓ · LCP — |
| /marketplace | 161 ms | 1808 ms | — | 1868 ms | 450 KB | 630 KB | 200 | FCP ✓ · LCP — |
| /thesis | 173 ms | 1084 ms | — | 1159 ms | 450 KB | 629 KB | 200 | FCP ✓ · LCP — |
| /0g | 170 ms | 720 ms | — | 767 ms | 451 KB | 645 KB | 200 | FCP ✓ · LCP — |

## Mobile (1440×900 / 375×812)

| Page | TTFB | FCP | LCP | load | JS | total | status | FCP/LCP gate |
|---|---:|---:|---:|---:|---:|---:|---|---|
| / | 176 ms | 1500 ms | — | 1532 ms | 534 KB | 710 KB | 200 | FCP ✓ · LCP — |
| /r/1004 | 203 ms | 1068 ms | — | 1290 ms | 535 KB | 703 KB | 200 | FCP ✓ · LCP — |
| /marketplace | 171 ms | 1572 ms | — | 1642 ms | 450 KB | 628 KB | 200 | FCP ✓ · LCP — |
| /thesis | 156 ms | 1040 ms | — | 1111 ms | 450 KB | 628 KB | 200 | FCP ✓ · LCP — |
| /0g | 178 ms | 628 ms | — | 666 ms | 451 KB | 644 KB | 200 | FCP ✓ · LCP — |

## Notes

- TTFB = time to first byte (server response start).
- FCP / LCP per W3C Web Vitals spec.
- "JS" + "total" are uncompressed transfer bytes since Playwright's response.body() returns decompressed bytes. Gzip would be roughly 30-40% of these values; the < 300 KB gzip threshold maps to < 750 KB uncompressed.
- Numbers vary by network conditions; this snapshot was taken from the operator's local machine connecting to Vercel's edge.
