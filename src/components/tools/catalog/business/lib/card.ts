/**
 * Business card model, layouts, print geometry and PDF builder.
 *
 * Layouts produce renderer-neutral primitives in points, relative to the
 * top-left corner of the trim box (negative values reach into the bleed).
 * The SVG preview, the 300 DPI PNG export and the PDF all draw from the same
 * primitives, each with its own text measurer so fitted text never overflows.
 */

import QRCode from "qrcode";
import type { PDFFont } from "pdf-lib";
import { cleanPdfText, dataUrlToBytes, fitText, hexToRgb01, inch, isHexColor, mm, type Measurer } from "./pdfText";
import { emptyContact, serializeContact } from "./vcard";

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

export type CardSize = "us" | "eu";
export type FrontLayout = "left" | "centered" | "band";
export type BackFill = "accent" | "background";
export type QrMode = "url" | "vcard";

export const CARD_SIZES: Record<CardSize, { w: number; h: number; label: string }> = {
  us: { w: inch(3.5), h: inch(2), label: "US 3.5 × 2 in" },
  eu: { w: mm(85), h: mm(55), label: "EU 85 × 55 mm" },
};

export const FRONT_LAYOUTS: { value: FrontLayout; label: string }[] = [
  { value: "left", label: "Left aligned" },
  { value: "centered", label: "Centered" },
  { value: "band", label: "Split band" },
];

export interface CardLogo {
  dataUrl: string;
  w: number;
  h: number;
}

export interface CardDesign {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  tagline: string;
  logo: CardLogo | null;
  accent: string;
  background: string;
  size: CardSize;
  front: FrontLayout;
  backFill: BackFill;
  backLogo: boolean;
  backCompany: boolean;
  backTagline: boolean;
  backQr: boolean;
  qrMode: QrMode;
  cropMarks: boolean;
}

export const DEFAULT_CARD: CardDesign = {
  name: "Priya Raman",
  title: "Senior product designer",
  company: "Lumen & Pine",
  phone: "+1 (646) 555-0187",
  email: "priya@lumenpine.example",
  website: "lumenpine.example",
  address: "88 Spring St, New York, NY 10012",
  tagline: "Thoughtful interfaces for real people",
  logo: null,
  accent: "#1f6f5c",
  background: "#ffffff",
  size: "us",
  front: "left",
  backFill: "accent",
  backLogo: true,
  backCompany: true,
  backTagline: true,
  backQr: true,
  qrMode: "url",
  cropMarks: true,
};

