"use client";

import { useState } from "react";
import { Btn, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, ToolPanel } from "@/components/tools/kit";
import { FileDrop, loadImage, withExt } from "@/components/tools/engines/files";
import { BatchList, RangeField, useBatch, useEncodable, type Processor } from "./shared";
import { CancelledError } from "./lib/filters";
import { FORMAT_INFO, bitmapToCanvas, encodeCanvas, heicToPng, isHeic, type OutputFormat } from "./lib/pipeline";

type Target = "jpeg" | "png" | "webp";

export default function Tool() {
  const batch = useBatch();
  const enc = useEncodable();
  const [target, setTarget] = useState<Target>("jpeg");
  const [quality, setQuality] = useState(90);
  const fmt: OutputFormat = target === "webp" && !enc.webp ? "jpeg" : target;
  const info = FORMAT_INFO[fmt];

  const process: Processor = async (file, signal) => {
    if (!(await isHeic(file))) throw new Error("This does not look like a HEIC or HEIF file.");
    let bmp: ImageBitmap;
    let via = "browser decoder";
    try {
      // Safari can decode HEIC natively, which is much faster.
      bmp = await loadImage(file);
    } catch {
      via = "heic2any";
      const png = await heicToPng(file);
      if (signal.aborted) throw new CancelledError();
      bmp = await loadImage(png);
    }
    try {
      if (signal.aborted) throw new CancelledError();
      const canvas = bitmapToCanvas(bmp);
      const blob = await encodeCanvas(canvas, fmt, { quality: quality / 100, background: "#ffffff" });
      return { blob, name: withExt(file.name, info.ext), note: `${canvas.width} × ${canvas.height} px, decoded with ${via}` };
    } finally {
      bmp.close();
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Convert HEIC photos" actions={batch.items.length ? <ResetBtn onClick={batch.clear} label="Clear all" /> : undefined}>
        <div className="space-y-5">
          <FileDrop
            onFiles={batch.add}
            accept=".heic,.heif,image/heic,image/heif"
            multiple
            maxSizeMB={50}
            maxFiles={50}
            label="Choose HEIC or HEIF photos"
            hint="iPhone photos (.heic). Up to 50 MB each, 50 files."
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-ink" aria-hidden="true">
                Convert to
              </p>
              <div className="mt-2">
                <Segmented
                  label="Convert to"
                  value={target}
                  onChange={setTarget}
                  options={[
                    { value: "jpeg", label: "JPG" },
                    { value: "png", label: "PNG" },
                    ...(enc.webp ? [{ value: "webp" as const, label: "WebP" }] : []),
                  ]}
                />
              </div>
            </div>
            {info.lossy ? (
              <RangeField label="Quality" value={quality} onChange={setQuality} min={10} max={100} unit="%" />
            ) : (
              <p className="self-end text-sm text-muted">PNG is lossless and usually 3 to 6 times larger than JPG for photos.</p>
            )}
          </div>
          <Notice>
            The decoder loads on first use. Large photos can take a few seconds each. Only the main image is converted; Live Photo video, depth maps and
            camera metadata are not carried over.
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Btn icon="swap" disabled={!batch.items.length || batch.running} onClick={() => batch.run(batch.items, process)}>
              Convert to {info.label}
            </Btn>
            {batch.running && (
              <Btn variant="ghost" onClick={batch.cancel}>
                Cancel
              </Btn>
            )}
          </div>
          {batch.items.length ? (
            <BatchList items={batch.items} running={batch.running} onRemove={batch.remove} zipName={`heic-to-${info.ext}.zip`} />
          ) : (
            <EmptyState icon="image" title="No HEIC files yet">
              Add photos exported from an iPhone or iPad, choose a format, then convert.
            </EmptyState>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
