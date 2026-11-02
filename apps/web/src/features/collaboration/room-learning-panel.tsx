"use client";
import { useEffect, useRef, useState } from "react";
import { RoomVisualizer } from "@/features/visualization/room-visualizer";
import { Button } from "@/components/ui/button";
import { ActivityRenderer } from "@/features/learning/activity-renderer";
import { AiModeNote } from "@/features/ai-status/ai-status-view";
import { learningCatalog } from "@/features/learning/journey-actions";
import {
  ownPrivateCheck,
  submitPrivateCheck,
  roomDebrief,
  selectRoomActivity,
  proposeSupport,
  decideSupport,
  type PrivateRoomCheck,
} from "./learning-actions";
import type { RoomStateInfo } from "./room-view";
import type { ActivityDefinition } from "@/lib/activity-contracts";
export function RoomLearningPanel({
  room,
  userId,
}: {
  room: RoomStateInfo;
  userId: string;
}) {
  const [activities, setActivities] = useState<ActivityDefinition[]>([]),
    [selected, setSelected] = useState("");
  const [check, setCheck] = useState<PrivateRoomCheck | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [debrief, setDebrief] = useState<Awaited<
    ReturnType<typeof roomDebrief>
  > | null>(null);
  const [proposal, setProposal] = useState<Awaited<
    ReturnType<typeof proposeSupport>
  > | null>(null);
  const command = useRef<{
    id: string;
    activityId: string;
    seq: number;
  } | null>(null);
  const payload = useRef<{
    answers: Record<string, unknown>;
    seconds: number;
  } | null>(null);
  const presenter = room.presenterUserId === userId;
  useEffect(() => {
    let current = true;
    setActivities([]);
    if (room.courseId)
      learningCatalog(room.courseId, room.revisionId)
        .then((c) => {
          if (current) setActivities(c.activities);
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [room.courseId, room.revisionId]);
  useEffect(() => {
    let current = true;
    setCheck(null);
    setDebrief(null);
    payload.current = null;
    ownPrivateCheck(room.roomId)
      .then((c) => {
        if (current) {
          setCheck(c);
          setError("");
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    if (room.currentPhase === "debrief")
      roomDebrief(room.roomId)
        .then((d) => {
          if (current) setDebrief(d);
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [
    room.roomId,
    room.activeActivityId,
    room.activityRound,
    room.currentPhase,
  ]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Room learning unavailable");
      setCheck(null);
      setDebrief(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-4 rounded-lg border p-4"
      data-testid="room-learning"
    >
      <h2 className="font-semibold">Activity</h2>
      <RoomVisualizer
        roomId={room.roomId}
        seq={room.seq}
        presenter={presenter}
      />
      {(room.revisionId || room.activityRound) && (
        <p className="text-xs text-muted-foreground">
          {room.revisionId ? `Course revision ${room.revisionId}` : ""}
          {room.revisionId && room.activityRound ? " · " : ""}
          {room.activityRound ? `Round ${room.activityRound}` : ""}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {presenter && (
        <div className="space-y-3">
          <label>
            Reviewed room activity
            <select
              aria-label="Reviewed room activity"
              className="block w-full border p-2"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                command.current = null;
              }}
            >
              <option value="">Choose an activity</option>
              {activities.map((a) => (
                <option key={a.activityId} value={a.activityId}>
                  {a.activityType}: {a.title}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={busy || !selected}
            onClick={() =>
              run(async () => {
                if (!command.current)
                  command.current = {
                    id: crypto.randomUUID(),
                    activityId: selected,
                    seq: room.seq,
                  };
                const c = command.current;
                const outcome = await selectRoomActivity(
                  room.roomId,
                  c.activityId,
                  c.id,
                  c.seq,
                );
                if (outcome.error) {
                  if (!outcome.retryable) command.current = null;
                  throw new Error(outcome.error);
                }
                command.current = null;
              })
            }
          >
            Start selected activity
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(async () => setProposal(await proposeSupport(room.roomId)))
            }
          >
            Request peer-first proposal
          </Button>
          {proposal && (
            <div className="rounded border p-3">
              <AiModeNote mode={proposal.executionMode} />
              <p>{proposal.message}</p>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await decideSupport(
                      room.roomId,
                      proposal.proposalId,
                      "accept",
                    );
                    setProposal(null);
                  })
                }
              >
                Accept validated proposal
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await decideSupport(
                      room.roomId,
                      proposal.proposalId,
                      "decline",
                    );
                    setProposal(null);
                  })
                }
              >
                Decline proposal
              </Button>
            </div>
          )}
        </div>
      )}
      <p>
        Public completion: {room.publicSubmissionsCount}. Completion does not
        imply mastery.
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          run(async () => setCheck(await ownPrivateCheck(room.roomId)))
        }
      >
        Recover my private check
      </Button>
      {check && (
        <p>
          Private check: {check.status} {check.message} {check.checkId}
        </p>
      )}
      {check?.activity && check.checkId && (
        <ActivityRenderer
          key={`${check.checkId}:${check.result?.status || "new"}`}
          activity={check.activity}
          authenticatedUserId={userId}
          mode="room"
          initialResult={check.result || undefined}
          onSubmitAttempt={async (answers, seconds) => {
            if (!payload.current) payload.current = { answers, seconds };
            const fixed = payload.current;
            return submitPrivateCheck(
              room.roomId,
              check.checkId!,
              fixed.answers,
              fixed.seconds,
            );
          }}
        />
      )}
      {check?.activity?.sourceRefs.map((source, i) => (
        <a
          key={i}
          className="block underline"
          href={`/api/v1/study/courses/${encodeURIComponent(check.activity!.courseId)}/revisions/${encodeURIComponent(check.activity!.revisionId)}/sources/${encodeURIComponent(source.documentId)}${source.pageNumber ? "#page=" + source.pageNumber : ""}`}
        >
          Reviewed source {i + 1}
          {source.pageNumber ? ", page " + source.pageNumber : " (text)"}
        </a>
      ))}
      {room.currentPhase === "debrief" && (
        <div data-testid="private-debrief">
          <h3 className="font-semibold">Debrief</h3>
          {debrief ? (
            <>
              <p>
                {debrief.recap.publicSubmissionsCount} /{" "}
                {debrief.recap.participantsCount} participants submitted.
              </p>
              <p>{debrief.recap.privacyPolicy}</p>
              <p>
                Your check: {debrief.privateCheck.status}. Your feedback is
                shown only above.
              </p>
            </>
          ) : (
            <p>Loading authorized debrief…</p>
          )}
        </div>
      )}
    </section>
  );
}
