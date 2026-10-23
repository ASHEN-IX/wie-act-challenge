"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setRoomPhase, leaveRoom, askFacilitator, requestFacilitatorHint, declineFacilitatorPrompt } from "./actions";
import { PeerChat } from "./peer-chat";
import { usePeerText } from "./use-peer-text";
import { ActionForm } from "@/components/shared/action-form";
import { type RoomSnapshotState, applyRoomSnapshot } from './room-sync';

export interface FacilitatorInterventionInfo {
  interventionId: string;
  strategy:
    | "PEER_CHALLENGE"
    | "SOCRATIC_NUDGE"
    | "CONCEPT_PROMPT"
    | "INCLUSIVE_INVITATION"
    | "CONSENSUS_CHECK"
    | "DISAGREEMENT_RESOLUTION";
  trigger: string;
  targetUserId?: string;
  targetSpeakerName?: string;
  reasoning: string;
  message: string;
  proposedUICommand?: {
    action: string;
    activityId?: string;
    targetPhase?: string;
    reason?: string;
  };
  status: "proposed" | "delivered" | "accepted" | "declined" | "expired";
  cooldownSeconds?: number;
  createdAt?: string;
}

export interface ParticipantInfo {
  userId: string;
  name: string;
  role: string;
  isOnline: boolean;
  isSpeaking?: boolean;
  hasSubmitted?: boolean;
}

export interface RoomStateInfo {
  roomId: string;
  inviteCode?: string;
  title: string;
  currentPhase: "idle" | "peer_discussion" | "individual_attempt" | "debrief";
  presenterUserId: string;
  activeActivityId?: string | null;
  seq: number;
  publicSubmissionsCount: number;
}

interface RoomViewProps {
  leaveCommandId?: string;
  roomId: string;
  currentUserId: string;
  initialRoom: RoomStateInfo;
  initialParticipants: ParticipantInfo[];
  initialInterventions?: FacilitatorInterventionInfo[];
  wsUrl?: string;
}

