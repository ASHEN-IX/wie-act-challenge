# Noveris — startup brand and communication system

Open **[design-noveris.figcraft](design-noveris.figcraft)** in Figcraft. All **22 pages** now
support Noveris as a professional learning startup and product. This includes
the original brand foundations and templates, not just the social feed.

## File structure

The first 13 pages cover colour, typography, spacing, formats, the approved
identity, product components, square and Story templates, a companion
introduction, a product link card, workflow, a company slide and mascot assets.
Their original logo geometry, shared typography and core visual tokens remain.
Copy and template framing have been revised for the startup direction.

Nine **NOVERIS / STARTUP LAUNCH** pages contain:

1. Startup brand overview.
2. Twelve product and brand feed posts.
3. Twelve product Stories.
4. Three named team identity cards and a common back.
5. Seven brand stickers and a presentation sheet.
6. Two A3 product posters.
7. A double-sided A5 company flyer.
8. Reusable brand components.
9. Production and brand guidelines.

## Build, export and verify

Run from the repository root. `figcraft-cli` must be on your PATH (override with `FIGCRAFT_CLI`).

```bash
node design/startup-posts.mjs      # rebuild the 12 feed posts in place
node design/print-materials.mjs    # rebuild badges, stickers, A3 posters and the A5 flyer
node design/campaign-export.mjs    # 1x PNG/PDF/SVG exports to exports/noveris-startup
node design/export-3x.mjs          # 3x PNG exports to exports-3x (pass 02, 04... to export one folder)
node design/brandbook/build.mjs    # brand book PDF to output/pdf/Noveris-Brand-Book.pdf
```

Each rebuild script replaces only its own pages and fails if any other layer in the file changes.
Feed layouts are in `startup-posts.mjs`, print layouts in `print-materials.mjs`, tokens in `tokens.mjs`.

`campaign.mjs` is the original full generator. It needs the pre-campaign snapshot
`design.pre-campaign.figcraft`, which is now only in git history.

## Current outputs

Use **[exports-3x](exports-3x/)** for 3x PNGs grouped by type, and
**[exports/noveris-startup](exports/noveris-startup/)** for 1x PNGs, sticker SVGs,
cut guides and draft print PDFs. `upload-ready/` (git-ignored) holds renamed
copies ready for upload. The brand book is `output/pdf/Noveris-Brand-Book.pdf`.

Read [CAMPAIGN-HANDOFF.md](CAMPAIGN-HANDOFF.md) for dimensions, editable assets,
placeholder handling, print limits and release checks. Suggested feed captions
remain in [STARTUP-LAUNCH.md](STARTUP-LAUNCH.md).
