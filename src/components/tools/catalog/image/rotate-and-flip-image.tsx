"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, NumberField, PrivacyNote, ResetBtn, ToolPanel, parseNum } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, baseName, downloadBlob } from "@/components/tools/engines/files";
import { CHECKER, ColorField, FormatSelect, RangeField, errMsg, useDecodedImage } from "./shared";
import { largestInnerRect, rotatedBounds } from "./lib/geometry";
import { FORMAT_INFO, IMAGE_ACCEPT, encodeCanvas, makeCanvas, type OutputFormat } from "./lib/pipeline";

type Opts = { quarter: number; flipH: boolean; flipV: boolean; angle: number; autoCrop: boolean; fill: string | null };

function outSize(bmp: { width: number; height: number }, o: Pick<Opts, "quarter" | "angle" | "autoCrop">) {
  const turned = o.quarter % 2 === 1;
  const W = turned ? bmp.height : bmp.width;
  const H = turned ? bmp.width : bmp.height;
  return o.angle === 0 ? { width: W, height: H } : o.autoCrop ? largestInnerRect(W, H, o.angle) : rotatedBounds(W, H, o.angle);
}

function render(bmp: ImageBitmap, o: Opts, scale = 1) {
  const size = outSize(bmp, o);
  const { canvas, ctx } = makeCanvas(Math.max(1, size.width * scale), Math.max(1, size.height * scale));
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((o.angle * Math.PI) / 180);
  ctx.scale((o.flipH ? -1 : 1) * scale, (o.flipV ? -1 : 1) * scale);
  ctx.rotate((o.quarter * Math.PI) / 2);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  return canvas;
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const { bitmap, error, loading } = useDecodedImage(file);
  const [quarter, setQuarter] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [angle, setAngle] = useState(0);
  const [angleText, setAngleText] = useState<string | null>(null);
  const [autoCrop, setAutoCrop] = useState(true);
  const [transparent, setTransparent] = useState(true);
  const [fill, setFill] = useState("#ffffff");
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const fmt = format as OutputFormat;
  const needsFill = angle !== 0 && !autoCrop && (!transparent || !FORMAT_INFO[fmt].alpha);
  const opts: Opts = { quarter, flipH, flipV, angle, autoCrop, fill: needsFill ? fill : null };

  const viewRef = useRef<HTMLCanvasElement>(null);
  const size = bitmap ? outSize(bitmap, opts) : null;
  const dims = size ? `${size.width} × ${size.height} px` : "";
  useEffect(() => {
    const c = viewRef.current;
    if (!c || !bitmap) return;
    const o: Opts = { quarter, flipH, flipV, angle, autoCrop, fill: needsFill ? fill : null };
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const out = render(bitmap, o, scale);
    c.width = out.width;
    c.height = out.height;
    c.getContext("2d")?.drawImage(out, 0, 0);
  }, [bitmap, quarter, flipH, flipV, angle, autoCrop, needsFill, fill]);

  const reset = () => {
    setQuarter(0);
    setFlipH(false);
    setFlipV(false);
    setAngle(0);
    setAngleText(null);
  };

  const exportImg = async () => {
    if (!bitmap) return;
    setBusy(true);
    setExportError(null);
    try {
      const blob = await encodeCanvas(render(bitmap, opts), fmt, { quality: quality / 100, background: fill });
      downloadBlob(blob, `${file ? baseName(file.name) : "image"}-rotated.${FORMAT_INFO[fmt].ext}`);
    } catch (e) {
      setExportError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Rotate and flip" actions={file ? <ResetBtn onClick={() => setFile(null)} label="New image" /> : undefined}>
        {!file ? (
          <div className="space-y-5">
            <FileDrop onFiles={(f) => setFile(f[0] ?? null)} accept={IMAGE_ACCEPT} maxSizeMB={60} allowPaste label="Choose an image" />
            <EmptyState icon="image" title="No image yet">Rotate in 90° steps, mirror, or straighten a tilted horizon.</EmptyState>
          </div>
        ) : (
          <div className="space-y-5">
            <FileChip file={file} />
            {loading && <Spinner label="Reading image" />}
            {error && <Notice tone="error">{error}</Notice>}
            {bitmap && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0">
                  <div className="grid place-items-center overflow-hidden rounded-xl p-2" style={CHECKER}>
                    <canvas ref={viewRef} className="block h-auto max-h-[65vh] max-w-full" role="img" aria-label={`Preview, ${dims}`} />
                  </div>
                  <p className="mt-2 text-sm text-ink-2" aria-live="polite">
                    Output: {dims}
                  </p>
                </div>
                <div className="min-w-0 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Btn variant="ghost" onClick={() => setQuarter((q) => (q + 3) % 4)}>
                      Rotate left 90°
                    </Btn>
                    <Btn variant="ghost" onClick={() => setQuarter((q) => (q + 1) % 4)}>
                      Rotate right 90°
                    </Btn>
                    <Btn variant="ghost" onClick={() => setQuarter((q) => (q + 2) % 4)}>
                      Rotate 180°
                    </Btn>
                    <Btn variant="ghost" onClick={reset}>
                      Reset
                    </Btn>
                    <Btn variant={flipH ? "primary" : "ghost"} aria-pressed={flipH} onClick={() => setFlipH((v) => !v)}>
                      Flip horizontal
                    </Btn>
                    <Btn variant={flipV ? "primary" : "ghost"} aria-pressed={flipV} onClick={() => setFlipV((v) => !v)}>
                      Flip vertical
                    </Btn>
                  </div>
                  <RangeField
                    label="Straighten"
                    value={angle}
                    onChange={(v) => {
                      setAngle(v);
                      setAngleText(null);
                    }}
                    min={-45}
                    max={45}
                    step={0.1}
                    format={(v) => `${v.toFixed(1)}°`}
                  />
                  <NumberField
                    label="Exact angle (degrees)"
                    value={angleText ?? String(angle)}
                    onChange={(e) => {
                      setAngleText(e.target.value);
                      const n = parseNum(e.target.value);
                      if (n !== null && n >= -45 && n <= 45) setAngle(n);
                    }}
                    error={angleText !== null && (parseNum(angleText) === null || Math.abs(parseNum(angleText) ?? 99) > 45) ? "Enter a value from -45 to 45." : null}
                  />
                  <Checkbox label="Crop away empty corners" checked={autoCrop} onChange={setAutoCrop} hint="Keeps the largest rectangle that has no blank areas." />
                  {angle !== 0 && !autoCrop && (
                    <>
                      <Checkbox label="Transparent corners" checked={transparent} onChange={setTransparent} hint="JPG always uses the fill color." />
                      {needsFill && <ColorField label="Corner fill color" value={fill} onChange={setFill} />}
                    </>
                  )}
                  <FormatSelect value={format} onChange={setFormat} formats={["png", "jpeg", "webp"]} />
                  {FORMAT_INFO[fmt].lossy && <RangeField label="Quality" value={quality} onChange={setQuality} min={10} max={100} unit="%" />}
                  <Btn icon="download" disabled={busy} onClick={exportImg}>
                    {busy ? "Exporting…" : `Download ${FORMAT_INFO[fmt].label}`}
                  </Btn>
                  {exportError && <Notice tone="error">{exportError}</Notice>}
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
