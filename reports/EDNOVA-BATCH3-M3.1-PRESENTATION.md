# EdNova Batch 3 — Milestone 3.1: canonical-to-presentation contract and published-course rendering

Date: 2026-11-03. Baseline: `db3b802`, annotated tag `ednova-batch2-v2-rc1` (Batch 2 Detector V2 + canonical document, CONDITIONAL GO release candidate). Scope: the first Batch 3 milestone only. No Batch 4 work, no detector change, no new live provider call, no production data modification.

**Verdict: PASS for the Milestone 3.1 technical slice.** A versioned presentation contract now projects an authorized published revision into lesson-level rendering, and a real published course rendered through it in the isolated end-to-end harness. The deterministic source-faithful reader remains the fallback at two levels: per block (`source_faithful` render policy) and per page (projection unavailable or invalid → existing reader of the same revision). This is structural verification only. Independent mathematical accuracy and production deployment remain open and are not claimed by this milestone.

## 1. Frozen inputs

`docs/contracts/batch3-consumed-contracts.md` records the published-content and source-provenance surface Milestone 3.1 consumes, pinned to the Batch 2 commit/tag:

- `CanonicalDocumentV1` `1.0.0` (stored `contentDocument` + `contentDocumentHash`) and the formula-publication projection binding.
- `ReadingDocumentV2` `2.0.0` (browser projection, fail-closed parser, never an authorization grant).
- `PublishedCourseContext` authorized `(actor, courseId, revisionTag)` resolution; revision immutability.
- `EvidenceSpan` / `SourceBlockMeta` provenance and per-document extraction-version resolution (`"1.0"` frozen, `"2.0"` identity-salted, never mixed).
- Crop/source URLs handed to the browser are `/api/v1/...` only; raw source is never interpreted as markup.
- Unreviewed display mathematics is never typeset as if verified.

No V1/V2 compatibility path, checksum check or publication guarantee was relaxed. `getLearningDocument` and the new presentation projection now load through one shared boundary (`loadPublishedReading`), so revision pinning, artifact verification, canonical checksum and formula-projection checksum cannot drift between surfaces.

## 2. Contract

`apps/api/shared/ednova/presentationDocument.ts`, schema `1.0.0`:

- `PublishedPresentationV1` — `courseId`, `revisionId`, source `contentHash` (same value as the reading projection), verified `canonicalContentHash`, title/summary, provenance, verification summary, objectives, chapters → lessons → blocks, sources, fallback, warnings.
- Each block carries `render: 'primary' | 'source_faithful'` and a `reason` (`reviewed_formula`, `unreviewed_formula`, `missing_source_asset`, `extracted_content`).
- The render policy is **derived from the block**, not supplied by callers. A tampered payload that relabels an unreviewed formula as `primary` fails the strict parse.
- The disclosure string is a fixed vocabulary keyed by status (`no_math`, `unreviewed`, `partially_reviewed`, `reviewed`). Free text and stronger claims fail the parse. No state says "verified"; the `reviewed` string explicitly says instructor review is not independent mathematical verification.
- Blocks reuse the reading-contract block validator (`parseLessonBlock`), so unknown keys, markup-shaped payloads and oversized values fail at the projection boundary.
- `fallback.readerHref` must point at the same course's deterministic reader.

## 3. Implementation

- `apps/api/shared/ednova/learningDocumentV2.ts` — exports `parseLessonBlock` (single block vocabulary; no second, weaker validator).
- `apps/api/shared/ednova/presentationDocument.ts` — contract, deterministic builder and strict parser (new).
- `apps/api/modules/study/src/services/courseReader.ts` — extracts `loadPublishedReading` (authorization + artifact + canonical checksum + formula projection) and keeps `getLearningDocument` behavior unchanged.
- `apps/api/modules/study/src/services/presentationReader.ts` — authorized canonical → presentation projection; 409 `PresentationUnavailableError` when a revision has no canonical document (the reader remains available).
- `apps/api/modules/study/src/routes/learning.ts` — `GET /api/v1/study/learning/courses/:courseId/presentation?revisionId=…`, same authorization wrapper and error-status mapping.
- `apps/api/src/framework/domains/study.module.ts` — regenerated Nest adapter (`pnpm generate:contracts`). Production routing is generated; adding a domain route without regeneration silently 404s.
- `apps/web/src/features/learning/journey-actions.ts` — strict browser-boundary parse; no partial render.
- `apps/web/src/features/reader/presentation-view.tsx` — lesson-level learner surface. Reuses the trusted block registry, shows the fixed disclosure and math review counts, exposes source inspection and the deterministic reader link. Reviewed formulas are typeset; unreviewed formulas render the preserved crop plus "Automatic transcription is unverified".
- `apps/web/src/app/(workspace)/courses/[courseId]/present/page.tsx` — presentation preferred; on any projection failure renders `CourseReader` for the same authorized revision with an explicit notice.
- `apps/web/src/app/(workspace)/courses/[courseId]/learn/page.tsx` — links to the presentation view for the same pinned revision.

