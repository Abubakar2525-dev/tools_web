/** Unicode inspection and escape conversion. Self-contained for direct Node testing. */

export const CATEGORIES: [string, string][] = [
  ["Lu", "Uppercase letter"],
  ["Ll", "Lowercase letter"],
  ["Lt", "Titlecase letter"],
  ["Lm", "Modifier letter"],
  ["Lo", "Other letter"],
  ["Mn", "Nonspacing mark"],
  ["Mc", "Spacing mark"],
  ["Me", "Enclosing mark"],
  ["Nd", "Decimal digit"],
  ["Nl", "Letter number"],
  ["No", "Other number"],
  ["Pc", "Connector punctuation"],
  ["Pd", "Dash punctuation"],
  ["Ps", "Open punctuation"],
  ["Pe", "Close punctuation"],
  ["Pi", "Initial quote"],
  ["Pf", "Final quote"],
  ["Po", "Other punctuation"],
  ["Sm", "Math symbol"],
  ["Sc", "Currency symbol"],
  ["Sk", "Modifier symbol"],
  ["So", "Other symbol"],
  ["Zs", "Space separator"],
  ["Zl", "Line separator"],
  ["Zp", "Paragraph separator"],
  ["Cc", "Control"],
  ["Cf", "Format"],
  ["Cs", "Surrogate"],
  ["Co", "Private use"],
];

const CAT_RE = CATEGORIES.map(([code, name]) => ({ code, name, re: new RegExp(`^\\p{${code}}$`, "u") }));

export function generalCategory(ch: string): { code: string; name: string } {
  for (const c of CAT_RE) if (c.re.test(ch)) return { code: c.code, name: c.name };
  return { code: "Cn", name: "Unassigned" };
}

const SCRIPT_RE: [string, RegExp][] = ["Latin", "Greek", "Cyrillic", "Armenian", "Hebrew", "Arabic", "Devanagari", "Han", "Hiragana", "Katakana", "Hangul", "Thai", "Cherokee"].map(
  (s) => [s, new RegExp(`\\p{Script=${s}}`, "u")],
);

export function scriptOf(ch: string): string | null {
  for (const [name, re] of SCRIPT_RE) if (re.test(ch)) return name;
  return null;
}

/** Characters that render as nothing or change text direction. */
const SPECIAL: Record<number, string> = {
  0x00ad: "Soft hyphen",
  0x034f: "Combining grapheme joiner",
  0x061c: "Arabic letter mark (bidi)",
  0x180e: "Mongolian vowel separator",
  0x200b: "Zero width space",
  0x200c: "Zero width non-joiner",
  0x200d: "Zero width joiner",
  0x200e: "Left-to-right mark (bidi)",
  0x200f: "Right-to-left mark (bidi)",
  0x202a: "Left-to-right embedding (bidi)",
  0x202b: "Right-to-left embedding (bidi)",
  0x202c: "Pop directional formatting (bidi)",
  0x202d: "Left-to-right override (bidi)",
  0x202e: "Right-to-left override (bidi)",
  0x2060: "Word joiner",
  0x2061: "Function application (invisible)",
  0x2062: "Invisible times",
  0x2063: "Invisible separator",
  0x2064: "Invisible plus",
  0x2066: "Left-to-right isolate (bidi)",
  0x2067: "Right-to-left isolate (bidi)",
  0x2068: "First strong isolate (bidi)",
  0x2069: "Pop directional isolate (bidi)",
  0xfeff: "Byte order mark / zero width no-break space",
  0x00a0: "No-break space",
  0x2007: "Figure space",
  0x202f: "Narrow no-break space",
  0x3000: "Ideographic space",
  0x3164: "Hangul filler (renders blank)",
  0xffa0: "Halfwidth Hangul filler (renders blank)",
  0x115f: "Hangul choseong filler (renders blank)",
  0x1160: "Hangul jungseong filler (renders blank)",
  0x0009: "Tab",
  0x000a: "Line feed",
  0x000d: "Carriage return",
};

