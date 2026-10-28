"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AiModeNote,
  AiWaitStatus,
} from "@/features/ai-status/ai-status-view";
import { ActivityRenderer } from "./activity-renderer";
import {
  learningProgress,
  selectLearning,
  learningDiagnostic,
  sendLearningAttempt,
  askLearningTutor,
  requestLearningSupport,
} from "./journey-actions";
import type { learningCatalog } from "./journey-actions";
import type { ActivityDefinition } from "@/lib/activity-contracts";
export function LearningWorkspace({
  catalog,
  userId,
}: {
  catalog: Awaited<ReturnType<typeof learningCatalog>>;
  userId: string;
}) {
  const { context, activities } = catalog;
  const objectives = context.topics.flatMap((t) =>
    t.objectives.map((o) => ({ ...o, topicId: t.topicId })),
  );
  const [objectiveId, setObjective] = useState(
    objectives[0]?.objectiveId || "",
  );
  const [activityType, setType] = useState("InteractiveQuiz"),
    [intent, setIntent] = useState("practice");
  const [activity, setActivity] = useState<ActivityDefinition | null>(null),
    [message, setMessage] = useState(
      "Choose an objective and a reviewed activity.",
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
  const [workspaceLang, setWorkspaceLang] = useState<"en" | "fr" | "ar" | "ary">("en");
  const isRtl = workspaceLang === "ar" || workspaceLang === "ary";
  const [checks, setChecks] = useState<ActivityDefinition[]>([]);
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
      disclaimer: "المعادلات والأكواد البرمجية تاتبقى بالشكل الأصلي ديالها.",
    },
  }[workspaceLang];
  async function refresh() {
    setProgress(await learningProgress(context.courseId, context.revisionId));
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
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Learning unavailable");
      setActivity(null);
      setAnswer(null);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }
  function choose(a: ActivityDefinition) {
    attempt.current = null;
    setActivity(a);
    setSupport(null);
  }
  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      lang={workspaceLang}
      className="mx-auto max-w-4xl space-y-6 pb-16"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Learn: {context.title}</h1>
          <p className="text-sm">
            Immutable revision:{" "}
            <span dir="ltr" className="font-mono">
              {context.revisionId}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="learning-lang-select" className="text-xs font-medium">
            Language:
          </label>
          <select
            id="learning-lang-select"
            aria-label="Interface language"
            value={workspaceLang}
            onChange={(e) =>
              setWorkspaceLang(e.target.value as "en" | "fr" | "ar" | "ary")
            }
            className="rounded border p-1 text-sm bg-background"
          >
            <option value="en">English (en)</option>
            <option value="fr">Français (fr)</option>
            <option value="ar">العربية (ar)</option>
            <option value="ary">الدارجة (ary)</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t.disclaimer}</p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <section className="rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold">{t.goal}</h2>
        <label className="block">
          {t.objective}{" "}
          <select
            aria-label="Learning objective"
            value={objectiveId}
            onChange={(e) => {
              setObjective(e.target.value);
              setActivity(null);
              setAnswer(null);
            }}
            className="block w-full border p-2"
          >
            {objectives.map((o) => (
              <option key={o.objectiveId} value={o.objectiveId}>
                {o.statement}
              </option>
            ))}
          </select>
        </label>
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
            <option>InteractiveQuiz</option>
            <option>GuidedProblem</option>
          </select>
        </label>
        <Button
          disabled={busy || !objectiveId}
          onClick={() =>
            run(async () => {
              const r = await selectLearning(context.courseId, {
                revisionId: context.revisionId,
                objectiveId,
                activityType,
                intent,
              });
              setMessage(r.reason + " " + (r.limitation || ""));
              setActivity(null);
              if (r.activity) choose(r.activity);
            })
          }
        >
          {t.select}
        </Button>
        <p role="status">{message}</p>
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
              setMessage(
                r.policy +
                  (r.status === "unavailable"
                    ? " At least two reviewed checks are required."
                    : ""),
              );
            })
          }
        >
          {t.diagnostic}
        </Button>
        {checks.map((a, i) => (
          <Button
            key={a.activityId}
            variant="outline"
            onClick={() => choose(a)}
          >
            Check {i + 1}: {a.title}
          </Button>
        ))}
        <p className="text-sm">
          {activities.length} reviewed activities. Practice adapts to exact
          accepted evidence using a reproducible structural-demand policy.
          Untested learners remain unassessed; no ability level is inferred.
        </p>
      </section>
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
            if (result.status === "graded") attempt.current = null;
            await refresh();
            return result;
          }}
        />
      )}
      {activity && (
        <section
          aria-label="Private source support"
          className="rounded-xl border p-5 space-y-3"
        >
          <h2 className="font-semibold">{t.sourceSupport}</h2>
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
            <div role="status">
              <AiModeNote mode={support.executionMode} />
              <p className="whitespace-pre-wrap">{support.text}</p>
              <p>{support.policy}</p>
            </div>
          )}
        </section>
      )}
      <section className="rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold">Source-grounded tutor</h2>
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
              setAnswer(
                await askLearningTutor(context.courseId, {
                  revisionId: context.revisionId,
                  topicId: objective.topicId,
                  objectiveId,
                  question,
                }),
              );
            })
          }
        >
          {busy ? "Loading…" : "Ask from sources"}
        </Button>
        {busy && <AiWaitStatus />}
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
      </section>
      <section className="rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold">Private progress and attempt history</h2>
        <Button variant="outline" onClick={() => run(refresh)}>
          Refresh private history
        </Button>
        <p>{progress?.policy}</p>
        <p>
          Objectives with accepted mastery evidence:{" "}
          {progress?.masteredObjectiveIds.join(", ") || "None"}
        </p>
        {progress?.recommendation && (
          <p>
            Next objective: {progress.recommendation.objectiveId}.{" "}
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
