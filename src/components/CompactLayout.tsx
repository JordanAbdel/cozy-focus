import { useState } from "react";
import { MixerPanel, type MixerStyle } from "./mixer/MixerPanel";
import { NowPlaying } from "./NowPlaying";
import { SceneSwitcher } from "./SceneSwitcher";
import { SessionTimerRing, SessionTaskCard } from "./SessionTimer";
import { Sheet } from "./Sheet";
import type { LevelState, SceneKey } from "../lib/scenes";
import type { SessionData } from "../lib/sessionModel";
import type { WeatherNow } from "../lib/weather";

interface Props {
  time: string;
  dateLine: string;
  weather: WeatherNow | null;
  accent: string;
  cool: string;
  idle: boolean;
  chromeStyle: React.CSSProperties;
  session: SessionData;
  onSessionChange: (updater: (prev: SessionData) => SessionData) => void;
  levels: LevelState;
  onLevelChange: (key: keyof LevelState, value: number) => void;
  mixerStyle: MixerStyle;
  presetLabel: string;
  onApplyPreset: () => void;
  audioOn: boolean;
  onToggleAudio: () => void;
  scene: SceneKey;
  onSceneChange: (scene: SceneKey) => void;
  onOpenSettings: () => void;
  fullscreen: { supported: boolean; isFullscreen: boolean; toggle: () => void };
}

const BAR_BUTTON = "cursor-pointer whitespace-nowrap rounded-full text-[11px] tracking-[.05em] border";
const BAR_BUTTON_STYLE = { padding: "9px 18px", color: "rgba(237,224,206,.75)", borderColor: "rgba(237,224,206,.16)" };
const ICON_BUTTON = "cursor-pointer flex-shrink-0 w-[34px] h-[34px] rounded-full grid place-items-center border text-[13px]";
const ICON_BUTTON_STYLE = { borderColor: "rgba(237,224,206,.16)", color: "rgba(237,224,206,.75)" };

export function CompactLayout({
  time,
  dateLine,
  weather,
  accent,
  cool,
  idle,
  chromeStyle,
  session,
  onSessionChange,
  levels,
  onLevelChange,
  mixerStyle,
  presetLabel,
  onApplyPreset,
  audioOn,
  onToggleAudio,
  scene,
  onSceneChange,
  onOpenSettings,
  fullscreen,
}: Props) {
  const [sheet, setSheet] = useState<"ambience" | "music" | null>(null);

  return (
    <>
      <div
        className="absolute inset-0 flex flex-col items-center"
        style={{ padding: "26px 18px calc(18px + env(safe-area-inset-bottom))" }}
      >
        <div
          className="font-serif-cf text-center transition-fade"
          style={{
            fontSize: "clamp(44px, 13vw, 92px)",
            lineHeight: 0.95,
            letterSpacing: "-.02em",
            color: `rgba(237,224,206,${idle ? 0.2 : 0.92})`,
            textShadow: "0 2px 26px rgba(0,0,0,.5)",
          }}
        >
          {time}
        </div>

        <div className="flex flex-col items-center gap-2 mt-2" style={chromeStyle}>
          <div className="font-serif-cf italic" style={{ fontSize: 16, color: "rgba(237,224,206,.56)" }}>
            {dateLine}
          </div>
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "rgba(237,224,206,.48)" }}>
            <span className="rounded-full" style={{ width: 8, height: 8, background: cool, boxShadow: `0 0 12px ${cool}` }} />
            <span>{weather ? `${weather.tempC}° · ${weather.description}, Sydney` : "Sydney"}</span>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-4 overflow-y-auto"
          style={chromeStyle}
        >
          <SessionTimerRing session={session} onChange={onSessionChange} accent={accent} align="center" />
          <div className="w-full" style={{ maxWidth: "min(420px, 92vw)" }}>
            <SessionTaskCard session={session} onChange={onSessionChange} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 w-full" style={chromeStyle}>
          <SceneSwitcher scene={scene} onChange={onSceneChange} compact />
          <div className="flex items-center gap-2">
            <button onClick={() => setSheet("ambience")} className={BAR_BUTTON} style={BAR_BUTTON_STYLE}>
              Ambience
            </button>
            <button onClick={() => setSheet("music")} className={BAR_BUTTON} style={BAR_BUTTON_STYLE}>
              Music
            </button>
            {fullscreen.supported && (
              <button
                onClick={fullscreen.toggle}
                aria-label={fullscreen.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                className={ICON_BUTTON}
                style={ICON_BUTTON_STYLE}
              >
                {fullscreen.isFullscreen ? "⤡" : "⤢"}
              </button>
            )}
            <button onClick={onOpenSettings} aria-label="Settings" className={ICON_BUTTON} style={ICON_BUTTON_STYLE}>
              ⚙
            </button>
          </div>
        </div>
      </div>

      {/* Outside the chrome wrapper on purpose: an open sheet must stay legible
          even once the idle fade has dimmed everything behind it. */}
      <Sheet open={sheet === "ambience"} onClose={() => setSheet(null)} title="Ambience">
        <MixerPanel
          levels={levels}
          onLevelChange={onLevelChange}
          mixerStyle={mixerStyle}
          accent={accent}
          cool={cool}
          presetLabel={presetLabel}
          onApplyPreset={onApplyPreset}
          audioOn={audioOn}
          onToggleAudio={onToggleAudio}
          compact
        />
      </Sheet>

      <Sheet open={sheet === "music"} onClose={() => setSheet(null)} title="Music">
        <NowPlaying compact />
      </Sheet>
    </>
  );
}
