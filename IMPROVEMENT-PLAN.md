# Cozy Focus — Improvement Plan

An implementation brief covering the 19 issues found in the 17 Aug 2026 review.
Written to be executed by a coding agent, phase by phase.

**Scope:** defect fixes and hardening only. New features (Pomodoro cycles, session
history, saved mixes, PWA, etc.) are deliberately **out of scope** — see [Appendix B](#appendix-b--explicitly-out-of-scope).

---

## Ground rules

Read these before starting. They override default instincts.

1. **Surgical changes only.** Every changed line must trace to a task below. Do not
   "improve" adjacent code, reformat untouched lines, or refactor things this plan
   doesn't name.
2. **Match the existing style.** Inline `style={{}}` objects with `rgba(...)` literals
   alongside Tailwind utility classes, named function exports, 2-space indent, double
   quotes. It is not the style I would pick either. Match it anyway.
3. **No speculative abstraction.** No config options, no "flexibility" for cases that
   don't exist, no error handling for impossible states.
4. **Work phase by phase.** Each phase ends green (typecheck + build + stated checks)
   before the next begins. Do not batch phases into one commit.
5. **If a phase's premise looks wrong when you get there, stop and say so.** Don't
   improvise a different design silently.

### Environment

| | |
|---|---|
| Project root | `/Users/jordanabdel/Documents/Claude/CozyFocus` |
| Dev server | `preview_start` with name `cozy-focus`, port 5174 |
| ⚠️ launch.json | Lives in `/Users/jordanabdel/Documents/Claude/Meridan/.claude/launch.json`, **not** in this project. The preview tool reads it from the primary working directory. |
| Typecheck | `npx tsc -b --noEmit` — must exit 0 |
| Build | `npm run build` — must succeed |
| Tests | None installed yet. Phase 2 adds Vitest. |

### Landmines

- **`StrictMode` is on** (`src/main.tsx`). Effects and state updaters run twice in dev.
  Any logic that relies on an updater running exactly once is already a latent bug.
- **Do not touch `SCOPES` in `src/lib/spotifyAuth.ts`.** Changing it invalidates every
  stored token and silently forces all users to reconnect. No phase here needs to.
- **The app persists to `localStorage` under `cozyfocus.*` keys.** Phase 2 changes a
  stored shape. The migration is mandatory, not optional — skipping it strands real
  saved sessions.
- Audio requires a user gesture per page load. `audioOn` in `App.tsx` is intentionally
  **not** persisted. Leave that alone; there's a comment explaining why.

---

## Phase order & dependencies

```
Phase 1  Storage hardening        ──┐
Phase 2  Session model v2 + timer ──┴──> Phase 3  Subtask lifecycle
                                    └──> Phase 5  End-of-session feedback

Phase 4  Render & paint perf      (independent — any time)
Phase 6  Accessibility            (independent)
Phase 7  Font subsets             (independent, 5 min)
Phase 8  Error boundary           (independent, 15 min)
Phase 9  Responsive layout        (BLOCKED — needs a product decision, see phase)
```

Phases 4, 7 and 8 are independent and low-risk. If you want an early win, do 7 and 8
first. **Do not start Phase 3 before Phase 2 is green** — it depends on a field the
Phase 2 migration introduces.

---

## Phase 1 — Storage hardening

**Fixes:** #4 (silent quota failures), #17 (unvalidated persisted state)

### Goal

`useLocalStorage` currently does `JSON.parse(raw) as T` — an assertion, not a check —
and swallows every write error including `QuotaExceededError`. Phase 2 changes a stored
shape, so validation has to exist first.

### Files

- `src/lib/useLocalStorage.ts` (modify)
- `src/App.tsx` (one call site gains a handler)
- `src/components/ArtworkSlot.tsx` (surface the error)

### Changes

Extend the hook with two **optional** parameters so the other four call sites stay
untouched:

```ts
export function useLocalStorage<T>(
  key: string,
  initial: T,
  opts?: {
    // Return null to reject a stored value and fall back to `initial`.
    revive?: (raw: unknown) => T | null;
    onWriteError?: (err: unknown) => void;
  },
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      if (!opts?.revive) return parsed as T;
      return opts.revive(parsed) ?? initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      opts?.onWriteError?.(err);
    }
  }, [key, value]);

  return [value, setValue] as const;
}
```

> **Note:** `opts` is intentionally left out of the effect's dependency array. Callers
> will pass an inline object literal, so including it would re-run the write on every
> render. Add a one-line comment saying so, or the next reader will "fix" it.

Then in `App.tsx`, for the artwork key only:

```tsx
const [artworkError, setArtworkError] = useState<string | null>(null);
const [artwork, setArtwork] = useLocalStorage<string | null>("cozyfocus.artwork", null, {
  onWriteError: () =>
    setArtworkError("That image is too large to save. Try a smaller one."),
});
```

Pass `artworkError` into `ArtworkSlot` and render it near the existing "Processing…"
label, using the same muted type treatment. Clear it when a new file is chosen.

### Why not IndexedDB

The review floated moving artwork to IndexedDB. That's the better long-term answer but
it's a bigger change with its own async-loading states. **Not in this plan.** Surfacing
the failure honestly is the fix here.

### Verify

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] Existing saved state still loads — open the app, confirm scene/levels/session persist across reload
- [ ] Corrupt a key by hand (`localStorage.setItem("cozyfocus.levels", "{{{")`) and reload — app falls back to defaults instead of white-screening
- [ ] Simulate a quota failure and confirm the message appears rather than failing silently:
      ```js
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k) {
        if (k === "cozyfocus.artwork") throw new DOMException("quota", "QuotaExceededError");
        return orig.apply(this, arguments);
      };
      ```
      Then switch to the Artwork scene and add an image.

