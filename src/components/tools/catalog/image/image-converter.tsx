"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, ToolPanel } from "@/components/tools/kit";
import { FileDrop, withExt } from "@/components/tools/engines/files";
import { BatchList, ColorField, FormatSelect, RangeField, useBatch, useEncodable, type Processor } from "./shared";
import { CancelledError } from "./lib/filters";
import { FORMAT_INFO, IMAGE_ACCEPT, bitmapToCanvas, decodeImage, encodeCanvas, hasTransparency, type OutputFormat } from "./lib/pipeline";

const FORMATS: OutputFormat[] = ["jpeg", "png", "webp", "avif", "bmp"];

export default function Tool() {
  const batch = useBatch();
  const enc = useEncodable();
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [quality, setQuality] = useState(90);
  const [bg, setBg] = useState("#ffffff");
  const [bmpAlpha, setBmpAlpha] = useState(false);

  const fmt: OutputFormat = enc[format] ? format : "png";
  const info = FORMAT_INFO[fmt];
  const flattens = fmt === "jpeg" || (fmt === "bmp" && !bmpAlpha);

  const process: Processor = async (file, signal) => {
    const bmp = await decodeImage(file);
    try {
      if (signal.aborted) throw new CancelledError();
      const canvas = bitmapToCanvas(bmp);
      const hadAlpha = flattens && hasTransparency(canvas);
      const blob = await encodeCanvas(canvas, fmt, { quality: quality / 100, background: bg, bmpAlpha });
      const notes = [`${canvas.width} × ${canvas.height} px`];
      if (/gif$/i.test(file.type) || /\.gif$/i.test(file.name)) notes.push("first frame only");
      if (hadAlpha) notes.push(`transparent areas filled with ${bg}`);
      return { blob, name: withExt(file.name, info.ext), note: notes.join(", ") };
    } finally {
      bmp.close();
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Convert images" actions={batch.items.length ? <ResetBtn onClick={batch.clear} label="Clear all" /> : undefined}>
        <div className="space-y-5">
          <FileDrop
            onFiles={batch.add}
            accept={IMAGE_ACCEPT}
            multiple
            maxSizeMB={60}
            maxFiles={60}
            allowPaste
            label="Choose images or drop them here"
            hint="JPG, PNG, WebP, AVIF, GIF, BMP or HEIC. Up to 60 MB each, 60 files."
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormatSelect value={fmt} onChange={(v) => setFormat(v as OutputFormat)} formats={FORMATS} />
            {info.lossy ? (
              <RangeField label="Quality" value={quality} onChange={setQuality} min={10} max={100} unit="%" hint="Higher keeps more detail and makes bigger files." />
            ) : (
              <p className="self-end text-sm text-muted">{info.label} is lossless, so there is no quality setting.</p>
            )}
            {(fmt === "jpeg" || fmt === "bmp") && (
              <ColorField label="Background for transparent areas" value={bg} onChange={setBg} hint={fmt === "jpeg" ? "JPG has no transparency." : undefined} />
            )}
            {fmt === "bmp" && (
              <div className="self-end">
                <Checkbox label="Keep transparency (32-bit BMP)" checked={bmpAlpha} onChange={setBmpAlpha} hint="Some older programs ignore BMP alpha." />
              </div>
            )}
          </div>
          {!enc.avif && (
            <Notice>AVIF files can be opened here, but this browser cannot write AVIF. Chrome and Edge on recent versions usually can.</Notice>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn icon="swap" disabled={!batch.items.length || batch.running} onClick={() => batch.run(batch.items, process)}>
              Convert {batch.items.length ? `${batch.items.length} file${batch.items.length === 1 ? "" : "s"}` : ""} to {info.label}
            </Btn>
            {batch.running && (
              <Btn variant="ghost" onClick={batch.cancel}>
                Cancel
              </Btn>
            )}
          </div>
          {batch.items.length ? (
            <BatchList items={batch.items} running={batch.running} onRemove={batch.remove} zipName={`converted-${info.ext}.zip`} />
          ) : (
            <EmptyState icon="image" title="No images yet">
              Add one or more images, pick a format, then convert. Animated GIFs export their first frame.
            </EmptyState>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
