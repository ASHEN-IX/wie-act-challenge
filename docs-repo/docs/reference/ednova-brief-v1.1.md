# EdNova — Hackathon Product, Functional & Technical Brief

**Concept:** An AI-powered peer-learning companion for university students, accessible through universities and independently.  
**Challenge:** EdNova — *GenAI Peer Learning Companion*, IEEE Women in Engineering Annual Congress of Tunisia (WIE ACT 5.0).  
**Document type:** Self-contained challenge analysis + proposed solution + hackathon MVP specification.  
**Version:** 1.1 — 18 October 2026 (collaborative voice study rooms extension).  
**Status:** Working proposal for team discussion, not an approved organizer specification or a completed implementation.
**Change in v1.1:** Voice-enabled, shared-content Study Together rooms, AI facilitation modes, private help, phased implementation and realistic live-voice limitations.

> **How to read this document**
>
> - **[SPEC]** = stated in the official three-page EdNova challenge specification book.
> - **[PROPOSAL]** = our proposed product or technical design, **not** required by the organizers.
> - **[MVP]** = recommended for the hackathon prototype, subject to available time.
> - **[LATER]** = a possible future enhancement, **not** part of the hackathon commitment.
>
> The source is the supplied **`EdNova_Challenge_Specification_book.pdf`**, pages 1–3. Page references throughout refer to that document. The proposed university/B2B2C model is a **team product decision**, not an organizer requirement. Where the source is silent, this document explicitly labels the choice as a proposal.

---

## 1. Executive summary

### 1.1 The problem

Group learning can help students understand difficult subjects, but real study sessions are frequently unbalanced and poorly structured. Some people dominate discussion; others stay silent or are afraid to ask basic questions. Incorrect explanations can go unchallenged. Students have different levels of understanding, needs, languages and preferred explanation formats. A group may finish a session without knowing what anyone learned or what they should study next. **[SPEC, p. 1]**

### 1.2 Our proposed answer

**EdNova is an AI-assisted learning environment with two access paths and one shared learning experience:**

1. **University-managed learning (B2B2C):** A university or training institution makes approved course material available; instructors manage content; enrolled students use EdNova to learn individually or collaboratively.
2. **Independent learning (B2C access):** A student signs up without a partner university, uploads their own learning material or supplies a topic, learns individually, and can invite friends to a peer-learning session.

In both paths, an **AI learning companion** diagnoses understanding, offers progressive hints, supports short practice activities, and helps peers explain concepts to one another. The AI should **facilitate human learning, not replace human classmates or teachers**. **[PROPOSAL]**

### 1.3 What will differentiate the demo

The strongest live demonstration is **not** a generic chat interface or university dashboard. It is a **Study Together** room (with optional real-time voice and synchronized learning resources) in which:

- learners arrive with different understanding levels;
- the AI proposes a common challenge;
- one learner provides an incomplete or incorrect explanation;
- the AI first asks peers to reason about it, then intervenes with an evidence-grounded hint;
- a quiet participant is invited in without being embarrassed;
- the explanation adapts to language/level;
- each student gets a short understanding check and next step;
- the solution shows deliberate **compact-model vs capable-model routing** and a clear fallback when the capable model is unavailable.

This single flow covers the challenge's most distinctive learning and technical requirements. **[PROPOSAL]**

### 1.4 Hackathon boundary

**Build a working, coherent, demonstrable vertical slice**, not a full LMS or commercial SaaS. No payments, production-grade university procurement, advanced analytics warehouse, marketplace, sophisticated social network or heavy gamification are needed for the prototype. **[PROPOSAL]**

---

# Part I — Official challenge: what the organizers require

## 2. Challenge identity and core problem **[SPEC]**

**Challenge title:** *EdNova — GenAI Peer Learning Companion (Technical Challenge)*.  
**Event:** IEEE Women in Engineering Annual Congress of Tunisia — WIE ACT 5.0.  
**Source:** Specification book, page 1.

The challenge asks: **How can generative AI act as a mediator, teammate, tutor and facilitator to make learning more structured, inclusive, interactive, personalized and effective?**

The specification describes these problems:

- Unequal participation in learning groups.
- Hesitation to ask basic questions for fear of judgment.
- Acceptance of vague or incorrect peer explanations.
- Different learner levels and ways of processing information.
- A single explanation method failing to serve everyone.
- Sessions ending without clear learning outcomes.
- These issues arising across universities, schools, workshops, study groups, online communities, training and self-learning environments.

**Design consequence:** The AI must improve the **learning process** and the **interaction between people**, rather than only produce answers.

## 3. Functional objectives in the specification **[SPEC, p. 1]**

### 3.1 Smart peer-learning support

The specification describes an AI assistant that should support study sessions by:

- simplifying difficult concepts;
- asking guiding questions;
- offering hints before final answers;
- detecting confusion;
- suggesting the next learning step.

### 3.2 Education and accessible learning

The AI should support different levels, languages and ways of explaining. The specification discusses an initial **diagnostic phase** using short questions, exercises, previous responses and interaction patterns to tailor explanations and activities.

It gives examples such as:

- beginner-friendly explanations;
- step-by-step reasoning for difficult topics;
- practical, everyday examples;
- exercises adapted to the learner's level;
- explanation/activity preferences informed by the diagnostic;
- Arabic, Darija, French and English support.

**Important nuance:** The document suggests adaptation to learners' preferred methods; it does **not** prescribe a scientifically validated “visual/auditory learner type” classifier. Our design should ask for practical preferences and use demonstrated knowledge, without labeling users as fixed learning types. **[PROPOSAL]**

### 3.3 Open innovation

The organizers encourage work beyond a simple chatbot. They mention **possible extensions**, not universally mandatory features:

- gamified progress;
- automatic revision notes;
- teacher dashboard;
- voice interaction;
- collaborative quizzes;
- learning analytics.

### 3.4 Entrepreneurship angle

The submission must include a **short business-model note** addressing:

- target users;
- value proposition;
- adoption path;
- how the solution could be sustained after the hackathon.

**A live payment system is not required.** The business plan is a submission artifact, not the product's primary engineering objective.

## 4. Technical and operational constraints **[SPEC, p. 2]**

| Requirement / constraint | Meaning for the team |
|---|---|
| **Real inference service** | Build a working end-to-end application using the available operational model service. A mockup, notebook or isolated API call is not a complete submission. |
| **Two model categories** | Deliberately combine **compact/fast** models and **larger/more capable** models. Document which category handles which work and why. |
| **Compact model use** | Appropriate for classification, intent detection, extraction, formatting and short summaries. |
| **Capable model use** | Appropriate for complex reasoning, synthesis, planning and polished explanations. It is slower and less available. |
| **No model training** | Custom training and fine-tuning are not available. Intelligence must come from prompts, supplied context, model routing and application design. |
| **Latency is expected** | Inference may take several seconds, especially on larger models with no graphics accelerators. |
| **Non-streaming responses** | Responses arrive as a whole, not word-by-word; show useful waiting/progress states or staged feedback. |
| **Shared limited usage** | Prefer a few useful requests to unnecessary chains; avoid recomputing equivalent results. |
| **Graceful degradation** | When usage limits are reached or the larger category is unavailable, queue/retry as appropriate or fall back to the compact category and communicate what is happening. |
| **Document retrieval is allowed** | A searchable knowledge base / RAG is an optional technique to reduce context and improve relevance, not a required architecture. |

**Major judging opportunity:** Expose this engineering decision in the demo. Showing model-category selection, latency handling and fallback is stronger than merely describing it in the report. **[PROPOSAL]**

## 5. Evaluation, phases and deliverables **[SPEC, pp. 2–3]**

### 5.1 Phase 1 — Preselection

- **Deadline printed in the specification: 10 November.** The PDF does not explicitly state the year; confirm the exact year and submission time with the organizers.
- No oral presentation during this phase.
- Submit:
  1. a **technical report**, including the short business-model note;
  2. a **GitHub repository link**;
  3. a **demonstration or simulation** of the solution.
- Preselection is based on the submitted report, repo and demo/simulation.

### 5.2 Phase 2 — Final

