# Cozy Focus — run where it belongs

Follow-on to [IMPROVEMENT-PLAN.md](./IMPROVEMENT-PLAN.md), which fixed 18 of 19 review
defects across Phases 1–8. That plan left one item open (#10, unusable below ~1000px)
because it needed a product decision. **That decision is made: responsive, with a
phone-first compact layout.**

This plan covers four things:

1. A real café recording, replacing the synthesized noise that never sounded like a café.
2. Holding the screen — Wake Lock and fullscreen — so a running session isn't
   interrupted by the OS dimming the display.
3. A compact layout for everything below desktop width.
4. Making the app installable and offline-capable.

## Ground rules

The rules from the previous plan still apply and still override default instincts:
surgical changes, match the existing style (inline `style={{}}` objects with `rgba()`
literals alongside Tailwind classes, named function exports, 2-space indent, double
quotes), no speculative abstraction, each phase ends green before the next begins, and
**if a phase's premise looks wrong when you get there, stop and say so.**

One addition specific to this plan:

> **The desktop layout must not change.** Phase 3 adds a second layout below a
> breakpoint; it does not refactor the existing one. A screenshot at 1440px before and
> after Phase 3 should be identical. This is the single biggest regression risk here.

### Environment

| | |
|---|---|
| Project root | `/Users/jordanabdel/Documents/Claude/CozyFocus` |
| Dev server | `preview_start` with name `cozy-focus`, port 5174 |
| ⚠️ launch.json | Lives in `/Users/jordanabdel/Documents/Claude/Meridan/.claude/launch.json`, **not** in this project |
| Typecheck | `npx tsc -b --noEmit` — must exit 0 |
| Build | `npm run build` — must succeed |
| Tests | `npm test` (Vitest) — 22 tests over `sessionModel.ts`, must stay green |

### Landmines

- **`StrictMode` is on.** Effects run twice in dev. Both new hooks in Phase 2 acquire an
  external resource; if the cleanup is wrong you will leak a wake lock sentinel and not
  notice.
- **Do not touch `SCOPES` in `src/lib/spotifyAuth.ts`.** Changing it invalidates every
  stored token and silently forces a reconnect.
- **A service worker caches aggressively.** Phase 4 goes last deliberately. Once it is
  registered, stale assets during development become a real source of confusion — use
  `registerType: "autoUpdate"` and hard-reload when something looks wrong.
- **`LAYER_MAX.cafe` is currently tuned for the synth.** Phase 1 changes what that number
  is scaling. It must be re-checked by ear, not assumed.

## Phase order

```
Phase 1  Café audio          (independent, small)
Phase 2  Hold the screen     (independent, small)
Phase 3  Compact layout      (the large one)
Phase 4  Installable/offline (do LAST — depends on 3 for the mobile case)
```

Phases 1 and 2 are independent of each other and of 3. Phase 4 goes last because
precaching a layout you are still changing wastes effort, and because "installable" only
means much once the phone layout exists.

---

## Phase 1 — Café audio

**Replaces:** the synthesized café layer, which is bandpass-filtered white noise with a
0.15 Hz LFO on the filter frequency, and reads as static rather than a room.

### The file

A 45-second seamless loop cut from a CC0 field recording, normalised to −28 dB mean to
match `rain.mp3`, encoded 128 kbps MP3 — the same shape as the other five loops
(`rain.mp3` is 45.03 s / 704 K; the café loop is 45.02 s / 704 K).

Two candidates were prepared and auditioned; the chosen one lands at
`public/audio/cafe.mp3`. Both loop seams were verified clean by comparing the wrap-point
sample step against the file's own p99 step size.

### Files

- `public/audio/cafe.mp3` (**new**)
- `public/audio/CREDITS.md` (add the credit, drop the "no matching CC0 source" note)
- `src/lib/audioEngine.ts` (modify)

### Changes to `audioEngine.ts`

Café moves from a synth special case to an ordinary loop layer:

```ts
type LoopKey = "rain" | "wind" | "fire" | "cafe";

const LOOP_FILES: Record<LoopKey, string> = {
  rain: "/audio/rain.mp3",
  wind: "/audio/wind.mp3",
  fire: "/audio/fire.mp3",
  cafe: "/audio/cafe.mp3",
};
```

In `start()`, replace `this.buildCafeSynth()` with `this.buildLoopLayer("cafe")`.

Then **delete** `buildCafeSynth()` entirely, along with `createNoiseBuffer()` and the
`noiseBuffer` field — `buildCafeSynth` is their only consumer, so this change orphans
them. Update the class comment at the top, which currently explains the café compromise.

### `LAYER_MAX.cafe` — check this by ear

Currently `0.2`, chosen to keep the synth's harsh noise floor tolerable. The new file is
normalised to the same level as `rain.mp3`, whose ceiling is `0.55`. Start at **`0.45`**
— café should sit under rain as a background murmur — then listen with the fader at 100
alongside rain at 100 and adjust. This is a judgement call that cannot be made from the
numbers alone. Do not leave it at `0.2`; that was calibrated for a different signal and
will make the new layer nearly inaudible.

### Verify

- [ ] `npx tsc -b --noEmit` exits 0, `npm run build` succeeds
- [ ] Café fader at 100 with everything else at 0 sounds like a room with people in it
- [ ] Let it run past 45 s and then past 90 s — no click, and the loop point is not
      obvious enough to notice
- [ ] Café at 100 against rain at 100 is a background layer, not a competitor
- [ ] `buildCafeSynth`, `createNoiseBuffer` and `noiseBuffer` are gone, and nothing else
      referenced them
- [ ] `CREDITS.md` credits the new file and no longer claims no CC0 source exists

---

## Phase 2 — Hold the screen

**Fixes:** the OS dimming and locking the display during a session — the app's single
most premise-breaking gap. `useIdle` fades the chrome after 30 s precisely because you
are meant to leave the app running and look at it. Nothing stops the display sleeping
underneath that.

### 2a — Wake Lock

New file `src/lib/useWakeLock.ts`:

```ts
import { useEffect } from "react";

// Holds the screen awake while `active`. Browsers release the lock automatically
// whenever the tab is hidden, so it has to be re-acquired on the way back.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.hidden || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          sentinel = null;
        }
      } catch {
        // Denied by the OS (low battery, policy). The session still runs; there is
        // nothing useful to tell the user here.
      }
    };

    void acquire();
    const onVisible = () => {
      if (!document.hidden) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, [active]);
}
```

The `cancelled` flag matters: under StrictMode the effect runs twice, and `request()` is
async, so a sentinel can resolve *after* its own cleanup has run. Without the flag that
lock is never released.

Wire it in `App.tsx` next to the existing ticker:

```ts
useWakeLock(isRunning(session));
```

`isRunning` is already imported there. Note this deliberately keys off the session
running, not off ambience playing — the screen should stay awake for a countdown you are
watching, not for audio you can hear with the lid shut.

### 2b — Fullscreen

New file `src/lib/useFullscreen.ts` returning `{ supported, isFullscreen, toggle }`.
`supported` is `document.fullscreenEnabled`, which is **false on iPhone** — Safari there
only allows fullscreen video. The control must hide itself rather than offer a button
that does nothing.

Track state from the `fullscreenchange` event rather than assuming `toggle` succeeded;
the user can leave fullscreen with Escape without going through the button.

Add the control beside the existing settings gear in `App.tsx` (top right, inside the
same `flex flex-col items-end gap-3` stack), matching the gear's exact treatment — 26px
circle, 1px border at `rgba(237,224,206,.14)`, `rgba(237,224,206,.5)` glyph. Give it an
`aria-label` that reflects state, the way the timer ring does.

### Verify

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] Start a session, then in the console: `navigator.wakeLock` has an unreleased
      sentinel. Pause — it releases. Confirm via the hook's own effect, not by watching
      a screen for ten minutes
