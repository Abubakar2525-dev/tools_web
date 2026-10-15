/**
 * Tiny retained "scene" of SVG primitives shared by the diagram tools.
 * The same scene renders on screen (React) and exports as a standalone SVG
 * string, so what you see is what you download.
 */

export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type SceneItem =
  | { kind: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill: string; stroke?: string; strokeWidth?: number; dash?: string }
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string; stroke?: string; strokeWidth?: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number; dash?: string }
  | { kind: "path"; d: string; fill: string; stroke?: string; strokeWidth?: number; dash?: string }
  | { kind: "polygon"; points: [number, number][]; fill: string; stroke?: string; strokeWidth?: number }
  | {
      kind: "text";
      x: number;
      /** Baseline of the first line. */
      y: number;
      lines: string[];
      size: number;
      lineHeight?: number;
      weight?: number;
      fill: string;
      anchor?: "start" | "middle" | "end";
      italic?: boolean;
    };

export type Scene = { width: number; height: number; background: string; title: string; desc: string; items: SceneItem[] };

/** Rough average glyph width for system sans fonts (em). */
export const estimateWidth = (s: string, size: number, weight = 400) => s.length * size * (weight >= 600 ? 0.6 : 0.55);

/** Greedy word wrap by estimated width. Long words are hard-broken. */
export function wrap(text: string, maxWidth: number, size: number, weight = 400, maxLines = Infinity): string[] {
  const maxChars = Math.max(4, Math.floor(maxWidth / (size * (weight >= 600 ? 0.6 : 0.55))));
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    let cur = "";
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (word.length > maxChars) {
        if (cur) {
          lines.push(cur);
          cur = "";
        }
        lines.push(word.slice(0, maxChars - 1) + "-");
        word = word.slice(maxChars - 1);
      }
      if (!cur) cur = word;
      else if ((cur + " " + word).length <= maxChars) cur += " " + word;
      else {
        lines.push(cur);
        cur = word;
      }
    }
    lines.push(cur);
  }
  while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1];
    kept[maxLines - 1] = (last.length >= maxChars ? last.slice(0, maxChars - 1) : last) + "…";
    return kept;
  }
  return lines;
}

/** Baseline y of the first line so a block of `n` lines is vertically centered on `cy`. */
export function firstBaseline(cy: number, n: number, size: number, lineHeight = size * 1.3) {
  return cy - ((n - 1) * lineHeight) / 2 + size * 0.35;
}

export function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const n = (v: number) => String(Math.round(v * 100) / 100);

/** Arrowhead triangle at (x2, y2) pointing along the segment from (x1, y1). */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, size = 10): [number, number][] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const s = size;
  return [
    [x2, y2],
    [x2 - s * Math.cos(a - 0.42), y2 - s * Math.sin(a - 0.42)],
    [x2 - s * Math.cos(a + 0.42), y2 - s * Math.sin(a + 0.42)],
  ];
}

function itemToSvg(it: SceneItem): string {
  const stroke = (s?: string, w?: number, dash?: string) =>
    s ? ` stroke="${esc(s)}" stroke-width="${n(w ?? 1)}"${dash ? ` stroke-dasharray="${dash}"` : ""}` : "";
  switch (it.kind) {
    case "rect":
      return `<rect x="${n(it.x)}" y="${n(it.y)}" width="${n(it.w)}" height="${n(it.h)}"${it.rx ? ` rx="${n(it.rx)}"` : ""} fill="${esc(it.fill)}"${stroke(it.stroke, it.strokeWidth, it.dash)}/>`;
    case "circle":
      return `<circle cx="${n(it.cx)}" cy="${n(it.cy)}" r="${n(it.r)}" fill="${esc(it.fill)}"${stroke(it.stroke, it.strokeWidth)}/>`;
    case "line":
      return `<line x1="${n(it.x1)}" y1="${n(it.y1)}" x2="${n(it.x2)}" y2="${n(it.y2)}" fill="none"${stroke(it.stroke, it.strokeWidth, it.dash)} stroke-linecap="round"/>`;
    case "path":
      return `<path d="${esc(it.d)}" fill="${esc(it.fill)}"${stroke(it.stroke, it.strokeWidth, it.dash)} stroke-linecap="round" stroke-linejoin="round"/>`;
    case "polygon":
      return `<polygon points="${it.points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}" fill="${esc(it.fill)}"${stroke(it.stroke, it.strokeWidth)} stroke-linejoin="round"/>`;
    case "text": {
      const lh = it.lineHeight ?? it.size * 1.3;
      const spans = it.lines
        .map((l, i) => `<tspan x="${n(it.x)}" y="${n(it.y + i * lh)}">${esc(l)}</tspan>`)
        .join("");
      return `<text font-family="${esc(FONT)}" font-size="${n(it.size)}"${it.weight ? ` font-weight="${it.weight}"` : ""}${it.italic ? ` font-style="italic"` : ""} fill="${esc(it.fill)}" text-anchor="${it.anchor ?? "start"}">${spans}</text>`;
    }
  }
}

/** Standalone SVG document for download. */
export function sceneToSvg(s: Scene): string {
  const w = Math.ceil(s.width);
  const h = Math.ceil(s.height);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">`,
    `<title>${esc(s.title)}</title>`,
    `<desc>${esc(s.desc)}</desc>`,
    `<rect width="100%" height="100%" fill="${esc(s.background)}"/>`,
    ...s.items.map(itemToSvg),
    `</svg>`,
  ].join("\n");
}

/** Bounding box of a set of rectangles, with padding. */
export function bounds(rects: { x: number; y: number; w: number; h: number }[], pad = 0) {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

/** Translates every item by (dx, dy). */
export function translate(items: SceneItem[], dx: number, dy: number): SceneItem[] {
  if (!dx && !dy) return items;
  return items.map((it) => {
    switch (it.kind) {
      case "rect":
        return { ...it, x: it.x + dx, y: it.y + dy };
      case "circle":
        return { ...it, cx: it.cx + dx, cy: it.cy + dy };
      case "line":
        return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy };
      case "polygon":
        return { ...it, points: it.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
      case "text":
        return { ...it, x: it.x + dx, y: it.y + dy };
      case "path":
        return { ...it, d: translatePath(it.d, dx, dy) };
    }
  });
}

/** Translates absolute M/L/C/Q path commands (the only ones these tools emit). */
function translatePath(d: string, dx: number, dy: number) {
  return d.replace(/([MLCQ])([^MLCQZ]*)/g, (_, cmd: string, args: string) => {
    const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const out = nums.map((v, i) => n(v + (i % 2 === 0 ? dx : dy)));
    return `${cmd}${out.join(" ")} `;
  });
}