---

## Phase 2 — Session model v2 and the timer rewrite

**Fixes:** #1 (background-tab drift), #5 (1 localStorage write/sec)

This is the highest-value phase. Both defects share one root cause: the countdown is
*accumulated* by decrementing a counter, instead of *derived* from a deadline.

### The problem, precisely

`useSessionTicker` decrements `remainingSec` once per `setInterval` tick. Browsers
throttle timers in hidden tabs — Chrome to ~1/sec when backgrounded and as low as
**1/minute** under intensive throttling after a few minutes. A 45-minute session
backgrounded for 25 real minutes may only have counted a fraction of that.

Because `remainingSec` lives inside the persisted session object, every tick also
triggers a synchronous `localStorage.setItem` — measured at 5 writes in 5 seconds,
~294 bytes each, ~2,700 blocking main-thread writes per session.

Deriving from a deadline fixes both at once: the stored object stops changing every
second, so it stops being written every second.

### Files

- `src/components/SessionTimer.tsx` (substantial rewrite)
- `src/lib/sessionModel.ts` (**new** — pure logic + migration)
- `src/App.tsx` (wire up the revive function, drop `remainingSec` references)
- `src/components/SettingsPanel.tsx` (duration edit now writes `pausedSec`)

### New schema

Bump to version 2 and introduce **both** new fields at once — `endsAt`/`pausedSec` for
this phase and `doneAt` for Phase 3 — so there is only ever one migration to write.

```ts
// src/lib/sessionModel.ts
export interface Subtask {
  id: string;
  text: string;
  doneAt: number | null;   // epoch ms when ticked; null = not done
}

export interface SessionData {
  version: 2;
  title: string;
  durationMin: number;
  endsAt: number | null;   // epoch ms; non-null only while counting down
  pausedSec: number;       // remainder held while not counting down
  subtasks: Subtask[];
}
```

`running` and `remainingSec` are **deleted** as stored fields. They become derived:

```ts
export function remainingSec(s: SessionData, now = Date.now()): number {
  if (s.endsAt === null) return s.pausedSec;
  return Math.max(0, Math.ceil((s.endsAt - now) / 1000));
}

export function isRunning(s: SessionData, now = Date.now()): boolean {
  return s.endsAt !== null && s.endsAt > now;
}
```

> Use `Math.ceil`, not `round` or `floor` — it makes a fresh 45-minute session read
> `45:00` immediately and hold `0:01` until the final second has actually elapsed.
>
> Both functions take `now` as an injectable parameter specifically so they can be
> unit-tested without faking timers. Keep that signature.

