"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, NumberField, PrivacyNote, ResetBtn, SelectField, ToolPanel, parseNum } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, baseName, downloadBlob } from "@/components/tools/engines/files";
import { CHECKER, FormatSelect, RangeField, errMsg, useDecodedImage } from "./shared";
import { FORMAT_INFO, IMAGE_ACCEPT, encodeCanvas, makeCanvas, type OutputFormat } from "./lib/pipeline";

type Rect = { x: number; y: number; w: number; h: number };
type Handle = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

const ASPECTS = [
  { value: "free", label: "Free" },
  { value: "1:1", label: "1:1 square" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "3:2", label: "3:2" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "custom", label: "Custom" },
];

const MIN = 4;

function fitAspect(W: number, H: number, ratio: number | null): Rect {
  if (!ratio) return { x: 0, y: 0, w: W, h: H };
  let w = W;
  let h = w / ratio;
  if (h > H) {
    h = H;
    w = h * ratio;
  }
  w = Math.round(w);
  h = Math.round(h);
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
}

function clampRect(r: Rect, W: number, H: number): Rect {
  const w = Math.max(MIN, Math.min(W, Math.round(r.w)));
  const h = Math.max(MIN, Math.min(H, Math.round(r.h)));
  return { x: Math.max(0, Math.min(W - w, Math.round(r.x))), y: Math.max(0, Math.min(H - h, Math.round(r.y))), w, h };
}

