/**
 * pdf-lib writers for the pdf-b tools. pdf-lib itself is passed in (`L`) so
 * callers can load it on demand; only types are imported statically.
 *
 * All item coordinates are in view space (see geometry.ts) and are converted
 * per page, so placement is correct on rotated pages and on pages whose
 * CropBox/MediaBox does not start at 0,0.
 */

import type {
  PDFArray,
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
} from "pdf-lib";
import {
  type Matrix,
  type PageGeom,
  type Pt,
  type Rect,
  applyMatrix,
  arrowHead,
  invertMatrix,
  multiply,
  normRotation,
  userToViewMatrix,
  uprightAngle,
  viewRectToUser,
  viewSize,
  viewToUser,
} from "./geometry";

export type PdfLib = typeof import("pdf-lib");

/** Text line metrics shared by the on-screen overlay and the writer (Noto Sans). */
export const LINE_HEIGHT = 1.2;
/** Baseline distance from the top of a line box, as a multiple of font size (Noto Sans, line-height 1.2). */
export const BASELINE = 0.988;

/* ------------------------------------------------------------------ */
/* Item model                                                          */
/* ------------------------------------------------------------------ */

interface ItemBase {
  id: string;
  /** 1-based page number. */
  page: number;
}

export interface TextItem extends ItemBase {
  kind: "text";
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
  bold: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  fontFamily?: "sans" | "serif" | "mono";
  /** Optional text box width used for alignment and resizing. */
  w?: number;
}

export interface ReplaceTextItem extends ItemBase {
  kind: "replace-text";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  originalText: string;
  size: number;
  color: string;
  background: string;
  bold: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  fontFamily?: "sans" | "serif" | "mono";
}

export interface ImageItem extends ItemBase {
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  imageId: string;
  /** Accessible name shown in lists. */
  label: string;
}

export interface RectItem extends ItemBase {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  style: "highlight" | "box" | "whiteout" | "ellipse" | "strike";
  color: string;
  opacity: number;
  strokeWidth: number;
  fillColor?: string;
}

export interface ArrowItem extends ItemBase {
  kind: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
}

export interface PathItem extends ItemBase {
  kind: "path";
  points: Pt[];
  color: string;
  strokeWidth: number;
  opacity: number;
}

export interface NoteItem extends ItemBase {
  kind: "note";
  x: number;
  y: number;
  w: number;
  text: string;
  size: number;
  color: string;
}

export interface LinkItem extends ItemBase {
  kind: "link";
  x: number;
  y: number;
  w: number;
  h: number;
  target: { type: "url"; url: string } | { type: "page"; page: number };
  border: boolean;
}

export type Item =
  | TextItem
  | ReplaceTextItem
  | ImageItem
  | RectItem
  | ArrowItem
  | PathItem
  | NoteItem
  | LinkItem;

export interface StoredImage {
  bytes: Uint8Array;
  type: "png" | "jpg";
  width: number;
  height: number;
}

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  sansItalic?: PDFFont;
  sansBoldItalic?: PDFFont;
  serif?: PDFFont;
  serifBold?: PDFFont;
  serifItalic?: PDFFont;
  serifBoldItalic?: PDFFont;
  mono?: PDFFont;
  monoBold?: PDFFont;
  monoItalic?: PDFFont;
  monoBoldItalic?: PDFFont;
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

export async function loadForEdit(L: PdfLib, bytes: Uint8Array) {
  try {
    return await L.PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/encrypt/i.test(msg))
      throw new Error(
        "This PDF is encrypted. Remove its password protection first, then try again.",
      );
    throw new Error("This file could not be read as a PDF. It may be damaged.");
  }
}

function boxOf(
  L: PdfLib,
  arr: PDFArray | undefined,
): [number, number, number, number] | null {
  if (!arr || arr.size() < 4) return null;
  const n = [0, 1, 2, 3].map((i) => {
    const v = arr.lookup(i);
    return v instanceof L.PDFNumber ? v.asNumber() : NaN;
  });
  if (n.some((v) => !Number.isFinite(v))) return null;
  return [
    Math.min(n[0], n[2]),
    Math.min(n[1], n[3]),
    Math.max(n[0], n[2]),
    Math.max(n[1], n[3]),
  ];
}

