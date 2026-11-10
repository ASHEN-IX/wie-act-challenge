# Demo storyline and voice-over

Both videos have on-screen captions and no audio. Read the voice-over live or record it over the video.
Timings come from the current render (`node demo/edit.mjs`) and shift slightly after a new take.

The story follows one learner, Tasnim, through a course, into a live room with a classmate (Aziz),
and ends with the instructor's view. It maps to the EdNova brief: explain simply, hints before answers,
detect confusion, learning-style diagnostic, Darija/French/English, peer facilitation, teacher dashboard,
two model categories, and visible behaviour when capacity runs out.

## Competition cut: `output/noveris-demo-90s.mp4` (84 s, limit 90 s)

| Time | Screen | Say (~190 words) |
| --- | --- | --- |
| 0:00 | Title | "Noveris is a GenAI peer-learning companion." |
| 0:03 | Landing → sign-in → dashboard | "Tasnim, a university student, opens the course workspace." |
| 0:10 | Tutor: *Explain simply* | "Stuck on First Normal Form, Tasnim asks for a simpler explanation. A short task goes to the **compact** model; the screen shows progress, and every source is checked against the course." |
| 0:16 | *Another example* → built-in guidance | "When the usage limit is reached, Noveris says so and serves labelled guidance from the course instead of freezing." |
| 0:21 | Practice: wrong answer → hint → correct | "In practice, a mistake gets private feedback and a hint, never the answer key. With the hint, the second attempt is accepted as evidence." |
| 0:35 | Nardouch in Darija | "Tasnim can also ask Nardouch in Darija. The **capable** model reasons in the learner's language and cites the course." |
| 0:41 | Study Together, two browsers | "Now a real room: Aziz joins with the invite code. Chat and the shared whiteboard sync instantly." |
| 1:00 | AI facilitator | "The facilitator is peer-first: it turns Tasnim's question into a challenge for Aziz instead of answering." |
| 1:06 | Private attempts | "Everyone answers privately; the presenter only sees who has submitted." |
| 1:16 | Instructor insights | "Instructors see class-level practice. Small groups are suppressed, and private answers never leave the learner." |
| 1:21 | Closing card | "Noveris. Learn Together. Grow Further." |

## Master: `output/noveris-demo-master.mp4` (4 min 12 s)

| Time | Chapter | What happens |
| --- | --- | --- |
| 0:00 | Title | product and challenge |
| 0:06 | Landing and sign-in | landing page → *Log in* → learner dashboard |
| 0:19 | Onboarding | goals, subject, level, explanation language, preferred formats, study habits |
| 0:33 | **Understand, don't copy** | course page → reader; Deep Focus starts automatically; *Explain simply* (compact model, staged progress, checked sources); *Another example* hits the one-request limit → labelled built-in guidance; lesson completed → Nardouch grows from Baby to Explorer |
| 1:06 | **Hints before answers** | practice picks the next objective; wrong first attempt → private feedback with a Socratic hint; six-question hint-style probe; style-aware source hint (no model needed); correct retry recorded as evidence |
| 1:47 | **Nardouch speaks Darija** | Arabizi question → capable-model answer in Arabizi, formatted, with a source |
| 1:59 | **See the concept move** | Visual Lab from the course: the model proposes a shortest-path scenario, trusted code computes it |
| 2:12 | **Study Together** | two real sessions side by side: room creation, invite code, presence, peer discussion, chat sync, both peers drawing on the shared whiteboard, AI facilitator's peer-first challenge, private quiz for both, "✓ Submitted" status, debrief |
| 3:28 | Progress | badge, XP and skill evidence from accepted practice only |
| 3:35 | **Teach with evidence** | instructor sign-in, Course Studio (access, automated review, publishing), insights hidden for a small class, real figures for the 14-learner class, upload flow |
| 4:07 | Closing card | five key points |

## Facts to have ready for Q&A

- Compact model (`openai/gpt-oss-20b`): short tutor clarifications, coach, classification. Capable model
  (`openai/gpt-oss-120b`): Nardouch reasoning, facilitator, planning. Hints, grading and lab numbers use no model.
- Every real call needs a bounded approval; retries and silent cross-model fallback are off, so the
  fallback in the video is the designed behaviour, not an error.
- The class figures come from twelve synthetic classmates; six of them completed the quiz through the UI
  (`demo/cohort.mjs`). Figures appear only with at least five learners on each side.
