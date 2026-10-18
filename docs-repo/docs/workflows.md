# End-to-end workflows

All journeys describe TARGET behavior. Each step is marked **CURRENT** (source exists; execution limits apply), **PARTIAL** (reusable path needs adaptation) or **PLANNED** (missing). Current source presence does not mean a workflow passed. See [features](product-specification.md), [permissions](roles-and-permissions.md), [tasks](sprint-backlog.md) and [actual results](../../audit/2026-10-18/VALIDATION.md).

## W01 — University onboarding

Actor: University administrator / platform operator. Dependencies: F01–F02; ED-04.

1. **CURRENT:** Create/verify an existing account using Better Auth; only global student/admin exists.
2. **PLANNED:** Create one synthetic institution and assign scoped administrator membership.
3. **PLANNED:** Invite a synthetic instructor; accept scoped assignment without granting global admin.
4. **PLANNED:** Open institution course list and enrollment metadata, without access to personal libraries.

Acceptance and recovery: Habib scoped admin can provision the demo institution; another institution is denied. Invalid/expired invitation is recoverable and cannot elevate a global role.

## W02 — Instructor creates and publishes course

Actor: Instructor. Dependencies: F02–F03; ED-05, ED-06.

1. **PLANNED:** Enter owned institution and create draft course with 1–3 objectives.
2. **PARTIAL:** Reuse validated course upload, extraction job and progress; current Course is personal.
3. **PLANNED:** Preview extracted sections and review official source/objectives.
4. **PLANNED:** Publish a stable approved version; keep generated interpretation distinct.
5. **PLANNED:** Issue course invitation tied to enrollment; enrolled learners see the published material.

Acceptance and recovery: Unauthorized instructor cannot publish; failed extraction preserves previous publication; source links resolve only for permitted users.

## W03 — Student joins institutional course

Actor: University student. Dependencies: F01–F03; ED-04, ED-05.

1. **CURRENT:** Authenticate as a learner.
2. **PLANNED:** Accept institution/course invitation with intended learner role.
3. **PLANNED:** Validate institution membership, course enrollment and publication before listing sources.
4. **PARTIAL:** Open course/topics through reused course UI; current owner-only course route needs membership adaptation.
5. **PLANNED:** Start learning with explicit official-source provenance.

Acceptance and recovery: Guessed/expired codes fail without revealing course content; unenrolled users cannot obtain sources through room invitation or AI retrieval.

## W04 — Independent learner uploads a course

Actor: Independent learner, also university learner in personal context. Dependencies: F04; ED-02, ED-06.

1. **CURRENT:** Sign in without institutional enrollment and create a personal subject.
2. **CURRENT:** Upload PDF/text to a personal course; existing entitlement gates apply.
3. **CURRENT:** Validated files stage to a course directory; job/progress/results update course status.
4. **PARTIAL:** Browse extracted topics and invoke existing planning/evaluation; challenge-safe tutor integration missing.
5. **PLANNED:** Choose specific material to share with a private room; default library stays private.

Acceptance and recovery: Owner can retrieve safe content; parser failure is visible/retryable; private material is denied through all alternate endpoints and shared only by explicit grant.

## W05 — Independent learner studies an open topic

Actor: Independent learner. Dependencies: F05; ED-21.

1. **PARTIAL:** Enter a free-text goal; current planner/search/manual course supports parts of this input.
2. **PLANNED:** Create coherent learning context without file/institution and label baseline as AI-generated.
3. **PLANNED:** Offer provisional diagnostic and validated generated exercise.
4. **PLANNED:** Provide hint/feedback and next step without invented official citations.

Acceptance and recovery: No upload/institution prerequisite; absent grounding is disclosed. This is P2, not a hackathon commitment.

## W06 — Individual tutoring and assessment

Actor: Either learner context. Dependencies: F06–F08; ED-08, ED-10, ED-11.

