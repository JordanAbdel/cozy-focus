export interface Subtask {
  id: string;
  text: string;
  doneAt: number | null;
}

export interface SessionData {
  version: 2;
  title: string;
  durationMin: number;
  endsAt: number | null;
  pausedSec: number;
  subtasks: Subtask[];
}

export function remainingSec(s: SessionData, now = Date.now()): number {
  if (s.endsAt === null) return s.pausedSec;
  return Math.max(0, Math.ceil((s.endsAt - now) / 1000));
}

export function isRunning(s: SessionData, now = Date.now()): boolean {
  return s.endsAt !== null && s.endsAt > now;
}

export function start(s: SessionData, now = Date.now()): SessionData {
  const seconds = s.pausedSec > 0 ? s.pausedSec : s.durationMin * 60;
  return { ...s, endsAt: now + seconds * 1000 };
}

export function pause(s: SessionData, now = Date.now()): SessionData {
  return { ...s, pausedSec: remainingSec(s, now), endsAt: null };
}

export function reset(s: SessionData): SessionData {
  return { ...s, endsAt: null, pausedSec: s.durationMin * 60 };
}

export function complete(s: SessionData): SessionData {
  return { ...s, endsAt: null, pausedSec: 0 };
}

export function setDuration(s: SessionData, min: number, now = Date.now()): SessionData {
  const running = isRunning(s, now);
  return { ...s, durationMin: min, pausedSec: running ? s.pausedSec : min * 60 };
}

export function reviveSession(raw: unknown, fallback: SessionData): SessionData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const subtasks = Array.isArray(o.subtasks)
    ? o.subtasks.flatMap((t): Subtask[] => {
        if (!t || typeof t !== "object") return [];
        const r = t as Record<string, unknown>;
        if (typeof r.id !== "string" || typeof r.text !== "string") return [];
        // v1 stored `done: boolean`; v2 stores `doneAt: number | null`
        const doneAt =
          typeof r.doneAt === "number" ? r.doneAt : r.done === true ? Date.now() : null;
        return [{ id: r.id, text: r.text, doneAt }];
      })
    : fallback.subtasks;

  const title = typeof o.title === "string" && o.title.trim() ? o.title : fallback.title;
  const durationMin =
    typeof o.durationMin === "number" && o.durationMin > 0 ? o.durationMin : fallback.durationMin;

  if (o.version === 2) {
    return {
      version: 2,
      title,
      durationMin,
      endsAt: typeof o.endsAt === "number" ? o.endsAt : null,
      pausedSec: typeof o.pausedSec === "number" ? o.pausedSec : durationMin * 60,
      subtasks,
    };
  }

  // v1 → v2: a mid-run v1 session is imported as paused, since the elapsed
  // wall-clock time during the gap is unknown and resuming would be a guess.
  if (typeof o.remainingSec === "number") {
    return {
      version: 2,
      title,
      durationMin,
      endsAt: null,
      pausedSec: o.remainingSec,
      subtasks,
    };
  }

  return null;
}