/** Latin look-alikes from other scripts (a small, original selection of the most common ones). */
const CONFUSABLE: Record<number, string> = {
  0x0430: "a", 0x0435: "e", 0x043e: "o", 0x0440: "p", 0x0441: "c", 0x0443: "y", 0x0445: "x", 0x0456: "i", 0x0458: "j", 0x0455: "s",
  0x04bb: "h", 0x0501: "d", 0x0410: "A", 0x0412: "B", 0x0415: "E", 0x041a: "K", 0x041c: "M", 0x041d: "H", 0x041e: "O", 0x0420: "P",
  0x0421: "C", 0x0422: "T", 0x0425: "X", 0x0406: "I", 0x0408: "J", 0x0405: "S",
  0x0391: "A", 0x0392: "B", 0x0395: "E", 0x0396: "Z", 0x0397: "H", 0x0399: "I", 0x039a: "K", 0x039c: "M", 0x039d: "N", 0x039f: "O",
  0x03a1: "P", 0x03a4: "T", 0x03a5: "Y", 0x03a7: "X", 0x03bf: "o", 0x03bd: "v", 0x03b1: "a", 0x03b9: "i",
  0x0131: "i (dotless)", 0x2010: "-", 0x2011: "-", 0x2212: "-", 0x2024: ".", 0xff0e: ".", 0x01c3: "!", 0x2044: "/", 0x2215: "/",
};

export type CodePointInfo = {
  char: string;
  cp: number;
  hex: string;
  category: { code: string; name: string };
  utf8: string;
  utf16: string;
  script: string | null;
  flag: { kind: "invisible" | "bidi" | "space" | "control" | "confusable" | "fullwidth"; note: string } | null;
};

export type GraphemeInfo = { text: string; index: number; codePoints: CodePointInfo[] };

const hex = (n: number, w: number) => n.toString(16).toUpperCase().padStart(w, "0");

export function codePointInfo(char: string): CodePointInfo {
  const cp = char.codePointAt(0) ?? 0;
  const category = generalCategory(char);
  const utf8 = Array.from(new TextEncoder().encode(char), (b) => hex(b, 2)).join(" ");
  const utf16 = Array.from({ length: char.length }, (_, i) => hex(char.charCodeAt(i), 4)).join(" ");
  let flag: CodePointInfo["flag"] = null;
  const special = SPECIAL[cp];
  if (special) {
    const kind = /bidi/.test(special)
      ? "bidi"
      : /space/i.test(special) && cp !== 0x200b && cp !== 0xfeff
        ? "space"
        : cp < 0x20
          ? "control"
          : "invisible";
    flag = { kind, note: special };
  } else if (CONFUSABLE[cp]) {
    flag = { kind: "confusable", note: `Looks like Latin "${CONFUSABLE[cp]}"` };
  } else if (cp >= 0xff01 && cp <= 0xff5e) {
    flag = { kind: "fullwidth", note: `Fullwidth form of "${String.fromCharCode(cp - 0xfee0)}"` };
  } else if (category.code === "Cc") {
    flag = { kind: "control", note: "Control character" };
  } else if (category.code === "Cf") {
    flag = { kind: "invisible", note: "Format character (usually invisible)" };
  } else if ((cp >= 0xe0000 && cp <= 0xe007f)) {
    flag = { kind: "invisible", note: "Tag character (invisible)" };
  } else if (cp >= 0xfe00 && cp <= 0xfe0f) {
    flag = { kind: "invisible", note: "Variation selector" };
  }
  return { char, cp, hex: `U+${hex(cp, 4)}`, category, utf8, utf16, script: scriptOf(char), flag };
}

export function splitGraphemes(text: string): string[] {
  const Seg = typeof Intl !== "undefined" ? (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter : undefined;
  if (Seg) return Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment);
  return Array.from(text);
}

