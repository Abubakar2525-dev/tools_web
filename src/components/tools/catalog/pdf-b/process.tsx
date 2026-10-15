"use client";

/**
 * Shell for whole-document tools (watermark, page numbers, header/footer,
 * margins, resize, crop): choose a PDF, adjust settings, apply, preview the
 * result page by page, download.
 */

import { useCallback, useState } from "react";
import { Btn, Notice, PrivacyNote, Segmented, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { PageCanvas, type CanvasMode, type CreateGeom } from "./PageCanvas";
import type { PageGeom } from "./lib/geometry";
import { DocStatus, PdfPicker, ResultBar, outName, usePdfDoc, type PdfSource } from "./shared";

export interface ProcessCtx {
  numPages: number;
  page: number;
}

export function ProcessTool({
  suffix,
  settings,
  settingsKey,
  validate,
  process,
  actionLabel,
  doneMessage,
  sourceOverlay,
  sourceMode = "none",
  onSourceCreate,
  sourceHint,
}: {
  suffix: string;
  settings: (ctx: ProcessCtx) => React.ReactNode;
  /** Any change to this string marks an existing result as outdated. */
  settingsKey: string;
  validate?: (ctx: ProcessCtx) => string | null;
  process: (source: PdfSource, ctx: ProcessCtx) => Promise<Uint8Array>;
  actionLabel: string;
  doneMessage: string;
  sourceOverlay?: (scale: number, geom: PageGeom, page: number) => React.ReactNode;
  sourceMode?: CanvasMode;
  onSourceCreate?: (g: CreateGeom, geom: PageGeom) => void;
  sourceHint?: string;
}) {
  const [source, setSource] = useState<PdfSource | null>(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"original" | "result">("original");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; key: string; source: PdfSource } | null>(null);
  const { doc, error: docError, loading } = usePdfDoc(source?.bytes ?? null);
  const fresh = result && result.key === settingsKey && result.source === source ? result : null;
  const out = usePdfDoc(fresh?.bytes ?? null);

  const changeSource = useCallback((s: PdfSource | null) => {
    setSource(s);
    setPage(1);
    setView("original");
    setResult(null);
    setError(null);
  }, []);

  const ctx: ProcessCtx = { numPages: doc?.numPages ?? 0, page };
  const problem = doc ? validate?.(ctx) ?? null : null;
  const showing = view === "result" && fresh && out.doc ? "result" : "original";

  async function run() {
    if (!source || !doc) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await process(source, ctx);
      setResult({ bytes, key: settingsKey, source });
      setView("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while creating the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolPanel title={source ? undefined : "Choose a PDF"}>
      <div className="space-y-5">
        <PdfPicker source={source} onChange={changeSource} />
        <DocStatus loading={loading} error={docError} />
        {doc && source && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-3">
              {fresh && (
                <Segmented
                  label="Preview"
                  value={showing}
                  onChange={setView}
                  options={[
                    { value: "original", label: "Original" },
                    { value: "result", label: "Result" },
                  ]}
                />
              )}
              {showing === "result" && out.doc ? (
                <PageCanvas doc={out.doc} page={Math.min(page, out.doc.numPages)} onPageChange={setPage} label="Result preview" />
              ) : (
                <>
                  {sourceHint && <p className="text-sm text-ink-2">{sourceHint}</p>}
                  <PageCanvas
                    doc={doc}
                    page={page}
                    onPageChange={setPage}
                    label="Original page"
                    mode={sourceMode}
                    onCreate={onSourceCreate}
                    overlay={sourceOverlay ? (scale, geom) => sourceOverlay(scale, geom, page) : undefined}
                  />
                </>
              )}
              {fresh && out.loading && <Spinner label="Loading result preview" />}
            </div>
            <div className="space-y-5">
              {settings(ctx)}
              {problem && <Notice tone="warning">{problem}</Notice>}
              <Btn icon="check" onClick={run} disabled={busy || !!problem} className="w-full justify-center">
                {busy ? "Working…" : actionLabel}
              </Btn>
              {busy && <Spinner label="Writing PDF" />}
              {error && <Notice tone="error">{error}</Notice>}
              {fresh && <ResultBar bytes={fresh.bytes} name={outName(source, suffix)} message={doneMessage} />}
              {result && !fresh && <p className="text-sm text-muted">Settings changed since the last run. Apply again to update the file.</p>}
            </div>
          </div>
        )}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}
