# Noveris — professional startup launch feed

The **entire 22-page file** now follows this startup direction. This document
provides the feed captions; the complete collection and production notes are
in `CAMPAIGN-HANDOFF.md`. Stories, team identity cards, stickers, posters,
flyers, brand templates and foundation pages have also been revised.

The feed introduces Noveris as a learning product and an emerging startup.
It focuses on learning needs, the product experience and the brand's purpose.
The original Noveris logo component, Sora/Inter typography and colour tokens
are reused. Light editorial layouts alternate with the existing navy ground;
mascot use is selective. No competitions, event names, deadlines, XP or prizes
appear in these 12 posts.

Open **NOVERIS / STARTUP LAUNCH / Feed Posts (12)** in `design-noveris-live.figcraft`.
Each frame is 1080 × 1350 px. Text, shapes, diagrams and the original logo
instances are editable. The two mascot images use the approved source assets.
The 12 PNGs and feed contact sheet are in `exports/noveris-startup/`.

| Post | Purpose | Suggested caption |
|---|---|---|
| 01 — Learn together. Grow further. | Introduce the product | Meet Noveris, an AI-powered peer learning companion. We’re building a clearer, more connected way to approach learning. Follow the journey. |
| 02 — More notes. Less clarity? | Identify the problem | Having the material is one thing. Making sense of it is another. What most often gets in the way when you study? |
| 03 — A companion for the moments you get stuck. | Introduce Nardouch | A simpler explanation. A different example. A question that helps you think. Meet Nardouch, the learning companion inside Noveris. |
| 04 — Your course. A clearer path. | Explain the workflow | Bring your course material, review the content and move into guided learning and practice. A connected workflow around what you’re studying. |
| 05 — Go beyond the answer. | Explain guided learning | Understanding grows through questions, examples and reasoning. That’s why guidance matters as much as the answer. |
| 06 — Study together. Think for yourself. | Explain peer learning | Discuss an idea with peers, then make space for your own understanding. Connection and independent thinking belong together. |
| 07 — See the idea. Explore the how. | Introduce Visual Lab | Some ideas become clearer when you can explore them. Visual Learning Lab creates space to change variables, observe and ask another question. |
| 08 — Small steps. Visible progress. | Show a learning rhythm | Read a concept. Put it into practice. Reflect on what needs another look. A thoughtful next step matters. |
| 09 — Learning speaks your language. | Introduce language support | English, French and Darija: different ways to approach an explanation, with shared curiosity at the centre. How do you like to learn? |
| 10 — For curious minds. For educators. | Introduce audiences | Personal learning and classroom teaching share a need for clear material, useful practice and thoughtful discussion. We’d like to hear about your context. |
| 11 — Technology should bring learning closer. | Explain brand values | Clarity, connection and curiosity guide what we’re building. These are the principles behind Noveris. |
| 12 — Let’s shape better learning. | Invite feedback | This is the beginning. Tell us what would make your next study session better, and follow what comes next. |

The posts use source-backed product descriptions from `README.md` and
`docs/product-specification.md`. They make no claim of a public release,
existing customers, partnerships, measured outcomes or confirmed pricing.
The conversation, concept graph and study rhythm are explicitly illustrative.

To edit and rebuild only this feed while preserving all other source layers:

```powershell
node design/startup-posts.mjs
node design/startup-export.mjs
python design/startup-qa.py
```

`campaign.mjs` also imports the current startup feed for full-project rebuilds.
