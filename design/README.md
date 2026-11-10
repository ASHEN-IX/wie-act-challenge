# Noveris — startup brand and communication system

Open **[design-noveris-live.figcraft](design-noveris-live.figcraft)** in Figcraft. All **22 pages** now
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

```powershell
node design/build.mjs             # same as campaign.mjs: build all 22 pages
node design/export.mjs            # same as campaign-export.mjs: export all artwork
python design/campaign-qa.py      # Pillow + pypdf: source, export and print checks
```

Figcraft 0.17.0 and its CLI/MCP are installed at
`C:/Program Files/ArtCraft/FigCraft/`. Override `FIGCRAFT_CLI` if needed.
Use the bundled Python runtime if Python is not on PATH.

The generator imports the preserved foundation snapshot
`design.pre-campaign.figcraft`, applies the startup revisions in `campaign.mjs`,
and builds the communication materials. The feed is authored in
`startup-posts.mjs`; visual tokens are in `tokens.mjs`. The snapshot is a backup
and build input, not the current deliverable.

## Current outputs

Use **[exports/noveris-startup](exports/noveris-startup/)** for current PNGs,
sticker SVGs and cut guides, contact sheets, draft print PDFs and the QA report.
The original 13 reference PNG filenames in `exports/` are refreshed to match
the updated foundations and templates.

Read [CAMPAIGN-HANDOFF.md](CAMPAIGN-HANDOFF.md) for dimensions, editable assets,
placeholder handling, print limits and release checks. Suggested feed captions
remain in [STARTUP-LAUNCH.md](STARTUP-LAUNCH.md).
