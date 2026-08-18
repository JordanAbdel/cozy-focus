import { useCallback, useEffect, useMemo, useState } from "react";
import { useClock } from "./components/Clock";
import { SceneSwitcher } from "./components/SceneSwitcher";
import { ArtworkSlot } from "./components/ArtworkSlot";
import { MixerPanel, type MixerStyle } from "./components/mixer/MixerPanel";
import { NowPlaying } from "./components/NowPlaying";
import { SettingsPanel } from "./components/SettingsPanel";
import { SessionTimerRing, SessionTaskCard, useSessionTicker } from "./components/SessionTimer";
import { CompactLayout } from "./components/CompactLayout";
import { SCENES, type LevelState, type SceneKey } from "./lib/scenes";
import { isRunning, reviveSession, type SessionData } from "./lib/sessionModel";
import { useLocalStorage } from "./lib/useLocalStorage";
import { useIdle } from "./lib/useIdle";
import { useMediaQuery } from "./lib/useMediaQuery";
import { useWakeLock } from "./lib/useWakeLock";
import { useFullscreen } from "./lib/useFullscreen";
import { ambientEngine } from "./lib/audioEngine";
import { useWeather } from "./lib/useWeather";

const ACCENT = "#C96A3C";
const COOL = "#7FA8A0";

const DEFAULT_LEVELS: LevelState = { rain: 72, fire: 44, cafe: 0, wind: 22, keys: 0, thunder: 16 };

const DEFAULT_SESSION: SessionData = {
  version: 2,
  title: "Finish the chapter on memory",
  durationMin: 45,
  endsAt: null,
  pausedSec: 45 * 60,
  subtasks: [
    { id: "a", text: "Re-read the two flagged pages", doneAt: null },
    { id: "b", text: "Notes into the outline", doneAt: Date.now() },
  ],
};