export function RoomView({
  roomId,
  currentUserId,
  initialRoom,
  initialParticipants,
  initialInterventions = [],
  wsUrl: propWsUrl,
  leaveCommandId,
}: RoomViewProps) {
  const router = useRouter();
  const chat = usePeerText(roomId, currentUserId);
  const { receive: receivePeerMessage, recover: recoverPeerMessages, invalidateRecovery: invalidatePeerRecovery } = chat;
  const pendingPhaseCommand = useRef<{ phase: string; commandId: string; expectedSeq: number } | null>(null);
  const leaveCommand = useRef(leaveCommandId);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "disconnected"
  >("connecting");
  const [{ room, participants, presenceEpoch }, setSnapshot] = useState<RoomSnapshotState>({ room: initialRoom, participants: initialParticipants });
  const [actionError, setActionError] = useState<string>();
  const [activeIntervention, setActiveIntervention] =
    useState<FacilitatorInterventionInfo | null>(
      initialInterventions.find((i) => i.status !== "declined") || null,
    );
  const [hintLevel, setHintLevel] = useState<number>(1);
  const [customQuestion, setCustomQuestion] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [isFacilitatorPending, startFacilitatorTransition] = useTransition();

  const isPresenter = room.presenterUserId === currentUserId;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let stopped = false;
    let attempts = 0;

    const connect = () => {
      const baseWsUrl =
        propWsUrl ||
        process.env.NEXT_PUBLIC_WS_URL ||
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
      const wsUrl = new URL("/ws/realtime", baseWsUrl);
      wsUrl.searchParams.set("roomId", roomId);
      wsUrl.searchParams.set("sessionId", roomId);
      wsUrl.searchParams.set("userId", currentUserId);
      // Cookies are host-scoped, not port-scoped. Keep the local API hostname
      // consistent with the page so the browser supplies its HttpOnly cookie.
      if (['localhost', '127.0.0.1', '[::1]'].includes(wsUrl.hostname) &&
          ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
        wsUrl.hostname = window.location.hostname;
      }

      const connection = new WebSocket(wsUrl.toString());
      socket = connection;
      let recovered = false;

      socket.onopen = () => {
        if (stopped || socket !== connection) return;
        setSnapshot((previous) => ({ ...previous, presenceEpoch: undefined, presenceVersion: undefined }));
        attempts = 0;
        setConnectionStatus("connected");
      };

      socket.onmessage = (event) => {
        if (stopped || socket !== connection) return;
        try {
          const data = JSON.parse(event.data);
          if (data.roomId === roomId && data.type === "ROOM_PEER_MESSAGE") receivePeerMessage(data.message);
          if (data.roomId === roomId && data.type === "ROOM_STATE_SYNC" && !recovered) {
            recovered = true;
            void recoverPeerMessages(() => !stopped && socket === connection && connection.readyState === WebSocket.OPEN);
          }
          if (["ROOM_STATE_SYNC", "ROOM_PRESENCE_SYNC"].includes(data.type) && data.roomId === roomId) {
            setSnapshot((previous) => applyRoomSnapshot(previous, data));
          }

          if (
            data.type === "FACILITATOR_INTERVENTION" &&
            data.roomId === roomId &&
            data.intervention
          ) {
            setActiveIntervention(data.intervention);
          }

          if (data.type === "FACILITATOR_DECLINED" && data.roomId === roomId) {
            setActiveIntervention((prev) => {
              if (prev && prev.interventionId === data.interventionId) {
                return null;
              }
              return prev;
            });
          }
        } catch {
          // ignore unparseable payload
        }
      };

      socket.onerror = () => {
        if (stopped || socket !== connection) return;
        setConnectionStatus("reconnecting");
      };

      socket.onclose = (event) => {
        if (stopped || socket !== connection) return;
        invalidatePeerRecovery();
        if ([4401, 4403, 4001, 4003].includes(event.code)) {
          setConnectionStatus("disconnected");
          router.refresh();
          return;
        }
        setConnectionStatus("reconnecting");
        reconnectTimeout = setTimeout(
          connect,
          Math.min(30000, 1000 * 2 ** attempts++),
        );
      };
    };

    connect();

    return () => {
      stopped = true;
      invalidatePeerRecovery();
      clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, [roomId, currentUserId, router, propWsUrl, receivePeerMessage, recoverPeerMessages, invalidatePeerRecovery]);

  const handlePhaseChange = (phase: string) => {
    if (pendingPhaseCommand.current?.phase !== phase) {
      pendingPhaseCommand.current = { phase, commandId: crypto.randomUUID(), expectedSeq: room.seq };
    }
    const command = pendingPhaseCommand.current;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", roomId);
      formData.set("phase", phase);
      formData.set('commandId', command.commandId);
      formData.set('expectedSeq', String(command.expectedSeq));
      const result = await setRoomPhase({ error: undefined }, formData);
      if (!result.retryable) pendingPhaseCommand.current = null;
      setActionError(result.error);
    });
  };

  const handleAskFacilitator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;
    startFacilitatorTransition(async () => {
      const formData = new FormData();
      formData.set("id", roomId);
      formData.set("prompt", customQuestion);
      await askFacilitator({ error: undefined }, formData);
      setCustomQuestion("");
    });
  };

  const handleRequestHint = () => {
    startFacilitatorTransition(async () => {
      const formData = new FormData();
      formData.set("id", roomId);
      formData.set("hintLevel", String(hintLevel));
      await requestFacilitatorHint({ error: undefined }, formData);
      setHintLevel((prev) => (prev === 1 ? 2 : 1));
    });
  };

  const handleDeclinePrompt = () => {
    if (!activeIntervention) return;
    startFacilitatorTransition(async () => {
      const formData = new FormData();
      formData.set("id", roomId);
      formData.set("interventionId", activeIntervention.interventionId);
      await declineFacilitatorPrompt({ error: undefined }, formData);
      setActiveIntervention(null);
    });
  };

  const handleAcceptCommand = () => {
    if (activeIntervention?.proposedUICommand?.targetPhase) {
      handlePhaseChange(activeIntervention.proposedUICommand.targetPhase);
    }
  };

  const isTargetedToMe = activeIntervention?.targetUserId === currentUserId;

  const strategyLabels: Record<
    string,
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    PEER_CHALLENGE: { label: "Peer Challenge", variant: "default" },
    SOCRATIC_NUDGE: { label: "Socratic Nudge", variant: "secondary" },
    CONCEPT_PROMPT: { label: "Concept Prompt", variant: "outline" },
    INCLUSIVE_INVITATION: { label: "Inclusive Invitation", variant: "outline" },
    CONSENSUS_CHECK: { label: "Consensus Check", variant: "secondary" },
    DISAGREEMENT_RESOLUTION: { label: "Peer Resolution", variant: "default" },
  };

  const phaseLabels: Record<string, string> = {
    idle: "Waiting to Start",
    peer_discussion: "Peer Discussion",
    individual_attempt: "Individual Practice",
    debrief: "Group Debrief",
  };

  return (
    <div className="flex flex-col gap-6">
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      {/* Top Authoritative State Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex items-center gap-3">
          <Badge
            variant={
              room.currentPhase === "peer_discussion"
                ? "default"
                : room.currentPhase === "individual_attempt"
                  ? "secondary"
                  : "outline"
            }
            className="text-xs font-semibold capitalize"
          >
            {phaseLabels[room.currentPhase] || room.currentPhase}
          </Badge>

          <span className="text-xs text-muted-foreground">
            Seq #{room.seq}
          </span>

          {room.inviteCode && (
            <span className="text-xs text-muted-foreground">
              Invite:{" "}
              <code className="font-mono font-bold text-foreground">
                {room.inviteCode}
              </code>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-emerald-500"
                : connectionStatus === "reconnecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-rose-500"
            }`}
          />
          <span className="text-xs capitalize text-muted-foreground">
            {connectionStatus}
          </span>
        </div>
      </div>

      {/* Phase Guidance Banner */}
      <div className="rounded-lg border border-border/80 bg-muted/40 p-4">
        {room.currentPhase === "idle" && (
          <p className="text-sm text-muted-foreground">
            {isPresenter
              ? "You are the presenter. Click 'Start Peer Discussion' when your team is ready."
              : "Waiting for the presenter to start the collaboration session."}
          </p>
        )}
        {room.currentPhase === "peer_discussion" && (
          <p className="text-sm leading-6">
            <strong>Peer Discussion:</strong> Discuss the concept with your peers.
            The AI facilitator is attentive and will prompt questions if misconceptions arise.
          </p>
        )}
        {room.currentPhase === "individual_attempt" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-6">
              <strong>Individual Practice:</strong> Work through the problem independently.
              Answers remain strictly private to protect learner evaluation integrity.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Progress:{" "}
                <strong className="text-foreground">
                  {room.publicSubmissionsCount} / {participants.length}
                </strong>{" "}
                peers submitted
              </span>
              <p role="status">Private activity submission is unavailable while the learning service integration is incomplete.</p>
            </div>
          </div>
        )}
        {room.currentPhase === "debrief" && (
          <p className="text-sm leading-6">
            <strong>Group Debrief:</strong> Reviewing collective takeaways and learning milestones.
            Private checks, learning outcomes, and rewards are not integrated yet.
          </p>
        )}
      </div>

      {/* ED-09: Pedagogical AI Facilitator Card */}
      <div className="rounded-lg border border-indigo-500/30 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-600">
              AI
            </span>
            <span className="text-sm font-semibold text-foreground">
              Pedagogical Facilitator
            </span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Peer-First
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2.5"
              onClick={handleRequestHint}
              disabled={isFacilitatorPending}
            >
              {isFacilitatorPending ? "Thinking..." : `Request Hint (L${hintLevel})`}
            </Button>
          </div>
        </div>

        {activeIntervention && (
          <div className="mb-4 rounded-md border border-indigo-200/60 bg-background/80 p-3.5 text-sm dark:border-indigo-900/60">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={strategyLabels[activeIntervention.strategy]?.variant || "default"}
                  className="text-[11px]"
                >
                  {strategyLabels[activeIntervention.strategy]?.label || activeIntervention.strategy}
                </Badge>
                {activeIntervention.targetSpeakerName && (
                  <span className="text-xs font-medium text-muted-foreground">
                    Addressed to: <strong className="text-foreground">{activeIntervention.targetSpeakerName}</strong>
                  </span>
                )}
              </div>

              {isTargetedToMe && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-foreground h-6 px-2"
                  onClick={handleDeclinePrompt}
                  disabled={isFacilitatorPending}
                >
                  Pass / Decline
                </Button>
              )}
            </div>

            <p className="whitespace-pre-wrap leading-relaxed text-foreground">
              {activeIntervention.message}
            </p>

            {isPresenter && activeIntervention.proposedUICommand?.targetPhase && (
              <div className="mt-3 flex items-center gap-2 pt-2 border-t border-border/50">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs h-7"
                  onClick={handleAcceptCommand}
                  disabled={isPending}
                >
                  Accept Suggestion: Move to {phaseLabels[activeIntervention.proposedUICommand.targetPhase]}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Inline Facilitator Query */}
        <form onSubmit={handleAskFacilitator} className="flex gap-2">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder="Ask facilitator a concept question or request peer challenge..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            maxLength={1000}
            disabled={isFacilitatorPending}
          />
          <Button
            type="submit"
            size="sm"
            className="text-xs h-8 px-3"
            disabled={isFacilitatorPending || !customQuestion.trim()}
          >
            {isFacilitatorPending ? "Submitting..." : "Ask AI"}
          </Button>
        </form>
      </div>

      {/* Presenter Controls (Authority check: only presenter can trigger) */}
      {isPresenter && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Presenter Controls
            </span>
            <span className="text-xs text-muted-foreground">
              You control the synchronized room phase
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={room.currentPhase === "peer_discussion" ? "default" : "outline"}
              onClick={() => handlePhaseChange("peer_discussion")}
              disabled={isPending || room.currentPhase === "peer_discussion"}
            >
              Start Peer Discussion
            </Button>
            <Button
              size="sm"
              variant={room.currentPhase === "individual_attempt" ? "default" : "outline"}
              onClick={() => handlePhaseChange("individual_attempt")}
              disabled={isPending || room.currentPhase === "individual_attempt"}
            >
              Open Individual Attempt
            </Button>
            <Button
              size="sm"
              variant={room.currentPhase === "debrief" ? "default" : "outline"}
              onClick={() => handlePhaseChange("debrief")}
              disabled={isPending || room.currentPhase === "debrief"}
            >
              Move to Debrief
            </Button>
          </div>
        </div>
      )}

      <PeerChat chat={chat} connected={connectionStatus === "connected"} />

      {/* Participants Roster with Submission & Online Status */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">
          Room Members ({participants.length})
        </h3>
        <div className="flex flex-col divide-y text-sm">
          {participants.map((p) => {
            const isMe = p.userId === currentUserId;
            const isThisPresenter = p.userId === room.presenterUserId;

            return (
              <div
                key={p.userId}
                data-testid={`participant-${p.userId}`}
                className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-label={!presenceEpoch || connectionStatus !== "connected" ? "Presence unknown" : p.isOnline ? "Online" : "Offline"}
                    className={`inline-block h-2 w-2 rounded-full ${
                      presenceEpoch && connectionStatus === "connected" && p.isOnline ? "bg-emerald-500" : "bg-zinc-400"
                    }`}
                  />
                  <span className="font-medium">
                    {p.name || "Student"} {isMe && "(You)"}
                  </span>
                  {isThisPresenter && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Presenter
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {room.currentPhase === "individual_attempt" && (
                    <span className="text-xs text-muted-foreground">
                      {p.hasSubmitted ? (
                        <span className="text-emerald-600 font-medium">✓ Submitted</span>
                      ) : (
                        "In progress"
                      )}
                    </span>
                  )}
                  <span className="text-xs capitalize text-muted-foreground">
                    {p.role}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leave Room Action */}
      <div className="flex justify-end pt-2">
        <ActionForm action={leaveRoom} submit="Leave room" variant="outline">
          <input type="hidden" name="id" value={roomId} />
          {leaveCommand.current && <input type="hidden" name="commandId" value={leaveCommand.current} />}
          <input type="hidden" name="expectedSeq" value={room.seq} />
        </ActionForm>
      </div>
    </div>
  );
}

