"use client";

/**
 * Shared plumbing for the pdf-a tools: loading a PDF once (pdf.js for previews,
 * pdf-lib for editing), friendly errors for encrypted files, saving and
 * result/download UI.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocument } from "pdf-lib";
import { Btn, Notice } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, baseName, downloadBlob, fileToBytes, formatBytes } from "@/components/tools/engines/files";
import { getPdfLib, openPdf } from "@/components/tools/engines/pdf";

export type PdfJsDoc = Awaited<ReturnType<typeof openPdf>>;

/** Releases a pdf.js document and its worker resources. */
export function destroyDoc(doc: PdfJsDoc) {
  doc.loadingTask.destroy().catch(() => undefined);
}

export const PDF_ACCEPT ="application/pdf,.pdf";
export const PDF_MAX_MB = 200;

export const ENCRYPTED_MSG =
  "This PDF is encrypted (it has a password or permission restrictions), so its pages can't be rebuilt here. Open it in a reader that knows the password, save an unprotected copy, then try again.";

/** Turns low-level errors into a sentence a person can act on. */
export function friendlyError(e: unknown, fallback = "Something went wrong while processing this PDF."): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "EncryptedPDFError" || /is encrypted/i.test(msg)) return ENCRYPTED_MSG;
  if (/Failed to parse PDF|No PDF header|Invalid PDF|invalid object/i.test(msg)) return "This file could not be read as a PDF. It may be damaged or not a PDF at all.";
  if (/out of memory|allocation failed|Array buffer allocation/i.test(msg)) return "Your browser ran out of memory. Try a smaller file or fewer pages at once.";
  return msg || fallback;
}

/** Loads a PDF with pdf-lib, refusing encrypted files with a clear message. */
export async function loadPdfLib(bytes: Uint8Array): Promise<PDFDocument> {
  const { PDFDocument } = await getPdfLib();
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (e) {
    throw new Error(friendlyError(e, "This PDF could not be opened for editing."));
  }
}

