/**
 * Pure text helpers: grouping pdf.js text items into lines, converting lines to
 * Markdown, and greedy word wrapping for generated PDFs.
 */

/** The subset of a pdf.js TextItem these helpers need. */
export type RawItem = { str: string; transform: readonly number[]; width: number; height: number; hasEOL?: boolean };

export type Line = { text: string; x: number; y: number; size: number };

const fontSizeOf = (it: RawItem) => {
  const s = Math.hypot(it.transform[2] ?? 0, it.transform[3] ?? 0);
  return s > 0 ? s : Math.abs(it.height) || 10;
};

/**
 * Groups items (in content-stream order) into visual lines. A new line starts
 * after an explicit end-of-line or when the baseline moves by more than half the
 * font size. Spaces are inserted where a horizontal gap separates two items.
 */
export function groupLines(items: readonly RawItem[]): Line[] {
  const lines: Line[] = [];
  let cur: (Line & { endX: number; chars: number; sizeSum: number }) | null = null;
  let breakNext = false;
  const flush = () => {
    if (cur) {
      const text = cur.text.replace(/\s+$/, "");
      if (text.trim()) lines.push({ text, x: cur.x, y: cur.y, size: cur.chars ? cur.sizeSum / cur.chars : cur.size });
    }
    cur = null;
  };
  for (const it of items) {
    const x = it.transform[4] ?? 0;
    const y = it.transform[5] ?? 0;
    const size = fontSizeOf(it);
    const str = it.str ?? "";
    if (cur && (breakNext || Math.abs(y - cur.y) > Math.max(cur.size, size) * 0.5)) flush();
    breakNext = false;
    if (!str) {
      if (it.hasEOL) breakNext = true;
      continue;
    }
    const n = str.replace(/\s/g, "").length;
    if (!cur) {
      cur = { text: str, x, y, size, endX: x + it.width, chars: n, sizeSum: size * n };
    } else {
      const gap = x - cur.endX;
      const needsSpace = gap > Math.min(size, cur.size) * 0.15 && !/\s$/.test(cur.text) && !/^\s/.test(str);
      cur.text += (needsSpace ? " " : "") + str;
      cur.endX = Math.max(cur.endX, x + it.width);
      cur.x = Math.min(cur.x, x);
      cur.chars += n;
      cur.sizeSum += size * n;
      if (size > cur.size) cur.size = size;
    }
    if (it.hasEOL) breakNext = true;
  }
  flush();
  return lines;
}

/** Plain text for one page: lines joined, with a blank line at large vertical gaps. */
export function linesToText(lines: readonly Line[]): string {
  let out = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (i > 0) {
      const prev = lines[i - 1];
      const gap = prev.y - l.y;
      out += gap > Math.max(prev.size, l.size) * 1.9 ? "\n\n" : "\n";
    }
    out += l.text;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

const BULLET_RE = /^\s*(?:([•◦▪▫●○■□‣⁃∙·➢➤►✓✔])\s*|([-–—*])\s+)(?=\S)/u;
const NUMBER_RE = /^\s*(\d{1,3})[.)]\s+(?=\S)/;
const LETTER_RE = /^\s*\(?([a-zA-Z]|[ivxIVX]{1,4})[.)]\s+(?=\S)/;

const round = (n: number) => Math.round(n * 2) / 2;

/** The font size that covers the most characters (rounded to 0.5 pt). */
export function bodySize(lines: readonly Line[]): number {
  const counts = new Map<number, number>();
  for (const l of lines) counts.set(round(l.size), (counts.get(round(l.size)) ?? 0) + l.text.length);
  let best = 0;
  let bestN = -1;
  for (const [s, n] of counts) if (n > bestN || (n === bestN && s < best)) [best, bestN] = [s, n];
  return best || 10;
}

/** Maps larger font sizes to heading levels 1..4. */
export function headingLevels(lines: readonly Line[], body: number): Map<number, number> {
  const sizes = [...new Set(lines.filter((l) => round(l.size) >= body * 1.15 && l.text.length <= 150).map((l) => round(l.size)))].sort(
    (a, b) => b - a,
  );
  const map = new Map<number, number>();
  sizes.forEach((s, i) => map.set(s, Math.min(4, i + 1)));
  return map;
}

