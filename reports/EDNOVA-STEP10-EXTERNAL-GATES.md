# EDNOVA — STEP 10: ACTIONABLE EXTERNAL GATES & APPROVAL PACKAGE
## Formal Owner Decision Templates, Linked Contradiction Confirmations & Production Provider Credential Checklists

### Executive Notice
**Contract Version Candidate:** `1.0.0`  
**Registry State:** `EXTERNALLY_BLOCKED` pending explicit stakeholder authorizations.  
**Auditor Policy:** Strict zero-fabrication. In accordance with Section 1 and Section 2 of `docs/contracts/ednova-v1-approvals.md`, engineering recommendations are marked `PROPOSED`. Zero owner decisions, delegations, or signatures have been invented. All 19 owner decisions and 5 contradiction confirmations remain open for human stakeholder sign-off.

---

### PART 1: ED-26 OWNER DECISION PACKAGE (19 DECISIONS)

To freeze the v1.0.0 Technical Contract and unblock `ED-26` and dependent milestones, the named accountable owners (Habib, Tasnim, Aziz) must record their official decisions using the structured decision forms below.

#### Form 1: Habib (Curriculum, Revision Lifecycle & Ingestion Architecture)

```markdown
### Official Decision Record: Habib
- Target Version: 1.0.0
- Decision Date: [ YYYY-MM-DD ]
- Evidence Pointer: [ Link to dated PR / signed issue / meeting record ]

| Decision ID | Contract Area | Proposed Recommendation | Owner Decision [APPROVE / APPROVE_WITH_CONDITIONS / REQUEST_CHANGES] | Conditions / Clarifications |
|:---|:---|:---|:---:|:---|
| **H-1** | Revision Lifecycle (`draft \| published \| deprecated`) | APPROVE as written | [           ] | Keep persisted vocabulary; reviewStatus is metadata |
| **H-2** | Public Revision Identification (`Pin`) | APPROVE with wire/storage mapping | [           ] | Wire revisionId is immutable revisionTag; Mongo ObjectId is internal |
| **H-3** | FAISS Vector Store Artifacts (`SourceResolution`) | APPROVE WITH CONDITIONS | [           ] | Canonical path faiss/<courseId>/<revisionTag>.faiss; sidecar .meta.json |
| **H-4** | Future Grant Vocabulary (`personal_owner`, etc.) | APPROVE as written | [           ] | Model representation does not activate unverified grants |
| **H-5** | Revision Failure Semantics (`UNPUBLISHED`, etc.) | APPROVE as written | [           ] | Errors are resolution failures, not revision states; no silent advance |

Signature / Identity: ___________________________
```

---

#### Form 2: Tasnim (Learning Journey, Formative Assessment & Gamification)

```markdown
### Official Decision Record: Tasnim
- Target Version: 1.0.0
- Decision Date: [ YYYY-MM-DD ]
- Evidence Pointer: [ Link to dated PR / signed issue / meeting record ]

| Decision ID | Contract Area | Proposed Recommendation | Owner Decision [APPROVE / APPROVE_WITH_CONDITIONS / REQUEST_CHANGES] | Conditions / Clarifications |
|:---|:---|:---|:---:|:---|
| **T-1** | Attempt Identity (`PrivateAttempt`, `AssessmentResult`) | APPROVE actor-scoped identity | [           ] | Durable receipt identity is (userId, attemptId); compound index |
| **T-2** | P0 Activity Boundaries (`ActivityDefinition`) | APPROVE InteractiveQuiz & GuidedProblem | [           ] | Strict 2-type P0 boundary; unknown types fail closed |
| **T-3** | Formative Feedback (`socraticHint`, `nextStep`) | APPROVE WITH CONDITIONS | [           ] | Required-but-nullable; recommendedNextStep.type restricted to 'advance' |
| **T-4** | Attempt Lifecycle (`in_progress \| submitted \| graded`) | APPROVE lifecycle separation | [           ] | Persisted states separated from transport states |
| **T-5** | Mastery Evidence & XP Deduplication | APPROVE as written | [           ] | Explicit mastery; xp:${userId}:${evidenceId} idempotency key |

Signature / Identity: ___________________________
```

