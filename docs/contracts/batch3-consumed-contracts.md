# Batch 3 consumed contracts — frozen inputs

**Baseline:** `db3b802` (annotated tag `ednova-batch2-v2-rc1`), Batch 2 Detector V2 + canonical document, CONDITIONAL GO as a release candidate.

This note freezes the published-content and source-provenance surface that Batch 3 builds on. Batch 3 may add projections on top of it; it must not re-derive, reinterpret or weaken these contracts. Version constants below are executable: every parser fails closed on another version.

## Published-content contracts

| Contract | Version | Location | Frozen meaning |
| --- | --- | --- | --- |
| `CanonicalDocumentV1` | `1.0.0` | `apps/api/shared/ednova/canonicalDocument.ts`; persisted at `course_revisions.contentDocument` | Deterministic chapter/lesson/block structure extracted from the pinned source. `verification` is always `source_text_unverified`; `quality.semanticFidelity` is `deterministic_unverified` or `review_required`, never "verified". |
| `ReadingDocumentV2` | `2.0.0` | `apps/api/shared/ednova/learningDocumentV2.ts` | Browser-safe reading projection. A view, never an authorization grant and never executable markup. |
| `PublishedCourseContext` | existing resolver | `apps/api/modules/study/src/services/coursePublication.ts` | Authorized `(actor, courseId, revisionTag)` resolution. Readers may present only what this resolver returns. |

Frozen invariants:

1. A published revision is immutable. `contentDocumentHash` is the `activityDigest` of the stored canonical document and is checked before projection.
2. When `formulaPublication.sourceDraftId` exists, `contentDocumentHash` must equal `formulaPublication.projectionHash`; a mismatch fails the projection.
3. Revision identity on the wire is `(courseId, revisionTag)`; the Mongo `_id` is not a public identity.
4. `reviewedFormula` state is only present when the revision carries the formula-publication provenance. Without it, review state is stripped before projection.
5. Only `accepted`/`corrected` instructor review states exist. There is no "verified" state and no semantic-correctness claim anywhere in the contract.
6. Every parser rejects unknown versions, unknown keys and non-string/oversized values. Nothing is silently downgraded or stripped.

## Source-provenance contracts

| Contract | Version | Location | Frozen meaning |
| --- | --- | --- | --- |
| `EvidenceSpan` | `2.0.0` reading contract | `learningDocumentV2.ts` | `chunkId`, `documentId`, `pageNumber`, `lineStart`, `lineEnd`. Blocks keep a bounded provenance sample; the stored canonical lesson keeps every span. |
| `SourceBlockMeta` | `2.0.0` reading contract | `learningDocumentV2.ts` | `regionId`, `page`, `bbox`, `extractionMethod`, `confidence`, `reviewRequired`, `issues`. Source geometry is exactly the versioned extraction geometry. |
| Source manifest | existing | `apps/api/modules/study/src/services/revisionSources.ts`; `apps/ai/services/vector_store/revision_artifacts.py` | Per-document `extractionVersion` in `{"1.0", "2.0"}` (absent means `"1.0"`). Region resolution re-runs the matching extractor. |

Frozen invariants:

1. V1 (`"1.0"`) output and identities remain byte/value-identical; V2 (`"2.0"`) identities are salted and disjoint from V1.
2. A document resolves source regions through its own declared extraction version. Mixing versions in one manifest, or an unsupported version, fails closed.
3. Crop requests bind to a manifest region and its stored geometry; foreign regions, forged manifests and invalid geometry are rejected.
4. Crop/media URLs handed to the browser are server-authorized `/api/v1/...` paths. Source filesystem paths, storage keys and vector-index references never appear in a presentation payload.
5. Unreviewed display mathematics is never typeset as if verified. It renders from the original crop plus explicitly unverified extracted text.
6. Raw source text is never interpreted as HTML/script at either boundary.

## Batch 3 consumption rule

The Batch 3 presentation contract (`PublishedPresentationV1`, schema `1.0.0`, `apps/api/shared/ednova/presentationDocument.ts`) derives from the authorized published revision and the contracts above. It carries the source `contentHash` (same value as the reading projection) and the verified `canonicalContentHash` separately.

Presentation invariants (enforced by the strict parser, not by convention):

1. A block's render policy is derived from the block itself. An unreviewed formula cannot be relabelled `primary`/`extracted_content`.
2. The disclosure string comes from one fixed vocabulary keyed by verification status. Free-text or stronger claims fail the parse.
3. Math counts must satisfy `reviewed + sourceFallback === total`, and the status must agree with the counts.
4. Source links are `/api/v1/study/...` paths only; the fallback reader link must point at the same course.
5. Blocks reuse the reading-contract block validator, so markup-like or unknown keys fail at the projection boundary.

It may choose a render policy per block (`primary` or source-faithful fallback), but it may not:

- bypass `getPublishedCourseContext`,
- read a different revision than the one pinned by the caller,
- add, extrapolate or reorder source content,
- claim semantic or mathematical verification.

The deterministic source-faithful reader (`ReadingDocumentV2` + `CourseReader`) remains the fallback whenever a presentation projection is unavailable or invalid.

## Open external dependencies (not satisfied by this freeze)

1. **Independent mathematical review — BLOCKED.** 0 of 16 prepared cases have a qualified independent adjudication. No accuracy metric may be reported until they do.
2. **Production deployment readiness — PARTIAL / NOT TESTED.** No production deployment, load/capacity certification, supervision drill or rollback exercise. Live provider eligibility and budget authorization remain blocked.

Neither dependency is a code change; neither may be inferred from passing tests.
