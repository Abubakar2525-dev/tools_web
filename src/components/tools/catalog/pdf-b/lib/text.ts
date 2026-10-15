/** Pure text helpers for the pdf-b tools (no React, no PDF libraries). */

/** Parses "#rgb" or "#rrggbb" into 0..1 channels. */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } | null {
  let s = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  const n = parseInt(s, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/** Local date as YYYY-MM-DD. */
export function isoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Replaces {page} / {n}, {total} and {date} tokens. Unknown tokens are kept
 * as typed so mistakes are visible in the output.
 */
export function fillTokens(template: string, vars: { page: number; total: number; date: string }) {
  return template.replace(/\{(page|n|total|date)\}/gi, (_, k: string) => {
    const key = k.toLowerCase();
    if (key === "page" || key === "n") return String(vars.page);
    if (key === "total") return String(vars.total);
    return vars.date;
  });
}

/**
 * Page labels for numbering. Returns one entry per page: the number to print,
 * or null when the page is skipped. `total` is the last number printed.
 */
export function pageNumberPlan(pageCount: number, start: number, skipFirst: boolean) {
  const numbers: (number | null)[] = [];
  let next = start;
  for (let i = 0; i < pageCount; i++) {
    if (i === 0 && skipFirst) numbers.push(null);
    else numbers.push(next++);
  }
  const printed = numbers.filter((n): n is number => n !== null);
  return { numbers, total: printed.length ? printed[printed.length - 1] : 0 };
}

/** True for http(s), mailto and tel links; returns the cleaned URL or an error message. */
export function normalizeUrl(raw: string): { url: string } | { error: string } {
  const s = raw.trim();
  if (!s) return { error: "Enter a link address." };
  if (/^(mailto:|tel:)/i.test(s)) return { url: s };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { error: "Only web (http/https), mailto: and tel: links are allowed." };
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return { error: "That doesn't look like a full web address." };
    return { url: u.href };
  } catch {
    return { error: "That doesn't look like a valid web address." };
  }
}

/* ------------------------------------------------------------------ */
/* PDF dates                                                           */
/* ------------------------------------------------------------------ */

/** Formats a Date for a `datetime-local` input (local time). */
export function toLocalInput(d: Date | undefined) {
  if (!d || Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Keywords string → list (comma or semicolon separated, trimmed, no blanks). */
export function splitKeywords(s: string) {
  return s
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Text extraction for comparison                                      */
/* ------------------------------------------------------------------ */

export interface TextChunk {
  str: string;
  /** Baseline x, y in user space (from the text matrix). */
  x: number;
  y: number;
  /** Approximate glyph height. */
  h: number;
  /** Advance width in user space, when known. */
  w?: number;
}

/**
 * Groups positioned text chunks into reading lines: chunks whose baselines
 * are within half a line height are joined (sorted left to right). Lines are
 * ordered top to bottom. Whitespace is collapsed.
 */
export function chunksToLines(chunks: TextChunk[]): string[] {
  const items = chunks.filter((c) => c.str.length > 0);
  const rows: { y: number; h: number; parts: TextChunk[] }[] = [];
  for (const c of items) {
    const tol = Math.max(2, (c.h || 10) * 0.5);
    const row = rows.find((r) => Math.abs(r.y - c.y) <= tol);
    if (row) row.parts.push(c);
    else rows.push({ y: c.y, h: c.h, parts: [c] });
  }
  rows.sort((a, b) => b.y - a.y);
  const lines: string[] = [];
  for (const r of rows) {
    r.parts.sort((a, b) => a.x - b.x);
    let line = "";
    let lastEnd = -Infinity;
    for (const p of r.parts) {
      const width = p.w ?? p.str.length * (p.h || 10) * 0.5;
      const gap = p.x - lastEnd;
      if (line && !/\s$/.test(line) && !/^\s/.test(p.str) && gap > (p.h || 10) * 0.15) line += " ";
      line += p.str;
      lastEnd = p.x + width;
    }
    const clean = line.replace(/\s+/g, " ").trim();
    if (clean) lines.push(clean);
  }
  return lines;
}

export interface TaggedLine {
  text: string;
  page: number;
}

export type DiffRow =
  | { type: "same"; a: TaggedLine; b: TaggedLine }
  | { type: "removed"; a: TaggedLine }
  | { type: "added"; b: TaggedLine };

/** Minimal shape of the `diff` package's array change objects. */
export interface ArrayChangeLike<T> {
  value: T[];
  added?: boolean;
  removed?: boolean;
  count?: number;
}

/** Turns array-diff changes (computed on comparison keys) back into tagged rows. */
export function changesToRows(changes: ArrayChangeLike<string>[], a: TaggedLine[], b: TaggedLine[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let ia = 0;
  let ib = 0;
  for (const ch of changes) {
    const n = ch.count ?? ch.value.length;
    for (let k = 0; k < n; k++) {
      if (ch.added) rows.push({ type: "added", b: b[ib++] });
      else if (ch.removed) rows.push({ type: "removed", a: a[ia++] });
      else rows.push({ type: "same", a: a[ia++], b: b[ib++] });
    }
  }
  return rows;
}

/** Key used for matching lines, honouring the case/whitespace options. */
export function compareKey(s: string, ignoreCase: boolean, ignoreWhitespace: boolean) {
  let k = s;
  if (ignoreWhitespace) k = k.replace(/\s+/g, "");
  if (ignoreCase) k = k.toLowerCase();
  return k;
}

export interface PageSummary {
  page: number;
  removed: number;
  added: number;
}

/** Per-page change counts: removals counted on the first file's page, additions on the second's. */
export function summarizeRows(rows: DiffRow[], pagesA: number, pagesB: number): PageSummary[] {
  const n = Math.max(pagesA, pagesB);
  const out: PageSummary[] = Array.from({ length: n }, (_, i) => ({ page: i + 1, removed: 0, added: 0 }));
  for (const r of rows) {
    if (r.type === "removed") out[r.a.page - 1].removed++;
    else if (r.type === "added") out[r.b.page - 1].added++;
  }
  return out;
}

/** Pairs consecutive removed/added runs so side-by-side view lines up edits. */
export function sideBySide(rows: DiffRow[]): { left: TaggedLine | null; right: TaggedLine | null; type: "same" | "changed" | "removed" | "added" }[] {
  const out: { left: TaggedLine | null; right: TaggedLine | null; type: "same" | "changed" | "removed" | "added" }[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    if (r.type === "same") {
      out.push({ left: r.a, right: r.b, type: "same" });
      i++;
      continue;
    }
    const rem: TaggedLine[] = [];
    const add: TaggedLine[] = [];
    while (i < rows.length && rows[i].type !== "same") {
      const x = rows[i];
      if (x.type === "removed") rem.push(x.a);
      else if (x.type === "added") add.push(x.b);
      i++;
    }
    const m = Math.max(rem.length, add.length);
    for (let k = 0; k < m; k++) {
      const l = rem[k] ?? null;
      const rr = add[k] ?? null;
      out.push({ left: l, right: rr, type: l && rr ? "changed" : l ? "removed" : "added" });
    }
  }
  return out;
}

/** Unified-style plain-text report of the diff. */
export function rowsToReport(rows: DiffRow[], nameA: string, nameB: string) {
  const lines = [`--- ${nameA}`, `+++ ${nameB}`];
  for (const r of rows) {
    if (r.type === "same") lines.push(`  ${r.a.text}`);
    else if (r.type === "removed") lines.push(`- [p${r.a.page}] ${r.a.text}`);
    else lines.push(`+ [p${r.b.page}] ${r.b.text}`);
  }
  return lines.join("\n");
}

/** Fast non-cryptographic hash (FNV-1a, 32-bit) for de-duplicating byte arrays. */
export function fnv1a(bytes: Uint8Array | Uint8ClampedArray, step = 1) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += step) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Reads the EXIF orientation (1-8) from JPEG bytes; 1 when absent or unreadable. */
export function jpegOrientation(b: Uint8Array): number {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) return 1;
    const marker = b[i + 1];
    const len = (b[i + 2] << 8) | b[i + 3];
    if (marker === 0xda || len < 2) return 1;
    if (marker === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
      const t = i + 10;
      const le = b[t] === 0x49;
      const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
      const u32 = (o: number) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000 : b[o] * 0x1000000 + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]));
      const ifd = t + u32(t + 4);
      if (ifd + 2 > b.length) return 1;
      const n = u16(ifd);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 10 > b.length) return 1;
        if (u16(e) === 0x0112) {
          const v = u16(e + 8);
          return v >= 1 && v <= 8 ? v : 1;
        }
      }
      return 1;
    }
    i += 2 + len;
  }
  return 1;
}
