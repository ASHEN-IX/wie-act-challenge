# Noveris demo kit

Scripted, reproducible product demo. Real browser sessions are driven with Playwright, captured
frame by frame through the Chrome DevTools screencast, and edited with FFmpeg into:

| File | Use |
| --- | --- |
| `output/noveris-demo-master.mp4` | full walkthrough with chapter cards (learner, peers, instructor) |
| `output/noveris-demo-90s.mp4` | competition cut, at most 90 s (EdNova final-phase limit) |

Everything runs on an **isolated stack** (database `noveris_demo`, ports 3100 / 3101 / 8100), so it never
touches your normal dev servers or data. All accounts and course content are synthetic. Model calls are real
when `apps/ai/.env` has a provider key; they go through the same bounded approvals as the product.

```text
demo/
├── README.md         this file
├── SCRIPT.md         storyline and voice-over for both cuts
├── storyboard.mjs    what each cut keeps: scene order, chapter cards, sections, pacing
├── record.mjs        records scenes → output/takes/<scene>/ (frames + timeline)
├── edit.mjs          takes → paced, captioned, titled videos in output/
├── scenes/           one script per journey: learner.mjs, room.mjs (two users), instructor.mjs
├── lib/              app.mjs (browser, cursor, login), recorder.mjs (screencast + timeline),
│                     clip.mjs (frames → 1080p clip), cards.mjs (title/chapter/caption artwork),
│                     serve-web.cjs (production web server)
├── cohort.mjs        gives the synthetic class real practice so instructor insights have data
├── env.sh            isolated ports, database, synthetic class size (no secrets)
├── approvals.py      bounded, short-lived AI approvals for the demo
├── setup.sh          builds API + web for the demo ports, creates the database
├── start.sh / stop.sh / web-server.sh   run and stop only the demo stack
└── reset.sh          clean slate: fresh DB → seed → class practice → new approvals
```

## Make the videos

```bash
bash demo/setup.sh       # first time, or after code changes: builds API and web, creates the database
bash demo/reset.sh       # before every full take (≈ 2 min)
node demo/record.mjs     # all scenes in order (≈ 12 min, includes rate-limit cooldowns)
node demo/edit.mjs       # → output/noveris-demo-master.mp4 and output/noveris-demo-90s.mp4
```

- Re-record one scene: `node demo/record.mjs room` (a failing step saves screenshots in
  `output/takes/<scene>/checks/`). Run `reset.sh` first when re-recording `reader`: its tutor approval allows
  one request, which is what makes the *usage limit → labelled fallback* moment happen on cue.
- Re-edit only: `node demo/edit.mjs short` or `node demo/edit.mjs master`. Change pacing, kept sections or
  card text in `storyboard.mjs`; captions are written next to the action in `scenes/*.mjs`.
- `DEMO_COOLDOWN=0 node demo/record.mjs …` skips the pause between scenes (the API allows 100 requests per
  user per minute, so back-to-back scenes can hit it).

## How it works

1. **Capture.** Each user gets an isolated browser profile (1280×720 at 1.5× → 1080p; two-user scenes use
   1024×900 panes). A visible cursor with click ripples is injected, moves glide on eased paths, and the page
   is captured as JPEG frames with wall-clock timestamps (`lib/recorder.mjs`).
2. **Timeline.** While acting, a scene logs `section`, `speed` and `caption` events on the same clock
   (e.g. waiting for a model runs at 3×, typing at 2×).
3. **Edit.** `edit.mjs` rebuilds each scene as a constant-frame-rate clip (two-user scenes side by side),
   cuts it into pieces at the timeline events, applies each piece's speed, overlays its caption, adds
   title, chapter and closing cards, and concatenates everything.

## What the seed provides

Password for every account: `EdNovaDemo!2026`.

| Account | Role |
| --- | --- |
| `learner@ednova.test` (Tasnim) | learner, main character |
| `peer@ednova.test` (Aziz) | learner, second browser in Study Together |
| `instructor@ednova.test` | instructor of *Relational Database Design & Normalization* |
| `class01…class12@ednova.test` | synthetic class (`DEMO_COHORT_SIZE`); `cohort.mjs` has six of them complete the quiz |

Instructor insights only show counts when at least 5 learners are on each side of a figure
(`EDNOVA_ANALYTICS_MIN_COHORT=5` in `env.sh`), which is why the synthetic class exists.

## Scenes

| Scene | Shows |
| --- | --- |
| `landing` | landing page → sign-in → learner dashboard |
| `onboarding` | goals, level, language and preferred formats |
| `reader` | Deep Focus, *Explain simply* (compact model, progress while waiting, checked sources), *Another example* hitting the usage limit → labelled built-in guidance, lesson completion |
| `practice` | wrong first attempt → private feedback, six-question hint-style probe, style-aware source hint, correct retry |
| `nardouch` | question in Darija (Arabizi) → capable-model answer grounded in the course |
| `lab` | Visual Lab built from the course: the model proposes, trusted code computes |
| `room` | two real sessions side by side: invite code, presence, chat sync, shared whiteboard, AI facilitator (peer-first), private attempts, debrief |
| `progress` | XP and evidence from accepted practice |
| `instructor` | teaching workspace, Course Studio, privacy-thresholded insights, upload flow |

Never show `.env` files, keys or terminals with credentials while recording.
