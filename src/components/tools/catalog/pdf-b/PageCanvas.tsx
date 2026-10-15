"use client";

/**
 * Page preview editor shared by the pdf-b tools.
 *
 * Renders one page with pdf.js and lets the user click to place, drag to
 * draw a rectangle or line, and drag/resize existing items. Everything is
 * reported in view space (see lib/geometry.ts): the displayed page, origin
 * top-left, units of PDF points. The writer converts view space to PDF user
 * space, so rotation, CropBox/MediaBox origin and zoom are all handled.
 *
 * Keyboard: items are focusable; arrow keys nudge 1 pt (Shift: 10 pt),
 * Delete removes, Ctrl/Cmd+Z undoes. "Add at page center" places new items
 * without a pointer.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { type PageGeom, type Pt, type Rect, normRotation, viewSize } from "./lib/geometry";
import type { PdfDoc } from "./shared";

export type CreateGeom =
  | { kind: "point"; page: number; x: number; y: number }
  | { kind: "rect"; page: number; x: number; y: number; w: number; h: number }
  | { kind: "line"; page: number; x1: number; y1: number; x2: number; y2: number }
  | { kind: "path"; page: number; points: Pt[] };

export interface OverlayItem {
  id: string;
  page: number;
  box: Rect;
  label: string;
  resizable?: boolean;
  movable?: boolean;
}

export interface ExistingTextSpan extends Rect {
  page: number;
  text: string;
  size: number;
  background: string;
  color: string;
  bold: boolean;
  italic: boolean;
  fontFamily: "sans" | "serif" | "mono";
}

export type CanvasMode = "none" | "existing-text" | "point" | "rect" | "line" | "path";

const docIds = new WeakMap<object, number>();
let nextDocId = 1;
function docIdOf(doc: object) {
  let id = docIds.get(doc);
  if (!id) {
    id = nextDocId++;
    docIds.set(doc, id);
  }
  return `d${id}`;
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const MAX_PIXELS = 16_000_000;

type TextLayerState = {
  key: string;
  loading: boolean;
  spans: Omit<ExistingTextSpan, "background" | "color">[];
  error: string | null;
};

function multiplyPdfMatrices(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function sampleBackground(canvas: HTMLCanvasElement | null, span: Rect, view: { w: number; h: number }) {
  if (!canvas || view.w <= 0 || view.h <= 0) return "#ffffff";
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#ffffff";
  const sx = canvas.width / view.w;
  const sy = canvas.height / view.h;
  const gap = Math.max(2, Math.min(5, span.h * 0.35));
  const points = [
    [span.x - gap, span.y + span.h / 2],
    [span.x + span.w + gap, span.y + span.h / 2],
    [span.x + span.w / 2, span.y - gap],
    [span.x + span.w / 2, span.y + span.h + gap],
    [span.x - gap, span.y - gap],
    [span.x + span.w + gap, span.y - gap],
  ];
  const colors: number[][] = [];
  for (const [x, y] of points) {
    const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x * sx)));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y * sy)));
    const data = ctx.getImageData(px, py, 1, 1).data;
    if (data[3] > 200) colors.push([data[0], data[1], data[2]]);
  }
  if (!colors.length) return "#ffffff";
  const channel = (index: number) => colors.map((color) => color[index]).sort((a, b) => a - b)[Math.floor(colors.length / 2)];
  return `#${[channel(0), channel(1), channel(2)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function rgbHex(rgb: number[]) {
  return `#${rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

/** Samples the most background-contrasting pixels inside a text box. */
function sampleTextColor(
  canvas: HTMLCanvasElement | null,
  span: Rect,
  view: { w: number; h: number },
  background: string,
) {
  if (!canvas || view.w <= 0 || view.h <= 0) return "#111111";
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#111111";
  const bg = background.match(/[\da-f]{2}/gi)?.map((part) => parseInt(part, 16)) ?? [255, 255, 255];
  const sx = canvas.width / view.w;
  const sy = canvas.height / view.h;
  const x = Math.max(0, Math.floor(span.x * sx));
  const y = Math.max(0, Math.floor(span.y * sy));
  const w = Math.max(1, Math.min(canvas.width - x, Math.ceil(span.w * sx)));
  const h = Math.max(1, Math.min(canvas.height - y, Math.ceil(span.h * sy)));
  const data = ctx.getImageData(x, y, w, h).data;
  const candidates: { rgb: number[]; distance: number }[] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 2500)));
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      const index = (py * w + px) * 4;
      if (data[index + 3] < 200) continue;
      const rgb = [data[index], data[index + 1], data[index + 2]];
      const distance = Math.hypot(rgb[0] - bg[0], rgb[1] - bg[1], rgb[2] - bg[2]);
      if (distance > 45) candidates.push({ rgb, distance });
    }
  }
  if (!candidates.length) return "#111111";
  candidates.sort((a, b) => b.distance - a.distance);
  const strongest = candidates.slice(0, Math.max(1, Math.ceil(candidates.length * 0.25)));
  const median = (channel: number) =>
    strongest.map(({ rgb }) => rgb[channel]).sort((a, b) => a - b)[Math.floor(strongest.length / 2)];
  return rgbHex([median(0), median(1), median(2)]);
}

