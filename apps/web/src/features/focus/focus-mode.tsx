"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Pause, Play, ShieldCheck, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listenGuard, reportFocus } from "./guard";
import {
  IDLE,
  IDLE_AFTER_MS,
  clampMinutes,
  endFocus,
  focusedMs,
  formatClock,
  nextStepFor,
  pauseFocus,
  remainingMs,
  restoreFocus,
  resumeFocus,
  startAutoFocus,
  startFocus,
  tick,
  type FocusState,
} from "./focus-session";

const STORAGE_KEY = "ednova:focus-session:v1";
const PRESETS = [25, 45, 60] as const;
/** Pages where starting a session makes sense. A running session follows the learner anywhere. */
const ELIGIBLE = [/^\/courses\/[^/]+\/learn/, /^\/study-together/, /^\/sessions/, /^\/practice/];

/** Deep Focus starts by itself here: reading a lesson or being inside a study room. */
const AUTO = [/^\/courses\/[^/]+\/learn/, /^\/study-together\/(?!connections(\/|$))[^/]+/];
const SUPPRESS_KEY = "ednova:deep-focus:off";
const isAuto = (path: string) => AUTO.some((pattern) => pattern.test(path));

/** "Exit Deep Focus" is respected for the rest of this browser tab session. */
function suppressed(): boolean {
  try {
    return sessionStorage.getItem(SUPPRESS_KEY) === "1";
  } catch {
    return false;
  }
}
function setSuppressed(value: boolean) {
  try {
    if (value) sessionStorage.setItem(SUPPRESS_KEY, "1");
    else sessionStorage.removeItem(SUPPRESS_KEY);
  } catch {
    /* ignore */
  }
}

function save(state: FocusState) {
  try {
    if (state.status === "idle") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Storage can be blocked; the session still works for this page view. */
  }
}

