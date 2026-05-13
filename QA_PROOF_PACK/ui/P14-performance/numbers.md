# P14 · Performance baseline · 2026-05-13T22:04:43.620Z

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
| / | 223 ms | 1916 ms | — | 2193 ms | 534 KB | 710 KB | 200 | FCP ✓ · LCP — |
| /r/1004 | 157 ms | 1612 ms | — | 1899 ms | 535 KB | 703 KB | 200 | FCP ✓ · LCP — |
| /marketplace | 152 ms | 2128 ms | — | 2315 ms | 450 KB | 630 KB | 200 | FCP ✗ · LCP — |
| /thesis | 165 ms | 1224 ms | — | 1384 ms | 450 KB | 628 KB | 200 | FCP ✓ · LCP — |
| /0g | 167 ms | 956 ms | — | 1168 ms | 451 KB | 644 KB | 200 | FCP ✓ · LCP — |

## Mobile (1440×900 / 375×812)

| Page | TTFB | FCP | LCP | load | JS | total | status | FCP/LCP gate |
|---|---:|---:|---:|---:|---:|---:|---|---|
| / | 162 ms | 1368 ms | — | 1433 ms | 534 KB | 710 KB | 200 | FCP ✓ · LCP — |
| /r/1004 | 161 ms | 1064 ms | — | 1148 ms | 535 KB | 702 KB | 200 | FCP ✓ · LCP — |
| /marketplace | 146 ms | 1816 ms | — | 1874 ms | 450 KB | 628 KB | 200 | FCP ✓ · LCP — |
| /thesis | 160 ms | 1016 ms | — | 1091 ms | 450 KB | 628 KB | 200 | FCP ✓ · LCP — |
| /0g | 153 ms | 660 ms | — | 661 ms | 451 KB | 644 KB | 200 | FCP ✓ · LCP — |

## Notes

- TTFB = time to first byte (server response start).
- FCP / LCP per W3C Web Vitals spec.
- "JS" + "total" are uncompressed transfer bytes since Playwright's response.body() returns decompressed bytes. Gzip would be roughly 30-40% of these values; the < 300 KB gzip threshold maps to < 750 KB uncompressed.
- Numbers vary by network conditions; this snapshot was taken from the operator's local machine connecting to Vercel's edge.
