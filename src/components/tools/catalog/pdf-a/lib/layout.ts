/**
 * Pure page-layout math shared by the pdf-a tools (no DOM, no pdf-lib).
 * Units are PDF points (1 pt = 1/72 inch) unless noted.
 */

export const MM = 72 / 25.4;
export const mmToPt = (mm: number) => mm * MM;
export const ptToMm = (pt: number) => pt / MM;
export const ptToIn = (pt: number) => pt / 72;

export type PaperName = "A3" | "A4" | "A5" | "Letter" | "Legal" | "Tabloid";

/** Portrait sizes in points (ISO 216 sizes from their millimetre definitions). */
export const PAPER: Record<PaperName, { w: number; h: number; label: string }> = {
  A3: { w: mmToPt(297), h: mmToPt(420), label: "A3 (297 × 420 mm)" },
  A4: { w: mmToPt(210), h: mmToPt(297), label: "A4 (210 × 297 mm)" },
  A5: { w: mmToPt(148), h: mmToPt(210), label: "A5 (148 × 210 mm)" },
  Letter: { w: 612, h: 792, label: "Letter (8.5 × 11 in)" },
  Legal: { w: 612, h: 1008, label: "Legal (8.5 × 14 in)" },
  Tabloid: { w: 792, h: 1224, label: "Tabloid (11 × 17 in)" },
};

export type Orientation = "portrait" | "landscape";

export function paperSize(name: PaperName, orientation: Orientation) {
  const p = PAPER[name];
  return orientation === "portrait" ? { w: p.w, h: p.h } : { w: p.h, h: p.w };
}

/** Names a page size if it matches a common paper size (either orientation) within 1.5 pt. */
export function namePaperSize(w: number, h: number): string | null {
  const tol = 1.5;
  for (const [name, p] of Object.entries(PAPER)) {
    if (Math.abs(w - p.w) <= tol && Math.abs(h - p.h) <= tol) return `${name} portrait`;
    if (Math.abs(w - p.h) <= tol && Math.abs(h - p.w) <= tol) return `${name} landscape`;
  }
  return null;
}

/** Normalizes any multiple of 90 to 0, 90, 180 or 270. */
export const normRot = (deg: number) => (((Math.round(deg / 90) * 90) % 360) + 360) % 360;

export type Placement = { x: number; y: number; width: number; height: number; rotate: number; scale: number };

/**
 * Fits a page (w × h, unrotated, with a viewer rotation `rot` clockwise) inside a box,
 * preserving aspect ratio and centering. Returns pdf-lib drawPage options:
 * `rotate` is counter-clockwise degrees around (x, y), width/height are the unrotated draw size.
 */
export function placeInBox(
  w: number,
  h: number,
  rot: number,
  box: { x: number; y: number; w: number; h: number },
  allowUpscale = true,
): Placement {
  const r = normRot(rot);
  const dispW = r === 90 || r === 270 ? h : w;
  const dispH = r === 90 || r === 270 ? w : h;
  let s = Math.min(box.w / dispW, box.h / dispH);
  if (!allowUpscale) s = Math.min(1, s);
  const bx = box.x + (box.w - dispW * s) / 2;
  const by = box.y + (box.h - dispH * s) / 2;
  const ws = w * s;
  const hs = h * s;
  let x = bx;
  let y = by;
  if (r === 90) y = by + ws;
  else if (r === 180) {
    x = bx + ws;
    y = by + hs;
  } else if (r === 270) x = bx + hs;
  return { x, y, width: ws, height: hs, rotate: -r === 0 ? 0 : -r, scale: s };
}

/* ------------------------------------------------------------------ */
/* Booklet (saddle stitch)                                             */
/* ------------------------------------------------------------------ */

export type BookletSide = { sheet: number; side: "front" | "back"; left: number | null; right: number | null };

/**
 * Saddle-stitch imposition. Pages are 1-based; the count is padded with blanks
 * (null) to a multiple of 4. Each sheet has a front and back side with two slots.
 * Print duplex, flipping on the short edge, then fold the stack in half.
 */
