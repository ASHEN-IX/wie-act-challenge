# EdNova Batch 2 — Final acceptance

Date: 2026-11-02. Decision: **NO-GO for full Batch 2 acceptance / production readiness.** No production deployment or Batch 3 work was performed.

## Executive summary

The application now completes a real, isolated upload → RabbitMQ ingestion → Python extraction and local embedding → MongoDB draft → Studio review → immutable publication → enrolled-student reader journey. The original mathematics PDF produces 20 pages, two chapters and 16 lessons. Three recognition jobs traverse the real authenticated Node/Python HTTP boundary and the separate RabbitMQ worker. Only the official Gemini SDK response is mocked, replaying the previously authorized research outputs; no new remote inference occurs.

Confirmed defects were fixed and regression-tested: unresolved formula presentation, crop-process resource isolation, misleading verification language, acknowledgement invalidating formula reviews, hidden required acknowledgement, dropped code indentation, separated table rows, missed captioned rectangle figures, top-level numbered headings, figure placement, and silent 600-character math truncation.

**These workflow successes do not establish mathematical fidelity.** The 16-crop set still has zero qualified independent approvals. The original exact source crop for `eq-001` clips its final summand; a later contextual reader view recovers it, while other crops still clip or include unrelated text. Some deterministic equations and prose retain broken reading order. Broad table/diagram coverage and live-provider operational certification remain incomplete. These are material acceptance gaps, rather than cosmetic residual risks.

## 1. Actual architecture and validation boundary

| Stage | Current implementation | Evidence and boundary |
| --- | --- | --- |
| Authenticated upload | Nest course route, tier/management policy, multipart validation, course-scoped staging | Real BetterAuth instructor session and `POST /api/v1/study/courses` in final browser test; disposable institutional course |
| Immutable source storage | `captureImmutableSources`, manifest hashes, `originals/<sha256>` | Downloaded published PDF bytes equal uploaded original; no user-course modifications |
| Async ingestion | Durable course-ingestion operation, `ai.jobs` / `study.ingest.course`, Python `IngestionWorker`, result consumer | Real RabbitMQ vhost, separate Python worker, real result ingestion and MongoDB draft |
| Deterministic extraction | Bounded PyMuPDF child; page OCR fallback; source regions and document-scoped IDs | Actual reference PDF and authored networking PDF; OCR regressions run separately |
| Structure / canonical | Source-aware section detector, section builder, normalizer and additive canonical schema 1.0 | Real worker builds canonical; source-preserving regions, semantic labels and original source lesson |
| Enrichment | Existing approval-controlled optional LLM enrichment and local fallback | No enrichment provider approved in QA; local fallbacks, not remote enrichment |
| Recognition | Existing Node jobs, Python source inspection/crops, official SDK structured response contract | Real HTTP auth, source inspection, budgets, worker, MongoDB proposals; SDK mocked offline |
| Instructor review | Versioned pending → accepted/corrected/rejected; audit append and status update atomically | Real sessions/browser; MongoDB integration tests cover conflicts and fresh reads |
| Publication | Exact draft/source/crop binding, source CAS freeze, separate immutable target, new revision index and course-pointer CAS | Real Python index service for final QA; separate fault-injected index-recovery regression |
| Retrieval | Existing all-MiniLM-L6-v2, native FAISS, canonical units and source metadata | Real cached embedding model and FAISS construction in final QA; not a semantic retrieval-accuracy benchmark |
| Reader | Existing V2 projection, safe KaTeX, protected crops/PDF, source audit | Enrolled student session; actual rendering and original-source actions; unauthorized source request denied |

No parallel extraction pipeline was introduced. The new Docker/browser harness is test infrastructure around the existing application. Source manifests, Node/Python validation and renderer contracts retain their existing responsibilities. Some policy checks exist in both Node and Python by design; their joint success path was tested, not inferred from isolated mocks.

The forensic report's historical summary-as-body defect is addressed by Batch 1 canonical source storage. Its mathematical glyph/order defects are not globally solved. Earlier reports describing no persistent jobs or no published formula projection are historical milestone states; the current implementation and tests supersede those statements. Earlier mock-transport browser passes are not presented as real Python-boundary evidence.

## 2. Reference document and structure

Original reference SHA-256:

