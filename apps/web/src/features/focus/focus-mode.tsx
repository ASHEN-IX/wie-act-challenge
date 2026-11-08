"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2, Pause, Play, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IDLE,
  clampMinutes,
  endFocus,
  focusedMs,
  formatClock,
  nextStepFor,
  pauseFocus,
  remainingMs,
  restoreFocus,
  resumeFocus,
  startFocus,
  tick,
  type FocusState,
} from "./focus-session";

const STORAGE_KEY = "ednova:focus-session:v1";
const PRESETS = [25, 45, 60] as const;
/** Pages where starting a session makes sense. A running session follows the learner anywhere. */
const ELIGIBLE = [/^\/courses\/[^/]+\/learn/, /^\/study-together/, /^\/sessions/, /^\/practice/];

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
  }, []);

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
            {state.completed ? "Session complete" : "Session ended"}
          </h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Time focused</dt>
            <dd className="font-medium tabular-nums">
              {formatClock(state.focusedMs)} of {Math.round(state.plannedMs / 60_000)} min
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
          aria-label={`${formatClock(left)} remaining`}
        >
          {formatClock(left)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {state.status === "paused" ? "Paused. " : ""}
          {state.objective || "Focus session"}
          {" · "}
          {formatClock(focusedMs(state, now))} focused
        </span>
        {state.status === "running" ? (
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
        <Button size="sm" variant="destructive" onClick={() => finish(endFocus(state, Date.now()))}>
          <Square className="size-4" /> End
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
