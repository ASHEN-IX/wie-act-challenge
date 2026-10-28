# Requester-only room source help — 27 October 2026

Private room help now uses a dedicated authenticated endpoint and durable records
keyed by requester, room and request ID. The server derives the actor; a repeated
ID with a different question or source fails. An unavailable provider produces no
fabricated answer; an explicit same-ID retry can recover. A short claim lease
prevents simultaneous duplicate dispatch and permits retry after interruption.
Only successful validated tutor answers are retained as completed help.

The server checks active room membership, current course access, exact published
revision and original/index integrity before dispatch and again after delayed
execution. History uses the server requester filter and reauthorizes each read.
Peer and educator requests cannot select another learner's history. Source-free
rooms return explicit unavailable help without invoking inference. Neither public
room state, peer message history nor debrief reads this collection.

Requester availability events carry only room/request IDs and status, never the
question or answer. Delivery checks current requester session and room membership.
The browser panel displays private history and keeps uncertain request identity
for retry. It does not automatically share help. Explicit public sharing remains
a deliberate separate peer-chat action; no one-click private-response share UI is
claimed.

`private-help-delivery-current.log` records six real-Mongo nodes, including
provider outage/retry, conflicting identity, peer/educator/forged actor denial,
source-free behavior, revoked history and an actual delayed-call revocation test
that stores no tutor result. The provider outage/delay is an explicit fixture;
it does not establish provider quality or successful real inference. The expanded four-learner browser now passes successful requester help,empty
peer history,reload recovery and final revocation checks through real
Nest/Python/Next with explicitly mock inference. See `browser-paced-current.log`
and its10 asserted checkpoints.

Evidence lives under `reports/evidence/ednova-final-20261027/`. Initial fixture
failure omitted required room invite codes; the fixture was corrected without
weakening room validation. Full process-kill help recovery, all notification
socket paths, privacy retention/deletion policy and representative user review
remain open. ED-18 stays partial pending those acceptance gates.
