"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  setRoomPhase,
  leaveRoom,
  askFacilitator,
  requestFacilitatorHint,
  declineFacilitatorPrompt,
} from "./actions";
import { PeerChat } from "./peer-chat";
import { usePeerText } from "./use-peer-text";
import { ActionForm } from "@/components/shared/action-form";
import {
  type RoomSnapshotState,
  applyInterventionSeq,
  applyRoomSnapshot,
} from "./room-sync";

import { PrivateHelpPanel } from "./private-help-panel";
import { RoomLearningPanel } from "./room-learning-panel";
import { VoiceModeratorControls } from "./voice-moderator-controls";
import { Whiteboard } from "../whiteboard/whiteboard";
import { InvitePanel } from "../community/invite-panel";

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
  executionMode?: string;
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
  hasVoiceConsent?: boolean;
  hasSubmitted?: boolean;
}

export interface RoomStateInfo {
  courseId?: string;
  revisionId?: string;
  activityRound?: string;
  activePin?: Record<string, string> | null;
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
  const {
    receive: receivePeerMessage,
    recover: recoverPeerMessages,
    invalidateRecovery: invalidatePeerRecovery,
  } = chat;
  const pendingPhaseCommand = useRef<{
    phase: string;
    commandId: string;
    expectedSeq: number;
  } | null>(null);
  const leaveCommand = useRef(leaveCommandId);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "disconnected"
  >("connecting");
  const [{ room, participants, presenceEpoch }, setSnapshot] =
    useState<RoomSnapshotState>({
      room: initialRoom,
      participants: initialParticipants,
    });
  const [actionError, setActionError] = useState<string>();
  const [activeIntervention, setActiveIntervention] =
    useState<FacilitatorInterventionInfo | null>(
      initialInterventions.find((i) => i.status !== "declined") || null,
    );
  const [hintLevel, setHintLevel] = useState<number>(1);
  const [customQuestion, setCustomQuestion] = useState<string>("");
  const [tab, setTab] = useState<"chat" | "help" | "voice">("chat");
  // The board is mounted on first use and then kept mounted, so switching back
  // to the activity never loses it.
  const [mainView, setMainView] = useState<"activity" | "board">("activity");
  const [boardOpened, setBoardOpened] = useState(false);
  const [boardSignal, setBoardSignal] = useState<{
    version: number;
    locked: boolean;
  } | null>(null);
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
      if (
        ["localhost", "127.0.0.1", "[::1]"].includes(wsUrl.hostname) &&
        ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
      ) {
        wsUrl.hostname = window.location.hostname;
      }

      const connection = new WebSocket(wsUrl.toString());
      socket = connection;
      let recovered = false;

      socket.onopen = () => {
        if (stopped || socket !== connection) return;
        setSnapshot((previous) => ({
          ...previous,
          presenceEpoch: undefined,
          presenceVersion: undefined,
        }));
        attempts = 0;
        setConnectionStatus("connected");
      };