### Transitions

Write these as pure functions in `sessionModel.ts`:

| Action | Result |
|---|---|
| `start(s)` | `endsAt = Date.now() + (s.pausedSec > 0 ? s.pausedSec : s.durationMin * 60) * 1000` |
| `pause(s)` | `pausedSec = remainingSec(s)`, `endsAt = null` |
| `reset(s)` | `endsAt = null`, `pausedSec = s.durationMin * 60` |
| `complete(s)` | `endsAt = null`, `pausedSec = 0` |
| `setDuration(s, min)` | `durationMin = min`; also set `pausedSec = min * 60` **only if not running** |

`setDuration` while running deliberately leaves the countdown alone — `SettingsPanel`
already tells the user that in copy. Keep the behaviour and keep the copy.

### Migration

```ts
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

  // v1 → v2
  if (typeof o.remainingSec === "number") {
    return {
      version: 2,
      title,
      durationMin,
      endsAt: null,                 // see note below
      pausedSec: o.remainingSec,
      subtasks,
    };
  }

  return null;
}
```

> **A v1 session that was mid-run is imported as paused, not running.** We have no idea
> how much wall-clock time passed between the last save and this load, so resuming would
> be a guess. Pausing is the honest outcome. Do not "improve" this.

### The ticker

The interval no longer owns the truth — it only forces a repaint. Completion is handled
by a separate timeout **plus** a visibility check, because a backgrounded timeout fires
late.

```ts
export function useSessionTicker(session: SessionData, onChange: OnChange) {
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
    const finish = () => onChange((prev) => (prev.endsAt === null ? prev : complete(prev)));
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
  }, [session.endsAt, onChange]);
}
```

### Call-site updates

`SessionTimerRing` currently reads `session.remainingSec` and `session.running` directly
and computes `fraction` from them. Route all three through `remainingSec()` /
`isRunning()`. The existing guard `Math.max(0, Math.min(360, ...))` on `sweep` stays —
it still protects against a duration change mid-run pushing the fraction negative.

### Tests (recommended, ~20 minutes)

The pure functions are exactly the code most likely to break and the easiest to cover.
Install Vitest and test `sessionModel.ts` only:

```bash
npm i -D vitest
```

Cover: `remainingSec` with injected `now` (running, paused, expired, exactly-zero);
`isRunning` at the boundary; each transition; and `reviveSession` for a v1 object, a v2
object, a v1 object with `done: true` subtasks, `null`, `{}`, and malformed subtasks.

### Verify

- [ ] `npx tsc -b --noEmit` exits 0, `npm run build` succeeds
- [ ] Vitest passes (if added)
- [ ] **Drift is gone** — the acceptance test for the whole phase:
      1. Set a 1-minute session, start it
      2. Switch to another tab for a full 60 seconds
      3. Return — the timer reads `0:00` / "done", not ~`0:40`
- [ ] **The write storm is gone.** Instrument and confirm **0 writes** during a running
      session (down from 1/sec):
      ```js
      let n = 0;
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { n++; return orig.apply(this, arguments); };
      setTimeout(() => console.log("writes in 5s:", n), 5000);
      ```
- [ ] An old v1 session in localStorage loads as a **paused** session with its subtasks intact
- [ ] Start / pause / reset / duration-change all behave as before from the user's side

---

## Phase 3 — Subtask lifecycle

**Fixes:** #2 (task stranded on reload), #3 (destructive removal, no undo), #18 (impure updater)

**Depends on Phase 2** for the `doneAt` field.

### The problem

Ticking a task persists `done: true` immediately, but the 3-second removal lives only in
an in-memory `setTimeout`. Reload inside that window and the task returns struck-through
and **permanent** — nothing will ever schedule its removal again. The only escape is to
untick and re-tick it.

Separately, removal is unrecoverable: no countdown, no fade, no undo. Since the task list
is the only record of the session's intent, a mis-click destroys data.

And `toggleSubtask` assigns to an outer `nextDone` variable from inside a `setState`
updater — impure, and double-invoked under StrictMode.

### Changes — `src/components/SessionTimer.tsx`