function resize(start: Rect, handle: Handle, dx: number, dy: number, W: number, H: number, ratio: number | null): Rect {
  if (handle === "move") return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, W, H);
  let l = start.x;
  let t = start.y;
  let r = start.x + start.w;
  let b = start.y + start.h;
  if (handle.includes("w")) l = Math.min(r - MIN, Math.max(0, l + dx));
  if (handle.includes("e")) r = Math.max(l + MIN, Math.min(W, r + dx));
  if (handle.includes("n")) t = Math.min(b - MIN, Math.max(0, t + dy));
  if (handle.includes("s")) b = Math.max(t + MIN, Math.min(H, b + dy));
  if (ratio) {
    // Width drives height; anchor the opposite corner and shrink to stay inside.
    let w = r - l;
    let h = w / ratio;
    const maxH = handle.includes("n") ? b : H - t;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    if (handle.includes("w")) l = r - w;
    else r = l + w;
    if (handle.includes("n")) t = b - h;
    else b = t + h;
  }
  return clampRect({ x: l, y: t, w: r - l, h: b - t }, W, H);
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const { bitmap, error, loading } = useDecodedImage(file);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState("free");
  const [customW, setCustomW] = useState("5");
  const [customH, setCustomH] = useState("4");
  const [zoom, setZoom] = useState(1);
  const [circle, setCircle] = useState(false);
  const [format, setFormat] = useState<string>("png");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const source = useMemo(() => {
    if (!bitmap) return null;
    const turn = rotation % 180 !== 0;
    const { canvas, ctx } = makeCanvas(turn ? bitmap.height : bitmap.width, turn ? bitmap.width : bitmap.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    return canvas;
  }, [bitmap, rotation]);

  const W = source?.width ?? 1;
  const H = source?.height ?? 1;
  let ratio: number | null = null;
  if (aspect === "custom") {
    const a = parseNum(customW);
    const b = parseNum(customH);
    ratio = a && b && a > 0 && b > 0 ? a / b : null;
  } else if (aspect !== "free") {
    const [a, b] = aspect.split(":").map(Number);
    ratio = a / b;
  }
  const geomKey = `${W}x${H}:${aspect}:${ratio}`;
  const [cropState, setCropState] = useState<{ key: string; rect: Rect } | null>(null);
  const rect = cropState && cropState.key === geomKey ? cropState.rect : fitAspect(W, H, ratio);
  const setRect = (r: Rect) => setCropState({ key: geomKey, rect: clampRect(r, W, H) });

  const viewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = viewRef.current;
    if (!c || !source) return;
    c.width = source.width;
    c.height = source.height;
    c.getContext("2d")?.drawImage(source, 0, 0);
  }, [source]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; px: number; py: number; start: Rect; scale: number } | null>(null);

  const startDrag = (handle: Handle, e: React.PointerEvent) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle, px: e.clientX, py: e.clientY, start: rect, scale: W / box.width };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setRect(resize(d.start, d.handle, (e.clientX - d.px) * d.scale, (e.clientY - d.py) * d.scale, W, H, ratio));
  };
  const onUp = () => {
    drag.current = null;
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = map[e.key];
    if (!m) return;
    e.preventDefault();
    if (e.altKey) setRect(resize(rect, "se", m[0], m[1], W, H, ratio));
    else setRect({ ...rect, x: rect.x + m[0], y: rect.y + m[1] });
  };

  const setField = (k: keyof Rect, v: string) => {
    const n = parseNum(v);
    if (n === null) return;
    const next = { ...rect, [k]: n };
    if (ratio && k === "w") next.h = n / ratio;
    if (ratio && k === "h") next.w = n * ratio;
    setRect(next);
  };

  const outFormat: OutputFormat = circle && format === "jpeg" ? "png" : (format as OutputFormat);

  const exportCrop = async () => {
    if (!source) return;
    setBusy(true);
    setExportError(null);
    try {
      const { canvas, ctx } = makeCanvas(rect.w, rect.h);
      if (circle) {
        ctx.beginPath();
        ctx.ellipse(rect.w / 2, rect.h / 2, rect.w / 2, rect.h / 2, 0, 0, Math.PI * 2);
        ctx.clip();
      }
      ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      const blob = await encodeCanvas(canvas, outFormat, { quality: quality / 100 });
      downloadBlob(blob, `${file ? baseName(file.name) : "image"}-crop.${FORMAT_INFO[outFormat].ext}`);
    } catch (e) {
      setExportError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const handles: Handle[] = ratio ? ["nw", "ne", "sw", "se"] : ["nw", "ne", "sw", "se", "n", "s", "e", "w"];
  const handlePos: Record<string, string> = {
    nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
    n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
    s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
    e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
    w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Crop an image" actions={file ? <ResetBtn onClick={() => setFile(null)} label="New image" /> : undefined}>
        {!file ? (
          <FileDrop onFiles={(f) => setFile(f[0] ?? null)} accept={IMAGE_ACCEPT} maxSizeMB={60} allowPaste label="Choose an image to crop" />
        ) : (
          <div className="space-y-5">
            <FileChip file={file} />
            {loading && <Spinner label="Reading image" />}
            {error && <Notice tone="error">{error}</Notice>}
            {source && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0 space-y-3">
                  <div className="max-h-[70vh] overflow-auto rounded-xl" style={CHECKER}>
                    <div ref={wrapRef} className="relative touch-none select-none" style={{ width: `${zoom * 100}%` }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                      <canvas ref={viewRef} className="block h-auto w-full" role="img" aria-label="Image being cropped" />
                      <div
                        role="slider"
                        tabIndex={0}
                        aria-label="Crop area. Arrow keys move it, Alt plus arrow keys resize it, Shift moves 10 pixels."
                        aria-valuetext={`${rect.w} by ${rect.h} pixels at ${rect.x}, ${rect.y}`}
                        aria-valuenow={rect.x}
                        aria-valuemin={0}
                        aria-valuemax={W}
                        onKeyDown={onKey}
                        onPointerDown={(e) => startDrag("move", e)}
                        className={`absolute cursor-move outline-none ring-2 ring-white focus-visible:ring-4 focus-visible:ring-[var(--accent)] ${circle ? "rounded-[50%]" : ""}`}
                        style={{
                          left: pct(rect.x, W),
                          top: pct(rect.y, H),
                          width: pct(rect.w, W),
                          height: pct(rect.h, H),
                          boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                        }}
                      >
                        <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                          {Array.from({ length: 9 }, (_, i) => (
                            <span key={i} className="border border-white/30" />
                          ))}
                        </span>
                        {handles.map((h) => (
                          <span
                            key={h}
                            aria-hidden="true"
                            onPointerDown={(e) => startDrag(h, e)}
                            className={`absolute grid h-8 w-8 place-items-center ${handlePos[h]}`}
                          >
                            <span className="h-3.5 w-3.5 rounded-sm border-2 border-white bg-[var(--accent)]" />
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <RangeField label="Zoom" value={zoom} onChange={setZoom} min={1} max={4} step={0.25} format={(v) => `${v}×`} />
                </div>
                <div className="min-w-0 space-y-4">
                  <SelectField label="Aspect ratio" value={aspect} onChange={(e) => setAspect(e.target.value)} options={ASPECTS} />
                  {aspect === "custom" && (
                    <div className="grid grid-cols-2 gap-3">
                      <NumberField label="Ratio width" value={customW} onChange={(e) => setCustomW(e.target.value)} />
                      <NumberField label="Ratio height" value={customH} onChange={(e) => setCustomH(e.target.value)} />
                    </div>
                  )}
                  <fieldset>
                    <legend className="text-sm font-medium text-ink">Crop box (pixels)</legend>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      {(["x", "y", "w", "h"] as const).map((k) => (
                        <NumberField key={`${k}-${rect[k]}`} label={{ x: "Left (X)", y: "Top (Y)", w: "Width", h: "Height" }[k]} defaultValue={String(rect[k])} onBlur={(e) => setField(k, e.target.value)} onKeyDown={(e) => e.key === "Enter" && setField(k, (e.target as HTMLInputElement).value)} />
                      ))}
                    </div>
                    <p className="mt-2 text-[0.8125rem] text-muted">Image is {W} × {H} px. Values apply on Enter or when you leave the field.</p>
                  </fieldset>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="ghost" icon="reset" onClick={() => setRotation((r) => (r + 270) % 360)}>
                      Rotate left
                    </Btn>
                    <Btn variant="ghost" icon="reset" className="[&>svg]:-scale-x-100" onClick={() => setRotation((r) => (r + 90) % 360)}>
                      Rotate right
                    </Btn>
                  </div>
                  <Checkbox label="Circle or ellipse crop" checked={circle} onChange={setCircle} hint="Corners become transparent, so JPG switches to PNG." />
                  <FormatSelect value={outFormat} onChange={setFormat} formats={["png", "jpeg", "webp"]} />
                  {FORMAT_INFO[outFormat].lossy && <RangeField label="Quality" value={quality} onChange={setQuality} min={10} max={100} unit="%" />}
                  <Btn icon="download" disabled={busy} onClick={exportCrop}>
                    {busy ? "Exporting…" : `Download ${rect.w} × ${rect.h} ${FORMAT_INFO[outFormat].label}`}
                  </Btn>
                  {exportError && <Notice tone="error">{exportError}</Notice>}
                </div>
              </div>
            )}
          </div>
        )}
        {!file && (
          <div className="mt-5">
            <EmptyState icon="scissors" title="No image yet">Drag the box or its corners, or type exact pixel values.</EmptyState>
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
