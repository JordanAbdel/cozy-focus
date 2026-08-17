import { useEffect, useState } from "react";

export interface SessionData {
  title: string;
  durationMin: number;
  remainingSec: number;
  running: boolean;
  subtasks: { id: string; text: string; done: boolean }[];
}

type OnChange = (updater: (prev: SessionData) => SessionData) => void;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function useSessionTicker(session: SessionData, onChange: OnChange) {
  useEffect(() => {
    if (!session.running) return;
    const id = window.setInterval(() => {
      onChange((prev) => {
        if (!prev.running) return prev;
        if (prev.remainingSec <= 1) return { ...prev, remainingSec: 0, running: false };
        return { ...prev, remainingSec: prev.remainingSec - 1 };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [session.running, onChange]);
}

export function SessionTimerRing({ session, onChange, accent }: { session: SessionData; onChange: OnChange; accent: string }) {
  const toggleRunning = () => {
    onChange((prev) => {
      if (!prev.running && prev.remainingSec <= 0) return { ...prev, remainingSec: prev.durationMin * 60, running: true };
      return { ...prev, running: !prev.running };
    });
  };
  const reset = () => onChange((prev) => ({ ...prev, remainingSec: prev.durationMin * 60, running: false }));

  const fraction = 1 - session.remainingSec / (session.durationMin * 60);
  const sweep = Math.max(0, Math.min(360, fraction * 360));

  return (
    <div className="flex flex-col items-end gap-3">
      <div
        onClick={toggleRunning}
        className="relative rounded-full grid place-items-center cursor-pointer select-none"
        style={{ width: 126, height: 126, background: `conic-gradient(${accent} ${sweep}deg, rgba(237,224,206,.10) 0)` }}
        title={session.running ? "Pause session" : "Start session"}
      >
        <div className="absolute rounded-full backdrop-blur-md" style={{ inset: 7, background: "rgba(20,13,8,.55)" }} />
        <div className="relative text-center">
          <div className="font-serif-cf" style={{ fontSize: 31, color: "rgba(237,224,206,.9)" }}>
            {fmt(session.remainingSec)}
          </div>
          <div className="text-[9px] tracking-[.2em] uppercase" style={{ color: "rgba(237,224,206,.35)" }}>
            {session.running ? "remaining" : session.remainingSec === 0 ? "done" : "paused"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[12px]" style={{ color: "rgba(237,224,206,.4)" }}>
        <span>Session of {session.durationMin} minutes</span>
        <button onClick={reset} className="cursor-pointer underline decoration-dotted">
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

  const toggleSubtask = (id: string) => {
    onChange((prev) => ({ ...prev, subtasks: prev.subtasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  };

  const addSubtask = () => {
    const text = draft.trim();
    if (!text) {
      setAddingTask(false);
      return;
    }
    onChange((prev) => ({ ...prev, subtasks: [...prev.subtasks, { id: crypto.randomUUID(), text, done: false }] }));
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
        {session.subtasks.map((t) => (
          <div
            key={t.id}
            onClick={() => toggleSubtask(t.id)}
            className="flex gap-2.5 items-center cursor-pointer"
            style={t.done ? { opacity: 0.45, textDecoration: "line-through" } : undefined}
          >
            <span
              className="rounded-full"
              style={t.done ? { width: 6, height: 6, background: "rgba(201,106,60,.8)" } : { width: 6, height: 6, border: "1px solid rgba(237,224,206,.35)" }}
            />
            <span>{t.text}</span>
          </div>
        ))}
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
