import { useCallback, useEffect, useState } from "react";

// `supported` is false on iPhone — Safari there allows fullscreen for video only —
// so callers can hide the control rather than offer a button that does nothing.
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement !== null);

  useEffect(() => {
    // Escape leaves fullscreen without going through the button, so track the
    // event rather than assuming toggle() succeeded.
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        // Refused by the browser; the app is unaffected.
      });
    }
  }, []);

  return { supported: document.fullscreenEnabled, isFullscreen, toggle };
}
