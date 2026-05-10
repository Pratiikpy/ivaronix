# Ivaronix — UI/UX Guide & Design System

> **ARCHIVAL · 2026-05-10.** Sprint-internal design-system reference frozen
> at v1. Visual contract has since moved per planning-003 §A.5.19:
> CLAUDE.md §10 owns the COLOR / FONT / RADIUS contract, `brand/tokens.css`
> + `brand/tokens.json` hold the canonical palette + type ramp + radii +
> motion. `brand/Ivaronix.html` remains the visual reference for layout
> composition. This doc retains LAYOUT-level guidance (page composition,
> component placement, copy patterns) but should NOT be cited as the
> visual contract — that drift was the WT 6 + 24 disagreement that
> planning-003 §A.3.3 closed.
>
> **Status:** v1, locked 2026-05-08 (archived 2026-05-10).
> **Visual source of truth:** `brand/Ivaronix.html` — the bundled mockup. Open in browser to see the rendered reference.
> **Companion docs:** `COMPONENTS.md` (per-component decisions), `HLD.md §4` (Studio architecture), `docs/build/BUILD.md §1` (Day 13-18 Studio build).
>
> **The most important rule, in capital letters:**
>
> # USE THE HTML AS VISUAL REFERENCE, NOT DATA SOURCE.
>
> Do NOT copy fake metrics, fake receipts, fake agents, fake counts, fake API responses, or mock business logic from the HTML. Every visible mock value maps to either real backend data or a clean loading/empty/error state in the design language.

---

## 1. Brand Tokens

> **Canonical color + font + radius tokens live in `brand/tokens.css` (CSS) and `brand/tokens.json` (non-CSS consumers). UI_UX_GUIDE.md owns the LAYOUT contract; brand/tokens.* owns the COLOR / FONT / RADIUS contract. Closes WT 6 + 24 (planning-003 §A.3.3) by ending the historical CLAUDE.md vs UI_UX_GUIDE hex disagreement.**

The canonical palette is cream-on-black editorial. Pulled from CLAUDE.md §10:
- `--color-paper: #FAFAF7` (background)
- `--color-ink: #0A0A0A` (body text)
- `--color-ink-soft: #111111` (display headings)
- `--color-muted: #6B6B66` (secondary text)
- `--color-accent: #16A34A` (CTA only, used sparingly)
- `--color-hairline: rgba(10, 10, 10, 0.08)` (card borders)

Typography: **Outfit** (sans, body + headings, weights 500/600/700) + **Instrument Serif italic** (display accents) + **JetBrains Mono** (hashes/code). Load via `next/font/google` per CLAUDE.md §10.

Radii: `10px` / `14px` / `16px` / `20px`. Sharper radii (`4-8px`) read as draft-quality.

For the full token set + spacing scale + motion easings, see [`brand/tokens.css`](./brand/tokens.css).

> The earlier inline `@theme` block in this file used historical values (cream `#faf9f6`, ink `#1a1a1a`, Times New Roman) that no longer match Studio's render. Those values are deprecated — Studio + the brand HTML follow `brand/tokens.css`. `pnpm brand:check` (queued · USER_TODO §B-V2-9) will lint for hex drift across docs.

```css
/* Legacy reference · the old @theme block. Kept temporarily so existing
 * Studio components that import these specific names still resolve. New
 * components MUST import from brand/tokens.css. Removal happens after
 * the Studio migration to the canonical tokens lands. */
@theme inline {
  /* Surface colors (legacy aliases pointing at canonical tokens) */
  --color-bg: var(--color-paper);
  --color-fg: var(--color-ink);

  /* Status (used sparingly, only in receipt verify states) */
  --color-pending: #d97706;       /* amber-600 — Pending state chips */
  --color-verified: #16a34a;      /* same green as accent — Verified state */
  --color-mismatch: #dc2626;      /* red-600 — Mismatch state */
  --color-mismatch-bg: #2a1215;   /* dark red — error banner background */

  /* Radii (legacy · canonical scale lives in brand/tokens.css) */
  --radius-sm: 4px;
  --radius-md: 6px;               /* default for chips, small buttons */
  --radius-lg: 8px;               /* default for cards, surfaces */
  --radius-xl: 12px;

  /* Shadows (subtle — editorial, not flashy) */
  --shadow-soft: 0 1px 4px rgba(0, 0, 0, 0.08);
  --shadow-card: 0 1px 4px rgba(0, 0, 0, 0.12);
}
```

**Critical:** the foreground is `#1a1a1a`, NOT `#000`. Pure black is too aggressive against `#faf9f6` — the warmer near-black is part of the editorial feel. Don't substitute.

