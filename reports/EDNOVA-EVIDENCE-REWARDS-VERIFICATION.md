# Evidence-based rewards — 27 October 2026 final mission

ED-33/34 now use the existing Gamification XP balance and level formula
`floor(totalXp / 100) + 1`. Historical balances and legacy social/task products
remain intact. **New arbitrary legacy XP grants are denied with HTTP 409
`LEARNING_EVIDENCE_REQUIRED`, including privileged custom XP amounts.** The final
mission explicitly requires personal verified evidence for every new XP award;
this supersedes the earlier compatibility plan to retain unverified grant rules.
Existing product operations must tolerate denied optional rewards; they do not
become accepted learning evidence.

The provisional server policy `learning-v1` awards 20 motivational XP for a
verified personal check, up to 300 XP per canonical course topic and UTC evidence
day. Logical completion identity binds learner, exact course/source/activity
revision and objective; another attempt or transport ID cannot farm the same
completion. Award eligibility requires an existing accepted evidence record,
completed matching graded receipt, correct/mastered result, reviewed immutable
activity pin, matching rubric and current source authorization. `MOCK_TEST` never
earns XP; model-graded evidence requires `REAL_APPROVED`. Synthetic deterministic
records in tests exercise this policy without implying real inference or human
educational acceptance.

An atomic compare-and-swap updates balance, application marker and achievement
eligibility together inside the existing Gamification document. The separate
`learning_reward_ledger` is a recoverable audit mirror: inserting a pending
claim never suppresses a missing profile update. A replay after profile apply
finds the retained marker, repairs the ledger and does not increment again.
Legacy document saves now use optimistic concurrency to avoid overwriting an
atomic evidence award with an outdated balance. Markers are never silently
pruned; the writer fails closed at 10,000 compact markers per profile. A scalable
archival protocol remains future work before exceeding that documented limit.

Three uniquely identified motivational badges recognize the first verified
check, five distinct verified checks and a verified personal check in a study
room. Group presence alone earns nothing. Caps do not erase valid learning
results. Badge identity is retained atomically, and repeat processing cannot
unlock it twice. None of these outcomes proves academic mastery.

The private `/api/v1/users/learning-rewards` projection supplies total/learning/
legacy XP, correct level progress, pending repairs, badges and the 50 most recent
award reasons. GET is a pure read. POST `/evidence/:evidenceId` accepts only an
owned evidence ID and an empty body; no browser grade, actor or amount is used.
The Progress page renders this server projection and an explicit pending-retry
action. Quiet static feedback creates no duplicate toast on refresh; badges and
award rows use stable identities. Answers, rubrics and source content are omitted.

## Scoped checks

- Real isolated Mongo suite: `pnpm --filter api exec tsx --tsconfig tsconfig.json --test tests/integration/ed33-learning-rewards.node.test.ts`.
- Web projection tests: `pnpm --filter web exec vitest run src/features/rewards/reward-summary.test.tsx`.
- API/web strict types and scoped ESLint run separately.

[Evidence directory](evidence/ednova-final-20261027/rewards/). The real Mongo suite
covers concurrent retries/new attempt IDs, claim/apply interruption, a fresh
process replay, profile/ledger consistency, topic cap shared by different
objectives, three unique milestones, retained legacy balance, private HTTP reads,
forged actor/value denial, no write on refresh, mock/failed/revoked rejection and
new unverified legacy award denial. New process recovery uses a real helper
file: this installation's `tsx --tsconfig ... --eval` silently executed no eval
body in the initial test attempt. Failed logs are retained; assertions were not
weakened.

The UI projection suite covers empty/accepted/pending states, solo/group reasons,
correct progress, repeated rendering without duplicate celebration and explicit
separation from academic mastery. It is not browser evidence. Root integration
owns the accepted-evidence hook and generated route/controller registration;
actual authenticated Nest and end-to-end assessment-to-award browser verification
must be recorded by the integration milestone. No formal owner approval or
production readiness is inferred. ED-33's local protocol is verified within the
bounded fixture scope; ED-34 full browser acceptance remains open here.

## Integrated continuation

The actual reviewed deterministic grading path now awards through the normal
attempt hook, not a manually fabricated assessment-result fixture. A contract
mismatch initially required `masteryAchieved` on AssessmentResult (that field
belongs to accepted evidence); the gate now validates the completed graded
receipt, correct score and matching evidence identity instead. The current
11-node real-Mongo suite passes in `rewards-quest-verified.log`, including that
hook, retry deduplication and a separate legacy quest bypass regression.

A remaining legacy quest-completion handler awarded XP directly. It now preserves
quest bookkeeping with zero awarded XP and an explicit evidence-required policy.
No existing balance, quest record, commercial/social feature or stored award was
removed. New arbitrary action grants are rejected; historic balance is labeled
separately in the progress UI. Browser award/notification acceptance remains open;
MOCK_TEST evidence is never relabeled to make that test pass.
