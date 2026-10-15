"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, EmptyState, Notice, NumberField, PrivacyNote, ResetBtn, SelectField, ToolPanel, fmt, parseNum } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, canvasToBlob, downloadBlob } from "@/components/tools/engines/files";
import { ColorField, RangeField, errMsg, useDecodedImage } from "./shared";
import { PHOTO_PRESETS, headGuide, mmToPx, tileSheet, type PhotoPreset } from "./lib/geometry";
import { writeDensity } from "./lib/metadata";
import { makeCanvas } from "./lib/pipeline";

const DPI = 300;
type View = { zoom: number; ox: number; oy: number };
const START: View = { zoom: 1, ox: 0, oy: 0 };

function render(bmp: ImageBitmap, W: number, H: number, v: View, bg: string) {
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const s = Math.max(W / bmp.width, H / bmp.height) * v.zoom;
  ctx.translate(W / 2 + v.ox * W, H / 2 + v.oy * H);
  ctx.scale(s, s);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  return canvas;
}

async function jpegAt300(c: HTMLCanvasElement) {
  const blob = await canvasToBlob(c, "image/jpeg", 0.95);
  const out = writeDensity(new Uint8Array(await blob.arrayBuffer()), DPI);
  return new Blob([out as BlobPart], { type: "image/jpeg" });
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const { bitmap, error, loading } = useDecodedImage(file);
  const [presetId, setPresetId] = useState("us");
  const [custom, setCustom] = useState({ w: "35", h: "45", min: "32", max: "36" });
  const [bg, setBg] = useState("#ffffff");
  const [viewState, setViewState] = useState<{ file: File | null; v: View }>({ file: null, v: START });
  const [busy, setBusy] = useState(false);
  const [outError, setOutError] = useState<string | null>(null);
  const v = viewState.file === file ? viewState.v : START;
  const setV = (fn: (v: View) => View) => setViewState((s) => ({ file, v: fn(s.file === file ? s.v : START) }));

  let preset: PhotoPreset | null = PHOTO_PRESETS.find((p) => p.id === presetId) ?? null;
  let customErr: string | null = null;
  if (presetId === "custom") {
    const [w, h, mn, mx] = [custom.w, custom.h, custom.min, custom.max].map(parseNum);
    if (!w || !h || w < 10 || h < 10 || w > 200 || h > 200) customErr = "Width and height must be between 10 and 200 mm.";
    else if (!mn || !mx || mn > mx || mx >= h) customErr = "Head height range must be positive, min ≤ max, and smaller than the photo height.";
    else preset = { id: "custom", label: "Custom", widthMm: w, heightMm: h, headMinMm: mn, headMaxMm: mx, note: "" };
  }
  const W = preset ? mmToPx(preset.widthMm, DPI) : 600;
  const H = preset ? mmToPx(preset.heightMm, DPI) : 600;
  const guide = preset ? headGuide(preset) : null;

  const viewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = viewRef.current;
    if (!c || !bitmap) return;
    const out = render(bitmap, W, H, v, bg);
    c.width = W;
    c.height = H;
    c.getContext("2d")?.drawImage(out, 0, 0);
  }, [bitmap, W, H, v, bg]);

  const drag = useRef<{ x: number; y: number; start: View; w: number; h: number } | null>(null);
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.02 : 0.005;
    const m: Record<string, (x: View) => View> = {
      ArrowLeft: (x) => ({ ...x, ox: x.ox - step }),
      ArrowRight: (x) => ({ ...x, ox: x.ox + step }),
      ArrowUp: (x) => ({ ...x, oy: x.oy - step }),
      ArrowDown: (x) => ({ ...x, oy: x.oy + step }),
      "+": (x) => ({ ...x, zoom: Math.min(6, x.zoom * 1.03) }),
      "=": (x) => ({ ...x, zoom: Math.min(6, x.zoom * 1.03) }),
      "-": (x) => ({ ...x, zoom: Math.max(0.3, x.zoom / 1.03) }),
    };
    const f = m[e.key];
    if (f) {
      e.preventDefault();
      setV(f);
    }
  };

  const download = async (kind: "single" | "sheet") => {
    if (!bitmap || !preset) return;
    setBusy(true);
    setOutError(null);
    try {
      const photo = render(bitmap, W, H, v, bg);
      if (kind === "single") {
        downloadBlob(await jpegAt300(photo), `${preset.id}-photo-${W}x${H}.jpg`);
      } else {
        const layout = tileSheet(6 * DPI, 4 * DPI, W, H, Math.round(DPI * 0.08));
        if (!layout.cells.length) throw new Error("This photo size does not fit on a 4 × 6 in sheet.");
        const { canvas, ctx } = makeCanvas(layout.width, layout.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, layout.width, layout.height);
        for (const c of layout.cells) {
          ctx.drawImage(photo, c.x, c.y);
          ctx.strokeStyle = "#bbbbbb";
          ctx.lineWidth = 1;
          ctx.strokeRect(c.x - 0.5, c.y - 0.5, W + 1, H + 1);
        }
        downloadBlob(await jpegAt300(canvas), `${preset.id}-print-sheet-4x6in-${layout.cells.length}up.jpg`);
      }
    } catch (e) {
      setOutError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const sheetCount = preset ? tileSheet(6 * DPI, 4 * DPI, W, H, Math.round(DPI * 0.08)).cells.length : 0;

  return (
    <div className="space-y-5">
      <ToolPanel title="Passport and ID photo" actions={file ? <ResetBtn onClick={() => setFile(null)} label="New photo" /> : undefined}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            {!file ? (
              <>
                <FileDrop onFiles={(f) => setFile(f[0] ?? null)} accept="image/*,.heic,.heif" maxSizeMB={40} label="Choose a portrait photo" hint="Face the camera, even light, plain light background." />
                <EmptyState icon="image" title="No photo yet">Pick a size preset, position your head inside the guides, then download a single photo or a 4 × 6 in print sheet.</EmptyState>
              </>
            ) : (
              <>
                <FileChip file={file} />
                {loading && <Spinner label="Reading photo" />}
                {error && <Notice tone="error">{error}</Notice>}
                {bitmap && preset && guide && (
                  <div className="mx-auto w-full max-w-[360px]">
                    <div
                      className="relative cursor-grab touch-none select-none overflow-hidden rounded-lg outline-none ring-1 ring-line focus-visible:ring-4 focus-visible:ring-[var(--accent)] active:cursor-grabbing"
                      tabIndex={0}
                      role="application"
                      aria-label="Photo position. Drag, or use arrow keys to move and plus or minus to zoom."
                      onKeyDown={onKey}
                      onPointerDown={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        drag.current = { x: e.clientX, y: e.clientY, start: v, w: r.width, h: r.height };
                      }}
                      onPointerMove={(e) => {
                        const d = drag.current;
                        if (!d) return;
                        setV(() => ({ ...d.start, ox: d.start.ox + (e.clientX - d.x) / d.w, oy: d.start.oy + (e.clientY - d.y) / d.h }));
                      }}
                      onPointerUp={() => {
                        drag.current = null;
                      }}
                    >
                      <canvas ref={viewRef} className="block h-auto w-full" role="img" aria-label={`${preset.label} photo preview`} />
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                        <rect x="0" y={guide.chinMin * 100} width="100" height={(guide.chinMax - guide.chinMin) * 100} fill="rgba(16,185,129,0.18)" />
                        <line x1="0" x2="100" y1={guide.crown * 100} y2={guide.crown * 100} stroke="#e5383b" strokeWidth="0.6" vectorEffect="non-scaling-stroke" strokeDasharray="3 2" />
                        <line x1="0" x2="100" y1={guide.chinMin * 100} y2={guide.chinMin * 100} stroke="#10b981" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <line x1="0" x2="100" y1={guide.chinMax * 100} y2={guide.chinMax * 100} stroke="#10b981" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <line x1="50" x2="50" y1="0" y2="100" stroke="#ffffff" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2 3" />
                      </svg>
                    </div>
                    <p className="mt-2 text-[0.8125rem] text-ink-2">
                      Put the top of the head on the dashed red line and the chin inside the green band ({fmt(preset.headMinMm, 1)} to {fmt(preset.headMaxMm, 1)} mm head height). Center the face on the vertical line.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            <SelectField label="Document size" value={presetId} onChange={(e) => setPresetId(e.target.value)} options={[...PHOTO_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Custom size" }]} />
            {presetId === "custom" ? (
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Width (mm)" value={custom.w} onChange={(e) => setCustom({ ...custom, w: e.target.value })} />
                <NumberField label="Height (mm)" value={custom.h} onChange={(e) => setCustom({ ...custom, h: e.target.value })} />
                <NumberField label="Head min (mm)" value={custom.min} onChange={(e) => setCustom({ ...custom, min: e.target.value })} />
                <NumberField label="Head max (mm)" value={custom.max} onChange={(e) => setCustom({ ...custom, max: e.target.value })} />
                {customErr && <p className="col-span-2 text-sm text-danger" role="alert">{customErr}</p>}
              </div>
            ) : (
              preset && <p className="text-sm text-ink-2">{preset.note}</p>
            )}
            <p className="text-sm text-ink-2">
              Output: {W} × {H} px at {DPI} DPI.
            </p>
            {bitmap && (
              <>
                <RangeField label="Zoom" value={Math.round(v.zoom * 100)} onChange={(z) => setV((x) => ({ ...x, zoom: z / 100 }))} min={30} max={600} unit="%" />
                <div className="grid grid-cols-4 gap-2" role="group" aria-label="Move photo">
                  <Btn variant="ghost" aria-label="Move left" onClick={() => setV((x) => ({ ...x, ox: x.ox - 0.01 }))}>←</Btn>
                  <Btn variant="ghost" aria-label="Move up" onClick={() => setV((x) => ({ ...x, oy: x.oy - 0.01 }))}>↑</Btn>
                  <Btn variant="ghost" aria-label="Move down" onClick={() => setV((x) => ({ ...x, oy: x.oy + 0.01 }))}>↓</Btn>
                  <Btn variant="ghost" aria-label="Move right" onClick={() => setV((x) => ({ ...x, ox: x.ox + 0.01 }))}>→</Btn>
                </div>
                <Btn variant="subtle" icon="reset" onClick={() => setV(() => START)}>
                  Reset position
                </Btn>
              </>
            )}
            <ColorField label="Fill color for empty areas" value={bg} onChange={setBg} hint="Shows where the photo does not cover the frame. It does not replace the existing background." />
            <div className="flex flex-wrap gap-2">
              <Btn icon="download" disabled={!bitmap || !preset || busy} onClick={() => download("single")}>
                Photo (JPG)
              </Btn>
              <Btn variant="ghost" icon="download" disabled={!bitmap || !preset || busy} onClick={() => download("sheet")}>
                4 × 6 in sheet ({sheetCount} photos)
              </Btn>
            </div>
            {outError && <Notice tone="error">{outError}</Notice>}
            <Notice tone="warning">
              This tool sizes and frames the photo; it does not check compliance (expression, glasses, lighting, background). Rules change, so confirm the current requirements with the issuing authority. Start with a photo taken against a plain, evenly lit background.
            </Notice>
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