- For selected teams only.
- Final presentation and a demonstration video, previous or updated.
- The final phase is described as **three days after Phase 1 selection**.
- **Presentation: maximum 4 minutes.**
- **Demo video: maximum 1 minute 30 seconds.**
- **Q&A: 2 minutes.**

### 5.3 GitHub repository content

The source requests:

- source code;
- setup instructions;
- README;
- screenshots where available;
- technical explanation of the GenAI component;
- example configuration **without** access credentials.

### 5.4 Technical report — maximum 6 pages

Must explain:

- project objective;
- system architecture;
- AI model or API used;
- RAG workflow **if implemented**;
- privacy and ethical safeguards;
- testing strategy and results;
- limited capacity / temporary unavailability handling where relevant;
- business-model note: users, value proposition, adoption and sustainability.

### 5.5 Video should demonstrate

- the primary problem or use case;
- key features;
- how users interact;
- the AI or relevant technology at work;
- output/results or user benefit;
- waiting/fallback behaviour if relevant.

### 5.6 Evaluation criteria

The rubric names **six qualitative criteria** and does not provide numeric weights:

1. **Innovation** — originality, creativity and value compared with existing solutions.
2. **Technical feasibility** — realism, prototype quality, clarity of implementation, efficient model combinations and limited-capacity behaviour.
3. **Relevance** — response to the main challenge and real user needs.
4. **Impact** — usefulness, accessibility and user benefits.
5. **Entrepreneurship & business viability** — realistic users, value, adoption and sustainability.
6. **Pitch and demo** — clarity, communication and demonstration quality.

### 5.7 Bonus opportunities

The specification highlights:

- **Real-user testing** with learners, students, teachers or training groups.
- **Multilingual support**, including Arabic, Darija, French and/or English interactions.

### 5.8 Team rules

- Maximum **3 people per team**.
- Pitch is to be delivered by **2 team members**.
- Having a member cover business/entrepreneurship in addition to technical roles is encouraged, **not required**.

## 6. Privacy, ethics and platform-use rules **[SPEC, p. 3]**

The specification explicitly states:

- Do not store sensitive personal data.
- Use anonymous or synthetic test data.
- Avoid collecting names, photographs, voices, addresses or other private information.
- Do not discriminate based on gender, region, language level or background.
- AI should support, not replace, teachers or mentors.
- Platform credentials are personal: do not share or expose them in source, logs, screenshots or videos.
- Do not bypass usage limits using extra accounts or replacement services during the demonstration.
- Additional external services may be used if **clearly declared**.
- Only public, fictional, synthetic or anonymized data may be sent to the provided AI service.
- Normal latency/occasional queuing are expected; persistent problems should be reported to the organizers.
- Teams retain ownership of their code and work.

**Implications for our design:** Use fictional universities, synthetic course rosters, pseudonymous learners and demo-safe materials. Never send real student names, institutional student records, private chats or real student performance profiles to the provided AI service. Avoid voice recording altogether for the MVP. Minimize retained chat and performance data, and make content sharing explicit. **[PROPOSAL]**

---

# Part II — Proposed EdNova product

## 7. Product positioning **[PROPOSAL]**

### 7.1 One-line pitch

> **EdNova helps university students understand difficult subjects, individually or with classmates, through AI-guided learning grounded in their course material.**

### 7.2 The central product principle

**Human understanding first. AI answers second.**

Unlike a generic Q&A chatbot, EdNova should choose among actions such as asking a peer to explain, asking a guiding question, presenting a hint, checking a misconception, simplifying a concept or recommending practice.

### 7.3 Who it is for

**Initial target user:** university students, especially those taking technically challenging courses such as mathematics, programming, algorithms, databases or physics.  
**Secondary users:** instructors and institutional administrators.  
**Independent audience:** learners whose institution does not participate.

This narrower target is a **hackathon scoping choice**. The official brief accepts a wider variety of learning environments.

### 7.4 What EdNova is not

For this challenge, it is **not** intended to become:

- a replacement for university LMS platforms;
- a registrar/grades/attendance system;
- a mandatory exam proctoring product;
- a generic course marketplace;
- a full campus social network;
- an autonomous tutor claiming to replace instructors;
- an unbounded multi-agent research system.

## 8. Access model: B2B2C + independent learning **[PROPOSAL]**

```text
                      +------------------------+
                      |        EdNova          |
                      | Shared AI Learning Core|
                      +------------+-----------+
                                   |
                  +----------------+----------------+
                  |                                 |
      UNIVERSITY / INSTITUTION                INDEPENDENT LEARNER
      (potential B2B2C route)                   (direct-access route)
                  |                                 |
        University workspace                    Personal workspace
                  |                                 |
      Instructor publishes course           Learner uploads a course
                  |                          or starts from a topic
      Student joins assigned course                  |
                  +----------------+----------------+
                                   |
                         Individual Study Mode
                         + Collaborative Rooms
                         + Progress / Next Steps
```

### 8.1 Institutional path

The institution is responsible for **selecting and approving official course content**. The instructor maintains materials, publishes them to a course and manages its learning objectives. EdNova uses the material as grounding for explanations and exercises. The institution is **not** responsible for automatically validating every AI-generated response; EdNova should cite sources, handle uncertainty and avoid false claims of instructor approval.

### 8.2 Independent path

Any learner can:

- create a private learning space;
- upload their own course documents;
- study by asking questions and solving exercises;
- create a private study room and invite friends;
- optionally start with only a topic, without an uploaded course (**time-permitting**).

No institutional contract, course enrollment or admin approval is needed for independent learning.

### 8.3 One learner identity, multiple memberships

A person may learn independently and also belong to one or more institutional courses. The same learning UI and core APIs should serve both contexts. Access and permissions depend on **workspace/course membership**, not separate copies of the application.

---

## 9. Roles and permissions **[PROPOSAL]**

### Role A — Institution administrator

**Purpose:** establish the institutional environment; **not** evaluate learning answers.

**MVP responsibilities:**

- manage one demo university workspace;
- invite / assign an instructor using a test invitation or seeded account;
- view available institutional courses and enrollment totals;
- optionally create a short student access code.

**Out of scope:** procurement, departments/program hierarchies, SSO/SAML, advanced RBAC administration, billing, organization-wide analytics, legal onboarding.

### Role B — Instructor / course owner

**Purpose:** provide trusted content and lightweight guidance.

**MVP responsibilities:**

- create or edit a course: title, subject, description;
- upload PDFs, slides-as-PDF or text notes;
- organize content under simple topics (manual or auto-suggested);
- specify 1–3 learning objectives;
- preview extracted content and publish it as **official course material**;
- generate or review simple practice questions;
- share a code/link so demo learners can join;
- see simple **aggregate**, privacy-preserving learning insights if time allows.

**Not authorized to:** inspect learners' personal files, read private rooms by default, silently republish student uploads, or treat AI-generated content as approved without review.

### Role C — University learner

**Purpose:** learn from institutional courses plus private personal materials.

**MVP responsibilities:**

- join a university course via invite/code;
- browse approved materials and topics;
- complete a quick understanding diagnostic;
- learn with a guided AI companion;
- ask questions grounded in institutional materials;
- solve adaptive practice questions and receive feedback;
- create or join private peer study rooms;
- see individual next steps and progress;
- maintain personal study content separately.

### Role D — Independent learner

**Purpose:** receive the learner experience without joining a university.

**MVP responsibilities:**

- use the platform without an institution;
- create private courses;
- upload materials;
- use the same tutor, practice, study room and progress features;
- invite other learners via private link/code;
- optionally start from a free-text learning objective if implemented.

**Engineering simplification:** C and D should share one `Learner` feature set. Institution membership grants access to official courses. They should **not** be two completely different frontend apps or global authorization roles.

### Role E — Platform operator (internal)

Only needed for demo setup, issue diagnosis and infrastructure oversight. No full platform-admin UI is necessary for the hackathon.

### 9.1 Simplified permission matrix