export async function savePdf(doc: PDFDocument): Promise<Blob> {
  const bytes = await doc.save({ useObjectStreams: true });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** Builds a new PDF from 0-based page indices of `src` (indices may repeat). */
export async function pdfFromPages(src: PDFDocument, indices: number[], rotateBy?: (i: number, pos: number) => number) {
  const { PDFDocument, degrees } = await getPdfLib();
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  copied.forEach((p, pos) => {
    if (rotateBy) {
      const delta = rotateBy(indices[pos], pos);
      if (delta) p.setRotation(degrees((((p.getRotation().angle + delta) % 360) + 360) % 360));
    }
    out.addPage(p);
  });
  return out;
}

/**
 * Embeds a source page (its crop box) as a Form XObject in `out`. Returns null for
 * pages without content (pdf-lib cannot embed those; they are blank anyway).
 */
export async function embedPageSafe(out: PDFDocument, page: import("pdf-lib").PDFPage) {
  const b = page.getCropBox();
  try {
    return await out.embedPage(page, { left: b.x, bottom: b.y, right: b.x + b.width, top: b.y + b.height });
  } catch (e) {
    if (/content/i.test(e instanceof Error ? e.message : "")) return null;
    throw e;
  }
}

export const outName =(file: File | string, suffix: string, ext = "pdf") =>
  `${baseName(typeof file === "string" ? file : file.name)}${suffix ? `-${suffix}` : ""}.${ext}`;

/* ------------------------------------------------------------------ */
/* Loading hook                                                        */
/* ------------------------------------------------------------------ */

export type LoadedPdf = {
  file: File;
  bytes: Uint8Array;
  js: PdfJsDoc;
  /** pdf-lib document (only when `edit` was requested). Treat as read-only. */
  lib: PDFDocument | null;
  pageCount: number;
  /** Changes for every load so children can key on it. */
  key: string;
};

export type PdfSourceState =
  | { status: "idle" }
  | { status: "loading"; name: string }
  | { status: "error"; message: string }
  | ({ status: "ready" } & LoadedPdf);

/** Loads one PDF for preview (pdf.js) and optionally editing (pdf-lib). Cleans up on replace/unmount. */
export function usePdfSource({ edit = true }: { edit?: boolean } = {}) {
  const [state, setState] = useState<PdfSourceState>({ status: "idle" });
  const token = useRef(0);
  const current = useRef<PdfJsDoc | null>(null);

  useEffect(
    () => () => {
      token.current++;
      if (current.current) destroyDoc(current.current);
      current.current = null;
    },
    [],
  );

  const clear = useCallback(() => {
    token.current++;
    if (current.current) destroyDoc(current.current);
    current.current = null;
    setState({ status: "idle" });
  }, []);

  const load = useCallback(
    async (file: File) => {
      const my = ++token.current;
      setState({ status: "loading", name: file.name });
      try {
        const bytes = await fileToBytes(file);
        const js = await openPdf(bytes);
        let lib: PDFDocument | null = null;
        if (edit) {
          try {
            lib = await loadPdfLib(bytes);
          } catch (e) {
            destroyDoc(js);
            throw e;
          }
        }
        if (my !== token.current) {
          destroyDoc(js);
          return;
        }
        if (current.current) destroyDoc(current.current);
        current.current = js;
        setState({ status: "ready", file, bytes, js, lib, pageCount: js.numPages, key: `${my}-${file.name}-${file.size}` });
      } catch (e) {
        if (my !== token.current) return;
        setState({ status: "error", message: friendlyError(e, "This PDF could not be opened.") });
      }
    },
    [edit],
  );

  return { state, load, clear };
}

/** Drop zone, loading and error states for a single PDF source. */
export function PdfSourcePicker({
  state,
  load,
  clear,
  label = "Choose a PDF or drop it here",
}: {
  state: PdfSourceState;
  load: (f: File) => void;
  clear: () => void;
  label?: string;
}) {
  if (state.status === "ready") {
    return (
      <FileChip
        file={state.file}
        onRemove={clear}
        extra={<span className="shrink-0 tabular-nums text-muted">{state.pageCount === 1 ? "1 page" : `${state.pageCount} pages`}</span>}
      />
    );
  }
  return (
    <div className="space-y-3">
      <FileDrop accept={PDF_ACCEPT} maxSizeMB={PDF_MAX_MB} label={label} onFiles={(f) => f[0] && load(f[0])} />
      {state.status === "loading" && <Spinner label={`Reading ${state.name}`} />}
      {state.status === "error" && <Notice tone="error">{state.message}</Notice>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export type Output = { blob: Blob; name: string; detail?: string };

/** Success block with a download button. */
export function DownloadResult({ output, label = "Download PDF" }: { output: Output; label?: string }) {
  return (
    <Notice tone="success" title="Ready">
      <p>
        {output.name} · {formatBytes(output.blob.size)}
        {output.detail ? ` · ${output.detail}` : ""}
      </p>
      <div className="mt-3">
        <Btn icon="download" onClick={() => downloadBlob(output.blob, output.name)}>
          {label}
        </Btn>
      </div>
    </Notice>
  );
}

/** Tracks one async job with cancellation on unmount. */
export function useJob() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const runId = useRef(0);
  useEffect(
    () => () => {
      runId.current++;
    },
    [],
  );

  const run = useCallback(async (fn: (ctx: { alive: () => boolean; progress: (v: number) => void }) => Promise<void>) => {
    const id = ++runId.current;
    const alive = () => id === runId.current;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      await fn({ alive, progress: (v) => alive() && setProgress(v) });
    } catch (e) {
      if (alive()) setError(friendlyError(e));
    } finally {
      if (alive()) {
        setBusy(false);
        setProgress(null);
      }
    }
  }, []);

  const cancel = useCallback(() => {
    runId.current++;
    setBusy(false);
    setProgress(null);
  }, []);

  return { busy, error, progress, run, cancel, setError };
}

/** Lets the browser paint between heavy steps. */
export const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));