---

#### Form 3: Aziz (Realtime Collaboration, Study Rooms & LiveKit Moderation)

```markdown
### Official Decision Record: Aziz
- Target Version: 1.0.0
- Decision Date: [ YYYY-MM-DD ]
- Evidence Pointer: [ Link to dated PR / signed issue / meeting record ]

| Decision ID | Contract Area | Proposed Recommendation | Owner Decision [APPROVE / APPROVE_WITH_CONDITIONS / REQUEST_CHANGES] | Conditions / Clarifications |
|:---|:---|:---|:---:|:---|
| **A-1** | Nullable Source Pins (`RoomActivityState`) | APPROVE WITH CONDITIONS | [           ] | Invariant: activity != null => pin != null; source-free rooms have pin: null |
| **A-2** | Rejection Mapping (`ProposalDecision`) | APPROVE WITH CONDITIONS | [           ] | Closed mapping: rejected -> UNAUTHORIZED/UNPUBLISHED/REVOKED; stale -> STALE |
| **A-3** | Facilitator Boundary (`FacilitatorProposal`) | APPROVE candidate boundary | [           ] | Approve messageText; omit legacy targetSpeakerId/reasoning |
| **A-4** | Room Roster Bounds (`maxParticipants`) | APPROVE / CONFIRM bounds | [           ] | Ceiling is 10; default runtime room capacity remains 6 |
| **A-5** | Private Help Isolation (`PrivateHelpRequest`) | APPROVE private-help isolation | [           ] | Private help is recipient-only; binds userId and requestId |

Signature / Identity: ___________________________
```

---

#### Form 4: Joint Stakeholders (Habib, Tasnim, Aziz)

```markdown
### Official Joint Decision Record
- Target Version: 1.0.0
- Decision Date: [ YYYY-MM-DD ]
- Evidence Pointer: [ Link to dated joint sign-off ]

| Decision ID | Contract Area | Proposed Recommendation | Joint Decision [APPROVE / REQUEST_CHANGES] | Notes |
|:---|:---|:---|:---:|:---|
| **X-1** | Cross-Domain Versioning Policy | APPROVE fail-closed 1.0.0 | [           ] | Strict exact version matching; zero silent field stripping |
| **X-2** | Public / Private / Server-Only Boundaries | APPROVE security boundary | [           ] | Rubrics and answer keys never emitted in client DTOs |
| **X-3** | Contract Freeze Procedure | APPROVE freeze procedure | [           ] | Both TS/Python validators pass; SHA256 hashes recorded |
| **X-4** | M04 Milestone Consumption Gate | APPROVE gate enforcement | [           ] | M04 milestones consume contract only after official freeze |

Habib Signature: ___________________________
Tasnim Signature: __________________________
Aziz Signature: ____________________________
```

---

### PART 2: LINKED CONTRADICTION CONFIRMATIONS (5 CONFIRMATIONS)

| Contradiction ID | Area | Apparent Contradiction | Proposed Resolution | Stakeholder Confirmation [CONFIRM / REJECT] |
|:---|:---|:---|:---|:---:|
| **C-07** | Revision Vocabulary | `reviewStatus` vs `status` | `reviewStatus` (`unreviewed \| reviewed`) is draft metadata; `status` remains `draft \| published \| deprecated`. | [           ] |
| **C-09** | Retrieval Scope | Global FAISS vs Revision FAISS | FAISS indices must be revision-pinned (`faiss/<courseId>/<revisionId>.faiss`); no fallback to course root. | [           ] |
| **C-13** | Activity Types | Rich Visualizer vs P0 Scope | P0 runtime only accepts `InteractiveQuiz` and `GuidedProblem`; visualizers are deferred to P1. | [           ] |
| **C-14** | Facilitator Pin | Non-nullable pin vs Source-free room | Source-free rooms have `pin: null` and `activity: null`. Valid pin required only when course-backed. | [           ] |
| **C-15** | Proposal Code | Code `UNAVAILABLE` on status `rejected` | Closed mapping: `rejected` pairs with `UNAUTHORIZED`, `UNPUBLISHED`, `REVOKED`; `unavailable` is a separate status. | [           ] |

