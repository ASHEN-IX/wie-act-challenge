# Noveris roles and resource authorization

The account, institution, course and room scopes are independent authorization layers. The current source of truth for course access is `apps/api/modules/study/src/services/resourceAccess.ts`. Membership and enrollment services add operation-specific checks. The application does not derive every capability from a global role.

## Identity and scoped roles

| Layer | Records | Responsibility |
| --- | --- | --- |
| Global account | Better Auth records and domain User | Authentication, active account state and global student/admin role |
| Institution | InstitutionMembership | university_admin, instructor or university_student context in one institution |
| Course | Course owner, assignedInstructorIds, CourseEnrollment | Separate personal, teaching, administrative and student grants |
| Room | StudyRoom.participants, hostUserId, presenterUserId | Participant access and permitted control operations |
| Private result | StudentAttempt, LearningEvidence, owned lab and help records | Recipient-scoped access |

One account may hold multiple institution memberships and personal resources. Institution suspension affects institutional context without turning another user's private data into shared material.

## Course policy

`courseGrant` first attempts a scoped member grant, then checks explicitly public access. Institutional membership checks require an active institution and active membership. Older records are not automatically promoted into a grant.

| Context | Resolved role | Permitted boundary |
| --- | --- | --- |
| Personal Course.userId or ownerUserId matches actor | owner | Read, author, review, publish and manage personal course |
| Active instructor membership plus assignment | instructor | Read and manage content on the assigned institutional course |
| Active institution-admin membership | admin | Course administration and enrollment policy |
| Active student membership plus active CourseEnrollment | student | Read authorized institutional course material |
| Public course with active published revision | student | Signed-in read access; active institution also required if institutional |

`canReadCourse` accepts owner, instructor and student roles. `canAuthorCourse`, `canReviewCourse`, `canPublishCourse` and `canManageCourse` accept owner or instructor. `canAdministerCourse` accepts the institution-admin grant. `canManageEnrollments` accepts admin or instructor. Institution administration therefore has its own metadata/access purpose rather than a blanket content-read permission.

The public fallback is a read grant. It does not add an instructor assignment or CourseEnrollment. Public joins use separate records and do not populate institutional rosters.

## Institution and invitation operations

Platform-admin bootstrap creates an institution and its initial administrator. Active institution administrators manage metadata, issue instructor/student invitations and suspend supported memberships. Administrator membership changes require the explicit setup policy.

Institution invitation records retain a token hash and state. Acceptance claims a pending, unexpired invitation conditionally and completes membership for the claiming actor. A retry can recover the actor's incomplete acceptance. An unrelated actor cannot complete that claim. Recipient binding and email delivery rules must be evaluated separately from possession of the invitation token.

Course invitations are handled by the enrollment service and establish a course relationship. Instructor invitations require instructor eligibility in the same institution. Student enrollment requires the supported institutional student context. Assignment and enrollment do not create a second identity system.

## Room and private-data policy

A join code identifies a room. Active participant membership is required for protected room state and commands. A course-backed room additionally checks source access. Presenter and host authority control permitted room operations but do not grant editing of the active course revision or access to a peer's private attempt.

The debrief returns a shared recap and a recipient-specific private result. A learner who has not attempted the activity stays untested. Another learner's successful result cannot populate that recipient's score or evidence ID. Delayed model output is subject to current membership and room-state checks before acceptance.

## Subscription versus authorization

The proposed institutional capacity and individual Pro plans belong to the commercial entitlement layer. Purchasing capacity must not create a course assignment, enrollment or private-source grant by itself. Existing user tiers and provider approval budgets are implemented primitives. Customer-specific institutional entitlements and allowance allocation remain planned integration.

## Verification

Seventeen PostgreSQL institution and enrollment checks passed in the recorded audit. They cover scoped metadata, invitation acceptance, isolation, assignment, enrollment, withdrawal and revocation. Twelve public-access/visibility unit tests passed. The evidence dossier identifies these runs and their fixture scope. These checks are narrower than a complete institution onboarding browser acceptance run.

See [product architecture](product-specification.md) and [privacy and safety](security.md).