function closestFont(fontName: string, fontFamily: string | undefined) {
  const descriptor = `${fontName} ${fontFamily ?? ""}`.toLowerCase();
  return {
    fontFamily: (/courier|mono|consolas|code/.test(descriptor)
      ? "mono"
      : /times|serif|georgia|garamond/.test(descriptor)
        ? "serif"
        : "sans") as "sans" | "serif" | "mono",
    bold: /bold|black|heavy|semibold|demi/.test(descriptor),
    italic: /italic|oblique/.test(descriptor),
  };
}

type Drag =
  | { type: "create"; start: Pt; cur: Pt; points: Pt[]; pointerId: number }
  | { type: "move"; id: string; start: Pt; cur: Pt; pointerId: number }
  | { type: "resize"; id: string; start: Pt; cur: Pt; pointerId: number };

export function PageCanvas({
  doc,
  page,
  onPageChange,
  mode = "none",
  onCreate,
  items = [],
  selectedId = null,
  onSelect,
  onMove,
  onResize,
  onDelete,
  renderItem,
  onExistingText,
  overlay,
  onUndo,
  canUndo = false,
  onRedo,
  canRedo = false,
  addLabel,
  onGeom,
  label = "PDF page preview",
  rotationOffset = 0,
  onRotate,
  rotateDisabled = false,
}: {
  doc: PdfDoc;
  page: number;
  onPageChange: (n: number) => void;
  mode?: CanvasMode;
  onCreate?: (g: CreateGeom, geom: PageGeom) => void;
  items?: OverlayItem[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, dx: number, dy: number) => void;
  onResize?: (id: string, dw: number, dh: number) => void;
  onDelete?: (id: string) => void;
  renderItem?: (id: string, scale: number) => React.ReactNode;
  onExistingText?: (span: ExistingTextSpan) => void;
  overlay?: (scale: number, geom: PageGeom) => React.ReactNode;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  addLabel?: string;
  onGeom?: (page: number, geom: PageGeom) => void;
  label?: string;
  rotationOffset?: number;
  onRotate?: () => void;
  rotateDisabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, maxH: 800 });
  const [geoms, setGeoms] = useState<Record<string, PageGeom>>({});
  const [zoomIdx, setZoomIdx] = useState(2);
  const [renderedKey, setRenderedKey] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [textLayer, setTextLayer] = useState<TextLayerState>({ key: "", loading: false, spans: [], error: null });
  const numPages = doc.numPages;
  const docKey = docIdOf(doc);
  const geomKey = `${docKey}:${page}:${rotationOffset}`;
  const geom = geoms[geomKey];

  // Track container width (fit-to-width) and viewport height.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, maxH: Math.max(420, Math.round(window.innerHeight * 0.8)) });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Page geometry (visible box and rotation) as pdf.js sees it.
  useEffect(() => {
    let alive = true;
    doc
      .getPage(page)
      .then((p) => {
        if (!alive) return;
        const g: PageGeom = { view: p.view.slice(0, 4) as [number, number, number, number], rotate: normRotation(p.rotate + rotationOffset) };
        setGeoms((m) => ({ ...m, [geomKey]: g }));
        onGeom?.(page, g);
      })
      .catch(() => {
        if (alive) setRenderError("This page could not be read.");
      });
    return () => {
      alive = false;
    };
  }, [doc, geomKey, page, rotationOffset, onGeom]);

  // Build hit targets from the real PDF text layer when the user wants to
  // replace existing text. Coordinates are kept in the same view space as
  // every other editor overlay.
  useEffect(() => {
    if (mode !== "existing-text" || !geom) return;
    let alive = true;
    doc
      .getPage(page)
      .then(async (pdfPage) => {
        const viewport = pdfPage.getViewport({ scale: 1 / (pdfPage.userUnit || 1), rotation: geom.rotate });
        const content = await pdfPage.getTextContent();
        if (!alive) return;
        const spans: Omit<ExistingTextSpan, "background" | "color">[] = [];
        for (const raw of content.items) {
          if (!("str" in raw) || !raw.str.trim()) continue;
          const matrix = multiplyPdfMatrices(viewport.transform, raw.transform);
          const fontHeight = Math.max(4, Math.hypot(matrix[2], matrix[3]));
          const horizontalLength = Math.hypot(matrix[0], matrix[1]) || 1;
          const width = Math.max(3, raw.width * viewport.scale);
          const hx = (matrix[0] / horizontalLength) * width;
          const hy = (matrix[1] / horizontalLength) * width;
          const vx = matrix[2];
          const vy = matrix[3];
          const corners = [
            { x: matrix[4], y: matrix[5] },
            { x: matrix[4] + hx, y: matrix[5] + hy },
            { x: matrix[4] + vx, y: matrix[5] + vy },
            { x: matrix[4] + hx + vx, y: matrix[5] + hy + vy },
          ];
          const xs = corners.map((point) => point.x);
          const ys = corners.map((point) => point.y);
          const style = content.styles[raw.fontName];
          const font = closestFont(raw.fontName, style?.fontFamily);
          spans.push({
            page,
            text: raw.str,
            size: fontHeight,
            x: Math.min(...xs) - 1,
            y: Math.min(...ys) - 1,
            w: Math.max(4, Math.max(...xs) - Math.min(...xs) + 2),
            h: Math.max(4, Math.max(...ys) - Math.min(...ys) + 2),
            ...font,
          });
          if (spans.length >= 2500) break;
        }
        setTextLayer({ key: geomKey, loading: false, spans, error: null });
      })
      .catch(() => {
        if (alive) setTextLayer({ key: geomKey, loading: false, spans: [], error: "Text on this page could not be detected." });
      });
    return () => {
      alive = false;
    };
  }, [doc, geom, geomKey, mode, page]);

  const size = geom ? viewSize(geom) : null;
  const fit = size && box.w > 0 ? Math.min(box.w / size.w, box.maxH / size.h) : 0;
  const scale = fit * ZOOMS[zoomIdx];
  const key = `${docKey}:${page}:${rotationOffset}:${scale.toFixed(4)}`;

  // Render the page off-screen, then copy, so re-renders never flash blank.
  useEffect(() => {
    if (!size || scale <= 0) return;
    let alive = true;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    doc
      .getPage(page)
      .then(async (p) => {
        if (!alive) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let s = scale * dpr;
        if (size.w * s * size.h * s > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS / (size.w * size.h));
        const vp = p.getViewport({ scale: s / (p.userUnit || 1), rotation: geom?.rotate });
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.floor(vp.width));
        off.height = Math.max(1, Math.floor(vp.height));
        const ctx = off.getContext("2d");
        if (!ctx) throw new Error("Canvas is not available in this browser.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, off.width, off.height);
        task = p.render({ canvasContext: ctx, viewport: vp, canvas: off });
        await task.promise;
        if (!alive) return;
        const c = canvasRef.current;
        if (!c) return;
        c.width = off.width;
        c.height = off.height;
        c.getContext("2d")?.drawImage(off, 0, 0);
        setRenderError(null);
        setRenderedKey(key);
      })
      .catch((e: unknown) => {
        const name = (e as { name?: string })?.name;
        if (alive && name !== "RenderingCancelledException") setRenderError("This page could not be rendered.");
      });
    return () => {
      alive = false;
      task?.cancel();
    };
    // size is derived from geom; key captures doc/page/scale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, geom]);

  const toView = useCallback(
    (e: { clientX: number; clientY: number }): Pt => {
      const el = surfaceRef.current;
      if (!el || scale <= 0) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    },
    [scale],
  );

  const pageItems = items.filter((it) => it.page === page);

  function finishDrag(d: Drag) {
    if (!geom) return;
    const dx = d.cur.x - d.start.x;
    const dy = d.cur.y - d.start.y;
    const tiny = Math.abs(dx) < 3 && Math.abs(dy) < 3;
    if (d.type === "move") {
      if (!tiny) onMove?.(d.id, dx, dy);
      return;
    }
    if (d.type === "resize") {
      if (!tiny) onResize?.(d.id, dx, dy);
      return;
    }
    if (!onCreate) return;
    if (mode === "path") {
      if (d.points.length > 1) onCreate({ kind: "path", page, points: d.points }, geom);
    } else if (mode === "point" || tiny) {
      onCreate({ kind: "point", page, x: d.start.x, y: d.start.y }, geom);
    } else if (mode === "rect") {
      onCreate(
        { kind: "rect", page, x: Math.min(d.start.x, d.cur.x), y: Math.min(d.start.y, d.cur.y), w: Math.abs(dx), h: Math.abs(dy) },
        geom,
      );
    } else if (mode === "line") {
      onCreate({ kind: "line", page, x1: d.start.x, y1: d.start.y, x2: d.cur.x, y2: d.cur.y }, geom);
    }
  }

  const onSurfaceDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || mode === "none" || mode === "existing-text" || !geom) return;
    if (e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toView(e);
    onSelect?.(null);
    setDrag({ type: "create", start: p, cur: p, points: [p], pointerId: e.pointerId });
  };

  const onItemDown = (e: React.PointerEvent<HTMLElement>, id: string, type: "move" | "resize") => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const surface = surfaceRef.current;
    surface?.setPointerCapture(e.pointerId);
    onSelect?.(id);
    const p = toView(e);
    setDrag({ type, id, start: p, cur: p, pointerId: e.pointerId });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const point = toView(e);
    setDrag(drag.type === "create" && mode === "path" ? { ...drag, cur: point, points: [...drag.points, point] } : { ...drag, cur: point });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = { ...drag, cur: toView(e) };
    setDrag(null);
    finishDrag(d);
  };

  const onItemKey = (e: React.KeyboardEvent<HTMLElement>, id: string) => {
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      onMove?.(id, moves[e.key][0], moves[e.key][1]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDelete?.(id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(id);
    }
  };

  const addCenter = () => {
    if (!geom || !size || !onCreate) return;
    onCreate({ kind: "point", page, x: size.w / 2, y: size.h / 2 }, geom);
  };

  const ready = renderedKey === key;
  const W = size ? size.w * scale : 0;
  const H = size ? size.h * scale : 0;
  const dragPreview = drag?.type === "create" && mode !== "point" ? drag : null;

  return (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        const modifier = e.ctrlKey || e.metaKey;
        const wantsRedo = modifier && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"));
        if (wantsRedo && onRedo && canRedo) {
          e.preventDefault();
          onRedo();
        } else if (modifier && e.key.toLowerCase() === "z" && onUndo && canUndo) {
          e.preventDefault();
          onUndo();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Page navigation">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-ink-2 hover:bg-sunken disabled:opacity-40"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <Icon name="chevron" size={18} className="rotate-90" />
          </button>
          <label className="flex items-center gap-1.5 text-sm text-ink-2">
            <span className="sr-only">Page number</span>
            <select
              value={page}
              onChange={(e) => onPageChange(Number(e.target.value))}
              className="h-10 rounded-lg bg-surface px-2 text-sm text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]"
            >
              {Array.from({ length: numPages }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <span aria-hidden="true">of {numPages}</span>
          </label>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-ink-2 hover:bg-sunken disabled:opacity-40"
            onClick={() => onPageChange(Math.min(numPages, page + 1))}
            disabled={page >= numPages}
            aria-label="Next page"
          >
            <Icon name="chevron" size={18} className="-rotate-90" />
          </button>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-lg text-ink-2 hover:bg-sunken disabled:opacity-40"
            onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
            disabled={zoomIdx === 0}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="w-12 text-center text-sm tabular-nums text-ink-2" aria-live="polite">
            {Math.round(ZOOMS[zoomIdx] * 100)}%
          </span>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-lg text-ink-2 hover:bg-sunken disabled:opacity-40"
            onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))}
            disabled={zoomIdx === ZOOMS.length - 1}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {onRotate && (
            <Btn
              variant="subtle"
              icon="reset"
              onClick={onRotate}
              disabled={rotateDisabled}
              title={rotateDisabled ? "Remove items from this page before rotating it." : "Rotate this page clockwise"}
            >
              Rotate
            </Btn>
          )}
          {addLabel && onCreate && (
            <Btn variant="ghost" icon="plus" onClick={addCenter} disabled={!geom}>
              {addLabel}
            </Btn>
          )}
          {onUndo && (
            <Btn variant="subtle" icon="reset" onClick={onUndo} disabled={!canUndo}>
              Undo
            </Btn>
          )}
          {onRedo && (
            <Btn variant="subtle" icon="reset" onClick={onRedo} disabled={!canRedo}>
              Redo
            </Btn>
          )}
        </div>
      </div>

      <div ref={wrapRef} className="w-full">
        <div className="max-h-[85vh] overflow-auto rounded-xl bg-sunken p-2 sm:p-4">
          {!geom && !renderError && <div className="grid h-64 place-items-center text-sm text-muted">Loading page…</div>}
          {renderError && <div className="grid h-40 place-items-center text-sm text-danger">{renderError}</div>}
          {geom && size && (
            <div className="relative mx-auto shadow-[0_1px_4px_rgb(0_0_0/0.18)]" style={{ width: W, height: H }}>
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`${label}: page ${page} of ${numPages}`}
                className={`absolute inset-0 h-full w-full bg-white transition-opacity duration-150 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-60"}`}
              />
              {overlay && (
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                  {overlay(scale, geom)}
                </div>
              )}
              <div
                ref={surfaceRef}
                className={`absolute inset-0 ${mode === "existing-text" ? "cursor-text" : mode === "none" ? "" : "cursor-crosshair touch-none"}`}
                onPointerDown={onSurfaceDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDrag(null)}
              >
                {mode === "existing-text" && textLayer.key === geomKey &&
                  textLayer.spans.map((span, index) => (
                    <button
                      key={`${span.text}-${span.x}-${span.y}-${index}`}
                      type="button"
                      title={`Edit: ${span.text}`}
                      aria-label={`Edit existing text: ${span.text}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => {
                        if (size) {
                          const background = sampleBackground(canvasRef.current, span, size);
                          onExistingText?.({
                            ...span,
                            background,
                            color: sampleTextColor(canvasRef.current, span, size, background),
                          });
                        }
                      }}
                      className="absolute border border-transparent bg-transparent hover:border-accent hover:bg-accent/10 focus-visible:border-accent focus-visible:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      style={{ left: span.x * scale, top: span.y * scale, width: Math.max(8, span.w * scale), height: Math.max(8, span.h * scale) }}
                    />
                  ))}
                {pageItems.map((it) => {
                  const moving = drag && drag.type === "move" && drag.id === it.id ? drag : null;
                  const resizing = drag && drag.type === "resize" && drag.id === it.id ? drag : null;
                  const dx = moving ? moving.cur.x - moving.start.x : 0;
                  const dy = moving ? moving.cur.y - moving.start.y : 0;
                  const dw = resizing ? resizing.cur.x - resizing.start.x : 0;
                  const dh = resizing ? resizing.cur.y - resizing.start.y : 0;
                  const selected = it.id === selectedId;
                  return (
                    <div
                      key={it.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${it.label}. ${it.movable === false ? "Delete removes." : "Arrow keys move, Delete removes."}`}
                      aria-pressed={selected}
                      onPointerDown={(e) => {
                        if (it.movable === false) {
                          e.stopPropagation();
                          onSelect?.(it.id);
                        } else onItemDown(e, it.id, "move");
                      }}
                      onKeyDown={(e) => (it.movable === false && e.key.startsWith("Arrow") ? undefined : onItemKey(e, it.id))}
                      onFocus={() => onSelect?.(it.id)}
                      className={`absolute ${it.movable === false ? "cursor-pointer" : "cursor-move touch-none"} outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        selected ? "ring-2 ring-accent ring-offset-1" : "hover:ring-1 hover:ring-accent/60"
                      }`}
                      style={{
                        left: (it.box.x + dx) * scale,
                        top: (it.box.y + dy) * scale,
                        width: Math.max(8, (it.box.w + dw) * scale),
                        height: Math.max(8, (it.box.h + dh) * scale),
                      }}
                    >
                      {renderItem?.(it.id, scale)}
                      {selected && it.resizable && onResize && (
                        <span
                          aria-hidden="true"
                          onPointerDown={(e) => onItemDown(e, it.id, "resize")}
                          className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-accent shadow"
                        />
                      )}
                    </div>
                  );
                })}
                {dragPreview && (
                  <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                    {mode === "path" ? (
                      <polyline
                        points={dragPreview.points.map((point) => `${point.x * scale},${point.y * scale}`).join(" ")}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : mode === "rect" ? (
                      <rect
                        x={Math.min(dragPreview.start.x, dragPreview.cur.x) * scale}
                        y={Math.min(dragPreview.start.y, dragPreview.cur.y) * scale}
                        width={Math.abs(dragPreview.cur.x - dragPreview.start.x) * scale}
                        height={Math.abs(dragPreview.cur.y - dragPreview.start.y) * scale}
                        fill="color-mix(in oklch, var(--accent) 15%, transparent)"
                        stroke="var(--accent)"
                        strokeDasharray="4 3"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <line
                        x1={dragPreview.start.x * scale}
                        y1={dragPreview.start.y * scale}
                        x2={dragPreview.cur.x * scale}
                        y2={dragPreview.cur.y * scale}
                        stroke="var(--accent)"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                      />
                    )}
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {geom && mode === "existing-text" && (
        <div className="text-[0.8125rem] text-muted" aria-live="polite">
          {textLayer.key !== geomKey || textLayer.loading ? (
            <p>Detecting editable text on this page...</p>
          ) : textLayer.error ? (
            <p className="text-danger">{textLayer.error}</p>
          ) : textLayer.spans.length === 0 ? (
            <p>
              No selectable text was found. This page may be a scan, so its existing words cannot be edited here. To recover the wording, first use <Link className="link" href="/tools/pdf-to-image">PDF to image</Link>, then <Link className="link" href="/tools/image-to-text-ocr">Image to text (OCR)</Link>. OCR does not rebuild the original layout; use Add text for a visual overlay.
            </p>
          ) : (
            <p>{textLayer.spans.length} selectable text section{textLayer.spans.length === 1 ? "" : "s"} found. Click one to replace it.</p>
          )}
        </div>
      )}
      {geom && size && (
        <p className="text-[0.8125rem] text-muted">
          Page {page}: {Math.round(size.w)} × {Math.round(size.h)} pt
          {geom.rotate ? `, rotated ${geom.rotate}°` : ""}. Positions are in points from the top-left corner of the visible page.
        </p>
      )}
    </div>
  );
}