## 4. Verification

| Check | Result |
| --- | --- |
| Contract/strictness Jest (`presentation-document`) | 7 passed |
| Projection fallback Jest (`presentation-reader`) | 1 passed |
| Real published-revision integration (`formula-publication.integration` + new presentation assertions) | 1 passed (suite 4 passed) |
| Study Jest ledger (canonical, reader, jobs, proposal, publication, presentation) | 42 passed |
| Web Vitest | 93 passed |
| Web production build | passed; `/courses/[courseId]/present` emitted |
| API/Web typechecks | passed |
| Python `course_ingestion` suite | 100 passed |
| Python runtime trio (`llm_budget`, `sources_index_idempotency`, `api_runtime`) | 11 passed, 2 skipped (environment-gated) |
| Real-service Playwright (reference math + networking journeys, presentation leg) | 2 passed (1.9 min) |

New assertions cover: deterministic projection and block order; reviewed/unreviewed/missing-media policy; `no_math`/`unreviewed`/`partially_reviewed`/`reviewed` counts and fixed disclosure; repeat-build determinism; rejection of unknown version, extra keys, free-text disclosure, relabelled unreviewed math, foreign reader/source links, and markup-shaped blocks; 409 fallback when canonical is absent; and no internal review payload or server path in the projection.

## 5. End-to-end evidence

Real-service run (`apps/web/e2e/final-acceptance.spec.ts`, config `playwright.final.config.ts`): real BetterAuth student/instructor sessions, real Nest API, real Python AI service and ingestion worker, real RabbitMQ vhost, isolated MongoDB (`test_formula_final_<ts>`, dropped by owned teardown), real FAISS construction. Only the Gemini SDK is replayed from previously authorized offline outputs.

- **2 passed / 2 journeys**, including the existing reference-math and networking journeys (no reader regression).
- `/courses/<id>/present?revisionId=rev_formula_…` rendered `data-presentation-status="partially_reviewed"`.
- The revision contains **85 display-math blocks**: **2 instructor-reviewed** (typeset as KaTeX) and **83 source-fallback** (original crop + "Automatic transcription is unverified").
- The disclosure contains "not semantically verified"; the math counts in the UI match the API contract.
- The fallback link resolves to `/courses/<id>/learn?revisionId=rev_formula_…`.
- The presentation API returned schema `1.0.0` with the same reviewed/source-fallback split.
- Evidence (gitignored, local): `reports/evidence/batch2-final/student-presentation.png`, `reports/evidence/batch2-final/application-run.json` (`presentation` block: schema `1.0.0`, `partially_reviewed`, `{ total: 85, reviewed: 2, sourceFallback: 83 }`).

## 6. Explicit non-claims and open dependencies

1. **Independent mathematical review — BLOCKED, unchanged.** 0 of 16 prepared cases adjudicated; no accuracy metric is claimed. The presentation contract only carries `accepted`/`corrected` instructor review and a fixed "not semantically verified" disclosure.
2. **Production deployment — PARTIAL / NOT TESTED, unchanged.** No production deploy, load/capacity certification or rollback drill. Live provider eligibility/budget still needs fresh authorization.
3. Structural extraction fidelity remains separate from semantic correctness. This milestone changed presentation, not extraction.

## 7. Stop point

Milestone 3.1 is complete and stops here for independent review. Batch 4 and later Batch 3 milestones are not started.