1. **PARTIAL:** Select allowed course/objective and resolve usable source context; retrieval components exist.
2. **PLANNED:** Answer 2–4 starting questions and select adjustable language/detail preference.
3. **PARTIAL:** Use Socratic evaluator question/hint flow; course-aware tutor linkage is incomplete.
4. **CURRENT:** Evaluator worker can persist results and feed competency processing; baseline updater tests fail.
5. **PLANNED:** Present a tentative outcome and concrete private next step linked to observed checks.

Acceptance and recovery: Learner sees sources and hints, can request full explanation, and receives evidence-limited feedback; no unsupported mastery certification.

## W07 — Student creates collaborative room

Actor: University or independent learner. Dependencies: F09, F11; ED-02, ED-07.

1. **CURRENT:** Create a team session with invite code and up to four participants.
2. **PLANNED:** Authorize selected official or explicitly shared personal materials for every participant.
3. **PARTIAL:** Select common objective/problem from existing taskProgress; shared exercise/page state missing.
4. **CURRENT:** Invite peers to join via code and establish member-checked realtime connection.
5. **PLANNED:** Run synchronized peer text/resource/phase view with replay-safe reconnect.

Acceptance and recovery: Two browsers converge on participant/activity/exercise state in P0 (PDF page-following is P1); room invitation never bypasses course/source permissions.

## W08 — Voice-enabled group learning

Actor: Room participants. Dependencies: F10; ED-17.

1. **PLANNED:** Confirm organizer-permitted voice scope; display media notice and request microphone consent.
2. **CURRENT:** Use existing WebRTC peer connections with WS signaling; public STUN is configured.
3. **PARTIAL:** Join/mute/speaking state exists; verify real audio between browsers and NAT reliability.
4. **PLANNED:** Recover from denial/reconnect/device change and keep text usable.
5. **PARTIAL:** Leave closes tracks/connections; test AI outage does not interrupt audio. No default recording/transcription.

Acceptance and recovery: Three browsers exchange intelligible audio independently of AI; refusal leaves text usable. P1 is conditional on rules and reliability.

## W09 — AI facilitates collaborative exercise

Actor: Room participants and facilitator. Dependencies: F11–F12, F14; ED-09, ED-10, ED-12.

1. **PLANNED:** Initialize check-in/shared challenge and select Socratic or Group Challenge preset.
2. **PLANNED:** Accept peer reasoning as public contribution, not an automatic answer request.
3. **PLANNED:** On explicit checkpoint, ask another peer to justify/critique before giving solution.
4. **PARTIAL:** Reuse source retrieval/evaluator validation to verify candidate misconception; group integration absent.
5. **PLANNED:** Offer grounded graduated hint, optional quiet-participant invitation or unresolved status under limited capability.

Acceptance and recovery: Known synthetic misconception produces a pedagogically appropriate supported intervention; participant can decline; no always-listening claim.

## W10 — Private explanation within a room

Actor: Individual participant. Dependencies: F13; ED-18.

1. **PLANNED:** Select private help with a distinct visibility indicator.
2. **PARTIAL:** Reuse actor-scoped individual AI jobs; add room/source entitlement check and separate recipient scope.
3. **PLANNED:** Return simplified explanation only to requester, including on reconnect/history retrieval.
4. **PLANNED:** Share with group only if requester deliberately chooses a safe excerpt.

Acceptance and recovery: Other peers, admins and instructors receive neither private question nor answer through events, history, logs, summaries or caches. P1.

## W11 — Group assessment and session completion

Actor: All room participants. Dependencies: F15; ED-08, ED-11.

1. **PLANNED:** Finish shared exercise and offer recipient-only individual checks.
2. **PARTIAL:** Evaluate each answer with reusable evaluator/attempt/result pipeline.
3. **PLANNED:** Generate group recap of public observed outcomes and unresolved questions.
4. **PLANNED:** Produce private per-learner next step without exposing scores or asking private questions in public.
5. **CURRENT:** Existing session completion/rewards are reusable, but are not a pedagogical group completion contract.

Acceptance and recovery: Completion survives AI failure with safe stored activity outcome; retry does not double-complete/reward; group summary excludes private diagnostics.

