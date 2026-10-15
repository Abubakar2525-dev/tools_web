"use client";

/**
 * Single-image editor shell used by photo adjustments, effects and noise
 * reduction: loads one image, shows a live preview (downscaled, or a 1:1 crop),
 * then processes the full-resolution image in chunks with progress and cancel.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, EmptyState, Notice, PrivacyNote, ResetBtn, SelectField, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, ProgressBar, Spinner, baseName, downloadBlob } from "@/components/tools/engines/files";
import { CHECKER, FormatSelect, RangeField, errMsg, isCancel, useDecodedImage } from "./shared";
import type { Img } from "./lib/filters";
import { FORMAT_INFO, IMAGE_ACCEPT, bitmapToCanvas, canvasToImg, encodeCanvas, formatFromMime, imgToCanvas, makeCanvas, type OutputFormat } from "./lib/pipeline";

export type RunOpts = { signal: AbortSignal; onProgress: (p: number) => void };

const REGIONS = [
  { value: "c", label: "Center" },
  { value: "tl", label: "Top left" },
  { value: "tr", label: "Top right" },
  { value: "bl", label: "Bottom left" },
  { value: "br", label: "Bottom right" },
];

export function Workbench<S>({
  title,
  settings,
  controls,
  preview,
  full,
  suffix,
  previewMode = "fit",
  onReset,
}: {
  title: string;
  settings: S;
  controls: React.ReactNode;
  /** Applies the effect to a preview buffer. `scale` = preview px / full px (scale radii by it). */
  preview: (img: Img, scale: number, s: S) => Img;
  /** Applies the effect to the full-size image. */
  full: (img: Img, s: S, run: RunOpts) => Promise<Img>;
  suffix: string;
  previewMode?: "fit" | "crop";
  onReset: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const { bitmap, error, loading } = useDecodedImage(file);
  const [showOriginal, setShowOriginal] = useState(false);
  const [region, setRegion] = useState("c");
  const [format, setFormat] = useState("auto");
  const [quality, setQuality] = useState(92);
  const [progress, setProgress] = useState<number | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  const base = useMemo(() => {
    if (!bitmap) return null;
    if (previewMode === "fit") {
      const c = bitmapToCanvas(bitmap, 900);
      return { img: canvasToImg(c), scale: c.width / bitmap.width };
    }
    const size = Math.min(420, bitmap.width, bitmap.height);
    const x = region.includes("l") ? 0 : region.includes("r") ? bitmap.width - size : Math.round((bitmap.width - size) / 2);
    const y = region.includes("t") ? 0 : region.includes("b") ? bitmap.height - size : Math.round((bitmap.height - size) / 2);
    const { canvas, ctx } = makeCanvas(size, size);
    ctx.drawImage(bitmap, x, y, size, size, 0, 0, size, size);
    return { img: canvasToImg(canvas), scale: 1 };
  }, [bitmap, previewMode, region]);

  const viewRef = useRef<HTMLCanvasElement>(null);
  const origRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!base) return;
    const copy: Img = { width: base.img.width, height: base.img.height, data: new Uint8ClampedArray(base.img.data) };
    if (viewRef.current) imgToCanvas(showOriginal ? copy : preview(copy, base.scale, settings), viewRef.current);
    if (origRef.current) imgToCanvas(base.img, origRef.current);
  }, [base, settings, showOriginal, preview]);

  const outFormat: OutputFormat = format === "auto" ? (formatFromMime(file?.type ?? "") === "jpeg" ? "jpeg" : formatFromMime(file?.type ?? "") === "webp" ? "webp" : "png") : (format as OutputFormat);

  const run = async () => {
    if (!bitmap) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setProgress(0);
    setRunError(null);
    try {
      const img = canvasToImg(bitmapToCanvas(bitmap));
      const out = await full(img, settings, { signal: c.signal, onProgress: (p) => setProgress(p) });
      const blob = await encodeCanvas(imgToCanvas(out), outFormat, { quality: quality / 100 });
      if (!c.signal.aborted) downloadBlob(blob, `${file ? baseName(file.name) : "image"}-${suffix}.${FORMAT_INFO[outFormat].ext}`);
    } catch (e) {
      if (!isCancel(e)) setRunError(errMsg(e));
    } finally {
      if (ctrl.current === c) {
        ctrl.current = null;
        setProgress(null);
      }
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title={title} actions={file ? <ResetBtn onClick={() => setFile(null)} label="New image" /> : undefined}>
        {!file ? (
          <div className="space-y-5">
            <FileDrop onFiles={(f) => setFile(f[0] ?? null)} accept={IMAGE_ACCEPT} maxSizeMB={60} allowPaste label="Choose an image" />
            <EmptyState icon="image" title="No image yet">Pick a photo to see a live preview. The full-size result is processed only when you download.</EmptyState>
          </div>
        ) : (
          <div className="space-y-5">
            <FileChip file={file} />
            {loading && <Spinner label="Reading image" />}
            {error && <Notice tone="error">{error}</Notice>}
            {base && bitmap && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-3">
                  {previewMode === "crop" ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <figure>
                          <canvas ref={origRef} className="block h-auto w-full rounded-lg [image-rendering:pixelated]" role="img" aria-label="Original, 100% crop" />
                          <figcaption className="mt-1 text-sm text-ink-2">Before (100%)</figcaption>
                        </figure>
                        <figure>
                          <canvas ref={viewRef} className="block h-auto w-full rounded-lg [image-rendering:pixelated]" role="img" aria-label="Filtered, 100% crop" />
                          <figcaption className="mt-1 text-sm text-ink-2">After (100%)</figcaption>
                        </figure>
                      </div>
                      <SelectField label="Preview area" value={region} onChange={(e) => setRegion(e.target.value)} options={REGIONS} hint="Shown at actual pixel size so you can judge the noise." />
                    </>
                  ) : (
                    <>
                      <div className="grid place-items-center overflow-hidden rounded-xl p-2" style={CHECKER}>
                        <canvas ref={viewRef} className="block h-auto max-h-[65vh] max-w-full" role="img" aria-label={showOriginal ? "Original image preview" : "Edited image preview"} />
                      </div>
                      <Btn
                        variant="ghost"
                        icon="eye"
                        aria-pressed={showOriginal}
                        onClick={() => setShowOriginal((v) => !v)}
                      >
                        {showOriginal ? "Showing original" : "Compare with original"}
                      </Btn>
                    </>
                  )}
                </div>
                <div className="min-w-0 space-y-4">
                  {controls}
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="subtle" icon="reset" onClick={onReset}>
                      Reset settings
                    </Btn>
                  </div>
                  <FormatSelect value={format} onChange={setFormat} formats={["png", "jpeg", "webp"]} extra={[{ value: "auto", label: "Same as input (JPG, WebP or PNG)" }]} />
                  {FORMAT_INFO[outFormat].lossy && <RangeField label="Quality" value={quality} onChange={setQuality} min={10} max={100} unit="%" />}
                  {progress !== null ? (
                    <div className="space-y-2">
                      <ProgressBar value={progress} label={`Processing ${bitmap.width} × ${bitmap.height} px`} />
                      <Btn variant="ghost" onClick={() => ctrl.current?.abort()}>
                        Cancel
                      </Btn>
                    </div>
                  ) : (
                    <Btn icon="download" onClick={run}>
                      Apply and download ({bitmap.width} × {bitmap.height})
                    </Btn>
                  )}
                  {runError && <Notice tone="error">{runError}</Notice>}
                </div>
              </div>
            )}
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
