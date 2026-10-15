"use client";

/** Small UI pieces shared by the security and file tools in this batch. */

import { useCallback, useEffect, useRef } from "react";

const LEVEL_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;

/** Five-segment strength meter. The label carries the meaning, color only reinforces it. */
export function StrengthMeter({ level, label, detail }: { level: 0 | 1 | 2 | 3 | 4; label?: string; detail?: React.ReactNode }) {
  const text = label ?? LEVEL_LABELS[level];
  const color = level <= 1 ? "bg-danger" : level === 2 ? "bg-[oklch(0.75_0.15_75)]" : "bg-accent";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-ink">{text}</span>
        {detail && <span className="tabular-nums text-ink-2">{detail}</span>}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" role="meter" aria-label="Strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={level} aria-valuetext={text}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-2 rounded-full ${i <= level ? color : "bg-sunken"}`} />
        ))}
      </div>
    </div>
  );
}

/** Returns a function that starts a new AbortController, cancelling the previous one. Aborts on unmount. */
export function useAbortable() {
  const ref = useRef<AbortController | null>(null);
  useEffect(() => () => ref.current?.abort(), []);
  const start = useCallback(() => {
    ref.current?.abort();
    const c = new AbortController();
    ref.current = c;
    return c;
  }, []);
  const cancel = useCallback(() => ref.current?.abort(), []);
  return { start, cancel };
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

export const errorText = (e: unknown, fallback = "Something went wrong.") =>
  e instanceof Error && e.message ? e.message : fallback;

/** Lets the browser paint between heavy chunks. */
export const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

/** Monospace list of values with copy buttons rendered by the caller. */
export function MonoValue({ children }: { children: React.ReactNode }) {
  return <code className="block min-w-0 break-all rounded-lg bg-sunken px-3 py-2.5 font-mono text-[0.9rem] text-ink">{children}</code>;
}

/** Scrollable table wrapper so wide tables never overflow the page. */
export function TableWrap({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="max-h-[480px] overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export const thCls = "sticky top-0 bg-sunken px-3 py-2 text-[0.8125rem] font-medium text-ink-2";
export const tdCls = "border-t border-line px-3 py-2 align-top";
