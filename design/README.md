# Noveris design system

The source of truth for everything Noveris puts in front of people outside the app:
marketing posts, stage badges, link cards, stories, slides and print.

Open **[`design.figcraft`](design.figcraft)** in FigCraft. Everything else in this
folder regenerates it.

## Why it is generated

The tokens are transcribed from the shipped product, not invented:

| Board | Reads from |
| --- | --- |
| Colour | `apps/web/src/app/globals.css` — semantic layer and brand ramp |
| Typography | `globals.css` (`--font-heading`, `--font-sans`) and the shipped scale |
| Logo | `apps/web/public/brand/noveris-symbol.svg` path data |
| Components | `apps/web/src/components/ui/*` and the marketing stylesheet |
| Nardouch | `apps/web/src/lib/brand.ts` stage names and copy |

So a change in the product can be pulled into the design file by editing
[`tokens.mjs`](tokens.mjs) and rebuilding — the file cannot quietly drift from
what the app renders.

## Build

```bash
node design/build.mjs     # regenerate design.figcraft
node design/export.mjs    # render every board to design/exports/
```

`build.mjs` writes `build.script.json` (the FigCraft op log) and runs it
headlessly. `--trace` records the id every layer is expected to take, which is
how the script catches a misplaced reference before it fails mid-run.

## The boards

| Board | What it settles |
| --- | --- |
| 01 Colour | Primitive ramp, the three gradients, and both semantic layers |
| 02 Typography | Sora + Inter, the nine-step scale, tracking per step |
| 03 Space & surface | 8-pt spacing, four radii, three violet-tinted elevations |
| 04 Layout | The 12-column grid, five sanctioned splits, six export formats |
| 05 Logo | Lockups, clear space, one-colour use, misuse |
| 06 Components | Buttons, chips, fields, cards, stage badges, mascot scale |
| 07–13 Templates | Square post, badge post, story, link card, wide post, slide, badge set |

## Using it for a new post

1. Open `design.figcraft` and pick the closest template board (07–13).
2. Duplicate its root frame — that frame is the export at its true pixel size.
3. Swap copy and mascot stage. Do not restyle: use the text styles
   (`Display`, `Heading/H1–H4`, `Body/Lead–Small`, `Label/Eyebrow`) and the
   colour swatches on board 01.
4. Export the frame at 1x. `07–12` are already at the size the platform wants.

The logo symbol is a main component on the 05 board; drag an instance rather
than redrawing it, so the mark stays identical everywhere.

## Rules worth keeping

- **One primary action per surface.** The violet-to-burgundy gradient button is
  the only thing that glows.
- **Gradients are two-brand: Orbit (violet → cyan) for the mark and headline
  emphasis, Action (violet 500 → 700) for buttons only.**
- **Never tint or restroke the symbol.** One-colour use is the mono component.
- **The mascot keeps its transparent background** and its stage tint.
- **Graduction is earned.** The badge is never used as decoration on a course
  whose reviewed checks have not passed.
- Body copy sits on `muted #B9BEDB` at 150% leading; eyebrow labels are
  uppercase at +1.6 tracking.

## Format sizes

| Use | Size |
| --- | --- |
| Square post | 1080 × 1080 |
| Story / Reel | 1080 × 1920 |
| Link card (OG) | 1200 × 630 |
| Wide post | 1080 × 1350 |
| Slide | 1920 × 1080 |
| Nardouch badge set | 1440 × 720 |
