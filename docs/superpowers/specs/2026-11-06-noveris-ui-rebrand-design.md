# Noveris UI rebrand — design

**Date:** 2026-11-06
**Status:** approved for planning
**Source design:** `~/Desktop/noveris-nextjs` (Noveris "Nova Orbit" landing page, brand v1.0)

## Goal

Make the EdNova product *be* Noveris, visually and by name. Port the Noveris
landing page into `apps/web` as a real public route, then restyle the whole
signed-in application so it reads as one product with that landing page.

Success: a visitor lands on `/`, sees the cinematic Noveris page, signs up,
and arrives in a workspace that looks like the same company made it — without
the cinematic effects hurting readability in forms, tables, and the course studio.

## Decisions taken

| Decision | Choice | Consequence |
|---|---|---|
| Brand | Rebrand product to **Noveris** | Name, logo, slogan, mascot, page titles, e2e assertions all change |
| App intensity | **Restrained workspace** | Landing is cinematic; app shares palette/type/surfaces but no starfields or glow behind data |
| Default theme | **Dark** | `:root` holds dark values; light is an opt-in override |
| Animation | `motion` + `gsap` (installed) | Faithful port of entrances and scroll-scrub parallax |
| Typography | Self-hosted **Sora** + **Inter** woff2 | No network at build or runtime |

These follow Noveris's own brand guide, which states the mascot "should be much
subtler within the real academic workspace" and that study interactions should
use "actual diagrams, source materials, and structured data … avoid a childish UI".

## Design tokens

Two token families coexist.

**Product tokens (shadcn names, reused by all existing components).**
Keep the variable names — `--background`, `--foreground`, `--card`, `--primary`,
`--border`, `--ring`, `--muted`, `--accent`, `--destructive`, plus the sidebar and
chart families — and replace only their values. This is why ~114 existing files
restyle without being edited.

Dark is the base (`:root`); `.light` overrides. Values derive from the brand sheet:

| Role | Dark | Light |
|---|---|---|
| background | `#0B1026` (night) | `#F6F5FF` |
| card / surface | `#151C3A` (surface) | `#FFFFFF` |
| primary | `#7B3FF2` (violet) | `#6B32D9` |
| accent | `#06D6FF` (cyan) | `#087FA8` |
| foreground | `#F7F9FF` | `#10162D` (ink) |
| muted-foreground | `#A0A7B8` (slate) | `#616682` |
| border | `rgba(178,147,255,.26)` | `rgba(72,43,137,.17)` |

**Brand tokens (new, for marketing surfaces).** `--brand-night`, `--brand-navy`,
`--brand-violet-soft`, `--brand-amber`, `--brand-gradient`
(`linear-gradient(105deg,#BC96FF,#7B3FF2 52%,#06D6FF)`), `--brand-glow`. Exposed to
Tailwind via `@theme inline` as `brand-*` utilities so the landing page can use
`text-brand-cyan`, `bg-brand-night`, etc.

Typography: `--font-sans` → `Inter`, `--font-heading` → `Sora`. Both `@font-face`
declared in `globals.css` against `/fonts/files/*.woff2`, already downloaded with
their `unicode-range` intact so only the latin subset is fetched in practice.

Radius rises slightly (`--radius: 0.75rem`) to match the landing page's softer cards.

## Architecture

Four layers, each independently changeable, applied in this order.

### 1. Token layer — `src/app/globals.css`

Rewrite the `:root` / `.light` blocks, add brand tokens and `@font-face` rules.
No component knows about colours directly, so this layer alone changes the
appearance of every screen. Reverting it reverts the whole palette.

### 2. Primitive layer — `src/components/ui/*`

14 files. Targeted changes, not rewrites:

- `button.tsx` — `default` becomes the brand gradient with the landing page's
  inset highlight and coloured shadow; `outline` and `ghost` gain the violet
  hairline. Keep every existing size and variant name so callers are unaffected.
- `card.tsx` — violet hairline ring instead of the neutral one; slightly larger radius.
- `input.tsx`, `textarea.tsx`, `native-select.tsx` — surface fill and the
  violet focus ring.
- `badge.tsx`, `alert.tsx`, `avatar.tsx`, `skeleton.tsx`, `field.tsx`,
  `separator.tsx`, `empty.tsx`, `label.tsx` — colour-token alignment only; these
  mostly inherit from layer 1.

### 3. Brand layer — new `src/components/brand/`

Shared by marketing and app so identity cannot drift:

- `logo.tsx` — `<Logo>` lockup + symbol-only variant, links to `/` on marketing
  and `/dashboard` in the app.
- `gradient-text.tsx` — the brand gradient applied to text.
- `star-field.tsx` — decorative, `aria-hidden`, marketing only.
- `scroll-reveal.tsx` — thin wrapper over `motion`'s `whileInView` with
  `useReducedMotion` honoured, so every reveal behaves consistently.
- `scroll-experience.tsx` — the GSAP scrub controller, marketing only.
- `theme-toggle.tsx` — replaces `features/courses/theme-control.tsx`; dark default.
- `nardouch-avatar.tsx` — the small in-app mascot (see below).

### 4. Surface layer

**Marketing** — new `src/app/(marketing)/` route group with its own layout
(`site-nav` + `footer`), containing `page.tsx` (the landing page) and the seven
section components under `components/marketing/`. Sections ported 1:1 from the
source: hero, feature grid, how-it-works + laptop video, evolution timeline,
journey banner, footer, nav.

