"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, TextField, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, withExt } from "@/components/tools/engines/files";
import { BatchList, CHECKER, ColorField, FormatSelect, RangeField, useBatch, useDecodedImage, useEncodable, type Processor } from "./shared";
import { CancelledError } from "./lib/filters";
import { parseHex } from "./lib/encoders";
import { luminance } from "./lib/qr";
import { FORMAT_INFO, IMAGE_ACCEPT, bitmapToCanvas, decodeImage, encodeCanvas, formatFromMime, makeCanvas, type OutputFormat } from "./lib/pipeline";

type Pos = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br" | "tile";
type S = {
  kind: "text" | "logo";
  text: string;
  color: string;
  bold: boolean;
  outline: boolean;
  textSize: number;
  logoSize: number;
  opacity: number;
  pos: Pos;
  margin: number;
  angle: number;
  gap: number;
};

const DEFAULT: S = { kind: "text", text: "© Your name", color: "#ffffff", bold: true, outline: true, textSize: 5, logoSize: 20, opacity: 60, pos: "br", margin: 3, angle: -30, gap: 60 };

const GRID: { value: Pos; label: string }[] = [
  { value: "tl", label: "Top left" },
  { value: "tc", label: "Top center" },
  { value: "tr", label: "Top right" },
  { value: "ml", label: "Middle left" },
  { value: "mc", label: "Center" },
  { value: "mr", label: "Middle right" },
  { value: "bl", label: "Bottom left" },
  { value: "bc", label: "Bottom center" },
  { value: "br", label: "Bottom right" },
];

