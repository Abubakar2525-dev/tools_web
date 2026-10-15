/** Formatting a parsed table (rows of cells). Self-contained for direct Node testing. */

/** Display width that treats wide East Asian characters and emoji as two columns. */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (/\p{M}/u.test(ch) || cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) continue;
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1faff) ||
      (cp >= 0x20000 && cp <= 0x3fffd);
    w += wide ? 2 : 1;
  }
  return w;
}

function normalize(rows: string[][]): string[][] {
  const cols = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => Array.from({ length: cols }, (_, i) => (r[i] ?? "").replace(/\r?\n/g, " ")));
}

export function toAligned(rows: string[][], gap = 2): string {
  const t = normalize(rows);
  if (!t.length) return "";
  const widths = t[0].map((_, c) => Math.max(...t.map((r) => displayWidth(r[c]))));
  return t
    .map((r) =>
      r
        .map((cell, c) => (c === r.length - 1 ? cell : cell + " ".repeat(widths[c] - displayWidth(cell) + gap)))
        .join("")
        .trimEnd(),
    )
    .join("\n");
}

export function toMarkdownTable(rows: string[][], header = true): string {
  const t = normalize(rows);
  if (!t.length) return "";
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
  const body = header ? t : [t[0].map((_, i) => `Column ${i + 1}`), ...t];
  const widths = body[0].map((_, c) => Math.max(3, ...body.map((r) => displayWidth(esc(r[c])))));
  const line = (r: string[]) => `| ${r.map((cell, c) => esc(cell) + " ".repeat(widths[c] - displayWidth(esc(cell)))).join(" | ")} |`;
  return [line(body[0]), `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`, ...body.slice(1).map(line)].join("\n");
}

export function toTsv(rows: string[][]): string {
  return normalize(rows)
    .map((r) => r.map((c) => c.replace(/\t/g, " ")).join("\t"))
    .join("\n");
}

/** Splits lines on runs of 2+ spaces or tabs (for pasted aligned columns). */
export function splitOnWhitespaceRuns(text: string, singleSpace = false): string[][] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => l.trim().split(singleSpace ? /\s+/ : /\t+| {2,}/));
}
