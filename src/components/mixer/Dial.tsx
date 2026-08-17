import { useEffect, useRef } from "react";
import type { LayerMeta } from "../../lib/scenes";

interface Props {
  meta: LayerMeta;
  tint: string;
  value: number;
  onChange: (value: number) => void;
  size?: number;
}

export function Dial({ meta, tint, value, onChange, size = 82 }: Props) {
  const dragging = useRef(false);
  const lastY = useRef(0);
  const current = useRef(value);

  useEffect(() => {
    if (!dragging.current) current.current = value;
  }, [value]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    lastY.current = e.clientY;
    current.current = value;
    const move = (ev: PointerEvent) => {
      const delta = (lastY.current - ev.clientY) * 0.7;
      lastY.current = ev.clientY;
      current.current = Math.max(0, Math.min(100, Math.round(current.current + delta)));
      onChange(current.current);
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
    <div className="flex flex-col items-center gap-2.5">
      <div
        onPointerDown={handlePointerDown}
        className="relative rounded-full cursor-ns-resize grid place-items-center select-none touch-none"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(from 220deg, ${tint} ${value * 2.8}deg, rgba(237,224,206,.09) 0)`,
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            inset: 6,
            background: "radial-gradient(circle at 34% 26%, #4A3120, #231710)",
            boxShadow: "0 8px 18px -8px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.10)",
          }}
        />
        <div className="relative font-serif-cf leading-none" style={{ fontSize: 18, color: "rgba(237,224,206,.85)" }}>
          {meta.glyph}
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] tracking-[.1em] uppercase" style={{ color: "rgba(237,224,206,.5)" }}>
          {meta.label}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: "rgba(237,224,206,.28)" }}>
          {value === 0 ? "off" : value}
        </div>
      </div>
    </div>
  );
}
