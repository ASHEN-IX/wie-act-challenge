# EdNova universal learning system — current state and implementation plan

Date: 2 November 2026

## Scope and evidence

This report covers the EdNova web workspace, study API, course ingestion worker and source artifact pipeline. The audit was checked against the running local application on 2 November 2026, not from memory alone. The verified course used for the reader is `Relational Database Design & Normalization` (`6ae7a50b1f7648bd529249e2`, revision `rev_20261018_v1`) with one immutable text source and one verified extracted chunk.

The current delivery is an incremental foundation. It provides a typed reading projection, a trusted React renderer and a responsive reader. It does **not** yet provide the requested AI Experience Planner, safe code-execution sandbox or complete library of scientific and engineering simulations. Those remain later phases and must not be represented as finished product behavior.

## Current architecture

Uploads enter through the course API. Accepted PDF, TXT and Markdown files are validated, staged, captured as immutable source blobs, indexed by the EdNova AI service and linked to a course revision. The ingestion worker extracts page-aware text, builds topic and objective drafts, and publishes an instructor-reviewed revision. The published revision and its source manifest are the authority for reading and activities.

The web application is a Next.js App Router workspace. Server actions call the gateway API with the current session. The learning page already had activity selection, assessment submission, source hints, a grounded tutor and private progress. Those components remain in place below an anchored `Practice and tutor` section.

The new reading path is:

1. `getPublishedCourseContext()` checks course access and verifies the exact published revision/source artifact.
2. `getLearningDocument()` creates a deterministic reading projection from the verified artifact and revision outline.
3. The study API serves that projection at `GET /api/v1/study/learning/courses/:courseId/document`.
4. The web server strictly decodes the response with a versioned contract before it reaches React.
5. A typed block registry renders only known block types. Unknown types show a contained fallback.

The model distinguishes source blocks from generated outline guidance. The extraction artifact currently has document/page metadata and page-relative `section_id` values, but no trustworthy topic or subtopic identifiers. Source passages therefore stay in source order under `Original course material`. The API does not guess a topic association from an unrelated section ID.

## Universal document contract

Version `1.0.0` is an exact-shape contract with bounded strings, arrays and identifiers. It rejects unknown block types, unknown fields and unknown schema versions at both the server and browser boundaries. The supported block union is:

- headings, paragraphs, lists, quotes and source evidence;
- code, including a declared language and copyable plain-text fallback;
- formulas (`latex` or `plain`) and media references;
- tables and ordered diagrams;
- definition, theorem, example, proof, exercise and note callouts.

Every rendered source block links back to a verified chunk, page and document when the evidence is present. Original-source links use the existing authorized download route. Generated outline guidance carries no source evidence and is visually labelled as guidance.

Adding a block type requires a contract variant, a typed registry entry, a safe renderer and compatibility tests. The registry is the only route through which a lesson block can select a component.

## Security boundaries

- React renders source text as text. Uploads are never interpreted as HTML and no `dangerouslySetInnerHTML` path exists in the reader.
- Uploaded code is displayed and can be copied. It is not executed in the browser, API or ingestion worker.
- Formula rendering uses KaTeX with trusted math output enabled and strict error handling. Invalid formulas fall back to their escaped source text.
- Media rendering accepts only server-authorized `/api/v1/` paths. External and data URLs are rejected by the renderer.
- Block failures are contained by a renderer error boundary; source and runtime details are not shown to learners.
- Reading authorization remains server-side. The client contract validates shape but is not treated as an access grant.
- Source downloads retain the existing containment, integrity and authorization checks.

## Reader behavior

The course page now has a readable article layout with a contextual outline, course objectives, separate lesson guidance and original-source material. Expensive formula rendering is lazy loaded. The reader has responsive mobile outline access, desktop outline tracking, a reading-progress indicator that explicitly is not mastery, source-reference dialogs and links into practice and the tutor.

The workspace now exposes a persisted light/dark theme control. Browser verification loaded the verified reader in dark mode with no page errors.

## Course creation subject issue

