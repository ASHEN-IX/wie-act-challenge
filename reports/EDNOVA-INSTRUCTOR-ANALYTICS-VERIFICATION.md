# ED-19 instructor aggregates — 27 October 2026

Owned-course aggregate reporting is implemented in the existing Nest study domain
and Next workspace. `/instructor-insights` provides an assigned-course selector,
summary metrics, fixed activity-type counts and eight completed UTC weeks, with
loading, empty, unavailable and suppression states. It never provides learner
or attempt drill-down. The UI uses semantic headings, native keyboard controls,
responsive grids and accessible tabular text rather than a new chart dependency.

`GET /api/v1/study/insights/courses` lists currently authorized institutional
instructor assignments. `GET /api/v1/study/insights/courses/:courseId` returns only
an explicit aggregate projection. Neither institution administration nor a global
role grants insight access. Personal course ownership does not grant institutional
cohort reporting. Current membership, assignment and active institution are
checked through the existing resource authorization boundary.

The projection uses current active enrollment and institutional learner membership,
a committed reviewed published revision, its approved activity identities, accepted
non-mock learning evidence and matching graded/completed attempt receipts. Each
learner contributes at most once to each cell; repeated attempts cannot inflate
participation. No answer, rubric, source filename/storage reference, transcript,
private tutor response, learner ID, attempt ID or evidence ID is returned. Counts
are evidence participation, not academic grades, academic attainment, or diagnosis
of learners without evidence. `MOCK_TEST`, stale revisions and incomplete receipts
are excluded. Mongo performs the identity/status join and grouping, with a bounded
aggregation execution time.

## Privacy policy remains externally blocked

`EDNOVA_ANALYTICS_MIN_COHORT` must be an explicit integer from 5 to 1000. Missing,
invalid or weaker configuration suppresses **all counts** with `policy_pending`.
There is no silently approved default threshold. Configured thresholds remain
provisional pending Habib/Tasnim/Aziz projection and privacy review. Synthetic tests
configure 5 only to exercise enforcement; they do not approve 5 as product policy.
Small positive cells, their complements, zero and uniform outcome cells are hidden.
Arbitrary date/cohort/user filters are rejected. The only trend cells are fixed
completed UTC weeks. This is threshold enforcement, not differential privacy or a
proof against all longitudinal inference. Formal cohort policy and inference
review are genuine remaining gates for enabling real institutional aggregates.

Authorization is rechecked after aggregation and immediately before the response.
A changed published revision, threshold or exact active cohort fails closed. HTTP
responses use `Cache-Control: private, no-store`; Next requests also use the existing
server-only authenticated `no-store` API gateway.

## Observed verification

Evidence directory: `reports/evidence/ednova-final-20261027/analytics/`.

- `pnpm --filter api exec tsx --tsconfig tsconfig.json --test tests/integration/ed19-instructor-analytics.node.test.ts`: **7 nodes passed, zero skips**, real Nest/session/Mongo, uniquely named synthetic DB deleted on teardown. [Final log](evidence/ednova-final-20261027/analytics/integration-final.log).
- Five independent real authenticated sessions test unauthorized same-institution instructor, cross-institution instructor, administrator, student, anonymous and forged-resource access.
- Synthetic 20-learner cohort verifies 6 distinct accepted-evidence learners; duplicate attempts, mock evidence, stale revision and incomplete receipts cannot alter that result. Sparse guided-problem and complementary cells are suppressed; no private sentinel/ID enters the projection.
- Actual Mongo aggregation is delayed by a test hook that revokes instructor membership before delivery: **HTTP 403**. A corresponding cohort revocation before delivery gives **HTTP 409**. Persistence and the aggregation remain real; only the timing hook is injected.
- `pnpm --filter web exec vitest run src/features/analytics/insights-panel.test.tsx`: **3 tests passed**, covering policy-pending/small-cohort non-disclosure and semantic suppressed trend output. [Log](evidence/ednova-final-20261027/analytics/web-tests.log).
- Focused API/web lint pass with no diagnostics; strict API typecheck passes. Logs: `api-lint.log`, `web-lint.log`, `api-types-final.log`.

The integrated browser milestone is coordinated by the root task; these focused
SSR tests alone do not certify browser rendering or real-user accessibility.

| Atomic criterion | Result |
|---|---|
| ED-19-A001 unauthorized instructor denied | VERIFIED_COMPLETE for the authenticated HTTP/current-membership cases above |
| ED-19-A002 reviewed minimum threshold | EXTERNALLY_BLOCKED on policy review; configurable and fail-closed enforcement verified locally |
| ED-19-A003 no private answers in aggregates | VERIFIED_COMPLETE for the explicit projection and negative sentinel/identity checks; independent inference review remains a release gate |
| ED-19-A004 no private files in aggregates | VERIFIED_COMPLETE for the explicit projection; this endpoint never reads or returns private files |

ED-19 is locally implemented with verified security/aggregation behavior; it is
not fully accepted until the privacy policy/projection review and applicable
browser/independent security review finish. No approval, provider result or real
institutional data access was invented.
