/**
 * Pure line and character transforms used by the text tools.
 * Self-contained (no imports) so it can be unit-tested directly with Node.
 */

/* ------------------------------------------------------------------ */
/* Basics                                                              */
/* ------------------------------------------------------------------ */

/** Splits on any newline style. "" gives [""]. */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

/** Detects the dominant newline so output keeps the user's style. */
export function newlineOf(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/** User-perceived characters. Uses Intl.Segmenter when present, code points otherwise. */
export function graphemes(text: string): string[] {
  const Seg = typeof Intl !== "undefined" ? (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter : undefined;
  if (Seg) {
    const seg = new Seg(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

const isBlank = (s: string) => s.trim() === "";

/* ------------------------------------------------------------------ */
/* Duplicate / empty lines                                             */
/* ------------------------------------------------------------------ */

export function removeDuplicateLines(
  text: string,
  o: { caseInsensitive?: boolean; trim?: boolean; keepEmpty?: boolean } = {},
): { output: string; removed: number; kept: number } {
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const line of splitLines(text)) {
    if (o.keepEmpty && isBlank(line)) {
      out.push(o.trim ? "" : line);
      continue;
    }
    let key = o.trim ? line.trim() : line;
    if (o.caseInsensitive) key = key.toLocaleLowerCase();
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    out.push(o.trim ? line.trim() : line);
  }
  return { output: out.join(newlineOf(text)), removed, kept: out.length };
}

export function removeEmptyLines(
  text: string,
  o: { mode?: "all" | "collapse"; whitespaceIsEmpty?: boolean } = {},
): { output: string; removed: number } {
  const empty = (l: string) => (o.whitespaceIsEmpty === false ? l === "" : isBlank(l));
  const out: string[] = [];
  let removed = 0;
  let prevEmpty = false;
  for (const line of splitLines(text)) {
    const e = empty(line);
    if (e && (o.mode !== "collapse" || prevEmpty)) {
      removed++;
      continue;
    }
    out.push(e ? "" : line);
    prevEmpty = e;
  }
  return { output: out.join(newlineOf(text)), removed };
}

/* ------------------------------------------------------------------ */
/* Spaces                                                              */
/* ------------------------------------------------------------------ */

export function removeExtraSpaces(
  text: string,
  o: { collapse?: boolean; trimLines?: boolean; removeAll?: boolean; tabsToSpaces?: boolean; tabSize?: number; nbsp?: boolean } = {},
): string {
  return splitLines(text)
    .map((line) => {
      let l = line;
      if (o.nbsp) l = l.replace(/[   ]/g, " ");
      if (o.tabsToSpaces) {
        const size = Math.max(1, Math.min(16, o.tabSize ?? 4));
        // Expand to the next tab stop so columns stay aligned.
        let col = 0;
        let res = "";
        for (const ch of l) {
          if (ch === "\t") {
            const n = size - (col % size);
            res += " ".repeat(n);
            col += n;
          } else {
            res += ch;
            col++;
          }
        }
        l = res;
      }
      if (o.removeAll) return l.replace(/[ \t  -   　]+/g, "");
      if (o.collapse) l = l.replace(/([ \t  -   　])[ \t  -   　]+/g, "$1");
      if (o.trimLines) l = l.replace(/^[ \t 　]+|[ \t 　]+$/g, "");
      return l;
    })
    .join(newlineOf(text));
}

/* ------------------------------------------------------------------ */
/* Sort / shuffle / reverse                                            */
/* ------------------------------------------------------------------ */

export type SortMode = "alpha" | "natural" | "length";

export function sortLines(
  text: string,
  o: { mode?: SortMode; reverse?: boolean; caseInsensitive?: boolean; unique?: boolean; ignoreEmpty?: boolean; locale?: string } = {},
): string {
  let lines = splitLines(text);
  if (o.ignoreEmpty) lines = lines.filter((l) => !isBlank(l));
  const collator = new Intl.Collator(o.locale || undefined, {
    numeric: o.mode === "natural",
    sensitivity: o.caseInsensitive ? "base" : "variant",
    caseFirst: o.caseInsensitive ? undefined : "upper",
  });
  if (o.unique) {
    const seen = new Set<string>();
    lines = lines.filter((l) => {
      const k = o.caseInsensitive ? l.toLocaleLowerCase() : l;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  const sorted = [...lines].sort((a, b) => {
    if (o.mode === "length") {
      const d = graphemes(a).length - graphemes(b).length;
      return d !== 0 ? d : collator.compare(a, b);
    }
    return collator.compare(a, b);
  });
  if (o.reverse) sorted.reverse();
  return sorted.join(newlineOf(text));
}

/** Uniform integer in [0, max) from a 32-bit random source, without modulo bias. */
export function randomBelow(max: number, rand32: () => number): number {
  if (max <= 1) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  for (;;) {
    const r = rand32() >>> 0;
    if (r < limit) return r % max;
  }
}

/** Browser crypto-backed 32-bit random number. */
export function cryptoRand32(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rand32: () => number = cryptoRand32): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1, rand32);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type ReverseMode = "chars" | "words" | "lines" | "chars-per-line";

export function reverseText(text: string, mode: ReverseMode): string {
  const nl = newlineOf(text);
  switch (mode) {
    case "chars":
      // Normalize CRLF first so "\r\n" is not split into "\n\r".
      return graphemes(text.replace(/\r\n/g, "\n")).reverse().join("").replace(/\n/g, nl);
    case "chars-per-line":
      return splitLines(text).map((l) => graphemes(l).reverse().join("")).join(nl);
    case "words":
      return splitLines(text)
        .map((l) => {
          const lead = /^\s*/.exec(l)?.[0] ?? "";
          const trail = /\s*$/.exec(l.slice(lead.length))?.[0] ?? "";
          const core = l.slice(lead.length, l.length - trail.length);
          if (!core) return l;
          const parts = core.split(/(\s+)/);
          return lead + parts.reverse().join("") + trail;
        })
        .join(nl);
    case "lines":
      return splitLines(text).reverse().join(nl);
  }
}

/* ------------------------------------------------------------------ */
/* Numbering, prefix / suffix                                          */
/* ------------------------------------------------------------------ */

export function numberLines(
  text: string,
  o: { start?: number; step?: number; separator?: string; pad?: "none" | "zero" | "space"; skipEmpty?: boolean; continueOnSkipped?: boolean } = {},
): string {
  const start = o.start ?? 1;
  const step = o.step ?? 1;
  const sep = o.separator ?? ". ";
  const lines = splitLines(text);
  const numbered = lines.filter((l) => !(o.skipEmpty && isBlank(l))).length;
  const last = start + step * Math.max(0, numbered - 1);
  const width = Math.max(String(start).length, String(last).length);
  let n = start;
  return lines
    .map((l) => {
      if (o.skipEmpty && isBlank(l)) return l;
      const raw = String(n);
      const neg = raw.startsWith("-");
      const digits = neg ? raw.slice(1) : raw;
      const label =
        o.pad === "zero" ? (neg ? "-" : "") + digits.padStart(width - (neg ? 1 : 0), "0") : o.pad === "space" ? raw.padStart(width, " ") : raw;
      n += step;
      return label + sep + l;
    })
    .join(newlineOf(text));
}

export function addPrefixSuffix(text: string, o: { prefix?: string; suffix?: string; skipEmpty?: boolean; trim?: boolean } = {}): string {
  return splitLines(text)
    .map((l) => {
      const line = o.trim ? l.trim() : l;
      if (o.skipEmpty && isBlank(line)) return line;
      return (o.prefix ?? "") + line + (o.suffix ?? "");
    })
    .join(newlineOf(text));
}

/* ------------------------------------------------------------------ */
/* Split / join                                                        */
/* ------------------------------------------------------------------ */

/** Turns "\\t", "\\n" typed by users into real characters. */
export function unescapeDelimiter(s: string): string {
  return s.replace(/\\([tnr\\])/g, (_m, c: string) => (c === "t" ? "\t" : c === "n" ? "\n" : c === "r" ? "\r" : "\\"));
}

export function splitText(
  text: string,
  o: { delimiter: string; regex?: boolean; trim?: boolean; removeEmpty?: boolean },
): string[] {
  if (o.delimiter === "") throw new Error("Enter a delimiter to split on.");
  let parts: string[];
  if (o.regex) {
    let re: RegExp;
    try {
      re = new RegExp(o.delimiter, "u");
    } catch (e) {
      throw new Error(`Invalid regular expression: ${e instanceof Error ? e.message : String(e)}`);
    }
    parts = text.split(re).filter((p) => p !== undefined);
  } else parts = text.split(unescapeDelimiter(o.delimiter));
  if (o.trim) parts = parts.map((p) => p.trim());
  if (o.removeEmpty) parts = parts.filter((p) => p !== "");
  return parts;
}

export function joinLines(
  text: string,
  o: { delimiter: string; quote?: "none" | "double" | "single"; trim?: boolean; skipEmpty?: boolean },
): string {
  let lines = splitLines(text);
  if (o.trim) lines = lines.map((l) => l.trim());
  if (o.skipEmpty) lines = lines.filter((l) => !isBlank(l));
  const q = o.quote === "double" ? '"' : o.quote === "single" ? "'" : "";
  return lines.map((l) => (q ? q + l.split(q).join(q + q) + q : l)).join(unescapeDelimiter(o.delimiter));
}

/* ------------------------------------------------------------------ */
/* Length limiter                                                      */
/* ------------------------------------------------------------------ */

export function limitLength(
  text: string,
  o: { unit: "chars" | "words"; max: number; wordBoundary?: boolean; ellipsis?: string; perLine?: boolean },
): { output: string; truncated: number } {
  let truncated = 0;
  const limitOne = (s: string): string => {
    const ell = o.ellipsis ?? "";
    if (o.unit === "words") {
      const tokens = s.match(/\S+\s*/g) ?? [];
      if (tokens.length <= o.max) return s;
      truncated++;
      const lead = /^\s*/.exec(s)?.[0] ?? "";
      return lead + tokens.slice(0, o.max).join("").trimEnd() + ell;
    }
    const g = graphemes(s);
    if (g.length <= o.max) return s;
    truncated++;
    const ellLen = graphemes(ell).length;
    const room = Math.max(0, o.max - ellLen);
    let cut = g.slice(0, room).join("");
    if (o.wordBoundary && room > 0) {
      const nextIsSpace = /\s/.test(g[room] ?? " ");
      if (!nextIsSpace) {
        const lastSpace = cut.search(/\s\S*$/);
        if (lastSpace > 0) cut = cut.slice(0, lastSpace);
      }
    }
    return cut.trimEnd() + ell;
  };
  const output = o.perLine ? splitLines(text).map(limitOne).join(newlineOf(text)) : limitOne(text);
  return { output, truncated };
}

/* ------------------------------------------------------------------ */
/* Find and replace                                                    */
/* ------------------------------------------------------------------ */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findReplace(
  text: string,
  o: { find: string; replace: string; regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean; firstOnly?: boolean },
): { output: string; count: number } {
  if (!o.find) return { output: text, count: 0 };
  let source = o.regex ? o.find : escapeRegExp(o.find);
  if (o.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  let re: RegExp;
  try {
    re = new RegExp(source, `${o.firstOnly ? "" : "g"}u${o.caseSensitive ? "" : "i"}`);
  } catch (e) {
    throw new Error(`Invalid regular expression: ${e instanceof Error ? e.message : String(e)}`);
  }
  let count = 0;
  const replacement = o.regex ? o.replace.replace(/\\n/g, "\n").replace(/\\t/g, "\t") : o.replace;
  const output = text.replace(re, (...args: unknown[]) => {
    count++;
    if (!o.regex) return replacement;
    // Expand $&, $1..$99 and $<name> manually so we can count at the same time.
    const match = args[0] as string;
    const last = args[args.length - 1];
    const hasGroups = typeof last === "object" && last !== null;
    const groups = (hasGroups ? last : undefined) as Record<string, string | undefined> | undefined;
    const capEnd = hasGroups ? args.length - 3 : args.length - 2;
    const caps = args.slice(1, capEnd) as (string | undefined)[];
    return replacement.replace(/\$(\$|&|\d{1,2}|<([^>]+)>)/g, (m, tok: string, name?: string) => {
      if (tok === "$") return "$";
      if (tok === "&") return match;
      if (name !== undefined) return groups?.[name] ?? "";
      const i = Number(tok);
      if (i >= 1 && i <= caps.length) return caps[i - 1] ?? "";
      return m;
    });
  });
  return { output, count };
}