**Routing change** — `/` stops redirecting to `/dashboard`. `(marketing)/page.tsx`
takes it. Signed-in users reach the workspace from the nav's "Open workspace"
link; a `redirect("/dashboard")` is also added to the workspace's own entry only
for direct navigation (no change to auth behaviour).

**Workspace** — `workspace-shell.tsx` and `navigation.tsx` restyled to the dark
surface: deep-navy sidebar, violet active pill, hairline dividers, the Noveris
lockup at the top, `ThemeToggle` and the existing search/practice actions retained.

**Every other route** — no structural change. They inherit layers 1–2. Only
screens where a hardcoded non-token colour exists get touched (7 files contain
`emerald`/hardcoded accents; 16 hardcoded colour utilities total).

## In-app mascot

Per the brand guide, Nardouch appears small and contextual, never as a background:

- a 32 px avatar beside the assistant/tutor surfaces
  (`socratic-tutor.tsx`, `ai-status-view.tsx`), and
- the evolution stage on the progress screen, reflecting completed courses
  using the same five-stage vocabulary as the landing page.

New component `nardouch-avatar.tsx` takes a stage and renders the matching image
at avatar size.

**Stage source — constrained by what the API actually returns.** I checked the
existing endpoints rather than assuming: `/api/v1/competencies` returns per-topic
Bloom levels and `/api/v1/users/learning-rewards` returns `level`,
`levelProgress` and `achievements`. Neither exposes a per-subject *course-completion
count*, which is what the landing page narrates. Two honest options:

- **A (proposed):** map the five stages onto the reward `level` already fetched on
  `/progress` and `/dashboard` — real data, zero backend work, but it means
  "stage" tracks activity/XP rather than completed courses, which is slightly
  looser than the landing page's story.
- **B:** derive from competency coverage per subject (topics that have any Bloom
  level recorded). Closer to "learning happened in this subject", still no
  backend change, but it reads as mastery rather than course completion.

Either way no backend change is required. The avatar is decorative and labelled
`aria-label="Nardouch, stage N"`; if the mapping is wrong it is a cosmetic
correction, not a data bug. Recommendation: **A**, because it is one number the
client already has.

## Assets

Copy from the source project into `apps/web/public/`:

- `brand/` — symbol, dark/light/mono lockups, favicon, OG image
- `images/` — the six Nardouch stage images + hero
- `videos/` — `study-demo.mp4` and its poster
- `fonts/files/` — already downloaded (9 woff2, 264 KB)

All local; nothing is fetched from a third party at runtime.

## Rename plan

"EdNova" appears in 7 files. Change in the same commit:

- `app/layout.tsx` — title template and description
- `workspace-shell.tsx`, `auth-form.tsx` — lockup and copy
- `dashboard/page.tsx`, `courses/[courseId]/page.tsx`, `upload-form.tsx` — copy
- `e2e/smoke.spec.ts:11` — `toHaveTitle(/EdNova/)` → `/Noveris/`
- `public/ednova-mark.svg` → `public/brand/noveris-symbol.svg`

The `ednova` package name, `@ednova/shared`, npm scope, and `EDNOVA_NEXT_DIST_DIR`
env var are **not** renamed — they are internal build identifiers, and renaming
them buys nothing visually while risking the workspace build. Noted as an explicit
out-of-scope decision.

## Testing

- `pnpm typecheck` — must pass (Next typegen + tsc)
- `pnpm test` — 7 existing vitest files must stay green
- `e2e/smoke.spec.ts` updated for the title; `e2e/workspace.spec.ts` unchanged
  (its "EdNova Learner" string is form data, not branding)
- Manual: run dev server, load `/`, `/login`, `/dashboard`, `/courses`, `/progress`
  in a browser. Verify dark default, theme toggle persists, hero reveals on scroll,
  reduced-motion disables parallax, and no horizontal scroll at 375 px.

## Phasing

1. **Foundation** — tokens, fonts, brand layer, public assets
2. **Landing** — route group + seven sections; verify offline build
3. **Rename** — the 7 files + e2e assertion
4. **App shell** — sidebar, header, theme toggle
5. **Feature sweep** — limiter to hardcoded colours + mascot touchpoints
6. **Verification** — typecheck, tests, browser pass

Each phase must build before the next starts.

## Risks

- **Tailwind v4 `@theme` ordering.** Brand tokens must be declared inside
  `@theme inline` after the `:root` values or utilities resolve empty. Mitigated
  by verifying one utility in the browser during phase 1, not phase 2.
- **GSAP + React 19 StrictMode.** Double-mount can duplicate ScrollTriggers;
  `useGSAP` handles cleanup, but the scrub controller needs a scoped ref.
- **Mascot image weight.** Six webp portraits plus a 1 MB video on the landing
  page; `priority` only on the hero, `loading="lazy"` elsewhere.
- **e2e drift.** The title assertion is the one test pinned to the old brand;
  it must move in the same commit as the rename or CI goes red.

## Out of scope

- Backend, API, database, auth logic — untouched
- Package/scope renames (`ednova`, `@ednova/shared`)
- Copywriting beyond the brand strings listed above
- New product features; the landing page advertises only what exists