- [ ] Background the tab mid-session and return — the lock is re-acquired, not lost
- [ ] Under StrictMode, starting and stopping a session repeatedly does not accumulate
      sentinels
- [ ] Fullscreen button enters and exits; pressing Escape updates the button state
- [ ] The button is absent where `document.fullscreenEnabled` is false
- [ ] Both controls are keyboard reachable with a visible focus ring

---

## Phase 3 — Compact layout

**Fixes:** #10 from the previous plan. Below roughly 1080px the four-corner layout
collides with itself; at 375px it is unreadable.

### Measured minimums

These are why a breakpoint alone cannot fix it:

| Element | Needs | Why |
|---|---|---|
| Now Playing | 520 px | 172 px sleeve + 28 px gap + 290 px text + 2 × 34 px padding |
| Mixer (dials) | 390 px | fixed `width: 334` + 2 × 28 px padding |
| Mixer (faders) | 370 px | 6 × 34 px + 5 × 22 px gap + padding |
| Scene switcher | ~425 px | five pills at 18 px horizontal padding |
| Settings panel | 380 px | fixed width |
| Spotify library | 420 px | fixed width |

Left column (520) + right column (390) + two 72px margins = **1054 px** before any gap
between them. Hence the breakpoint below.

### The shape

**At ≥ 1080px: nothing changes.** The existing four-corner layout renders exactly as it
does today.