---

### PART 3: PRODUCTION PROVIDER CREDENTIAL & INFRASTRUCTURE CHECKLIST

Before promoting EdNova from **Local Staging Verified** to **Production Ready**, the DevOps and Security Leads must provision and verify the following external cloud infrastructure credentials.

```markdown
### Production Environment Credentials Checklist

#### 1. Real LLM Inference Provider
- [ ] Provider Selected: OpenAI [ ] Anthropic [ ] Google Gemini [ ]
- [ ] Production API Key Provisioned in Cloud Secret Manager / KMS:
  - Variable: `LLM_API_KEY` (or `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`)
- [ ] Dedicated Monthly Quota Budget Configured: $__________ / month
- [ ] Strict Spend Alert Thresholds Configured (50%, 80%, 100%)
- [ ] Durable Token Limiter Key Configured: `AI_BUDGET_REDIS_URL`

#### 2. LiveKit Production WebRTC SFU Cluster
- [ ] Dedicated LiveKit Server Deployed (LiveKit Cloud or Distributed Self-Hosted)
- [ ] Secure WebSocket URL Configured: `wss://livekit.<domain>.edu`
- [ ] API Key & Secret Provisioned in Secret Manager:
  - Variable: `LIVEKIT_URL`
  - Variable: `LIVEKIT_API_KEY`
  - Variable: `LIVEKIT_API_SECRET`
- [ ] TURN / STUN Infrastructure Configured (UDP 3478, TCP 5349, Coturn cluster)
- [ ] Firewall Rules Open: UDP ports 50000-60000 for WebRTC media packets

#### 3. Transactional Mail & Notification Provider
- [ ] Provider Selected: Resend [ ] SendGrid [ ] AWS SES [ ]
- [ ] Production Credentials Configured:
  - `SMTP_HOST`: ____________________
  - `SMTP_PORT`: 587 (TLS)
  - `SMTP_USER`: ____________________
  - `SMTP_PASSWORD`: [Stored in KMS]
  - `MAIL_FROM`: no-reply@<domain>.edu
- [ ] Domain DKIM, SPF, and DMARC Records Verified

#### 4. Persistent Database & Cache Clusters
- [ ] MongoDB Atlas / Managed Cluster (Replica Set with TLS 1.3):
  - `MONGODB_URI`: `mongodb+srv://<user>:<pwd>@<cluster>.mongodb.net/ednova_prod?replicaSet=rs0&tls=true`
- [ ] Redis Cluster / Managed ElastiCache (TLS + AUTH):
  - `REDIS_URL`: `rediss://:<token>@<cluster>.redis.cache.amazonaws.com:6379`
- [ ] RabbitMQ Clustered Message Broker (AMQPS with TLS):
  - `RABBITMQ_URI`: `amqps://<user>:<pwd>@<cluster>.rmq.cloudamqp.com/ednova_prod`

#### 5. S3-Compatible Object Storage
- [ ] Bucket Provisioned: `s3://ednova-production-storage`
- [ ] IAM Role with Least Privilege (Read/Write to `/uploads/` and `/faiss/` prefixes only)
- [ ] Object Versioning & Server-Side Encryption (KMS AES-256) Enabled
- [ ] Lifecycle Rule: Non-current versions archived after 90 days
```

---

### PART 4: SUMMARY & GATING CONCLUSION

Engineering completeness of the EdNova codebase has been brought to 100% of local executable scope. No further code modifications are required for these external gates.

Upon completion of:
1. Owner sign-offs on Forms 1–4,
2. Confirmation of Contradictions C-07..C-15, and
3. Provisioning of the production credential checklist,
the Technical Release Manager will execute `pnpm contract:freeze`, record the immutable SHA256 hashes, and promote `ED-26` to `VERIFIED_COMPLETE`.