function escapeLead(text: string) {
  return text.replace(/^(#{1,6}\s|>|\d+[.)]\s|[-*+]\s)/, (m) => `\\${m}`);
}

type Block = { kind: "h"; level: number; text: string; size: number; y: number } | { kind: "p"; text: string; y: number; size: number } | { kind: "li"; marker: string; text: string; indent: number; x: number; y: number; size: number };

function joinText(a: string, b: string) {
  if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  return `${a} ${b}`;
}

/**
 * Converts pages of lines into Markdown. Headings come from font sizes larger
 * than the body size; bullet and numbered lines become list items; wrapped body
 * lines are joined into paragraphs (hyphenated line breaks are rejoined).
 */
export function linesToMarkdown(pages: readonly (readonly Line[])[], opts: { pageBreaks?: boolean } = {}): string {
  const all = pages.flat();
  if (!all.length) return "";
  const body = bodySize(all);
  const levels = headingLevels(all, body);
  const out: string[] = [];

  pages.forEach((lines, pi) => {
    const blocks: Block[] = [];
    let listBaseX: number | null = null;
    for (const l of lines) {
      const text = l.text.trim();
      const last = blocks[blocks.length - 1];
      const gap = last ? last.y - l.y : Infinity;
      const close = gap > 0 && gap <= Math.max(l.size, last?.size ?? 0) * 1.75;
      const level = levels.get(round(l.size));
      if (level) {
        if (last && last.kind === "h" && last.level === level && close) {
          last.text = joinText(last.text, text);
          last.y = l.y;
        } else blocks.push({ kind: "h", level, text, size: l.size, y: l.y });
        listBaseX = null;
        continue;
      }
      const bullet = BULLET_RE.exec(text);
      const num = !bullet ? NUMBER_RE.exec(text) : null;
      const letter = !bullet && !num ? LETTER_RE.exec(text) : null;
      const m = bullet ?? num ?? letter;
      // A lone "-" followed by a capitalised sentence is a list; a leading hyphen in a word is not.
      if (m && (bullet || num || letter) && text.length > m[0].length) {
        if (listBaseX === null || l.x < listBaseX) listBaseX = l.x;
        const indent = Math.max(0, Math.min(3, Math.round((l.x - listBaseX) / 12)));
        const marker = num ? `${num[1]}.` : letter ? `- ${letter[1]}.` : "-";
        blocks.push({ kind: "li", marker, text: text.slice(m[0].length).trim(), indent, x: l.x, y: l.y, size: l.size });
        continue;
      }
      if (last && last.kind === "li" && close && l.x > last.x + 2) {
        last.text = joinText(last.text, text);
        last.y = l.y;
        continue;
      }
      if (last && last.kind === "p" && close && Math.abs(l.size - last.size) < 1) {
        last.text = joinText(last.text, text);
        last.y = l.y;
        continue;
      }
      listBaseX = last && last.kind === "li" && close ? listBaseX : null;
      blocks.push({ kind: "p", text, y: l.y, size: l.size });
    }

    if (pi > 0 && blocks.length) out.push(opts.pageBreaks ? "\n---\n" : "");
    let prevKind: Block["kind"] | null = null;
    for (const b of blocks) {
      if (b.kind === "h") {
        if (out.length) out.push("");
        out.push(`${"#".repeat(b.level)} ${b.text.replace(/\s+/g, " ")}`);
        out.push("");
      } else if (b.kind === "li") {
        if (prevKind && prevKind !== "li" && out[out.length - 1] !== "") out.push("");
        out.push(`${"  ".repeat(b.indent)}${b.marker} ${b.text}`);
      } else {
        if (prevKind === "li" || (out.length && out[out.length - 1] !== "")) out.push("");
        out.push(escapeLead(b.text));
        out.push("");
      }
      prevKind = b.kind;
    }
    if (prevKind === "li") out.push("");
  });

  return (
    out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

/* ------------------------------------------------------------------ */
/* Wrapping                                                            */
/* ------------------------------------------------------------------ */

/**
 * Greedy word wrap. `measure` returns the width of a string in the same unit as
 * `maxWidth`. Words longer than a line are broken by characters. Blank lines are kept.
 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, tabSize = 4): string[] {
  const out: string[] = [];
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n");
  for (const rawPara of paragraphs) {
    const para = rawPara.replace(/\t/g, " ".repeat(tabSize)).replace(/\s+$/, "");
    if (!para) {
      out.push("");
      continue;
    }
    const lead = /^ */.exec(para)?.[0] ?? "";
    const tokens = para.slice(lead.length).split(/( +)/).filter(Boolean);
    let line = lead;
    const pushWord = (word: string) => {
      // Break a single over-long word across lines (by code point).
      let rest = Array.from(word);
      while (rest.length) {
        if (line.trim() && measure(line + rest[0]) > maxWidth) {
          out.push(line.replace(/ +$/, ""));
          line = "";
        }
        let i = rest.length;
        while (i > 1 && measure(line + rest.slice(0, i).join("")) > maxWidth) i--;
        line += rest.slice(0, i).join("");
        rest = rest.slice(i);
        if (rest.length) {
          out.push(line);
          line = "";
        }
      }
    };
    for (const tok of tokens) {
      if (/^ +$/.test(tok)) {
        if (line.trim()) line += tok;
        continue;
      }
      if (measure(line + tok) <= maxWidth) line += tok;
      else if (line.trim() && measure(tok) <= maxWidth) {
        out.push(line.replace(/ +$/, ""));
        line = tok;
      } else {
        if (line.trim()) {
          out.push(line.replace(/ +$/, ""));
          line = "";
        }
        pushWord(tok);
      }
    }
    out.push(line.replace(/ +$/, ""));
  }
  return out;
}
