"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, baseName, downloadBlob } from "@/components/tools/engines/files";
import { CHECKER, ColorField, FormatSelect, RangeField, errMsg, useDecodedImage } from "./shared";
import { parseHex } from "./lib/encoders";
import { FORMAT_INFO, IMAGE_ACCEPT, drawScaled, encodeCanvas, makeCanvas, type OutputFormat } from "./lib/pipeline";

type S = {
  border: number;
  borderColor: string;
  radius: number;
  padding: number;
  paddingColor: string;
  paddingTransparent: boolean;
  shadow: boolean;
  shadowBlur: number;
  shadowY: number;
  shadowOpacity: number;
  shadowColor: string;
};

const DEFAULT: S = {
  border: 8,
  borderColor: "#ffffff",
  radius: 32,
  padding: 0,
  paddingColor: "#ffffff",
  paddingTransparent: false,
  shadow: true,
  shadowBlur: 30,
  shadowY: 12,
  shadowOpacity: 35,
  shadowColor: "#000000",
};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function compose(bmp: ImageBitmap, s: S, scale: number) {
  const iw = Math.max(1, Math.round(bmp.width * scale));
  const ih = Math.max(1, Math.round(bmp.height * scale));
  const b = s.border * scale;
  const p = s.padding * scale;
  const r = s.radius * scale;
  const W = Math.round(iw + 2 * (b + p));
  const H = Math.round(ih + 2 * (b + p));
  const box = makeCanvas(W, H);
  const c = box.ctx;
  if (b > 0) {
    rr(c, 0, 0, W, H, r);
    c.fillStyle = s.borderColor;
    c.fill();
  }
  c.save();
  rr(c, b, b, W - 2 * b, H - 2 * b, Math.max(0, r - b));
  c.clip();
  c.clearRect(0, 0, W, H);
  if (p > 0 && !s.paddingTransparent) {
    c.fillStyle = s.paddingColor;
    c.fillRect(0, 0, W, H);
  }
  c.restore();
  c.save();
  rr(c, b + p, b + p, iw, ih, Math.max(0, r - b - p));
  c.clip();
  c.drawImage(scale === 1 ? bmp : drawScaled(bmp, iw, ih), b + p, b + p, iw, ih);
  c.restore();
  if (!s.shadow) return box.canvas;
  const blurPx = s.shadowBlur * scale;
  const dy = s.shadowY * scale;
  const m = Math.ceil(blurPx * 1.5 + Math.abs(dy));
  const out = makeCanvas(W + 2 * m, H + 2 * m);
  const rgb = parseHex(s.shadowColor) ?? { r: 0, g: 0, b: 0 };
  out.ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${s.shadowOpacity / 100})`;
  out.ctx.shadowBlur = blurPx;
  out.ctx.shadowOffsetY = dy;
  out.ctx.drawImage(box.canvas, m, m);
  return out.canvas;
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const { bitmap, error, loading } = useDecodedImage(file);
  const [s, setS] = useState<S>(DEFAULT);
  const [format, setFormat] = useState("png");
  const [pageBg, setPageBg] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const set = <K extends keyof S>(k: K) => (v: S[K]) => setS((p) => ({ ...p, [k]: v }));
  const fmt = format as OutputFormat;

  const viewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = viewRef.current;
    if (!c || !bitmap) return;
    const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
    const out = compose(bitmap, s, scale);
    c.width = out.width;
    c.height = out.height;
    c.getContext("2d")?.drawImage(out, 0, 0);
  }, [bitmap, s]);

  const exportImg = async () => {
    if (!bitmap) return;
    setBusy(true);
    setExportError(null);
    try {
      const blob = await encodeCanvas(compose(bitmap, s, 1), fmt, { quality: 0.92, background: pageBg });
      downloadBlob(blob, `${file ? baseName(file.name) : "image"}-framed.${FORMAT_INFO[fmt].ext}`);
    } catch (e) {
      setExportError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Border, corners and shadow" actions={file ? <ResetBtn onClick={() => setFile(null)} label="New image" /> : undefined}>
        {!file ? (
          <div className="space-y-5">
            <FileDrop onFiles={(f) => setFile(f[0] ?? null)} accept={IMAGE_ACCEPT} maxSizeMB={40} allowPaste label="Choose an image" />
            <EmptyState icon="image" title="No image yet">Add a frame, round the corners and drop a soft shadow. PNG keeps the outside transparent.</EmptyState>
          </div>
        ) : (
          <div className="space-y-5">
            <FileChip file={file} />
            {loading && <Spinner label="Reading image" />}
            {error && <Notice tone="error">{error}</Notice>}
            {bitmap && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid min-w-0 place-items-center self-start overflow-hidden rounded-xl p-3" style={CHECKER}>
                  <canvas ref={viewRef} className="block h-auto max-h-[65vh] max-w-full" role="img" aria-label="Preview with border and rounded corners" />
                </div>
                <div className="min-w-0 space-y-3">
                  <p className="text-[0.8125rem] text-muted">Sizes are in pixels of the original image ({bitmap.width} × {bitmap.height}).</p>
                  <RangeField label="Corner radius" value={s.radius} onChange={set("radius")} min={0} max={Math.round(Math.min(bitmap.width, bitmap.height) / 2)} unit=" px" />
                  <RangeField label="Border width" value={s.border} onChange={set("border")} min={0} max={200} unit=" px" />
                  {s.border > 0 && <ColorField label="Border color" value={s.borderColor} onChange={set("borderColor")} />}
                  <RangeField label="Padding" value={s.padding} onChange={set("padding")} min={0} max={200} unit=" px" />
                  {s.padding > 0 && (
                    <>
                      <Checkbox label="Transparent padding" checked={s.paddingTransparent} onChange={set("paddingTransparent")} />
                      {!s.paddingTransparent && <ColorField label="Padding color" value={s.paddingColor} onChange={set("paddingColor")} />}
                    </>
                  )}
                  <Checkbox label="Drop shadow" checked={s.shadow} onChange={set("shadow")} />
                  {s.shadow && (
                    <>
                      <RangeField label="Shadow softness" value={s.shadowBlur} onChange={set("shadowBlur")} min={0} max={120} unit=" px" />
                      <RangeField label="Shadow offset (down)" value={s.shadowY} onChange={set("shadowY")} min={-60} max={60} unit=" px" />
                      <RangeField label="Shadow opacity" value={s.shadowOpacity} onChange={set("shadowOpacity")} min={0} max={100} unit="%" />
                      <ColorField label="Shadow color" value={s.shadowColor} onChange={set("shadowColor")} />
                    </>
                  )}
                  <FormatSelect value={format} onChange={setFormat} formats={["png", "webp", "jpeg"]} />
                  {fmt === "jpeg" && <ColorField label="Background behind corners (JPG)" value={pageBg} onChange={setPageBg} />}
                  <div className="flex flex-wrap gap-2">
                    <Btn icon="download" disabled={busy} onClick={exportImg}>
                      {busy ? "Exporting…" : `Download ${FORMAT_INFO[fmt].label}`}
                    </Btn>
                    <Btn variant="subtle" icon="reset" onClick={() => setS(DEFAULT)}>
                      Reset
                    </Btn>
                  </div>
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
