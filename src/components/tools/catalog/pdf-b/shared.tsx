"use client";

/** Shared React pieces for the pdf-b tools: file loading, history, small inputs, result block. */

import { useCallback, useEffect, useId, useState } from "react";
import { Btn, Notice, inputCls } from "@/components/tools/kit";
import {
  FileChip,
  FileDrop,
  Spinner,
  baseName,
  downloadBlob,
  fileToBytes,
  formatBytes,
} from "@/components/tools/engines/files";
import { openPdf, parsePageRanges } from "@/components/tools/engines/pdf";

export type PdfDoc = Awaited<ReturnType<typeof openPdf>>;

/* ------------------------------------------------------------------ */
/* Loading a PDF                                                       */
/* ------------------------------------------------------------------ */

export interface PdfSource {
  file: File;
  bytes: Uint8Array;
}

/** Opens bytes with pdf.js; destroys the document when bytes change or on unmount. */
export function usePdfDoc(bytes: Uint8Array | null) {
  const [state, setState] = useState<{
    bytes: Uint8Array | null;
    doc: PdfDoc | null;
    error: string | null;
  }>({
    bytes: null,
    doc: null,
    error: null,
  });
  useEffect(() => {
    if (!bytes) return;
    let alive = true;
    let opened: PdfDoc | null = null;
    openPdf(bytes)
      .then((d) => {
        opened = d;
        if (alive) setState({ bytes, doc: d, error: null });
        else void d.loadingTask.destroy().catch(() => undefined);
      })
      .catch((e: unknown) => {
        if (alive)
          setState({
            bytes,
            doc: null,
            error: e instanceof Error ? e.message : "Could not open this PDF.",
          });
      });
    return () => {
      alive = false;
      if (opened) void opened.loadingTask.destroy().catch(() => undefined);
    };
  }, [bytes]);
  const current = bytes && state.bytes === bytes;
  return {
    doc: current ? state.doc : null,
    error: current ? state.error : null,
    loading: !!bytes && !current,
  };
}

/** File picker for a single PDF, then a chip with remove. */
export function PdfPicker({
  source,
  onChange,
  maxSizeMB = 100,
  label = "Choose a PDF or drop it here",
}: {
  source: PdfSource | null;
  onChange: (s: PdfSource | null) => void;
  maxSizeMB?: number;
  label?: string;
}) {
  const [readError, setReadError] = useState<string | null>(null);
  const onFiles = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      try {
        setReadError(null);
        onChange({ file: f, bytes: await fileToBytes(f) });
      } catch {
        setReadError("That file could not be read.");
      }
    },
    [onChange],
  );
  if (source)
    return <FileChip file={source.file} onRemove={() => onChange(null)} />;
  return (
    <div className="space-y-3">
      <FileDrop
        accept="application/pdf,.pdf"
        maxSizeMB={maxSizeMB}
        label={label}
        onFiles={onFiles}
      />
      {readError && <Notice tone="error">{readError}</Notice>}
    </div>
  );
}

