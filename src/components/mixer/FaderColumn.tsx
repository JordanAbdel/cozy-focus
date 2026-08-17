import { useRef } from "react";
import type { LayerMeta } from "../../lib/scenes";

interface Props {
  meta: LayerMeta;
  tint: string;
  value: number;
  onChange: (value: number) => void;
  height?: number;
  width?: number;
}

export function FaderColumn({ meta, tint, value, onChange, height = 186, width = 34 }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const compute = (clientY: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const frac = 1 - (clientY - rect.top) / rect.height;
    return Math.max(0, Math.min(100, Math.round(frac * 100)));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    onChange(compute(e.clientY));
    const move = (ev: PointerEvent) => {
      if (dragging.current) onChange(compute(ev.clientY));
    };
    const up = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    e.preventDefault();
  };

  return (
    <div className="flex flex-col items-center gap-3" style={{ width }}>
      <span
        className="font-serif-cf leading-none grid place-items-center"
        style={{ fontSize: 20, height: 24, color: tint }}
      >
        {meta.glyph}
      </span>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className="relative rounded-full cursor-ns-resize overflow-hidden select-none touch-none"
        style={{
          width,
          height,
          background: "linear-gradient(180deg,rgba(10,6,4,.55),rgba(10,6,4,.28))",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,.7), inset 0 0 0 1px rgba(237,224,206,.07)",
        }}
      >
        <div
          className="absolute left-0 right-0 bottom-0"
          style={{ height: `${value}%`, background: `linear-gradient(180deg, ${tint}, rgba(201,106,60,.35))`, opacity: 0.85 }}
        />
        <div
          className="absolute rounded-md"
          style={{
            left: 3,
            right: 3,
            bottom: `calc(${value}% - 8px)`,
            height: 16,
            background: "linear-gradient(180deg,#E9DCC8,#A8907A)",
            boxShadow: "0 3px 8px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.6)",
          }}
        />
      </div>
      <div className="text-center">
        <div className="text-[10px] tracking-[.1em] uppercase" style={{ color: "rgba(237,224,206,.5)" }}>
          {meta.label}
        </div>
        <div className="text-[10px] mt-[3px]" style={{ color: "rgba(237,224,206,.28)" }}>
          {value === 0 ? "off" : value}
        </div>
      </div>
    </div>
  );
}