`ff83040269166027d02937563af93b6686ba9a02a0fd449c93a74747003faa02`

The live upload retains that hash and exact original bytes. Two source chapters span PDF pages 1–10 and 11–20. Their 16 numbered section headings are:

| Source pages | Headings |
| --- | --- |
| 1 | 3.1 Quelques rappels sur les séries numériques; 3.2 Notion de série de fonction |
| 3, 4 | 3.3 Notions de convergence; 3.4 Convergence normale |
| 6, 7, 9 | 3.5 Propriétés de la somme; 3.6 A propos des séries entières; 3.7 Un exemple |
| 11 | 4.1 Intégrales simples; 4.1.1 Notion de continuité uniforme |
| 12, 13 | 4.1.2 Continuité; 4.1.3 Dérivation |
| 15 | 4.2 Intégrales généralisées; 4.2.1 Convergence uniforme |
| 16, 17, 18 | 4.2.2 Continuité, Dérivation; 4.2.3 Convergence normale; 4.3 Un exemple |

All 20 rendered source pages and all 16 source crops were visually inspected by this implementation agent, separately from reading the detector output. This is a provisional source-image cross-check, **not independent expert approval**. The original `f′ = f,` fragment remains mathematical content, rather than a lesson title. The live test asserts two chapters and 16 lessons. Numbered subsections remain identifiable by their source numbering; the canonical lesson list does not encode every subsection as a nested parent/child object.

Definitions, propositions, exercises and proof labels survive typed canonical projection. Complete proof-to-theorem semantic relationship verification, paragraph-by-paragraph visual equivalence and full source coverage scoring remain unproven. The reader explicitly reports incomplete source mapping rather than implying all passages are mapped exactly.

Evidence: [headings with geometry](evidence/batch2-final/source-headings.json), [actual application run](evidence/batch2-final/application-run.json), [all rendered source pages](evidence/batch2-final/pages/).

## 3. Mathematical benchmark and fallback

[Provisional formula audit](evidence/batch2-final/formula-audit.provisional.json) records each of the 16 cases, original crop, page, bounding box, deterministic extraction, provisional transcription, existing alternative crop and offline Gemini output where available. The existing review package retains its proposed expanded/tighter boundaries. [All 16 crops](evidence/batch2-final/all-16-formulas.png) are provided for independent review.

There are **zero independently approved equations**. Detection precision/recall, symbol correctness, fractions, scripts, integral/sum limits, reading order, missing/invented terms, multiline fidelity and human correction rate therefore remain **unavailable**, not zero and not inferred from a detector count. The 85 math regions are a detector census. Browser acceptance/correction actions are QA workflow actions, not expert mathematical labels.

| Example | Deterministic extraction | Existing offline proposal / provisional visual observation |
| --- | --- | --- |
| eq-000, p1 | `∑ up. Sn =` followed by `p=0` | `S_n = \sum_{p=0}^{n} u_p.` preserves the visible summation structure; current UI test records a correction without the final punctuation |
| eq-017, p4 | Fraction/limit terms reordered and interrupted | Offline Gemini proposal retains two limits with numerator/denominator hierarchy; original crop also includes unrelated lower-edge content |
| eq-063, p15 | `∫+∞ F(x) = f(x, t)dt,` followed by `0` | Offline proposal places 0 and +∞ on the integral; QA rejects it to verify original-source fallback, not because an expert established an error |
| eq-001, p1 | Missing/right-clipped summand | Original image crop itself clips the final summand. Existing expanded candidate requires approval. Showing a crop does not prove completeness |
| eq-079, p18 | French instruction mixed with derivatives | Mixed text is intentional source content; it must not be treated as a single verified standalone equation |
| eq-083, p19 | Multiline integration by parts | Signs, denominator powers and order need qualified review; no new recognition experiment performed |

Unreviewed plain math now shows an authorized original equation image, a transcription-unverified caption and expandable preserved extraction. The existing source inspector provides the original PDF link. Image failure exposes an explanatory fallback and extracted text. Accepted/corrected expressions remain distinct, instructor-approved representations and retain source/model review details. No guessed LaTeX replaces rejected content.

The image is still the detected source region: known boundary defects remain visible and require correction. This is a useful fallback and a transparency improvement, **not a certified crop-completeness fix**.

## 4. Confirmed defects, fixes and residual risks