| Capability | Institution admin | Instructor | University learner | Independent learner |
|---|:---:|:---:|:---:|:---:|
| Manage institution/demo invitations | Yes | No | No | No |
| Create / publish official university course | Optional setup | Yes | No | No |
| Upload personal course | No | Optional | Yes | Yes |
| Access assigned official content | Administrative metadata only | Yes | Yes | No, unless granted access |
| AI-guided individual study | Not core | Optional preview | Yes | Yes |
| Adaptive exercises / own results | Not core | Optional preview | Yes | Yes |
| Create / join private peer rooms | No | Optional | Yes | Yes |
| View own progress | No | Optional preview | Yes | Yes |
| View aggregate course insight | Optional, aggregate | Yes, aggregate | No | No |
| Read another learner's private materials/chats | **No** | **No** | **No** | **No** |

---

## 10. Core user journeys **[PROPOSAL]**

### Journey A — Instructor publishes a university course

**Actor:** Instructor.  
**Goal:** turn a course document into usable learning context.

1. Open the institution workspace.
2. Create *Database Systems*.
3. Upload a **synthetic/demo-safe** chapter on normalization.
4. EdNova extracts the text, identifies sections and creates searchable chunks (if RAG is used).
5. Instructor reviews a preview, sets an objective: *Explain dependencies and normalize to 3NF*.
6. Instructor publishes the material and shares a course join code.
7. Demo students now access the same approved content.

**Success:** students can ask a question and receive an explanation with a reference to the correct document section. If extraction fails, the UI shows a recoverable error and the original publication remains unchanged.

### Journey B — University student learns individually

**Actor:** Student enrolled in *Database Systems*.  
**Goal:** understand normalization rather than memorize an answer.

1. Open the course and choose *3NF*.
2. Answer **2–4 quick diagnostic items** (concept or difficulty checks).
3. EdNova determines a **provisional** understanding level and asks the student's preferred language/amount of detail.
4. Student asks, *“Why is this schema not in 3NF?”*
5. AI offers a guiding question or hint first; the student can request a full explanation.
6. Student attempts a short exercise.
7. AI provides feedback tied to the learning objective and suggests the next action.

**Success:** the learner can say what they misunderstood, answer a related check, and access the source used by the AI. Two questions are **not** enough to claim a reliable long-term mastery score.

### Journey C — AI-facilitated peer learning (**flagship**) 

**Actors:** Three fictional students using anonymous aliases.  
**Goal:** solve one problem together in a structured session.

1. Student A creates a private room for *Database Systems / 3NF*.
2. B and C join with a code/link. Each chooses a pseudonymous display alias.
3. Everyone receives a brief check-in and one shared collaborative problem. The room shares a selected course document/page and supports text chat; optional voice lets peers converse naturally.
4. B gives an incomplete explanation.
5. The AI does **not** immediately reveal the correct answer. It asks A or C to examine B's reasoning.
6. If peers remain stuck or misinformation persists, the AI offers a grounded hint or explanation.
7. The AI invites a quieter participant to contribute in a respectful, optional manner.
8. Students complete a small individual understanding check.
9. The session ends with group learning outcomes and **private** individual next steps.

**Success:** demonstrate visible peer interaction and a well-timed AI facilitation intervention, not merely three people sending prompts to a shared chatbot.

### Journey D — Independent learner