      socket.onmessage = (event) => {
        if (stopped || socket !== connection) return;
        try {
          const data = JSON.parse(event.data);
          if (data.roomId === roomId && data.type === "ROOM_PEER_MESSAGE")
            receivePeerMessage(data.message);
          if (
            data.roomId === roomId &&
            data.type === "ROOM_STATE_SYNC" &&
            !recovered
          ) {
            recovered = true;
            void recoverPeerMessages(
              () =>
                !stopped &&
                socket === connection &&
                connection.readyState === WebSocket.OPEN,
            );
          }
          if (
            ["ROOM_STATE_SYNC", "ROOM_PRESENCE_SYNC"].includes(data.type) &&
            data.roomId === roomId
          ) {
            setSnapshot((previous) => applyRoomSnapshot(previous, data));
          }

          if (
            data.type === "ROOM_WHITEBOARD_SYNC" &&
            data.roomId === roomId &&
            Number.isSafeInteger(data.version) &&
            typeof data.locked === "boolean"
          ) {
            setBoardSignal({ version: data.version, locked: data.locked });
          }

          if (
            data.type === "FACILITATOR_INTERVENTION" &&
            data.roomId === roomId &&
            data.intervention
          ) {
            setActiveIntervention(data.intervention);
            setSnapshot((previous) => applyInterventionSeq(previous, data));
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
  }, [
    roomId,
    currentUserId,
    router,
    propWsUrl,
    receivePeerMessage,
    recoverPeerMessages,
    invalidatePeerRecovery,
  ]);

  const handlePhaseChange = (phase: string) => {
    if (pendingPhaseCommand.current?.phase !== phase) {
      pendingPhaseCommand.current = {
        phase,
        commandId: crypto.randomUUID(),
        expectedSeq: room.seq,
      };
    }
    const command = pendingPhaseCommand.current;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", roomId);
      formData.set("phase", phase);
      formData.set("commandId", command.commandId);
      formData.set("expectedSeq", String(command.expectedSeq));
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
      const result = await askFacilitator({ error: undefined }, formData);
      setActionError(result.error);
      if (!result.error) setCustomQuestion("");
    });
  };

  const handleRequestHint = () => {
    startFacilitatorTransition(async () => {
      const formData = new FormData();
      formData.set("id", roomId);
      formData.set("hintLevel", String(hintLevel));
      const result = await requestFacilitatorHint({ error: undefined }, formData);
      setActionError(result.error);
      if (!result.error) setHintLevel((prev) => (prev === 1 ? 2 : 1));
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
      setActionError(
        "Request a server-validated peer-first proposal before changing room state.",
      );
    }
  };

  const isTargetedToMe = activeIntervention?.targetUserId === currentUserId;

  const strategyLabels: Record<
    string,
    {
      label: string;
      variant: "default" | "secondary" | "outline" | "destructive";
    }
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

  const phaseHint =
    room.currentPhase === "idle"
      ? isPresenter
        ? "Start the discussion when your group is ready."
        : "Waiting for the presenter to start."
      : room.currentPhase === "peer_discussion"
        ? "Talk it through together. Request a hint or ask for guidance when needed."
        : room.currentPhase === "individual_attempt"
          ? "Answer on your own first. Others cannot see your answer yet."
          : "Compare answers and discuss what you learned.";
  const connectionDot =
    connectionStatus === "connected"
      ? "bg-emerald-500"
      : connectionStatus === "reconnecting"
        ? "bg-amber-500 animate-pulse"
        : "bg-rose-500";
  const tabs = [
    { id: "chat", label: "Chat" },
    { id: "help", label: "Help" },
    { id: "voice", label: "Voice" },
  ] as const;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {actionError && (
        <p role="alert" className="text-sm text-destructive lg:col-span-2">
          {actionError}
        </p>
      )}

      {/* Main: one clear thing to do */}
      <section className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Badge
              variant={
                room.currentPhase === "peer_discussion"
                  ? "default"
                  : "secondary"
              }
              className="w-fit"
            >
              {phaseLabels[room.currentPhase] || room.currentPhase}
            </Badge>
            <p className="text-sm text-muted-foreground">{phaseHint}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {room.inviteCode && (
              <span>
                Invite code{" "}
                <code
                  data-testid="invite-code"
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-semibold text-foreground"
                >
                  {room.inviteCode}
                </code>
              </span>
            )}
            <span className="flex items-center gap-1.5 capitalize">
              <span
                className={`inline-block h-2 w-2 rounded-full ${connectionDot}`}
                aria-hidden
              />
              {connectionStatus}
            </span>
          </div>
        </div>

        {isPresenter && (
          <div
            role="group"
            aria-label="Presenter Controls"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="mr-1 text-xs font-medium text-muted-foreground">
              Presenter Controls
            </span>
            {(
              [
                ["peer_discussion", "Start Peer Discussion"],
                ["individual_attempt", "Open Individual Attempt"],
                ["debrief", "Move to Debrief"],
              ] as const
            )
              .filter(
                ([phase]) =>
                  phase !== "individual_attempt" ||
                  !room.courseId ||
                  Boolean(room.activeActivityId && room.activityRound),
              )
              .map(([phase, label]) => (
                <Button
                  key={phase}
                  size="sm"
                  variant={room.currentPhase === phase ? "default" : "outline"}
                  onClick={() => handlePhaseChange(phase)}
                  disabled={isPending || room.currentPhase === phase}
                >
                  {label}
                </Button>
              ))}
          </div>
        )}

        <div role="group" aria-label="Shared workspace" className="flex gap-2">
          {(
            [
              ["activity", "Activity"],
              ["board", "Whiteboard"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={mainView === id ? "default" : "outline"}
              aria-pressed={mainView === id}
              onClick={() => {
                setMainView(id);
                if (id === "board") setBoardOpened(true);
              }}
            >
              {label}
            </Button>
          ))}
        </div>

        <div hidden={mainView !== "activity"}>
          <RoomLearningPanel room={room} userId={currentUserId} />
        </div>
        {boardOpened && (
          <div hidden={mainView !== "board"}>
            <Whiteboard
              roomId={roomId}
              connected={connectionStatus === "connected"}
              signal={boardSignal}
            />
          </div>
        )}

        <div className="flex justify-end">
          <ActionForm action={leaveRoom} submit="Leave room" variant="outline">
            <input type="hidden" name="id" value={roomId} />
            {leaveCommand.current && (
              <input
                type="hidden"
                name="commandId"
                value={leaveCommand.current}
              />
            )}
            <input type="hidden" name="expectedSeq" value={room.seq} />
          </ActionForm>
        </div>
      </section>

      {/* Side: people, then one tool at a time */}
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <div>
          <h3 className="mb-2 text-sm font-semibold">
            Room Members ({participants.length})
          </h3>
          <ul className="flex flex-col divide-y text-sm">
            {participants.map((p) => {
              const isMe = p.userId === currentUserId;
              const online =
                presenceEpoch && connectionStatus === "connected" && p.isOnline;
              return (
                <li
                  key={p.userId}
                  data-testid={`participant-${p.userId}`}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-label={
                        !presenceEpoch || connectionStatus !== "connected"
                          ? "Presence unknown"
                          : p.isOnline
                            ? "Online"
                            : "Offline"
                      }
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                        online ? "bg-emerald-500" : "bg-zinc-400"
                      }`}
                    />
                    <span className="truncate font-medium">
                      {p.name || "Student"} {isMe && "(You)"}
                    </span>
                    {p.userId === room.presenterUserId && (
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[10px]"
                      >
                        Presenter
                      </Badge>
                    )}
                  </span>
                  {room.currentPhase === "individual_attempt" && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {p.hasSubmitted ? (
                        <span className="font-medium text-emerald-600">
                          ✓ Submitted
                        </span>
                      ) : (
                        "In progress"
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <InvitePanel roomId={roomId} />

        <div className="flex flex-col gap-3 rounded-xl border p-3">
          <div role="tablist" aria-label="Room tools" className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                id={`room-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`room-panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  tab === t.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Panels stay mounted so chat history, voice and drafts survive tab changes. */}
          <div
            role="tabpanel"
            id="room-panel-chat"
            aria-labelledby="room-tab-chat"
            hidden={tab !== "chat"}
          >
            <PeerChat
              chat={chat}
              connected={connectionStatus === "connected"}
            />
          </div>

          <div
            role="tabpanel"
            id="room-panel-help"
            aria-labelledby="room-tab-help"
            hidden={tab !== "help"}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  Ask for group guidance
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs"
                  onClick={handleRequestHint}
                  disabled={isFacilitatorPending}
                >
                  {isFacilitatorPending
                    ? "Thinking..."
                    : `Request Hint (L${hintLevel})`}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Guidance may use built-in rules when AI is unavailable. Chat is not automatically monitored.
              </p>

              {activeIntervention && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {activeIntervention.executionMode === "REAL_APPROVED"
                      ? "AI-generated guidance"
                      : activeIntervention.executionMode === "MOCK_TEST"
                        ? "Test guidance"
                        : activeIntervention.executionMode === "DETERMINISTIC_FALLBACK"
                          ? "Built-in guidance"
                          : "Guidance source unavailable"}
                  </p>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          strategyLabels[activeIntervention.strategy]
                            ?.variant || "default"
                        }
                        className="text-[11px]"
                      >
                        {strategyLabels[activeIntervention.strategy]?.label ||
                          activeIntervention.strategy}
                      </Badge>
                      {activeIntervention.targetSpeakerName && (
                        <span className="text-xs text-muted-foreground">
                          For{" "}
                          <strong className="text-foreground">
                            {activeIntervention.targetSpeakerName}
                          </strong>
                        </span>
                      )}
                    </span>
                    {isTargetedToMe && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={handleDeclinePrompt}
                        disabled={isFacilitatorPending}
                      >
                        Pass / Decline
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {activeIntervention.message}
                  </p>
                  {isPresenter &&
                    activeIntervention.proposedUICommand?.targetPhase && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3 h-7 text-xs"
                        onClick={handleAcceptCommand}
                        disabled={isPending}
                      >
                        Accept Suggestion: Move to{" "}
                        {
                          phaseLabels[
                            activeIntervention.proposedUICommand.targetPhase
                          ]
                        }
                      </Button>
                    )}
                </div>
              )}

              <form onSubmit={handleAskFacilitator} className="flex gap-2">
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Ask a concept question or request a peer challenge…"
                  aria-label="Ask the AI facilitator"
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  maxLength={1000}
                  disabled={isFacilitatorPending}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={isFacilitatorPending || !customQuestion.trim()}
                >
                  {isFacilitatorPending ? "Submitting..." : "Ask AI"}
                </Button>
              </form>
            </div>
            <PrivateHelpPanel roomId={room.roomId} />
          </div>

          <div
            role="tabpanel"
            id="room-panel-voice"
            aria-labelledby="room-tab-voice"
            hidden={tab !== "voice"}
          >
            <VoiceModeratorControls
              roomId={room.roomId}
              isPresenterOrHost={isPresenter}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
