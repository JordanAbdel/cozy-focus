import { useEffect, useState } from "react";

export function useLocalStorage<T>(
  key: string,
  initial: T,
  opts?: {
    // Return null to reject a stored value and fall back to `initial`.
    revive?: (raw: unknown) => T | null;
    onWriteError?: (err: unknown) => void;
  },
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      if (!opts?.revive) return parsed as T;
      return opts.revive(parsed) ?? initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      opts?.onWriteError?.(err);
    }
    // `opts` is intentionally excluded — callers pass an inline object literal,
    // so including it would re-run the write on every render.
  }, [key, value]);

  return [value, setValue] as const;
}