1. Open EdNova as an independent learner.
2. Create *Algorithms — Sorting* and upload a sample course PDF.
3. Run a brief diagnostic, ask a question and solve one exercise.
4. Invite a friend to the same topic in a private room (explicit choice to share this room's material).
5. Keep personal documents private and view individual next steps.

**Optional stretch:** Start from a topic such as *“Learn SQL joins from scratch”* without an upload. Such material must be clearly marked **AI-generated / not university-approved**.

### Journey E — Large model unavailable

1. A room discussion requires complex explanation evaluation.
2. The normal escalation to the capable model is delayed or fails/rate-limited.
3. The interface shows a clear waiting status and then enters **limited-capability mode**.
4. The compact model/deterministic policy continues safe activities: prompting peers, using prevalidated exercises, retrieving stored passages and offering simple hints.
5. If the system **cannot verify** a complex explanation, it acknowledges that limitation and defers an authoritative answer rather than inventing one.
6. When capacity recovers, advanced reasoning resumes.

**Success:** the room does not freeze, the AI does not silently downgrade quality, and the status is transparent.

---

# Part III — Proposed functions and user experience

## 11. Functional modules **[PROPOSAL]**

### F01 — Access and workspace selection **[MVP]**

- Two clear entry paths: **Join university course** or **Study independently**.
- Pseudonymous demo identity/session; avoid collecting real personal information.
- A learner may switch between an official course and their private workspace.
- Invitation/join codes are scoped to a specific course or room.
- Clear labels: **Official course**, **My private course**, **Shared study room**.

**Avoid:** complex sign-up questionnaires, complete SSO integration, nested university governance.

### F02 — Course and material management **[MVP]**

- Instructor creates an institutional course.
- Learner creates private course.
- Upload a small, safe PDF or plain-text content.
- Process into extractable sections/chunks; show progress/errors.
- Content has a source label and visibility (`official`, `private`, or `shared-in-room`).
- AI can retrieve relevant passages rather than resend entire documents.
- Instructor has a publication step; personal content is never published automatically.

**Optional:** automated topic breakdown and AI-generated practice-question suggestions.

### F03 — Quick diagnostic and adaptive learning **[MVP]**

- 2–4 short checks before a topic (multiple choice, short explanation, quick application).
- Detect obvious gaps and choose an approximate starting difficulty.
- Ask for response language and preferred explanation form (concise, worked example, step by step).
- Treat preferences as adjustable, not fixed psychological types.
- Update the working understanding estimate using later exercises.
- Distinguish *not tested* from *weak mastery*.

**Simple output:** `Starting level: introductory`, `Concept to revisit: transitive dependency`, `Suggested next task: explain with one example`.

### F04 — Individual AI learning companion **[MVP]**

- A single topic-oriented chat/learning interface.
- Grounded question answering with course references when documents exist.
- Socratic mode by default: ask, hint, reveal gradually.
- Offer simplified / detailed / example-based explanations.
- Support brief exercises and feedback.
- Allow a student to request the direct answer when genuinely stuck.
- Keep students informed when the available sources do not support a claim.

**Not required:** full tutoring lesson generation for every field of study.

### F05 — Collaborative AI study room **[MVP, highest product priority]**

- Create room for a course/topic; generate an invite code.
- Join room as 2–4 learners.
- Shared discussion feed that updates reliably (polling or realtime transport).
- One shared challenge/problem and clear session phase.
- Students contribute explanations, examples and answers.
- AI interjects strategically instead of replying to every message.
- AI detects *candidate* misconceptions; asks peers for justification and escalates uncertain verification.
- Invite quieter learners to contribute, without shaming or forcing participation.
- Conclude with group debrief and optional individual checks.

**Suggested session stages:**

```text
ROOM_SETUP → QUICK_CHECK → SHARED_PROBLEM → PEER_EXPLANATION
           → PEER_CHALLENGE → AI_HINT_OR_VERIFY
           → INDIVIDUAL_CHECK → SUMMARY → DONE
```

**Possible AI facilitation actions:**

`ASK_PEER`, `INVITE_PARTICIPANT`, `ASK_FOR_JUSTIFICATION`, `GIVE_HINT`, `CHECK_MISCONCEPTION`, `SIMPLIFY`, `TRANSLATE_OR_REPHRASE`, `PROPOSE_EXERCISE`, `SHOW_EXPLANATION`, `SUMMARIZE_AND_NEXT_STEP`.

**Critical UX rule:** The AI should not monopolize the room. Its role is to improve peer-to-peer learning.

**Live-room interaction extension [PROPOSAL; conditional MVP]:**

- **Voice conference (high-value, optional):** learners can join/leave, mute/unmute and talk via WebRTC with an SFU or another reliable managed realtime provider. Voice must not depend on the AI being available.
- **Shared resource view (MVP):** room participants see the same chosen PDF/exercise. Synchronize the active page/section and exercise state; do not try to implement multiplayer editing of arbitrary PDFs.
- **Explicit AI invocation (MVP):** `Ask facilitator`, `Need a hint`, `I'm confused`, `Check our reasoning`. These are grounded in the selected course resource and discussion context.
- **Private help (P1):** a learner can privately ask for a simpler explanation; the facilitator never broadcasts a private question without consent.
- **Voice-aware AI (later):** optional opt-in speech transcription, with clear audio-processing notice and consent for every participant. Avoid hidden monitoring, biometric profiling and automatic permanent transcript retention.
- **AI voice replies (later):** text first; read-aloud/TTS only if time allows. Always allow the conversation to continue without AI speech.
- **Pedagogical modes:** Socratic guidance and Group Challenge in MVP; Peer Teaching and Revision as simple variants or later extensions.

**Key distinction:** a voice call is a communication channel; the AI's pedagogical decisions can initially run on typed/explicit interactions. Do not claim to moderate all spoken contributions unless speech-to-text and attribution have actually been implemented and consented to.

### F06 — Adaptive practice and progress **[MVP, lean]**

- 1–3 brief questions per individual topic/session.
- Feedback aligned with the specific objective and difficulty.
- Simple per-topic status: **Not tested**, **Needs practice**, **Improving**, **Ready for next step**.
- End-of-session personal next step, plus group summary.
- Avoid displaying unsupported numeric “mastery” percentages based on minimal evidence.

**Later:** longitudinal competency maps, spaced repetition, advanced analytics and long-term retention tracking.

### F07 — Instructor insights **[P1 if time]**

- Number of demo course participants and sessions.
- Most frequently missed topic(s).
- Commonly corrected misconceptions in an aggregated form.
- Simple note on whether a course's learning objective was practiced.

**Privacy:** No default access to private room transcripts, uploads or individual chats. For hackathon data, use synthetic or anonymized aggregates.

### F08 — Multilingual learning **[P1 / bonus]**

- Allow concise English, French, Arabic or Darija questions where models support it.
- Recognize mixed Darija/French wording as normal usage.
- Preserve formulas, code and technical terms without destructive translation.
- Allow explicit user switch of response language.
- Test with real example prompts and record failures honestly.

**Strong demo idea:** one naturally code-switched Tunisian question, followed by a correct, concise explanation.

### F09 — Capacity-aware model routing and fallback **[MVP, technical priority]**

- Every AI operation has an intended model category.
- Compact model for routine classification and low-cost simple tasks.
- Capable model only when complex reasoning is needed.
- Client receives a job status, waiting indication or usable intermediate guidance.
- Bounded retry with backoff for retryable failures.
- Clear safe fallback when capable inference is unavailable.
- Cache repeated course-level extraction or generated prompts where safe.
- Log request type, elapsed time, model category, retries and fallback **without learner PII**.

**This module is essential to meeting the challenge's operational expectations.**

---

## 12. Suggested screens / information architecture **[PROPOSAL]**

| Page | Core content | Audience | Priority |
|---|---|---|---|
| Welcome / Choose access | Join course, study independently | All | P0 |
| Institution overview | Demo courses, invitation setup | Admin | P0, minimal |
| Instructor course setup | Course metadata, upload, publish, invite | Instructor | P0 |
| Learner home | My courses, recent topics, study independently | Learner | P0 |
| Course detail | Official/private source status, topic list, start learning | Learner | P0 |
| Learning session | Diagnostic, AI guidance, hints, exercises, sources | Learner | P0 |
| Study room | Participants, shared problem, discussion, AI interventions | Learner | P0 |
| Session debrief | Group outcomes, private individual next step | Learner | P0 |
| Instructor insights | Aggregate gaps and engagement | Instructor | P1 |
| Settings / profile | Basic preferences only, no sensitive identity data | Learner | P1 |

### UI/UX principles

- Prioritize **study content** over dashboards and decorative components.
- Make institutional vs private content provenance visible.
- Use responsive layouts that work on phones and laptops.
- Make learner actions obvious: **Try yourself**, **Get a hint**, **Ask the group**, **Show explanation**.
- A study room should show **who is speaking, what problem the group is solving, and what happens next**.
- Do not rely on animations or avatars to explain the core product.
- Waiting states are part of the primary UX because model responses are not token-streamed.
- Maintain accessible contrast, keyboard focus, readable text and inclusive language.

---

# Part IV — Technical blueprint and AI behaviour

## 13. Recommended minimal architecture **[PROPOSAL]**

**Use the team's fastest reliable stack.** The challenge does not mandate Next.js, NestJS, Python, PostgreSQL, MongoDB, any specific frontend framework or a multi-agent architecture.

```text
   Browser / mobile-responsive web app
        |        |           |
        |   Institution     Independent
        |     Course          Course
        +-----------+-----------+
                    |
             Application API
          - scoped authorization
          - course/source records
          - study sessions/rooms
          - exercise/results state
                    |
             AI Orchestration
          - task classification
          - model-category router
          - context retrieval
          - facilitation policy
          - timeout/retry/fallback
                    |
          +---------+----------+
          |                    |
      Compact LLM           Capable LLM
          |                    |
          +---------+----------+
                    |
          validated application result
                    |
                Learners
```

### 13.1 Practical engineering choice

For a small hackathon team, a **modular monolith or one application API** is generally simpler than a microservice fleet. Add a separate AI worker/service only if it meaningfully accelerates delivery or avoids integration risk. Use one database and a small number of well-defined AI operations.

**Recommended logical modules:**

- `workspaces / memberships` (scope and invitations);
- `courses / materials` (sources and publishing);
- `learning` (diagnostics, solo sessions, questions);
- `rooms` (participants and shared interaction);
- `ai` (orchestration, grounding and safeguards);
- `progress` (checks, results and next steps).

### 13.2 Minimal data entities

| Entity | Example fields (illustrative) |
|---|---|
| `Workspace` | id, type (`institution`/`personal`), display label |
| `Membership` | actorId, workspaceId, role |
| `Course` | id, ownerWorkspaceId, title, publicationState |
| `ContentSource` | id, courseId, documentId, provenance, visibility, extractionStatus |
| `LearningObjective` | id, courseId, topicId, statement |
| `Topic` | id, courseId, title, order |
| `LearningSession` | id, pseudonymousActorId, topicId, state |
| `Room` | id, topicId, createdByActorId, inviteTokenHash, state |
| `RoomParticipant` | roomId, actorId, alias, joinedAt |
| `RoomMessage` | id, roomId, actorId/ai, type, text, timestamp |
| `AssessmentAttempt` | actorId, objectiveId, itemId, outcome, createdAt |
| `AIJob` (optional) | id, operation, status, modelCategory, retryCount, elapsedMs |

**Never interpret these example fields as permission to collect prohibited personal details.** For demonstration, actor IDs and aliases should be synthetic/pseudonymous and outputs should be privacy-scoped.

## 14. Model routing: which AI category does what? **[PROPOSAL grounded in SPEC, p. 2]**

| Task | Default execution | Escalate when | Fallback |
|---|---|---|---|
| Detect question/intent | Compact model or deterministic rules | Ambiguous intent affects next activity | Safe clarification prompt |
| Detect preferred language | Compact/rules | Ambiguous mixed-language request | Ask for preference |
| Pick participation intervention | Rules + compact model | Complex pedagogical situation | Invite an optional peer contribution |
| Summarize short discussion | Compact model | Conflicting substantive claims | Neutral summary, mark unresolved |
| Generate simple hints | Compact model + approved source | Source unclear or reasoning complex | Retrieve source and ask a guiding question |
| Evaluate conflicting peer explanations | Capable model | Already the escalation path | Do not certify correctness; mark as unresolved |
| Explain a difficult technical concept | Capable model when justified | — | Brief sourced excerpt, simple hints, retry later |
| Assess complex reasoning | Capable model | — | Defer grading or use a verified answer key |
| Suggest next learning step | Rules/compact based on assessment evidence | Conflicting information | Suggest another check rather than declare mastery |
| Course ingestion/extraction | Deterministic extraction; compact for tagging | Complex document semantics | Manual topic selection |

### Model-routing principles

1. **Classify the task before choosing a model**, or use an explicit operation-to-model map.
2. **Do not route all requests to the capable model** just to maximize perceived quality.
3. **Do not use a long chain of compact calls** when a single well-scoped call or simple rule suffices.
4. **Only claim correctness when supported** by source material, an answer key or appropriate reasoning verification.
5. **Document the model-category decision** and show it in a technical view during the demo.
6. **Use real inference** in the evaluated solution; prerecorded/mock outputs are not a replacement for the required working application.

## 15. Grounding and retrieval **[PROPOSAL; RAG optional under SPEC]**

### 15.1 Sources

- **Official source:** approved/published by an instructor within an institutional course.
- **Personal source:** uploaded by a learner; private by default.
- **Room-shared source:** explicitly shared for a particular study room.
- **Open-topic generation:** AI-generated content, **not** an official course source (stretch feature).

### 15.2 Minimal retrieval flow

```text
Upload → Validate type/size → Extract text → Chunk by heading/topic
       → Build searchable index → Retrieve relevant passages
       → Construct bounded prompt → Generate guidance → Cite passages
```

For the demo, selecting a short, well-formatted document and using basic text search may be enough. Embeddings/vector search are useful only if needed and can be implemented reliably in time.

### 15.3 Correctness and security rules

- Instructor approval refers to the **document**, not the AI's generated interpretations.
- Show source title/section for answers based on uploaded content.
- Treat documents and chat as **untrusted context**, never as instructions that override system behaviour.
- Enforce tenant/workspace access **before** retrieval; do not rely on prompt text for isolation.
- If no evidence is found, say so and provide a tentative explanation only with clear labeling.
- Set file-size, chunk-count and context-window limits to protect scarce inference capacity.
- Do not ingest copyrighted or private institution content for the demo unless you are authorized and the content is permitted under the challenge's data rules.

## 16. Diagnostic, personalization and learning progress **[PROPOSAL]**

**Keep personalization evidence-based and explainable.**

### Inputs

- topic chosen;
- answers to a few short questions;
- optional explanation preference and language;
- later observed exercise attempts.

### Simplified initial learner state

```json
{
  "topic": "Third Normal Form",
  "initialLevel": "needs-guidance",
  "uncertainConcepts": ["transitive dependency"],
  "preferredLanguage": "French / Darija",
  "preferredHelp": "worked example",
  "evidenceCount": 2
}
```

### Behaviours

- Start with a question or hint at an appropriate level.
- Increase difficulty only after demonstrated success.
- Explain a gap without humiliating the student.
- After an incorrect answer, ask for reasoning and a second attempt.
- Avoid overconfident claims based on two diagnostic responses.
- End each session with one concrete next action.

**Optional educational framework:** Bloom's taxonomy can inform the distinction between *remember, understand, apply, analyze, evaluate, create*. It is a **design option**, not mandated in the spec, and does not require an elaborate competency engine for the hackathon.

## 17. AI peer-facilitation design **[PROPOSAL]**

### 17.1 Why it is more than group chat

A normal group chat stores messages. An AI facilitator needs a simple representation of **what the group is trying to learn and which intervention is appropriate**.

### 17.2 Minimal group state

```text
Session objective
Current problem
Current phase
Participants (synthetic/pseudonymous aliases)
Recent contribution counts (not personality scores)
Explanations offered
Candidate misconception / uncertainty
Whether a hint was already given
Shared task completion
```

### 17.3 Example of a helpful intervention

**Student B:** “3NF means every table needs only one primary key.”  
**AI:** “Can someone test that explanation against the dependency example in the course? What condition does 3NF actually require?”  
**Student C:** “Is the issue a transitive dependency?”  
**AI:** “Good direction. Try identifying the dependency chain and whether the non-key attribute depends transitively on a key.”

*Example dialogue is illustrative; actual model outputs require testing and grounding in the selected course.*

### 17.4 Rules to prevent over-intervention

- Do not respond to every message.
- Avoid naming a “weakest” student publicly.
- Offer turns to quieter people, but permit decline.
- Avoid treating message counts as evidence of intelligence or effort.
- Let the group attempt an answer before revealing it.
- Escalate uncertain subject-matter claims to the capable model or mark unresolved.
- Ask short, relevant questions rather than lengthy AI monologues.

## 18. Failure handling and degraded mode **[PROPOSAL based on SPEC]**

**Possible states:** `IDLE`, `QUEUED`, `RUNNING`, `COMPLETED`, `RETRYING`, `LIMITED_MODE`, `FAILED`.

**Required behavioural design:**

1. Validate a request before consuming model capacity.
2. Show a useful loading indicator with what the AI is doing.
3. Apply a bounded timeout and retry policy.
4. On capable-model unavailability, fall back to a smaller operation when safe.
5. For unverifiable complex answers, display an uncertainty/deferral message, **not a fabricated answer**.
6. Preserve room discussion and learner progress even if one AI call fails.
7. Recover without requiring the learner to recreate the whole session.

**Demo test:** deliberately simulate capable-model unavailability using a controlled application-level switch or injected failure; show the real compact-model/rule fallback. Explain that the failure is simulated while remaining honest about which actual requests use real inference.

---

# Part V — MVP, prioritization, delivery and validation

## 19. What to build now versus later **[PROPOSAL]**

### 19.1 Must-have for the competitive demo (P0)

1. Functional web app with real AI inference.
2. Minimal university course + instructor upload/publish flow.
3. Independent learner course/upload flow using the **same learning engine**.
4. Simple topic diagnostic and one individual-guided exercise.
5. Invite-only room with at least two real interacting browser sessions.
6. One genuine peer-facilitation sequence (question, peer answer, intervention, verification/hint).
7. Brief session outcome and next step.
8. Documented compact/capable model routing.
9. Graceful fallback with visible user status.
10. Privacy-safe, reproducible demo and passing critical tests.

**If time is extremely limited:** narrow the demo to **one institutional course**, **one personal course**, **one technical topic** and **one group scenario**. A single polished end-to-end journey is worth more than many incomplete screens.

### 19.2 High-value improvements (P1)

- French/Darija code switching and language preference.
- More polished adaptive explanation controls.
- Lightweight instructor aggregate insights.
- Improved source references and exercise quality.
- 5–10 learner feedback sessions using safe test data, if accessible.

### 19.3 Explicitly exclude from hackathon (P2 / later)

- University billing and subscription checkout.
- Complex multi-department governance and enterprise SSO.
- Full LMS import/export integrations.
- Marketplace of public courses and teachers.
- Matching strangers into public rooms.
- Automatic recording, persistent voice transcripts, AI speech analytics and unsolicited always-listening moderation. Basic live voice chat is a conditional P1 enhancement, not excluded.
- Realtime collaborative whiteboard.
- Rich gamification, stores, tokens, extensive badges.
- Knowledge graph as a prerequisite for basic learning.
- Advanced competency analytics and long-term retention engine.
- Mobile native apps, offline mode, enterprise deployment features.

## 20. Three-person team split **[PROPOSAL]**

The specification allows **up to three team members**. If there are three:

| Responsibility | Owner | Core deliverables |
|---|---|---|
| **AI and learning logic** | Member A | Routing, prompt design, retrieval, diagnostics, facilitation policy, fallback, evaluation cases |
| **Application and data** | Member B | Workspace/course/content APIs, room sync, access controls, persistence, upload processing |
| **Frontend, demo and integration** | Member C | Responsive UI, learner and instructor journeys, integration tests, 90-second demo, report/pitch support |

All three contribute to testing and the final narrative. Two team members prepare and deliver the final pitch if selected, per the rule in the specification.

## 21. Development sequence: minimize integration risk **[PROPOSAL]**

### Milestone 0 — Agree on a crisp story

- Choose one demo-safe course and topic (e.g. Database Normalization / 3NF).
- Write 1 synthetic misconception and 2–3 expected pedagogical interventions.
- Decide the smallest working group interaction: text-based, invite-only.
- Confirm accessible model categories and quotas from organizers.

**Gate:** the team can explain the entire product in 30 seconds.

### Milestone 1 — One vertical slice works

- Course/document available through both institutional and private paths.
- One student can ask a grounded question using **real inference**.
- Basic source citation and waiting state visible.

**Gate:** upload → retrieve → AI result works end to end.

### Milestone 2 — Peer-learning differentiator works

- Two or three learners share one room.
- Shared problem and messages stay synchronized.
- AI executes an intentional intervention rather than answering every chat turn.
- Learners reach a visible outcome.

**Gate:** full collaborative learning demonstration succeeds without manual database intervention.

### Milestone 3 — Challenge engineering is visible

- Compact/capable routing documented and observable.
- Controlled capable-model failure shows safe fallback.
- Rate/timeout paths, prompt injection and access isolation tested.

**Gate:** the demo still gives a useful experience in degraded mode.

### Milestone 4 — Submission-ready

- Polish the primary user flow and responsive layout.
- Run a reproducible synthetic-data demo from a clean start.
- Collect limited real-user feedback safely.
- Produce the repository README, ≤6-page report and ≤90-second video.

**Gate:** a new evaluator can run the app from the README and understand the AI design.

## 22. Functional acceptance criteria **[PROPOSAL]**

| ID | Given / when | Expected result |
|---|---|---|
| AC-01 | Instructor publishes an approved document | Enrolled learner can open the course and reference that document |
| AC-02 | Learner uploads a private document | It is not visible in another learner's or university's workspace |
| AC-03 | Independent user starts studying | No university account or membership is required |
| AC-04 | A learner completes a short diagnostic | EdNova recommends an appropriate starting activity and labels uncertainty |
| AC-05 | Learner asks a course-specific question | Answer/hint uses appropriate course evidence or reports insufficient evidence |
| AC-06 | Two browsers join a room | Shared messages and the session phase remain synchronized |
| AC-07 | A peer offers a questionable explanation | AI guides verification/hints instead of blindly agreeing |
| AC-08 | One learner contributes less | AI may invite participation respectfully, without forced public ranking |
| AC-09 | Learner finishes an activity | A concrete next action is produced, not an unsupported mastery claim |
| AC-10 | A simple classification is requested | Compact/rule path is preferred and traceable |
| AC-11 | Complex reasoning is required | The capable path is used when available and traceable |
| AC-12 | Capable model times out or hits quota | Room continues safely, user sees limited mode/deferral rather than silent failure |
| AC-13 | AI response is slow | UI remains responsive with meaningful progress state |
| AC-14 | A user requests restricted institutional/private material | Request is denied **before** retrieval/AI inference |
| AC-15 | A provided document contains instruction-injection text | Source text remains treated as data and cannot override system policy |
| AC-16 | Final demo is recorded | All identities and data are synthetic/anonymized; no secret keys are visible |

## 23. Testing and evaluation plan **[PROPOSAL]**

### 23.1 Functional tests

- Institutional course publication and join code.
- Independent private course creation.
- Upload extraction, failed upload and unsupported-file paths.
- Retrieval of relevant course sections.
- Individual diagnostic → explanation → practice → next-step loop.
- Two- or three-browser room creation/join/sync.
- AI facilitation stages, misconception-handling and summary.

### 23.2 AI evaluation scenarios

Build a small, fixed set of test prompts:

1. Correct factual course answer with a usable source reference.
2. Student gives a common misconception.
3. Two students disagree on a technical explanation.
4. No relevant supporting passage exists.
5. User asks an off-topic or adversarial question.
6. Short Darija/French code-switched question.
7. Compact-model answer insufficient → capable-model escalation.
8. Capable-model unavailable → safe limited-mode flow.
9. Slow response → UI stays interactive and reports status.
10. Duplicate action/retry → no duplicate exercise or unwanted repeated message.

Record actual outcomes rather than invented accuracy percentages.

### 23.3 Privacy/security tests

- Cross-institution and cross-user access denied.
- Invite code cannot grant instructor privileges.
- Private source unavailable outside explicit sharing scope.
- Prompt-injection content cannot bypass retrieval boundaries.
- No secrets in logs, README, screenshots or video.
- AI inputs use synthetic/anonymized data only.

### 23.4 Small real-user test (bonus)

Suggested, if time permits: test with 5–10 volunteers using **fictional identities and synthetic educational material**. Ask for short feedback without collecting names, voice recordings or personal course histories.

Observe:

- Can users finish the group task without explanation from the developer?
- Did everyone have a chance to participate?
- Was the AI intervention useful, irrelevant or disruptive?
- Could participants explain the concept after the activity?
- Did they understand when the AI was uncertain?

These are **future measurements**; no empirical results are claimed here.

### 23.5 Operational measurements

Instrument:

- median/slow response time by model category;
- compact vs capable request counts;
- retry and fallback rate;
- estimated calls/tokens per completed session where available;
- demo task completion rate.

Do **not** present unmeasured estimates as verified performance.

---

# Part VI — Demo, presentation and business-model note

## 24. Recommended 90-second demo storyboard **[PROPOSAL]**

> The official final demo video limit is **1 minute 30 seconds**. **[SPEC, p. 3]**

| Time | Action | What evaluators see |
|---|---|---|
| 0–10s | Open an institution-backed course | Approved course content and the university path |
| 10–20s | Student does a short diagnostic | Different starting understanding levels |
| 20–30s | Three learners enter a room | Human-to-human collaboration is real |
| 30–48s | Student offers a wrong explanation | AI asks peers to investigate and gives a hint |
| 48–59s | Student asks in Darija/French | Accessible, context-aware response |
| 59–70s | Show model routing + inject capable-model failure | Compact/capable design and safe degraded mode |
| 70–82s | End activity, show next step | Learning outcome and personal feedback |
| 82–90s | Flash independent learner entry | Same platform works without a university |

**Keep the recording rehearsed and concise.** Because real non-streamed inference can be slow, capture a genuine working session and edit the video to the allowed duration; do not misrepresent mocked responses as live model inference. For the live technical Q&A, be ready to reproduce key requests.

## 25. Suggested four-minute pitch **[PROPOSAL]**

| Time | Pitch component |
|---|---|
| 0:00–0:35 | Problem: passive learners, dominant speakers, uncorrected mistakes |
| 0:35–1:10 | Our solution: institutional + independent entry, one AI peer-learning core |
| 1:10–2:05 | Differentiator: Socratic facilitation and individualized progression |
| 2:05–2:55 | Architecture: compact/capable routing, retrieval, fallback, privacy |
| 2:55–3:30 | Prototype evidence: tests, one real user observation if available |
| 3:30–4:00 | B2B2C adoption route and the one-sentence value proposition |

The organizers allow a maximum 4-minute presentation and a 2-minute Q&A. The final demo video is a separate limited artifact. **[SPEC, p. 3]**

### Likely judge questions

**Why not just use ChatGPT?**  
EdNova structures *peer interaction* around a shared, trusted course context, supports hints and understanding checks, and intervenes when peers need facilitation. The demonstration should prove this, not simply assert it.

**Why should universities use it?**  
They already have course content and groups of learners. EdNova could make peer practice more accessible and reveal aggregate learning gaps, subject to pilot validation and institutional privacy policies.

**Does AI replace instructors?**  
No. Instructors approve content; AI supports practice and group discussions. The AI does not claim that every generated statement is institution-approved.

**How do you know the student learned?**  
Short before/after exercises offer preliminary evidence. Avoid claiming scientific improvement or durable mastery without proper evaluation.

**What happens when the capable model is unavailable?**  
The product continues simple peer facilitation with compact/rule-based operations, clearly identifies unresolved reasoning, and optionally retries later.

**How is student privacy protected?**  
Strict content scoping, synthetic demo identities and materials, no raw private records to the provided inference service, and no default professor access to private conversations.

## 26. Short business-model and adoption proposal **[PROPOSAL to satisfy SPEC]**

### Target users and buyer

- **End users:** university students; independent learners.
- **Possible future customer:** universities, engineering schools and training centers seeking better course-linked study support.
- **Academic stakeholder:** instructor/course owner, who provides and approves materials.

### Value proposition

- For students: personalized, explainable support when studying alone, and structured help in groups.
- For instructors: course-grounded learner practice and optional aggregate insight without supervising every peer session.
- For institutions: potentially more accessible peer support using approved materials.

### Adoption pathway

1. **Hackathon:** run the prototype with synthetic institutions/courses and small study groups.
2. **Pilot hypothesis:** offer a voluntary pilot around a difficult university course with instructor approval and suitable data/privacy protections.
3. **Potential expansion:** universities license access for cohorts (B2B2C), while unaffiliated learners use an independent free or low-cost tier.

### Sustainability hypothesis

Institution-backed cohort licensing could support platform, support and inference costs. An independent learner tier keeps the platform usable without institutional adoption. **No pricing, conversion rate, contract or commercial traction is validated by this document.**

### Key business risk

Institutions may prefer existing LMS/AI tooling and have long procurement cycles. The hackathon should **not** consume engineering time building commerce or enterprise administration before peer-learning value is proven.

---

# Part VII — Risks, decisions and final checklist

## 27. Major risks and mitigations **[PROPOSAL]**

| Risk | Why it matters | Practical mitigation |
|---|---|---|
| Too many roles/features | Can obscure the main learning innovation | Minimal role screens; share all learner components |
| Generic chatbot experience | Weak innovation/relevance | Prioritize visible AI peer facilitation and guided reasoning |
| Incorrect AI corrections | Harmful in education | Grounding, uncertainty, capable-model escalation, answer-key checks |
| Slow/non-streaming inference | Frozen UI, risky demo | Staged progress, limited requests, bounded retries |
| Large model quota exhaustion | Challenge-specific technical failure | Compact-model/validated-content fallback and explicit limited mode |
| Real-time room integration | Risk of sync bugs under deadline | Small rooms, text only, simplest reliable transport |
| University content contamination | AI answer may appear institution-approved | Explicit provenance and citations; no automatic approval of generated text |
| Private information leakage | Violates challenge rules | Synthetic data, strict scopes, no PII sent to inference |
| Overclaiming pedagogy | Judging and credibility risk | Use preliminary diagnostic and qualitative tests; avoid unsupported mastery claims |
| No cohort of users | Social product cold-start | Individual mode works independently of room participation |
| Overengineering architecture | Delays the polished prototype | Modular monolith; defer microservices and complex infrastructure |

## 28. Open team decisions — recommended defaults **[PROPOSAL]**

| Decision | Recommended default |
|---|---|
| First subject | Database Systems / 3NF, or any equally well-understood technical topic |
| Primary device | Responsive web browser |
| Group size | 2–4 pseudonymous participants |
| Communication | Text/realtime room events required; optional live WebRTC voice without recording |
| University setup | One seeded fictional institution + simple instructor course page |
| Enrollment | Course invitation code, no enterprise SSO |
| Material format | One small PDF + plain text, not arbitrary file ingestion |
| Institutional source of truth | Instructor-published materials, with visible provenance |
| Student material | Private by default, explicit room-level sharing |
| Diagnostic | 2–4 short checks, provisional results |
| Collaborative mode | One shared problem, text chat, shared document/page sync, explicit AI intervention; optional live voice |
| AI topology | Minimal central orchestrator; compact + capable model mapping |
| Progress | Session-level next step; not a full competency engine |
| Teacher dashboard | Simple aggregate insight only if time |
| Independent topic with no upload | Stretch goal; label AI-generated material clearly |
| Evaluation | Fixed scenario suite + synthetic-data user test |
| Monetization | Business-model note only; no checkout |

## 29. Proposed submission checklist

### Challenge compliance **[SPEC]**

- [ ] Working end-to-end application using real inference.
- [ ] Compact and capable model categories used deliberately, with documented mapping.
- [ ] Non-streamed latency handled visibly.
- [ ] Usage-limit/unavailability behaviour demonstrated or documented.
- [ ] No fine-tuning or custom model training required.
- [ ] No credentials exposed, no limits bypassed, external services declared.
- [ ] Only permitted synthetic/public/anonymized data sent to the model service.
- [ ] Technical report **≤6 pages**, including short business-model note.
- [ ] GitHub URL, source, README, setup/config template and GenAI explanation.
- [ ] Demonstration/simulation included for Phase 1.
- [ ] Team has at most 3 members and prepares 2 presenters if selected.
- [ ] Final pitch **≤4 minutes**, demo video **≤90 seconds**, Q&A preparation for **2 minutes**.
- [ ] Confirm exact date/time for **10 November** Phase 1 deadline with organizers.

### Product readiness **[PROPOSAL]**

- [ ] Institutional instructor can publish a course document.
- [ ] Learner can join it and ask grounded, guided questions.
- [ ] Independent learner can upload their own content and study.
- [ ] 2–4 learners can join a room, view the same exercise/document section and collaborate.
- [ ] If voice is enabled: join/mute/reconnect/leave work between real browsers, while the AI is offline; participant consent and microphone permissions are clear.
- [ ] AI demonstrably chooses a pedagogical intervention over an immediate answer.
- [ ] AI uncertainty and source provenance are visible.
- [ ] Individual diagnostic/exercise/next-step loop works.
- [ ] Large model outage switches to a safe limited mode.
- [ ] At least one Arabic/Darija/French/English interaction tested if time.
- [ ] Synthetic demo data and fallback scenario prepared.
- [ ] Critical access/isolation, upload and AI-flow tests pass.
- [ ] Demo can be reproduced using documented setup steps.

## 30. Final team recommendation

**Deliver one exceptional peer-learning experience.** Use the university route to show how trusted content enters EdNova and the independent route to show that the same learning engine remains accessible to everyone. But allocate most design, AI and testing effort to the moment when **students explain a concept, disagree, receive careful AI facilitation, correct a misconception and leave with a verified next step**.

The challenge's distinctive request is not “build a university platform.” It is to demonstrate that **generative AI can make learning with other people more inclusive, interactive, structured, personalized and effective**, under real inference and capacity constraints. The B2B2C and independent-learning model is a coherent adoption story that supports that goal; it should not become the central implementation burden.

---


# Part VII — Study Together: voice-enabled collaborative learning extension **[PROPOSAL]**

## 31. Purpose and differentiation

**Study Together** is EdNova's flagship experience: 2–4 learners share a course context, talk and solve problems together, while an AI facilitator structures the learning process. It is **not** intended to replicate Google Meet, Discord, or a generic shared AI chat. The educational value comes from **guided peer explanation, equitable opportunities to contribute, evidence-grounded misconception handling, and individual verification of learning**.

This extension is proposed by the team, **not mandated by the official three-page challenge book**. The book does identify voice interaction as an optional open-innovation idea and does emphasize peer facilitation, adaptive learning, language access, careful model use and graceful capacity handling.

## 32. Role-specific features

| Actor | Room actions | Permissions and boundaries |
|---|---|---|
| University learner | Start/join an invite-only room within an enrolled course; speak, chat, open shared resources, request hints, answer exercises | Official resources available only through course authorization; private progress stays private |
| Independent learner | Create/join a room linked to their own course, uploaded document or open topic | Only explicitly selected resources are shared with participants; never expose the entire private library |
| Instructor | Provide official source documents and optionally propose room activities or view aggregate outcomes | No automatic access to live/private conversations, recordings or individual side-channel questions |
| University administrator | Configure institution access and course enrollment | No need to moderate rooms or inspect learners' private discussion |
| AI facilitator | Guide reasoning, select activities, prompt participation, verify candidate misconceptions, summarize outcomes | No authority to publish official content, silently record audio, or assert unsupported correctness |

**Membership model:** university learner and independent learner are access contexts for the **same learner identity**. A learner may join multiple institutions and private rooms without duplicating accounts.

## 33. Room experience and feature definitions

### 33.1 Entry and room setup

1. Choose a university course, a personal uploaded course, or a topic with clearly labeled AI-generated baseline material.
2. Choose one learning goal (e.g. *Identify transitive dependencies*), one chapter/exercise and optionally a facilitation mode.
3. Create a private room link/code; set the maximum to 4 participants for the prototype.
4. Participants join by alias; the room displays a consent/visibility notice for any shared documents and microphone use.
5. Each participant answers 1–2 short check-in items or selects *I'm new / Somewhat familiar / Confident*. These are **provisional**, not psychometrically validated assessments.

### 33.2 Live conversation

- **Text chat is the guaranteed path** for submitting reasoning, examples and AI requests.
- **Optional live voice:** student-to-student WebRTC audio, push-to-talk or mute, explicit microphone permission, visible joining/leaving state, reconnect indicator and error handling.
- **Room presence:** display who is present, who has voluntarily raised a hand and who is contributing in text; speaking indicators may be displayed based on real-time audio presence but should not be mistaken for learning mastery.
- **No recording by default**; no room-wide transcription unless every participant explicitly opts in under an agreed privacy policy.
- Voice packet media and text/session events must follow **separate transports**, ensuring AI delay cannot interrupt conversations.

### 33.3 Shared learning content

- Shared PDF viewer: selected document, current page/section, citation link and a basic page-synchronization event.
- Shared exercise: one prompt and a structured answer area with submissions labeled by learner (or optional private answers).
- `Share to room` must be an **explicit action**; private uploads remain private until shared.
- Do not allow a participant to share restricted university course content with unauthorized nonmembers.
- P1: lightweight highlights and reference anchors. P2: collaborative whiteboard, screenshots and arbitrary screen sharing.

### 33.4 AI interaction controls

| Control | Trigger | Expected behaviour |
|---|---|---|
| Ask facilitator | Intentional click or typed mention | Answers in the current topic, with source reference where possible |
| Need a hint | Learner is stuck | Provides a graduated hint before the full solution |
| I'm confused | Learner opts in privately or publicly | Simplifies/rephrases; avoids stigmatizing the learner |
| Check our reasoning | Peers disagree or submit solution | Verifies relevant claims; asks peers to critique before revealing an answer |
| Invite perspectives | Learners request balanced discussion | Invites optional contributions without ranking or shaming students |
| Finish and reflect | Room concludes an exercise | Individual check, group recap and personal next step |

**Agent intervention policy:** opt-in interactions and explicit checkpoints first; unsolicited interruptions only when the team has reliable observation signals and strong tests. A silent learner may be invited once, but can decline without penalty.

## 34. Facilitation modes

1. **Socratic mode [MVP]:** agent asks a guiding question, then offers progressively stronger hints, finally a full grounded explanation on request.
2. **Group Challenge [MVP]:** agent presents a shared problem; peers propose solutions, critique reasoning and complete private final checks.
3. **Peer Teaching [P1]:** a participant explains a concept; others restate, ask questions and offer alternative examples; facilitator spots unresolved ambiguity.
4. **Revision [P1]:** compact timed practice rounds focused on weak concepts. No need for sophisticated leaderboards or gamification.

These modes are **policy presets**, not four completely separate multi-agent architectures.

### Example facilitation script (synthetic)

- **A:** “This relation is already in third normal form.”
- **B:** “I’m not sure. Department determines Building.”
- **Facilitator:** “Before I give the answer, can C explain whether `StudentID → Department → Building` introduces a transitive dependency?”
- **C:** “Yes, because Building depends on StudentID through Department.”
- **Facilitator:** “Correct for this example. Can the group suggest a decomposition? Let's then check whether each person can do a similar problem independently.”

The AI must verify against a trusted worked example or document context when possible. It should not claim certainty if the grounding is insufficient.

## 35. Internal AI design and learning state

Maintain a compact, bounded room state rather than sending full voice recordings or infinite history to every prompt:

```text
StudyRoomState
  roomId, sourceContextId, selectedTopic, objective, currentPhase
  participantAliases, voluntaryPresenceStatus, participationEvents
  selectedDocumentId, selectedPage, sharedExerciseId
  recentRelevantChatTurns, reportedConfusions, candidateMisconceptions
  facilitatorMode, hintLevel, modelAvailability, sourceReferences
  perParticipantPrivateCheckResults (access-controlled)
```

**Facilitation state machine:**

```text
SETUP → CHECK_IN → SHARED_CHALLENGE → PEER_EXPLANATION
      → PEER_CRITIQUE → AI_VERIFY_OR_HINT → INDIVIDUAL_CHECK
      → GROUP_DEBRIEF → COMPLETE
```

**Compact model:** classify typed messages, detect requested help, summarize bounded context, language routing, simple hints when supported by source and policy. **Capable model:** complex verification, nuanced misconceptions, higher-order problem solving, adaptive feedback and synthesis when warranted. These responsibilities must be documented and measured using the challenge-provided inference service. **No fine-tuning.**

**Fallback:** if the capable model is temporarily unavailable, the room, voice call, shared materials, chat, predetermined exercises and compact-model/rule-driven interventions continue; mark advanced verification *pending* rather than guessing. Show progress/queuing status during non-streamed inference.

## 36. Technical implementation boundaries

```text
Browser users (2–4)
   |-- HTTPS/WebSocket → Room API + realtime event synchronization
   |                         |-- Room access control / source ACLs
   |                         |-- Shared content/page/exercise state
   |                         |-- AI facilitation job requests
   |                                     |-- Fast-model decision
   |                                     |-- Capable-model escalation
   |                                     `-- Grounded content lookup
   `-- WebRTC audio ──> SFU / managed realtime media service (optional)
```

**Build order:** realtime room presence + text + shared PDF/exercise → explicit AI facilitation → individual verification/debrief → voice media. A managed WebRTC/SFU service may reduce build time, but is subject to challenge platform rules and any external-service declaration. Audio delivery must work when AI inference is queued/unavailable. Never expose API keys to the browser.

**Voice-aware AI is a separate P2 experiment:** opt-in speech-to-text, diarization/speaker attribution, incremental moderation and TTS entail latency, accuracy, cost, fairness and consent risks. For the hackathon, do not imply that the agent listened to voice if its observations come only from typed messages or explicit exercise actions.

## 37. End-to-end acceptance tests

- Two to four browsers join the same private room and receive matching participant, exercise and selected-document state.
- Two people can exchange text and independently submit answers; a facilitator hint references the relevant source.
- A participant who lacks course permissions cannot fetch official course resources through a guessed room ID.
- Private document uploads, private tutor requests and individual diagnostic outcomes are not leaked into group messages or educator summaries.
- A participant can request a hint, receive a peer-first question, decline a participation invitation and still finish the session.
- Large-model unavailability does not block room chat, exercise state, voice (if enabled), or completion of safe activities.
- If voice enabled: test microphone denial, mute, network reconnect, tab closure, echo/headphones, three concurrent browsers and device switching where available.
- No audio recording is stored by default; validate consent before any transcription feature.
- Group report distinguishes **observed evidence** from AI inference and marks weakly supported conclusions as tentative.

## 38. Hackathon prioritization and demonstration

**P0:** functional study room, invite link, shared resource/exercise, text interaction, deliberate Socratic facilitation, misconception checking, individual check, group recap and model fallback. **P1:** robust live voice, multilingual code-switching, private AI side-channel, simple annotations. **P2:** continuous speech-aware agent, TTS, whiteboard, screen sharing, recording and analytics on speech.

**Suggested 90-second demo:**

1. **0–12s:** student enters an institution-published course, opens a 3-person Study Together room, invites classmates.
2. **12–25s:** room displays shared PDF/exercise; students converse by text or optional live voice.
3. **25–50s:** a misleading peer answer is submitted; AI asks another student to reason and gives a grounded hint rather than instantly replacing peer discussion.
4. **50–65s:** a participant clicks *I'm confused* and receives a simpler explanation privately (if P1 implemented), or requests a public rephrasing.
5. **65–80s:** participants complete a short individual check; the room produces personal next steps and a group summary.
6. **80–90s:** show explicit compact/capable model routing and successful fallback to compact/rule mode while discussion continues.

**Do not spend the demo showing billing, institution settings or arbitrary feature menus.** The organizer evaluates the quality of the educational intervention and technical feasibility, not the number of dashboard pages.


## Source and provenance

**Primary/only source used for official requirements:** Supplied *EdNova — GenAI Peer Learning Companion Technical Challenge*, IEEE WIE ACT 5.0, **3-page specification book**.

- **Page 1:** Problematic; learning and accessibility goals; smart peer learning; open innovation examples; entrepreneurship angle (continued on p. 2).
- **Page 2:** Operational constraints; compact/capable models; no training/fine-tuning; non-streaming latency; two-phase evaluation; deadline; final presentation guidance.
- **Page 3:** Demo/repository/report specifications; evaluation criteria; bonus points; team, ethics, platform rules; final pitch/video/Q&A limits.

**All product concepts, role definitions, permission tables, architecture, data entities, roadmap, dialogue examples, acceptance criteria, metrics, adoption and demo plan beyond the original specification are team proposals**, not commitments made by the organizers. Review and confirm feasibility against the actual allowed inference service before implementation.
