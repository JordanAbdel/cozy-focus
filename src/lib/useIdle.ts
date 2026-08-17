import { useEffect, useRef, useState } from "react";

export function useIdle(timeoutMs: number) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setIdle(true), timeoutMs);
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "pointerdown", "wheel", "touchstart"];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    wake();
    return () => {
      events.forEach((e) => window.removeEventListener(e, wake));
      window.clearTimeout(timer.current);
    };
  }, [timeoutMs]);

  return idle;
}
