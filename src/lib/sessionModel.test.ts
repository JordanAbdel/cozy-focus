import { describe, expect, it } from "vitest";
import {
  complete,
  isRunning,
  pause,
  remainingSec,
  reset,
  reviveSession,
  setDuration,
  start,
  type SessionData,
} from "./sessionModel";

const base: SessionData = {
  version: 2,
  title: "Test session",
  durationMin: 10,
  endsAt: null,
  pausedSec: 600,
  subtasks: [],
};

describe("remainingSec", () => {
  it("returns pausedSec while not running", () => {
    expect(remainingSec(base, 1000)).toBe(600);
  });

  it("derives from endsAt while running", () => {
    const s = { ...base, endsAt: 5000 };
    expect(remainingSec(s, 1000)).toBe(4);
  });

  it("clamps to 0 once past the deadline", () => {
    const s = { ...base, endsAt: 1000 };
    expect(remainingSec(s, 5000)).toBe(0);
  });

  it("reads 0:01 up to the final second", () => {
    const s = { ...base, endsAt: 1500 };
    expect(remainingSec(s, 1000)).toBe(1);
  });

  it("reads the full duration immediately after starting", () => {
    const s = start(base, 1000);
    expect(remainingSec(s, 1000)).toBe(600);
  });
});

describe("isRunning", () => {
  it("is false when endsAt is null", () => {
    expect(isRunning(base, 1000)).toBe(false);
  });

  it("is true strictly before the deadline", () => {
    expect(isRunning({ ...base, endsAt: 2000 }, 1000)).toBe(true);
  });

  it("is false exactly at the deadline", () => {
    expect(isRunning({ ...base, endsAt: 1000 }, 1000)).toBe(false);
  });

  it("is false after the deadline", () => {
    expect(isRunning({ ...base, endsAt: 500 }, 1000)).toBe(false);
  });
});

describe("transitions", () => {
  it("start() sets endsAt from pausedSec when paused", () => {
    const s = start({ ...base, pausedSec: 120 }, 1000);
    expect(s.endsAt).toBe(1000 + 120 * 1000);
  });

  it("start() falls back to durationMin when pausedSec is 0", () => {
    const s = start({ ...base, pausedSec: 0 }, 1000);
    expect(s.endsAt).toBe(1000 + base.durationMin * 60 * 1000);
  });

  it("pause() freezes the remaining time and clears endsAt", () => {
    const running = { ...base, endsAt: 6000 };
    const s = pause(running, 1000);
    expect(s.endsAt).toBeNull();
    expect(s.pausedSec).toBe(5);
  });

  it("reset() restores the full duration", () => {
    const s = reset({ ...base, endsAt: 6000, pausedSec: 3 });
    expect(s.endsAt).toBeNull();
    expect(s.pausedSec).toBe(base.durationMin * 60);
  });

  it("complete() zeroes out the session", () => {
    const s = complete({ ...base, endsAt: 6000 });
    expect(s.endsAt).toBeNull();
    expect(s.pausedSec).toBe(0);
  });

  it("setDuration() updates pausedSec while not running", () => {
    const s = setDuration(base, 20, 1000);
    expect(s.durationMin).toBe(20);
    expect(s.pausedSec).toBe(1200);
  });

  it("setDuration() leaves the countdown alone while running", () => {
    const running = { ...base, endsAt: 6000, pausedSec: 999 };
    const s = setDuration(running, 20, 1000);
    expect(s.durationMin).toBe(20);
    expect(s.pausedSec).toBe(999);
    expect(s.endsAt).toBe(6000);
  });
});

describe("reviveSession", () => {
  const fallback = base;

  it("passes through a well-formed v2 object", () => {
    const raw = { ...base, subtasks: [{ id: "a", text: "hi", doneAt: null }] };
    const s = reviveSession(raw, fallback);
    expect(s).toEqual(raw);
  });

  it("migrates a v1 object to paused, preserving remainingSec", () => {
    const raw = { title: "Old", durationMin: 25, remainingSec: 400, running: true, subtasks: [] };
    const s = reviveSession(raw, fallback);
    expect(s?.version).toBe(2);
    expect(s?.endsAt).toBeNull();
    expect(s?.pausedSec).toBe(400);
    expect(s?.title).toBe("Old");
  });

  it("migrates v1 subtasks' done:true to a doneAt timestamp", () => {
    const raw = {
      title: "Old",
      durationMin: 25,
      remainingSec: 400,
      running: false,
      subtasks: [{ id: "a", text: "one", done: true }, { id: "b", text: "two", done: false }],
    };
    const s = reviveSession(raw, fallback);
    expect(s?.subtasks).toHaveLength(2);
    expect(typeof s?.subtasks[0].doneAt).toBe("number");
    expect(s?.subtasks[1].doneAt).toBeNull();
  });

  it("returns null for null", () => {
    expect(reviveSession(null, fallback)).toBeNull();
  });

  it("returns null for an empty object", () => {
    expect(reviveSession({}, fallback)).toBeNull();
  });

  it("drops malformed subtasks rather than throwing", () => {
    const raw = { ...base, subtasks: [{ id: "a" }, "not an object", { id: "b", text: "ok", doneAt: null }] };
    const s = reviveSession(raw, fallback);
    expect(s?.subtasks).toEqual([{ id: "b", text: "ok", doneAt: null }]);
  });
});