/** Fills missing keys from older saved designs and fixes invalid values. */
export function normalizeDesign(raw: Partial<CardDesign> | null | undefined): CardDesign {
  const d = { ...DEFAULT_CARD, ...(raw ?? {}) };
  if (!(d.size in CARD_SIZES)) d.size = "us";
  if (!FRONT_LAYOUTS.some((l) => l.value === d.front)) d.front = "left";
  return d;
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

export const BLEED = mm(3);
export const MARK_LEN = mm(5);
/** Margin outside the bleed that holds the crop marks (mark length + 1 mm). */
export const SLUG = mm(6);
/** Keep important content this far inside the trim edge. */
export const SAFE = mm(4.5);

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CardGeometry {
  trimW: number;
  trimH: number;
  bleed: number;
  slug: number;
  pageW: number;
  pageH: number;
  /** PDF coordinates (origin bottom-left). */
  trim: Box;
  bleedBox: Box;
  marks: Segment[];
}

/** Page = trim + bleed on each side + (when marks are on) a slug margin for crop marks. */
export function cardGeometry(size: CardSize, marks: boolean): CardGeometry {
  const { w, h } = CARD_SIZES[size];
  const slug = marks ? SLUG : 0;
  const off = BLEED + slug;
  const trim = { x: off, y: off, w, h };
  const bleedBox = { x: slug, y: slug, w: w + 2 * BLEED, h: h + 2 * BLEED };
  const segs: Segment[] = [];
  if (marks) {
    const xs = [trim.x, trim.x + w];
    const ys = [trim.y, trim.y + h];
    for (const x of xs) {
      for (const y of ys) {
        const left = x === trim.x;
        const bottom = y === trim.y;
        // Horizontal mark on the trim line, starting at the bleed edge and running outward.
        const hx = left ? trim.x - BLEED : trim.x + w + BLEED;
        segs.push({ x1: hx, y1: y, x2: left ? hx - MARK_LEN : hx + MARK_LEN, y2: y });
        const vy = bottom ? trim.y - BLEED : trim.y + h + BLEED;
        segs.push({ x1: x, y1: vy, x2: x, y2: bottom ? vy - MARK_LEN : vy + MARK_LEN });
      }
    }
  }
  return { trimW: w, trimH: h, bleed: BLEED, slug, pageW: w + 2 * off, pageH: h + 2 * off, trim, bleedBox, marks: segs };
}

/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

const safeHex = (s: string, fallback: string) => {
  if (!isHexColor(s)) return fallback;
  const h = s.trim().replace(/^#/, "");
  return `#${(h.length === 3 ? h.split("").map((c) => c + c).join("") : h).toLowerCase()}`;
};

function luminance(hex: string) {
  const { r, g, b } = hexToRgb01(hex);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const DARK = "#1c1c1e";
const LIGHT = "#ffffff";
export const textOn = (bg: string) => (contrast(DARK, bg) >= contrast(LIGHT, bg) ? DARK : LIGHT);

function mix(a: string, b: string, t: number) {
  const p = hexToRgb01(a);
  const q = hexToRgb01(b);
  const ch = (u: number, v: number) => Math.round((u * (1 - t) + v * t) * 255).toString(16).padStart(2, "0");
  return `#${ch(p.r, q.r)}${ch(p.g, q.g)}${ch(p.b, q.b)}`;
}

/* ------------------------------------------------------------------ */
/* Primitives and layout                                               */
/* ------------------------------------------------------------------ */

export type Align = "left" | "center" | "right";

export type Prim =
  | { kind: "rect"; x: number; y: number; w: number; h: number; color: string }
  | { kind: "text"; x: number; y: number; text: string; size: number; bold: boolean; color: string; align: Align }
  | { kind: "image"; x: number; y: number; w: number; h: number }
  | { kind: "qr"; x: number; y: number; size: number; n: number; runs: { r: number; c: number; len: number }[]; color: string };

export interface Fonts<T extends Measurer = Measurer> {
  regular: T;
  bold: T;
}

export interface SideModel {
  prims: Prim[];
  /** Plain-language description for screen readers. */
  description: string;
}

export interface CardModel {
  front: SideModel;
  back: SideModel;
  warnings: string[];
  qrText: string | null;
  w: number;
  h: number;
}

/** "example.com" → "https://example.com". Returns null for anything that is not http(s). */
export function websiteUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".") ? u.href : null;
  } catch {
    return null;
  }
}

/** vCard 3.0 text for the QR code. */
export function cardVcard(d: CardDesign): string {
  const c = emptyContact("3.0");
  const name = d.name.trim();
  c.fn = name || d.company.trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    c.family = parts[parts.length - 1];
    c.given = parts.slice(0, -1).join(" ");
  } else c.given = parts[0] ?? "";
  c.org = d.company.trim();
  c.title = d.title.trim();
  if (d.phone.trim()) c.phones.push({ value: d.phone.trim(), types: ["work"], pref: false });
  if (d.email.trim()) c.emails.push({ value: d.email.trim(), types: ["work"], pref: false });
  const url = websiteUrl(d.website);
  if (url) c.urls.push({ value: url, types: [], pref: false });
  if (d.address.trim()) c.addresses.push({ types: ["work"], pref: false, poBox: "", extended: "", street: d.address.trim(), city: "", region: "", postalCode: "", country: "" });
  return serializeContact(c);
}