**Below 1080px:** a single non-scrolling focus screen — clock, date, weather, timer ring,
session title and subtasks — with the mixer and Now Playing moved into bottom sheets
opened from a control bar. The page body never scrolls; sheets scroll internally if they
must. This preserves what the app is (something you glance at) rather than turning it
into a page you read.

### Files

- `src/lib/useMediaQuery.ts` (**new**)
- `src/components/Sheet.tsx` (**new**)
- `src/components/CompactLayout.tsx` (**new**)
- `src/App.tsx` (branch between layouts; shared backdrop stays put)
- `src/components/mixer/MixerPanel.tsx` (accept compact sizing)
- `src/components/NowPlaying.tsx` (stacked variant)
- `src/components/SceneSwitcher.tsx` (tighter pills)
- `src/components/SettingsPanel.tsx`, `src/components/SpotifyLibrary.tsx` (width fix)

### `Sheet.tsx`

Match the existing modal pattern exactly — both `SettingsPanel` and `SpotifyLibrary`
already share it, and a third convention would be one too many:

- `if (!open) return null`
- backdrop `fixed inset-0 z-50`, `rgba(8,5,3,.6)` with `backdropFilter: blur(6px)`,
  `onClick={onClose}`
- panel stops propagation, `rounded-[20px] border backdrop-blur-2xl`, background
  `rgba(38,24,16,.94)`, same border and shadow
- header row: `font-serif-cf` 20px title on the left, `✕` on the right

The differences: anchor to the bottom (`items-end` rather than `place-items-center`),
full width with rounded top corners only, `max-height: 80vh`, and slide up via
`transform: translateY()` — composited, and gated behind `prefers-reduced-motion` like
`.subtask-row` already is.

Add Escape-to-close **in `Sheet` only**. The two existing modals lack it; fixing them is
out of scope for this plan, but do not propagate the omission into new code.

### `CompactLayout.tsx`

Vertical rhythm, all within one viewport height, no scroll:

1. Clock — `fontSize: clamp(44px, 13vw, 92px)`, centred, keeping the existing serif
   treatment and the idle-dimming behaviour
2. Date line and weather, centred beneath it
3. Timer ring, centred, at its existing size
4. Session title and subtask list, centred, constrained to `min(420px, 90vw)`
5. Control bar pinned to the bottom: scene pills, then `Ambience` and `Music` buttons
   that open the two sheets, then the settings gear

The six backdrop layers in `App.tsx` are viewport-filling and layout-independent — they
stay exactly where they are and are shared by both layouts. Only the content regions
branch.

### Component adjustments

**MixerPanel** — `FaderColumn` already takes `width` and `height` props and `Dial` takes
`size`, so compact sizing needs no new component, just smaller values passed down.
Faders at `width: 28`, `height: 150` give `6 × 28 + 5 × 16 + padding` ≈ 296px, which fits
375px with room. Remove the hard-coded `width: 334` from the dials grid and let it be
fluid.

**NowPlaying** — stack below the breakpoint: sleeve on top at ~120px, text and controls
beneath, `maxWidth: 100%`. The `maxWidth: 290` on the description line has to go fluid
too, or it will pin the card wide.

