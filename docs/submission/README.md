# EdNova Challenge — Phase 1 submission

| Deliverable | Status | Location |
| --- | --- | --- |
| Technical report (≤ 6 pages, includes business-model note) | Ready | [NOVERIS-TECHNICAL-REPORT.pdf](NOVERIS-TECHNICAL-REPORT.pdf) (source: [HTML](NOVERIS-TECHNICAL-REPORT.html)) |
| GitHub repository | Ready after the final push | https://github.com/ASHEN-IX/wie-act-challenge |
| Demonstration / simulation | Recorded: 84 s competition cut and 4 min walkthrough (captions, no audio; voice-over script provided) | [noveris-demo-90s.mp4](../../demo/output/noveris-demo-90s.mp4), [noveris-demo-master.mp4](../../demo/output/noveris-demo-master.mp4), script in [demo/SCRIPT.md](../../demo/SCRIPT.md) |
| Configuration template without credentials | Ready | `.env.example`, `apps/*/.env.example` |
| Screenshots | Ready | [screenshots/](screenshots/) (synthetic data) |

Evidence: [live inference probe](evidence/LIVE-INFERENCE-EVALUATION.json) and its [reproducer](evidence/run_live_inference_evaluation.py) (makes a few real provider calls; needs a key and approval). The architecture figure is generated from [NOVERIS-ARCHITECTURE.dot](evidence/NOVERIS-ARCHITECTURE.dot).

## Rebuild the report PDF

```bash
google-chrome-stable --headless=new --no-sandbox --no-pdf-header-footer \
  --print-to-pdf=docs/submission/NOVERIS-TECHNICAL-REPORT.pdf \
  file://$PWD/docs/submission/NOVERIS-TECHNICAL-REPORT.html
pdfinfo docs/submission/NOVERIS-TECHNICAL-REPORT.pdf | grep Pages   # must be 6 or fewer
```

## Before the final submission

- Record the demo (final phase limit: 1 min 30 s; show the waiting/fallback behaviour).
- Never show or commit API keys, `.env` files or personal data in the video or screenshots.
- Confirm with the organisers how the provided inference credentials map to the compact and capable categories, and set them in `apps/ai/.env`.