/** QR modules as horizontal runs of dark cells (fewer rectangles in the PDF). */
export function qrRuns(text: string): { n: number; runs: { r: number; c: number; len: number }[] } {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const data = qr.modules.data;
  const runs: { r: number; c: number; len: number }[] = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!data[r * n + c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < n && data[r * n + c]) c++;
      runs.push({ r, c: start, len: c - start });
    }
  }
  return { n, runs };
}

/** Rectangles for a QR primitive (shared by every renderer). */
export function qrRects(p: Extract<Prim, { kind: "qr" }>): Box[] {
  const m = p.size / p.n;
  return p.runs.map((run) => ({ x: p.x + run.c * m, y: p.y + run.r * m, w: run.len * m, h: m }));
}

/** Fits a logo into a box keeping its aspect ratio. */
function fitLogo(logo: CardLogo, maxW: number, maxH: number) {
  const s = Math.min(maxW / Math.max(1, logo.w), maxH / Math.max(1, logo.h));
  return { w: logo.w * s, h: logo.h * s };
}

interface Ctx {
  d: CardDesign;
  fonts: Fonts;
  W: number;
  H: number;
  b: number;
}

function text(ctx: Ctx, s: string, x: number, y: number, size: number, bold: boolean, color: string, align: Align, maxW: number): Prim | null {
  const clean = cleanPdfText(s).replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const fitted = fitText(bold ? ctx.fonts.bold : ctx.fonts.regular, clean, size, maxW);
  return fitted ? { kind: "text", x, y, text: fitted, size, bold, color, align } : null;
}

const push = (list: Prim[], p: Prim | null) => {
  if (p) list.push(p);
};

function contactLines(d: CardDesign): string[] {
  return [d.phone, d.email, d.website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, ""), d.address].map((s) => s.trim()).filter(Boolean);
}

