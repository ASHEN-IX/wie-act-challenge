"use client";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActionForm, SubmitButton } from "@/components/shared/action-form";
import { readJob } from "./actions";
import type { FormAction } from "@/lib/action-state";
function ResultContent({ value }: { value: unknown }) {
  if (typeof value === "string")
    return <p className="whitespace-pre-wrap text-sm leading-7">{value}</p>;
  if (Array.isArray(value))
    return (
      <div className="flex flex-col gap-4">
        {value.slice(0, 30).map((item, i) => (
          <ResultContent value={item} key={i} />
        ))}
      </div>
    );
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value).filter(
    ([key]) =>
      ![
        "userId",
        "sessionId",
        "correlationId",
        "_id",
        "createdAt",
        "updatedAt",
      ].includes(key),
  );
  return (
    <dl className="flex flex-col gap-4">
      {entries.slice(0, 30).map(([key, item]) => (
        <div key={key}>
          <dt className="mb-1 text-xs font-medium capitalize text-muted-foreground">
            {key.replaceAll("_", " ")}
          </dt>
          <dd>
            {typeof item === "number" || typeof item === "boolean" ? (
              String(item)
            ) : (
              <ResultContent value={item} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function JobForm({
  action,
  kind,
  children,
  submit,
  finalize,
}: {
  action: FormAction;
  finalize?: FormAction;
  kind: "eval" | "search" | "ai";
  children: ReactNode;
  submit: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [job, setJob] = useState<{
    status: string;
    result?: unknown;
    error?: string;
    fallbackUsed?: boolean;
  }>();
  useEffect(() => {
    if (!state.jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;
    const poll = async () => {
      try {
        const result = await readJob(kind, state.jobId!);
        if (cancelled) return;
        const status = result.status.toLowerCase();
        setJob({
          ...result,
          error: result.error
            ? "The job failed. You can retry your request."
            : undefined,
        });
        if (["completed", "succeeded", "failed", "cancelled"].includes(status))
          return;
        if (++count >= 60) {
          setJob({
            status: "pending",
            error:
              "Still waiting. Your job remains queued; refresh later rather than resubmitting.",
          });
          return;
        }
        timer = setTimeout(poll, 2000);
      } catch {
        if (!cancelled)
          setJob({
            status: "unavailable",
            error: "Unable to check this job. Try again later.",
          });
      }
    };
    setJob({ status: "pending" });
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.jobId, kind]);
  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-5">
        {children}
        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <div>
          <SubmitButton>{submit}</SubmitButton>
        </div>
      </form>
      {job && (
        <section
          aria-live="polite"
          className="flex flex-col gap-4 rounded-lg border p-6"
        >
          <h2 className="font-semibold">
            {kind === "eval" ? "Your feedback" : "Results"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Status: {job.status}
            {job.fallbackUsed ? " · Fallback used" : ""}
          </p>
          {job.error && <p className="text-sm text-destructive">{job.error}</p>}
          {job.result != null && <ResultContent value={job.result} />}
          {finalize &&
            state.correlationId &&
            job.status.toLowerCase() === "completed" && (
              <ActionForm action={finalize} submit="Save plan and tasks">
                <input
                  type="hidden"
                  name="correlationId"
                  value={state.correlationId}
                />
              </ActionForm>
            )}
        </section>
      )}
    </div>
  );
}