export function bookletSides(pageCount: number, rtl = false): BookletSide[] {
  const n = Math.max(4, Math.ceil(pageCount / 4) * 4);
  const p = (i: number) => (i <= pageCount ? i : null);
  const out: BookletSide[] = [];
  for (let s = 0; s < n / 4; s++) {
    const front: [number, number] = [n - 2 * s, 2 * s + 1];
    const back: [number, number] = [2 * s + 2, n - 2 * s - 1];
    const f = rtl ? [front[1], front[0]] : front;
    const b = rtl ? [back[1], back[0]] : back;
    out.push({ sheet: s + 1, side: "front", left: p(f[0]), right: p(f[1]) });
    out.push({ sheet: s + 1, side: "back", left: p(b[0]), right: p(b[1]) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* N-up                                                                */
/* ------------------------------------------------------------------ */

export type NUp = 2 | 4 | 6 | 9;

/** Grid and natural sheet orientation for each N-up mode. */
export function nUpGrid(n: NUp, orientation: Orientation | "auto") {
  const natural: Record<NUp, { cols: number; rows: number; o: Orientation }> = {
    2: { cols: 2, rows: 1, o: "landscape" },
    4: { cols: 2, rows: 2, o: "portrait" },
    6: { cols: 3, rows: 2, o: "landscape" },
    9: { cols: 3, rows: 3, o: "portrait" },
  };
  const g = natural[n];
  const o = orientation === "auto" ? g.o : orientation;
  // Swap the grid when the sheet orientation goes against the natural one.
  return o === g.o ? { cols: g.cols, rows: g.rows, orientation: o } : { cols: g.rows, rows: g.cols, orientation: o };
}

/** Cell boxes (PDF coordinates, origin bottom-left) in reading order. */
export function gridCells(
  sheetW: number,
  sheetH: number,
  cols: number,
  rows: number,
  margin: number,
  gap: number,
  order: "rows" | "columns" = "rows",
) {
  const cw = (sheetW - 2 * margin - (cols - 1) * gap) / cols;
  const ch = (sheetH - 2 * margin - (rows - 1) * gap) / rows;
  const cells: { x: number; y: number; w: number; h: number }[] = [];
  const at = (c: number, r: number) => ({ x: margin + c * (cw + gap), y: sheetH - margin - (r + 1) * ch - r * gap, w: cw, h: ch });
  if (order === "rows") for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(at(c, r));
  else for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) cells.push(at(c, r));
  return cells;
}

/* ------------------------------------------------------------------ */
/* Poster tiling                                                       */
/* ------------------------------------------------------------------ */

export type PosterPlan = {
  scale: number;
  posterW: number;
  posterH: number;
  /** Where the (displayed) page sits inside the poster, origin bottom-left. */
  art: { x: number; y: number; w: number; h: number };
  tiles: {
    col: number;
    row: number;
    label: string;
    /** Translation applied to poster coordinates to land on this sheet. */
    dx: number;
    dy: number;
  }[];
  printW: number;
  printH: number;
};

/** Spreadsheet-style row letters: 0 → A, 25 → Z, 26 → AA. */
export function rowLetter(i: number) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Splits a page (displayed size pageW × pageH) across cols × rows sheets.
 * Each sheet has a printable area inset by `margin`; neighbouring tiles share `overlap` points.
 */
export function posterPlan(
  pageW: number,
  pageH: number,
  sheetW: number,
  sheetH: number,
  cols: number,
  rows: number,
  margin: number,
  overlap: number,
): PosterPlan | string {
  const printW = sheetW - 2 * margin;
  const printH = sheetH - 2 * margin;
  if (printW <= 0 || printH <= 0) return "The margins are larger than the sheet.";
  if (overlap < 0 || overlap >= Math.min(printW, printH) / 2) return "The overlap must be less than half the printable sheet width.";
  const posterW = cols * printW - (cols - 1) * overlap;
  const posterH = rows * printH - (rows - 1) * overlap;
  const scale = Math.min(posterW / pageW, posterH / pageH);
  const w = pageW * scale;
  const h = pageH * scale;
  const art = { x: (posterW - w) / 2, y: (posterH - h) / 2, w, h };
  const tiles: PosterPlan["tiles"] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * (printW - overlap);
      const yTop = r * (printH - overlap);
      const yBottom = posterH - yTop - printH;
      tiles.push({ col: c, row: r, label: `${rowLetter(r)}${c + 1}`, dx: margin - x0, dy: margin - yBottom });
    }
  }
  return { scale, posterW, posterH, art, tiles, printW, printH };
}

/* ------------------------------------------------------------------ */
/* Page lists                                                          */
/* ------------------------------------------------------------------ */

/** Splits pages 1..n into chunks of `size`. */
export function chunkPages(n: number, size: number): number[][] {
  const out: number[][] = [];
  for (let i = 1; i <= n; i += size) out.push(Array.from({ length: Math.min(size, n - i + 1) }, (_, k) => i + k));
  return out;
}

/** Each selected page is followed by `copies` duplicates; other pages appear once. */
export function duplicateOrder(n: number, selected: ReadonlySet<number>, copies: number): number[] {
  const out: number[] = [];
  for (let p = 1; p <= n; p++) {
    out.push(p);
    if (selected.has(p)) for (let c = 0; c < copies; c++) out.push(p);
  }
  return out;
}

export function oddPages(n: number) {
  return Array.from({ length: n }, (_, i) => i + 1).filter((p) => p % 2 === 1);
}
export function evenPages(n: number) {
  return Array.from({ length: n }, (_, i) => i + 1).filter((p) => p % 2 === 0);
}

/** Moves an item one step; returns a new array (unchanged if the move is out of range). */
export function moveItem<T>(arr: readonly T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (index < 0 || index >= arr.length || to < 0 || to >= arr.length) return arr.slice();
  const out = arr.slice();
  const [it] = out.splice(index, 1);
  out.splice(to, 0, it);
  return out;
}

/** Formats a list of page numbers compactly: [1,2,3,5] → "1-3, 5". */
export function formatRanges(pages: readonly number[]): string {
  const s = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(j > i ? `${s[i]}-${s[j]}` : `${s[i]}`);
    i = j;
  }
  return parts.join(", ");
}
