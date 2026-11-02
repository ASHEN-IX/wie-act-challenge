# EdNova Batch 2: CodeFormulaV2 evaluation

## Ground-truth review status

The source is the 20-page reference PDF, SHA-256 `ff83040269166027d02937563af93b6686ba9a02a0fd449c93a74747003faa02`. The sample consists of the same 16 purposively selected, ID-addressed crops as the earlier pix2tex evaluation; it is not representative of all disciplines or the 85 detected math regions. The [visual review package](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/review/index.html) links each original crop, its PDF page, geometry output, pix2tex output, provisional transcription and notes. Eleven source page images and nine alternative crop bounds were prepared. The original crops were preserved. All 16 proposed annotations and all nine alternative boundaries require independent review; `eq-079` and `eq-083` have explicitly partial transcriptions. **There are zero independently approved transcriptions, so verified accuracy is unavailable.**

A qualified independent reviewer can copy and fill [the decision template](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/review/decisions.template.json), recording their identity, review date, accepted or corrected expression, bbox corrections and notes case by case against the source page. No identities or approvals have been invented. The JSON package stores original page/bbox, source hash and candidate hashes; model outputs are proposals and cannot establish the reference answer.

## Model feasibility, licensing and safety

[CodeFormulaV2's official model card](https://huggingface.co/docling-project/CodeFormulaV2) identifies the model weights as CDLA-Permissive-2.0 and describes formula-to-LaTeX generation. We pinned revision `ecedbe111d15c2dc60bfd4a823cbe80127b58af4` and authenticated the HTTPS metadata response for its LFS SHA-256, then compared the downloaded safetensors bytes to `4b04e77af34c4e682a7ab1617628340d658f3c3dcd12456dd2a7fff805cf79d2`. This provides content integrity against the publisher metadata, not a separate signature or a security audit. The checkpoint is 630,993,616 bytes (about 602 MiB); accompanying tokenizer/config files require additional disk, as do dependencies and caches.

The config identifies `Idefics3ForConditionalGeneration`, bfloat16 weights and a Transformers 4.51.3 config version; that field is not proof of a strict minimum. The test used the existing AI image's Python 3.12, PyTorch 2.10.0+cpu and Transformers 4.57.6, plus isolated torchvision 0.25.0+cpu and accelerate 1.10.1, absent from the base image. Thus the exact combination works for model initialization and the bounded attempts reported below, but the production environment is not directly ready for this model. Official [Docling enrichment documentation](https://github.com/docling-project/docling/blob/main/docs/usage/enrichments.md) and its [pipeline options](https://docling-project.github.io/docling/reference/pipeline_options/) describe optional formula enrichment; this experiment invokes the pinned model locally on the existing crops, not Docling's full pipeline.

PyTorch and torchvision identify BSD-3-Clause licenses, Transformers and accelerate Apache-2.0, and safetensors Apache-2.0; Pillow and NumPy have their own and bundled-component terms. This is a targeted inventory, not a complete transitive dependency or legal audit. License of model weights, code, data and application dependencies must be reviewed separately. For comparison, the previous pix2tex checkpoint is described by its upstream release as CC BY-NC-SA, a material commercial-use constraint.

The checkpoint is loaded using `use_safetensors=True`, `trust_remote_code=False`, and `local_files_only=True`; no pickle loading or disabled weight-loading safeguards are used. Safetensors avoids pickle deserialization but does not make image decoders or framework code risk-free. Model files were obtained over authenticated HTTPS; inference ran without networking and without any production volume or external AI service, so course content was not transmitted. No published course, source artifact or reader was modified for this evaluation.

## Isolated benchmark configuration

The script [run_codeformula.py](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/run_codeformula.py) is an offline research harness. It joins original and candidate crops by case ID, verifies the weight hash, and saves results after each attempt. The local Docker image `ednova-api-ai-service:latest` was run with no network, two CPU cores, 3 GiB memory, 128 PIDs, read-only model/dependency/dataset mounts and a separate writable results directory. Generation used the model's chat template and `<formula>` prompt, CPU bfloat16, greedy decoding, max 128 new tokens, one crop at a time and a 40-second signal alarm per crop. Native calls can delay delivery of the alarm, so the wall-clock bound is approximate. Initialization timing starts after importing PyTorch and checkpoint hash verification; complete cold startup is longer. No GPU was exposed to the CPU-only container; GPU memory and latency are unmeasured. Host: about 15 GiB physical RAM, NVIDIA RTX 4050 Laptop GPU with 6,141 MiB reported VRAM, shared with running services. Available GPU capacity is not evidence of model compatibility or peak requirement.

To reproduce, retrieve the pinned revision from the official model repository over authenticated HTTPS, independently validate the SHA-256 above, place it and its tokenizer/config files in `var/codeformula-eval/model`, and install the two pinned additions in `var/codeformula-eval/deps` in a disposable environment matching the base image. The stored checkpoint and disposable dependencies are not production artifacts and can be removed after testing. Example setup and invocation from the repository root (the model download requires network access; only inference is offline):

```sh
mkdir -p var/codeformula-eval/{model,deps,output}
docker run --rm -v "$PWD/var/codeformula-eval:/eval" --entrypoint /opt/venv/bin/python ednova-api-ai-service:latest -m pip install --target /eval/deps --no-deps accelerate==1.10.1
docker run --rm -v "$PWD/var/codeformula-eval:/eval" --entrypoint /opt/venv/bin/python ednova-api-ai-service:latest -m pip install --target /eval/deps --no-deps torchvision==0.25.0+cpu --index-url https://download.pytorch.org/whl/cpu
# Download the files at the exact revision above from the official model repository
# into var/codeformula-eval/model and verify the checkpoint SHA-256 above.
docker run --rm --network none --cpus=2 --memory=3g --pids-limit=128 \
  -e PYTHONPATH=/deps -e HF_HUB_OFFLINE=1 -e TRANSFORMERS_OFFLINE=1 \
  -e OMP_NUM_THREADS=2 -e OPENBLAS_NUM_THREADS=2 \
  -v "$PWD/var/codeformula-eval/deps:/deps:ro" \
  -v "$PWD/var/codeformula-eval/model:/model:ro" \
  -v "$PWD/var/codeformula-eval/output:/output" \
  -v "$PWD/apps/ai/agents/course_ingestion/extraction/benchmarks/formula:/dataset:ro" \
  -w /output --entrypoint /opt/venv/bin/python ednova-api-ai-service:latest /dataset/run_codeformula.py
```

The local image is mutable, not a locked or audited production environment. Model and dependency versions, device, input preprocessing, time limits and CPU contention can change results. The earlier pix2tex run also used a two-core/3-GiB container, but model settings, time limits, workloads and initialization differ; comparisons are descriptive, not controlled speed or accuracy rankings.

## Results and comparison

| Path | Cases and output | Measured time and resources | Interpretation |
| --- | --- | --- | --- |
| Geometry baseline | Full 20-page PDF, 85 math regions detected; plain text, no verified equation accuracy | 1.2124 s document extraction; child max RSS 152,068 KiB | Entire-document extraction, not comparable to crop-only inference. |
| pix2tex | 16 original crops, 16 non-empty outputs; visual failures and hallucinations documented in the earlier report | 6.522 s initialization; 31.719 s for 16 inferences; process peak RSS 787,356 KiB | Output availability is not mathematical correctness; weight license constrains use. |
| CodeFormulaV2, originals | 16/16 timeouts; 0 non-empty outputs | 670.764 s cumulative attempted inference; 40.063–43.762 s per case | No expression or warm successful-inference latency to score. |
| CodeFormulaV2, candidate crops | 9/9 timeouts; 0 non-empty outputs | 377.101 s cumulative attempted inference; 40.251–43.823 s per case | No output to compare with the original crops or establish cropping effects on recognition. |

The combined 25 saved attempts consumed **1,047.865 s** inference wall time and 1,477.526 s process CPU time. These are sums of individual attempts, not a complete end-to-end elapsed measurement: the initial container was externally terminated with exit 143 during an unsaved fourth attempt and was resumed by case ID, so its interrupted work and two initialization/import phases are excluded. The cause of that termination was not determined. The resumed container ran 941.288 s wall time from start to exit, exited successfully (0), and was not OOM-killed. Initialization was 16.609 s for the first process and 14.763 s for the resumed process after PyTorch import and hash verification. Peak observed process RSS across saved attempts was **2,560,564 KiB**; it is a high-water mark for a process, not GPU memory or a minimum deployment requirement. The 3 GiB container limit was not exceeded. No GPU inference or VRAM measurement was made. Median elapsed time among timed-out original attempts was 42.0075 s, and among timed-out candidate attempts 41.607 s; these are timeout durations, not warm inference latency. Due to native operation boundaries, the 40-second alarm was not an exact hard wall-clock deadline.

The [raw CodeFormula results](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/codeformula.cpu.json) preserve every ID, crop variant, timeout, duration, CPU time and peak RSS; all generated outputs are `null`, with no generated token count. The visual review package includes the corresponding baseline, pix2tex and provisional source-based reading per ID. Thus there are no CodeFormula output strings or representative semantic failures to quote, and no supported model-versus-model mathematical accuracy claim. The attempted timeout rate is 100% (25/25) in this configuration; 0/25 returned output is an availability result, not zero correctness. There is no approved reference for any of the 16 cases.

## Automated and live evidence

The targeted review-package, formula benchmark, multimodal extraction, canonical document and semantic-structure suites passed **27 tests** in 3.47 s with the isolated Python environment. `git diff --check` passed. The offline Docker execution above is a live local inference attempt, not an application browser/API or end-to-end course import test. No live GPU, production integration, or newly published course was tested. Logs are retained under `reports/evidence/ednova-codeformula-evaluation/` where the workspace permits ignored evidence files.

## Cropping-quality analysis

`eq-001` demonstrates a detector problem independently of model quality: its original crop cuts the final summand. The earlier pix2tex output ends with an unsupported `v`, while the proposed expanded crop contains the missing visible source. Cases `eq-005`, `eq-006`, `eq-008`, `eq-010`, `eq-017`, `eq-045` and `eq-063` have candidate boundaries intended to reduce neighboring text or retain a complete formula; `eq-084` isolates the first formula of a larger region. They are candidates rather than approved correct boxes. Improved crop evidence can address missing or contaminated input, but does not establish whether any recognizer correctly reconstructs the mathematics. `eq-079` and `eq-083` remain ambiguous or partially transcribed and must not enter a fully scored denominator until reviewed.

The earlier pix2tex run returned non-empty output on all 16 original crops, but returned fabricated or missing material on mixed and clipped examples. Geometry's `eq-000` text `∑ up. Sn =\np=0` loses natural ordering and upper-bound placement; the pix2tex candidate `S_{n}=\\sum_{p=0}^{n}u_{p}.` appears visually consistent with the provisional reading, without proving accuracy. `eq-005` included invented preceding material, `eq-045` spurious neighboring content, and the long derivation `eq-083` had altered or missing content. The detailed earlier outputs are in `pix2tex.cpu.json` and the prior report. The crop/page imagery is the evidence for independent checking of symbols, fraction hierarchy, limits, scripts, ordering, multiline work and mixed prose; none can be scored as verified until approval.

## Architecture recommendation and unresolved issues

**Recommend option 3: improve mathematical region detection and source crops before introducing recognition**, while retaining deterministic extraction, source-backed crops and mandatory human review. A future evaluation may place recognition in a bounded asynchronous optional worker, keyed by immutable source hash, exact page/bbox, preprocessing version and pinned model, with explicit resource/time/output limits. Preserve the unchanged source and keep recognition results separate as proposed expressions; record per-region reviewer dispositions before presenting a verified equation. Existing canonical documents and published revisions must remain backward compatible. Expected whole-course cost includes 85 detected regions on this reference PDF, plus queueing and human review; this selected sample is not a throughput forecast.

Independent mathematical labels, multi-document subject coverage, region recall, full 85-region inference, GPU runtime and VRAM, sustained throughput, concurrency, production dependency/security review and exact correctness remain unmeasured. Semantically correct formulas cannot be inferred from well-formed LaTeX, token counts, successful return status, or the aggregate review acknowledgement. Candidate crops may still omit or include material and must be checked against the full page. The current extraction therefore remains source-backed and unverified.

## Integration decision

**NO-GO for production CodeFormulaV2 or pix2tex integration.** Batch 2 remains incomplete; no Batch 3 or AI Experience Planner work is included. A future decision requires independently adjudicated ground truth, comparison on varied documents and devices, reviewable source crops, a complete license/security audit, and workload-specific performance and quality gates.