function layoutFront(ctx: Ctx): Prim[] {
  const { d, W, H, b } = ctx;
  const bg = safeHex(d.background, "#ffffff");
  const accent = safeHex(d.accent, "#1f6f5c");
  const ink = textOn(bg);
  const muted = mix(ink, bg, 0.32);
  const titleColor = contrast(accent, bg) >= 3 ? accent : muted;
  const out: Prim[] = [{ kind: "rect", x: -b, y: -b, w: W + 2 * b, h: H + 2 * b, color: bg }];
  const lines = contactLines(d);
  const lh = 9.4;

  if (d.front === "band") {
    const bandW = W * 0.36;
    out.push({ kind: "rect", x: -b, y: -b, w: bandW + b, h: H + 2 * b, color: accent });
    const onBand = textOn(accent);
    const inner = bandW - 2 * mm(3.5);
    const cx = bandW / 2;
    const company = d.company.trim();
    let logoH = 0;
    let logoBox: { w: number; h: number } | null = null;
    if (d.logo) {
      logoBox = fitLogo(d.logo, inner, H * (company ? 0.36 : 0.5));
      logoH = logoBox.h;
    }
    const gap = logoBox && company ? 7 : 0;
    const companyH = company ? 9 : 0;
    const top = (H - (logoH + gap + companyH)) / 2;
    if (logoBox) out.push({ kind: "image", x: cx - logoBox.w / 2, y: top, w: logoBox.w, h: logoBox.h });
    if (company) push(out, text(ctx, company, cx, top + logoH + gap + 7, 8.5, true, onBand, "center", inner));
    const x0 = bandW + mm(4.5);
    const maxW = W - x0 - SAFE;
    let y = SAFE + 11;
    push(out, text(ctx, d.name, x0, y, 12, true, ink, "left", maxW));
    y += 11;
    push(out, text(ctx, d.title, x0, y, 7.8, false, titleColor, "left", maxW));
    let cy = H - SAFE - (lines.length - 1) * lh;
    for (const l of lines) {
      push(out, text(ctx, l, x0, cy, 7, false, muted, "left", maxW));
      cy += lh;
    }
    return out;
  }

  if (d.front === "centered") {
    const maxW = W - 2 * SAFE;
    const cx = W / 2;
    const merged = [[d.phone, d.email].map((s) => s.trim()).filter(Boolean).join("  ·  "), d.website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, ""), d.address.trim()].filter(Boolean);
    const contactsTop = H - SAFE - (merged.length - 1) * lh - 7;
    let logoBox: { w: number; h: number } | null = null;
    if (d.logo) logoBox = fitLogo(d.logo, W * 0.4, H * 0.2);
    const blockH = (logoBox ? logoBox.h + 8 : 0) + 12 + (d.title.trim() ? 11 : 0) + (d.company.trim() ? 10 : 0) + 8;
    let y = Math.max(SAFE, (contactsTop - blockH) / 2 + 2);
    if (logoBox) {
      out.push({ kind: "image", x: cx - logoBox.w / 2, y, w: logoBox.w, h: logoBox.h });
      y += logoBox.h + 8;
    }
    y += 11;
    push(out, text(ctx, d.name, cx, y, 12.5, true, ink, "center", maxW));
    if (d.title.trim()) {
      y += 11;
      push(out, text(ctx, d.title, cx, y, 7.8, false, titleColor, "center", maxW));
    }
    if (d.company.trim()) {
      y += 10;
      push(out, text(ctx, d.company, cx, y, 7.8, true, muted, "center", maxW));
    }
    out.push({ kind: "rect", x: cx - 12, y: y + 6, w: 24, h: 1.2, color: accent });
    let cy = contactsTop + 7;
    for (const l of merged) {
      push(out, text(ctx, l, cx, cy, 6.8, false, muted, "center", maxW));
      cy += lh;
    }
    return out;
  }

  // Left aligned: accent strip along the bottom edge, logo top right.
  const strip = mm(2.5);
  out.push({ kind: "rect", x: -b, y: H - strip, w: W + 2 * b, h: strip + b, color: accent });
  let nameMax = W - 2 * SAFE;
  if (d.logo) {
    const lb = fitLogo(d.logo, W * 0.3, H * 0.3);
    out.push({ kind: "image", x: W - SAFE - lb.w, y: SAFE, w: lb.w, h: lb.h });
    nameMax -= lb.w + mm(3);
  }
  let y = SAFE + 11;
  push(out, text(ctx, d.name, SAFE, y, 12.5, true, ink, "left", nameMax));
  y += 11;
  push(out, text(ctx, d.title, SAFE, y, 7.8, false, titleColor, "left", nameMax));
  y += 10;
  push(out, text(ctx, d.company, SAFE, y, 7.8, true, muted, "left", nameMax));
  let cy = H - strip - mm(3.5) - (lines.length - 1) * lh;
  for (const l of lines) {
    push(out, text(ctx, l, SAFE, cy, 7, false, muted, "left", W - 2 * SAFE));
    cy += lh;
  }
  return out;
}