function App() {
  const { time, dateLine } = useClock();
  const weather = useWeather();
  const idle = useIdle(30000);
  const fullscreen = useFullscreen();
  // 520px Now Playing + 390px mixer + two 72px margins = 1054px before any gap
  // between the columns, so below this the four-corner layout collides.
  const isDesktop = useMediaQuery("(min-width: 1080px)");

  const [scene, setScene] = useLocalStorage<SceneKey>("cozyfocus.scene", "rain");
  const [mixerStyle, setMixerStyle] = useLocalStorage<MixerStyle>("cozyfocus.mixerStyle", "faders");
  const [levels, setLevels] = useLocalStorage<LevelState>("cozyfocus.levels", DEFAULT_LEVELS);
  const [artworkError, setArtworkError] = useState<string | null>(null);
  const [artwork, setArtwork] = useLocalStorage<string | null>("cozyfocus.artwork", null, {
    onWriteError: () => setArtworkError("That image is too large to save. Try a smaller one."),
  });
  const [session, setSession] = useLocalStorage<SessionData>("cozyfocus.session", DEFAULT_SESSION, {
    revive: (raw) => reviveSession(raw, DEFAULT_SESSION),
  });
  // Not persisted: browsers require a fresh user gesture per page load before
  // audio can actually play, so a "playing" flag surviving reload would lie.
  const [audioOn, setAudioOn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sc = SCENES[scene];

  const handleSessionComplete = useCallback(() => {
    ambientEngine.playChime();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Session complete", { body: session.title, silent: true });
    }
  }, [session.title]);

  useSessionTicker(session, setSession, handleSessionComplete);

  // Keyed to the countdown, not to ambience: the screen should stay lit for a
  // timer you are watching, not for audio you can hear with the lid shut.
  useWakeLock(isRunning(session));

  useEffect(() => {
    ambientEngine.setLevels(levels);
  }, [levels]);

  useEffect(() => {
    if (audioOn) ambientEngine.start();
    else ambientEngine.stop();
  }, [audioOn]);

  const handleLevelChange = useCallback(
    (key: keyof LevelState, value: number) => {
      setLevels((prev) => ({ ...prev, [key]: value }));
    },
    [setLevels],
  );

  const applyPreset = useCallback(() => {
    setLevels({ ...sc.preset });
  }, [sc, setLevels]);

  const toggleAudio = useCallback(() => setAudioOn((v) => !v), [setAudioOn]);

  const handleArtworkChange = useCallback(
    (dataUrl: string | null) => {
      setArtworkError(null);
      setArtwork(dataUrl);
    },
    [setArtwork],
  );

  const chromeStyle = useMemo(
    () => ({
      opacity: idle ? 0 : 1,
      transition: "opacity 900ms ease",
      pointerEvents: idle ? ("none" as const) : ("auto" as const),
    }),
    [idle],
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none" style={{ background: "#150E09" }}>
      {scene === "art" && <ArtworkSlot image={artwork} onImageChange={handleArtworkChange} error={artworkError} />}

      <div className="absolute inset-0 pointer-events-none transition-fade" style={{ opacity: sc.base, background: sc.backdrop }} />
      <div className="absolute inset-0 pointer-events-none transition-fade" style={{ background: sc.overlay }} />
      <div
        className="absolute pointer-events-none anim-drift transition-fade"
        style={{
          inset: "-10%",
          opacity: sc.fogOpacity,
          background:
            "radial-gradient(45% 32% at 30% 62%,rgba(201,164,120,.20),transparent 70%),radial-gradient(40% 26% at 74% 40%,rgba(127,168,160,.16),transparent 72%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none anim-flicker transition-fade"
        style={{ opacity: sc.fireOpacity, background: "radial-gradient(38% 46% at 18% 84%,rgba(232,140,60,.55),transparent 72%)" }}
      />
      <div
        className="absolute pointer-events-none anim-rainfall transition-fade"
        style={{
          inset: "-20% -10%",
          opacity: sc.rainOpacity,
          background:
            "repeating-linear-gradient(76deg,rgba(216,226,224,.30) 0 1px,transparent 1px 26px),repeating-linear-gradient(74deg,rgba(216,226,224,.14) 0 1px,transparent 1px 13px)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(115% 85% at 50% 45%,transparent 40%,rgba(10,6,4,.62) 100%)" }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "var(--grain)", mixBlendMode: "soft-light", opacity: 0.5 }} />

      {isDesktop ? (
        <>
          <div
            className="absolute font-serif-cf transition-fade"
            style={{ left: 72, top: 64, fontSize: 92, lineHeight: 0.92, letterSpacing: "-.02em", color: `rgba(237,224,206,${idle ? 0.2 : 0.92})`, textShadow: "0 2px 26px rgba(0,0,0,.5)" }}
          >
            {time}
          </div>

          <div className="absolute" style={{ left: 72, top: 64 + 92 + 6, ...chromeStyle }}>
            <div className="font-serif-cf italic" style={{ fontSize: 19, color: "rgba(237,224,206,.56)" }}>
              {dateLine}
            </div>
            <div className="flex items-center gap-2.5 mt-3.5 text-[13px]" style={{ color: "rgba(237,224,206,.48)" }}>
              <span className="rounded-full" style={{ width: 9, height: 9, background: COOL, boxShadow: `0 0 12px ${COOL}` }} />
              <span>{weather ? `${weather.tempC}° · ${weather.description}, Sydney` : "Sydney"}</span>
            </div>
            <SessionTaskCard session={session} onChange={setSession} />
          </div>

          <div className="absolute flex flex-col items-end gap-3" style={{ right: 72, top: 64, ...chromeStyle }}>
            <div className="flex items-center gap-2">
              {fullscreen.supported && (
                <button
                  onClick={fullscreen.toggle}
                  title={fullscreen.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  aria-label={fullscreen.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  className="cursor-pointer w-[26px] h-[26px] rounded-full grid place-items-center border text-[12px]"
                  style={{ borderColor: "rgba(237,224,206,.14)", color: "rgba(237,224,206,.5)" }}
                >
                  {fullscreen.isFullscreen ? "⤡" : "⤢"}
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                title="Settings"
                className="cursor-pointer w-[26px] h-[26px] rounded-full grid place-items-center border text-[12px]"
                style={{ borderColor: "rgba(237,224,206,.14)", color: "rgba(237,224,206,.5)" }}
              >
                ⚙
              </button>
            </div>
            <SessionTimerRing session={session} onChange={setSession} accent={ACCENT} />
          </div>

          <div className="absolute" style={{ left: 72, bottom: 64, ...chromeStyle }}>
            <NowPlaying />
          </div>

          <div className="absolute" style={{ right: 72, bottom: 64, ...chromeStyle }}>
            <MixerPanel
              levels={levels}
              onLevelChange={handleLevelChange}
              mixerStyle={mixerStyle}
              accent={ACCENT}
              cool={COOL}
              presetLabel={`${sc.label.toLowerCase()} preset`}
              onApplyPreset={applyPreset}
              audioOn={audioOn}
              onToggleAudio={toggleAudio}
            />
          </div>

          <div style={chromeStyle}>
            <SceneSwitcher scene={scene} onChange={setScene} />
          </div>
        </>
      ) : (
        <CompactLayout
          time={time}
          dateLine={dateLine}
          weather={weather}
          accent={ACCENT}
          cool={COOL}
          idle={idle}
          chromeStyle={chromeStyle}
          session={session}
          onSessionChange={setSession}
          levels={levels}
          onLevelChange={handleLevelChange}
          mixerStyle={mixerStyle}
          presetLabel={`${sc.label.toLowerCase()} preset`}
          onApplyPreset={applyPreset}
          audioOn={audioOn}
          onToggleAudio={toggleAudio}
          scene={scene}
          onSceneChange={setScene}
          onOpenSettings={() => setSettingsOpen(true)}
          fullscreen={fullscreen}
        />
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mixerStyle={mixerStyle}
        onMixerStyleChange={setMixerStyle}
        session={session}
        onSessionChange={setSession}
      />

      <div
        className="absolute left-1/2 anim-breathe"
        style={{
          // Clears the compact control bar, which occupies the bottom ~100px.
          bottom: isDesktop ? 52 : 112,
          transform: "translateX(-50%)",
          fontSize: 11,
          letterSpacing: ".26em",
          textTransform: "uppercase",
          color: "rgba(237,224,206,.13)",
          opacity: idle ? 1 : 0,
          transition: "opacity 900ms ease",
          pointerEvents: "none",
        }}
      >
        tap or move to wake
      </div>
    </div>
  );
}

export default App;
