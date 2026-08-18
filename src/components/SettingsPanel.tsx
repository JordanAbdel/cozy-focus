import type { MixerStyle } from "./mixer/MixerPanel";
import { isRunning, setDuration as applyDuration, type SessionData } from "../lib/sessionModel";

interface Props {
  open: boolean;
  onClose: () => void;
  mixerStyle: MixerStyle;
  onMixerStyleChange: (style: MixerStyle) => void;
  session: SessionData;
  onSessionChange: (updater: (prev: SessionData) => SessionData) => void;
}

export function SettingsPanel({ open, onClose, mixerStyle, onMixerStyleChange, session, onSessionChange }: Props) {
  if (!open) return null;

  const setDuration = (min: number) => {
    const clamped = Math.max(1, Math.min(180, Math.round(min)));
    onSessionChange((prev) => applyDuration(prev, clamped));
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      style={{ background: "rgba(8,5,3,.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-[20px] border backdrop-blur-2xl flex flex-col gap-6"
        style={{
          width: "min(380px, calc(100vw - 32px))",
          padding: "26px 28px",
          borderColor: "rgba(237,224,206,.10)",
          background: "rgba(38,24,16,.94)",
          boxShadow: "0 30px 70px -28px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06)",
          color: "rgba(237,224,206,.85)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="font-serif-cf" style={{ fontSize: 20 }}>
            Settings
          </div>
          <button onClick={onClose} className="cursor-pointer text-[13px]" style={{ color: "rgba(237,224,206,.5)" }}>
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-[10px] tracking-[.22em] uppercase" style={{ color: "rgba(237,224,206,.32)" }}>
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

        <div className="flex flex-col gap-3">
          <div className="text-[10px] tracking-[.22em] uppercase" style={{ color: "rgba(237,224,206,.32)" }}>
            Session timer
          </div>
          <label className="flex flex-col gap-1.5 text-[13px]" style={{ color: "rgba(237,224,206,.6)" }}>
            Title
            <input
              defaultValue={session.title}
              onBlur={(e) => onSessionChange((prev) => ({ ...prev, title: e.target.value.trim() || prev.title }))}
              className="bg-transparent border-b outline-none py-1"
              style={{ borderColor: "rgba(237,224,206,.25)", color: "rgba(237,224,206,.85)" }}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px]" style={{ color: "rgba(237,224,206,.6)" }}>
            Duration (minutes)
            <input
              type="number"
              min={1}
              max={180}
              defaultValue={session.durationMin}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (Number.isFinite(val) && val > 0) setDuration(val);
              }}
              className="bg-transparent border-b outline-none py-1"
              style={{ borderColor: "rgba(237,224,206,.25)", color: "rgba(237,224,206,.85)", width: 100 }}
            />
          </label>
          {isRunning(session) && (
            <div className="text-[11px]" style={{ color: "rgba(237,224,206,.4)" }}>
              This changes the timer's target length; the current countdown keeps running until you pause or reset it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