export function FocusMode({ suggestedMinutes = 25 }: { suggestedMinutes?: number }) {
  const pathname = usePathname();
  const [state, setState] = useState<FocusState>(IDLE);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(suggestedMinutes);
  const [objective, setObjective] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [ready, setReady] = useState(false);
  const [guard, setGuard] = useState(false);
  const stateRef = useRef<FocusState>(IDLE);
  const lastInteraction = useRef(0);

  const apply = useCallback((next: FocusState) => {
    setState(next);
    save(next);
  }, []);

  // Restore after mount (localStorage is not available during SSR).
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const restored = restoreFocus(raw, Date.now());
    setState(restored);
    if (restored.status === "paused" && raw && JSON.parse(raw).status === "running") {
      setNotice("Your session was paused while you were away. Continue where you left off?");
    }
    lastInteraction.current = Date.now();
    setReady(true);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Keep other tabs in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setState(restoreFocus(event.newValue, Date.now()));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Tick once a second while running.
  const running = state.status === "running";
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setState((current) => {
        const next = tick(current, t);
        save(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // Reduce app chrome while a session is active (see globals.css).
  const active = state.status === "running" || state.status === "paused";
  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.focus = "on";
    else delete root.dataset.focus;
    return () => {
      delete root.dataset.focus;
    };
  }, [active]);

  // Gentle prompts only. Tab visibility is not evidence of attention.
  useEffect(() => {
    if (!running) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNotice("You've returned to your study session. Continue where you left off?");
      }
    };
    const onFullscreen = () => {
      const isFull = Boolean(document.fullscreenElement);
      setFullscreen(isFull);
      if (!isFull) setNotice("Fullscreen ended. Focus Mode is still on.");
    };
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [running]);

  const auto = state.status !== "idle" && state.status !== "ended" && state.auto;

  // Deep Focus: start by itself when the learner starts studying.
  useEffect(() => {
    if (!ready || state.status !== "idle" || !isAuto(pathname) || suppressed()) return;
    const t = Date.now();
    lastInteraction.current = t;
    setNow(t);
    apply(startAutoFocus(t, pathname));
  }, [ready, state.status, pathname, apply]);

  // ...and end cleanly when the learner leaves the studying pages.
  useEffect(() => {
    if (!auto || isAuto(pathname)) return;
    const next = endFocus(stateRef.current, Date.now());
    apply(next.status === "ended" && next.focusedMs < 60_000 ? IDLE : next);
    setNotice(null);
  }, [auto, pathname, apply]);

  // Count only time the page is visible and in use. Away or idle time is never banked.
  useEffect(() => {
    if (!auto) return;
    const awayNow = () => {
      const cur = stateRef.current;
      if (cur.status === "running" && cur.auto) apply(pauseFocus(cur, Date.now()));
    };
    const back = () => {
      lastInteraction.current = Date.now();
      const cur = stateRef.current;
      if (cur.status === "paused" && cur.auto && !document.hidden) {
        apply(resumeFocus(cur, Date.now()));
        setNotice("Welcome back. Your Deep Focus session continues.");
      }
    };
    const onVisibility = () => (document.hidden ? awayNow() : back());
    const onInput = () => {
      const t = Date.now();
      const wasQuiet = t - lastInteraction.current > 1000;
      lastInteraction.current = t;
      if (wasQuiet) back();
    };
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;
    events.forEach((name) => window.addEventListener(name, onInput, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", onVisibility);
    const id = window.setInterval(() => {
      const cur = stateRef.current;
      if (cur.status !== "running" || !cur.auto) return;
      if (document.hidden) awayNow();
      else if (Date.now() - lastInteraction.current > IDLE_AFTER_MS) {
        apply(pauseFocus(cur, Math.max(cur.lastResumeAt, lastInteraction.current + 60_000)));
      }
    }, 5000);
    return () => {
      events.forEach((name) => window.removeEventListener(name, onInput, { capture: true }));
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(id);
    };
  }, [auto, apply]);

  // Tab-strip nudge while the learner is away from the study tab.
  useEffect(() => {
    if (!auto) return;
    const original = document.title;
    const sync = () => {
      document.title = document.hidden ? "● Your study session is waiting" : original;
    };
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      document.title = original;
    };
  }, [auto]);

  // Optional extension: block other sites while a session is active; heartbeat so it can
  // never stay on if this tab goes away.
  const blocking = state.status === "running" || state.status === "paused";
  useEffect(() => {
    if (!blocking) {
      reportFocus(false);
      return;
    }
    reportFocus(true);
    const id = window.setInterval(() => reportFocus(true), 20_000);
    return () => {
      window.clearInterval(id);
      reportFocus(false);
    };
  }, [blocking]);
  useEffect(
    () =>
      listenGuard((message) => {
        if (message.type === "ready") {
          setGuard(true);
          if (stateRef.current.status === "running" || stateRef.current.status === "paused") reportFocus(true);
        } else {
          // Emergency exit pressed in the extension.
          setSuppressed(true);
          const cur = stateRef.current;
          if (cur.status === "running" || cur.status === "paused") finishRef.current(endFocus(cur, Date.now()));
        }
      }),
    [],
  );

  const eligible = ELIGIBLE.some((pattern) => pattern.test(pathname));
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice("Fullscreen isn't available in this browser right now.");
    }
  };

  const finish = (next: FocusState) => {
    apply(next);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setNotice(null);
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  if (state.status === "idle") {
    if (!eligible) return null;
    return (
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        {open && (
          <form
            aria-label="Start a focus session"
            className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-card p-4 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              apply(startFocus(Date.now(), minutes, objective, pathname));
              setNow(Date.now());
              setOpen(false);
            }}
          >
            <p className="text-sm font-medium">Start a focus session</p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Duration">
              {PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={minutes === preset ? "default" : "outline"}
                  aria-pressed={minutes === preset}
                  onClick={() => setMinutes(preset)}
                >
                  {preset} min
                </Button>
              ))}
              <label className="flex items-center gap-1 text-sm">
                <span className="sr-only">Custom minutes</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={180}
                  value={minutes}
                  onChange={(e) => setMinutes(clampMinutes(Number(e.target.value)))}
                  className="h-9 w-20"
                />
                min
              </label>
            </div>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              What will you work on?
              <Input
                value={objective}
                maxLength={140}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Optional, e.g. finish chapter 2"
              />
            </label>
            <p className="mt-3 text-xs text-muted-foreground">
              This hides EdNova&apos;s own menus and keeps a timer. It cannot
              block other tabs or apps.
            </p>
            {isAuto(pathname) && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => {
                  setSuppressed(false);
                  const t = Date.now();
                  lastInteraction.current = t;
                  setNow(t);
                  apply(startAutoFocus(t, pathname));
                  setOpen(false);
                }}
              >
                Turn Deep Focus back on (no timer)
              </Button>
            )}
            <div className="mt-3 flex gap-2">
              <Button type="submit" size="sm">
                Begin
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
        <Button onClick={() => setOpen((v) => !v)} aria-expanded={open} variant="outline" className="shadow-lg">
          <Timer className="size-4" />
          Focus
        </Button>
      </div>
    );
  }

  if (state.status === "ended") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-summary"
        className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
      >
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
          <h2 id="focus-summary" className="text-xl font-semibold tracking-tight">
            {state.auto ? "Deep Focus ended" : state.completed ? "Session complete" : "Session ended"}
          </h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Time focused</dt>
            <dd className="font-medium tabular-nums">
              {state.auto
                ? formatClock(state.focusedMs)
                : `${formatClock(state.focusedMs)} of ${Math.round(state.plannedMs / 60_000)} min`}
            </dd>
            {state.objective && (
              <>
                <dt className="text-muted-foreground">Objective</dt>
                <dd>{state.objective}</dd>
              </>
            )}
          </dl>
          <p className="mt-4 text-sm">{nextStepFor(state)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Time spent isn&apos;t a measure of what you learned. Your progress
            page shows evidence from activities you completed.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/progress" onClick={() => apply(IDLE)}>
                See my progress
              </Link>
            </Button>
            <Button variant="outline" onClick={() => apply(IDLE)}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const left = remainingMs(state, now);
  const offRoute = !pathname.startsWith(state.route.split("?")[0]);
  return (
    <div
      role="region"
      aria-label="Focus session"
      className="fixed inset-x-0 top-0 z-50 border-b bg-background/95 px-4 py-2 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
        <span
          className="text-xl font-semibold tabular-nums"
          role="timer"
          aria-label={state.auto ? `${formatClock(focusedMs(state, now))} focused` : `${formatClock(left)} remaining`}
        >
          {state.auto ? formatClock(focusedMs(state, now)) : formatClock(left)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {state.auto ? (
            <>
              <ShieldCheck className="mr-1 inline size-4" aria-hidden />
              Deep Focus · {state.status === "paused" ? "away, resumes when you return" : "counting active study time"}
              {" · "}
              {guard ? "other sites blocked" : "other sites not blocked (extension not installed)"}
            </>
          ) : (
            <>
              {state.status === "paused" ? "Paused. " : ""}
              {state.objective || "Focus session"}
              {" · "}
              {formatClock(focusedMs(state, now))} focused
            </>
          )}
        </span>
        {state.auto ? null : state.status === "running" ? (
          <Button size="sm" variant="outline" onClick={() => apply(pauseFocus(state, Date.now()))}>
            <Pause className="size-4" /> Pause
          </Button>
        ) : (
          <Button size="sm" onClick={() => { apply(resumeFocus(state, Date.now())); setNotice(null); }}>
            <Play className="size-4" /> Resume
          </Button>
        )}
        {canFullscreen && (
          <Button size="sm" variant="ghost" onClick={toggleFullscreen} aria-pressed={fullscreen}>
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (state.auto) setSuppressed(true);
            finish(endFocus(state, Date.now()));
          }}
        >
          <Square className="size-4" /> {state.auto ? "Exit Deep Focus" : "End"}
        </Button>
      </div>
      {(notice || offRoute) && (
        <p role="status" className="mx-auto mt-1 flex max-w-[1500px] flex-wrap items-center gap-3 text-sm">
          <span>{notice ?? "You've left your study page."}</span>
          {offRoute && (
            <Link className="underline" href={state.route}>
              Go back
            </Link>
          )}
          {notice && (
            <button className="underline" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          )}
        </p>
      )}
    </div>
  );
}
