"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, NumberField, PrivacyNote, ResetBtn, ToolPanel, parseNum, uid } from "@/components/tools/kit";
import { FileDrop, Spinner, baseName, canvasToBlob, downloadBlob } from "@/components/tools/engines/files";
import { ColorField, RangeField, errMsg, useDecodedImage } from "./shared";
import { blurSync, pixelate } from "./lib/filters";
import { makeCanvas } from "./lib/pipeline";

type Tool = "arrow" | "rect" | "text" | "marker" | "blur" | "pixelate";
type Base = { id: string; color: string; size: number };
type Ann =
  | (Base & { t: "arrow"; x1: number; y1: number; x2: number; y2: number })
  | (Base & { t: "rect" | "blur" | "pixelate"; x: number; y: number; w: number; h: number })
  | (Base & { t: "text"; x: number; y: number; text: string; bg: boolean })
  | (Base & { t: "marker"; x: number; y: number; n: number });

const TOOLS: { value: Tool; label: string; key: string }[] = [
  { value: "arrow", label: "Arrow", key: "a" },
  { value: "rect", label: "Rectangle", key: "r" },
  { value: "text", label: "Text", key: "t" },
  { value: "marker", label: "Number", key: "n" },
  { value: "blur", label: "Blur", key: "b" },
  { value: "pixelate", label: "Pixelate", key: "p" },
];

const isBox = (a: Ann): a is Extract<Ann, { w: number }> => a.t === "rect" || a.t === "blur" || a.t === "pixelate";
const norm = (x1: number, y1: number, x2: number, y2: number) => ({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });

/** Base image with blur/pixelate regions applied (in creation order). */
function redact(bmp: ImageBitmap, anns: Ann[]) {
  const { canvas, ctx } = makeCanvas(bmp.width, bmp.height);
  ctx.drawImage(bmp, 0, 0);
  for (const a of anns) {
    if (a.t !== "blur" && a.t !== "pixelate") continue;
    const x = Math.max(0, Math.round(a.x));
    const y = Math.max(0, Math.round(a.y));
    const w = Math.min(bmp.width - x, Math.round(a.w));
    const h = Math.min(bmp.height - y, Math.round(a.h));
    if (w < 1 || h < 1) continue;
    const d = ctx.getImageData(x, y, w, h);
    if (a.t === "blur") {
      // Two rounds of a strong blur so text becomes unreadable.
      let data = blurSync({ width: w, height: h, data: d.data }, a.size * 2);
      data = blurSync({ width: w, height: h, data }, a.size * 2);
      d.data.set(data);
    } else pixelate({ width: w, height: h, data: d.data }, Math.max(4, a.size * 3));
    ctx.putImageData(d, x, y);
  }
  return canvas;
}

function drawShape(ctx: CanvasRenderingContext2D, a: Ann, draft = false) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = a.size;
  if (a.t === "arrow") {
    const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const head = Math.max(10, a.size * 4);
    const bx = a.x2 - head * 0.8 * Math.cos(ang);
    const by = a.y2 - head * 0.8 * Math.sin(ang);
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(a.x2 - head * Math.cos(ang - 0.45), a.y2 - head * Math.sin(ang - 0.45));
    ctx.lineTo(a.x2 - head * Math.cos(ang + 0.45), a.y2 - head * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fill();
  } else if (a.t === "rect") {
    ctx.strokeRect(a.x, a.y, a.w, a.h);
  } else if ((a.t === "blur" || a.t === "pixelate") && draft) {
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(a.x, a.y, a.w, a.h);
    ctx.strokeStyle = "#000000";
    ctx.lineDashOffset = 7;
    ctx.strokeRect(a.x, a.y, a.w, a.h);
  } else if (a.t === "marker") {
    const r = Math.max(10, a.size * 2.8);
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(2, r / 6);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${r * 1.1}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(a.n), a.x, a.y + r * 0.05);
  } else if (a.t === "text") {
    const fs = Math.max(12, a.size * 5);
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    const lines = a.text.split("\n");
    const lh = fs * 1.25;
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (a.bg) {
      const pad = fs * 0.35;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.rect(a.x - pad, a.y - pad, w + pad * 2, lh * lines.length + pad * 1.4);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.lineWidth = Math.max(2, fs / 7);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      lines.forEach((l, i) => ctx.strokeText(l, a.x, a.y + i * lh));
    }
    lines.forEach((l, i) => ctx.fillText(l, a.x, a.y + i * lh));
  }
  ctx.restore();
}

function describe(a: Ann) {
  const r = Math.round;
  if (a.t === "arrow") return `Arrow from ${r(a.x1)},${r(a.y1)} to ${r(a.x2)},${r(a.y2)}`;
  if (a.t === "text") return `Text "${a.text.slice(0, 30)}" at ${r(a.x)},${r(a.y)}`;
  if (a.t === "marker") return `Marker ${a.n} at ${r(a.x)},${r(a.y)}`;
  const name = a.t === "rect" ? "Rectangle" : a.t === "blur" ? "Blur" : "Pixelate";
  return `${name} ${r(a.w)} × ${r(a.h)} at ${r(a.x)},${r(a.y)}`;
}