/** Draws the watermark onto a canvas that already holds the photo. */
function stamp(canvas: HTMLCanvasElement, s: S, logo: ImageBitmap | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const short = Math.min(W, H);
  let mw: number;
  let mh: number;
  let draw: (x: number, y: number) => void;
  if (s.kind === "text") {
    const text = s.text.trim();
    if (!text) return;
    const fs = Math.max(6, (short * s.textSize) / 100);
    ctx.font = `${s.bold ? 700 : 400} ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    mw = ctx.measureText(text).width;
    mh = fs * 1.15;
    draw = (x, y) => {
      ctx.textBaseline = "top";
      if (s.outline) {
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(1, fs / 10);
        ctx.strokeStyle = luminance(parseHex(s.color) ?? { r: 255, g: 255, b: 255 }) > 0.35 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";
        ctx.strokeText(text, x, y + fs * 0.05);
      }
      ctx.fillStyle = s.color;
      ctx.fillText(text, x, y + fs * 0.05);
    };
  } else {
    if (!logo) return;
    mw = Math.max(4, (W * s.logoSize) / 100);
    mh = (mw * logo.height) / logo.width;
    draw = (x, y) => ctx.drawImage(logo, x, y, mw, mh);
  }
  ctx.save();
  ctx.globalAlpha = s.opacity / 100;
  if (s.pos === "tile") {
    const gap = (short * s.gap) / 100 / 4 + mw * 0.15;
    const stepX = mw + gap;
    const stepY = mh + gap;
    const diag = Math.sqrt(W * W + H * H);
    ctx.translate(W / 2, H / 2);
    ctx.rotate((s.angle * Math.PI) / 180);
    let row = 0;
    for (let y = -diag / 2; y < diag / 2; y += stepY, row++) {
      const offset = row % 2 ? stepX / 2 : 0;
      for (let x = -diag / 2 - offset; x < diag / 2; x += stepX) draw(x, y);
    }
  } else {
    const m = (short * s.margin) / 100;
    const col = s.pos[1];
    const rowK = s.pos[0];
    const x = col === "l" ? m : col === "r" ? W - mw - m : (W - mw) / 2;
    const y = rowK === "t" ? m : rowK === "b" ? H - mh - m : (H - mh) / 2;
    draw(x, y);
  }
  ctx.restore();
}

export default function Tool() {
  const batch = useBatch();
  const enc = useEncodable();
  const [s, setS] = useState<S>(DEFAULT);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logo = useDecodedImage(logoFile);
  const [format, setFormat] = useState("same");
  const [quality, setQuality] = useState(90);
  const set = <K extends keyof S>(k: K) => (v: S[K]) => setS((p) => ({ ...p, [k]: v }));

  const first = batch.items[0]?.file ?? null;
  const firstImg = useDecodedImage(first);
  const viewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = viewRef.current;
    if (!c || !firstImg.bitmap) return;
    const base = bitmapToCanvas(firstImg.bitmap, 900);
    // Scale-independent settings mean the preview matches the full-size result.
    stamp(base, s, logo.bitmap);
    c.width = base.width;
    c.height = base.height;
    c.getContext("2d")?.drawImage(base, 0, 0);
  }, [firstImg.bitmap, s, logo.bitmap]);

  const outFor = (mime: string): OutputFormat => {
    if (format !== "same") return format as OutputFormat;
    const f = formatFromMime(mime);
    return f && f !== "bmp" && enc[f] ? f : "png";
  };

  const ready = s.kind === "text" ? s.text.trim().length > 0 : !!logo.bitmap;

  const process: Processor = async (file, signal) => {
    const bmp = await decodeImage(file);
    try {
      if (signal.aborted) throw new CancelledError();
      const { canvas, ctx } = makeCanvas(bmp.width, bmp.height);
      ctx.drawImage(bmp, 0, 0);
      stamp(canvas, s, logo.bitmap);
      const f = outFor(file.type);
      const blob = await encodeCanvas(canvas, f, { quality: quality / 100 });
      return { blob, name: withExt(file.name, FORMAT_INFO[f].ext).replace(/(\.[^.]+)$/, "-watermarked$1"), note: `${bmp.width} × ${bmp.height} px, ${FORMAT_INFO[f].label}` };
    } finally {
      bmp.close();
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Watermark images" actions={batch.items.length ? <ResetBtn onClick={batch.clear} label="Clear all" /> : undefined}>
        <div className="space-y-5">
          <FileDrop onFiles={batch.add} accept={IMAGE_ACCEPT} multiple maxSizeMB={40} maxFiles={60} allowPaste label="Choose photos to watermark" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              {firstImg.bitmap ? (
                <figure>
                  <div className="grid place-items-center overflow-hidden rounded-xl p-2" style={CHECKER}>
                    <canvas ref={viewRef} className="block h-auto max-h-[60vh] max-w-full" role="img" aria-label="Preview of the watermark on the first image" />
                  </div>
                  <figcaption className="mt-1 text-sm text-ink-2">Preview: {first?.name}</figcaption>
                </figure>
              ) : firstImg.error ? (
                <Notice tone="error">{firstImg.error}</Notice>
              ) : (
                <EmptyState icon="image" title="Preview appears here">Add photos to see the watermark on the first one.</EmptyState>
              )}
            </div>
            <div className="min-w-0 space-y-4">
              <Segmented
                label="Watermark type"
                value={s.kind}
                onChange={set("kind")}
                options={[
                  { value: "text", label: "Text" },
                  { value: "logo", label: "Logo image" },
                ]}
              />
              {s.kind === "text" ? (
                <>
                  <TextField label="Text" value={s.text} onChange={(e) => set("text")(e.target.value)} error={s.text.trim() ? null : "Enter watermark text."} />
                  <ColorField label="Text color" value={s.color} onChange={set("color")} />
                  <RangeField label="Text size" value={s.textSize} onChange={set("textSize")} min={1} max={25} step={0.5} unit="% of short side" />
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <Checkbox label="Bold" checked={s.bold} onChange={set("bold")} />
                    <Checkbox label="Contrasting outline" checked={s.outline} onChange={set("outline")} />
                  </div>
                </>
              ) : (
                <>
                  {logoFile ? (
                    <FileChip file={logoFile} onRemove={() => setLogoFile(null)} />
                  ) : (
                    <FileDrop onFiles={(f) => setLogoFile(f[0] ?? null)} accept="image/png,image/webp,image/svg+xml,image/jpeg,.svg" maxSizeMB={10} compact label="Choose a logo" hint="A PNG or SVG with transparency works best." />
                  )}
                  {logo.error && <Notice tone="error">{logo.error}</Notice>}
                  <RangeField label="Logo width" value={s.logoSize} onChange={set("logoSize")} min={2} max={80} unit="% of width" />
                </>
              )}
              <RangeField label="Opacity" value={s.opacity} onChange={set("opacity")} min={5} max={100} unit="%" />
              <div>
                <p className="text-sm font-medium text-ink" id="wm-pos">
                  Position
                </p>
                <div className="mt-2 grid w-max grid-cols-3 gap-1" role="radiogroup" aria-labelledby="wm-pos">
                  {GRID.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      role="radio"
                      aria-checked={s.pos === g.value}
                      aria-label={g.label}
                      onClick={() => set("pos")(g.value)}
                      className={`grid h-10 w-10 place-items-center rounded-md border ${s.pos === g.value ? "border-[var(--accent)] bg-accent-soft" : "border-line-strong bg-surface hover:bg-sunken"}`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${s.pos === g.value ? "bg-[var(--accent)]" : "bg-line-strong"}`} />
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <Checkbox label="Tile across the whole image" checked={s.pos === "tile"} onChange={(v) => set("pos")(v ? "tile" : "br")} />
                </div>
              </div>
              {s.pos === "tile" ? (
                <>
                  <RangeField label="Tile angle" value={s.angle} onChange={set("angle")} min={-90} max={90} unit="°" />
                  <RangeField label="Tile spacing" value={s.gap} onChange={set("gap")} min={0} max={200} unit="%" />
                </>
              ) : (
                <RangeField label="Margin from edge" value={s.margin} onChange={set("margin")} min={0} max={20} step={0.5} unit="%" />
              )}
              <FormatSelect value={format} onChange={setFormat} formats={["jpeg", "png", "webp"]} extra={[{ value: "same", label: "Same as input" }]} />
              <RangeField label="Quality (JPG, WebP)" value={quality} onChange={setQuality} min={10} max={100} unit="%" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn icon="pen" disabled={!batch.items.length || !ready || batch.running} onClick={() => batch.run(batch.items, process)}>
              Watermark {batch.items.length || ""} image{batch.items.length === 1 ? "" : "s"}
            </Btn>
            {batch.running && (
              <Btn variant="ghost" onClick={batch.cancel}>
                Cancel
              </Btn>
            )}
          </div>
          <BatchList items={batch.items} running={batch.running} onRemove={batch.remove} zipName="watermarked-images.zip" />
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
