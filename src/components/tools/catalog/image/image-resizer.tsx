"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, NumberField, PrivacyNote, ResetBtn, Segmented, ToolPanel, parseNum } from "@/components/tools/kit";
import { FileDrop, withExt } from "@/components/tools/engines/files";
import { BatchList, ColorField, FormatSelect, RangeField, useBatch, useEncodable, type Processor } from "./shared";
import { CancelledError } from "./lib/filters";
import { computeResize, type ResizeSpec } from "./lib/geometry";
import { FORMAT_INFO, IMAGE_ACCEPT, decodeImage, drawScaled, encodeCanvas, formatFromMime, type OutputFormat } from "./lib/pipeline";

type Mode = "pixels" | "percent" | "fit";

export default function Tool() {
  const batch = useBatch();
  const enc = useEncodable();
  const [mode, setMode] = useState<Mode>("pixels");
  const [w, setW] = useState("1280");
  const [h, setH] = useState("");
  const [keep, setKeep] = useState(true);
  const [pct, setPct] = useState("50");
  const [boxW, setBoxW] = useState("1920");
  const [boxH, setBoxH] = useState("1080");
  const [upscale, setUpscale] = useState(false);
  const [format, setFormat] = useState("same");
  const [quality, setQuality] = useState(90);
  const [bg, setBg] = useState("#ffffff");

  const pos = (s: string) => {
    if (!s.trim()) return null;
    const n = parseNum(s);
    return n !== null && n > 0 ? Math.round(n) : NaN;
  };
  let spec: ResizeSpec | null = null;
  let err: string | null = null;
  if (mode === "pixels") {
    const W = pos(w);
    const H = pos(h);
    if (Number.isNaN(W) || Number.isNaN(H)) err = "Width and height must be positive whole numbers.";
    else if (!W && !H) err = "Enter a width, a height, or both.";
    else if (!keep && (!W || !H)) err = "Without a locked aspect ratio, enter both width and height.";
    else spec = { mode, width: W, height: H, keepAspect: keep };
  } else if (mode === "percent") {
    const p = parseNum(pct);
    if (p === null || p <= 0 || p > 1000) err = "Enter a percentage between 1 and 1000.";
    else spec = { mode, percent: p };
  } else {
    const W = pos(boxW);
    const H = pos(boxH);
    if (!W || !H || Number.isNaN(W) || Number.isNaN(H)) err = "Enter both a maximum width and height.";
    else spec = { mode, maxWidth: W, maxHeight: H, upscale };
  }

  const resolveFormat = (mime: string): OutputFormat => {
    if (format !== "same") return format as OutputFormat;
    const f = formatFromMime(mime);
    return f && enc[f] ? f : "png";
  };
  const needsQuality = format === "same" || FORMAT_INFO[format as OutputFormat]?.lossy;

  const process: Processor = async (file, signal) => {
    if (!spec) throw new Error(err ?? "Check the size settings.");
    const bmp = await decodeImage(file);
    try {
      if (signal.aborted) throw new CancelledError();
      const size = computeResize(bmp.width, bmp.height, spec);
      const out = resolveFormat(file.type);
      const canvas = drawScaled(bmp, size.width, size.height);
      const blob = await encodeCanvas(canvas, out, { quality: quality / 100, background: bg });
      return {
        blob,
        name: withExt(file.name, FORMAT_INFO[out].ext),
        note: `${bmp.width} × ${bmp.height} → ${size.width} × ${size.height} px, ${FORMAT_INFO[out].label}`,
      };
    } finally {
      bmp.close();
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Resize images" actions={batch.items.length ? <ResetBtn onClick={batch.clear} label="Clear all" /> : undefined}>
        <div className="space-y-5">
          <FileDrop onFiles={batch.add} accept={IMAGE_ACCEPT} multiple maxSizeMB={60} maxFiles={60} allowPaste label="Choose images or drop them here" />
          <Segmented
            label="Resize mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "pixels", label: "Exact pixels" },
              { value: "percent", label: "Percentage" },
              { value: "fit", label: "Fit within box" },
            ]}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            {mode === "pixels" && (
              <>
                <NumberField label="Width (px)" value={w} onChange={(e) => setW(e.target.value)} optional={keep} />
                <NumberField label="Height (px)" value={h} onChange={(e) => setH(e.target.value)} optional={keep} />
                <div className="sm:col-span-2">
                  <Checkbox
                    label="Keep aspect ratio"
                    checked={keep}
                    onChange={setKeep}
                    hint="Fill one side and the other is calculated per image. With both filled, each image fits inside that size."
                  />
                </div>
              </>
            )}
            {mode === "percent" && <NumberField label="Scale (%)" value={pct} onChange={(e) => setPct(e.target.value)} hint="50 halves each side; 200 doubles it." />}
            {mode === "fit" && (
              <>
                <NumberField label="Maximum width (px)" value={boxW} onChange={(e) => setBoxW(e.target.value)} />
                <NumberField label="Maximum height (px)" value={boxH} onChange={(e) => setBoxH(e.target.value)} />
                <div className="sm:col-span-2">
                  <Checkbox label="Enlarge smaller images to fill the box" checked={upscale} onChange={setUpscale} hint="Upscaling cannot add detail; it only makes pixels bigger." />
                </div>
              </>
            )}
          </div>
          {err && (
            <p className="text-sm text-danger" role="alert">
              {err}
            </p>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormatSelect value={format} onChange={setFormat} formats={["jpeg", "png", "webp", "avif"]} extra={[{ value: "same", label: "Same as input" }]} />
            {needsQuality && <RangeField label="Quality (JPG, WebP, AVIF)" value={quality} onChange={setQuality} min={10} max={100} unit="%" />}
            {(format === "jpeg" || format === "same") && <ColorField label="Background for transparent areas (JPG)" value={bg} onChange={setBg} />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn icon="ruler" disabled={!batch.items.length || !spec || batch.running} onClick={() => batch.run(batch.items, process)}>
              Resize {batch.items.length || ""} image{batch.items.length === 1 ? "" : "s"}
            </Btn>
            {batch.running && (
              <Btn variant="ghost" onClick={batch.cancel}>
                Cancel
              </Btn>
            )}
          </div>
          {batch.items.length ? (
            <BatchList items={batch.items} running={batch.running} onRemove={batch.remove} zipName="resized-images.zip" />
          ) : (
            <EmptyState icon="ruler" title="No images yet">
              Add images, choose how to size them, then resize. Downscaling uses stepwise smoothing for sharper results.
            </EmptyState>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