---

## 2. Typography Scale

The design uses **two font families** — that's it. Resist adding a third.

| Use | Font | Weight | Style |
|---|---|---|---|
| Body, UI labels, buttons | `--font-sans` (system stack) | 400, 500, 600 | regular |
| **Display, emphasis, taglines** | `--font-display` (Times New Roman) | 400 | **italic** |
| Code, hashes, addresses | `--font-mono` | 400 | regular |

### Type scale (Tailwind-equivalent)
| Token | Size | Line height | Use |
|---|---|---|---|
| `text-xs` | 12px | 1.4 | metadata, timestamps, captions |
| `text-sm` | 13–14px | 1.5 | secondary body |
| `text-base` | 16px | 1.6 | body |
| `text-lg` | 18–20px | 1.4 | section subheads |
| `text-xl` | 24px | 1.3 | small display |
| `text-2xl` | 32px | 1.2 | section titles |
| `text-3xl` | 48px | 1.1 | hero subline |
| `text-4xl` | 64–80px | 1.0 | hero headline (serif italic) |

### Letter-spacing
- **Wordmarks ("IVARONIX"):** `letter-spacing: 4px` (very wide). Always uppercase.
- **Section labels ("§ 01 · …"):** `letter-spacing: 1.5–2px`, often `text-xs` or `text-sm`, uppercase.
- **Body:** default (`letter-spacing: normal`).

### Italic emphasis pattern
Serif italic is RESERVED for:
- Hero headlines (e.g., the i in the logo, hero taglines like "*Catch the risks. Keep the receipts.*")
- Pull-quote-style emphasis inside cards
- Single-word emphasis inside body copy
**Never use italic for an entire paragraph.** It's a strong, sparing accent.

---

## 3. Logo

The Ivaronix mark is **distinctive and must not be substituted with a generic logotype**.

### Anatomy
```
  ┌─                            ─┐
  │                              │
  │                              │
  │             ●  ← green dot   │
  │           i   ← serif italic │
  │                              │
  │                              │
  └─                            ─┘
       I V A R O N I X
```

- **Two thick square brackets** `[ ]` framing the wordmark
  - Stroke: `#1a1a1a`, weight 40px (at 1200×800 SVG canvas), `stroke-linecap: square`
  - Approximate aspect: brackets are ~12% of total width each, total height ~45% of icon height
- **Center:** lowercase serif italic `i` (Times New Roman, italic, 280px)
- **Dot of the `i`:** replaced with a **green circle** (`#16a34a`, radius 32px at SVG canvas) — slightly offset to the right (cx=20, cy=-130) to match the italic angle
- **Below brackets:** wordmark "IVARONIX" — sans, 22px, letter-spacing 4px, color `#6b6b66`

### When to use the full mark vs. just the brackets
- Full mark (with wordmark below): hero, splash screen, OG-images, Twitter card, README hero
- Brackets-with-i only: nav logo, favicon, small contexts
- Tiny contexts: just the green dot on cream — works as favicon-only

### File should live at
- `apps/studio/public/brand/ivaronix-mark.svg` (full)
- `apps/studio/public/brand/ivaronix-icon.svg` (brackets-with-i)
- `apps/studio/public/brand/ivaronix-dot.svg` (green dot only)
- `apps/studio/public/brand/ivaronix-wordmark.svg` (text only)

---

## 4. Layout & Spacing

### Page rhythm
- **Generous whitespace.** This is editorial design, not dense SaaS. Sections are separated by `padding: 96px 0` (desktop), `64px 0` (tablet), `48px 0` (mobile).
- **Max content width:** 1200px centered. Hero may go full-bleed; sections respect the max-width.
- **Side gutters:** 24px (mobile), 48px (tablet), 64px (desktop).

### Spacing scale (Tailwind-equivalent, multiples of 4)
`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128`

Use `--space-*` tokens or `gap-*` / `p-*` / `m-*` Tailwind classes.

### Card / surface styling
- **Border:** `1px solid rgba(26, 26, 26, 0.08)` — barely-there hairline on cream
- **Background:** white `#ffffff` for cards on `#faf9f6` page, OR slightly darker cream `#f4f3ef` for tonal surfaces
- **Radius:** `--radius-lg` (8px)
- **Shadow:** `--shadow-soft` on hover only; static cards rely on the hairline border
- **Padding:** `24px` (small) / `32px` (medium) / `48px` (feature card)