/** Same visible box and rotation that pdf.js uses (CropBox ∩ MediaBox, /Rotate). */
export function geomOf(L: PdfLib, page: PDFPage): PageGeom {
  const media = boxOf(L, page.node.MediaBox()) ?? [0, 0, 612, 792];
  const crop = boxOf(L, page.node.CropBox());
  let view = media;
  if (crop) {
    const v: [number, number, number, number] = [
      Math.max(media[0], crop[0]),
      Math.max(media[1], crop[1]),
      Math.min(media[2], crop[2]),
      Math.min(media[3], crop[3]),
    ];
    if (v[2] > v[0] && v[3] > v[1]) view = v;
  }
  return { view, rotate: normRotation(page.getRotation().angle) };
}

/**
 * Wraps the page's existing content in q … Q so that graphics state left
 * behind by the original content (an unbalanced transform, clip or color)
 * cannot distort what we draw afterwards. `ops` run inside the wrap.
 */
export function wrapExisting(
  L: PdfLib,
  doc: PDFDocument,
  page: PDFPage,
  matrix?: Matrix,
  clip?: [number, number, number, number],
) {
  page.node.normalize();
  const ctx = doc.context;
  const startOps = [L.pushGraphicsState()];
  if (matrix) startOps.push(L.concatTransformationMatrix(...matrix));
  if (clip)
    startOps.push(
      L.rectangle(clip[0], clip[1], clip[2] - clip[0], clip[3] - clip[1]),
      L.clip(),
      L.endPath(),
    );
  const start = ctx.register(ctx.contentStream(startOps));
  const end = ctx.register(ctx.contentStream([L.popGraphicsState()]));
  page.node.wrapContentStreams(start, end);
}

/* ------------------------------------------------------------------ */
/* Drawing primitives                                                  */
/* ------------------------------------------------------------------ */

export function rgbOf(L: PdfLib, hex: string) {
  let s = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(s))
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  const n = /^[0-9a-f]{6}$/i.test(s) ? parseInt(s, 16) : 0;
  return L.rgb(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  );
}

/** Direction vectors (view space, y down) for text rotated ccw by `deg` as seen. */
function textFrame(deg: number) {
  const t = (deg * Math.PI) / 180;
  return {
    d: { x: Math.cos(t), y: -Math.sin(t) },
    up: { x: -Math.sin(t), y: -Math.cos(t) },
  };
}

/**
 * Draws one line of text whose anchor is given in view space.
 * `align` positions the anchor at the start, middle or end of the line;
 * `vAlign` "baseline" puts the anchor on the baseline, "middle" on the cap-height midline.
 */
export function drawTextView(
  L: PdfLib,
  page: PDFPage,
  g: PageGeom,
  text: string,
  o: {
    at: Pt;
    size: number;
    font: PDFFont;
    color: string;
    opacity?: number;
    angle?: number;
    align?: "left" | "center" | "right";
    vAlign?: "baseline" | "middle";
  },
) {
  if (!text) return;
  const angle = o.angle ?? 0;
  const w = o.font.widthOfTextAtSize(text, o.size);
  const { d, up } = textFrame(angle);
  const shift = o.align === "center" ? w / 2 : o.align === "right" ? w : 0;
  const lift = o.vAlign === "middle" ? o.size * 0.36 : 0;
  const start = {
    x: o.at.x - d.x * shift - up.x * lift,
    y: o.at.y - d.y * shift - up.y * lift,
  };
  const p = viewToUser(g, start);
  page.drawText(text, {
    x: p.x,
    y: p.y,
    size: o.size,
    font: o.font,
    color: rgbOf(L, o.color),
    opacity: o.opacity,
    rotate: L.degrees(uprightAngle(g) + angle),
  });
}

