"use client";

import { useCallback, useState } from "react";

/**
 * State that resets automatically when `key` changes (e.g. a new file is
 * loaded), without an effect. `init` must be cheap and pure.
 */
export function useKeyed<T>(key: unknown, init: () => T) {
  const [s, setS] = useState<{ key: unknown; v: T } | null>(null);
  const value = s && s.key === key ? s.v : init();
  const set = useCallback(
    (next: T | ((prev: T) => T)) =>
      setS((prev) => {
        const base = prev && prev.key === key ? prev.v : init();
        return { key, v: typeof next === "function" ? (next as (p: T) => T)(base) : next };
      }),
    // init is expected to depend only on key-related data
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set] as const;
}
