import { LAYER_META, tintFor, type LevelState } from "../../lib/scenes";
import { FaderColumn } from "./FaderColumn";
import { Dial } from "./Dial";

export type MixerStyle = "faders" | "dials";

interface Props {
  levels: LevelState;
  onLevelChange: (key: keyof LevelState, value: number) => void;
  mixerStyle: MixerStyle;
  accent: string;
  cool: string;
  presetLabel: string;
  onApplyPreset: () => void;
  audioOn: boolean;
  onToggleAudio: () => void;
  compact?: boolean;
}

export function MixerPanel({
  levels,
  onLevelChange,
  mixerStyle,
  accent,
  cool,
  presetLabel,
  onApplyPreset,
  audioOn,
  onToggleAudio,
  compact = false,
}: Props) {
  return (
    // Compact drops its own card chrome and heading: the sheet around it already
    // supplies the ground and the "Ambience" title.
    <div
      className={compact ? "" : "rounded-[20px] border backdrop-blur-2xl"}
      style={
        compact
          ? undefined
          : {
              padding: "22px 28px 20px",
              borderColor: "rgba(237,224,206,.10)",
              background: "rgba(38,24,16,.40)",
              boxShadow: "0 30px 70px -28px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.06)",
            }
      }
    >
      <div className={`flex items-center gap-7 mb-5 ${compact ? "justify-end" : "justify-between"}`}>
        {!compact && (
          <div className="text-[10px] tracking-[.22em] uppercase" style={{ color: "rgba(237,224,206,.3)" }}>
            Ambience
          </div>
        )}
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
        </div>
      </div>

      {mixerStyle === "faders" ? (
        <div className={`flex${compact ? " justify-center" : ""}`} style={{ gap: compact ? 12 : 22 }}>
          {LAYER_META.map((m) => (
            <FaderColumn
              key={m.key}
              meta={m}
              tint={tintFor(m.key, accent, cool)}
              value={levels[m.key]}
              onChange={(v) => onLevelChange(m.key, v)}
              width={compact ? 30 : 34}
              height={compact ? 150 : 186}
              compact={compact}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-5 gap-y-6" style={compact ? undefined : { width: 334 }}>
          {LAYER_META.map((m) => (
            <Dial key={m.key} meta={m} tint={tintFor(m.key, accent, cool)} value={levels[m.key]} onChange={(v) => onLevelChange(m.key, v)} />
          ))}
        </div>
      )}
    </div>
  );
}
