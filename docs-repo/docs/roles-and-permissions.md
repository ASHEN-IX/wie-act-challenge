# Roles, membership and permissions

**CURRENT** describes checked source; **TARGET** is proposed behavior; **PLANNED** means no implementation claim. See [product](product-specification.md), [data model](data-model.md) and ED-02/ED-04 in the [backlog](sprint-backlog.md).

## CURRENT enforcement

`study-partner-api/modules/auth/src/models/User.ts` and `shared/auth.ts` define global `student` and `admin`. Better Auth resolves a Mongo session and domain user; `SessionGuard` authenticates, then domain handlers/tier policy apply. Admin/internal checks grant some privileged operations. AI operations enforce actor/resource ownership through `shared/operationPolicy.ts`. Paid/trial tiers affect access and expiry; independent signup is not unrestricted free AI access.

The frontend `src/utils/permissions.ts` includes `teacher`, but neither its presence nor a visible screen implements an instructor role. Course routes generally use `{_id, userId}`; no Institution, InstitutionMembership or CourseEnrollment model was found. Team membership grants session participation, not a defined license to another user's course. Session-chat/voice HTTP handlers need explicit resource checks; static upload routes and team creation course lookup need isolation tests. Do not claim all retained legacy paths satisfy the TARGET matrix.

## TARGET responsibilities

- **Platform administrator:** operate service, manage synthetic demo setup and resolve incidents. No automatic right to read private learning conversations/materials; exceptional support access would need a separately approved, audited policy. Existing global admin powers need review before this boundary is claimed.
- **University administrator:** establish institution, invite instructors and manage course enrollment/access metadata. Cannot approve AI correctness, inspect private room content or read personal libraries.
- **Instructor:** own assigned institutional courses, define objectives, upload/review/publish official materials, manage course invitations, optionally see privacy-preserving aggregate insight. Cannot silently republish learner files or inspect private questions.
- **University student:** access enrolled published courses, use own personal courses, participate in authorized private rooms, obtain private assessment/next steps.
- **Independent learner:** own private courses/resources and use individual/group learning without an institution. Official course access requires membership/enrollment. Student and independent learner are contexts of one learner account, not separate global roles/apps.

## TARGET permission matrix (all institutional columns PLANNED)

| Action / scope | Platform admin | University admin | Instructor | University student | Independent learner |
|---|---|---|---|---|---|
| Operate platform / demo fixtures | Yes | No | No | No | No |
| Manage institution membership | Explicit setup only | Own institution | No | No | No |
| Create official course | Demo setup only | Assign owner | Assigned institution | No | No |
| Edit objectives / publish official content | No by default | No by default | Owned course | No | No |
| Manage enrollment | Setup only | Own institution | Owned course if delegated | Accept invitation | Accept invitation |
| Read official course material | Explicit access only | Metadata only | Assigned course | Enrolled + published | Only if separately enrolled |
| Create/upload personal courses | Not core | Optional learner context | Optional learner context | Own | Own |
| Use tutor / own assessment | Optional learner context | Optional learner context | Preview or learner context | Own | Own |
| Start/join room | Explicit participant context | No default access | Explicit participant context | Authorized sources + room invite | Explicitly shared personal sources + room invite |
| Share personal resource to room | Own only | Own only | Own only | Own, explicit action | Own, explicit action |
| Share official material | No bypass | No bypass | Only authorized course participants | Enrolled room participants only | Cannot bypass enrollment |
| View course aggregates | Operational metadata only | Suppressed aggregates if enabled | Owned course aggregates if enabled | No | No |
| Read other's private uploads/questions/results | No default access | No | No | No | No |

Membership belongs to an institution and can have an institution role; course ownership is separate. A learner can have multiple memberships, personal courses and rooms. Invite codes are scoped, expirable capabilities; they cannot promote a learner to instructor or grant official-source access without enrollment. The room participant set and allowed-source set are both checked at retrieval, download, join, message and result-delivery boundaries. Revocation must close/restrict existing streams and invalidate scoped cached content.

Official means instructor-approved source document, not automatic endorsement of generated text. Personal is private by default; room-shared means a deliberate grant to a named room, never publication to an institution or the public. Individual check outcomes stay recipient-only; group recaps contain no private questions or identifiable diagnostic profiles. Proposed support/retention policy and aggregation thresholds remain team decisions.

## v1.2 role capabilities — TARGET / TODO

Institution/university membership and current student/admin limitations above are unchanged. None of these rights is implemented by merely adding a frontend control.

| Capability | Platform administrator | University administrator | Assigned instructor | University student | Independent learner |
|---|---|---|---|---|---|
| Review platform health/abuse metadata | Yes, operational | Own permitted metadata | Own permitted metadata | Own status | Own status |
| Assign course instructor/enrollment | Explicit setup only | Own institution | Delegated owned course only | Accept learner invitation | Accept invitation if eligible |
| Edit extracted official section hierarchy/objectives | No default | Assign owner only | Own assigned course draft | No | No |
| Configure/review/approve official activity/rubric | No default | No default | Assigned course draft | No | No |
| Publish approved revision / create replacement draft | No default | No default | Assigned course | No | No |
| Digitize/edit personal course | Explicit learner context | Explicit learner context | Own personal context | Own | Own |
| Open published trusted quiz/guided problem | Explicit authorized learner/preview | No blanket access | Authorized preview | Enrolled + published | Own/shared personal; official only if enrolled |
| Change shared activity presenter view | Only if participant/controller | No default | Only explicit participant/controller | Room-selected presenter | Room-selected presenter |
| Submit/check private activity answer | Own authorized attempt | No default | Own preview/learner attempt | Own | Own |
| Request own XP/achievement history | Own learner context | Own learner context | Own learner context | Own | Own |
| Award XP or approve own evidence from browser | No | No | No | No | No |
| Inspect learner private answers/help/reward evidence | No default | No | No default; aggregates only | Own only | Own only |

Only trusted server processing can accept evidence and derive rewards from the approved policy; admin/internal legacy endpoints are not a public activity-award API. Instructor preview may reveal instructor-owned answer keys only after authorization; learner/public activity projection must not include them. A correct public contribution is not permission to expose another student's private check. Official active revision cannot be edited in place by the room presenter. Personal editing uses the same Studio/activity engine with private ownership, never an official-publication privilege.
