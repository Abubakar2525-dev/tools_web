/**
 * Layered canvas scene used by the banner, thumbnail and Open Graph editors.
 * All coordinates are in output pixels; positions are fractions of the canvas.
 */

import { uid } from "@/components/tools/kit";
import { fitRect, gradientLine, wrapText, type Rect } from "../lib/geometry";
import type { SafeZone } from "../lib/platforms";

export type FontKey = "sans" | "display" | "serif" | "condensed" | "rounded" | "mono";

export const FONTS: Record<FontKey, { label: string; stack: string; cssVar?: string }> = {
  sans: { label: "Sans (site)", stack: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif', cssVar: "--font-geist" },
  display: { label: "Display (site)", stack: '"Arial Black", system-ui, sans-serif', cssVar: "--font-bricolage" },
  serif: { label: "Serif", stack: 'Georgia, "Times New Roman", Times, serif' },
  condensed: { label: "Condensed bold", stack: 'Impact, Haettenschweiler, "Arial Narrow", "Franklin Gothic Bold", sans-serif' },
  rounded: { label: "Rounded", stack: '"Arial Rounded MT Bold", "Nunito", "Varela Round", system-ui, sans-serif' },
  mono: { label: "Monospace", stack: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' },
};

const resolved = new Map<FontKey, string>();

/** Resolves the site's next/font families at runtime, falling back to system stacks. */
export function fontStack(key: FontKey): string {
  const hit = resolved.get(key);
  if (hit) return hit;
  const f = FONTS[key];
  let stack = f.stack;
  if (f.cssVar && typeof document !== "undefined") {
    const v = getComputedStyle(document.body).getPropertyValue(f.cssVar).trim();
    if (v) stack = `${v}, ${f.stack}`;
    resolved.set(key, stack);
  }
  return stack;
}

export interface TextLayer {
  id: string;
  kind: "text";
  name: string;
  text: string;
  /** Anchor x (by alignment) and vertical center, as fractions of the canvas. */
  x: number;
  y: number;
  align: "left" | "center" | "right";
  font: FontKey;
  size: number;
  weight: number;
  italic: boolean;
  upper: boolean;
  color: string;
  lineHeight: number;
  /** Max text width as a fraction of the canvas width. */
  maxWidth: number;
  outline: number;
  outlineColor: string;
  shadow: number;
  shadowColor: string;
  badge: boolean;
  badgeColor: string;
  badgePad: number;
  badgeRadius: number;
  opacity: number;
}

export interface ImageLayer {
  id: string;
  kind: "image";
  name: string;
  bitmap: ImageBitmap;
  /** Center position as fractions of the canvas. */
  x: number;
  y: number;
  /** Width as a fraction of the canvas width. */
  w: number;
  opacity: number;
  radius: number;
  circle: boolean;
  border: number;
  borderColor: string;
  shadow: number;
}

export type Layer = TextLayer | ImageLayer;

export interface Background {
  mode: "color" | "gradient" | "image";
  color: string;
  color2: string;
  angle: number;
  image: ImageBitmap | null;
  imageName: string;
  fit: "cover" | "contain";
  zoom: number;
  focusX: number;
  focusY: number;
  blur: number;
  darken: number;
}

export interface Scene {
  bg: Background;
  layers: Layer[];
}

export const defaultBackground = (over: Partial<Background> = {}): Background => ({
  mode: "gradient",
  color: "#111827",
  color2: "#4338ca",
  angle: 135,
  image: null,
  imageName: "",
  fit: "cover",
  zoom: 1,
  focusX: 0.5,
  focusY: 0.5,
  blur: 0,
  darken: 0,
  ...over,
});

export function textLayer(over: Partial<TextLayer> = {}): TextLayer {
  return {
    id: uid(),
    kind: "text",
    name: "Text",
    text: "Your headline",
    x: 0.5,
    y: 0.5,
    align: "center",
    font: "display",
    size: 72,
    weight: 800,
    italic: false,
    upper: false,
    color: "#ffffff",
    lineHeight: 1.1,
    maxWidth: 0.8,
    outline: 0,
    outlineColor: "#000000",
    shadow: 0,
    shadowColor: "#000000",
    badge: false,
    badgeColor: "#ef4444",
    badgePad: 16,
    badgeRadius: 10,
    opacity: 1,
    ...over,
  };
}

export function imageLayer(bitmap: ImageBitmap, name: string, over: Partial<ImageLayer> = {}): ImageLayer {
  return {
    id: uid(),
    kind: "image",
    name,
    bitmap,
    x: 0.5,
    y: 0.5,
    w: 0.25,
    opacity: 1,
    radius: 0,
    circle: false,
    border: 0,
    borderColor: "#ffffff",
    shadow: 0,
    ...over,
  };
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

type Ctx = CanvasRenderingContext2D;

const supportsFilter = (ctx: Ctx) => typeof ctx.filter === "string";

/** Draws an image with a Gaussian blur, using ctx.filter or a downscale fallback. */
export function drawBlurred(ctx: Ctx, img: CanvasImageSource, iw: number, ih: number, r: Rect, blur: number) {
  if (blur <= 0) {
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    return;
  }
  // grow the rect so blurred edges don't fade to transparent
  const g = blur * 2;
  const rr = { x: r.x - g, y: r.y - g, w: r.w + g * 2, h: r.h + g * 2 };
  if (supportsFilter(ctx)) {
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(img, rr.x, rr.y, rr.w, rr.h);
    ctx.restore();
    return;
  }
  const f = Math.max(2, blur / 2);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(iw / f));
  c.height = Math.max(1, Math.round(ih / f));
  const cx = c.getContext("2d");
  if (!cx) return ctx.drawImage(img, rr.x, rr.y, rr.w, rr.h);
  cx.imageSmoothingQuality = "high";
  cx.drawImage(img, 0, 0, c.width, c.height);
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(c, rr.x, rr.y, rr.w, rr.h);
  ctx.restore();
}

export function drawBackground(ctx: Ctx, bg: Background, W: number, H: number) {
  if (bg.mode === "gradient") {
    const g = gradientLine(W, H, bg.angle);
    const grad = ctx.createLinearGradient(g.x0, g.y0, g.x1, g.y1);
    grad.addColorStop(0, bg.color);
    grad.addColorStop(1, bg.color2);
    ctx.fillStyle = grad;
  } else ctx.fillStyle = bg.color;
  ctx.fillRect(0, 0, W, H);

  if (bg.mode === "image" && bg.image) {
    const iw = bg.image.width;
    const ih = bg.image.height;
    const base = fitRect(iw, ih, W, H, bg.fit);
    const w = base.w * bg.zoom;
    const h = base.h * bg.zoom;
    const r = { x: (W - w) * bg.focusX, y: (H - h) * bg.focusY, w, h };
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    drawBlurred(ctx, bg.image, iw, ih, r, bg.blur);
    ctx.restore();
  }
  if (bg.darken > 0) {
    ctx.fillStyle = `rgba(0,0,0,${bg.darken})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawTextLayer(ctx: Ctx, L: TextLayer, W: number, H: number): Rect {
  const txt = L.upper ? L.text.toUpperCase() : L.text;
  ctx.save();
  ctx.globalAlpha = L.opacity;
  ctx.font = `${L.italic ? "italic " : ""}${L.weight} ${L.size}px ${fontStack(L.font)}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = L.align;
  const maxW = Math.max(L.size, L.maxWidth * W);
  const lines = wrapText(txt, maxW, (s) => ctx.measureText(s).width);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const blockW = Math.max(1, ...widths);
  const lh = L.size * L.lineHeight;
  const blockH = lines.length * lh;
  const ax = L.x * W;
  const top = L.y * H - blockH / 2;
  const left = L.align === "left" ? ax : L.align === "center" ? ax - blockW / 2 : ax - blockW;

  const padX = L.badge ? L.badgePad : 0;
  const padY = L.badge ? L.badgePad * 0.6 : 0;
  const bounds = { x: left - padX - L.outline, y: top - padY - L.outline, w: blockW + padX * 2 + L.outline * 2, h: blockH + padY * 2 + L.outline * 2 };

  if (L.badge) {
    ctx.save();
    if (L.shadow > 0) {
      ctx.shadowColor = L.shadowColor;
      ctx.shadowBlur = L.shadow;
      ctx.shadowOffsetY = L.shadow / 3;
    }
    roundRectPath(ctx, left - padX, top - padY, blockW + padX * 2, blockH + padY * 2, L.badgeRadius);
    ctx.fillStyle = L.badgeColor;
    ctx.fill();
    ctx.restore();
  }

  lines.forEach((line, i) => {
    const y = top + i * lh + lh / 2;
    const useShadow = L.shadow > 0 && !L.badge;
    if (L.outline > 0) {
      ctx.save();
      if (useShadow) {
        ctx.shadowColor = L.shadowColor;
        ctx.shadowBlur = L.shadow;
        ctx.shadowOffsetY = L.shadow / 3;
      }
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.lineWidth = L.outline * 2;
      ctx.strokeStyle = L.outlineColor;
      ctx.strokeText(line, ax, y);
      ctx.restore();
    } else if (useShadow) {
      ctx.shadowColor = L.shadowColor;
      ctx.shadowBlur = L.shadow;
      ctx.shadowOffsetY = L.shadow / 3;
    }
    ctx.fillStyle = L.color;
    ctx.fillText(line, ax, y);
    ctx.shadowColor = "transparent";
  });
  ctx.restore();
  return bounds;
}

export function drawImageLayer(ctx: Ctx, L: ImageLayer, W: number, H: number): Rect {
  const w = L.w * W;
  const h = (w * L.bitmap.height) / L.bitmap.width;
  const x = L.x * W - w / 2;
  const y = L.y * H - h / 2;
  const r = L.circle ? Math.min(w, h) / 2 : L.radius;
  // Compose the clipped image (and border) on its own canvas so the shadow follows its real shape.
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const cx = c.getContext("2d");
  if (!cx) return { x, y, w, h };
  if (r > 0) {
    roundRectPath(cx, 0, 0, c.width, c.height, r);
    cx.clip();
  }
  cx.imageSmoothingQuality = "high";
  cx.drawImage(L.bitmap, 0, 0, c.width, c.height);
  if (L.border > 0) {
    roundRectPath(cx, L.border / 2, L.border / 2, c.width - L.border, c.height - L.border, Math.max(0, r - L.border / 2));
    cx.lineWidth = L.border;
    cx.strokeStyle = L.borderColor;
    cx.stroke();
  }
  ctx.save();
  ctx.globalAlpha = L.opacity;
  if (L.shadow > 0) {
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = L.shadow;
    ctx.shadowOffsetY = L.shadow / 3;
  }
  ctx.drawImage(c, x, y, w, h);
  ctx.restore();
  return { x, y, w, h };
}

export interface RenderOptions {
  /** Scale from scene pixels to canvas pixels (preview < 1). */
  scale?: number;
  zones?: SafeZone[];
  selectedId?: string | null;
}

/** Renders the scene; returns layer bounds in scene pixels for hit testing. */
export function renderScene(ctx: Ctx, scene: Scene, W: number, H: number, opts: RenderOptions = {}) {
  const s = opts.scale ?? 1;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, scene.bg, W, H);
  const bounds = new Map<string, Rect>();
  for (const L of scene.layers) {
    bounds.set(L.id, L.kind === "text" ? drawTextLayer(ctx, L, W, H) : drawImageLayer(ctx, L, W, H));
  }
  if (opts.zones?.length) drawZones(ctx, opts.zones, W, s);
  if (opts.selectedId) {
    const b = bounds.get(opts.selectedId);
    if (b) {
      ctx.save();
      ctx.lineWidth = 2 / s;
      ctx.setLineDash([8 / s, 6 / s]);
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(b.x - 4 / s, b.y - 4 / s, b.w + 8 / s, b.h + 8 / s);
      ctx.lineDashOffset = 7 / s;
      ctx.strokeStyle = "#111111";
      ctx.strokeRect(b.x - 4 / s, b.y - 4 / s, b.w + 8 / s, b.h + 8 / s);
      ctx.restore();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return bounds;
}

function drawZones(ctx: Ctx, zones: SafeZone[], W: number, s: number) {
  const fs = Math.max(11, Math.round(W / 90)) / Math.max(s, 0.25);
  const label = Math.min(fs, 13 / s);
  ctx.save();
  zones.forEach((z, i) => {
    if (z.kind === "avoid") {
      ctx.fillStyle = "rgba(239,68,68,0.28)";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "rgba(239,68,68,0.95)";
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = i % 2 ? "rgba(250,204,21,0.95)" : "rgba(34,211,238,0.95)";
      ctx.setLineDash([10 / s, 6 / s]);
    }
    ctx.lineWidth = 2 / s;
    ctx.strokeRect(z.x, z.y, z.w, z.h);
    ctx.setLineDash([]);
    ctx.font = `600 ${label}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const tw = ctx.measureText(z.label).width;
    const pad = 4 / s;
    const ty = z.y + pad + (i % 3) * (label + pad * 3);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(z.x + pad, ty, tw + pad * 2, label + pad * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(z.label, z.x + pad * 2, ty + pad);
  });
  ctx.restore();
}

/** Plain-language description of a scene for screen readers. */
export function describeScene(scene: Scene, W: number, H: number) {
  const parts: string[] = [`${W} by ${H} pixel image.`];
  const bg = scene.bg;
  parts.push(
    bg.mode === "image" && bg.image
      ? `Background photo ${bg.imageName || ""}.`
      : bg.mode === "gradient"
        ? `Gradient background from ${bg.color} to ${bg.color2}.`
        : `Solid ${bg.color} background.`,
  );
  for (const L of scene.layers) {
    if (L.kind === "text") parts.push(`Text${L.badge ? " badge" : ""}: "${L.text}".`);
    else parts.push(`Image: ${L.name}.`);
  }
  return parts.join(" ");
}
