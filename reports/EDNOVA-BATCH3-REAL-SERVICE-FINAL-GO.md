# EdNova Batch 3 — Real-service final GO

Date: 2026-11-06. Baseline `f7895fc`.

**Final decision: GO for Batch 3 technical acceptance.**

The real-service gates that forced CONDITIONAL GO in Milestone 3.6 have now executed and passed. The isolated harness ran the mathematics reference course and the networking fixture end-to-end through real ingestion, and both journeys passed with a real browser on a clean exit (`PLAYWRIGHT_EXIT=0`, no teardown errors). The three publication integration suites that had been blocked on unreachable MongoDB/RabbitMQ now pass against the live stack.

Production deployment is **not** claimed and is assessed separately in §11.

---

## 1. Environment and service readiness

The Milestone 3.6 blocker was recorded as "Docker unavailable". That diagnosis was **wrong in its conclusion**, and the correction matters:

| Finding | Detail |
| --- | --- |
| Sandbox blocks unix sockets | `socket(AF_UNIX)` raises `PermissionError [Errno 1]`; TCP from the same sandbox also fails to loopback |
| Docker was never actually inaccessible | `docker --context default ps` works from the user's own shell |
| Active context pointed at a dead socket | `desktop-linux` → `~/.docker/desktop/docker.sock` (absent). `--context default` → `/var/run/docker.sock` (present, `nobody:nobody`, and the user is in gid 65534) |

Evidence: `reports/evidence/batch3/docker-diagnosis.txt`, `service-probe.txt`.

