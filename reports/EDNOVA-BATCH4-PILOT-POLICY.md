# EdNova Batch 4 RC — Controlled Internal Pilot Policy

**Version:** 1.0 (release-candidate)
**Date:** 2026-11-08
**Baseline commit:** `6dc3796`
**Owner:** release manager, operating under Batch 4 technical constraints
**Status:** operative only while every condition in §2 holds

---

## 1. What this pilot is

A **bounded, internal, non-production** pilot. A small group of authorised
staff use the enrolled-student reader and the authoring surfaces against
**approved canonical revisions**, with **AI plans served from the mock or from
previously accepted records only**.

It is not a beta, not a launch, and not a claim that anything has been proven
about learning.

---

## 2. Preconditions — all must hold, or the pilot does not run

| # | Condition | Why it exists |
|---|---|---|
| 1 | `EXPERIENCE_PLANNING_ENABLED` is **unset** in the pilot environment | The provider planning path is off. A pilot must not make live Gemini calls. |
| 2 | No Gemini or ElevenLabs API key is deployed to the pilot | Removing the capability is stronger than trusting a flag. |
| 3 | The revision under test is on the approved list (§4) and its `sourceManifest` is intact | Chapter identity and source provenance depend on the manifest. |
| 4 | Every displayed math block shows its review state | Unreviewed math must never read as certified content. |
| 5 | Mongo and the manifest store are both reachable | A manifest outage now fails an ingestion closed; the operator path is §7. |
| 6 | The pilot database is separate from any other environment | Retained learner data must be attributable and deletable. |

If any condition fails, the pilot is **suspended**, not degraded.

---

## 3. Authorised users

Named individuals only. No self-service enrolment, no open registration.

| Role | Permitted | Explicitly not permitted |
|---|---|---|
| Pilot learner | Read approved revisions; use mode selector; look at source evidence; record a recommendation as accepted/dismissed | Generate plans; publish; see other learners; see process metrics |
| Pilot instructor | Everything a learner can do, plus author draft revisions for the approved courses | Publish without the normal review gate; approve their own unreviewed math |
| Pilot operator | Read `/planning/metrics`; restart failed ingestions; suspend the pilot | Read learner-level data; bypass review; enable live providers |
| Everyone else | Nothing | Everything |

Accounts are removed at pilot close (§9).

---

## 4. Approved canonical revisions

A revision may be used in the pilot only when all of the following are true
and recorded in the pilot register:

- the revision is `published` and its manifest digest is recorded;
- its chapter and lesson counts were produced by the **source-aware** parser,
  not the legacy one (i.e. `ingest_parse_path` was the manifest branch);
- every math block carries a review decision, and unreviewed blocks are
  visibly labelled;
- the revision is on the written approved list, signed off by the pilot owner.

Any revision that was ingested during a manifest outage is **not approved**
until it has been re-ingested and re-verified (§7).

---

## 5. AI plans: mocked or already accepted

| Source | Allowed | Notes |
|---|---|---|
| Mock planner (`mock_experience_planner`) | Yes | Deterministic; used for reader-surface testing |
| Previously accepted plan records | Yes | Must still pass revalidation on read (§5.1) |
| Live Gemini | **No** | Not wired, not keyed, not authorised |
| Live ElevenLabs | **No** | Not wired, not keyed, not authorised |

### 5.1 Every read revalidates

A stored plan is untrusted until it passes the full read pipeline against
current records. If a review is revoked or an asset edited, the same record
fails and the reader falls back to the deterministic presentation. This is the
designed behaviour and a pilot tester must not treat a fallback as a bug.

---

## 6. Source-faithful treatment of unreviewed mathematics

Non-negotiable for the pilot:

1. Unreviewed math renders from the **source-faithful** path, never from a
   model transcription.
2. The reader keeps the "Automatic transcription is unverified" disclosure
   visible wherever transcription is used at all.
3. A block with no review decision is **never** presented as certified.
4. No pilot material may be described to a tester as verified mathematics.

---

## 7. Ingestion outage and operator recovery

### What happens automatically

A revision-bound ingestion that cannot obtain its manifest raises a terminal
error and is dead-lettered. It is **not** retried automatically, and it is
**never** handed to the legacy parser. The course stays unpublished.

### What an operator does

1. Confirm the storage/Mongo condition has cleared.
2. Confirm the revision's `sourceManifest` and each `storageRef` exist.
3. Re-submit the ingestion for that exact revision (a deliberate resubmission,
   which creates a new auditable attempt).
4. Verify the resulting artifact came from the source-aware parser:
   chapter count > 0 and lesson counts match the document.
5. Only then add the revision to the approved list.

**Do not** retry blindly, and do not promote a partially ingested revision.
There is no automatic replay by design: a replay could duplicate ingestion or
bypass review.

---

## 8. Privacy and data retention

| Item | Control |
|---|---|
| Learner identity | Pilot accounts only; no real student data |
| Learning evidence | Retained for the pilot period, then deleted with the accounts |
| Process metrics | Counters carry **no** course or learner identifier; operator-only |
| Plan records | Store `generatedBy`; no learner-visible cross-course data |
| Logs | No secrets; provider keys absent by construction |
| Export | Not offered during the pilot |

Retention: data deleted at pilot close, within the window stated in §9.

---

## 9. Logging, incidents, rollback

| Concern | Arrangement |
|---|---|
| Logging | Structured, identifier-bearing only in operational logs; no learner content in metrics |
| Incident contact | Pilot owner on call for the pilot duration |
| Suspend | Any §2 precondition failing suspends the pilot immediately |
| Rollback | Revert the pilot's data and unlist the approved revisions; no production state to undo |
| Close-out | Accounts removed, pilot DB dropped, approved list cleared, findings recorded |

---

## 10. Explicit exclusions

The pilot **does not** and **must not**:

- enable live Gemini or ElevenLabs inference;
- serve production traffic;
- claim any measured learning improvement — no comprehension, retention, or
  grade outcome has been measured, and none will be claimed from pilot use;
- present unverified mathematics as certified content;
- stand in for independent academic review;
- stand in for a security audit, load test, or disaster-recovery rehearsal.

---

## 11. What a successful pilot would and would not prove

**Would show:** the reader, review labels, mode selector, source evidence and
fallbacks behave as designed for real people on approved content.

**Would not show:** that the material is mathematically correct, that learners
learn more, that the live provider behaves, or that the system is
production-ready. Those remain the open categories in
`reports/EDNOVA-BATCH4-PILOT-READINESS.md` §8.
