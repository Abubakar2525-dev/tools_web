/** Whole-page stamping: watermarks, page numbers, headers and footers. */

import type { PDFDocument, PDFFont } from "pdf-lib";
import { viewSize } from "./geometry";
import { type PdfLib, drawTextView, geomOf, safeText, wrapExisting } from "./write";

export type Slot = "tl" | "tc" | "tr" | "bl" | "bc" | "br";

export const SLOT_LABELS: Record<Slot, string> = {
  tl: "Top left",
  tc: "Top center",
  tr: "Top right",
  bl: "Bottom left",
  bc: "Bottom center",
  br: "Bottom right",
};

/** View-space anchor for a slot on a w×h page. Baseline sits `margin` from the edge (top: cap height inside the margin). */
export function slotAnchor(slot: Slot, w: number, h: number, margin: number, size: number) {
  const top = slot[0] === "t";
  const col = slot[1];
  const y = top ? margin + size * 0.72 : h - margin;
  const x = col === "l" ? margin : col === "c" ? w / 2 : w - margin;
  const align: "left" | "center" | "right" = col === "l" ? "left" : col === "c" ? "center" : "right";
  return { x, y, align };
}

export interface PageTextOptions {
  size: number;
  margin: number;
  color: string;
  font: PDFFont;
}

/** Draws text in the given slots of each listed page (0-based index → slot texts). */
export function stampPageText(L: PdfLib, doc: PDFDocument, entries: Map<number, Partial<Record<Slot, string>>>, o: PageTextOptions) {
  const pages = doc.getPages();
  for (const [idx, slots] of entries) {
    const page = pages[idx];
    if (!page) continue;
    const texts = Object.entries(slots).filter(([, t]) => t && t.trim());
    if (!texts.length) continue;
    wrapExisting(L, doc, page);
    const g = geomOf(L, page);
    const { w, h } = viewSize(g);
    for (const [slot, text] of texts) {
      const a = slotAnchor(slot as Slot, w, h, o.margin, o.size);
      drawTextView(L, page, g, safeText(o.font, text as string), { at: { x: a.x, y: a.y }, align: a.align, size: o.size, font: o.font, color: o.color });
    }
  }
}

export interface WatermarkOptions {
  text: string;
  size: number;
  color: string;
  opacity: number;
  /** "diagonal" follows each page's bottom-left → top-right diagonal. */
  angleMode: "diagonal" | "horizontal" | "custom";
  angle: number;
  tile: boolean;
  /** Shrink single watermarks that would run off the page. */
  fit: boolean;
  font: PDFFont;
}

/** Angle (degrees ccw as seen) for a page of w×h. */
export function watermarkAngle(o: Pick<WatermarkOptions, "angleMode" | "angle">, w: number, h: number) {
  if (o.angleMode === "horizontal") return 0;
  if (o.angleMode === "custom") return o.angle;
  return (Math.atan2(h, w) * 180) / Math.PI;
}

/** Largest font size whose line fits within `span` points, capped at `size`. */
export function fitSize(widthAt1: number, size: number, span: number) {
  if (widthAt1 <= 0) return size;
  return Math.min(size, span / widthAt1);
}

export function stampWatermark(L: PdfLib, doc: PDFDocument, pageIndexes: number[], o: WatermarkOptions) {
  const pages = doc.getPages();
  const text = safeText(o.font, o.text);
  const w1 = o.font.widthOfTextAtSize(text, 1);
  for (const idx of pageIndexes) {
    const page = pages[idx];
    if (!page) continue;
    wrapExisting(L, doc, page);
    const g = geomOf(L, page);
    const { w, h } = viewSize(g);
    const angle = watermarkAngle(o, w, h);
    const rad = (angle * Math.PI) / 180;
    if (!o.tile) {
      // Longest line through the center at this angle that stays on the page.
      const c = Math.abs(Math.cos(rad));
      const s = Math.abs(Math.sin(rad));
      const span = Math.min(c > 1e-6 ? w / c : Infinity, s > 1e-6 ? h / s : Infinity) * 0.85;
      const size = o.fit ? fitSize(w1, o.size, span) : o.size;
      drawTextView(L, page, g, text, { at: { x: w / 2, y: h / 2 }, size, font: o.font, color: o.color, opacity: o.opacity, angle, align: "center", vAlign: "middle" });
      continue;
    }
    const tw = w1 * o.size;
    const stepX = tw + o.size * 3;
    const stepY = o.size * 4;
    const diag = Math.hypot(w, h);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Walk a grid in the rotated frame that covers the whole page, then map back.
    for (let v = -diag; v <= diag; v += stepY) {
      const row = Math.round(v / stepY);
      for (let u = -diag + (row % 2 ? stepX / 2 : 0); u <= diag; u += stepX) {
        const x = w / 2 + u * cos + v * sin;
        const y = h / 2 - u * sin + v * cos;
        if (x < -tw || x > w + tw || y < -tw || y > h + tw) continue;
        drawTextView(L, page, g, text, { at: { x, y }, size: o.size, font: o.font, color: o.color, opacity: o.opacity, angle, align: "center", vAlign: "middle" });
      }
    }
  }
}