type History = { past: Ann[][]; present: Ann[]; future: Ann[][] };
const EMPTY: History = { past: [], present: [], future: [] };
const undoH = (h: History): History => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
const redoH = (h: History): History => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const { bitmap, error, loading } = useDecodedImage(file);
  const [hist, setHist] = useState<History>(EMPTY);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState("#e5383b");
  const [size, setSize] = useState(6);
  const [text, setText] = useState("");
  const [textBg, setTextBg] = useState(true);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Ann | null>(null);
  const [coords, setCoords] = useState({ x1: "40", y1: "40", x2: "240", y2: "160" });
  const [exportError, setExportError] = useState<string | null>(null);
  const anns = hist.present;

  const commit = (next: Ann[]) => setHist((h) => ({ past: [...h.past, h.present].slice(-100), present: next, future: [] }));
  const add = (a: Ann) => commit([...anns, a]);
  const undo = () => setHist(undoH);
  const redo = () => setHist(redoH);
  const nextMarker = anns.filter((a) => a.t === "marker").length + 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setHist(e.shiftKey ? redoH : undoH);
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        setHist(redoH);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const redactions = useMemo(() => anns.filter((a) => a.t === "blur" || a.t === "pixelate"), [anns]);
  const base = useMemo(() => (bitmap ? redact(bitmap, redactions) : null), [bitmap, redactions]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !base) return;
    c.width = base.width;
    c.height = base.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(base, 0, 0);
    for (const a of anns) if (a.t !== "blur" && a.t !== "pixelate") drawShape(ctx, a);
    if (draft) drawShape(ctx, draft, true);
    if (pending) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(pending.x - 6, pending.y - 6, 12, 12);
      ctx.restore();
    }
  }, [base, anns, draft, pending, color]);

  const start = useRef<{ x: number; y: number } | null>(null);
  const toImage = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * e.currentTarget.width) / r.width, y: ((e.clientY - r.top) * e.currentTarget.height) / r.height };
  };
  const scaleSize = bitmap ? Math.max(1, Math.round((size * Math.min(bitmap.width, bitmap.height)) / 800)) : size;
  const make = (x1: number, y1: number, x2: number, y2: number): Ann | null => {
    const b = { id: uid(), color, size: scaleSize };
    if (tool === "arrow") return Math.hypot(x2 - x1, y2 - y1) < 4 ? null : { ...b, t: "arrow", x1, y1, x2, y2 };
    if (tool === "rect" || tool === "blur" || tool === "pixelate") {
      const n = norm(x1, y1, x2, y2);
      return n.w < 3 || n.h < 3 ? null : { ...b, t: tool, ...n };
    }
    return null;
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toImage(e);
    if (tool === "marker") return add({ id: uid(), color, size: scaleSize, t: "marker", x: p.x, y: p.y, n: nextMarker });
    if (tool === "text") {
      setPending(p);
      document.getElementById("annot-text")?.focus();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = p;
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = start.current;
    if (!s) return;
    const p = toImage(e);
    setDraft(make(s.x, s.y, p.x, p.y));
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = start.current;
    start.current = null;
    setDraft(null);
    if (!s) return;
    const p = toImage(e);
    const a = make(s.x, s.y, p.x, p.y);
    if (a) add(a);
  };

  const placeText = () => {
    if (!text.trim()) return;
    const x = pending?.x ?? parseNum(coords.x1) ?? 20;
    const y = pending?.y ?? parseNum(coords.y1) ?? 20;
    add({ id: uid(), color, size: scaleSize, t: "text", x, y, text: text.trim(), bg: textBg });
    setPending(null);
    setText("");
  };

  const addByCoords = () => {
    const [x1, y1, x2, y2] = [coords.x1, coords.y1, coords.x2, coords.y2].map((v) => parseNum(v));
    if (x1 === null || y1 === null) return;
    if (tool === "marker") return add({ id: uid(), color, size: scaleSize, t: "marker", x: x1, y: y1, n: nextMarker });
    if (tool === "text") return placeText();
    if (x2 === null || y2 === null) return;
    const a = make(x1, y1, x2, y2);
    if (a) add(a);
  };

  const exportPng = async () => {
    setExportError(null);
    try {
      if (!base) return;
      const { canvas, ctx } = makeCanvas(base.width, base.height);
      ctx.drawImage(base, 0, 0);
      for (const a of anns) if (!isBox(a) || a.t === "rect") drawShape(ctx, a);
      downloadBlob(await canvasToBlob(canvas, "image/png"), `${file ? baseName(file.name) : "screenshot"}-annotated.png`);
    } catch (e) {
      setExportError(errMsg(e));
    }
  };

  const twoPoint = tool === "arrow" || tool === "rect" || tool === "blur" || tool === "pixelate";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Annotate a screenshot"
        actions={
          file ? (
            <ResetBtn
              onClick={() => {
                setFile(null);
                setHist(EMPTY);
                setPending(null);
              }}
              label="New image"
            />
          ) : undefined
        }
      >
        {!file ? (
          <div className="space-y-5">
            <FileDrop onFiles={(f) => setFile(f[0] ?? null)} accept="image/*" maxSizeMB={40} allowPaste label="Choose a screenshot or paste it" hint="Press Ctrl+V or Cmd+V to paste a screenshot from the clipboard." />
            <EmptyState icon="pen" title="No screenshot yet">Add arrows, boxes, text and numbered steps, and blur anything private before sharing.</EmptyState>
          </div>
        ) : (
          <div className="space-y-4">
            {loading && <Spinner label="Reading image" />}
            {error && <Notice tone="error">{error}</Notice>}
            {bitmap && (
              <>
                <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Annotation tools">
                  {TOOLS.map((t) => (
                    <Btn key={t.value} variant={tool === t.value ? "primary" : "ghost"} aria-pressed={tool === t.value} onClick={() => setTool(t.value)}>
                      {t.label}
                    </Btn>
                  ))}
                  <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
                  <Btn variant="ghost" icon="reset" disabled={!hist.past.length} onClick={undo} aria-keyshortcuts="Control+Z">
                    Undo
                  </Btn>
                  <Btn variant="ghost" disabled={!hist.future.length} onClick={redo} aria-keyshortcuts="Control+Y">
                    Redo
                  </Btn>
                  <Btn icon="download" onClick={exportPng}>
                    Export PNG
                  </Btn>
                </div>
                {exportError && <Notice tone="error">{exportError}</Notice>}
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="min-w-0">
                    <div className="max-h-[75vh] overflow-auto rounded-xl bg-sunken p-2">
                      <canvas
                        ref={canvasRef}
                        onPointerDown={onDown}
                        onPointerMove={onMove}
                        onPointerUp={onUp}
                        onPointerCancel={() => {
                          start.current = null;
                          setDraft(null);
                        }}
                        className="block h-auto w-full touch-none cursor-crosshair"
                        role="img"
                        aria-label={`Screenshot with ${anns.length} annotation${anns.length === 1 ? "" : "s"}`}
                      />
                    </div>
                    <p className="mt-2 text-[0.8125rem] text-muted">
                      {tool === "text"
                        ? "Click where the text should go, type it, then press Add text."
                        : tool === "marker"
                          ? `Click to place marker ${nextMarker}.`
                          : "Drag on the image to draw."}{" "}
                      Image is {bitmap.width} × {bitmap.height} px.
                    </p>
                  </div>
                  <div className="min-w-0 space-y-4">
                    <ColorField label="Color" value={color} onChange={setColor} />
                    <RangeField label="Size" value={size} onChange={setSize} min={1} max={20} hint="Line width, text size and blur strength." />
                    {tool === "text" && (
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="annot-text" className="text-sm font-medium text-ink">
                            Text
                          </label>
                          <textarea
                            id="annot-text"
                            rows={2}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="mt-2 block w-full rounded-lg bg-surface px-3 py-2 text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none"
                          />
                        </div>
                        <Checkbox label="Solid label background" checked={textBg} onChange={setTextBg} />
                        <Btn icon="plus" disabled={!text.trim()} onClick={placeText}>
                          Add text{pending ? ` at ${Math.round(pending.x)}, ${Math.round(pending.y)}` : ""}
                        </Btn>
                      </div>
                    )}
                    <details className="rounded-lg bg-sunken p-3">
                      <summary className="cursor-pointer text-sm font-medium text-ink">Add with coordinates (keyboard)</summary>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <NumberField label="X" value={coords.x1} onChange={(e) => setCoords({ ...coords, x1: e.target.value })} />
                        <NumberField label="Y" value={coords.y1} onChange={(e) => setCoords({ ...coords, y1: e.target.value })} />
                        {twoPoint && (
                          <>
                            <NumberField label="End X" value={coords.x2} onChange={(e) => setCoords({ ...coords, x2: e.target.value })} />
                            <NumberField label="End Y" value={coords.y2} onChange={(e) => setCoords({ ...coords, y2: e.target.value })} />
                          </>
                        )}
                      </div>
                      <Btn className="mt-3" variant="ghost" icon="plus" onClick={addByCoords}>
                        Add {TOOLS.find((t) => t.value === tool)?.label.toLowerCase()}
                      </Btn>
                    </details>
                    {anns.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-ink">Annotations</p>
                        <ul className="mt-2 space-y-1">
                          {anns.map((a) => (
                            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-sunken px-2 py-1 text-sm">
                              <span className="min-w-0 truncate">{describe(a)}</span>
                              <button
                                type="button"
                                className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink"
                                onClick={() => commit(anns.filter((x) => x.id !== a.id))}
                              >
                                <span aria-hidden="true">×</span>
                                <span className="sr-only">Remove {describe(a)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-[0.8125rem] text-muted">Blur and pixelate permanently replace those pixels in the exported PNG, so the hidden content cannot be recovered from the file.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
