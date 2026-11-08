# Course upload and review workflow (2026-11-08)

Historical evidence from a local dev stack (Mongo, RabbitMQ, API, web :5173, Python AI :8000).

## Problems found by running upload → review

| Problem | Status |
|---|---|
| **Save Draft failed for realistic courses**: the server action capped `topicsJson` at 2,000 characters, so any course with a few lessons returned "Invalid topicsJson." | Fixed (`actions.ts`, limit 2,000,000) |
| Extracted structure is weak: one chapter, lesson titles cut mid-sentence, placeholder objectives ("Explain the main ideas and methods in …") | Detected and flagged; titles/objectives can be proposed by AI |
| No overview of what needs fixing before publishing; the source-region gate was unexplained | New Automated review panel |
| Processing page was static ("refresh after the worker finishes") | Page now refreshes itself and opens Course Studio when ready |
| Duplicate file names in one upload were accepted | Now blocked with a message |
| Structure detection itself (chapters, boundaries) | Not changed |

## What was added

- `POST /api/v1/study/courses/:courseId/draft/review` (owner / assigned instructor / admin, same check as the draft). Read-only; never saves, acknowledges source review or publishes.
- Deterministic checks (`courseReview.ts`): blockers (empty draft, pending source review), warnings (cut-off titles, placeholder or missing objectives, thin lessons, duplicate titles), info (single chapter, very long lesson, empty summary).
- AI proposal (`apps/ai/agents/course_review`, agent `course_review`, capable tier): may only rename titles and write 1–3 objectives per lesson from the extracted excerpt. Strict schema, untrusted-text wrapping, one repair attempt; the API re-checks every id and length. Unavailable or invalid output is reported, not invented.
- Course Studio panel: "Run checks", "Review with AI", "Apply to editor" (changes the editor only; the instructor saves).
- The instructor still alone confirms the source review and publishes.

## Verification

- Real provider call: `course_review` → `groq/openai/gpt-oss-120b`, `REAL_APPROVED`. On the test PDF the AI renamed the chapter and both lessons and wrote 6 objectives; after saving, all title/objective warnings cleared, leaving only the human source-review blocker.
- Without an approval the panel shows "AI review is unavailable" and the checks still work.
- Publish with the source review unconfirmed is refused by the UI and API.
- Tests: Python 10 (`test_course_review.py`), Node 5 (`course-review.node.test.ts`), web vitest 224 passing, web/API typecheck clean, eslint on touched files 0 errors.

## Not verified

- Publish after confirming the source review, and a learner opening the result: the confirmation is the instructor's, and was not clicked in this run.
- `pnpm build`, Playwright e2e, full API suite.
- The processing auto-refresh was written but the test upload finished before it could be observed.
- Quality of AI wording was checked by eye on one short synthetic PDF only.

## Config decision

`LLM_APPROVALS_JSON` in `apps/ai/.env` (git-ignored) now includes `course_review`. Clicking "Review with AI" sends that course's extracted text (bounded excerpts) to Groq. Production needs its own approval.