/** Greedy word wrap using the font's real advance widths. Long words are broken. */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r\n?/g, "\n").split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const cand = line ? `${line} ${word}` : word;
      if (measure(cand) <= maxWidth) {
        line = cand;
        continue;
      }
      if (line) out.push(line);
      if (measure(word) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const ch of Array.from(word)) {
        if (measure(chunk + ch) > maxWidth && chunk) {
          out.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
    out.push(line);
  }
  return out;
}

/** Characters a PDF font cannot encode are replaced so drawing never throws. */
export function safeText(font: PDFFont, text: string) {
  try {
    font.encodeText(text);
    return text;
  } catch {
    return Array.from(text)
      .map((ch) => {
        try {
          font.encodeText(ch);
          return ch;
        } catch {
          return "?";
        }
      })
      .join("");
  }
}

function drawLineView(
  L: PdfLib,
  page: PDFPage,
  g: PageGeom,
  a: Pt,
  b: Pt,
  color: string,
  thickness: number,
  opacity?: number,
) {
  const p = viewToUser(g, a);
  const q = viewToUser(g, b);
  page.drawLine({
    start: p,
    end: q,
    thickness,
    color: rgbOf(L, color),
    lineCap: L.LineCapStyle.Round,
    opacity,
  });
}

function drawRectView(
  L: PdfLib,
  page: PDFPage,
  g: PageGeom,
  r: Rect,
  o: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    multiply?: boolean;
  },
) {
  const u = viewRectToUser(g, r);
  page.drawRectangle({
    x: u.x,
    y: u.y,
    width: u.w,
    height: u.h,
    color: o.fill ? rgbOf(L, o.fill) : undefined,
    opacity: o.fill ? o.opacity : undefined,
    borderColor: o.stroke ? rgbOf(L, o.stroke) : undefined,
    borderWidth: o.stroke ? (o.strokeWidth ?? 1) : 0,
    borderOpacity: o.stroke ? o.opacity : undefined,
    blendMode: o.multiply ? L.BlendMode.Multiply : undefined,
  });
}

function drawEllipseView(
  L: PdfLib,
  page: PDFPage,
  g: PageGeom,
  r: Rect,
  o: { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number },
) {
  const u = viewRectToUser(g, r);
  page.drawEllipse({
    x: u.x + u.w / 2,
    y: u.y + u.h / 2,
    xScale: u.w / 2,
    yScale: u.h / 2,
    color: o.fill ? rgbOf(L, o.fill) : undefined,
    opacity: o.fill ? o.opacity : undefined,
    borderColor: o.stroke ? rgbOf(L, o.stroke) : undefined,
    borderWidth: o.stroke ? (o.strokeWidth ?? 1) : 0,
    borderOpacity: o.stroke ? o.opacity : undefined,
  });
}

function fontFor(
  item: Pick<TextItem, "fontFamily" | "bold" | "italic">,
  fonts: Fonts,
) {
  const family = item.fontFamily ?? "sans";
  const style =
    item.bold && item.italic
      ? "BoldItalic"
      : item.bold
        ? "Bold"
        : item.italic
          ? "Italic"
          : "";
  if (family === "serif")
    return fonts[`serif${style}` as keyof Fonts] ?? fonts.regular;
  if (family === "mono")
    return fonts[`mono${style}` as keyof Fonts] ?? fonts.regular;
  if (style === "BoldItalic") return fonts.sansBoldItalic ?? fonts.bold;
  if (style === "Italic") return fonts.sansItalic ?? fonts.regular;
  return item.bold ? fonts.bold : fonts.regular;
}

function textAnchorX(item: {
  x: number;
  w?: number;
  align?: "left" | "center" | "right";
}) {
  if (item.align === "center") return item.x + (item.w ?? 0) / 2;
  if (item.align === "right") return item.x + (item.w ?? 0);
  return item.x;
}

