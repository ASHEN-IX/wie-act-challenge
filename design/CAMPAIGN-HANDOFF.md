# Noveris — complete startup brand handoff

The current `design-noveris-live.figcraft` is a professional startup and product
communication file across all 22 pages. The foundations, templates, components,
Stories, identity cards, stickers and print materials follow the same direction
as the product launch feed.

## Deliverables

| Material | Count | Dimensions |
|---|---:|---|
| Updated foundation/template boards | 13 | Existing source formats |
| Feed posts | 12 | 1080 × 1350 px |
| Product Stories | 12 | 1080 × 1920 px |
| Team identity fronts + common back | 4 | 90 × 120 mm |
| Brand stickers | 7 | 600 × 600 source / 1200 × 1200 PNG |
| Sticker sheet | 1 | 1440 × 1640 px |
| A3 product posters | 2 | 297 × 420 mm |
| Company flyer front + back | 2 | 148 × 210 mm |
| Overview, component kit, production guide | 3 | Reference formats |

There are **56 export frames**: 13 foundation/template boards and 43 startup
marketing/reference frames. The nine startup pages are ordered for review.

The team identity cards show Mohamed Habib Allah Bibani (CEO), Mohamed Aziz Kammoun (CTO), and Tasnim Rebhi (Head of Product). These roles were selected as an initial practical startup structure at the user's request and can be revised.

## Brand and editability

The original Noveris logo components and text styles are preserved. Sora and
Inter, navy surfaces, violet identity, restrained cyan accents and the approved
Nardouch illustrations form the visual system. The five mascot states are an
asset library, not certifications or claims of learning outcomes.

Typography, layouts, diagrams, shapes, cutting guides are editable; the generated QR code is an embedded image. Original mascot PNGs remain embedded images. The company identity
cards include the supplied names and portraits; illustration use is selective in marketing.

## Messaging and placeholders

The content introduces the learning problem, the Noveris product, course-led
guidance, peer discussion, visual exploration and brand principles. Claims are
grounded in the repository's product documentation. There are no invented
customer numbers, measured learning outcomes, partnerships, prices or release
dates. Illustrative conversation and concept examples are marked as such.

The website and QR codes use https://noveris.live, supplied by the user; the domain is not yet active. The contact email is Contact@noveris.live. A social media handle has not been supplied.
Story sticker areas visibly reserve space for the native Instagram controls.

## Export and print

`exports/noveris-startup/` contains every current PNG, seven sticker SVGs,
seven separate magenta cutting-guide SVGs, page contact sheets and the QA report.
Hidden `CUT CONTOUR` source layers preserve the vendor-adaptable guides.
The vendor must set spot-colour naming, line weight, offset and tolerances.

`NOVERIS-Print-Proofs.pdf` combines eight pages: three identity fronts, their
common back, two posters, and both flyer sides. Separate category PDFs are
included. The QA script checks actual TrimBox sizes, 3 mm BleedBoxes and font
embedding. Print backgrounds extend into bleed.

These are **draft print proofs**. Figcraft's CMYK conversion does not include a
printer-specific ICC output intent. The printer must confirm colour proofing,
image resolution, bleed, lanyard/finishing and cutting requirements. The approved
mascots retain their original resolution.

## Review and reproduction

`node design/campaign.mjs` builds the complete current file from the preserved
snapshot. `node design/campaign-export.mjs` exports all 56 frames and category
PDFs. `python design/campaign-qa.py` verifies all 22 pages, checks for promotional
wording from the former direction, validates text bounds, verifies image sizes
and transparency, checks PDF fonts/boxes and assembles review sheets.

The original identity geometry and typography are checked against the snapshot.
Every final page must also be visually inspected after substantive edits.