### Buttons
| Variant | Style |
|---|---|
| **Primary** | `bg: #1a1a1a; color: #faf9f6; padding: 12px 24px; border-radius: 6px; font-weight: 500;` — dark on cream. Hover: `bg: #333` |
| **Secondary** | `bg: transparent; color: #1a1a1a; border: 1px solid #1a1a1a; padding: 12px 24px; border-radius: 6px;` — outline. Hover: `bg: #1a1a1a; color: #faf9f6` (invert) |
| **Accent** | `bg: #16a34a; color: #faf9f6; …` — used SPARINGLY (CTAs only, max one per screen) |
| **Ghost** | `bg: transparent; color: #1a1a1a;` — no border, just hover underline |

**Button text:** sans, 14–16px, weight 500. Never uppercase except in section labels.

### Section labels (§ 01 · …)
The mockup uses numbered section labels in editorial style:
```
§ 01 · QUICKSTART        (→ small caps, letter-spaced 1.5px, #6b6b66)
```
Implement as small uppercase labels above section titles. Lifts editorial feel.

---

## 5. Status Visual Language (the Four-Light Row)

Per `COMPONENTS.md §2` and `HLD §4.2`, the cross-cutting visual primitive:

```
[●─Storage─][●─Compute─][●─TEE─][●─Chain─]
```

### Implementation
Each "light" is a chip with:
- Round 8px dot (left)
- Label text (sans, 12px, letter-spacing 1px, uppercase)
- Pill-shape container, padding `4px 10px`, gap `8px`

### States
| State | Dot color | Label color | Border | Animation |
|---|---|---|---|---|
| **Pending** | `#d97706` (amber) | `#1a1a1a` | dashed `1px #d97706` | none |
| **Active** | per-layer color (see below) | `#1a1a1a` | solid `1px transparent` | dot pulses (1s ease-in-out) |
| **Verified** | `#16a34a` (green) | `#1a1a1a` | solid `1px #16a34a` | none |
| **Mismatch** | `#dc2626` (red) | `#dc2626` | solid `1px #dc2626` | dot blinks (0.5s) |

### Per-layer Active colors (used during inference)
- Storage: `#0d9488` (teal)
- Compute: `#7c3aed` (violet)
- TEE: `#9333ea` (purple)
- Chain: `#2563eb` (blue)

When **Burn Mode** is active: storage's Active color flips to `#9333ea` (purple, signaling sealed); TEE's pulse rate doubles. Per `COMPONENTS.md §14`.