function drawUnderline(
  L: PdfLib,
  page: PDFPage,
  g: PageGeom,
  item: {
    x: number;
    y: number;
    w?: number;
    align?: "left" | "center" | "right";
    size: number;
    color: string;
  },
  line: string,
  lineIndex: number,
  font: PDFFont,
) {
  const width = font.widthOfTextAtSize(line, item.size);
  const anchor = textAnchorX(item);
  const startX =
    item.align === "center"
      ? anchor - width / 2
      : item.align === "right"
        ? anchor - width
        : anchor;
  const y =
    item.y +
    item.size * (BASELINE + lineIndex * LINE_HEIGHT) +
    item.size * 0.08;
  drawLineView(
    L,
    page,
    g,
    { x: startX, y },
    { x: startX + width, y },
    item.color,
    Math.max(0.6, item.size / 18),
  );
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

export const NOTE_PAD = 6;

export function noteLayout(
  item: Pick<NoteItem, "w" | "text" | "size">,
  measure: (s: string) => number,
) {
  const inner = Math.max(20, item.w - NOTE_PAD * 2);
  const lines = wrapLines(item.text, inner, measure);
  const h = lines.length * item.size * LINE_HEIGHT + NOTE_PAD * 2;
  return { lines, h };
}

function addLinkAnnot(
  L: PdfLib,
  doc: PDFDocument,
  page: PDFPage,
  g: PageGeom,
  item: LinkItem,
) {
  const u = viewRectToUser(g, item);
  const ctx = doc.context;
  const dict: Record<string, unknown> = {
    Type: "Annot",
    Subtype: "Link",
    Rect: [u.x, u.y, u.x + u.w, u.y + u.h],
    Border: [0, 0, item.border ? 1 : 0],
    C: [0.1, 0.35, 0.85],
    F: 4,
  };
  if (item.target.type === "url") {
    dict.A = ctx.obj({
      Type: "Action",
      S: "URI",
      URI: L.PDFString.of(item.target.url),
    });
  } else {
    const pages = doc.getPages();
    const dest =
      pages[Math.min(pages.length, Math.max(1, item.target.page)) - 1];
    dict.Dest = ctx.obj([dest.ref, "Fit"]);
  }
  const annot = ctx.register(
    ctx.obj(dict as Parameters<typeof ctx.obj>[0] & object),
  );
  page.node.addAnnot(annot);
}

/** Draws all items onto their pages. Images are looked up by `imageId`. */
export async function applyItems(
  L: PdfLib,
  doc: PDFDocument,
  items: Item[],
  fonts: Fonts,
  images: Map<string, StoredImage> = new Map(),
) {
  const pages = doc.getPages();
  const embedded = new Map<string, PDFImage>();
  const touched = new Set<number>();
  for (const it of items) {
    const page = pages[it.page - 1];
    if (!page) continue;
    if (!touched.has(it.page) && it.kind !== "link") {
      wrapExisting(L, doc, page);
      touched.add(it.page);
    }
    const g = geomOf(L, page);
    switch (it.kind) {
      case "text": {
        const font = fontFor(it, fonts);
        const lines = it.text.replace(/\r\n?/g, "\n").split("\n");
        lines.forEach((line, i) => {
          drawTextView(L, page, g, safeText(font, line), {
            at: {
              x: textAnchorX(it),
              y: it.y + it.size * (BASELINE + i * LINE_HEIGHT),
            },
            size: it.size,
            font,
            color: it.color,
            align: it.align,
          });
          if (it.underline)
            drawUnderline(L, page, g, it, safeText(font, line), i, font);
        });
        break;
      }
      case "replace-text": {
        drawRectView(
          L,
          page,
          g,
          { x: it.x, y: it.y, w: it.w, h: it.h },
          { fill: it.background },
        );
        const font = fontFor(it, fonts);
        const lines = it.text.replace(/\r\n?/g, "\n").split("\n");
        lines.forEach((line, i) => {
          drawTextView(L, page, g, safeText(font, line), {
            at: {
              x: textAnchorX({ ...it, x: it.x + 1, w: Math.max(0, it.w - 2) }),
              y: it.y + it.size * (BASELINE + i * LINE_HEIGHT),
            },
            size: it.size,
            font,
            color: it.color,
            align: it.align,
          });
          if (it.underline)
            drawUnderline(
              L,
              page,
              g,
              { ...it, x: it.x + 1, w: Math.max(0, it.w - 2) },
              safeText(font, line),
              i,
              font,
            );
        });
        break;
      }
      case "image": {
        const src = images.get(it.imageId);
        if (!src) break;
        let img = embedded.get(it.imageId);
        if (!img) {
          img =
            src.type === "png"
              ? await doc.embedPng(src.bytes)
              : await doc.embedJpg(src.bytes);
          embedded.set(it.imageId, img);
        }
        const p = viewToUser(g, { x: it.x, y: it.y + it.h });
        page.drawImage(img, {
          x: p.x,
          y: p.y,
          width: it.w,
          height: it.h,
          rotate: L.degrees(uprightAngle(g)),
        });
        break;
      }
      case "rect":
        if (it.style === "highlight")
          drawRectView(L, page, g, it, {
            fill: it.color,
            opacity: it.opacity,
            multiply: true,
          });
        else if (it.style === "whiteout")
          drawRectView(L, page, g, it, { fill: it.color, opacity: 1 });
        else if (it.style === "strike") {
          const y = it.y + it.h / 2;
          drawLineView(
            L,
            page,
            g,
            { x: it.x, y },
            { x: it.x + it.w, y },
            it.color,
            it.strokeWidth,
            it.opacity,
          );
        } else if (it.style === "ellipse") {
          drawEllipseView(L, page, g, it, {
            fill: it.fillColor,
            stroke: it.color,
            strokeWidth: it.strokeWidth,
            opacity: it.opacity,
          });
        } else
          drawRectView(L, page, g, it, {
            fill: it.fillColor,
            stroke: it.color,
            strokeWidth: it.strokeWidth,
            opacity: it.opacity,
          });
        break;
      case "arrow": {
        const a = { x: it.x1, y: it.y1 };
        const b = { x: it.x2, y: it.y2 };
        drawLineView(L, page, g, a, b, it.color, it.strokeWidth);
        const [h1, h2] = arrowHead(a, b, Math.max(8, it.strokeWidth * 4));
        drawLineView(L, page, g, b, h1, it.color, it.strokeWidth);
        drawLineView(L, page, g, b, h2, it.color, it.strokeWidth);
        break;
      }
      case "path": {
        for (let i = 1; i < it.points.length; i++) {
          drawLineView(
            L,
            page,
            g,
            it.points[i - 1],
            it.points[i],
            it.color,
            it.strokeWidth,
            it.opacity,
          );
        }
        break;
      }
      case "note": {
        const font = fonts.regular;
        const measure = (s: string) =>
          font.widthOfTextAtSize(safeText(font, s), it.size);
        const { lines, h } = noteLayout(it, measure);
        drawRectView(
          L,
          page,
          g,
          { x: it.x, y: it.y, w: it.w, h },
          { fill: "#fff6c2" },
        );
        drawRectView(
          L,
          page,
          g,
          { x: it.x, y: it.y, w: it.w, h },
          { stroke: "#b08d00", strokeWidth: 0.75 },
        );
        lines.forEach((line, i) => {
          drawTextView(L, page, g, safeText(font, line), {
            at: {
              x: it.x + NOTE_PAD,
              y: it.y + NOTE_PAD + it.size * (BASELINE + i * LINE_HEIGHT),
            },
            size: it.size,
            font,
            color: it.color,
          });
        });
        break;
      }
      case "link":
        addLinkAnnot(L, doc, page, g, it);
        break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Page reframing (margins, resize)                                    */
/* ------------------------------------------------------------------ */

function mapPairs(L: PdfLib, doc: PDFDocument, arr: PDFArray, m: Matrix) {
  const nums: number[] = [];
  for (let i = 0; i < arr.size(); i++) {
    const v = arr.lookup(i);
    if (!(v instanceof L.PDFNumber)) return;
    nums.push(v.asNumber());
  }
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const p = applyMatrix(m, { x: nums[i], y: nums[i + 1] });
    arr.set(i, doc.context.obj(p.x));
    arr.set(i + 1, doc.context.obj(p.y));
  }
}

/** Moves annotations (links, form fields, comments) along with re-placed page content. */
function transformAnnots(
  L: PdfLib,
  doc: PDFDocument,
  page: PDFPage,
  m: Matrix,
) {
  const annots = page.node.Annots();
  if (!annots) return;
  for (let i = 0; i < annots.size(); i++) {
    const a = annots.lookup(i);
    if (!(a instanceof L.PDFDict)) continue;
    const rect = a.lookup(L.PDFName.of("Rect"));
    if (rect instanceof L.PDFArray && rect.size() === 4) {
      const n = [0, 1, 2, 3].map((k) => {
        const v = rect.lookup(k);
        return v instanceof L.PDFNumber ? v.asNumber() : 0;
      });
      const p = applyMatrix(m, { x: n[0], y: n[1] });
      const q = applyMatrix(m, { x: n[2], y: n[3] });
      a.set(
        L.PDFName.of("Rect"),
        doc.context.obj([
          Math.min(p.x, q.x),
          Math.min(p.y, q.y),
          Math.max(p.x, q.x),
          Math.max(p.y, q.y),
        ]),
      );
    }
    for (const key of ["QuadPoints", "L", "Vertices"]) {
      const arr = a.lookup(L.PDFName.of(key));
      if (arr instanceof L.PDFArray) mapPairs(L, doc, arr, m);
    }
    const ink = a.lookup(L.PDFName.of("InkList"));
    if (ink instanceof L.PDFArray) {
      for (let k = 0; k < ink.size(); k++) {
        const sub = ink.lookup(k);
        if (sub instanceof L.PDFArray) mapPairs(L, doc, sub, m);
      }
    }
  }
}

function clearBoxes(L: PdfLib, page: PDFPage) {
  for (const k of ["CropBox", "BleedBox", "TrimBox", "ArtBox"])
    page.node.delete(L.PDFName.of(k));
}

/**
 * Re-places a page's visible content into `target` (view-space rect of a new,
 * unrotated W×H page). The page keeps its annotations, which are moved too.
 * Returns the content matrix used.
 */
export function reframePage(
  L: PdfLib,
  doc: PDFDocument,
  page: PDFPage,
  W: number,
  H: number,
  target: Rect,
): Matrix {
  const g = geomOf(L, page);
  const { w, h } = viewSize(g);
  const toView = userToViewMatrix(g);
  const place: Matrix = [target.w / w, 0, 0, target.h / h, target.x, target.y];
  const flip: Matrix = [1, 0, 0, -1, 0, H];
  const m = multiply(multiply(toView, place), flip);
  // Clip to the original visible area so content outside the old crop box stays hidden.
  wrapExisting(L, doc, page, m, g.view);
  transformAnnots(L, doc, page, m);
  clearBoxes(L, page);
  page.setMediaBox(0, 0, W, H);
  page.setRotation(L.degrees(0));
  return m;
}

/** Inverse helper kept for tests: maps target user space back to source user space. */
export function inverseOf(m: Matrix) {
  return invertMatrix(m);
}

/* ------------------------------------------------------------------ */
/* Crop                                                                */
/* ------------------------------------------------------------------ */

export function cropPage(L: PdfLib, page: PDFPage, viewRect: Rect) {
  const g = geomOf(L, page);
  const u = viewRectToUser(g, viewRect);
  page.setCropBox(u.x, u.y, u.w, u.h);
  // Keep trim/art boxes inside the new crop so printers and viewers agree.
  page.node.delete(L.PDFName.of("TrimBox"));
  page.node.delete(L.PDFName.of("ArtBox"));
  page.node.delete(L.PDFName.of("BleedBox"));
}
