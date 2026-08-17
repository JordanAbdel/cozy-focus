import { useEffect, useReducer, useState } from "react";
import {
  complete,
  isRunning,
  pause,
  remainingSec,
  reset,
  start,
  type SessionData,
} from "../lib/sessionModel";

const GRACE_MS = 3000;
const FADE_MS = 900;

export type { SessionData };

type OnChange = (updater: (prev: SessionData) => SessionData) => void;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function useSessionTicker(session: SessionData, onChange: OnChange, onComplete?: () => void) {
  const [, force] = useReducer((n: number) => n + 1, 0);

  // Repaint once a second while counting down. Throttling in a hidden tab is
  // harmless — the displayed value is derived from Date.now() on every render.
  useEffect(() => {
    if (session.endsAt === null) return;
    const id = window.setInterval(force, 1000);
    return () => window.clearInterval(id);
  }, [session.endsAt]);

  // Commit completion. The timeout may fire late when backgrounded, so also
  // re-check whenever the tab becomes visible again.
  useEffect(() => {
    if (session.endsAt === null) return;
    let firedOnce = false;
    const finish = () => {
      if (firedOnce) return;
      firedOnce = true;
      onComplete?.();
      onChange((prev) => (prev.endsAt === null ? prev : complete(prev)));
    };
    const due = session.endsAt - Date.now();
    if (due <= 0) {
      finish();
      return;
    }
    const id = window.setTimeout(finish, due);
    const onVis = () => {
      if (!document.hidden && session.endsAt !== null && session.endsAt <= Date.now()) finish();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [session.endsAt, onChange, onComplete]);
}

export function SessionTimerRing({ session, onChange, accent }: { session: SessionData; onChange: OnChange; accent: string }) {
  const toggleRunning = () => {
    if (!isRunning(session) && typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    onChange((prev) => (isRunning(prev) ? pause(prev) : start(prev)));
  };
  const handleReset = () => onChange(reset);

  const remaining = remainingSec(session);
  const running = isRunning(session);
  const done = !running && remaining === 0;
  const fraction = 1 - remaining / (session.durationMin * 60);
  const sweep = Math.max(0, Math.min(360, fraction * 360));

  return (
    <div className="flex flex-col items-end gap-3">
      <button
        onClick={toggleRunning}
        className="relative rounded-full grid place-items-center cursor-pointer select-none"
        style={{ width: 126, height: 126, background: `conic-gradient(${accent} ${sweep}deg, rgba(237,224,206,.10) 0)`, border: "none", padding: 0, font: "inherit" }}
        title={running ? "Pause session" : "Start session"}
        aria-label={running ? "Pause session" : "Start session"}
      >
        <div className="absolute rounded-full backdrop-blur-md" style={{ inset: 7, background: "rgba(20,13,8,.55)" }} />
        <div className="relative text-center">
          <div className="font-serif-cf" style={{ fontSize: 31, color: done ? accent : "rgba(237,224,206,.9)" }}>
            {fmt(remaining)}
          </div>
          <div className="text-[9px] tracking-[.2em] uppercase" style={{ color: done ? accent : "rgba(237,224,206,.35)" }}>
            {running ? "remaining" : done ? "done" : "paused"}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-2 text-[12px]" style={{ color: "rgba(237,224,206,.4)" }}>
        <span>Session of {session.durationMin} minutes</span>
        <button onClick={handleReset} className="cursor-pointer underline decoration-dotted">
          reset
        </button>
      </div>
    </div>
  );
}

export function SessionTaskCard({ session, onChange }: { session: SessionData; onChange: OnChange }) {
  const [addingTask, setAddingTask] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [, forceTick] = useReducer((n: number) => n + 1, 0);

  // A task's doneAt is persisted, so pending-removal is derived rather than
  // scheduled — this survives reload instead of stranding a struck-through task.
  useEffect(() => {
    const hasPending = session.subtasks.some((t) => t.doneAt !== null);
    if (!hasPending) return;

    const sweep = () => {
      const now = Date.now();
      onChange((prev) => {
        const kept = prev.subtasks.filter((t) => t.doneAt === null || now - t.doneAt < GRACE_MS);
        return kept.length === prev.subtasks.length ? prev : { ...prev, subtasks: kept };
      });
      forceTick();
    };

    sweep();
    const id = window.setInterval(sweep, 250);
    return () => window.clearInterval(id);
  }, [session.subtasks, onChange]);

  const toggleSubtask = (id: string) => {
    const current = session.subtasks.find((t) => t.id === id);
    if (!current) return;
    const nextDoneAt = current.doneAt === null ? Date.now() : null;
    onChange((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((t) => (t.id === id ? { ...t, doneAt: nextDoneAt } : t)),
    }));
  };

  const addSubtask = () => {
    const text = draft.trim();
    if (!text) {
      setAddingTask(false);
      return;
    }
    onChange((prev) => ({ ...prev, subtasks: [...prev.subtasks, { id: crypto.randomUUID(), text, doneAt: null }] }));
    setDraft("");
    setAddingTask(false);
  };

  return (
    <div className="mt-[30px] flex flex-col gap-2.5 text-[14px]" style={{ color: "rgba(237,224,206,.42)" }}>
      <div className="text-[10px] tracking-[.24em] uppercase" style={{ color: "rgba(237,224,206,.28)" }}>
        This session
      </div>
      {editingTitle ? (
        <input
          autoFocus
          defaultValue={session.title}
          onBlur={(e) => {
            onChange((prev) => ({ ...prev, title: e.target.value.trim() || prev.title }));
            setEditingTitle(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="font-serif-cf bg-transparent border-b outline-none"
          style={{ fontSize: 24, color: "rgba(237,224,206,.9)", borderColor: "rgba(237,224,206,.3)", width: 320 }}
        />
      ) : (
        <div onClick={() => setEditingTitle(true)} className="font-serif-cf cursor-text" style={{ fontSize: 24, color: "rgba(237,224,206,.78)" }}>
          {session.title}
        </div>
      )}
      <div className="flex flex-col gap-[7px] mt-1">
        {session.subtasks.map((t) => {
          const elapsed = t.doneAt === null ? null : Date.now() - t.doneAt;
          const pendingRemoval = elapsed !== null && elapsed < GRACE_MS;
          const collapsing = elapsed !== null && elapsed >= GRACE_MS - FADE_MS && elapsed < GRACE_MS;
          return (
            <button
              key={t.id}
              onClick={() => toggleSubtask(t.id)}
              aria-pressed={t.doneAt !== null}
              className={`subtask-row flex gap-2.5 items-center cursor-pointer w-full text-left${collapsing ? " subtask-collapsing" : ""}`}
              style={{
                border: "none",
                background: "none",
                padding: 0,
                font: "inherit",
                color: "inherit",
                ...(t.doneAt !== null ? { textDecoration: "line-through", opacity: collapsing ? undefined : 0.45 } : {}),
              }}
            >
              <span
                className="rounded-full flex-shrink-0"
                style={t.doneAt !== null ? { width: 6, height: 6, background: "rgba(201,106,60,.8)" } : { width: 6, height: 6, border: "1px solid rgba(237,224,206,.35)" }}
              />
              <span>{t.text}</span>
              {pendingRemoval && (
                <span className="text-[11px] underline decoration-dotted ml-auto" style={{ color: "rgba(237,224,206,.35)" }}>
                  undo
                </span>
              )}
            </button>
          );
        })}
        {addingTask ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={addSubtask}
            onKeyDown={(e) => {
              if (e.key === "Enter") addSubtask();
              if (e.key === "Escape") setAddingTask(false);
            }}
            placeholder="New item…"
            className="bg-transparent border-b outline-none text-[13px]"
            style={{ borderColor: "rgba(237,224,206,.25)", color: "rgba(237,224,206,.75)" }}
          />
        ) : (
          <button onClick={() => setAddingTask(true)} className="cursor-pointer text-left text-[12px] mt-0.5" style={{ color: "rgba(237,224,206,.28)" }}>
            + add item
          </button>
        )}
      </div>
    </div>
  );
}