1. **Derive, don't schedule.** A task is pending-removal when
   `doneAt !== null && Date.now() - doneAt < GRACE_MS` (`GRACE_MS = 3000`). Sweep expired
   ones on mount and on each tick. Because `doneAt` is persisted, this survives reload —
   a task ticked 3+ seconds before a reload is swept on the next mount, exactly as if
   the tab had stayed open.
2. **Read state before writing it.** Drop the `nextDone` trick — `session.subtasks` is
   already in scope, so look the task up there and branch before calling `onChange`.
3. **Make the disappearance legible.** Fade and collapse the row over its final second
   (CSS transition on `opacity`/`max-height`, gated behind `prefers-reduced-motion`).
4. **Offer undo.** Clicking a pending-removal row sets `doneAt = null` and cancels it —
   that already falls out of the toggle. Beyond that, show a small "Undo" affordance on
   the row during the grace window. Keep it quiet; it should read as part of the existing
   muted task type, not a toast.

### Verify

- [ ] Tick a task → it fades out and disappears after ~3s
- [ ] Tick a task, **reload within 3s** → it is gone (or disappears immediately on mount), never stranded
- [ ] Tick a task, click it again within 3s → removal cancels, task returns to normal
- [ ] Tick a task, use Undo → task returns
- [ ] `prefers-reduced-motion: reduce` → no animation, task still disappears
- [ ] No `setTimeout` handles retained in a ref for removal any more

---

## Phase 4 — Render and paint performance

**Fixes:** #6 (whole-tree re-render), #7 (non-composited rain), #8 (hidden-tab polling)

Three independent, low-risk edits. None depends on the others.

### 4a — Clock: bail out of identical renders

`src/components/Clock.tsx` — `setNow(new Date())` produces a fresh object identity every
second, re-rendering `App` and (since there is **no `React.memo` anywhere**) every child:
six faders/dials, mixer, Now Playing, scene switcher. The display is only `h:mm`, so 59
of 60 renders are byte-identical.

Hold the formatted strings in state and return the previous value when unchanged —
React bails out of the render entirely.

```ts
const [display, setDisplay] = useState(() => format(new Date()));
useEffect(() => {
  const id = window.setInterval(() => {
    setDisplay((prev) => {
      const next = format(new Date());
      return next.time === prev.time && next.dateLine === prev.dateLine ? prev : next;
    });
  }, 1000);
  return () => window.clearInterval(id);
}, []);
```

Extract the existing formatting into a `format(date)` helper returning
`{ time, dateLine }`. Keep the `useClock()` return shape identical so `App.tsx` is untouched.

### 4b — Rain: animate `transform`, not `background-position`

`src/index.css` lines 44–51 and 98–100. `@keyframes rainfall` animates
`background-position`, which the compositor cannot handle — every frame repaints a layer
sized `inset: -20% -10%` (larger than the viewport), forever. The other three animations
(`flicker`, `drift`, `breathe`) already animate only `transform`/`opacity` and cost
effectively nothing.

Rewrite so the layer is oversized and travels via `transform: translate3d(...)`, matching
what `drift` already does. The visual result — diagonal streaks drifting down-left — must
be unchanged; only the mechanism changes. Add `will-change: transform`.

### 4c — Spotify: stop polling a hidden tab

`src/lib/useSpotify.ts` polls `/me/player/currently-playing` every 6s regardless of
visibility — ~600 requests/hour against a tab nobody is looking at, spending a
rate-limit budget on invisible updates.

Gate the poll on `document.hidden`, and refresh once on `visibilitychange` so returning
to the tab updates immediately:

```ts
useEffect(() => {
  if (!connected) return;
  const tick = () => { if (!document.hidden) void poll(); };
  tick();
  const id = window.setInterval(tick, POLL_MS);
  document.addEventListener("visibilitychange", tick);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", tick);
  };
}, [connected, poll]);
```

While here, handle `429` in `src/lib/spotifyApi.ts` by respecting `Retry-After` rather
than hammering. Do **not** restructure the auth layer.

### Verify

