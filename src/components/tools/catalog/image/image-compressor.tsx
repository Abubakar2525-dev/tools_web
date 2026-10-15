"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, NumberField, PrivacyNote, ResetBtn, Segmented, ToolPanel, fmt as fmtNum, parseNum } from "@/components/tools/kit";
import { FileDrop, formatBytes, withExt } from "@/components/tools/engines/files";
import { BatchList, ColorField, FormatSelect, RangeField, savings, useBatch, useEncodable, type Processor } from "./shared";
import { CancelledError } from "./lib/filters";
import { searchQuality } from "./lib/geometry";
import { FORMAT_INFO, IMAGE_ACCEPT, bitmapToCanvas, decodeImage, encodeCanvas, formatFromMime, type Encodable, type OutputFormat } from "./lib/pipeline";

type Mode = "quality" | "target";
const LOSSY: OutputFormat[] = ["jpeg", "webp", "avif"];

function pickFormat(choice: string, inputMime: string, enc: Encodable): OutputFormat {
  if (choice !== "same") return enc[choice as OutputFormat] ? (choice as OutputFormat) : "jpeg";
  const f = formatFromMime(inputMime);
  if (f && LOSSY.includes(f) && enc[f]) return f;
  return enc.webp ? "webp" : "jpeg";
}

export default function Tool() {
  const batch = useBatch();
  const enc = useEncodable();
  const [choice, setChoice] = useState("same");
  const [mode, setMode] = useState<Mode>("quality");
  const [quality, setQuality] = useState(75);
  const [targetKb, setTargetKb] = useState("200");
  const [maxSide, setMaxSide] = useState("");
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [bg, setBg] = useState("#ffffff");

  const target = parseNum(targetKb);
  const targetErr = mode === "target" && (target === null || target < 1) ? "Enter a target size of at least 1 KB." : null;
  const side = maxSide.trim() ? parseNum(maxSide) : null;
  const sideErr = maxSide.trim() && (side === null || side < 16 || side > 16384) ? "Use 16 to 16384 px, or leave empty." : null;

  const process: Processor = async (file, signal) => {
    const out = pickFormat(choice, file.type, enc);
    const info = FORMAT_INFO[out];
    const bmp = await decodeImage(file);
    let canvas: HTMLCanvasElement;
    try {
      canvas = bitmapToCanvas(bmp, side ?? undefined);
    } finally {
      bmp.close();
    }
    const encode = async (q: number) => {
      if (signal.aborted) throw new CancelledError();
      const blob = await encodeCanvas(canvas, out, { quality: q, background: bg });
      return { blob, size: blob.size };
    };
    let blob: Blob;
    let note: string;
    if (mode === "target") {
      const bytes = (target ?? 200) * 1024;
      const r = await searchQuality(encode, bytes, { lo: 0.05, hi: 0.95, iterations: 7 });
      blob = r.result.blob;
      note = r.reached
        ? `${info.label} at quality ${Math.round(r.quality * 100)}%`
        : `Could not reach ${fmtNum(target ?? 0, 0)} KB even at the lowest quality; set a maximum size to shrink the dimensions`;
    } else {
      blob = (await encode(quality / 100)).blob;
      note = `${info.label} at quality ${quality}%`;
    }
    note += `, ${canvas.width} × ${canvas.height} px`;
    if (keepOriginal && blob.size >= file.size) {
      return { blob: file, name: file.name, keptOriginal: true, note: `${note}. The result was not smaller, so the original is kept` };
    }
    return { blob, name: withExt(file.name, info.ext), note };
  };

  const ready = batch.items.length > 0 && !targetErr && !sideErr;

  return (
    <div className="space-y-5">
      <ToolPanel title="Compress images" actions={batch.items.length ? <ResetBtn onClick={batch.clear} label="Clear all" /> : undefined}>
        <div className="space-y-5">
          <FileDrop
            onFiles={batch.add}
            accept={IMAGE_ACCEPT}
            multiple
            maxSizeMB={60}
            maxFiles={60}
            allowPaste
            label="Choose images or drop them here"
            hint="JPG, PNG, WebP, AVIF, HEIC and more. Up to 60 MB each, 60 files."
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormatSelect
              value={choice}
              onChange={setChoice}
              formats={LOSSY}
              extra={[{ value: "same", label: "Same as input (PNG becomes WebP or JPG)" }]}
            />
            <div>
              <p className="text-sm font-medium text-ink" aria-hidden="true">
                Compression by
              </p>
              <div className="mt-2">
                <Segmented
                  label="Compression by"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "quality", label: "Quality" },
                    { value: "target", label: "Target size" },
                  ]}
                />
              </div>
            </div>
            {mode === "quality" ? (
              <RangeField label="Quality" value={quality} onChange={setQuality} min={5} max={100} unit="%" hint="60 to 80% is a good balance for photos." />
            ) : (
              <NumberField
                label="Target size per image (KB)"
                value={targetKb}
                onChange={(e) => setTargetKb(e.target.value)}
                error={targetErr}
                hint="Finds the highest quality that fits, by binary search."
              />
            )}
            <NumberField label="Maximum width or height (px)" optional value={maxSide} onChange={(e) => setMaxSide(e.target.value)} error={sideErr} hint="Downscales larger images first, which saves far more than quality alone." />
            <ColorField label="Background for transparent areas (JPG)" value={bg} onChange={setBg} />
            <div className="self-end">
              <Checkbox label="Keep the original when the result is not smaller" checked={keepOriginal} onChange={setKeepOriginal} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn icon="download" disabled={!ready || batch.running} onClick={() => batch.run(batch.items, process)}>
              Compress {batch.items.length || ""} image{batch.items.length === 1 ? "" : "s"}
            </Btn>
            {batch.running && (
              <Btn variant="ghost" onClick={batch.cancel}>
                Cancel
              </Btn>
            )}
          </div>
          {batch.items.length ? (
            <>
              <Totals items={batch.items} />
              <BatchList
                items={batch.items}
                running={batch.running}
                onRemove={batch.remove}
                zipName="compressed-images.zip"
                details={(it) =>
                  it.out && (
                    <p>
                      {formatBytes(it.file.size)} → {formatBytes(it.out.blob.size)} ({it.out.keptOriginal ? "original kept" : savings(it.file.size, it.out.blob.size)}). {it.out.note}.
                    </p>
                  )
                }
              />
            </>
          ) : (
            <EmptyState icon="image" title="No images yet">
              Add images, choose quality or a target size, then compress. Results stay on your device.
            </EmptyState>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

function Totals({ items }: { items: ReturnType<typeof useBatch>["items"] }) {
  const done = items.filter((i) => i.out);
  if (!done.length) return null;
  const before = done.reduce((n, i) => n + i.file.size, 0);
  const after = done.reduce((n, i) => n + (i.out?.blob.size ?? 0), 0);
  return (
    <p className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-ink" aria-live="polite">
      Total: {formatBytes(before)} → {formatBytes(after)} ({savings(before, after)}) across {done.length} image{done.length === 1 ? "" : "s"}.
    </p>
  );
}
