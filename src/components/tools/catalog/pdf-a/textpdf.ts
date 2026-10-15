/** Paginated text layout on top of pdf-lib, shared by text-to-pdf and eml-to-pdf. */

import type { PDFDocument, PDFFont, PDFPage, RGB } from "pdf-lib";
import { embedUnicodeFonts, getPdfLib } from "@/components/tools/engines/pdf";
import { wrapText } from "./lib/text";

/** Removes control characters a font cannot draw (keeps newlines and tabs). */
export const cleanText = (s: string) => s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​﻿]/g, "");

export class TextWriter {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  constructor(
    readonly doc: PDFDocument,
    readonly fonts: { regular: PDFFont; bold: PDFFont },
    readonly w: number,
    readonly h: number,
    readonly margin: { top: number; right: number; bottom: number; left: number },
    readonly rgb: (r: number, g: number, b: number) => RGB,
  ) {
    this.newPage();
  }

  static async create(w: number, h: number, margin: { top: number; right: number; bottom: number; left: number }) {
    const { PDFDocument, rgb } = await getPdfLib();
    const doc = await PDFDocument.create();
    const fonts = await embedUnicodeFonts(doc);
    return new TextWriter(doc, fonts, w, h, margin, rgb);
  }

  get width() {
    return this.w - this.margin.left - this.margin.right;
  }

  newPage() {
    this.page = this.doc.addPage([this.w, this.h]);
    this.pages.push(this.page);
    this.y = this.h - this.margin.top;
  }

  space(pt: number) {
    this.y -= pt;
    if (this.y < this.margin.bottom) this.newPage();
  }

  /** Writes wrapped text. `lineHeight` is a multiple of the font size. */
  text(s: string, opts: { size: number; bold?: boolean; lineHeight?: number; indent?: number; color?: RGB } = { size: 11 }) {
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const lh = opts.size * (opts.lineHeight ?? 1.35);
    const indent = opts.indent ?? 0;
    const lines = wrapText(cleanText(s), this.width - indent, (t) => font.widthOfTextAtSize(t, opts.size));
    for (const line of lines) {
      if (this.y - lh < this.margin.bottom - 0.01) this.newPage();
      this.y -= lh;
      if (line) this.page.drawText(line, { x: this.margin.left + indent, y: this.y + (lh - opts.size) / 2 + opts.size * 0.18, size: opts.size, font, color: opts.color ?? this.rgb(0.1, 0.1, 0.1) });
    }
  }

  rule() {
    this.space(6);
    this.page.drawLine({ start: { x: this.margin.left, y: this.y }, end: { x: this.w - this.margin.right, y: this.y }, thickness: 0.6, color: this.rgb(0.75, 0.75, 0.75) });
    this.space(8);
  }

  /** Writes "Page n of N" centered in the bottom margin of every page. */
  pageNumbers(size = 8) {
    const total = this.pages.length;
    this.pages.forEach((p, i) => {
      const t = `Page ${i + 1} of ${total}`;
      const tw = this.fonts.regular.widthOfTextAtSize(t, size);
      p.drawText(t, { x: (this.w - tw) / 2, y: Math.max(8, this.margin.bottom / 2 - size / 2), size, font: this.fonts.regular, color: this.rgb(0.45, 0.45, 0.45) });
    });
  }
}