function layoutBack(ctx: Ctx, qr: { n: number; runs: { r: number; c: number; len: number }[] } | null): Prim[] {
  const { d, W, H, b } = ctx;
  const fill = d.backFill === "accent" ? safeHex(d.accent, "#1f6f5c") : safeHex(d.background, "#ffffff");
  const ink = textOn(fill);
  const muted = mix(ink, fill, 0.25);
  const out: Prim[] = [{ kind: "rect", x: -b, y: -b, w: W + 2 * b, h: H + 2 * b, color: fill }];

  const company = d.backCompany ? d.company.trim() : "";
  const tagline = d.backTagline ? d.tagline.trim() : "";
  const logo = d.backLogo ? d.logo : null;
  const hasContent = Boolean(company || tagline || logo);

  const regionX = SAFE;
  let regionW = W - 2 * SAFE;
  let align: Align = "center";
  if (qr) {
    const size = hasContent ? H * 0.56 : H * 0.62;
    const quiet = (size / (qr.n + 8)) * 4;
    const inner = size - 2 * quiet;
    const x = hasContent ? W - SAFE - size : (W - size) / 2;
    const y = (H - size) / 2;
    out.push({ kind: "rect", x, y, w: size, h: size, color: "#ffffff" });
    out.push({ kind: "qr", x: x + quiet, y: y + quiet, size: inner, n: qr.n, runs: qr.runs, color: "#111111" });
    if (hasContent) {
      regionW = x - mm(4) - SAFE;
      align = "left";
    }
  }
  if (!hasContent) return out;

  const lb = logo ? fitLogo(logo, regionW * (align === "left" ? 0.8 : 0.5), H * (company || tagline ? 0.32 : 0.5)) : null;
  const blockH = (lb ? lb.h : 0) + (lb && (company || tagline) ? 8 : 0) + (company ? 12 : 0) + (tagline ? 10 : 0);
  let y = (H - blockH) / 2;
  const ax = align === "left" ? regionX : regionX + regionW / 2;
  if (lb) {
    out.push({ kind: "image", x: align === "left" ? regionX : ax - lb.w / 2, y, w: lb.w, h: lb.h });
    y += lb.h + (company || tagline ? 8 : 0);
  }
  if (company) {
    y += 10;
    push(out, text(ctx, company, ax, y, 11, true, ink, align, regionW));
    y += 2;
  }
  if (tagline) {
    y += 10;
    push(out, text(ctx, tagline, ax, y, 7.5, false, muted, align, regionW));
  }
  return out;
}

function describe(side: "Front" | "Back", prims: Prim[], d: CardDesign, qrNote: string | null): string {
  const texts = prims.filter((p): p is Extract<Prim, { kind: "text" }> => p.kind === "text").map((p) => p.text);
  const bits = [`${side} of the card`];
  if (prims.some((p) => p.kind === "image")) bits.push("with the logo");
  if (texts.length) bits.push(`text: ${texts.join("; ")}`);
  if (prims.some((p) => p.kind === "qr") && qrNote) bits.push(qrNote);
  if (side === "Front") bits.push(`layout: ${FRONT_LAYOUTS.find((l) => l.value === d.front)?.label.toLowerCase() ?? d.front}`);
  return `${bits.join(", ")}.`;
}

