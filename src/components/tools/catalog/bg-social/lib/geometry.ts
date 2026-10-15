/** Pure geometry and layout helpers shared by the image tools. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Places a source of size sw×sh into a dw×dh box.
 * "contain" shows the whole source (letterboxed); "cover" fills the box (cropped).
 * `focusX`/`focusY` (0..1) choose which part stays visible when cropping.
 */
export function fitRect(
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  mode: "contain" | "cover",
  focusX = 0.5,
  focusY = 0.5,
): Rect {
  const s = mode === "contain" ? Math.min(dw / sw, dh / sh) : Math.max(dw / sw, dh / sh);
  const w = sw * s;
  const h = sh * s;
  return { x: (dw - w) * focusX, y: (dh - h) * focusY, w, h };
}

/** Scales w×h down so the longest side is at most `max` (never upscales). */
export function limitSize(w: number, h: number, max: number) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)), scale };
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

/** "16:9" style ratio label (falls back to a decimal ratio for odd sizes). */
export function ratioLabel(w: number, h: number) {
  const g = gcd(w, h);
  const a = w / g;
  const b = h / g;
  if (a <= 32 && b <= 32) return `${a}:${b}`;
  return `${(w / h).toFixed(2)}:1`;
}

/**
 * Word-wraps text to lines no wider than `maxWidth` using `measure` (e.g.
 * ctx.measureText). Explicit newlines are kept; words longer than a line are
 * broken by character.
 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  const breakWord = (word: string) => {
    let chunk = "";
    for (const ch of Array.from(word)) {
      if (chunk && measure(chunk + ch) > maxWidth) {
        out.push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    return chunk;
  };
  for (const para of text.split("\n")) {
    let line = "";
    for (const token of para.split(/(\s+)/).filter((t) => t.length > 0)) {
      if (/^\s+$/.test(token)) {
        if (line) line += token;
        continue;
      }
      const candidate = line + token;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line.trim()) out.push(line.trimEnd());
      line = measure(token) <= maxWidth ? token : breakWord(token);
    }
    out.push(line.trimEnd());
  }
  return out;
}

/** Linear gradient endpoints for a CSS-style angle (0deg = bottom to top, 90deg = left to right). */
export function gradientLine(w: number, h: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return { x0: cx - dx * half, y0: cy - dy * half, x1: cx + dx * half, y1: cy + dy * half };
}

/** Clamp helper. */
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
