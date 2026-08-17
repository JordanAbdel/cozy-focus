import { useCallback, useEffect, useMemo, useState } from "react";
import { useClock } from "./components/Clock";
import { SceneSwitcher } from "./components/SceneSwitcher";
import { ArtworkSlot } from "./components/ArtworkSlot";
import { MixerPanel, type MixerStyle } from "./components/mixer/MixerPanel";
import { NowPlaying } from "./components/NowPlaying";
import { SessionTimerRing, SessionTaskCard, useSessionTicker, type SessionData } from "./components/SessionTimer";
import { SCENES, type LevelState, type SceneKey } from "./lib/scenes";
import { useLocalStorage } from "./lib/useLocalStorage";
import { useIdle } from "./lib/useIdle";
import { ambientEngine } from "./lib/audioEngine";

const ACCENT = "#C96A3C";
const COOL = "#7FA8A0";

const DEFAULT_LEVELS: LevelState = { rain: 72, fire: 44, cafe: 0, wind: 22, keys: 0, thunder: 16 };

const DEFAULT_SESSION: SessionData = {
  title: "Finish the chapter on memory",
  durationMin: 45,
  remainingSec: 45 * 60,
  running: false,
  subtasks: [
    { id: "a", text: "Re-read the two flagged pages", done: false },
    { id: "b", text: "Notes into the outline", done: true },
  ],
};

function App() {
  const { time, dateLine } = useClock();
  const idle = useIdle(30000);

  const [scene, setScene] = useLocalStorage<SceneKey>("cozyfocus.scene", "rain");
  const [mixerStyle, setMixerStyle] = useLocalStorage<MixerStyle>("cozyfocus.mixerStyle", "faders");
  const [levels, setLevels] = useLocalStorage<LevelState>("cozyfocus.levels", DEFAULT_LEVELS);
  const [artwork, setArtwork] = useLocalStorage<string | null>("cozyfocus.artwork", null);
  const [session, setSession] = useLocalStorage<SessionData>("cozyfocus.session", DEFAULT_SESSION);
  // Not persisted: browsers require a fresh user gesture per page load before
  // audio can actually play, so a "playing" flag surviving reload would lie.
  const [audioOn, setAudioOn] = useState(false);

  const sc = SCENES[scene];

  useSessionTicker(session, setSession);

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
      {scene === "art" && <ArtworkSlot image={artwork} onImageChange={setArtwork} />}

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
          <span>12&deg; &middot; light rain, Lisbon</span>
        </div>
        <SessionTaskCard session={session} onChange={setSession} />
      </div>

      <div className="absolute" style={{ right: 72, top: 64, ...chromeStyle }}>
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
          onMixerStyleChange={setMixerStyle}
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

      <div
        className="absolute left-1/2 anim-breathe"
        style={{
          bottom: 52,
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
        move to wake
      </div>
    </div>
  );
}

export default App;