**SceneSwitcher** — five pills at `px-[18px]` need ~425px. Drop to `px-3` with 10px type
at compact, giving ~300px. If that still overflows on the narrowest targets, allow
horizontal scroll rather than shrinking further.

**SettingsPanel / SpotifyLibrary** — change fixed `width: 380` / `width: 420` to
`width: "min(380px, calc(100vw - 32px))"` and the same for 420. One line each; without it
both modals overflow a phone regardless of everything else here.

### Idle fade and touch

`useIdle` already listens for `touchstart`, and the copy already reads "tap or move to
wake". Two things to check rather than assume: an open sheet must not fade out from under
the user, and dismissing a sheet should count as activity.

### Verify

- [ ] `npx tsc -b --noEmit` exits 0, `npm run build` succeeds, `npm test` still green
- [ ] **Desktop is untouched** — screenshot at 1440px before and after this phase and
      compare. Any difference is a bug in this phase
- [ ] 1080px and 1079px render the two layouts and neither collides
- [ ] At 375px, 390px, 414px and 768px: nothing overlaps, nothing is clipped, and
      `document.body.scrollWidth <= window.innerWidth` (no horizontal scroll)
- [ ] Both sheets open, scroll internally when tall, close on backdrop tap, on ✕, and on
      Escape
- [ ] Settings and Spotify modals fit inside a 375px viewport
- [ ] Faders and dials are both usable by touch at compact size
- [ ] Keyboard path from Phase 6 of the previous plan still works in the compact layout
- [ ] The idle fade still runs, and does not fire while a sheet is open

---

## Phase 4 — Installable and offline

**Do this last.** It caches the output of Phase 3.

The app is already most of the way to offline: all five ambience files are local, and only
weather and Spotify touch the network. Nothing declares that, so it is neither
installable nor available offline.

### Changes

```bash
npm i -D vite-plugin-pwa
```

Configure in `vite.config.ts` with `registerType: "autoUpdate"`, a manifest using the
app's existing palette (`theme_color` and `background_color` both `#0E0906`, the `--ink`
value; `display: "standalone"`), and a workbox `globPatterns` that includes `mp3` and
`woff2`. The largest single asset is `rain.mp3` at 704 K, comfortably under workbox's 2 MB
default file-size ceiling, so that does not need raising.

Total precache is roughly 1.4 MB of audio plus the latin font subsets and the JS/CSS
bundle — well within reason for an install.

### Icons

The manifest needs raster icons; the project only has `public/favicon.svg`. Generate
192px and 512px PNGs from it, plus a 512px maskable variant with the safe-area padding
maskable icons require. Check for `rsvg-convert` or ImageMagick first; if neither is
present, render the SVG in the browser pane at 512px and capture it.

### Offline behaviour

Two network paths need to fail quietly rather than break the screen:

- `useWeather` — already catches; confirm the weather line degrades to just "Sydney"
  rather than rendering an error or an empty gap
- `useSpotify` — confirm an offline load shows the disconnected state rather than
  throwing into the Phase 8 error boundary

### Verify

- [ ] `npm run build` succeeds and emits `sw.js` and `manifest.webmanifest`
- [ ] Serve the build, install it, and launch from the installed icon — it opens
      standalone, without browser chrome
- [ ] Go offline, hard-reload — the app loads, ambience plays, the timer runs
- [ ] Offline, the weather line degrades quietly and Spotify shows disconnected; the
      error boundary does not appear
- [ ] Icons render correctly on the home screen, and the maskable variant is not clipped
      on a circular mask
- [ ] Online again, a rebuild is picked up rather than serving stale assets forever

---

## Appendix — out of scope

Still deliberately excluded, unchanged from the previous plan's Appendix B and for the
same reason — these are features, each deserving its own planning pass:

Pomodoro cycles · session history · streaks · saved custom mixes · keyboard shortcuts ·
richer Spotify controls (progress, volume, device picker) · artwork rotation · moving
artwork to IndexedDB · un-hardcoding Sydney

Two additions to that list, both noticed while writing this plan:

- **Escape-to-close on the two existing modals.** `Sheet` gets it because it is new code;
  retrofitting `SettingsPanel` and `SpotifyLibrary` is a separate small fix.
- **The README is still the Vite template.** Worth fixing, unrelated to this work.