export function inspect(text: string, limit = 2000): { graphemes: GraphemeInfo[]; truncated: boolean; totalCodePoints: number } {
  const gs = splitGraphemes(text);
  const out: GraphemeInfo[] = [];
  let count = 0;
  for (let i = 0; i < gs.length && count < limit; i++) {
    const cps = Array.from(gs[i]).map(codePointInfo);
    count += cps.length;
    out.push({ text: gs[i], index: i, codePoints: cps });
  }
  return { graphemes: out, truncated: out.length < gs.length, totalCodePoints: Array.from(text).length };
}

/** Words mixing Latin with Cyrillic or Greek letters, a common spoofing pattern. */
export function mixedScriptWords(text: string): string[] {
  const found = new Set<string>();
  for (const w of text.split(/[^\p{L}\p{M}]+/u)) {
    if (!w) continue;
    const scripts = new Set(Array.from(w).map(scriptOf).filter((s): s is string => s !== null));
    if (scripts.has("Latin") && (scripts.has("Cyrillic") || scripts.has("Greek"))) found.add(w);
  }
  return [...found];
}

/* ------------------------------------------------------------------ */
/* Escapes                                                             */
/* ------------------------------------------------------------------ */

export type EscapeStyle = "js" | "es6" | "html-hex" | "html-dec" | "css" | "python" | "codepoints";

export function escapeText(text: string, style: EscapeStyle, onlyNonAscii = true): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (style !== "codepoints" && onlyNonAscii && cp >= 0x20 && cp < 0x7f) {
      out += ch;
      continue;
    }
    switch (style) {
      case "js":
        for (let i = 0; i < ch.length; i++) out += `\\u${hex(ch.charCodeAt(i), 4)}`;
        break;
      case "es6":
        out += cp <= 0xffff ? `\\u${hex(cp, 4)}` : `\\u{${hex(cp, 1)}}`;
        break;
      case "html-hex":
        out += `&#x${hex(cp, 1)};`;
        break;
      case "html-dec":
        out += `&#${cp};`;
        break;
      case "css":
        out += `\\${hex(cp, 1)} `;
        break;
      case "python":
        out += cp <= 0xffff ? `\\u${hex(cp, 4)}` : `\\U${hex(cp, 8)}`;
        break;
      case "codepoints":
        out += (out ? " " : "") + `U+${hex(cp, 4)}`;
        break;
    }
  }
  return out;
}

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®", trade: "™", hellip: "…",
  mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", deg: "°", euro: "€", pound: "£",
  yen: "¥", cent: "¢", sect: "§", para: "¶", times: "×", divide: "÷", laquo: "«", raquo: "»", iexcl: "¡", iquest: "¿",
  shy: "­", zwj: "‍", zwnj: "‌", lrm: "‎", rlm: "‏", eacute: "é", Eacute: "É", ntilde: "ñ", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß",
};

function fromCp(cp: number, original: string): string {
  return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : original;
}

/** Decodes \uXXXX (including surrogate pairs), \u{…}, \UXXXXXXXX, \xHH, U+XXXX, CSS \HEXX and HTML entities. */
export function unescapeText(text: string): string {
  return text
    .replace(/\\u\{([0-9a-f]{1,6})\}/gi, (m, h: string) => fromCp(parseInt(h, 16), m))
    .replace(/\\U([0-9a-f]{8})/g, (m, h: string) => fromCp(parseInt(h, 16), m))
    .replace(/\\u([0-9a-f]{4})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/U\+([0-9a-f]{4,6})\s?/gi, (m, h: string) => fromCp(parseInt(h, 16), m))
    // CSS escapes: only 4-6 hex digits ending in a space or end of text, so paths like C:\data survive.
    .replace(/\\([0-9a-f]{4,6})(?: |$)/gim, (m, h: string) => fromCp(parseInt(h, 16), m))
    .replace(/&#x([0-9a-f]+);/gi, (m, h: string) => fromCp(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m, d: string) => fromCp(parseInt(d, 10), m))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, n: string) => NAMED[n] ?? NAMED[n.toLowerCase()] ?? m);
}