## W12 — Personalized learning recommendations

Actor: Individual learner. Dependencies: F08, F15; ED-11.

1. **CURRENT:** Read existing evaluation/competency, plan, coach or review evidence for the same learner.
2. **PLANNED:** Summarize only observed checks; distinguish untested from incorrect.
3. **PLANNED:** Suggest one next objective/check/practice task matched to provisional level and preference.
4. **PARTIAL:** Reuse planner/review scheduling where helpful; no long-term mastery claim.
5. **PLANNED:** Let learner revise preference and retry; retain privacy and source provenance.

Acceptance and recovery: Different synthetic evidence yields different justified next actions; another learner cannot request those recommendations/profile.


## v1.2 amendments to W01–W12 (TARGET)

These replace conflicting step details while retaining stable workflow IDs. CURRENT/PARTIAL source claims above remain valid; no new implementation is asserted.

| Workflow | Added / changed steps | Acceptance / owner tasks |
|---|---|---|
| W01 university onboarding | Assign Studio author/course ownership; no access to learner private attempts or rewards evidence | Habib ED-04 access module; feature acceptance above applies |
| W02 instructor publication | PDF extraction proposes source-linked hierarchy -> instructor renames/reorders/corrects -> objective review -> quiz/problem preview -> reviewed immutable revision publication | Habib ED-05/06/30/31/32 full-stack Studio + extraction AI; Tasnim shared activity preview; feature acceptance above applies |
| W03 enrolled learner | Open published revision/section -> choose objective -> trusted activity rather than always a text essay | Habib course access; Tasnim ED-27/29 individual learning; feature acceptance above applies |
| W04 personal upload | Same digitization engine creates private editable hierarchy and activities without official university approval | Habib ED-06/30/31/32 private Studio and ingestion AI; feature acceptance above applies |
| W05 open topic | Generated labeled baseline selects trusted activity; no instructor-approved claim | Tasnim ED-21/27/28 full-stack open-topic learning; feature acceptance above applies |
| W06 tutor/assessment | AI selects validated InteractiveQuiz/GuidedProblem -> private step/input -> hint/feedback -> server-accepted evidence | Tasnim ED-08/27/28/29 full-stack tutor/activity/evaluator; feature acceptance above applies |
| W07 room creation | Launch same activity/revision from solo view -> authorized peers -> selected presenter controls view; P0 source pointer, full PDF-following P1 | Aziz ED-07 room module; Tasnim reusable activity and Habib source ACL; feature acceptance above applies |
| W08 voice | Independent optional audio remains P1; AI consumes typed/activity events only | Aziz ED-17 voice module; feature acceptance above applies |
| W09 facilitation | Group uses same guided problem, public reasoning and explicit AI checkpoint; individual preliminary/final answers remain private unless intentionally shared | Aziz ED-09 facilitator AI + room state; Tasnim shared private evaluator; feature acceptance above applies |
| W10 private explanation | Private help may simplify text or choose a private trusted activity; never change group's approved exercise | Aziz ED-18 private room help UI/API/AI; Tasnim shared learning interface; feature acceptance above applies |
| W11 completion | Each participant private check -> accepted evidence -> individual progress and safe group recap -> optional server-derived XP/achievement | Aziz ED-11 group orchestration; Tasnim ED-08/29 private checks/progress and ED-33/34 rewards; feature acceptance above applies |
| W12 recommendations | Next activity follows evidence/preference; XP/level feedback separate from subject evidence | Tasnim ED-08/11 learning subpackage + ED-27/28/29/33/34 individual next step/rewards; feature acceptance above applies |

One integrated acceptance journey covers W02 -> W03/W04 -> W06 -> W07 -> W09 -> W11 -> W12. P0 ends with verified private progress/debrief; P1 appends reward feedback, voice and one deterministic visualizer only after P0 is stable. The [team plan](team-delivery-plan.md) lists the exact interface order and file ownership so the same engine is implemented once.