- [ ] Clock still updates at the minute boundary; no `React.memo` was added anywhere
- [ ] Rain looks identical — compare against a screenshot taken before the change
- [ ] `prefers-reduced-motion` still respected wherever it already was
- [ ] With the app connected to Spotify, background the tab and confirm no
      `currently-playing` requests fire (Network panel / `read_network_requests`);
      returning to the tab fires exactly one

---

## Phase 5 — End-of-session feedback

**Fixes:** #12 (nothing happens when a session ends)

**Depends on Phase 2** — `complete()` is the hook point.

If Cozy Focus is doing its job, the user is looking at something else. The one moment the
app most needs to reach them is the one it currently stays silent for.

### Changes

1. **A chime** through the existing `AudioContext` in `src/lib/audioEngine.ts`. Add a
   single `playChime()` method — two or three short sine tones with an envelope, in the
   app's register. Reuse the existing context; do not create a second one. If the context
   is suspended (no gesture yet this load), skip silently.
2. **A notification**, only when `Notification.permission === "granted"`. Request
   permission from an existing user gesture — the session **start** click — never on page
   load. If denied, do nothing and never ask again.
3. **A visible ring state.** "Done" already renders; give it the ember accent so it reads
   from across a room.

### Also in this phase — #13, ambience fade

`start()` resumes the context at full level and `stop()` suspends it outright, so a
rainstorm appears and vanishes instantly. Individual layers already ramp over 250ms via
`setLevel`; the master path just doesn't. Ramp master gain over ~400ms on both edges and
suspend only after the fade-out completes.

### Verify

- [ ] Set a 1-minute session, start it, let it finish with the tab focused → chime plays, ring shows "done"
- [ ] Same with the tab backgrounded → chime plays and (if permitted) a notification appears, both promptly on return
- [ ] Deny notification permission → no errors, no repeat prompts
- [ ] Toggling ambience fades in and out rather than cutting

---

## Phase 6 — Accessibility

**Fixes:** #11 (keyboard-inaccessible controls)

The timer ring, every subtask row, and both fader and dial controls are `<div>`s with
click/pointer handlers — no `tabindex`, no key handling, no roles. You cannot start a
session, tick a task, or change the mix without a mouse, and a screen reader sees
unlabelled boxes.

### Changes

- **Timer ring** (`SessionTimer.tsx`) → real `<button>` with `aria-label` reflecting
  state ("Start session" / "Pause session"). Strip default button styling to preserve
  the exact current look.
- **Subtask rows** → `<button>` with `aria-pressed` for done state.
- **`FaderColumn.tsx` and `Dial.tsx`** → `role="slider"`, `tabIndex={0}`,
  `aria-valuenow` / `aria-valuemin={0}` / `aria-valuemax={100}`, `aria-label={meta.label}`,
  and arrow-key handling (±1, ±10 with Shift, Home/End to 0/100). Pointer behaviour
  unchanged.
- Add a visible `:focus-visible` ring everywhere, in the ember accent.
- Handle `pointercancel` alongside `pointerup` in both controls — currently a cancelled
  gesture leaves the window listeners attached.

### Verify

- [ ] Tab through the whole app — every control reachable, focus always visible
- [ ] Start/pause the session, tick a task, and change a fader using only the keyboard
- [ ] Screen reader announces fader values as they change
- [ ] Mouse and touch behaviour is unchanged

---

## Phase 7 — Font subsets

**Fixes:** #9 (62 font files, 1.2MB)

`src/index.css` lines 2–6 import the bare `@fontsource/*` entry points, pulling every
subset — Vietnamese, Greek, Greek-ext, Cyrillic, Cyrillic-ext — in both `woff` and
`woff2`. That's 1.2MB across 62 files of a 3.1MB build. Browsers only download the latin
subsets at runtime thanks to `unicode-range`, so this is deploy weight, not load time —
but it's weight for nothing.

Import the latin subsets directly:

```css
@import "@fontsource/eb-garamond/latin-400.css";
@import "@fontsource/eb-garamond/latin-500.css";
@import "@fontsource/eb-garamond/latin-400-italic.css";
@import "@fontsource/manrope/latin-400.css";
@import "@fontsource/manrope/latin-600.css";
```

### Verify

