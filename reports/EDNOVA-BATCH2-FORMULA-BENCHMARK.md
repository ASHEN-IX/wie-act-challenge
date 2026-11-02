# EdNova Batch 2 — Formula Recognition Benchmark

Date: 2026-11-02. Status: evaluation only; **NO-GO for production integration**. No model was integrated into the application, no published revision or source artifact was changed, and no paid inference was used.

## 1. Executive summary

The current PDF extractor locates 85 regions classified as math but stores their text in visual reading order, which is frequently not mathematical order. A CPU-only, isolated pix2tex experiment generated LaTeX for all 16 selected crops. Some outputs visibly recover summation limits and integral bounds; others invent symbols, omit terms, or fail on mixed prose and noisy boundaries. This shows a reason to investigate targeted recognition, not a verified improvement rate.

No equation in the sample has independent reviewer sign-off. Ten assistant transcriptions are provisional; therefore verified exact-match, symbol, structural and mathematical-equivalence accuracy are **not measurable**. The tested pix2tex code is MIT licensed, but its official v0.0.1 weights are CC BY-NC-SA, a noncommercial constraint incompatible with assuming commercial product rights. A permissively licensed alternative merits a separate benchmark before an integration decision.

## 2. Current extractor architecture

`pdf_loader.py` runs PyMuPDF in a fresh process with resource limits, creates page geometry, repaired glyph mappings and visual regions; `layout.py` normalizes bounded source regions, assigns IDs/types and flags math as review required. Current repeat extraction produced 20 pages, 510 regions, including **85 math**. Those are detector outputs, not validated equation counts.

`revision_artifacts.py` associates normalized region IDs with document identity and text passages; `semantic_structure.py` and `canonical_document.py` propagate source spans, page and geometry. Canonical math blocks contain `expression`, `notation: plain`, region metadata and `source_review_required`; the reader renders plain expressions as source text and provides source reference actions. `source_lesson` remains the whole extracted lesson. The current authorized image crop endpoint permits figure/figure-caption regions, not formula regions. Crop generation for this evaluation is offline and does not change that endpoint.

Relevant fixture, multimodal, canonical and semantic regression suites passed: 26 tests. `git diff --check` passed. The previous continuation's section change produces 16 lessons in local canonical construction. It is separate from this formula benchmark and has not been independently reviewed against every source heading.

## 3. Benchmark dataset and annotation status

Source: `apps/ai/agents/course_ingestion/extraction/benchmarks/reference-course.pdf`, SHA-256 `ff83040269166027d02937563af93b6686ba9a02a0fd449c93a74747003faa02`. The `formula/dataset.json` file contains 16 purposively chosen cases: original source page, exact detector bbox, padded crop bbox, region identity, baseline text, source hash and crop path. PNGs are rendered at 2 pixels per PDF point with four-point padding. They include summations, fractions, integrals, limits, scripts, inequalities, a small equation, multiline work and mixed French/mathematics. This is one document, not a representative population or a measure of region recall.

`annotations.pending.json` contains 10 assistant-created visual transcriptions, each `pending_review`, reviewer `null`. Six cases intentionally have no full expected transcription. The crop for `eq-001` visibly clips its right side; several other crops include text from adjacent lines. These are retained deliberately to expose the actual detector boundary rather than retrospectively improving it for the model. Reviewers should compare the PNG, PDF page and transcription, correct the annotation and record their identity/status independently. Do not treat provisional annotations as gold.

## 4. Candidate recognition engines and licenses