### File
- `apps/studio/src/components/FourLightRow.tsx` (Studio's React render)
- `apps/cli/src/ui/` (CLI ANSI rendering ports the same chip set in-place; the earlier `packages/ui` shared dir was a planning placeholder, never wired)

---

## 6. Receipt State Chips (3 states, locked)

Per `COMPONENTS.md §12`:

| State | Bg | Fg | Border | Use |
|---|---|---|---|---|
| **Pending** | `#fef3c7` (amber-50) | `#92400e` (amber-700) | dashed `1px #d97706` | root computed, not anchored |
| **Verified** | `#dcfce7` (green-50) | `#166534` (green-800) | solid `1px #16a34a` | storage + chain + TEE all pass |
| **Mismatch** | `#fee2e2` (red-50) | `#991b1b` (red-800) | solid `1px #dc2626` | one of three checks failed |

Same labels and colors in CLI ANSI escapes.

---

## 7. Permission Pills (skill cards)

Three slots per skill card (Network / Files / Compute), each:
- Tiny pill, padding `2px 8px`, radius 4px
- Border `1px solid` in the appropriate color
- Tone: **green** if no permission ("safe"), **amber** if scoped permission, **red** if dangerous (wallet write, shell exec)

Examples:
- `Network: github.com only` → amber pill
- `Files: read-only` → green pill
- `Compute: TEE-required` → green pill (sealed = good)

---

## 8. Responsive Breakpoints

| Width | Name | Source files |
|---|---|---|
| `≥1280px` | Desktop | `lg:` Tailwind prefix |
| `≥768px and <1280px` | Tablet | `md:` |
| `<768px` | Mobile | default (no prefix) |

**Test at exactly:** 1440×900, 1280×800, 390×844 (per the user's prompt and Playwright screenshot rules).

### Mobile rules
- Stack everything vertically; no two-column layouts
- Reduce hero font size: 64px → 40px
- Section padding: 96px → 48px vertical
- Side gutters: 24px
- Buttons full-width within card padding
- Four-Light Row stacks 2×2 on mobile (or scrolls horizontally if room is tight)

---

## 9. Accessibility (non-negotiable)

- **Semantic HTML.** Use `<main>`, `<header>`, `<nav>`, `<article>`, `<section>` — no `<div>` soup.
- **Keyboard navigation.** Every interactive element reachable via Tab; visible focus ring (`outline: 2px solid #16a34a; outline-offset: 2px`).
- **Contrast.** All text ≥4.5:1 vs background. `#1a1a1a` on `#faf9f6` = 14.6:1 ✓. `#6b6b66` on `#faf9f6` = 4.7:1 ✓ (passes for non-large text by 0.2).
- **Alt labels.** Every icon/SVG has `aria-label` or `<title>`. Decorative SVGs use `aria-hidden="true"`.
- **Reduced motion.** Wrap pulses/blinks in `@media (prefers-reduced-motion: no-preference)`.
- **Color is never the only signal.** Receipt state chips show both label AND color.
- **Form labels.** Every input has a real `<label>` (visually shown OR `sr-only`).

---

## 10. Loading / Empty / Error States (must match design language)

When backend data is unavailable, **never show fake placeholder data.** Use these patterns:

### Loading
- Skeleton shimmer in `#f4f3ef` → `#faf9f6` linear-gradient sweep
- 1.5s ease-in-out infinite
- Match the shape of the eventual content (card, line, chip)
- Never spin or use a generic spinner — too SaaS

### Empty
- Section heading + 1-line plain explanation in `--color-muted`
- A single inline action (e.g., "Run your first audit →") that does the obvious next step
- No illustrations needed; whitespace + 1 sentence does the work
- Example: `/dashboard` empty state = "No receipts yet. *Drop a file to begin.*" with the italic emphasis on the action

### Error
- Compact inline panel, NOT a full-page red banner
- Bg `#fee2e2`, border `1px solid #dc2626`, fg `#991b1b`, padding `12px 16px`, radius 6px
- Plain-English message ("Storage indexer unreachable. Retrying in 5s...")
- Action button if user can fix (`Retry`, `Configure`)
- Never silently swallow errors

---

## 11. Animation & Motion

Restraint. Editorial design uses motion sparingly.

| Element | Motion |
|---|---|
| Card hover | shadow appears, 200ms ease-out |
| Button hover | bg color shift, 150ms ease |
| Drop-zone active | border thickens + accent color, 200ms |
| Four-Light Row Active state | dot pulse 1s ease-in-out infinite |
| Receipt verify chip → Verified | 400ms ease-out flip + green glow once |
| Page transitions | NONE — instant. No slide-ins. |

**Disable all motion when `prefers-reduced-motion: reduce`.**

---

## 12. Hero Layout (Studio `/`)

Per `COMPONENTS.md §2`:

```
┌─────────────────────────────────────────────────────────────────┐
│  [logo brackets-with-i]               nav · skills · about      │  ← header (sticky, height 64px)
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│         Catch the risks.                                        │  ← hero h1 (serif italic, 80px)
│         *Keep the receipts.*                                    │     (italic emphasis on second line)
│                                                                 │
│         AI agents that double-check themselves on 0G.           │  ← subline (sans, 20px, muted)
│                                                                 │
│         ┌─────────────────────────────────────────────┐         │
│         │   Ask a question or drop a file…           │         │  ← input + drop-zone
│         │                                             │         │     (single field, full-bleed in container)
│         │   [drop file here]                          │         │
│         └─────────────────────────────────────────────┘         │
│                                                                 │
│         tier:  ○ Quick   ● Standard   ○ High-Stakes             │  ← consensus tier picker
│         skill:  [private-doc-review ▾]                          │  ← skill picker
│         [▶ Run]                                                 │  ← primary button (cream-on-black)
│                                                                 │
│         [●─Storage─][●─Compute─][●─TEE─][●─Chain─]              │  ← Four-Light Row
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**On submit:** the drop-zone collapses to a left-rail status pane; the right side renders the Audit Report (per COMPONENTS §3).

---

## 13. Section Pattern (used everywhere)

Every page below the hero follows this rhythm:

```
§ 01 · SECTION LABEL                         ← small caps, muted, letter-spaced

Section Title                                ← h2, sans, 32px, fg
Optional one-line description.                 ← muted, 16px

[Content: cards / lists / form / etc.]

[Optional CTA link →]                         ← ghost button or text link
```

96px vertical padding between sections.

---

## 14. Iconography

Lucide icons (`lucide-react`) at default 20px stroke-width 1.5. Color: `currentColor` so they inherit text color. NO Material Icons, NO Heroicons, NO custom emoji-style icons. Lucide matches the editorial sans aesthetic.

**Exception:** the green dot is its own brand element (not an icon). Don't use Lucide for it.

---

## 15. What NOT to do (anti-patterns)

Per the user's prompt rules and the editorial-design instinct:

- ❌ Generic SaaS purple/blue/teal gradient hero
- ❌ Neon/glow effects on everything
- ❌ Default shadcn primary blue (must override to `#1a1a1a`)
- ❌ Default Tailwind `gray-500` text (use `#6b6b66`)
- ❌ Round-corner-everywhere; we use 6–8px radii, NOT 16+px
- ❌ Drop shadows on every element; we use hairline borders + shadow on hover only
- ❌ Multiple accent colors; ONE green, that's it
- ❌ Italic for full paragraphs
- ❌ Pure black `#000` (use `#1a1a1a`)
- ❌ Loading spinners (use skeleton shimmer)
- ❌ Toast notifications for errors (use inline panels)
- ❌ Fake metrics, fake counts, fake users, fake receipts ANYWHERE in production UI
- ❌ Stock photography / illustrations of "diverse people on laptops"
- ❌ Background gradients (cream is uniform)
- ❌ Multi-column dense data tables; we prefer card grids

---

## 16. Implementation Workflow

Per the user's prompt:

### Step 1 — Open and inspect
```bash
# Open the bundled HTML in a browser to see the rendered reference
open C:\Users\prate\Downloads\oglabs\brand\Ivaronix.html
# OR
start C:\Users\prate\Downloads\oglabs\brand\Ivaronix.html  # Windows
```

The HTML is a self-extracting bundle (base64+gzip) — JS unpacks the rendered SPA at load. Static read won't reveal the content; **must render to see**.

### Step 2 — Capture screenshots (Playwright)
```typescript
import { chromium } from 'playwright'

const sizes = [
  { name: '1440x900',  w: 1440, h: 900  },
  { name: '1280x800',  w: 1280, h: 800  },
  { name: '390x844',   w: 390,  h: 844  },
]

for (const s of sizes) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } })
  await page.goto(`file:///C:/Users/prate/Downloads/oglabs/brand/Ivaronix.html`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `screenshots/reference-${s.name}.png`, fullPage: true })
  await browser.close()
}
```

Save screenshots to `apps/studio/screenshots/reference-*.png`. Compare against real Studio renders at the same sizes.

### Step 3 — Implement
Build Studio components per `COMPONENTS.md` using the design tokens above. Real backend data only. Loading/empty/error states match the design language.

### Step 4 — Verify
Run Playwright again on the real Studio at `localhost:3300`:
```bash
playwright test apps/studio/tests/visual.spec.ts
```
Compare screenshot pairs:
- `reference-1440x900.png` vs `studio-1440x900.png`
- `reference-1280x800.png` vs `studio-1280x800.png`
- `reference-390x844.png`  vs `studio-390x844.png`

Fix every visual mismatch NOT caused by real data being different. Don't redesign.

---

## 17. Where this guide is referenced

| Doc | What it links here for |
|---|---|
| `PRD.md §3.1` | Studio surface description |
| `HLD.md §4` | Studio architecture spec links here for visual decisions |
| `COMPONENTS.md` | Per-component UX decisions (drop-zone, audit report, skill browser, etc.) — UI tokens come from this guide |
| `BUILD.md §1` Day 13-18 | Studio build days reference this for design tokens + Playwright workflow |
| `README.md` | Doc map — this is the visual source of truth |

**Single source of truth ordering (when docs disagree on visual decisions):**
```
UI_UX_GUIDE > COMPONENTS > HLD > PRD
```

When in doubt about a color, font, spacing, or component shape: **this doc wins**. If the HTML mockup contradicts this doc, update this doc to match the HTML and re-propagate.

---

## 18. The user's prompt rules (locked, do not violate)

1. Treat `brand/Ivaronix.html` as visual reference, NOT data source.
2. No fake metrics / receipts / counts / agents / wallet data anywhere in production UI.
3. Inspect real backend before implementing UI; map every mock value to real source or empty/loading/error state.
4. Preserve: cream bg, black editorial type, green accent, serif italic display, compact nav, card surfaces, section spacing, button styles, hero layout, receipt visual patterns, responsive behavior, hover/motion polish.
5. Do NOT redesign. Do NOT use generic SaaS dashboard look. Do NOT use default shadcn/Tailwind unless customized to match.
6. Reusable components, design tokens, clean Tailwind classes, proper data adapters.
7. Real APIs, real types, real backend contracts. Typed placeholders + safe empty states only when backend incomplete.
8. Accessibility: semantic HTML, keyboard nav, focus states, contrast, alt labels.
9. Responsive: 1440×900, 1280×800, 390×844 — verify all three.
10. Playwright for visual verification. Compare screenshots. Fix mismatches.

---

**End of UI_UX_GUIDE. Open brand/Ivaronix.html in a browser before starting Studio code.**
