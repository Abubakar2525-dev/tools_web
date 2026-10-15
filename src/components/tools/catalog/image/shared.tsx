"use client";

/**
 * React pieces shared by the image tools: sliders, color fields, format
 * picker, decoded-image hook and the batch queue with per-file status + ZIP.
 */

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { Btn, SelectField, inputCls, uid } from "@/components/tools/kit";
import { downloadBlob, formatBytes, useObjectUrl, zipFiles } from "@/components/tools/engines/files";
import { CancelledError } from "./lib/filters";
import { FORMAT_INFO, SERVER_ENCODABLE, decodeImage, encodableFormats, type Encodable, type OutputFormat } from "./lib/pipeline";
import { parseHex } from "./lib/encoders";
import { parseBase64Input } from "./lib/bytes";

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const isCancel = (e: unknown) => e instanceof CancelledError || (e as { name?: string })?.name === "AbortError";

/** Checkerboard backdrop so transparent pixels are visible. */
export const CHECKER: React.CSSProperties = {
  backgroundColor: "#fff",
  backgroundImage:
    "linear-gradient(45deg,#e5e5e5 25%,transparent 25%),linear-gradient(-45deg,#e5e5e5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e5e5 75%),linear-gradient(-45deg,transparent 75%,#e5e5e5 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
  hint,
  format,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const id = useId();
  const shown = format ? format(value) : `${value}${unit}`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <output htmlFor={id} className="text-sm tabular-nums text-ink-2">
          {shown}
        </output>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[0.8125rem] text-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={shown}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-10 w-full cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

/** Color swatch + hex text input. Calls onChange only with valid #rrggbb values. */
export function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (hex: string) => void; hint?: string }) {
  const id = useId();
  const [draft, setDraft] = useState<{ base: string; text: string } | null>(null);
  const text = draft && draft.base === value ? draft.text : value;
  const invalid = draft !== null && draft.base === value && !parseHex(draft.text);
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {hint && <p className="mt-1 text-[0.8125rem] text-muted">{hint}</p>}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value}
          onChange={(e) => {
            setDraft(null);
            onChange(e.target.value);
          }}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
        />
        <input
          id={id}
          className={`${inputCls} h-11 font-mono`}
          value={text}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const t = e.target.value;
            const rgb = parseHex(t);
            if (rgb) {
              const hex = `#${[rgb.r, rgb.g, rgb.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
              setDraft({ base: hex, text: t });
              onChange(hex);
            } else setDraft({ base: value, text: t });
          }}
        />
      </div>
      {invalid && (
        <p className="mt-1 text-sm text-danger" role="alert">
          Use a hex color such as #1a2b3c.
        </p>
      )}
    </div>
  );
}

const noopSubscribe = () => () => {};

/** Formats this browser can encode (stable after hydration). */
export function useEncodable(): Encodable {
  return useSyncExternalStore(noopSubscribe, encodableFormats, () => SERVER_ENCODABLE);
}

export function FormatSelect({
  value,
  onChange,
  formats,
  label = "Output format",
  extra,
}: {
  value: string;
  onChange: (v: string) => void;
  formats: OutputFormat[];
  label?: string;
  extra?: { value: string; label: string }[];
}) {
  const enc = useEncodable();
  const ok = formats.filter((f) => enc[f]);
  const missing = formats.filter((f) => !enc[f]);
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[...(extra ?? []), ...ok.map((f) => ({ value: f, label: FORMAT_INFO[f].label }))]}
      hint={missing.length ? `${missing.map((f) => FORMAT_INFO[f].label).join(" and ")} encoding is not available in this browser.` : undefined}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Decoded image                                                       */
/* ------------------------------------------------------------------ */

/** Decodes a file to an ImageBitmap; closes it when the file changes or on unmount. */
export function useDecodedImage(file: Blob | null) {
  const [state, setState] = useState<{ file: Blob; bitmap: ImageBitmap | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!file) return;
    let alive = true;
    let bmp: ImageBitmap | null = null;
    decodeImage(file)
      .then((b) => {
        if (!alive) return b.close();
        bmp = b;
        setState({ file, bitmap: b, error: null });
      })
      .catch((e) => {
        if (alive) setState({ file, bitmap: null, error: errMsg(e) });
      });
    return () => {
      alive = false;
      bmp?.close();
    };
  }, [file]);
  const cur = state && file && state.file === file ? state : null;
  return { bitmap: cur?.bitmap ?? null, error: cur?.error ?? null, loading: !!file && !cur };
}

/* ------------------------------------------------------------------ */
/* Batch queue                                                         */
/* ------------------------------------------------------------------ */

export type BatchOut = { blob: Blob; name: string; note?: string; keptOriginal?: boolean };
export type BatchItem = { id: string; file: File; status: "queued" | "working" | "done" | "error"; error?: string; out?: BatchOut };
export type Processor = (file: File, signal: AbortSignal) => Promise<BatchOut>;

export function useBatch() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const patch = useCallback((id: string, p: Partial<BatchItem>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i))), []);

  const add = useCallback((files: File[]) => setItems((prev) => [...prev, ...files.map((file) => ({ id: uid(), file, status: "queued" as const }))]), []);
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => {
    ctrl.current?.abort();
    setRunning(false);
    setItems([]);
  }, []);
  const cancel = useCallback(() => {
    ctrl.current?.abort();
    setRunning(false);
    setItems((prev) => prev.map((i) => (i.status === "working" ? { ...i, status: "queued" } : i)));
  }, []);

  /** Processes every item in order (re-running finished ones with the current settings). */
  const run = useCallback(
    async (list: BatchItem[], process: Processor) => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setRunning(true);
      setItems((prev) => prev.map((i) => ({ ...i, status: "queued", error: undefined, out: undefined })));
      for (const it of list) {
        if (c.signal.aborted) break;
        patch(it.id, { status: "working" });
        try {
          const out = await process(it.file, c.signal);
          if (c.signal.aborted) break;
          patch(it.id, { status: "done", out });
        } catch (e) {
          if (c.signal.aborted || isCancel(e)) break;
          patch(it.id, { status: "error", error: errMsg(e) });
        }
      }
      if (ctrl.current === c) {
        setRunning(false);
        ctrl.current = null;
      }
    },
    [patch],
  );

  return { items, running, add, remove, clear, cancel, run };
}

const STATUS: Record<BatchItem["status"], { text: string; icon: "info" | "check" | "alert" | "timer"; cls: string }> = {
  queued: { text: "Waiting", icon: "timer", cls: "text-muted" },
  working: { text: "Working", icon: "timer", cls: "text-ink-2" },
  done: { text: "Done", icon: "check", cls: "text-accent-strong" },
  error: { text: "Failed", icon: "alert", cls: "text-danger" },
};

function BatchPreview({ item }: { item: BatchItem }) {
  const originalUrl = useObjectUrl(item.file);
  const resultUrl = useObjectUrl(item.out?.blob);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-xs">
      <figure className="min-w-0">
        <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-surface" style={CHECKER}>
          {/* The browser may not natively preview HEIC even though our decoder can process it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={originalUrl ?? undefined} alt={`Original ${item.file.name}`} className="max-h-full max-w-full object-contain" />
        </div>
        <figcaption className="mt-1 text-[0.75rem] text-muted">Original</figcaption>
      </figure>
      <figure className="min-w-0">
        <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-surface" style={CHECKER}>
          {resultUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resultUrl} alt={`Processed ${item.file.name}`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-[0.75rem] text-muted">
              {item.status === "working" ? "Processing…" : "Result preview"}
            </span>
          )}
        </div>
        <figcaption className="mt-1 text-[0.75rem] text-muted">Result</figcaption>
      </figure>
    </div>
  );
}

export function BatchList({
  items,
  running,
  onRemove,
  zipName,
  details,
}: {
  items: BatchItem[];
  running: boolean;
  onRemove: (id: string) => void;
  zipName: string;
  details?: (item: BatchItem) => React.ReactNode;
}) {
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const done = items.filter((i) => i.status === "done" && i.out);
  const failed = items.filter((i) => i.status === "error").length;
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2" aria-live="polite">
          {items.length} file{items.length === 1 ? "" : "s"}
          {done.length ? `, ${done.length} done` : ""}
          {failed ? `, ${failed} failed` : ""}
          {running ? ", processing" : ""}
        </p>
        {done.length > 1 && (
          <Btn
            icon="download"
            disabled={zipping || running}
            onClick={async () => {
              setZipping(true);
              setZipError(null);
              try {
                const blob = await zipFiles(done.map((i) => ({ name: (i.out as BatchOut).name, data: (i.out as BatchOut).blob })), 0);
                downloadBlob(blob, zipName);
              } catch (e) {
                setZipError(errMsg(e));
              } finally {
                setZipping(false);
              }
            }}
          >
            {zipping ? "Building ZIP…" : `Download all (${done.length}) as ZIP`}
          </Btn>
        )}
      </div>
      {zipError && <p className="text-sm text-danger" role="alert">{zipError}</p>}
      <ul className="space-y-2">
        {items.map((it) => {
          const s = STATUS[it.status];
          return (
            <li key={it.id} className="rounded-lg bg-sunken px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Icon name="image" size={18} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-ink" title={it.file.name}>
                  {it.file.name}
                </span>
                <span className="shrink-0 tabular-nums text-muted">{formatBytes(it.file.size)}</span>
                <span className={`inline-flex shrink-0 items-center gap-1 ${s.cls}`}>
                  <Icon name={s.icon} size={14} />
                  {s.text}
                </span>
                {it.out && (
                  <Btn variant="ghost" icon="download" onClick={() => downloadBlob((it.out as BatchOut).blob, (it.out as BatchOut).name)} aria-label={`Download ${it.out.name}`}>
                    {formatBytes(it.out.blob.size)}
                  </Btn>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(it.id)}
                  disabled={running}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:opacity-40"
                >
                  <Icon name="close" size={16} />
                  <span className="sr-only">Remove {it.file.name}</span>
                </button>
              </div>
              {it.error && <p className="mt-1.5 text-danger">{it.error}</p>}
              {it.out && details && <div className="mt-1.5 text-ink-2">{details(it)}</div>}
              {it.out?.note && !details && <p className="mt-1.5 text-ink-2">{it.out.note}</p>}
              <BatchPreview item={it} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** "−42%" style savings label (negative means smaller). */
export function savings(before: number, after: number) {
  if (!before) return "";
  const pct = Math.round(((after - before) / before) * 100);
  return pct === 0 ? "same size" : pct < 0 ? `${-pct}% smaller` : `${pct}% larger`;
}

/** Converts a base64 data URL (e.g. from qrcode.toDataURL) to a Blob without fetch(). */
export function dataUrlToBlob(url: string) {
  const r = parseBase64Input(url);
  if (!r.ok) throw new Error(r.error);
  return new Blob([r.bytes as BlobPart], { type: r.declaredMime ?? "application/octet-stream" });
}
