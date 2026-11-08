/**
 * In-app Focus Mode state machine.
 *
 * Pure and clock-injected so it is testable and cannot drift with timer
 * throttling: elapsed time is derived from timestamps, never from counting
 * ticks. It makes no claim about attention. It only measures how long the
 * learner kept a session running.
 */

export const MIN_MINUTES = 5;
export const MAX_MINUTES = 180;
/** If the page was not heard from for this long, the gap is not counted. */
export const STALE_AFTER_MS = 2 * 60 * 1000;

type Common = {
  plannedMs: number;
  /** Deep Focus: started automatically, open-ended (plannedMs is only a safety cap). */
  auto: boolean;
  objective: string;
  /** Route the learner started from, so we can offer a way back. */
  route: string;
  startedAt: number;
};
export type FocusState =
  | { status: "idle" }
  | (Common & { status: "running"; focusedMs: number; lastResumeAt: number; lastSeenAt: number })
  | (Common & { status: "paused"; focusedMs: number })
  | (Common & { status: "ended"; focusedMs: number; endedAt: number; completed: boolean });

export const IDLE: FocusState = { status: "idle" };

export function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 25;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));
}

export function startFocus(now: number, minutes: number, objective: string, route: string): FocusState {
  return {
    status: "running",
    plannedMs: clampMinutes(minutes) * 60_000,
    auto: false,
    objective: objective.trim().slice(0, 140),
    route,
    startedAt: now,
    focusedMs: 0,
    lastResumeAt: now,
    lastSeenAt: now,
  };
}

/** Deep Focus: no timer to set. The planned length is only a safety cap. */
export function startAutoFocus(now: number, route: string): FocusState {
  return {
    status: "running",
    plannedMs: MAX_MINUTES * 60_000,
    auto: true,
    objective: "",
    route,
    startedAt: now,
    focusedMs: 0,
    lastResumeAt: now,
    lastSeenAt: now,
  };
}

/** Learner has been idle or away for long enough that the gap is not study time. */
export const IDLE_AFTER_MS = 5 * 60 * 1000;

export function focusedMs(state: FocusState, now: number): number {
  if (state.status === "idle") return 0;
  if (state.status === "running") return state.focusedMs + Math.max(0, now - state.lastResumeAt);
  return state.focusedMs;
}

export function remainingMs(state: FocusState, now: number): number {
  if (state.status === "idle") return 0;
  return Math.max(0, state.plannedMs - focusedMs(state, now));
}

export function pauseFocus(state: FocusState, now: number): FocusState {
  if (state.status !== "running") return state;
  const { lastResumeAt, lastSeenAt, ...rest } = state;
  void lastResumeAt;
  void lastSeenAt;
  return { ...rest, status: "paused", focusedMs: focusedMs(state, now) };
}

export function resumeFocus(state: FocusState, now: number): FocusState {
  if (state.status !== "paused") return state;
  return { ...state, status: "running", lastResumeAt: now, lastSeenAt: now };
}

export function endFocus(state: FocusState, now: number): FocusState {
  if (state.status !== "running" && state.status !== "paused") return state;
  const total = Math.min(focusedMs(state, now), state.plannedMs);
  return {
    status: "ended",
    plannedMs: state.plannedMs,
    auto: state.auto,
    objective: state.objective,
    route: state.route,
    startedAt: state.startedAt,
    focusedMs: total,
    endedAt: now,
    completed: total >= state.plannedMs,
  };
}

/** Ends a running session by itself once its planned time has been reached. */
export function tick(state: FocusState, now: number): FocusState {
  if (state.status !== "running") return state;
  if (remainingMs(state, now) <= 0) return endFocus(state, now);
  return { ...state, lastSeenAt: now };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Validates stored JSON. A running session that was not seen recently becomes
 * paused at the last time it was seen, so a closed laptop never banks study time.
 */
export function restoreFocus(raw: string | null, now: number): FocusState {
  if (!raw) return IDLE;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return IDLE;
  }
  if (!value || typeof value !== "object") return IDLE;
  const v = value as Record<string, unknown>;
  if (
    !isNum(v.plannedMs) ||
    v.plannedMs < MIN_MINUTES * 60_000 ||
    v.plannedMs > MAX_MINUTES * 60_000 ||
    !isNum(v.startedAt) ||
    !isNum(v.focusedMs) ||
    typeof v.objective !== "string" ||
    typeof v.route !== "string" ||
    !v.route.startsWith("/")
  )
    return IDLE;
  const common = {
    plannedMs: v.plannedMs,
    auto: v.auto === true,
    objective: v.objective.slice(0, 140),
    route: v.route.slice(0, 300),
    startedAt: v.startedAt,
  };
  if (v.status === "paused") return { ...common, status: "paused", focusedMs: Math.min(v.focusedMs, v.plannedMs) };
  if (v.status === "running" && isNum(v.lastResumeAt) && isNum(v.lastSeenAt)) {
    const running: FocusState = {
      ...common,
      status: "running",
      focusedMs: v.focusedMs,
      lastResumeAt: v.lastResumeAt,
      lastSeenAt: v.lastSeenAt,
    };
    if (now - v.lastSeenAt > STALE_AFTER_MS) {
      return {
        ...common,
        status: "paused",
        focusedMs: Math.min(v.plannedMs, v.focusedMs + Math.max(0, v.lastSeenAt - v.lastResumeAt)),
      };
    }
    return tick(running, now);
  }
  if (v.status === "ended" && isNum(v.endedAt) && typeof v.completed === "boolean") {
    return { ...common, status: "ended", focusedMs: Math.min(v.focusedMs, v.plannedMs), endedAt: v.endedAt, completed: v.completed };
  }
  return IDLE;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Neutral, non-judgemental follow-up. Time spent never implies mastery. */
export function nextStepFor(state: Extract<FocusState, { status: "ended" }>): string {
  if (state.auto && state.focusedMs >= 60_000)
    return "Take a short break, then check what you learned by explaining it to the tutor or a peer.";
  if (state.focusedMs < 60_000) return "That was a short one. Start again whenever you are ready.";
  if (state.completed)
    return "Take a short break, then check what you learned by explaining it to the tutor or a peer.";
  return "You stopped before the planned time. Pick up where you left off, or try a shorter session next time.";
}