**No unsafe action was taken**: no `chmod` on the socket, no security control disabled, no unrelated host service modified. Unrelated containers (`guaudit-api`, `guaudit-postgres` and other projects' exited containers) were left untouched throughout.

### Services used

| Service | Version | Binding | Isolation |
| --- | --- | --- | --- |
| MongoDB | 7.0.43 | `127.0.0.1:27017` | fresh container, disposable; database `test_formula_final_*` dropped by owned teardown |
| RabbitMQ | 3-management | `127.0.0.1:5672` | the project's own compose container (`docker compose up -d rabbitmq`), credentials matching `.env`; per-run vhost `test_formula_final_*`, deleted afterwards |
| Redis | 7-alpine | `127.0.0.1:6379` | fresh container |
| Python QA service | 3.12.15 | `127.0.0.1:5362` | harness-run container, Gemini SDK replayed only |
| NestJS | built from `dist` with `tsx/cjs` (live source) | `127.0.0.1:5361` | in-process |
| Next.js | 16.4.1 | `localhost:5360` | dev server, isolated `.next-final-e2e` |
| Embeddings | all-MiniLM-L6-v2 | offline | host cache (88 MB) seeded into the AI container; no download |

Node 24.20.0, pnpm 11.3.0, Docker server 29.9.2 (API 1.56).

No connection to real user databases: the harness requires `FINAL_QA_DB` to match `^test_formula_final_\d+$` and drops it on exit.

---

## 2. Commands

```bash
bash scripts/qa-probe.sh                 # read-only environment probe
bash scripts/qa-stack-up.sh              # MongoDB, RabbitMQ, Redis
bash scripts/qa-ensure-stack.sh          # idempotent repair after daemon restart
bash scripts/qa-seed-hf.sh               # offline embedding cache into the AI image
bash scripts/qa-start-relay.sh           # container -> host loopback relay
bash scripts/qa-run-final.sh             # the real-service Playwright harness
bash scripts/qa-run-integration.sh       # the three publication integration suites
pnpm --filter web test                   # web unit tests
pnpm --filter api exec jest modules/study/src/tests --testPathIgnorePatterns integration
pnpm --filter web exec tsc --noEmit
pnpm --filter api exec tsc -p tsconfig.check.json
pnpm --filter web build
```

---

## 3. Real published revision identities

From `reports/evidence/batch2-final/application-run.json` (written by the passing run):

| Field | Value |
| --- | --- |
| Course | `6aee0503b257b2230e8ec465` |
| Revision | `rev_formula_6dff8de35d990245646ae90af4becff7` |
| Source hash | `sha256:ff83040269166027d02…` |
| Source pages | 20 |
| Chapters / lessons | 2 / 16 |
| Indexed chunks | 26 |
| Presentation schema | `1.0.0` |
| Math | 85 total — **2 reviewed, 83 source-faithful** |
| Verification status | `partially_reviewed` |
| Independent math approval | `false` |

A later run produced `rev_formula_510a8f8e154d29eb17346e54061e9288`; both are disposable QA revisions created by the run.

---

## 4. Test counts

| Gate | Result |
| --- | --- |
| Real-service Playwright (mathematics + networking) | **2 passed / 2**, `PLAYWRIGHT_EXIT=0`, 0 teardown errors (2.0 min) |
| Study publication integration suites | **3 suites, 19 tests passed** |
| API unit (non-integration) | **338 passed / 29 suites** |
| Web unit | **194 passed / 29 files** |
| Reader/contract regressions (V1/V2, canonical, presentation, asset) | **61 passed** |
| Web typecheck | pass |
| API typecheck | pass |
| API build | pass |
| Web production build | pass |

Total automated: **551 tests green** (338 + 194 + 19).

---

## 5. Structured-asset persistence and authorization

Executed inside the passing real-service journey, against the live revision, over real HTTP and real MongoDB. Full assertion block: `apps/web/e2e/final-acceptance.spec.ts`.

### Positive

| Check | Result |
| --- | --- |
| Instructor attaches a valid authored asset (POST) | 200 |
| Persisted in MongoDB under exact course/revision/asset binding | present, `createdByUserId` = the instructor |
| Same revision returns it on GET | 1 asset, `label` = "Instructor-authored material" |
| Enrolled student sees it in the actual reader | `[data-structured-asset]` visible, `data-asset-provenance="instructor_authored"` |
| Canonical content unchanged after the write | `contentDocumentHash` identical before/after |
| Static content remains without the asset | canonical blocks still render (asserted in the same page) |
| Historical revisions unaffected | per-revision binding; asset not returned for another revision |

### Negative

| Case | Result |
| --- | --- |
| Duplicate `assetId` | **409**, not silently replaced |
| Unauthenticated caller | 401/403 |
| Student (not course author) | **403**, and nothing persisted |
| Forged reviewer metadata on a non-reviewed status | **422** |
| `source_derived` without source references | **422** |
| Unreviewed `generated_proposal` | stored, then **never projected** to the learner (asserted absent from GET) |
| Oversized payload (500 annotations) | **422**, not truncated |
| Asset claiming a foreign `revisionId` | never persisted against the foreign id |

Review metadata and source-derived provenance are enforced **against the record itself**, not merely the request: `parseStructuredAsset` rejects a non-reviewed status carrying `reviewedBy`, requires review for `reviewed_supplemental`, and requires source references iff `source_derived`. On read, every stored asset is re-validated — the database is not a trust boundary.

---

## 6. Canonical immutability

| Check | Result |
| --- | --- |
| `contentDocumentHash` after a supplemental asset write | **unchanged** (asserted) |
| Canonical checksum tampered in the database | presentation **and** document endpoints both refuse (non-200) |
| Checksum restored | 200 again, no residue |
| Missing revision | refused (403/404/409/422/503), **no silent switch to another revision** |
| Unauthorized (outsider) presentation read | **403** |
| Source crop denied for an outsider | **403** |
| Source crop for the enrolled student | 200, PNG signature verified, width ≥ 210 |

No ingestion, detector, region identity or FAISS artifact was modified by this milestone.

---

## 7. Reader and source-inspection screenshots

In `reports/evidence/batch2-final/` (captured during this run):

- `student-desktop.png` — real course, lesson-scoped reader
- `student-mobile.png` — mobile layout
- `student-presentation.png` — the redesigned Batch 3 reader on the real published revision: 16 lessons in the outline, unreviewed mathematics in source-faithful fallback with its crop and the fixed disclosure
- `student-structured-asset.png` — the real reader with the lesson-scoped math disclosure
- `student-reviewed-formula.png` — reviewed formula typeset
- `student-source.png` — protected source inspection

The Batch 3 reader (`/present`) is what the journey asserts on, not only `/reader-preview` and not only the deterministic reader.

---

## 8. Performance with real assets

Measured on the actual presentation page against the protected crop route (`presentation-performance.json`):

| Metric | Value |
| --- | --- |
| Images on the lesson | 4 |
| Lazy-loaded | 3 |
| **With reserved aspect-ratio** | **4 / 4** |
| Broken images | **0** |
| Requested on open | 3 |
| Requested after full scroll | 3 |
| **Cumulative Layout Shift** | **0** |
| Mobile horizontal overflow (390 px) | none |

The aspect-ratio reservation added in Milestone 3.6 applies to **real crops**, and CLS on the live revision is 0.

---

## 9. Accessibility

Measured earlier against the preview contract (no axe installable: registry egress denied). Re-stated for this verdict, unchanged:

| Check | Result |
| --- | --- |
| Text contrast failures (143 samples, 3 scenarios) | **0**, worst 5.48:1 |
| Touch targets below 24 × 24 | **0** |
| Infinite animations under `prefers-reduced-motion` | **0** |
| Keyboard: modes, sliders, steppers, walkthrough, topology, Escape/focus restore | pass |

**Not tested**: screen-reader session, 200 % zoom/reflow, automated WCAG conformance. No certification is claimed.

---

## 10. Remaining Batch 2 mathematical review requirements

Unchanged and **not** satisfied by this milestone:

- Independent mathematical certification: **0 of 16 prepared cases adjudicated**; `independentMathApproval: false` in the run record.
- The presentation contract's strongest claim remains "instructor review", explicitly **not** independent verification, on 2 of 85 display formulas.
- Extraction fidelity remains separate from semantic correctness.
- Live Gemini provider calls were **not** made; only previously approved offline outputs were replayed.

---

## 11. Separate decisions

### Development acceptance — **GO (Batch 3)**

All mandatory gates pass:

| Gate | Class |
| --- | --- |
| Authenticated real-service journeys (math + networking) | **PASS** |
| Published presentation on the real route | **PASS** |
| Reader chapter/lesson navigation, modes, source inspection | **PASS** |
| Source integrity fails closed; no revision switch | **PASS** |
| Structured-asset authorization, persistence, provenance | **PASS** |
| Canonical immutability under supplemental writes | **PASS** |
| Publication/job/proposal integration regressions | **PASS** |
| V1/V2 compatibility, contracts, registry, plan | **PASS** |
| Typechecks and production builds | **PASS** |
| Real-asset CLS / lazy loading / reserved dimensions | **PASS** |
| Contrast, touch targets, reduced motion | **PASS** |
| Screen-reader session, zoom/reflow | **NOT TESTED** — no AT available |
| Production-build browser profiling / Lighthouse | **NOT TESTED** — no Chrome binary |
| Mathematical correctness | **BLOCKED** — Batch 2 upstream gate |

### Production readiness — **NOT CLAIMED**

No deploy, no load or capacity test, no rollback drill, no operational certification. That remains a separate, unstarted gate.

---

## 12. Defects found and fixed in this milestone

1. **Harness could not reach the host.** `final-acceptance-server.ts` rewrote every service to `host.docker.internal` but never passed `--add-host`, so the QA container could not resolve it. Added the mapping the compose file already declares. *(Real harness bug.)*
2. **QA services bound to loopback only.** Containers could not reach MongoDB/RabbitMQ. Resolved with a host-side relay on the bridge gateway — no change to existing services, no privileges beyond an ordinary port bind.
3. **The Batch 2 acceptance spec still targeted the removed `PresentationView`.** The redesigned reader did not expose `data-presentation-view`, `data-presentation-status`, `data-presentation-lesson` or `data-presentation-policy`. Restored those hooks and the exact user-facing strings the spec asserts ("Deterministic source-faithful reader", "Automatic transcription is unverified.") — **strengthening**, not weakening, since the assertions are unchanged.
4. **A KaTeX count assertion assumed all lessons on one page.** The lesson-scoped reader (required by Batch 3) shows one lesson at a time. Changed to assert every reviewed formula on the current lesson is typeset — same intent, correct for the redesign.
5. **RabbitMQ daemon corrupted by repeated restarts.** Symptom: every freshly created vhost was rejected at `Connection.OpenOk` (`AMQPInternalError`) even though the vhost, permissions, memory, disk and alarms all looked correct, while the pre-existing `mindflow` vhost worked. Isolated by testing the same fresh vhost with and without the relay and directly against the bridge gateway — all failed identically, so the relay was not the cause. Restoring the container from the **project's own compose definition** (`docker compose up -d rabbitmq`) fixed it; a fresh-vhost handshake then succeeded. A hand-built replacement container kept failing because its data volume held a root-owned `-r-------- root root .erlang.cookie` that the `rabbitmq` user (uid 999) cannot read.
6. **Teardown failed with `EACCES`** on root-owned FAISS index files written by the QA container. `fs.rm({force: true})` cannot clear a permission error. Teardown now falls back to removing them through a container, and the final run exits clean.

No production assertion was relaxed to obtain a pass.

---

## 13. Stop point

Batch 3 technical acceptance is **GO**. Batch 4 was not started. Nothing was deployed to production.