/** Lays out both sides. `fonts` measure text so each renderer fits it exactly. */
export function buildCardModel(design: CardDesign, fonts: Fonts): CardModel {
  const d = normalizeDesign(design);
  const { w: W, h: H } = CARD_SIZES[d.size];
  const ctx: Ctx = { d, fonts, W, H, b: BLEED };
  const warnings: string[] = [];
  let qr: ReturnType<typeof qrRuns> | null = null;
  let qrText: string | null = null;
  let qrNote: string | null = null;
  if (d.backQr) {
    if (d.qrMode === "url") {
      qrText = websiteUrl(d.website);
      if (!qrText) warnings.push("Add a valid website (for example example.com) to show the website QR code, or switch the QR code to contact card.");
      else qrNote = `QR code linking to ${qrText}`;
    } else {
      qrText = d.name.trim() || d.company.trim() ? cardVcard(d) : null;
      if (!qrText) warnings.push("Add a name or company to build the contact card QR code.");
      else qrNote = "QR code that saves the contact card";
    }
    if (qrText) {
      try {
        qr = qrRuns(qrText);
        if (qr.n > 73) warnings.push("The QR code is very dense. Shorten the address or switch to the website QR code so it scans reliably at card size.");
      } catch {
        warnings.push("There is too much data for a QR code. Shorten the details or switch to the website QR code.");
        qrText = null;
      }
    }
  }
  const front = layoutFront(ctx);
  const back = layoutBack(ctx, qr);
  return {
    front: { prims: front, description: describe("Front", front, d, null) },
    back: { prims: back, description: describe("Back", back, d, qrNote) },
    warnings,
    qrText,
    w: W,
    h: H,
  };
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

type PdfLib = typeof import("pdf-lib");

/**
 * Builds a two-page print PDF (front, back). Fonts are supplied by the caller
 * (Noto Sans in the browser via embedUnicodeFonts, standard fonts in tests).
 * Sets TrimBox and BleedBox so print software knows the cut line.
 */
export async function buildCardPdf(
  lib: PdfLib,
  design: CardDesign,
  embedFonts: (doc: import("pdf-lib").PDFDocument) => Promise<Fonts<PDFFont>>,
): Promise<{ bytes: Uint8Array; warnings: string[]; geometry: CardGeometry }> {
  const { PDFDocument, rgb, cmyk } = lib;
  const d = normalizeDesign(design);
  const doc = await PDFDocument.create();
  doc.setTitle(d.name.trim() ? `Business card: ${d.name.trim()}` : "Business card");
  doc.setCreator("Nuvella Promo Code business card generator");
  doc.setProducer("pdf-lib");
  const fonts = await embedFonts(doc);
  const model = buildCardModel(d, fonts);
  const g = cardGeometry(d.size, d.cropMarks);

  let logoImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (d.logo) {
    const parsed = dataUrlToBytes(d.logo.dataUrl);
    if (parsed) {
      try {
        logoImage = parsed.mime === "image/png" ? await doc.embedPng(parsed.bytes) : await doc.embedJpg(parsed.bytes);
      } catch {
        model.warnings.push("The logo could not be embedded. Try saving it again as PNG or JPG.");
      }
    }
  }

  const color = (hex: string) => {
    const c = hexToRgb01(hex);
    return rgb(c.r, c.g, c.b);
  };
  const X = (x: number) => g.trim.x + x;
  const Y = (y: number) => g.trim.y + g.trimH - y;

  for (const side of [model.front, model.back]) {
    const page = doc.addPage([g.pageW, g.pageH]);
    page.setBleedBox(g.bleedBox.x, g.bleedBox.y, g.bleedBox.w, g.bleedBox.h);
    page.setTrimBox(g.trim.x, g.trim.y, g.trim.w, g.trim.h);
    for (const p of side.prims) {
      if (p.kind === "rect") {
        page.drawRectangle({ x: X(p.x), y: Y(p.y + p.h), width: p.w, height: p.h, color: color(p.color) });
      } else if (p.kind === "text") {
        const font = p.bold ? fonts.bold : fonts.regular;
        const tw = font.widthOfTextAtSize(p.text, p.size);
        const left = p.align === "center" ? p.x - tw / 2 : p.align === "right" ? p.x - tw : p.x;
        page.drawText(p.text, { x: X(left), y: Y(p.y), size: p.size, font, color: color(p.color) });
      } else if (p.kind === "image") {
        if (logoImage) page.drawImage(logoImage, { x: X(p.x), y: Y(p.y + p.h), width: p.w, height: p.h });
      } else {
        const c = color(p.color);
        // Vector QR: every run of dark modules is a filled rectangle (slightly overlapped to avoid hairline gaps).
        for (const r of qrRects(p)) page.drawRectangle({ x: X(r.x), y: Y(r.y + r.h) - 0.02, width: r.w + 0.02, height: r.h + 0.04, color: c });
      }
    }
    for (const m of g.marks) {
      page.drawLine({ start: { x: m.x1, y: m.y1 }, end: { x: m.x2, y: m.y2 }, thickness: 0.25, color: cmyk(0, 0, 0, 1) });
    }
  }
  const bytes = await doc.save();
  return { bytes, warnings: model.warnings, geometry: g };
}