- [ ] `npm run build`, then `ls dist/assets/*.woff2 | wc -l` — substantially fewer files
- [ ] `du -sh dist` — roughly 1MB smaller
- [ ] Both typefaces still render correctly, including the italic date line

---

## Phase 8 — Error boundary

**Fixes:** #16 (one throw blanks the app)

One thrown render takes the whole app to a black screen with no recovery. Because state
is restored from `localStorage` on mount, a bad stored value can make that permanent
across reloads — Phase 1 reduces the odds but doesn't eliminate them.

Add a class error boundary in `src/main.tsx` wrapping `<App />`. The fallback should
match the app's visual language (ink ground, cream type, EB Garamond heading) and offer
exactly two actions: **Reload** and **Reset saved data** — the latter clearing all
`cozyfocus.*` keys and reloading.

> Deliberately scoped to `cozyfocus.*` keys, not `localStorage.clear()`, so the Spotify
> tokens survive a reset and the user isn't forced to reconnect.

### Verify

- [ ] Temporarily throw in a component → fallback renders instead of a blank screen
- [ ] "Reset saved data" clears `cozyfocus.*`, leaves `cozyfocus.spotify.tokens` intact, and recovers
- [ ] Remove the temporary throw before finishing

---

## Phase 9 — Responsive layout ⚠️ BLOCKED

**Fixes:** #10 (unusable below ~1000px)

**Do not start this phase without a decision from the project owner.**

Everything is pinned with hard pixel offsets (`left: 72`, `top: 64`, `fontSize: 92`). At
375px the timer ring lands on top of the clock, the mixer and Now Playing overlap and run
off the right edge, and the scene switcher is clipped. It isn't degraded — it's unreadable.

There are two legitimate answers and they lead to very different work:

- **Desktop-only by design.** Then add a minimum-width notice below ~900px and say so in
  the README. Roughly an hour.
- **Responsive.** Move the four corners into a grid with viewport-relative type, and
  collapse to a single stacked column with the mixer in a drawer under ~900px. This is
  the largest single piece of work in the plan — comfortably bigger than Phases 1–3
  combined — and it will require revisiting the idle-fade interaction, which assumes a
  pointer.

Ask which, then plan it properly. Don't split the difference: the current state serves
neither.

---

## Appendix A — Issue-to-phase map

| # | Issue | Phase |
|---|---|---|
| 1 | Timer drifts in background tabs | 2 |
| 2 | Ticked task stranded on reload | 3 |
| 3 | Destructive removal, no undo | 3 |
| 4 | Storage failures swallowed | 1 |
| 5 | localStorage write every second | 2 |
| 6 | Clock re-renders whole tree | 4a |
| 7 | Rain animation repaints full screen | 4b |
| 8 | Spotify polls hidden tab | 4c |
| 9 | 62 font files shipped | 7 |
| 10 | Unusable below ~1000px | 9 ⚠️ |
| 11 | Keyboard-inaccessible | 6 |
| 12 | Nothing happens at session end | 5 |
| 13 | Ambience starts/stops abruptly | 5 |
| 14 | Playlist loading fails invisibly | 4c |
| 15 | "Move to wake" wrong on touch | 6 |
| 16 | No error boundary | 8 |
| 17 | Persisted state cast, not validated | 1 |
| 18 | Impure state updater | 3 |
| 19 | No tests | 2 |

Two small ones fold into their nearest phase: **#14** (distinguish an empty playlist
list from a failed fetch — `fetchMyPlaylists` returns `[]` for both) lands with the other
Spotify work in 4c; **#15** ("move to wake" describes a mouse nobody has on touch — swap
to "tap or move to wake", `useIdle` already listens for `touchstart`) lands with the
other copy/interaction work in 6.

## Appendix B — Explicitly out of scope

Do **not** implement these. They are features, not fixes, and each deserves its own
planning pass:

Pomodoro cycles · session history · saved custom mixes · PWA/offline · Screen Wake Lock ·
keyboard shortcuts · richer Spotify controls (progress, volume, device picker) · real CC0
café audio · artwork rotation · moving artwork to IndexedDB

If a phase above seems to want one of these, it doesn't. Finish the phase as written.