| Severity | Reproduced defect / root cause | Implemented fix and regression | Residual risk |
| --- | --- | --- | --- |
| P1 | Damaged plain extraction was the primary unresolved-equation display | Source-image fallback, preserved text details and original-PDF action; renderer test and real enrolled-student browser test | Detector crops can still clip terms |
| P1 | “Verified passages/course material” contradicted unverified extraction | Reader/API warnings now distinguish preserved source linkage, unverified extraction and instructor approval | Historical metadata `sourceIntegrity: verified` is a provenance/integrity field, not mathematical verification; no independent-verification state is asserted |
| P1 | Extraction acknowledgement marked the curriculum dirty, forcing a new draft version and invalidating finalized reviews | Metadata acknowledgement no longer sets content-dirty state; explicit approval keeps exact snapshot; real reference browser retains two rendered reviews | Actual content edits correctly invalidate old reviews |
| P2 | Required acknowledgement was hidden inside an additional Advanced disclosure | Required panel moved directly into Source tools and audit; browser asserts visible/checked panel | No general Studio redesign |
| P2 | Indented code rows were stripped and could be merged as prose | Preserve original line text inside fences, retain lines and indentation through canonical code; actual networking ingestion/reader assertions | Unfenced code and indentation encoded only by separate PDF objects need broader evaluation |
| P2 | Pipe-table rows with realistic spacing were not merged | Geometry-bounded row-gap tolerance; exact cells asserted in Python and browser | Visual-rule/merged-cell tables remain unsupported |
| P2 | Single-rectangle captioned diagram was missed | Detect closed rectangle primitives near captions, without treating every boxed definition as a figure | Arbitrary unframed diagrams are not reliably detected |
| P2 | Single-level numbered headings ignored; fallback title absorbed prose | Accept top-level numbering only when trusted layout classifies a heading; test preserves two exact networking headings | Legacy untyped text remains conservative |
| P2 | Figures attached to the first section/passage on their page | Attach to nearby caption/source region and order by page geometry; networking browser asserts table precedes figure | Dense/multicolumn diagrams need independent review |
| P2 | Ordinary diagram labels with ASCII arrows were offered as math | Non-math-font multiword arrow labels remain prose; networking regression | This is a narrow lexical guard, not universal technical-notation classification |
| P1 | Math canonical display silently cut at 600 characters | Preserve up to the existing 8,000-character math contract; flag larger expressions with review issue | Longer regions still require source inspection; other bounded projections are not a lossless PDF renderer |
| P0 resource boundary | PDF crop parsed inside API process | Fresh isolated child with CPU/memory/time/output limits; bounded crop concurrency; timeout/output and real crop tests | Container/process supervision and workload load testing remain necessary |
| P1 external-processing control | Consent could be revoked during crop generation after initial preflight | Reread consent and eligibility immediately before SDK dispatch; real MongoDB regression proves no provider invocation | No atomic transaction with an external provider; in-flight calls cannot be recalled |
| P2 | Index-outage recovery lacked explicit regression evidence | Fault-injected MongoDB publication test retries exact receipt and preserves frozen expression despite later proposal changes | Operator recovery remains more polished at API level than in Studio |

Approval now explicitly returns HTTP 200 through Nest as intended. Initial QA failures also exposed harness issues: Docker Desktop could not mount `/tmp`, host networking was unavailable, and a test worker generated a different DB name. The harness now uses a shared workspace directory, explicit loopback port mapping, a stable isolated DB name and graceful cleanup. Those were test setup failures, not product fidelity passes. A duplicate code locator came from the deliberately collapsed source-audit copy; the test now requires exactly one **visible** code block without opening that audit copy.

## 5. Real services, operations and costs

The final QA harness uses separate ports: Next 5360, Nest 5361, Python 5362; MongoDB 27017 and RabbitMQ 5672. Each run creates its own `test_formula_final_<timestamp>` database and RabbitMQ vhost. Original/index files and copied existing model cache are disposable. Python code is mounted read-only. The separate ingestion worker and separate Node recognition worker run against the isolated resources. Existing application containers and user databases are not redeployed or rewritten. Early harness runs stranded QA resources when the app subprocess exited before cleanup. A runner-owned global teardown now independently removes the exact run database, vhost, container and cache directory; prior QA leftovers are cleaned separately. This is test cleanup, not production safe-shutdown certification.

