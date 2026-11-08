"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AiModeNote,
  AiWaitStatus,
} from "@/features/ai-status/ai-status-view";
import { refreshCourseNardouch } from "@/features/nardouch/course-growth";
import { NardouchAssistant } from "@/features/nardouch/nardouch-assistant";
import { ActivityRenderer } from "./activity-renderer";
import { LearningStylePanel } from "./learning-style-panel";
import {
  isTransientLearningError,
  learningErrorMessage,
} from "./learning-errors";
import {
  learningProgress,
  selectLearning,
  learningDiagnostic,
  sendLearningAttempt,
  askLearningTutor,
  requestLearningSupport,
  saveWorkspaceLanguage,
  type WorkspaceLanguage,
} from "./journey-actions";
import type { learningCatalog } from "./journey-actions";
import type { ActivityDefinition } from "@/lib/activity-contracts";
export function LearningWorkspace({
  catalog,
  userId,
  initialLanguage,
  visualConcepts = 0,
}: {
  catalog: Awaited<ReturnType<typeof learningCatalog>>;
  userId: string;
  initialLanguage?: WorkspaceLanguage;
  /** Concepts in this course's published material the Visual Lab can render. */
  visualConcepts?: number;
}) {
  const { context, activities } = catalog;
  const objectives = context.topics.flatMap((t) =>
    t.objectives.map((o) => ({ ...o, topicId: t.topicId })),
  );
  // Show the objective's wording, never its internal id.
  const objectiveTitle = (id: string) =>
    objectives.find((o) => o.objectiveId === id)?.statement ?? id;
  const [objectiveId, setObjective] = useState(
    objectives[0]?.objectiveId || "",
  );
  const hasReviewedPractice = activities.some((a) => a.objectiveId === objectiveId);
  const [activityType, setType] = useState(""),
    [intent, setIntent] = useState("practice");
  const [activity, setActivity] = useState<ActivityDefinition | null>(null),
    [message, setMessage] = useState(
      "Press Start practice to begin with the best next activity.",
    );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Awaited<
    ReturnType<typeof askLearningTutor>
  > | null>(null);
  const [progress, setProgress] = useState<Awaited<
    ReturnType<typeof learningProgress>
  > | null>(null);
  const [support, setSupport] = useState<Awaited<
    ReturnType<typeof requestLearningSupport>
  > | null>(null);
  // The language is persisted on the learner's profile, so it survives a reload
  // and follows them to any surface that renders these languages.
  const [workspaceLang, setWorkspaceLang] = useState<WorkspaceLanguage>(
    initialLanguage ?? "en",
  );
  // Only this component's own strings are translated. Applying RTL to the whole
  // workspace would flip English sentences that have no translation and strand
  // their punctuation on the wrong side, which is worse than left-to-right. RTL is
  // therefore scoped to the translated region below.
  const isRtl = workspaceLang === "ar" || workspaceLang === "ary";
  const [checks, setChecks] = useState<ActivityDefinition[]>([]);
  // The tutor reports its own failures next to its own box; the rest of the path
  // reports in the "next step" card. Neither may discard the learner's work.
  const [tutorError, setTutorError] = useState("");
  const [asking, setAsking] = useState(false);
  const [noActivity, setNoActivity] = useState(false);
  const [rationale, setRationale] = useState("");
  const [lastResult, setLastResult] = useState<{
    isCorrect: boolean;
  } | null>(null);
  const objectiveTouched = useRef(false);
  const recommendationApplied = useRef(false);
  const tutorRef = useRef<HTMLElement | null>(null);
  const attempt = useRef<{
    id: string;
    answers: Record<string, unknown>;
    seconds: number;
  } | null>(null);

  const t = {
    en: {
      goal: "Your learning goal",
      objective: "Objective",
      intent: "Intent",
      practice: "Practice",
      check: "Check understanding",
      explain: "Explain from sources",
      type: "Type",
      select: "Select reviewed activity",
      diagnostic: "Start provisional diagnostic",
      sourceSupport: "Hints and explanation",
      requestHint: "Request source hint",
      requestExplanation: "Request full source explanation",
      nextStep: "Your next step",
      startPractice: "Start practice",
      checkMine: "Check my understanding",
      askTutor: "Ask the tutor",
      moreOptions: "More options",
      anyType: "Any (recommended)",
      progressLine: "{done} of {total} objectives mastered",
      whatsNext: "What's next",
      correctLead: "Well done. That answer was accepted.",
      incorrectLead: "Not quite yet. Try a hint, or ask the tutor to talk it through.",
      nextObjective: "Practice the next objective",
      exploreVisually: "Explore this visually",
      studyPeers: "Study with peers",
      noActivity: "There is no reviewed practice activity for this objective yet. Ask the tutor, or explore it visually.",
      whyActivity: "Why this activity?",
      disclaimer: "Formulas, code blocks, and source quotes remain in their canonical notation.",
    },
    fr: {
      goal: "Votre objectif d'apprentissage",
      objective: "Objectif",
      intent: "Intention",
      practice: "Pratique",
      check: "Vérifier la compréhension",
      explain: "Expliquer depuis les sources",
      type: "Type",
      select: "Sélectionner l'activité révisée",
      diagnostic: "Démarrer le diagnostic provisoire",
      sourceSupport: "Indices et explication",
      requestHint: "Demander un indice de source",
      requestExplanation: "Demander une explication complète",
      nextStep: "Votre prochaine étape",
      startPractice: "Commencer à pratiquer",
      checkMine: "Vérifier ma compréhension",
      askTutor: "Demander au tuteur",
      moreOptions: "Plus d'options",
      anyType: "Au choix (recommandé)",
      progressLine: "{done} objectifs maîtrisés sur {total}",
      whatsNext: "Et ensuite",
      correctLead: "Bravo. Cette réponse a été acceptée.",
      incorrectLead: "Pas tout à fait. Essayez un indice ou demandez au tuteur.",
      nextObjective: "Pratiquer l'objectif suivant",
      exploreVisually: "Explorer visuellement",
      studyPeers: "Étudier avec des pairs",
      noActivity: "Aucune activité révisée n'existe encore pour cet objectif. Demandez au tuteur ou explorez-le visuellement.",
      whyActivity: "Pourquoi cette activité ?",
      disclaimer: "Les formules, blocs de code et citations sources conservent leur notation canonique.",
    },
    ar: {
      goal: "هدفك التعليمي",
      objective: "الهدف",
      intent: "الغاية",
      practice: "تمرين",
      check: "تحقق من الفهم",
      explain: "شرح من المصادر",
      type: "النوع",
      select: "اختيار نشاط معتمد",
      diagnostic: "بدء التقييم التشخيصي",
      sourceSupport: "التلميحات والشروحات",
      requestHint: "طلب تلميح من المصدر",
      requestExplanation: "طلب شرح كامل من المصدر",
      nextStep: "خطوتك التالية",
      startPractice: "ابدأ التمرين",
      checkMine: "تحقق من فهمي",
      askTutor: "اسأل المدرّس",
      moreOptions: "خيارات إضافية",
      anyType: "أي نوع (موصى به)",
      progressLine: "{done} من {total} أهداف تم إتقانها",
      whatsNext: "ماذا بعد",
      correctLead: "أحسنت. تم قبول إجابتك.",
      incorrectLead: "ليس بعد. جرّب تلميحًا أو اسأل المدرّس.",
      nextObjective: "تمرّن على الهدف التالي",
      exploreVisually: "استكشف بصريًا",
      studyPeers: "ادرس مع الزملاء",
      noActivity: "لا يوجد نشاط معتمد لهذا الهدف بعد. اسأل المدرّس أو استكشفه بصريًا.",
      whyActivity: "لماذا هذا النشاط؟",
      disclaimer: "الصيغ الرياضية والأكواد البرمجية والاقتباسات تحتفظ بترميزها الأصلي المعتمد.",
    },
    ary: {
      goal: "الهدف ديالك فالتعلم",
      objective: "الهدف",
      intent: "النية",
      practice: "تدريب",
      check: "تأكد من الفهم",
      explain: "شرح من المقرر",
      type: "النوع",
      select: "اختار تمرين مراجع",
      diagnostic: "بدا التقييم الأولي",
      sourceSupport: "مساعدة وشرح",
      requestHint: "طلب مساعدة من المقرر",
      requestExplanation: "طلب شرح مفصل من المقرر",
      nextStep: "الخطوة الجاية ديالك",
      startPractice: "بدا التدريب",
      checkMine: "تأكد من الفهم ديالي",
      askTutor: "سول المدرّس",
      moreOptions: "خيارات أخرى",
      anyType: "أي نوع (مستحسن)",
      progressLine: "{done} من {total} ديال الأهداف تقادّات",
      whatsNext: "من بعد",
      correctLead: "برافو. الجواب ديالك تقبل.",
      incorrectLead: "مازال شوية. جرب مساعدة ولا سول المدرّس.",
      nextObjective: "تدرب على الهدف الجاي",
      exploreVisually: "جرب بالصورة",
      studyPeers: "قرا مع الصحاب",
      noActivity: "مازال ما كاين حتى تمرين معتمد لهاد الهدف. سول المدرّس ولا جرب بالصورة.",
      whyActivity: "علاش هاد التمرين؟",
      disclaimer: "المعادلات والأكواد البرمجية تاتبقى بالشكل الأصلي ديالها.",
    },
  }[workspaceLang];
  async function refresh() {
    setProgress(await learningProgress(context.courseId, context.revisionId));
    refreshCourseNardouch(context.courseId, context.revisionId);
  }
  useEffect(() => {
    let current = true;
    learningProgress(context.courseId, context.revisionId)
      .then((p) => {
        if (current) setProgress(p);
      })
      .catch((e) => {
        if (current) {
          setProgress(null);
          setError(String(e.message));
        }
      });
    return () => {
      current = false;
    };
  }, [context.courseId, context.revisionId]);
  useEffect(() => {
    // Start on the recommended objective, once. Later progress updates must not
    // move the learner off the objective whose result they are looking at.
    if (!progress || recommendationApplied.current) return;
    recommendationApplied.current = true;
    if (!objectiveTouched.current && progress.recommendation)
      setObjective(progress.recommendation.objectiveId);
  }, [progress]);
  function changeLanguage(next: WorkspaceLanguage) {
    const previous = workspaceLang;
    // Switch immediately so the choice feels instant, then persist. A failed save
    // reverts rather than leaving the screen in a state that will not survive a
    // reload, and says so instead of failing silently.
    setWorkspaceLang(next);
    saveWorkspaceLanguage(next).catch(() => {
      setWorkspaceLang(previous);
      setError("Could not save your language choice. Try again.");
    });
  }
  async function run(
    action: () => Promise<void>,
    scope: "path" | "tutor" = "path",
  ) {
    setBusy(true);
    if (scope === "tutor") setTutorError("");
    else setError("");
    try {
      await action();
    } catch (e) {
      const message = learningErrorMessage(e);
      if (scope === "tutor") setTutorError(message);
      else setError(message);
      // Access or revision errors mean what is on screen may no longer be valid,
      // so clear it. A transient outage says nothing about that and must not
      // throw away the learner's open activity or progress.
      if (!isTransientLearningError(e)) {
        setActivity(null);
        setAnswer(null);
        setProgress(null);
      }
    } finally {
      setBusy(false);
    }
  }
  async function startActivity(nextIntent: string, forObjective = objectiveId) {
    await run(async () => {
      const r = await selectLearning(context.courseId, {
        revisionId: context.revisionId,
        objectiveId: forObjective,
        ...(activityType ? { activityType } : {}),
        intent: nextIntent,
      });
      setNoActivity(r.kind === "unavailable");
      setMessage(r.kind === "unavailable" ? t.noActivity : r.reason);
      setRationale(r.kind === "unavailable" ? "" : (r.limitation ?? ""));
      setActivity(null);
      setLastResult(null);
      if (r.activity) choose(r.activity);
    });
  }
  function choose(a: ActivityDefinition) {
    attempt.current = null;
    setActivity(a);
    setSupport(null);
  }
  return (
    <div id="nardouch-practice-target"
      lang={workspaceLang}
      className="mx-auto max-w-4xl space-y-6 pb-16"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold">Practice</h2>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="learning-lang-select" className="text-xs font-medium">
            Language:
          </label>
          <select
            id="learning-lang-select"
            aria-label="Interface language"
            value={workspaceLang}
            onChange={(e) => changeLanguage(e.target.value as WorkspaceLanguage)}
            className="rounded border p-1 text-sm bg-background"
          >
            <option value="en">English (en)</option>
            <option value="fr">Français (fr)</option>
            <option value="ar">العربية (ar)</option>
            <option value="ary">الدارجة (ary)</option>
          </select>
        </div>
      </div>
      {workspaceLang !== "en" && (
        <p className="text-xs text-muted-foreground">
          Translated on this screen only; the rest of the workspace stays in
          English.
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t.disclaimer}</p>
      <section
        aria-label={t.nextStep}
        className="rounded-xl border p-5 space-y-4"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.nextStep}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {objectiveTitle(objectiveId)}
          </h2>
          {progress && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t.progressLine
                .replace("{done}", String(progress.masteredObjectiveIds.length))
                .replace("{total}", String(objectives.length))}
            </p>
          )}
        </div>
        <label className="block text-sm">
          {t.objective}{" "}
          <select
            aria-label="Learning objective"
            value={objectiveId}
            onChange={(e) => {
              objectiveTouched.current = true;
              setObjective(e.target.value);
              setActivity(null);
              setAnswer(null);
              setLastResult(null);
              setNoActivity(false);
            }}
            className="mt-1 block w-full rounded-md border bg-background p-2"
          >
            {objectives.map((o) => (
              <option key={o.objectiveId} value={o.objectiveId}>
                {o.statement}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !objectiveId || !hasReviewedPractice}
            onClick={() => startActivity("practice")}
          >
            {t.startPractice}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              tutorRef.current?.scrollIntoView({ behavior: "smooth" })
            }
          >
            {t.askTutor}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p role="status" className="text-sm">
          {!hasReviewedPractice ? t.noActivity : message}
        </p>
        {rationale && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">{t.whyActivity}</summary>
            <p className="mt-1">{rationale}</p>
          </details>
        )}
        {noActivity && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                tutorRef.current?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {t.askTutor}
            </Button>
            {visualConcepts > 0 && (
              <Button variant="outline" asChild>
                <a href="#explore-visually">{t.exploreVisually}</a>
              </Button>
            )}
          </div>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            {t.moreOptions}
          </summary>
          <div className="mt-3 space-y-3">
            <label>
              {t.intent}{" "}
              <select
                aria-label="Learning intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                className="m-2 border p-2"
              >
                <option value="practice">{t.practice}</option>
                <option value="check">{t.check}</option>
                <option value="explain">{t.explain}</option>
              </select>
            </label>
            <label>
              {t.type}{" "}
              <select
                aria-label="Activity type"
                value={activityType}
                onChange={(e) => setType(e.target.value)}
                className="m-2 border p-2"
              >
                <option value="">{t.anyType}</option>
                <option>InteractiveQuiz</option>
                <option>GuidedProblem</option>
              </select>
            </label>
            <Button
              variant="outline"
              disabled={busy || !objectiveId || !hasReviewedPractice}
              onClick={() => startActivity(intent)}
            >
              {t.select}
            </Button>
            {activities.length >= 2 && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await learningDiagnostic(
                      context.courseId,
                      context.revisionId,
                    );
                    setChecks(r.checks);
                    setMessage(r.policy);
                  })
                }
              >
                {t.diagnostic}
              </Button>
            )}
            {checks.map((a, i) => (
              <Button
                key={a.activityId}
                variant="outline"
                onClick={() => choose(a)}
              >
                Check {i + 1}: {a.title}
              </Button>
            ))}
            <div className="flex flex-wrap gap-2">
              {activities
                .filter((a) => a.objectiveId === objectiveId)
                .map((a) => (
                  <Button
                    key={a.activityId}
                    variant="outline"
                    onClick={() => choose(a)}
                  >
                    Open {a.title}
                  </Button>
                ))}
            </div>
            <p className="text-muted-foreground">
              {activities.length} reviewed activities. Practice adapts to exact
              accepted evidence using a reproducible structural-demand policy.
              Untested learners remain unassessed; no ability level is
              inferred.
            </p>
          </div>
        </details>
      </section>
      {activity && (
        <ActivityRenderer
          key={activity.activityId}
          activity={activity}
          authenticatedUserId={userId}
          onSubmitAttempt={async (answers, seconds) => {
            if (!attempt.current)
              attempt.current = { id: crypto.randomUUID(), answers, seconds };
            const fixed = attempt.current;
            const result = await sendLearningAttempt(
              activity,
              fixed.id,
              fixed.answers,
              fixed.seconds,
            );
            if (result.status === "graded") {
              attempt.current = null;
              setLastResult({ isCorrect: result.isCorrect });
            }
            await refresh();
            return result;
          }}
        />
      )}
      {activity && lastResult && (
        <section
          aria-label={t.whatsNext}
          className="rounded-xl border p-5 space-y-3"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <h2 className="font-semibold">{t.whatsNext}</h2>
          <p role="status" className="text-sm">
            {lastResult.isCorrect ? t.correctLead : t.incorrectLead}
          </p>
          <div className="flex flex-wrap gap-2">
            {lastResult.isCorrect &&
              progress?.recommendation &&
              progress.recommendation.objectiveId !== objectiveId && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    const next = progress.recommendation!.objectiveId;
                    objectiveTouched.current = true;
                    setObjective(next);
                    setAnswer(null);
                    startActivity("practice", next);
                  }}
                >
                  {t.nextObjective}
                </Button>
              )}
            {!lastResult.isCorrect && (
              <Button
                variant="outline"
                onClick={() =>
                  tutorRef.current?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {t.askTutor}
              </Button>
            )}
            {visualConcepts > 0 && (
              <Button variant="outline" asChild>
                <a href="#explore-visually">{t.exploreVisually}</a>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/study-together?courseId=${context.courseId}`}>
                {t.studyPeers}
              </Link>
            </Button>
          </div>
        </section>
      )}
      {activity && (
        <section
          aria-label="Private source support"
          className="rounded-xl border p-5 space-y-3"
        >
          <h2 className="font-semibold">{t.sourceSupport}</h2>
          <LearningStylePanel />
          <Button
            disabled={busy}
            onClick={() =>
              run(async () =>
                setSupport(
                  await requestLearningSupport(context.courseId, {
                    revisionId: context.revisionId,
                    activityId: activity.activityId,
                    mode: "hint",
                  }),
                ),
              )
            }
          >
            {t.requestHint}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !support}
            onClick={() =>
              run(async () =>
                setSupport(
                  await requestLearningSupport(context.courseId, {
                    revisionId: context.revisionId,
                    activityId: activity.activityId,
                    mode: "explain",
                  }),
                ),
              )
            }
          >
            {t.requestExplanation}
          </Button>
          {support && (
            <div role="status" className="space-y-2">
              <AiModeNote mode={support.executionMode} />
              <p className="whitespace-pre-wrap">{support.text}</p>
              <p>{support.policy}</p>
              {support.confusion?.tentative && (
                <p className="text-sm">
                  This step looks tricky. You can ask for the full source
                  explanation, or talk it through with a peer in a{" "}
                  <Link href="/study-together" className="underline">
                    study room
                  </Link>
                  .
                </p>
              )}
            </div>
          )}
        </section>
      )}
      <section
        ref={tutorRef}
        className="rounded-xl border p-5 space-y-3"
      >
        <NardouchAssistant
          key={`${context.courseId}:${context.revisionId}`}
          courseId={context.courseId} revisionId={context.revisionId}
          userId={userId} objectiveId={objectiveId || undefined}
          onPractice={() => {
            void startActivity("practice");
            document.getElementById("nardouch-practice-target")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <details className="border-t pt-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">Source excerpt lookup</summary>
        <h3 className="font-semibold mt-3">Source-grounded tutor</h3>
        <label className="block">
          Your question
          <textarea
            aria-label="Tutor question"
            className="block w-full rounded border p-3"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <Button
          disabled={busy || !question.trim()}
          onClick={() =>
            run(async () => {
              const objective = objectives.find(
                (o) => o.objectiveId === objectiveId,
              );
              if (!objective) throw new Error("Choose a published objective");
              setAnswer(null);
              setAsking(true);
              try {
                setAnswer(
                  await askLearningTutor(context.courseId, {
                    revisionId: context.revisionId,
                    topicId: objective.topicId,
                    objectiveId,
                    question,
                  }),
                );
              } finally {
                setAsking(false);
              }
            }, "tutor")
          }
        >
          {asking ? "Loading…" : "Ask from sources"}
        </Button>
        {asking && <AiWaitStatus />}
        {tutorError && (
          <p role="alert" className="text-sm text-destructive">
            {tutorError}
          </p>
        )}
        {answer && (
          <div data-testid="tutor-answer">
            <AiModeNote mode={answer.executionMode} />
            <p className="whitespace-pre-wrap">
              {answer.answer || "No verified answer available."}
            </p>
            {answer.citations?.map((c, i) => (
              <a
                className="block underline"
                key={i}
                href={`/api/v1/study/courses/${encodeURIComponent(context.courseId)}/revisions/${encodeURIComponent(context.revisionId)}/sources/${encodeURIComponent(c.documentId)}${c.pageNumber ? "#page=" + c.pageNumber : ""}`}
              >
                Source {i + 1}
                {c.pageNumber ? `, page ${c.pageNumber}` : " (text; no page)"}
              </a>
            ))}
          </div>
        )}
        </details>
      </section>
      <section className="rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold">Private progress and attempt history</h2>
        <Button variant="outline" onClick={() => run(refresh)}>
          Refresh private history
        </Button>
        <p>{progress?.policy}</p>
        <p>
          Objectives with accepted mastery evidence:{" "}
          {progress?.masteredObjectiveIds.map(objectiveTitle).join(", ") ||
            "None"}
        </p>
        {progress?.recommendation && (
          <p>
            Next objective: {objectiveTitle(progress.recommendation.objectiveId)}.{" "}
            {progress.recommendation.reason}
          </p>
        )}
        {progress?.history.map((h) => (
          <div key={h.attemptId} className="border-t py-2">
            <p>
              {h.activityId} — {h.result.status}
            </p>
            {h.result.status === "graded" && (
              <p>
                {h.result.isCorrect ? "Correct" : "Incorrect"}:{" "}
                {h.result.feedback} — mastery{" "}
                {progress.masteredObjectiveIds.includes(
                  activities.find((a) => a.activityId === h.activityId)
                    ?.objectiveId || "",
                )
                  ? "accepted"
                  : "not achieved"}
              </p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
