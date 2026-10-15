/** Case conversion. Self-contained for direct Node testing. */

export type CaseMode =
  | "upper"
  | "lower"
  | "title"
  | "sentence"
  | "camel"
  | "pascal"
  | "snake"
  | "kebab"
  | "constant"
  | "dot"
  | "alternating"
  | "inverse";

/** Words kept lowercase inside a title unless first or last (a common style-guide convention). */
const MINOR = new Set([
  "a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet",
  "as", "at", "by", "in", "of", "off", "on", "per", "to", "up", "via", "vs", "vs.",
]);

const LETTER = new RegExp("\\p{L}", "u");
const WORD_CHAR = new RegExp("[\\p{L}\\p{N}\\p{M}'’]", "u");
const NON_WORD_SPLIT = new RegExp("[^\\p{L}\\p{N}\\p{M}]+", "u");

function capFirst(w: string): string {
  const chars = Array.from(w);
  const i = chars.findIndex((c) => LETTER.test(c));
  if (i < 0) return w;
  chars[i] = chars[i].toLocaleUpperCase();
  return chars.join("");
}

/** Splits an identifier or phrase into lowercase words: "parseHTTPResponse_v2" → parse http response v2. */
export function identifierWords(s: string): string[] {
  return s
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(NON_WORD_SPLIT)
    .filter(Boolean)
    .map((w) => w.toLocaleLowerCase());
}

function titleCase(line: string, smart: boolean): string {
  const tokens = line.split(/(\s+)/);
  const wordIdx = tokens.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
  const first = wordIdx[0];
  const last = wordIdx[wordIdx.length - 1];
  let afterColon = false;
  return tokens
    .map((t, i) => {
      if (!t.trim()) return t;
      const lower = t.toLocaleLowerCase();
      const bare = lower.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.]+$/gu, "");
      const forceCap = i === first || i === last || afterColon;
      afterColon = /[:—–?!]$/.test(t);
      if (smart && !forceCap && MINOR.has(bare)) return lower;
      // Keep words that already contain inner capitals or digits mixed (iPhone, NASA, COVID-19) as typed when smart.
      if (smart && /\p{Lu}/u.test(t.slice(1)) && t !== t.toLocaleUpperCase()) return t;
      return lower
        .split("-")
        .map((p) => capFirst(p))
        .join("-");
    })
    .join("");
}

function sentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase();
  let out = "";
  let capNext = true;
  let lastNonCr = "";
  for (const ch of lower) {
    if (capNext && LETTER.test(ch)) {
      out += ch.toLocaleUpperCase();
      capNext = false;
      lastNonCr = ch;
      continue;
    }
    out += ch;
    if (/[.!?]/.test(ch)) capNext = true;
    // A blank line starts a new paragraph, so capitalize after it too.
    else if (ch === "\n" && lastNonCr === "\n") capNext = true;
    if (ch !== "\r") lastNonCr = ch;
  }
  // Standalone "i" is always capitalized in English.
  return out.replace(/(^|[^\p{L}\p{N}'])i(?=$|[^\p{L}\p{N}])/gmu, "$1I").replace(/(^|[^\p{L}])i'(m|ll|d|ve)\b/gu, "$1I'$2");
}

function alternating(s: string): string {
  let i = 0;
  let out = "";
  for (const ch of s) {
    if (LETTER.test(ch)) {
      out += i % 2 === 0 ? ch.toLocaleLowerCase() : ch.toLocaleUpperCase();
      i++;
    } else out += ch;
  }
  return out;
}

function inverse(s: string): string {
  let out = "";
  for (const ch of s) {
    const up = ch.toLocaleUpperCase();
    out += ch === up ? ch.toLocaleLowerCase() : up;
  }
  return out;
}

function joinIdentifier(line: string, mode: CaseMode): string {
  const words = identifierWords(line);
  if (!words.length) return line.trim();
  switch (mode) {
    case "camel":
      return words.map((w, i) => (i === 0 ? w : capFirst(w))).join("");
    case "pascal":
      return words.map(capFirst).join("");
    case "snake":
      return words.join("_");
    case "kebab":
      return words.join("-");
    case "constant":
      return words.join("_").toLocaleUpperCase();
    case "dot":
      return words.join(".");
    default:
      return line;
  }
}

/**
 * Converts text. Programming cases (camel, snake, ...) are applied per line so
 * a list of names converts in one go.
 */
export function convertCase(text: string, mode: CaseMode, o: { smartTitle?: boolean } = {}): string {
  const lines = text.split(/(\r\n|\r|\n)/);
  switch (mode) {
    case "upper":
      return text.toLocaleUpperCase();
    case "lower":
      return text.toLocaleLowerCase();
    case "sentence":
      return sentenceCase(text);
    case "alternating":
      return alternating(text);
    case "inverse":
      return inverse(text);
    case "title":
      return lines.map((l, i) => (i % 2 ? l : titleCase(l, o.smartTitle !== false))).join("");
    default:
      return lines.map((l, i) => (i % 2 ? l : joinIdentifier(l, mode))).join("");
  }
}

export const isWordChar = (c: string) => WORD_CHAR.test(c);
