# Formula evaluation fixture

This is an offline, purposively selected sample, not an independently reviewed golden benchmark. `dataset.json` records the source SHA-256, 85-region census, region and crop geometry, crop paths and existing text. Sixteen 2× PNG crops are supplied; padding is four PDF points and can include nearby text. `annotations.pending.json` contains ten assistant transcriptions awaiting independent review. `pix2tex.cpu.json` and `pix2tex.stress.json` are research-only model outputs; join by case ID, not array position. `metrics.provisional.json` describes the deliberately narrow literal comparison. No source or model output is trusted ground truth.

Rebuild the crops with the AI dependencies and PyMuPDF 1.26.7:

```sh
python apps/ai/agents/course_ingestion/extraction/benchmarks/formula/build_dataset.py
```

The prior run used the existing local `ednova-api-ai-service:latest` image, a separate writable `var/formula-eval` volume, 2 CPU cores, 3 GiB memory and no network during inference. The image contains CPU PyTorch 2.10.0 and Transformers 4.57.6. Install **for research only** into that disposable volume (the official weights are CC BY-NC-SA; verify rights for the intended use):

```sh
mkdir -p var/formula-eval
# Run inside a disposable container with /eval bound to var/formula-eval:
/opt/venv/bin/python -m pip install --target /eval/deps --no-deps pix2tex==0.1.4 albumentations==1.3.1 qudida x-transformers==0.15.0 timm==0.5.4 munch opencv-python-headless==4.10.0.84 scikit-image==0.24.0 lazy-loader imageio tifffile networkx pandas==2.2.3 pytz tzdata einops entmax
/opt/venv/bin/python -m pip install --target /eval/deps --no-deps torchvision==0.25.0+cpu --index-url https://download.pytorch.org/whl/cpu
```

Download the upstream `v0.0.1/weights.pth` into `/eval/deps/pix2tex/model/checkpoints/weights.pth`. Its measured SHA-256 was `a63d9141c53d266cb682fb5a8bd83bd5cbe283145e0e78ebdc0f895195a1dfaa`; independently authenticate any checkpoint before loading it. The optional resize weights were absent. Model code uses `torch.load` on a pickle checkpoint; only evaluate trusted weights inside an isolated container. This run set `TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1` in an offline container, which is a security concern, not a production recommendation.

From the repository root:

```sh
docker run --rm --network none --cpus=2 --memory=3g \
  -e PYTHONPATH=/eval/deps -e TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1 \
  -e OMP_NUM_THREADS=2 -e OPENBLAS_NUM_THREADS=2 \
  -v "$PWD/var/formula-eval:/eval" \
  -v "$PWD/apps/ai/agents/course_ingestion/extraction/benchmarks/formula:/dataset:ro" \
  -w /eval --entrypoint /opt/venv/bin/python ednova-api-ai-service:latest /dataset/run_pix2tex.py
```

Use `/dataset/run_stress.py` for the stress variants. The recorded environment also used torchvision 0.25.0+cpu, NumPy 2.4.1, albumentations 1.3.1, timm 0.5.4 and x-transformers 0.15.0. Timings and outputs vary; the seed was 42, generation temperature 0.2, single-image sequential inference. The measured initialization time starts after importing PyTorch. Batch inference, GPU execution, verified accuracy and commercial deployment were not measured.

## Independent review and CodeFormulaV2

Open `review/index.html` to compare all 16 original crops, source pages, provisional transcriptions and proposed alternative bounds. `review/decisions.template.json` is a blank per-case review record; proposed transcription and crop bounds remain unverified until a qualified independent reviewer records a decision. Rebuild with `build_review_package.py` and the PDF dependencies; it preserves an existing decisions template.

`run_codeformula.py` is an offline, bounded research harness. Its exact pinned revision, checksum, resource limits, isolation command, observed results and caveats are documented in `reports/EDNOVA-BATCH2-CODEFORMULA-EVALUATION.md`. It resumes matching checkpoint results by case ID and crop variant, so use an empty output directory for a fresh run. It does not integrate recognition into ingestion or establish correctness.
