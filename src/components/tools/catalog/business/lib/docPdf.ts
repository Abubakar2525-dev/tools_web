/**
 * Renders a BizDoc (invoice, receipt, quotation, purchase order, expense
 * report) into a pdf-lib document: header with logo, parties, a multi-page
 * item table with repeated headers, totals, notes, signature lines and
 * "Page x of y" footers. Fonts are passed in so this can run with the
 * embedded Noto Sans in the browser or standard fonts in tests.
 */

import type { PDFDocument, PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { KINDS, formatDate, formatRate, type BizDoc, type Party, type Totals } from "./bizdoc";
import { formatMoney, formatScaled, parseScaled } from "./money";
import { PAGE_SIZES, cleanPdfText, dataUrlToBytes, hexToRgb01, wrapText } from "./pdfText";

export interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

type RGB = ReturnType<typeof import("pdf-lib").rgb>;

export interface RenderResult {
  pages: number;
  /** Characters the font cannot draw were replaced with "?". */
  replacedChars: string[];
}

/** Builds a function that replaces characters the font can't encode. */
export function makeSanitizer(font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  const replaced = new Set<string>();
  const clean = (text: string) =>
    Array.from(cleanPdfText(text))
      .map((ch) => {
        const cp = ch.codePointAt(0) ?? 0;
        if (ch === "\n" || supported.has(cp)) return ch;
        if (cp === 0x202f || cp === 0x00a0 || cp === 0x2009) return supported.has(0x20) ? " " : "";
        if (cp === 0x2019 || cp === 0x2018) return "'";
        if (cp === 0x201c || cp === 0x201d) return '"';
        if (cp === 0x2026 && !supported.has(cp)) return "...";
        replaced.add(ch);
        return "?";
      })
      .join("");
  return { clean, replaced, supported };
}

export async function renderBizDocPdf(pdf: PDFDocument, fonts: PdfFonts, doc: BizDoc, t: Totals): Promise<RenderResult> {
  const { rgb } = await import("pdf-lib");
  const kind = KINDS[doc.kind];
  const size = PAGE_SIZES[doc.pageSize] ?? PAGE_SIZES.a4;
  const W = size.w;
  const H = size.h;
  const M = 44;
  const FOOT = 30;
  const contentW = W - 2 * M;
  const { clean, replaced, supported } = makeSanitizer(fonts.regular);

  const a = hexToRgb01(doc.accent);
  const accent = rgb(a.r, a.g, a.b);
  const ink = rgb(0.12, 0.13, 0.14);
  const muted = rgb(0.42, 0.44, 0.46);
  const line = rgb(0.84, 0.85, 0.86);
  const soft = rgb(0.965, 0.968, 0.97);
  const white = rgb(1, 1, 1);
  // Readable header text on light accent colors.
  const lum = 0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b;
  const onAccent = lum > 0.6 ? ink : white;

  const money = (minor: number) => {
    const s = formatMoney(minor, doc.currency, doc.locale);
    const ok = Array.from(s).every((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return supported.has(cp) || cp === 0x202f || cp === 0x00a0 || cp === 0x2019;
    });
    return clean(ok ? s : formatMoney(minor, doc.currency, doc.locale, "code"));
  };

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, yy: number, sz: number, opt: { bold?: boolean; color?: RGB; align?: "left" | "right" | "center"; width?: number } = {}) => {
    const f = opt.bold ? fonts.bold : fonts.regular;
    const str = clean(s);
    if (!str) return;
    const w = f.widthOfTextAtSize(str, sz);
    let xx = x;
    if (opt.align === "right") xx = x - w;
    else if (opt.align === "center") xx = x - w / 2;
    page.drawText(str, { x: xx, y: yy, size: sz, font: f, color: opt.color ?? ink });
  };
  const wrap = (s: string, sz: number, width: number, bold = false) => wrapText(bold ? fonts.bold : fonts.regular, clean(s), sz, width);

  /* ---------------- Header ---------------- */
  let logo: PDFImage | null = null;
  if (doc.logo) {
    const decoded = dataUrlToBytes(doc.logo);
    try {
      if (decoded?.mime === "image/png") logo = await pdf.embedPng(decoded.bytes);
      else if (decoded?.mime === "image/jpeg") logo = await pdf.embedJpg(decoded.bytes);
    } catch {
      logo = null;
    }
  }
  let logoH = 0;
  if (logo) {
    const s = Math.min(150 / logo.width, 60 / logo.height, 1);
    const lw = logo.width * s;
    logoH = logo.height * s;
    page.drawImage(logo, { x: M, y: y - logoH, width: lw, height: logoH });
  }

  const title = doc.title.trim() || kind.title;
  text(title, W - M, y - 20, 22, { bold: true, color: accent, align: "right" });
  const meta: [string, string][] = [];
  if (doc.number.trim()) meta.push(["No.", doc.number]);
  if (doc.issueDate) meta.push([kind.issueLabel, formatDate(doc.issueDate, doc.locale)]);
  if (kind.secondLabel && doc.secondDate) meta.push([kind.secondLabel, formatDate(doc.secondDate, doc.locale)]);
  if (doc.reference.trim()) meta.push([kind.referenceLabel, doc.reference]);
  let my = y - 40;
  for (const [label, value] of meta) {
    const v = clean(value);
    const vw = fonts.bold.widthOfTextAtSize(v, 9.5);
    text(v, W - M, my, 9.5, { bold: true, align: "right" });
    text(label, W - M - vw - 8, my, 9.5, { color: muted, align: "right" });
    my -= 14;
  }
  y = Math.min(y - logoH, my + 4) - 22;

  /* ---------------- Parties ---------------- */
  const parties: [string, Party][] = [
    [kind.fromLabel, doc.from],
    [kind.toLabel, doc.to],
  ];
  if (kind.shipToLabel && (doc.shipTo.name.trim() || doc.shipTo.address.trim())) parties.push([kind.shipToLabel, doc.shipTo]);
  const colW = contentW / parties.length;
  let lowest = y;
  parties.forEach(([label, p], i) => {
    const x = M + i * colW;
    const w = colW - 14;
    let py = y;
    text(label.toUpperCase(), x, py, 7.5, { bold: true, color: accent });
    py -= 14;
    const rows: { s: string; bold?: boolean; color?: RGB }[] = [];
    if (p.name.trim()) rows.push({ s: p.name, bold: true });
    if (p.company.trim()) rows.push({ s: p.company });
    for (const l of p.address.split(/\r?\n/)) if (l.trim()) rows.push({ s: l });
    if (p.email.trim()) rows.push({ s: p.email, color: muted });
    if (p.phone.trim()) rows.push({ s: p.phone, color: muted });
    if (p.taxId.trim()) rows.push({ s: `Tax ID: ${p.taxId}`, color: muted });
    if (!rows.length) rows.push({ s: "-", color: muted });
    for (const r of rows) {
      for (const l of wrap(r.s, 9.5, w, r.bold)) {
        text(l, x, py, 9.5, { bold: r.bold, color: r.color });
        py -= 12.5;
      }
    }
    lowest = Math.min(lowest, py);
  });
  y = lowest - 16;

  /* ---------------- Items table ---------------- */
  const hasDisc = doc.items.some((it) => it.discount.trim() && parseScaled(it.discount, 3));
  const hasTax = doc.items.some((it) => it.taxRate.trim() && parseScaled(it.taxRate, 3));
  type Col = { key: string; label: string; w: number; align: "left" | "right" };
  const cols: Col[] = [];
  if (kind.expense) {
    cols.push({ key: "date", label: "Date", w: 66, align: "left" });
    cols.push({ key: "category", label: "Category", w: 92, align: "left" });
    cols.push({ key: "description", label: "Description", w: 0, align: "left" });
  } else {
    cols.push({ key: "description", label: "Description", w: 0, align: "left" });
    cols.push({ key: "qty", label: "Qty", w: 44, align: "right" });
    cols.push({ key: "unit", label: "Unit price", w: 84, align: "right" });
    if (hasDisc) cols.push({ key: "disc", label: "Disc.", w: 42, align: "right" });
  }
  if (hasTax) cols.push({ key: "tax", label: "Tax", w: 42, align: "right" });
  cols.push({ key: "amount", label: "Amount", w: 92, align: "right" });
  const fixedW = cols.reduce((s, c) => s + c.w, 0);
  const flex = cols.find((c) => c.w === 0);
  if (flex) flex.w = Math.max(80, contentW - fixedW);
  const colX: number[] = [];
  cols.reduce((x, c) => {
    colX.push(x);
    return x + c.w;
  }, M);
  const PAD = 6;
  const HEAD_H = 20;
  const ROW_LH = 11.5;

  const drawHeader = () => {
    page.drawRectangle({ x: M, y: y - HEAD_H, width: contentW, height: HEAD_H, color: accent });
    cols.forEach((c, i) => {
      const x = c.align === "right" ? colX[i] + c.w - PAD : colX[i] + PAD;
      text(c.label, x, y - 13.5, 8.5, { bold: true, color: onAccent, align: c.align });
    });
    y -= HEAD_H;
  };
  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
    text(`${title} ${doc.number}`.trim(), M, y - 8, 8.5, { color: muted });
    text("continued", W - M, y - 8, 8.5, { color: muted, align: "right" });
    y -= 24;
  };

  drawHeader();
  doc.items.forEach((it, idx) => {
    const lc = t.lines[idx];
    const cells: Record<string, string[]> = {};
    const descCol = cols.find((c) => c.key === "description") as Col;
    cells.description = wrap(it.description.trim() || "-", 9.5, descCol.w - 2 * PAD);
    cells.date = [it.date ? formatDate(it.date, doc.locale) : ""];
    const catCol = cols.find((c) => c.key === "category");
    cells.category = catCol ? wrap(it.category, 9, catCol.w - 2 * PAD) : [];
    cells.qty = [lc.qty !== null ? formatScaled(lc.qty, 3, doc.locale) : "?"];
    cells.unit = [lc.unit !== null ? money(lc.unit) : "?"];
    cells.disc = [lc.errors.discount || !it.discount.trim() ? "" : `${it.discount.replace(/%$/, "")}%`];
    cells.tax = [lc.rate ? formatRate(lc.rate) : ""];
    cells.amount = [money(lc.net)];
    const n = Math.max(...cols.map((c) => cells[c.key]?.length ?? 1), 1);
    const rowH = n * ROW_LH + 9;
    if (y - rowH < M + FOOT) {
      newPage();
      drawHeader();
    }
    if (idx % 2 === 1) page.drawRectangle({ x: M, y: y - rowH, width: contentW, height: rowH, color: soft });
    cols.forEach((c, i) => {
      const linesOut = cells[c.key] ?? [];
      linesOut.forEach((l, li) => {
        const x = c.align === "right" ? colX[i] + c.w - PAD : colX[i] + PAD;
        text(l, x, y - 13 - li * ROW_LH, c.key === "category" ? 9 : 9.5, { align: c.align, bold: c.key === "amount" });
      });
    });
    y -= rowH;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: line });
  });
  y -= 14;

  /* ---------------- Totals ---------------- */
  type TRow = { label: string; value: string; strong?: boolean; band?: boolean };
  const rows: TRow[] = [{ label: doc.pricesIncludeTax ? "Subtotal (incl. tax)" : "Subtotal", value: money(t.subtotal) }];
  if (t.discount) {
    const lbl = doc.discountType === "percent" ? `Discount (${doc.discountValue.replace(/%$/, "")}%)` : "Discount";
    rows.push({ label: lbl, value: money(-t.discount) });
  }
  for (const x of t.taxes) rows.push({ label: `${doc.pricesIncludeTax ? "Includes tax" : "Tax"} ${formatRate(x.rate)} on ${money(x.base)}`, value: money(x.tax) });
  if (t.shipping) rows.push({ label: "Shipping", value: money(t.shipping) });
  rows.push({ label: "Total", value: money(t.total), strong: true, band: true });
  if (doc.kind === "receipt") {
    rows.push({ label: kind.paidLabel, value: money(t.paid), strong: true });
    if (t.balance !== 0) rows.push({ label: kind.balanceLabel, value: money(t.balance) });
  } else if (t.paid) {
    rows.push({ label: kind.paidLabel, value: money(-t.paid) });
    rows.push({ label: kind.balanceLabel, value: money(t.balance), strong: true });
  }
  const totW = Math.min(270, contentW);
  const totX = W - M - totW;
  const catRows = kind.expense ? t.byCategory : [];
  const leftH = catRows.length ? 18 + catRows.length * 14 : 0;
  const totH = rows.length * 17 + (doc.kind === "receipt" && doc.paymentMethod.trim() ? 18 : 0);
  if (y - Math.max(totH, leftH) < M + FOOT) newPage();
  const topY = y;
  for (const r of rows) {
    if (r.band) {
      page.drawRectangle({ x: totX, y: y - 18, width: totW, height: 21, color: accent });
      text(r.label, totX + 8, y - 11.5, 10.5, { bold: true, color: onAccent });
      text(r.value, W - M - 8, y - 11.5, 10.5, { bold: true, color: onAccent, align: "right" });
      y -= 25;
      continue;
    }
    const lw = totW - 16 - fonts.bold.widthOfTextAtSize(clean(r.value), 9.5) - 10;
    const label = wrap(r.label, 9, lw)[0] ?? "";
    text(label, totX + 8, y - 10, 9, { color: r.strong ? ink : muted, bold: r.strong });
    text(r.value, W - M - 8, y - 10, 9.5, { bold: r.strong, align: "right" });
    y -= 17;
  }
  if (doc.kind === "receipt" && doc.paymentMethod.trim()) {
    text(`Payment method: ${doc.paymentMethod}`, W - M - 8, y - 10, 9, { color: muted, align: "right" });
    y -= 18;
  }
  if (catRows.length) {
    let cy = topY;
    const cw = Math.min(220, totX - M - 20);
    text("BY CATEGORY", M, cy - 10, 7.5, { bold: true, color: accent });
    cy -= 18;
    for (const c of catRows) {
      const v = money(c.amount);
      const vw = fonts.regular.widthOfTextAtSize(v, 9);
      text(wrap(c.category, 9, cw - vw - 10)[0] ?? "", M, cy - 10, 9, { color: muted });
      text(v, M + cw, cy - 10, 9, { align: "right" });
      cy -= 14;
    }
    y = Math.min(y, cy);
  }
  y -= 12;

  /* ---------------- Notes & terms ---------------- */
  const block = (heading: string, body: string) => {
    if (!body.trim()) return;
    const lines = wrap(body, 9.5, contentW);
    if (y - 30 < M + FOOT) newPage();
    text(heading.toUpperCase(), M, y - 8, 7.5, { bold: true, color: accent });
    y -= 22;
    for (const l of lines) {
      if (y - 12 < M + FOOT) newPage();
      text(l, M, y, 9.5);
      y -= 12.5;
    }
    y -= 8;
  };
  block("Notes", doc.notes);
  block(doc.kind === "quote" ? "Terms and conditions" : doc.kind === "expense" ? "Declaration" : "Terms", doc.terms);

  /* ---------------- Signatures ---------------- */
  const sigs = doc.showSignatures ? doc.signatures.map((s) => s.trim()).filter(Boolean).slice(0, 4) : [];
  if (sigs.length) {
    const perRow = Math.min(2, sigs.length);
    const gap = 30;
    const sw = (contentW - gap * (perRow - 1)) / perRow;
    const rowsNeeded = Math.ceil(sigs.length / perRow);
    if (y - rowsNeeded * 62 - 10 < M + FOOT) newPage();
    y -= 34;
    sigs.forEach((label, i) => {
      const col = i % perRow;
      if (i > 0 && col === 0) y -= 62;
      const x = M + col * (sw + gap);
      page.drawLine({ start: { x, y }, end: { x: x + sw * 0.62, y }, thickness: 0.8, color: ink });
      page.drawLine({ start: { x: x + sw * 0.7, y }, end: { x: x + sw, y }, thickness: 0.8, color: ink });
      text(label, x, y - 12, 8.5, { color: muted });
      text("Date", x + sw * 0.7, y - 12, 8.5, { color: muted });
    });
    y -= 24;
  }

  /* ---------------- Footer ---------------- */
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    page = p;
    const label = `Page ${i + 1} of ${pages.length}`;
    text(label, W - M, M - 18, 8, { color: muted, align: "right" });
    const left = [title, doc.number].filter((s) => s.trim()).join(" ");
    text(left, M, M - 18, 8, { color: muted });
  });

  pdf.setTitle(clean(`${title} ${doc.number}`.trim()));
  if (doc.from.company.trim() || doc.from.name.trim()) pdf.setAuthor(clean(doc.from.company.trim() || doc.from.name.trim()));
  pdf.setCreator("Nuvella Promo Code business tools");
  pdf.setProducer("pdf-lib");

  return { pages: pages.length, replacedChars: Array.from(replaced) };
}