- **pix2tex / LaTeX-OCR 0.1.4**, tested with upstream v0.0.1 formula checkpoint. [Upstream repository](https://github.com/lukas-blecher/LaTeX-OCR) identifies the code as MIT. The [official weights release](https://github.com/lukas-blecher/LaTeX-OCR/releases) states CC BY-NC-SA. Research evaluation is distinct from a commercial deployment decision; verify applicability with the rights holder. Automatic checkpoint downloading and pickle loading also require care.
- **Docling CodeFormulaV2**, investigated but not run. Its [model card](https://huggingface.co/docling-project/CodeFormulaV2) identifies CDLA-Permissive-2.0 and formula-to-LaTeX operation; [Docling's model catalog](https://github.com/docling-project/docling/blob/main/docs/usage/model_catalog.md) describes formula enrichment. Its accuracy, footprint, actual local runtime and complete dependency/model licensing were not measured here. This is a promising permissive-license evaluation candidate, not a proven winner.
- **Marker**, investigated but not run. Its [upstream README](https://github.com/datalab-to/marker) says Apache-2.0 code and modified AI Pubs Open RAIL-M weights with commercial-use conditions. Confirm current terms and product eligibility independently. It is a document pipeline rather than the same narrowly scoped crop recognizer.

No other model, hosted service, GPU inference or paid API was used. GitHub repository metadata queried on 2026-11-02 reported all three repositories unarchived: pix2tex last pushed 2025-01-18, Docling 2026-11-01 and Marker 2026-10-29. Repository activity does not establish model maintenance, security, weight rights or suitability; verify the exact version adopted.

## 5. Reproducible environment setup

Scripts, 16 crops, source identifiers, pending annotations, baseline, candidate results, stress results and comparison metrics are under `apps/ai/agents/course_ingestion/extraction/benchmarks/formula/`; setup and commands are in its `README.md`. Logs and test output are under `reports/evidence/ednova-formula-benchmark/`.

The candidate ran in a disposable Docker container based on the locally available AI image, with a separate `/eval` volume, read-only dataset, `--network none`, 2 CPU cores and 3 GiB memory. Dependencies were installed only in that disposable volume. Runtime: Python 3.12, PyTorch 2.10.0+cpu, torchvision 0.25.0+cpu, NumPy 2.4.1, Transformers 4.57.6, pix2tex 0.1.4, timm 0.5.4, x-transformers 0.15.0, albumentations 1.3.1. Optional resize-network weights were absent. The upstream 102,113,875-byte checkpoint had observed SHA-256 `a63d9141c53d266cb682fb5a8bd83bd5cbe283145e0e78ebdc0f895195a1dfaa`; this is an observation, not independent authenticity verification.

Inference used seed 42, model temperature 0.2, one image at a time, and a 30-second alarm per image. The baseline ran in a separate 2-core/3-GiB container on all 20 pages. The image and dependencies are not a production deployment recommendation. The disposable dependency volume and downloaded checkpoint were removed after measurement; reruns require a fresh download and license review. The fixture, outputs and logs remain available.

## 6. Accuracy measurements: verified and provisional

**Verified accuracy:** unavailable: zero independently reviewed reference transcriptions and no independently annotated region-detection denominator. There is no verified exact match, symbol accuracy, structure, semantic equivalence or detection precision/recall.

**Provisional literal comparison:** 0 of 10 candidate outputs exactly matched the provisional LaTeX after removing whitespace and trailing punctuation. This normalization deliberately does not equate `S_n` with `S_{n}`, `\\to` with `\\rightarrow`, or different integral/fraction styles; for example `eq-000` is visually compatible with the intended summation yet has a literal mismatch. The 0/10 is a string-comparison result, not mathematical accuracy and not a defensible ranking against the plain-text baseline. Full outputs, annotations and normalization details are in the fixture JSON files.

No automatic symbol/structural/equivalence scores are supplied: the review set lacks approved ground truth, prose-bearing regions do not map cleanly to one expression, and a CAS cannot safely prove arbitrary visual transcription equivalent. Model confidence was not used as a correctness proxy.

Across the 16 selected cases the model returned a non-empty string 16 times and reported no runtime exceptions or 30-second timeouts. This **does not** mean 16 correct answers. The actual output includes invented terms and incomplete derivations. A, B and C comparison: A (existing geometry) is measured on the document and crops; B (pix2tex) is measured on the selected detected crops; C is the experimentally composed path A → B, with no standalone full-document hybrid deployment or end-to-end hybrid quality measurement. No full-page model inference was tested.

## 7. CPU/GPU and memory measurements

Single-run, CPU-only, shared workstation; not production capacity estimates:

- Existing geometry baseline: 20 pages, 85 detected math regions, **1.2124 s**, parent max RSS 22,624 KiB and child max RSS 152,068 KiB (separate maxima, not summed or synchronized).
- pix2tex initialization: **6.522 s**, measured after importing PyTorch. Sixteen sequential cropped inferences: **31.719 s** total; median **0.8645 s**, minimum **0.236 s**, maximum **11.749 s**. Aggregate CPU time **62.981 s**, approximately **198.6% of one CPU core** during inference. Process max RSS **787,356 KiB**. Checkpoint **102,113,875 bytes**, excluding dependencies. Sixteen cases imply roughly 0.50 crops/s for this selected sequence, not document throughput.
- The separate stress process reported 7.392 s initialization and 739,516 KiB peak RSS. GPU memory/latency were not measured; the container used CPU-only PyTorch. Native batch inference, parallel throughput and complete 85-region document processing were not measured.

The baseline covers an entire document while model times cover selected crops; their latency figures are not like-for-like recognition workloads. Hybrid cost would include both baseline and model execution, crop rendering, queue overhead, and review.

## 8. Representative provisional successes

- `eq-000`: source crop shows `S_n = Σ_{p=0}^n u_p`; baseline emitted `∑ up. Sn =\np=0`. The model emitted `S_{n}=\\sum_{p=0}^{n}u_{p}.` The visible ordering and bounds appear consistent with the provisional transcription; independent verification remains required.
- `eq-017`: model output includes a ratio of absolute values, two limits, and `(n+1)` in the denominator. Its visual structure appears closer to the crop than the baseline's reversed/fractured text. This is an illustrative visual observation, not an accuracy score.
- `eq-063`: model output `F(x)=\\int_{0}^{+\\infty}f(x,t)d t,` appears to retain the integral bounds and integrand. The original remains authoritative.

## 9. Representative failures and abstention

- `eq-005`: the crop includes an adjacent clipped line; model inserted an invented infinity/arrow row before the two-line system.
- `eq-045`: model retained the central integral but added a fabricated preceding expression and trailing noise caused by neighboring partial text.
- `eq-079`: mixed French and math produced a nonsensical fraction including `[[object Object]]`.
- `eq-083`: the long derivation had altered integral bounds, malformed grouping and omitted material; it took 11.749 s in the main sequence.
- `eq-001`: source crop cuts off the final summand, so no recognizer can establish the full formula from that crop alone; the returned final character is unsupported by the full source context.

Stress results on a known summation: quarter-size, blur and clipping all produced wrong-looking non-empty strings rather than abstentions. A blank image raised an OpenCV error; the malformed case was rejected by the evaluation harness before invoking the model, so it does not measure model behavior on malformed bytes. A repeated multiline case took 10.827 s and remained damaged. There is no reliable confidence or abstention mechanism in this experiment.

## 10. Integration architecture alternatives

Keep the existing native extraction as the source of text, geometry and immutable evidence. A future adapter could receive a content-hash, document ID, page, region ID/bbox, crop policy and pinned model identity; write a separate proposed expression, never overwrite canonical source text. A bounded asynchronous worker should enforce CPU/memory/time/output limits, permit optional GPU execution, and cache by immutable source hash, exact geometry, crop/render version, model/checkpoint hash and preprocessing version. Identical idempotency keys should reuse results; model failures fall back to the unchanged crop and source text.

Per-region instructor review should distinguish `source_backed`, `recognition_proposed`, `review_required`, `accepted`, `corrected`, and `rejected`; only a documented reviewer disposition against the actual source could promote a notation to verified. Record the reviewer, time, model/version and exact evidence. Acknowledging an entire revision cannot itself prove each formula correct. Original source region images must remain available under existing authorization and immutable-revision checks; formula crop support must be designed separately because the current crop endpoint allows figures only.

## 11. Security and deployment implications

The experiment did not contact a model service or transmit the PDF. Inference had no network and no production volumes. Production must guard against untrusted PDF/image parser inputs, decompression bombs, oversized regions, malicious LaTeX and excessive generation. Use safe rendering, file and memory limits, worker isolation and never execute generated code or trust generated URLs.

The tested upstream checkpoint uses `torch.load` and required `TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1` with this PyTorch environment. Pickle-based loading can execute code: a locally observed SHA alone does not authenticate the publisher. Treat this experiment as potentially unsafe and avoid this loading method in production; prefer authenticated safetensors/weights-only formats and pinned dependencies. Model artifacts and data/weight licenses need independent approval. Docker image dependencies are not an isolated lockfile and must not be mistaken for a reproducible audited production environment.

## 12. Recommended solution and evidence

Retain source-backed plain equations and mandatory review. Continue research with a **targeted, isolated hybrid prototype**, prioritizing an empirically evaluated permissive-license model such as Docling CodeFormulaV2. The pix2tex experiment demonstrates possible recovery of bounds on selected clean crops but also hallucinations on noisy regions, non-abstention, and restrictive official weights. It is not a suitable default for presumed commercial deployment and no candidate has demonstrated adequate independently verified quality.

## 13. Remaining uncertainties

Independent reviewer annotations, cross-document/discipline and multilingual samples, cleanly defined inline equation samples, formula region recall, clipping recovery, full-context mathematical correctness, full 85-region inference, GPU benchmarks, cold-start overhead including PyTorch import, native batching, concurrency, p95/p99 latency and production-scale resources remain unmeasured. One optional resize network was absent. A single purposive PDF and deterministic seed cannot establish generalization. The current 16-lesson correction is tested locally but not newly verified through a live worker in this evaluation.

## 14. Proposed acceptance criteria

Before rollout, establish an independently double-reviewed held-out corpus from multiple source types, languages and disciplines, with adjudicated page-region boxes and structured transcriptions. Pre-register thresholds by complexity bucket. Proposed starting release gates: at least 99% correct source document/page/bbox attribution; at least 98% independently adjudicated structural correctness on simple held-out expressions and 95% on complex expressions; zero unreviewed recognitions presented as verified; and zero missing source-crop fallbacks for detected regions. Measure exact-match, symbol error, operator/script/fraction/limit structure, semantic correctness, region recall/precision, abstention and human correction separately, with confidence intervals and subgroup failure counts. These numbers are proposed targets, not achieved results.

Set resource gates against deployment hardware and workload after measuring CPU/GPU cold start, warm p50/p95, memory, backlog and throughput; enforce per-crop time and memory limits and test failure recovery. Require security and license review and an audited reviewer workflow. At present only workload timing and output availability can be measured; all correctness gates need independently reviewed labels.

## 15. GO / CONDITIONAL GO / NO-GO

**NO-GO for integrating pix2tex weights or any formula recognizer into production.** A contained evaluation of CodeFormulaV2 and other compatible candidates is reasonable once an independent benchmark is established; it is not authorization to integrate them. Batch 2 remains incomplete, and no Batch 3 or AI Experience Planner work was performed.
