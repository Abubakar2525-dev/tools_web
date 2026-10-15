/**
 * Letterhead model and PDF renderer. The header is drawn on every page
 * (full on page 1, compact afterwards), the footer on every page, and the
 * letter body is wrapped and paginated.
 */

import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import { PAGE_SIZES, dataUrlToBytes, hexToRgb01, wrapText, type PageSizeId } from "./pdfText";
import { makeSanitizer, type PdfFonts } from "./docPdf";

export type LetterLayout = "classic" | "centered" | "band" | "sidebar";

export interface Letterhead {
  company: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  registration: string;
  footer: string;
  logo: string | null;
  accent: string;
  layout: LetterLayout;
  pageSize: PageSizeId;
  body: string;
  fontSize: number;
}

export const LAYOUTS: { value: LetterLayout; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "centered", label: "Centered" },
  { value: "band", label: "Color band" },
  { value: "sidebar", label: "Sidebar" },
];

export const blankLetterhead = (): Letterhead => ({
  company: "",
  tagline: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  registration: "",
  footer: "",
  logo: null,
  accent: "#1f6f5c",
  layout: "classic",
  pageSize: "a4",
  body: "",
  fontSize: 10.5,
});

const s = (v: unknown, max = 20000) => (typeof v === "string" ? v.slice(0, max) : "");

export function normalizeLetterhead(v: unknown): Letterhead {
  const b = blankLetterhead();
  if (!v || typeof v !== "object" || Array.isArray(v)) return b;
  const o = v as Record<string, unknown>;
  const layout = LAYOUTS.some((l) => l.value === o.layout) ? (o.layout as LetterLayout) : b.layout;
  const fs = typeof o.fontSize === "number" && o.fontSize >= 8 && o.fontSize <= 14 ? o.fontSize : b.fontSize;
  return {
    company: s(o.company, 200),
    tagline: s(o.tagline, 200),
    address: s(o.address, 500),
    phone: s(o.phone, 80),
    email: s(o.email, 200),
    website: s(o.website, 200),
    registration: s(o.registration, 200),
    footer: s(o.footer, 400),
    logo: typeof o.logo === "string" && /^data:image\/(png|jpeg);base64,/.test(o.logo) && o.logo.length < 3_000_000 ? o.logo : null,
    accent: typeof o.accent === "string" && /^#[0-9a-f]{6}$/i.test(o.accent) ? o.accent : b.accent,
    layout,
    pageSize: o.pageSize === "letter" ? "letter" : "a4",
    body: s(o.body),
    fontSize: fs,
  };
}

/** Contact lines shown in the header, in order. */
export function contactLines(l: Letterhead, joinPhoneEmail = true): string[] {
  const pe = [l.phone.trim(), l.email.trim()].filter(Boolean);
  return [
    ...l.address.split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
    ...(joinPhoneEmail ? [pe.join("  ·  ")] : pe),
    l.website.trim(),
  ].filter(Boolean);
}

