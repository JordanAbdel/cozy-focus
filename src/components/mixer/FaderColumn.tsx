import { useRef } from "react";
import type { LayerMeta } from "../../lib/scenes";

interface Props {
  meta: LayerMeta;
  tint: string;
  value: number;
  onChange: (value: number) => void;
  height?: number;
  width?: number;
  compact?: boolean;
}

export function FaderColumn({ meta, tint, value, onChange, height = 186, width = 34, compact = false }: Props) {
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
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(Math.min(100, value + step));
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(Math.max(0, value - step));
    else if (e.key === "Home") onChange(0);
    else if (e.key === "End") onChange(100);
    else return;
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
        onKeyDown={handleKeyDown}
        role="slider"
        tabIndex={0}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={meta.label}
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
        {/* The short name keeps neighbouring columns from colliding when narrow;
            aria-label on the slider still carries the full one. */}
        <div className="text-[10px] tracking-[.1em] uppercase" style={{ color: "rgba(237,224,206,.5)" }}>
          {compact ? meta.short : meta.label}
        </div>
        <div className="text-[10px] mt-[3px]" style={{ color: "rgba(237,224,206,.28)" }}>
          {value === 0 ? "off" : value}
        </div>
      </div>
    </div>
  );
}
