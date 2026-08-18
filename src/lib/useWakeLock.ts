import { useEffect } from "react";

// Holds the screen awake while `active`. Browsers release the lock on their own
// whenever the tab is hidden, so it has to be taken back on the way in.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.hidden || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        // request() is async, so under StrictMode this can resolve after its own
        // cleanup already ran. Without this the lock is never released.
        if (cancelled) {
          void sentinel.release();
          sentinel = null;
        }
      } catch {
        // Refused by the OS (low battery, policy). The session still runs and
        // there is nothing useful to tell the user here.
      }
    };

    void acquire();
    const onVisible = () => {
      if (!document.hidden) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, [active]);
}