export async function renderLetterheadPdf(pdf: PDFDocument, fonts: PdfFonts, l: Letterhead): Promise<{ pages: number; replacedChars: string[] }> {
  const { rgb } = await import("pdf-lib");
  const size = PAGE_SIZES[l.pageSize];
  const W = size.w;
  const H = size.h;
  const { clean, replaced } = makeSanitizer(fonts.regular);
  const a = hexToRgb01(l.accent);
  const accent = rgb(a.r, a.g, a.b);
  const ink = rgb(0.12, 0.13, 0.14);
  const muted = rgb(0.4, 0.42, 0.44);
  const white = rgb(1, 1, 1);
  const lum = 0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b;
  const onAccent = lum > 0.6 ? ink : white;
  const sidebar = l.layout === "sidebar";
  const SIDE_W = 150;
  const ML = sidebar ? SIDE_W + 36 : 56;
  const MR = 56;
  const contentW = W - ML - MR;

  let logo: PDFImage | null = null;
  if (l.logo) {
    const d = dataUrlToBytes(l.logo);
    try {
      if (d?.mime === "image/png") logo = await pdf.embedPng(d.bytes);
      else if (d?.mime === "image/jpeg") logo = await pdf.embedJpg(d.bytes);
    } catch {
      logo = null;
    }
  }

  const draw = (page: PDFPage, text: string, x: number, y: number, size: number, opt: { bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center" } = {}) => {
    const f = opt.bold ? fonts.bold : fonts.regular;
    const t = clean(text);
    if (!t) return;
    const w = f.widthOfTextAtSize(t, size);
    const xx = opt.align === "right" ? x - w : opt.align === "center" ? x - w / 2 : x;
    page.drawText(t, { x: xx, y, size, font: f, color: opt.color ?? ink });
  };
  const logoBox = (maxW: number, maxH: number) => {
    if (!logo) return { w: 0, h: 0 };
    const sc = Math.min(maxW / logo.width, maxH / logo.height, 1);
    return { w: logo.width * sc, h: logo.height * sc };
  };
  const contacts = contactLines(l);
  const company = l.company.trim();

  /** Draws the full header and returns the y where the body may start. */
  const fullHeader = (page: PDFPage): number => {
    const top = H - 48;
    if (l.layout === "classic") {
      const lb = logoBox(170, 64);
      if (logo) page.drawImage(logo, { x: ML, y: top - lb.h, width: lb.w, height: lb.h });
      let y = top - 4;
      const right = W - MR;
      if (company) {
        draw(page, company, right, y - 12, 15, { bold: true, color: accent, align: "right" });
        y -= 20;
      }
      if (l.tagline.trim()) {
        draw(page, l.tagline, right, y - 10, 9, { color: muted, align: "right" });
        y -= 14;
      }
      for (const c of contacts) {
        draw(page, c, right, y - 10, 8.5, { color: muted, align: "right" });
        y -= 12;
      }
      const bottom = Math.min(top - lb.h, y) - 12;
      page.drawRectangle({ x: ML, y: bottom, width: contentW, height: 1.5, color: accent });
      return bottom - 34;
    }
    if (l.layout === "centered") {
      const lb = logoBox(160, 60);
      let y = top;
      if (logo) {
        page.drawImage(logo, { x: W / 2 - lb.w / 2, y: y - lb.h, width: lb.w, height: lb.h });
        y -= lb.h + 10;
      }
      if (company) {
        draw(page, company, W / 2, y - 14, 16, { bold: true, color: accent, align: "center" });
        y -= 22;
      }
      if (l.tagline.trim()) {
        draw(page, l.tagline, W / 2, y - 10, 9, { color: muted, align: "center" });
        y -= 14;
      }
      const line = contacts.join("  ·  ");
      for (const c of wrapText(fonts.regular, clean(line), 8.5, contentW)) {
        draw(page, c, W / 2, y - 10, 8.5, { color: muted, align: "center" });
        y -= 12;
      }
      page.drawRectangle({ x: W / 2 - 40, y: y - 10, width: 80, height: 1.5, color: accent });
      return y - 44;
    }
    if (l.layout === "band") {
      const bandH = Math.max(86, 40 + contacts.length * 11);
      page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: accent });
      const lb = logoBox(120, bandH - 36);
      let x = ML;
      if (logo) {
        // White plate keeps any logo legible on the color band.
        page.drawRectangle({ x: ML - 6, y: H - bandH / 2 - lb.h / 2 - 6, width: lb.w + 12, height: lb.h + 12, color: white });
        page.drawImage(logo, { x: ML, y: H - bandH / 2 - lb.h / 2, width: lb.w, height: lb.h });
        x += lb.w + 22;
      }
      let ty = H - bandH / 2 + (l.tagline.trim() ? 4 : -5);
      if (company) draw(page, company, x, ty, 16, { bold: true, color: onAccent });
      if (l.tagline.trim()) draw(page, l.tagline, x, ty - 16, 9, { color: onAccent });
      ty = H - 26;
      for (const c of contacts) {
        draw(page, c, W - MR, ty - 8, 8.5, { color: onAccent, align: "right" });
        ty -= 11;
      }
      return H - bandH - 44;
    }
    // sidebar
    return H - 72;
  };

  const sidebarPanel = (page: PDFPage) => {
    page.drawRectangle({ x: 0, y: 0, width: SIDE_W, height: H, color: accent });
    let y = H - 48;
    const lb = logoBox(SIDE_W - 40, 70);
    if (logo) {
      page.drawRectangle({ x: 14, y: y - lb.h - 6, width: lb.w + 12, height: lb.h + 12, color: white });
      page.drawImage(logo, { x: 20, y: y - lb.h, width: lb.w, height: lb.h });
      y -= lb.h + 24;
    }
    for (const line of wrapText(fonts.bold, clean(company), 13, SIDE_W - 40)) {
      draw(page, line, 20, y - 12, 13, { bold: true, color: onAccent });
      y -= 16;
    }
    if (l.tagline.trim()) {
      for (const line of wrapText(fonts.regular, clean(l.tagline), 8.5, SIDE_W - 40)) {
        draw(page, line, 20, y - 10, 8.5, { color: onAccent });
        y -= 11;
      }
    }
    y -= 14;
    for (const c of contactLines(l, false)) {
      for (const line of wrapText(fonts.regular, clean(c), 8, SIDE_W - 40)) {
        draw(page, line, 20, y - 9, 8, { color: onAccent });
        y -= 11;
      }
      y -= 3;
    }
  };

  const compactHeader = (page: PDFPage): number => {
    if (sidebar) return H - 64;
    const y = H - 40;
    if (company) draw(page, company, ML, y, 9, { bold: true, color: accent });
    page.drawRectangle({ x: ML, y: y - 8, width: contentW, height: 0.75, color: accent });
    return y - 36;
  };

  const footerLines = [l.footer.trim(), l.registration.trim()].filter(Boolean);
  const FOOT_H = 30 + footerLines.length * 11;

  const pages: PDFPage[] = [];
  const addPage = (first: boolean) => {
    const page = pdf.addPage([W, H]);
    pages.push(page);
    if (sidebar) sidebarPanel(page);
    return { page, y: first ? fullHeader(page) : compactHeader(page) };
  };

  let { page, y } = addPage(true);
  const fs = l.fontSize;
  const lh = fs * 1.45;
  const bodyLines = l.body.trim() ? wrapText(fonts.regular, clean(l.body), fs, contentW) : [];
  for (const line of bodyLines) {
    if (y - lh < FOOT_H + 24) ({ page, y } = addPage(false));
    if (line) draw(page, line, ML, y - fs, fs);
    y -= lh;
  }

  pages.forEach((p, i) => {
    let fy = 28 + (footerLines.length - 1) * 11;
    if (!sidebar) p.drawRectangle({ x: ML, y: fy + 16, width: contentW, height: 0.5, color: rgb(0.82, 0.83, 0.84) });
    for (const f of footerLines) {
      draw(p, f, ML, fy, 7.5, { color: muted });
      fy -= 11;
    }
    if (pages.length > 1) draw(p, `Page ${i + 1} of ${pages.length}`, W - MR, 28, 7.5, { color: muted, align: "right" });
  });

  pdf.setTitle(clean(company ? `${company} letter` : "Letter"));
  if (company) pdf.setAuthor(clean(company));
  pdf.setCreator("Nuvella Promo Code business tools");
  return { pages: pages.length, replacedChars: Array.from(replaced) };
}