The Python container uses the existing AI image, 2 CPUs and a configured 4-GiB memory ceiling (also subject to the Docker host's ceiling). It loads the already cached all-MiniLM-L6-v2 model offline. Source parsing remains limited to its existing 512-MiB child. New crop limits: 256 MiB address space, 10 CPU seconds, 12 wall seconds, 4 MiB output, longest edge 1,600 pixels, two concurrent crop operations per API process and five-second bounded capacity wait. These are per-process controls, not a whole-deployment throughput guarantee.

[Extraction measurements](evidence/batch2-final/extraction-current.json) and [crop limits/measurement](evidence/batch2-final/crop-resource.json) contain actual current values. The current sample measured 0.5951 s for 20 pages / 33,726 characters, 18,740 KiB parent maximum RSS and 52,992 KiB child maximum RSS. It found 510 regions, including 85 math regions and 119 review-required regions. One crop took 0.1717 s and produced 2,166 bytes. These are single local samples under QA load, not latency percentiles or production capacity promises.

All current recognition responses are SDK replays with **fabricated test usage of 100 tokens per job**. The real durable budget path reserves one request and 65,536 tokens per dispatch, records completion and rejects repeated dispatch. It conservatively retains reservations on uncertainty; it does not refund unused token allowance automatically. It is not an invoice reconciliation system or a guarantee of zero provider charges. Historical three-crop Gemini measurements remain in the research report; they are not new calls made by this audit.

Live Gemini testing is **BLOCKED**: this final scope supplies no fresh live-call approval/budget and independently current billing/free-tier evidence. The QA eligibility record describes a fake test credential and cannot certify a real project. A real smoke test requires current exact-project/key eligibility evidence, authenticated document consent, operator approval, a bounded durable budget and explicit scope-specific authorization. No new external model or paid API call was made.

## 6. Test evidence

Current commands and results are recorded below; previous milestone passes alone were not used as final evidence.

| Command / scope | Actual result |
| --- | --- |
| API typecheck and build | PASS |
| Web typecheck and production build (`EDNOVA_NEXT_DIST_DIR=.next-final-build`) | PASS |
| Targeted API Jest: jobs, proposals/review, publication, reader and canonical | 34 passed / five suites; clean exit with `--detectOpenHandles` |
| Existing M08 publication integration | 8 passed |
| Web Vitest | 90 passed / 17 files |
| AI extraction/recognition plus budget, index-idempotency and API runtime suites | 96 passed, no skips; two dependency deprecation warnings |
| Final real-service browser suite | 2 passed: mathematics reference and networking fixture |
| Existing Studio browser regressions | 4 passed |
| Affected networking browser after final label-classification fix | 1 passed (same case rerun, not an additional distinct test) |
| Final reference screenshot confirmation | 1 passed; same reference case, not an additional distinct test |
| `git diff --check` | PASS at final verification |

Reproduction commands:

```bash
pnpm --filter api typecheck
pnpm --filter api build
pnpm --filter web typecheck
EDNOVA_NEXT_DIST_DIR=.next-final-build pnpm --filter web build
pnpm --filter web test
pnpm --filter api exec jest \
  modules/study/src/tests/formula-publication.integration.test.ts \
  modules/study/src/tests/formula-jobs.integration.test.ts \
  modules/study/src/tests/formula-proposal.integration.test.ts \
  modules/study/src/tests/course-reader.test.ts \
  modules/study/src/tests/canonical-document.test.ts \
  --runInBand --testTimeout=20000 --detectOpenHandles
P0_BUDGET_TEST_MONGODB_URI=mongodb://127.0.0.1:27017 \
  PYTHONPATH=apps/ai /tmp/ednova-b2-venv/bin/python -m pytest \
  apps/ai/agents/course_ingestion/tests apps/ai/tests/test_llm_budget.py \
  apps/ai/tests/test_sources_index_idempotency.py apps/ai/tests/test_api_runtime.py \
  -q --tb=short
pnpm --filter web exec playwright test -c playwright.final.config.ts
pnpm --filter web exec playwright test -c playwright.formula.config.ts
# From apps/api:
MONGO_URI=mongodb://127.0.0.1:27017/test_formula_publication_final_20261102 \
  pnpm exec tsx --tsconfig tsconfig.json --test \
  tests/integration/m08-course-publication.node.test.ts
```

The host Python test environment needed its missing `python-multipart` installed before API runtime tests could collect; the runtime Docker image already supports multipart. No production dependency redesign was made. Real application execution uses the existing Python 3.11 AI image; the broad host regression suite ran in the existing Python 3.14 QA environment. The test harness verifies the fake Gemini SDK credential and refuses non-QA database names.

See [test log excerpts](evidence/batch2-final/test-results.txt), [application/source evidence](evidence/batch2-final/application-run.json) and [networking evidence](evidence/batch2-final/networking-run.json). QA records are disposable; durable evidence files retain hashes, revision IDs, source spans and test outcomes after cleanup.

## 7. Screenshots and student experience

[Reviewed formula in the enrolled-student reader](evidence/batch2-final/student-reviewed-formula.png) · [desktop](evidence/batch2-final/student-desktop.png) · [mobile outline](evidence/batch2-final/student-mobile.png) · [source inspection](evidence/batch2-final/student-source.png) · [networking reader](evidence/batch2-final/networking-reader.png).

Browser assertions check two KaTeX expressions, a nonempty fallback image and inspector image, exact PDF byte equality, real student login, outsider HTTP 403, committed revision identity, real indexed reviewed metadata, code whitespace, table cells, diagram image loading and mobile outline navigation. The source audit is deliberately separate and collapsed; it may repeat original extracted passages when explicitly opened. Tests do not count this hidden audit as a second visible lesson.

Desktop/mobile screenshots were visually inspected. Mobile testing checks the reader outline at 390×844; it is not comprehensive testing of every mobile interaction, browser engine or assistive technology. Some source mappings remain uncertain and are labelled accordingly.

## 8. Acceptance matrix

PASS means the named bounded behavior was executed, not that an entire discipline is supported. Security evidence here is scoped source-boundary inspection and executed regressions, not an independent exhaustive security scan.

| Gate | Status | Evidence / boundary |
| --- | --- | --- |
| Original source preservation | PASS | Actual upload/download byte equality and SHA-256 |
| No silent content loss in every projection | PARTIAL | Original and complete source artifacts retained; math truncation fixed/flagged; no exhaustive equivalence proof |
| Reference chapter/lesson count | PASS | Real worker two chapters / 16 lessons; visual source cross-check |
| Independently approved full hierarchy / paragraph order | PARTIAL | Source-image inspection and regressions; no second independent reviewer or full reading-order annotation |
| No equation title regression | PASS | Reference test and actual canonical title assertion |
| Source mapping integrity everywhere | PARTIAL | Exact hashes/region/crop checks pass; reader discloses unmapped/inferred passages |
| Independent mathematical ground truth | BLOCKED | Qualified independent approval absent; 0 approved / 16 provisional |
| Verified mathematical accuracy metrics | BLOCKED | No adjudicated labels; all corresponding metrics null |
| Correct instructor-reviewed workflow | PASS | Accept/correct/reject and source-bound immutable publication; not expert truth |
| No unapproved reconstruction promoted as reviewed | PASS | Pending/rejected/stale fallback; review and publication regressions |
| Source-image fallback authorization/safety | PASS | Actual student crop/PDF access, outsider denial, bounded child rendering |
| Complete formula crop boundaries | FAIL | eq-001 missing summand; contamination in other samples |
| Mathematics and prose fidelity generally | PARTIAL | Real PDF retained/rendered; damaged ordering/symbol extraction remains |
| Definitions/proofs/exercises | PARTIAL | Typed blocks preserved; no exhaustive association correctness scoring |
| Code syntax / indentation | PASS | Authored networking PDF → actual canonical → student reader |
| Tables | PARTIAL | Explicit two-column pipe table passes; merged/visual tables unproven |
| Figures | PARTIAL | Reference frame and captioned networking diagram pass; arbitrary figures unproven |
| Additional discipline | PARTIAL | Two-page authored networking fixture passes; not an independent real-document corpus |
| Production session authentication / source authorization path | PASS | Actual instructor/student/outsider sessions in local application |
| LaTeX safety | PASS | Existing restricted contract, KaTeX trust false/bounded expansion and unsafe-input regressions |
| Consent / revocation | PASS | Authenticated source-owner consent, actual success path; direct real-Mongo negative/race regressions |
| Node ↔ Python service authentication | PASS | Uncredentialed HTTP 401 and authenticated real job completion |
| Approval / durable budget / free-tier fail-closed logic | PASS | Real reservation path and real-Mongo negative tests with fake SDK/project controls |
| Live-project eligibility / provider certification | BLOCKED | No fresh verified live scope, approval and budget |
| Worker recovery / duplicate delivery / competing claims | PASS | Existing real Mongo/Rabbit worker tests rerun |
| Timeout / malformed response / missing usage / simulated quota failure | PASS | Regression fail-closed and no redispatch; HTTP 429 is simulated SDK failure, not a live provider response |
| In-flight cancellation / authorization revocation atomicity | PARTIAL | Before/after snapshot/policy checks and cancellation tests; external dispatch cannot be atomic with revocation |
| Budget reconciliation | PARTIAL | Durable conservative reservation and outcome records; manual uncertainty/cost reconciliation remains |
| Publication concurrency / replay / index-outage recovery | PASS | Real Mongo fault/concurrency tests; real-service success path |
| Historical content / index preservation | PASS | Prior canonical and exact FAISS/metadata byte comparisons in isolated regression fixtures |
| Reader/retrieval revision consistency | PASS | Frozen target, matching canonical/index metadata and real FAISS artifacts |
| Semantic retrieval accuracy | NOT TESTED | Actual embeddings/index built; no judged query/relevance benchmark |
| No repeated visible lesson/code blocks | PASS | Region projection and exactly one visible code block; audit copy explicit |
| API/web builds and typechecks | PASS | Current reruns |
| AI runtime/dependency compatibility | PARTIAL | Real existing Docker runtime succeeds; broad suite on host QA Python; no full platform matrix |
| Queue/database configuration | PASS | Isolated real broker/database integration; no production configuration certification |
| Worker supervision and production safe shutdown | PARTIAL | QA process shutdown succeeds; persistent production formula-worker supervision not certified |
| Resource limits / production capacity | PARTIAL | Parser/crop/container limits tested; no production load/capacity test |
| Rollback | PARTIAL | Artifact-preserving procedure below; no production rollback drill |

## 9. Operational assessment and rollback

API/web: current builds and application sessions work locally. Deploy matching canonical/reader/AI changes together only after acceptance; no deployment was made here. Preserve prior published content and indexes. New source processing may change region ordering/type for the corrected networking cases; do not silently regenerate historical artifacts or transfer old review decisions.

AI extraction: bounded parsing and crop rendering are in place. OCR remains local and language-limited. Formula recognition remains optional, proposed and subject to review; no general-purpose equation correctness is claimed.

Mongo/Rabbit: durable job/proposal/receipt state and duplicate-safe claiming pass measured regressions. Recognition workers mark interrupted external dispatch uncertain and avoid automatic replay. Operator reconciliation is intentionally conservative. Missing usage and failed provider requests retain reservation evidence.

Retrieval: final QA used real local embeddings and native indexes with original source metadata. Existing indexes are not migrated or overwritten. Semantic relevance quality still needs a judged benchmark. Source-only and instructor-reviewed units remain distinguishable.

Rollback: stop new recognition/publication processing, preserve source blobs, proposals, review history, publication receipts, target canonical snapshots and all historical FAISS artifacts; restore the previous matched application build. Retry only the exact receipt command for a known index failure after repairing the dependency. Do not reset uncertain jobs to queued or erase budget markers to trigger a second external request. Do not “roll back” by rewriting published content. A full production restore/supervision drill remains unexecuted.

## Final decision

**NO-GO.** The functional integration is now demonstrated more broadly and several confirmed defects are repaired. Full Batch 2 acceptance still fails the crop-completeness gate and lacks qualified independent mathematical accuracy evidence. Broad multimodal fidelity, semantic retrieval relevance and live-provider/production operations remain only partial or blocked. Independent review should adjudicate the prepared annotations and remaining source-boundary/reading-order defects before any readiness upgrade.

No Batch 3, AI Experience Planner, production deployment or new real Gemini inference was performed.

## Independent continuation and focused rerun

The current acceptance request was checked against the existing publication and final-acceptance reports and the actual current code. No new provider adapter, production inference, or Batch 3 work was introduced. The desktop original and the benchmark PDF both have SHA-256 `ff83040269166027d02937563af93b6686ba9a02a0fd449c93a74747003faa02`. An additional `pdftotext -layout` inspection of the desktop original found the same 16 numbered headings listed above; this is a separate text-layer cross-check, not qualified independent visual adjudication of every boundary. Visual inspection of the original `eq-001` crop again shows its final summand clipped.

On this continuation, `pnpm --filter web exec playwright test -c playwright.final.config.ts` passed **2/2** real-service cases: the 20-page reference PDF and the authored networking fixture. The Node/Python HTTP boundary, broker, database and index service were real; only the Gemini SDK response was replayed from the previously authorized fixture. No real Gemini request was made. This rerun's disposable test resources and accounts are not production operations.

The prior browser assertion loaded an arbitrary unreviewed image after rejecting `eq-063`; it did not establish that the loaded image was the rejected region. The reference test now explicitly selects the rejected region ID and verifies that its image loads, then separately verifies a different unresolved region image. The affected real-service reference journey was rerun with `pnpm --filter web exec playwright test -c playwright.final.config.ts -g 'real reference upload'` and passed **1/1**. This is the same reference scenario rerun, not an additional independent document or qualified mathematical review. The actual renderer/source route had already implemented the fallback; this continuation tightens its acceptance evidence rather than claiming a new product fix.

The ten requested checks are classified for this continuation:

| Requested criterion | Status | Reproducible evidence and limitation |
| --- | --- | --- |
| Full original PDF through upload, extraction, draft, publication and reader | PASS | Real-service reference browser run; desktop and fixture SHA-256 match; isolated test environment. |
| Independently inspect hierarchy and source attribution | PARTIAL | Separate desktop text-layer 16-heading cross-check and existing source-region/hash checks; no qualified independent review of complete hierarchy and attribution. |
| Compare representative equations to original and distinguish approval | PARTIAL | Existing source crops and provisional formula audit; `eq-001` visibly clipped; no qualified independent equation approvals. |
| Actual Node-to-Python HTTP with mocked Gemini SDK only | PASS | Real-service reference test and `final_acceptance_app.py`; provider SDK replay, service boundary real. |
| Readable original-image fallback for rejected and unresolved equations | PARTIAL | Exact rejected and distinct unresolved region images load for an enrolled student in the focused rerun; crop completeness fails for `eq-001`. |
| Correct misleading source-verification labels | PASS | Existing reader labels distinguish source linkage, unverified extraction and instructor review; reference and networking journeys passed. |
| Non-mathematical document | PARTIAL | Authored two-page networking fixture traversed real ingestion, publication and reader; not an independent real-world corpus. |
| Immutable revision, canonical and retrieval/index consistency | PASS | Real-service indexed revision assertions and prior isolated immutable-byte and fault/concurrency regression evidence; retrieval relevance not measured. |
| Enrolled-student access and source authorization | PASS | Real test sessions, active enrollment, original PDF byte match and outsider 403 in the reference browser journey. |
| Correct confirmed defects and rerun affected checks | PARTIAL | Existing fixes and regressions are documented above, and exact rejected fallback evidence was strengthened and rerun; the confirmed clipped source crop and broader reading-order defects remain unresolved. |

**Decision remains NO-GO.** The passing real-service workflows and stronger rejection assertion do not cure the confirmed crop defect or supply independent mathematical ground truth. Preserve original source and existing revisions; do not advance to Batch 3 on this evidence.


### Region-fidelity remediation update

The opt-in reader context view now recovers the clipped final `uₚ` of `eq-001` using bounded adjacent-glyph geometry, while the historical detector bbox, region ID and exact recognition crop remain unchanged. The isolated real-service mathematics and networking browser cases passed after this change; all 16 reference IDs and bboxes remained resolvable. A visual overview of all 85 math regions found additional clipping, including page 19, and plain-text formula order remains damaged. **The complete-crop gate remains FAIL and independent mathematical approval remains BLOCKED.** The [remediation report](EDNOVA-BATCH2-REGION-FIDELITY-REMEDIATION.md) documents the new view, comparison package, compatibility boundary and limits. The overall decision remains NO-GO.
