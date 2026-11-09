import { load, segment } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { ActionForm } from "@/components/shared/action-form";
import {
  completeSessionTask,
  finishSession,
} from "@/features/learning/session-actions";
export default async function Session({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const result = await load<{
    session: {
      id: string;
      status: string;
      taskProgress?: {
        currentTaskIndex: number;
        tasks: {
          title: string;
          description?: string;
          status: string;
          estimatedMinutes: number;
        }[];
      };
    };
  }>(`/api/v1/study/sessions/${segment(sessionId)}`);
  const session = result.data?.session;
  if (!session)
    return <DataError message={result.error || "Session not found."} />;
  const task =
    session.taskProgress?.tasks[session.taskProgress.currentTaskIndex];
  return (
    <>
      <PageHeader
        title={task?.title || "Your study session"}
        description={
          task
            ? `Allow about ${task.estimatedMinutes} minutes for this topic.`
            : "Review your progress and finish when you are ready."
        }
      />
      <div className="max-w-2xl">
        <p className="mb-8 whitespace-pre-wrap text-base leading-8">
          {task?.description}
        </p>
        {session.status === "active" && (
          <div className="flex flex-wrap gap-5">
            {task && (
              <ActionForm
                action={completeSessionTask}
                submit="Complete this topic"
              >
                <input type="hidden" name="id" value={sessionId} />
              </ActionForm>
            )}
            <ActionForm
              action={finishSession}
              submit="Finish session"
              variant="outline"
            >
              <input type="hidden" name="id" value={sessionId} />
            </ActionForm>
          </div>
        )}
        <ol className="mt-10 flex flex-col gap-4 border-t pt-6">
          {session.taskProgress?.tasks.map((item, i) => (
            <li key={i} className="flex justify-between gap-4 text-sm">
              <span>{item.title}</span>
              <span className="text-muted-foreground">{item.status}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
