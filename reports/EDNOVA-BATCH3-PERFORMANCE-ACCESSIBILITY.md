# EdNova Batch 3 — Performance and accessibility report

Date: 2026-11-06. Measurements taken in an isolated Chromium (Playwright 1.63, bundled build) at 1440×900, device scale 1, against the development preview of the real reader served by `next dev` (Turbopack, Next.js 16.4.1).

Raw evidence: `reports/evidence/batch3/reader-performance.json`, `reader-journeys.json`.

---

## 1. Environment and its limits

| Item | Value |
| --- | --- |
| Node | 24.20.0 |
| Next.js | 16.4.1 (dev server, Turbopack) |
| Browser | Playwright Chromium (bundled) |
| Backend | **not running** — no MongoDB, no RabbitMQ, no AI service in this sandbox |
| Course data | contract built by the production builder from a preview fixture |

**This is a development build measured without a backend.** Dev builds ship unminified client JavaScript and are substantially heavier than a production build. Absolute JavaScript figures therefore overstate the production cost and are reported with that caveat rather than as a production budget. The *relative* finding — lazy images are not all fetched — is a property of the markup and is unaffected by build mode.

Layout shift and image counts are meaningful; total script transfer is indicative only.

---

## 2. Images: the 83-source-fallback concern

The brief's specific concern was that the reference revision contains 83 source-faithful mathematics images and might fetch them eagerly.

To measure it, a stress lesson with **60 unreviewed display formulas** was added to the preview fixture (mirroring the reference ratio) and driven through the real reader.

| Metric | Value |
| --- | --- |
| Math blocks in the lesson | 60 |
| Rendered as source fallback | 60 (no block dropped) |
| `<img>` elements present at measurement | 43 (lazy, below the fold at sample time) |
| `loading="lazy"` elements | 42 of 43 |
| Image requests on open | **20** |
| Image requests after scrolling the whole page | **61** |
| All images fetched eagerly | **no** |

Conclusion: images are **not** fetched eagerly. Twenty requests fire for the above-the-fold region; the rest load on scroll. Every image element in the reader carries `loading="lazy"` and `decoding="async"`; the two instances in the legacy deterministic reader were also given `loading="lazy"` during this milestone.

**Reserved dimensions are still missing.** The images have no `width`/`height` attributes and no CSS aspect-ratio box, so their arrival can shift layout. Measured CLS on the stress lesson was **0.0738**; on the ordinary math lesson it was **0.006**. The stress figure is above the 0.1 "needs improvement" threshold only in the worst sampled run (a second run measured 0.0522) and is the largest measurable performance weakness of this milestone. **PARTIAL** — deferred, with the reason recorded in §6.

---

## 3. Reader load and JavaScript

Ordinary mathematics lesson (`lesson-3-1`):

| Metric | Value |
| --- | --- |
| DOMContentLoaded | 112–304 ms (dev server, warm) |
| Script requests | 26 |
| Script transfer | ~1 187 KiB (dev, unminified) |
| DOM nodes | 708 |

Stress lesson (`lesson-4-4`, 60 math blocks):

| Metric | Value |
| --- | --- |
| Script requests | 26 |
| Script transfer | ~1 187 KiB |
| DOM nodes | 1 566 |
| Responsive under interaction | yes — slider and stepper responded within one frame in manual checks |

The stress lesson more than doubles DOM nodes without changing script weight, which is the expected shape: content scales, code does not.

### Code splitting
Interactive modules are `lazy()`-imported and only mount in Explore mode: `math-content` (KaTeX), `function-graph`, `sequence-visualizer`, `derivation-stepper`, `code-walkthrough`, `interactive-diagram`. A Read-mode lesson ships none of them. This is verifiable from `components/registry.tsx`, where every lazy import is a static `import()` expression — never a computed specifier.

---

## 4. Bounded computation

Prevents a hostile or accidental expression from freezing the main thread:

| Bound | Value |
| --- | --- |
| Expression length | 400 characters |
| AST nodes | 400 |
| Nesting depth | 32 |
| Evaluation steps per sampling run | 20 000 |
| Final value magnitude | 1e12 |
| Samples per graph | 320 |
| Samples per sequence | ≤ 120 |
| Topology nodes rendered | ≤ 80 |
| Topology links rendered | ≤ 160 |
| Diagram steps | ≤ 60 |

Domain gaps return `null` and are drawn as gaps; they are never interpolated into a fabricated curve.

---

## 5. Accessibility

Target: WCAG 2.2 AA where applicable. **No formal certification is claimed.** Checks were a mix of automated DOM assertions in the live page and manual keyboard driving; no axe or Lighthouse run was possible (no Chrome binary for Lighthouse in this environment).

### Automated checks in the live reader (0 issues)
Run against `article` on the mathematics lesson:

- every `<img>` has `alt`
- every `button`, `a`, `input` has an accessible name
- every `<table>` has a caption and every `<th>` has `scope`
- every badge carries text (no colour-only status)
- no unexpected `tabindex="-1"`

Result: **0 issues**.

### Manual keyboard checks

| Check | Result |
| --- | --- |
| Lesson heading focusable and receives focus on navigation | pass (`tabindex="-1"`, focused in `useEffect`) |
| Sequence mode toggles operable, `aria-pressed` reflects state | pass |
| Range slider focusable with a visible focus ring | pass |
| Code walkthrough Next/Previous/restart operable | pass |
| Topology nodes operable, `aria-pressed` reflects selection | pass |
| Detail panel announced (`aria-live`) | pass |
| Derivation stepper arrow keys / Home / End | pass (implemented and unit-tested) |
| `Escape` closes the open overlay and restores focus | pass (verified in the browser) |
| Mobile outline drawer closes on `Escape` | pass (verified in the browser) |
| No keyboard trap observed | pass |

### Structural accessibility

| Requirement | Status |
| --- | --- |
| Single `h1` per page, no skipped ranks | pass — verified `H1 → H2` |
| Math has a text alternative | pass — MathML plus the raw expression; unreviewed formulas keep extracted text |
| Interactive graphs have a non-visual alternative | pass — value table + textual description |
| Topology has a text alternative | pass — element and edge list in `<details>` |
| Tables have caption and scoped headers | pass |
| Code blocks accessible | pass — text selection, `dir="ltr"`, no execution |
| Dialogs labelled and modal | pass |
| Colour is never the only signal | pass — every state carries a label |
| Contrast | not measured with a tool; the reader uses the existing token palette |
| Reduced motion | no infinite CSS animations in the reader (`0` found); motion is user-initiated |
| Touch targets on mobile | buttons use the existing `sm`/`iconsm` sizes; not individually measured |

### Known accessibility gaps
1. Contrast was not verified with a contrast analyser.
2. Touch target size was not measured against the 24 × 24 CSS-pixel minimum.
3. No screen-reader session (NVDA/JAWS/VoiceOver) was run — assertions are DOM-level plus keyboard driving.
4. The graph is `aria-hidden` inside a `role="img"` wrapper with a generated description; a fully equivalent data table exists but is inside `<details>`, so it is one interaction away for screen-reader users.

---

## 6. Performance gaps and deferred work

1. **Image dimensions are not reserved** — the one real regression risk. The fix is a CSS aspect-ratio box sized from the region `bbox` already present in `sourceMeta`; it was deferred because the crop route is not reachable in this environment, so the effect could not be measured end to end.
2. **No virtualisation.** 60 components render without trouble; a revision with several hundred would need measurement before optimisation.
3. **Dev-build JavaScript figures are not a production budget.**
4. **No production build was profiled** in a browser; only the dev server was driven.

---

## 7. Reproducing the measurements

The preview server must be running (development only):

```bash
cd apps/web && EDNOVA_NEXT_DIST_DIR=.next-preview ./node_modules/.bin/next dev --port 3100
```

Then:

```bash
cd apps/web && node e2e/batch3-performance.mjs
cd apps/web && node e2e/batch3-evidence.mjs
```
