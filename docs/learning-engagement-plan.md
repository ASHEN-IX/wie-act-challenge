# Learning Engagement: Focus Mode, Onboarding, Whiteboard, Community

Branch: `feat/learning-engagement-experience` (cut from `main` @ 1e8afac). Nothing is committed yet.

Status labels: **Implemented** (code + automated tests), **Verified in browser** (driven manually in the in-app browser), **Partial**, **Deferred**.

| Area | Status |
|---|---|
| A. Focus Mode / Deep Focus (in-app) | Implemented, verified in browser (auto-start, away pause, reload recovery, emergency exit, auto end) |
| B. Adaptive onboarding + preferences | Implemented, verified in browser (persist, prefill, dashboard order, edit/reset) |
| C. Whiteboard (Excalidraw) in Study Together | Implemented + API/unit tests. **Not yet driven with two live users in a browser.** |
| D. Connections, room invites, study groups | Implemented + API tests; connections page renders. **Two-user flows not yet driven in a browser.** |
| Deep Focus extension (blocks other sites) | Implemented (`apps/extension/deep-focus`); service-worker logic tested against a mocked `chrome` API, **not yet loaded in a real browser** |

## A. Focus Mode
- `apps/web/src/features/focus/`. A pure, timestamp-based state machine (`focus-session.ts`) with `localStorage` recovery (`ednova:focus-session:v1`) and a floating "Focus" pill on learning routes only (`/courses/:id/learn`, `/study-together`, `/sessions`, `/practice`).
- Presets 25/45/60 + custom (5–180 min). The suggested length comes from the learner's stated session length.
- Pause/resume/end, fullscreen where supported, reduced chrome (`html[data-focus="on"]` hides the sidebar and header).
- Honest limits: the UI states that it "hides EdNova's own menus and keeps a timer. It cannot block other tabs or apps." Tab visibility is used only for a gentle notice, never as proof of attention.
- Recovery: if the page is closed while running, a stale heartbeat (> 2 min) turns the session into *paused*; time while the browser was closed is never counted.
- No XP, no mastery, no score. The end summary shows focused time, the objective and a link to Progress. The gaze-based `FocusSession` in `signal-processing` is untouched.

### Deep Focus (automatic)
- Starts by itself on `/courses/:id/learn` and inside a study room (`/study-together/:id`). No timer or activation step. Open-ended; a 3 h cap is only a safety limit.
- Counts only active time: hidden tab → paused immediately; 5 minutes without input → paused; resumes on return. Time while the browser was closed is never counted. Persists across refresh (`localStorage`); ends by itself when the learner leaves the study pages (sessions under 1 min are dropped, longer ones show the summary).
- Emergency exit: **Exit Deep Focus** in the bar (also via the extension). It is remembered for the browser tab session; the Focus pill offers "Turn Deep Focus back on". The manual timed session remains available from the pill.
- Learning features are untouched. Only EdNova's own sidebar and header are hidden, as before.
- Not stored on the server: sessions live in the browser only.

### What can and cannot be blocked
A web page cannot block other sites, tabs or apps. Best reliable in-page measures: counting only active time, a tab-title nudge ("Your study session is waiting") and a welcome-back notice. The optional MV3 extension (`apps/extension/deep-focus/README.md`) adds real blocking of other sites and covers other tabs in place (falling back to returning the learner to the study tab for pages Chrome won't let extensions touch), and fails open (heartbeat timeout, browser restart, three emergency exits). It does not block other apps, other browsers or incognito (unless allowed), and only works in Chromium.

## B. Onboarding and learning preferences
- One store: `UserProfile.learningProfile` (normalised by `apps/api/shared/ednova/learningProfile.ts`). The sign-up `onboardingDraft` is a one-time capture and is not read afterwards.
- API (user-profile): `GET/PUT/DELETE /api/v1/users/profile/learning`. PUT completes onboarding unless a status is given; DELETE resets to `skipped`.
- Web: `/onboarding` (short, skippable, resumable, keeps a safe `?next=`), full form in Settings, "Clear my preferences".
- Preferences are **stated**, not verified. `selfReportedLevel` is a starting point only; no learning-style claims.
- Adaptation: dashboard quick actions are reordered deterministically (no model call); Focus length is suggested; the tutor receives only closed hints (explanation language, step-by-step, examples, guided questions) through a strict `TutorStyle` model. Goals and subjects are never sent to the tutor.
- Privacy: the profile is readable and writable only by its owner.

## C. Whiteboard
- Library: `@excalidraw/excalidraw@0.18.1` (MIT), lazy-loaded client-only. Fonts are self-hosted in `apps/web/public/excalidraw-assets/` (re-copy on upgrade; the large CJK set is excluded).
- Model: `RoomWhiteboard` (one per room). Routes `GET/PUT /api/v1/study/rooms/:roomId/whiteboard`, behind `requireActiveRoom`.
- Sync: per-element merge, higher `version` wins, tie → lower `versionNonce`; compare-and-set on the board `version` with up to 4 retries, so concurrent edits do not overwrite each other. Element types are allow-listed; size limits 3000 elements / 200 KB per element / 4 MB per board / 500 per update; author is stamped server-side.
- Realtime: `ROOM_WHITEBOARD_SYNC` carries only `{roomId, version, locked}`; clients refetch through the authenticated route. Reconnect recovery refetches and reconciles; polling is used while disconnected. No AI is involved in sync.
- Permissions:

| Action | Who |
|---|---|
| Open / view | Participants of an **active** room |
| Edit | Participants, unless the board is locked |
| Lock / unlock | Room host |
| Export | Any viewer, client-side (Excalidraw) |
| Delete | "Clear board" by an editor (tombstones, confirmed); the board is purged 7 days after its last edit (TTL on `updatedAt`) |

## D. Community
- Connections use the existing `Friendship` model and `/api/v1/users/friends`. Hardening: pending-request cap (20, 429), block no longer removes the other user's block and rejects self-block, name search needs 3–50 characters and skips users with `privacy.allowRequests: 'nobody'`.
- Invite to a room: `POST /api/v1/users/friends/invite-to-room` (accepted connection required; limited to 10 per 10 minutes per user; the room is read as the caller, so only participants can invite). Delivered as a `team_invite` notification.
- Study groups: `/api/v1/users/groups` (`StudyGroup`), max 10 members/invites, 10 owned groups, atomic idempotent accept with capacity check, owner cannot leave, members see only that someone was invited. A group can attach a study-room session.
- Web: `/study-together/connections` (requests, search + friend code, connections, groups, blocked) and an invite panel in the room.
- A personal connection never grants access to a course, institution or someone's progress.
- No feed, likes, comments or public profiles.

## Known limitations
- Whiteboard: no live cursors and no participant legend (the author id is stored but not shown).
- Focus summary does not list completed activities or XP. Deep Focus sessions are not persisted server-side.
- Extension: allow-lists only `http://localhost:3000`; add the deployed origin to its manifest. Sign-in flows that redirect through another site (e.g. a third-party login) are blocked during a session; use the emergency exit.
- Group session codes live on the group document (12 h freshness). Rooms hold 6 participants while groups allow 10 members.
- The room-invite limiter is in-memory, so it is per API instance.
- The workspace layout now makes one extra profile call per page.
- Open decision: whether under-18 users should be discoverable through `/friends/search`.
- Not yet driven in a browser with two users: connection request/accept/block, group flows, whiteboard sync, lock, reconnect.
