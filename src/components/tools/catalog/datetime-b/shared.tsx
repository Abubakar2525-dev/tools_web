"use client";

/**
 * Shared React helpers for the datetime-b planners: a ticking clock, a
 * print-only container, and the backup bar (print, export/import JSON,
 * confirmed clear all).
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Btn, Notice, downloadFile } from "@/components/tools/kit";
import { dayKey } from "./lib/dates";
import { readBackup, wrapBackup, type Result } from "./lib/schema";

/* ------------------------------------------------------------------ */
/* Client detection + clock                                            */
/* ------------------------------------------------------------------ */

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true afterwards. */
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

type Clock = { subscribe: (cb: () => void) => () => void; get: () => number };
const clocks = new Map<number, Clock>();

function clock(ms: number): Clock {
  let c = clocks.get(ms);
  if (c) return c;
  let value = Date.now();
  const subs = new Set<() => void>();
  let timer: number | undefined;
  c = {
    subscribe(cb) {
      subs.add(cb);
      if (subs.size === 1) {
        value = Date.now();
        timer = window.setInterval(() => {
          value = Date.now();
          subs.forEach((s) => s());
        }, ms);
      }
      return () => {
        subs.delete(cb);
        if (!subs.size) window.clearInterval(timer);
      };
    },
    get: () => value,
  };
  clocks.set(ms, c);
  return c;
}

/** Current epoch ms, refreshed every `ms`. Null on the server and during hydration. */
export function useNow(ms = 1000): number | null {
  const c = clock(ms);
  return useSyncExternalStore<number | null>(c.subscribe, c.get, () => null);
}

/** Today's local day key (refreshes each 30 s so it rolls over at midnight). Null before hydration. */
export function useToday(): string | null {
  const now = useNow(30_000);
  return now === null ? null : dayKey(new Date(now));
}

/* ------------------------------------------------------------------ */
/* Print                                                               */
/* ------------------------------------------------------------------ */

const PRINT_CSS = `
@media screen { .dtb-print-root { display: none !important; } }
@media print {
  body > *:not(.dtb-print-root) { display: none !important; }
  html, body { background: #fff !important; }
  .dtb-print-root { display: block; color: #000; font: 10.5pt/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .dtb-print-root h2 { font-size: 12.5pt; font-weight: 700; margin: 14pt 0 6pt; }
  .dtb-print-root h2:first-of-type { font-size: 17pt; font-weight: 700; margin: 0 0 4pt; }
  .dtb-print-root .meta { color: #444; margin: 0 0 10pt; }
  .dtb-print-root table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
  .dtb-print-root tr { page-break-inside: avoid; }
  .dtb-print-root th, .dtb-print-root td { border: 0.75pt solid #888; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  .dtb-print-root th { background: #eee; }
  .dtb-print-root ul { margin: 0; padding-left: 14pt; }
  .dtb-print-root .page { break-after: page; }
  .dtb-print-root .page:last-child { break-after: auto; }
  .dtb-print-root .muted { color: #555; }
  .dtb-print-root .box { display: inline-block; width: 9pt; height: 9pt; border: 0.75pt solid #000; margin-right: 4pt; vertical-align: -1pt; text-align: center; line-height: 8pt; font-size: 8pt; }
  @page { margin: 12mm; }
}`;

/**
 * Content rendered only when printing. It is portaled to <body> so the
 * print stylesheet can hide everything else (header, footer, page copy).
 */
export function PrintArea({ children }: { children: React.ReactNode }) {
  const client = useIsClient();
  if (!client) return null;
  return createPortal(
    <div className="dtb-print-root">
      <style>{PRINT_CSS}</style>
      {children}
    </div>,
    document.body,
  );
}

/** A printed checkbox glyph. */
export function PrintBox({ checked }: { checked: boolean }) {
  return <span className="box">{checked ? "✓" : ""}</span>;
}

/* ------------------------------------------------------------------ */
/* Confirm + backup bar                                                */
/* ------------------------------------------------------------------ */

/** Two-step destructive button: first click asks, second click confirms. */
export function ConfirmButton({
  label,
  confirmLabel = "Yes, clear everything",
  onConfirm,
  disabled,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) confirmRef.current?.focus();
  }, [asking]);
  if (!asking)
    return (
      <Btn variant="danger" icon="trash" onClick={() => setAsking(true)} disabled={disabled}>
        {label}
      </Btn>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label="Confirm">
      <span className="text-sm text-ink-2">This can&apos;t be undone.</span>
      <button
        ref={confirmRef}
        type="button"
        className="btn btn-sm btn-ghost !text-danger"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <Btn variant="subtle" onClick={() => setAsking(false)}>
        Cancel
      </Btn>
    </span>
  );
}

export function BackupBar<T>({
  tool,
  data,
  normalize,
  onImport,
  onClear,
  hasData,
  onPrint = () => window.print(),
  printLabel = "Print",
  extra,
}: {
  tool: string;
  data: T;
  normalize: (u: unknown) => Result<T>;
  onImport: (value: T) => void;
  onClear: () => void;
  hasData: boolean;
  onPrint?: (() => void) | null;
  printLabel?: string;
  extra?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const exportJson = () => {
    const now = new Date();
    downloadFile(`${tool}-${dayKey(now)}.json`, JSON.stringify(wrapBackup(tool, data, now.toISOString()), null, 2), "application/json");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ tone: "error", text: "That file is larger than 5 MB, which is too big for a planner backup." });
      return;
    }
    const res = readBackup(await file.text(), tool, normalize);
    if (!res.ok) {
      setMsg({ tone: "error", text: res.error });
      return;
    }
    if (hasData && !window.confirm("Replace everything currently saved in this tool with the backup?")) return;
    onImport(res.value);
    setMsg({ tone: "success", text: `Imported ${file.name}.` });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {onPrint && (
          <Btn variant="ghost" icon="file" onClick={onPrint} disabled={!hasData}>
            {printLabel}
          </Btn>
        )}
        <Btn variant="ghost" icon="download" onClick={exportJson} disabled={!hasData}>
          Export JSON
        </Btn>
        <Btn variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>
          Import JSON
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {extra}
        <ConfirmButton label="Clear all" onConfirm={onClear} disabled={!hasData} />
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

/** Long local date like "Mon, Oct 12, 2026" for a day key. */
export function fmtDay(k: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", opts);
}

/** Section label used inside panels. */
export function SubHead({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3 id={id} className="font-sans text-[0.95rem] font-semibold text-ink">
      {children}
    </h3>
  );
}