The learner account originally had one subject. The visible subject list is intentionally account-scoped: subjects belonging to an instructor are not learner options. This was a visibility rule, not a hidden second dropdown.

The upload form now exposes `New subject` next to the selector. When creation succeeds, the new subject is added to the client list and selected immediately. A focused API test checks creation for the current account and duplicate-name rejection. A live browser check confirmed that the learner sees the existing subject and a visible new-subject dialog, and that a newly created choice becomes selected.

The upload form preserves selected files when the subject changes and shows an explicit review notice and Clear files action. It has a drag-and-drop target, an accessible file picker, duplicate and type validation, a size summary, per-file removal, and a sticky action bar. The completion screen offers another upload, a return to all courses, and a new course in another subject. If the account has another subject, that action selects it; if only one subject exists, it opens the New subject dialog rather than reopening the old subject.

## Ingestion and failure behavior

The earlier failed processing path was repaired by making the AI worker use the EdNova database identity and by including the offline embedding model in the AI image. PDF, TXT and Markdown ingestion were exercised successfully, and the verified normalization course was published.

The uploaded series course was investigated after it appeared as failed. Its ingestion operation and durable receipt are complete: one PDF, 65 extracted subtopics, 25 chunks and 25 indexed chunks. A draft revision was created, but no active published revision exists. The worker's AI enrichment attempt reported that provider credentials, approval or durable budget were unavailable, so it retained deterministic extracted content instead. This is a review/publication state, not a parsing failure. The course lifecycle now reports Ready for review, shows a review action, and only enables published learning after a revision is active. AI provider credential, approval and budget configuration is still required for generative enrichment.

The course page distinguishes processing, review, ready and failed states, reports original-file availability, and routes an unprocessed draft to Course Studio. The course list and the library, planner, study sessions and collaboration selectors filter out drafts that have no published revision instead of treating ingestion completion as learner availability.

## Prioritized plan

1. **Completed foundation:** versioned reading contract, verified projection, safe component registry and adaptive reader.
2. **Source structure migration:** add topic/subtopic identifiers and trusted block candidates to the indexed artifact, then map blocks deterministically without changing existing published revisions.
3. **Rich authoring and media:** add validated charts, images, audio/video and diagram data with reusable source-backed migration fixtures.
4. **Interactive experiences:** introduce reviewed simulation definitions and isolated execution for untrusted code only after a sandbox boundary is implemented.
5. **AI Experience Planner:** select only registered components, produce schema-valid configurations and preserve the canonical lesson as an immutable source. Answers must remain source-grounded and degrade to text when a visualization cannot be supported.
6. **Release quality:** visual regression, accessibility audits, content migration fixtures, long-course performance budgets and provider-behavior evaluations.

## Validation performed

- Study API and web TypeScript checks pass.
- Production Next.js build passes.
- The source parser and strict document contract tests pass.
- The trusted renderer tests pass for escaped markup, non-executed code and rejected external media.
- The existing activity renderer and contract suites pass; the practice and tutor area remains integrated in the reader route.
- Web lifecycle tests distinguish processed drafts from published courses; the full web suite has 80 passing tests.
- Browser checks cover desktop and mobile upload states, the drag-and-drop target, preserved files after subject changes, the completion screen's subject action, the review state, and light/dark reader rendering.
- The document API returns the verified course projection for an authenticated learner.
- Desktop and mobile browser captures show the reader and source material. Captures are stored under `docs/submission/screenshots/`.

## Known limitations

- The reader does not yet map individual generated topics to extracted source passages. Its original-source section preserves the mapping uncertainty rather than inventing attribution.
- Markdown tables in uploaded sources currently remain readable paragraphs. Explicit structured table blocks are supported by the contract and renderer, but the extractor does not yet emit them.
- Images, audio, video and code execution have safe fallbacks, but no complete upload-to-media pipeline exists yet.
- OCR warnings are exposed conservatively and source download remains the verification route.
- The experience planner, expanded simulation library and production performance/accessibility certification are not complete.