/** Loading and error states for an opened PDF. */
export function DocStatus({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <Spinner label="Opening PDF" />;
  if (error) return <Notice tone="error">{error}</Notice>;
  return null;
}

/* ------------------------------------------------------------------ */
/* Undo history                                                        */
/* ------------------------------------------------------------------ */

export function useHistory<T>(initial: T) {
  const [h, setH] = useState<{ past: T[]; present: T; future: T[] }>({
    past: [],
    present: initial,
    future: [],
  });
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setH((cur) => {
      const value =
        typeof next === "function" ? (next as (p: T) => T)(cur.present) : next;
      if (value === cur.present) return cur;
      return {
        past: [...cur.past.slice(-99), cur.present],
        present: value,
        future: [],
      };
    });
  }, []);
  const undo = useCallback(() => {
    setH((cur) =>
      cur.past.length
        ? {
            past: cur.past.slice(0, -1),
            present: cur.past[cur.past.length - 1],
            future: [cur.present, ...cur.future.slice(0, 99)],
          }
        : cur,
    );
  }, []);
  const redo = useCallback(() => {
    setH((cur) =>
      cur.future.length
        ? {
            past: [...cur.past.slice(-99), cur.present],
            present: cur.future[0],
            future: cur.future.slice(1),
          }
        : cur,
    );
  }, []);
  const reset = useCallback(
    (value: T) => setH({ past: [], present: value, future: [] }),
    [],
  );
  return {
    value: h.present,
    set,
    undo,
    redo,
    reset,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

/**
 * Small numeric input that commits on blur or Enter (so typing "12." is not
 * reformatted mid-edit). Remount it with `key={value}` to reflect outside changes.
 */
export function NumInput({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  suffix,
  className = "",
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(Math.round(value * 100) / 100));
  const parsed = Number(draft.trim().replace(",", "."));
  const invalid =
    draft.trim() === "" ||
    !Number.isFinite(parsed) ||
    (min !== undefined && parsed < min) ||
    (max !== undefined && parsed > max);
  const commit = () => {
    if (!invalid && parsed !== value) onCommit(parsed);
  };
  return (
    <div className={className}>
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-ink-2">
        {label}
        {suffix ? (
          <span className="font-normal text-muted"> ({suffix})</span>
        ) : null}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={draft}
        aria-invalid={invalid || undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className={`${inputCls} mt-1 h-10 px-2.5 text-[0.95rem]`}
      />
    </div>
  );
}

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-ink-2">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg bg-surface p-1 shadow-[inset_0_0_0_1px_var(--line-strong)]"
        />
        <span className="font-mono text-[0.8125rem] text-muted">
          {value.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

export function RangeInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = (v: number) => String(v),
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-ink-2">
          {label}
        </label>
        <span className="text-[0.8125rem] tabular-nums text-muted">
          {format(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-10 w-full cursor-pointer accent-[var(--accent)]"
      />
    </div>
  );
}

/** Validates a page-range string for a known page count. Empty means all pages. */
export function rangeOrError(
  input: string,
  pageCount: number,
): { pages: number[]; error: null } | { pages: null; error: string } {
  const r = parsePageRanges(input, pageCount);
  if (typeof r === "string") return { pages: null, error: r };
  return { pages: Array.from(new Set(r)).sort((a, b) => a - b), error: null };
}

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

export function outName(source: PdfSource, suffix: string) {
  return `${baseName(source.file.name)}-${suffix}.pdf`;
}

export function downloadPdf(bytes: Uint8Array, name: string) {
  downloadBlob(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
    name,
  );
}

/** Success summary with a download button. */
export function ResultBar({
  bytes,
  name,
  message,
  downloadLabel,
}: {
  bytes: Uint8Array;
  name: string;
  message: string;
  downloadLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <Notice tone="success" title="Done">
        {message} New file: {formatBytes(bytes.length)}.
      </Notice>
      <Btn icon="download" onClick={() => downloadPdf(bytes, name)}>
        {downloadLabel ?? `Download ${name.length > 40 ? "PDF" : name}`}
      </Btn>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fonts for on-screen overlays                                        */
/* ------------------------------------------------------------------ */

export const OVERLAY_FONT = "PdfbNoto";
let fontPromise: Promise<void> | null = null;

function loadOverlayFonts() {
  if (!fontPromise) {
    fontPromise = (async () => {
      if (typeof FontFace === "undefined") return;
      const reg = new FontFace(
        OVERLAY_FONT,
        "url(/fonts/NotoSans-Regular.ttf)",
        { weight: "400" },
      );
      const bold = new FontFace(OVERLAY_FONT, "url(/fonts/NotoSans-Bold.ttf)", {
        weight: "700",
      });
      const loaded = await Promise.all([reg.load(), bold.load()]);
      loaded.forEach((f) => document.fonts.add(f));
    })().catch(() => undefined);
  }
  return fontPromise;
}

/** Loads Noto Sans (self-hosted) so on-screen previews match the PDF output. */
export function useOverlayFont() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadOverlayFonts().then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** Measures text width in points using the overlay font (falls back to an estimate). */
export function measureText(
  text: string,
  size: number,
  bold = false,
  family: "sans" | "serif" | "mono" = "sans",
  italic = false,
) {
  if (typeof document === "undefined") return text.length * size * 0.55;
  if (!measureCtx)
    measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * size * 0.55;
  const font =
    family === "serif"
      ? "Georgia, serif"
      : family === "mono"
        ? "ui-monospace, monospace"
        : `${OVERLAY_FONT}, sans-serif`;
  measureCtx.font = `${italic ? "italic " : ""}${bold ? 700 : 400} ${size}px ${font}`;
  return measureCtx.measureText(text).width;
}
