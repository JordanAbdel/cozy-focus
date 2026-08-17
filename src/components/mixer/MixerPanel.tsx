import { useState } from "react";
import { LAYER_META, tintFor, type LevelState } from "../../lib/scenes";
import { FaderColumn } from "./FaderColumn";
import { Dial } from "./Dial";

export type MixerStyle = "faders" | "dials";

interface Props {
  levels: LevelState;
  onLevelChange: (key: keyof LevelState, value: number) => void;
  mixerStyle: MixerStyle;
  onMixerStyleChange: (style: MixerStyle) => void;
  accent: string;
  cool: string;
  presetLabel: string;
  onApplyPreset: () => void;
  audioOn: boolean;
  onToggleAudio: () => void;
}

export function MixerPanel({
  levels,
  onLevelChange,
  mixerStyle,
  onMixerStyleChange,
  accent,
  cool,
  presetLabel,
  onApplyPreset,
  audioOn,
  onToggleAudio,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(true);

  return (
    <div
      className="rounded-[20px] border backdrop-blur-2xl"
      style={{
        padding: "22px 28px 20px",
        borderColor: "rgba(237,224,206,.10)",
        background: "rgba(38,24,16,.40)",
        boxShadow: "0 30px 70px -28px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.06)",
      }}
    >
      <div className="flex items-center justify-between gap-7 mb-5">
        <div className="text-[10px] tracking-[.22em] uppercase" style={{ color: "rgba(237,224,206,.3)" }}>
          Ambience
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onApplyPreset}
            className="cursor-pointer text-[11px] px-[11px] py-1 rounded-full border transition-colors"
            style={{ borderColor: "rgba(127,168,160,.35)", color: "rgba(127,168,160,.9)" }}
          >
            {presetLabel}
          </button>
          <button
            onClick={onToggleAudio}
            title={audioOn ? "Pause ambience" : "Play ambience"}
            className="cursor-pointer w-[26px] h-[26px] rounded-full grid place-items-center border text-[11px]"
            style={{
              borderColor: audioOn ? "rgba(232,160,92,.6)" : "rgba(237,224,206,.14)",
              color: audioOn ? "#EDE0CE" : "rgba(237,224,206,.5)",
            }}
          >
            {audioOn ? "❙❙" : "▶"}
          </button>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="cursor-pointer w-[26px] h-[26px] rounded-full grid place-items-center border text-[12px]"
            style={{ borderColor: "rgba(237,224,206,.14)", color: "rgba(237,224,206,.5)" }}
          >
            ⚙
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div
          className="rounded-[14px] flex flex-col gap-2.5"
          style={{ margin: "-6px 0 18px", padding: "14px 16px", background: "rgba(10,6,4,.4)", boxShadow: "inset 0 0 0 1px rgba(237,224,206,.07)" }}
        >
          <div className="text-[9px] tracking-[.22em] uppercase" style={{ color: "rgba(237,224,206,.32)" }}>
            Control style
          </div>
          <div className="flex gap-2">
            {(["faders", "dials"] as MixerStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => onMixerStyleChange(s)}
                className="cursor-pointer px-3.5 py-[7px] rounded-full text-[11px] tracking-[.1em] uppercase border"
                style={{
                  color: mixerStyle === s ? "#EDE0CE" : "rgba(237,224,206,.45)",
                  background: mixerStyle === s ? "rgba(201,106,60,.26)" : "transparent",
                  borderColor: mixerStyle === s ? "rgba(232,160,92,.45)" : "rgba(237,224,206,.12)",
                }}
              >
                {s === "faders" ? "Faders" : "Dials"}
              </button>
            ))}
          </div>
        </div>
      )}

      {mixerStyle === "faders" ? (
        <div className="flex gap-[22px]">
          {LAYER_META.map((m) => (
            <FaderColumn key={m.key} meta={m} tint={tintFor(m.key, accent, cool)} value={levels[m.key]} onChange={(v) => onLevelChange(m.key, v)} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-5 gap-y-6" style={{ width: 334 }}>
          {LAYER_META.map((m) => (
            <Dial key={m.key} meta={m} tint={tintFor(m.key, accent, cool)} value={levels[m.key]} onChange={(v) => onLevelChange(m.key, v)} />
          ))}
        </div>
      )}
    </div>
  );
}
