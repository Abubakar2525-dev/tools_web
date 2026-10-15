/**
 * Small layout helpers for pdf-lib documents. Pure functions: they only need
 * an object that can measure text (pdf-lib's PDFFont satisfies this).
 */

export interface Measurer {
  widthOfTextAtSize(text: string, size: number): number;
}

export const PAGE_SIZES = {
  a4: { w: 595.28, h: 841.89, label: "A4" },
  letter: { w: 612, h: 792, label: "US Letter" },
} as const;
export type PageSizeId = keyof typeof PAGE_SIZES;

/** Millimetres and inches to PDF points. */
export const mm = (v: number) => (v * 72) / 25.4;
export const inch = (v: number) => v * 72;

/** Wraps one paragraph (no newlines) into lines that fit maxWidth. Breaks very long words. */
function wrapParagraph(font: Measurer, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxWidth;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (fits(word)) {
      line = word;
      continue;
    }
    // Hard-break a word longer than the line.
    let chunk = "";
    for (const ch of Array.from(word)) {
      if (fits(chunk + ch)) chunk += ch;
      else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

/** Wraps text with explicit newlines preserved. Empty lines are kept as "". */
export function wrapText(font: Measurer, text: string, size: number, maxWidth: number): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((p) => (p.trim() === "" ? [""] : wrapParagraph(font, p, size, maxWidth)));
}

/** Truncates text with an ellipsis so it fits maxWidth. */
export function fitText(font: Measurer, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && font.widthOfTextAtSize(`${chars.join("")}…`, size) > maxWidth) chars.pop();
  return chars.length ? `${chars.join("")}…` : "";
}

/** "#1f6f5c" or "#abc" → {r,g,b} in 0..1 (pdf-lib rgb()). Falls back to dark gray. */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return { r: 0.15, g: 0.15, b: 0.15 };
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

export const isHexColor = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());

/** Removes characters the embedded fonts cannot draw (control chars). */
export const cleanPdfText = (s: string) =>
  Array.from(s)
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127);
    })
    .join("")
    .replace(/\t/g, "    ");

/** Decodes a data: URL into bytes + mime (used for embedded logos/photos). */
export function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!m) return null;
  const raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return { mime: m[1].toLowerCase(), bytes };
}
