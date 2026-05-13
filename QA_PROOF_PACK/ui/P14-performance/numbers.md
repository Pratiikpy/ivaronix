# P14 · Performance baseline · 2026-05-13T22:10:33.820Z

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
| / | 231 ms | 1440 ms | — | 1471 ms | 534 KB | 710 KB | 200 | FCP ✓ · LCP — |
| /r/1004 | 162 ms | 1172 ms | — | 1249 ms | 535 KB | 703 KB | 200 | FCP ✓ · LCP — |
| /marketplace | 167 ms | 1880 ms | — | 2030 ms | 450 KB | 630 KB | 200 | FCP ✓ · LCP — |
| /thesis | 168 ms | 1016 ms | — | 957 ms | 450 KB | 628 KB | 200 | FCP ✓ · LCP — |
| /0g | 178 ms | 636 ms | — | 666 ms | 451 KB | 644 KB | 200 | FCP ✓ · LCP — |

## Mobile (1440×900 / 375×812)

| Page | TTFB | FCP | LCP | load | JS | total | status | FCP/LCP gate |
|---|---:|---:|---:|---:|---:|---:|---|---|
| / | 184 ms | 1488 ms | — | 1562 ms | 534 KB | 710 KB | 200 | FCP ✓ · LCP — |
| /r/1004 | 143 ms | 1004 ms | — | 1071 ms | 535 KB | 702 KB | 200 | FCP ✓ · LCP — |
| /marketplace | 150 ms | 1772 ms | — | 1842 ms | 450 KB | 628 KB | 200 | FCP ✓ · LCP — |
| /thesis | 173 ms | 1000 ms | — | 1084 ms | 450 KB | 628 KB | 200 | FCP ✓ · LCP — |
| /0g | 164 ms | 724 ms | — | 751 ms | 451 KB | 644 KB | 200 | FCP ✓ · LCP — |

## Notes

- TTFB = time to first byte (server response start).
- FCP / LCP per W3C Web Vitals spec.
- "JS" + "total" are uncompressed transfer bytes since Playwright's response.body() returns decompressed bytes. Gzip would be roughly 30-40% of these values; the < 300 KB gzip threshold maps to < 750 KB uncompressed.
- Numbers vary by network conditions; this snapshot was taken from the operator's local machine connecting to Vercel's edge.
