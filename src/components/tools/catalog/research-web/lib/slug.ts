/**
 * Slug generation with a transliteration table. Letters that Unicode
 * decomposition cannot reduce to ASCII (ß, æ, ø, ł, đ, þ, Greek, Cyrillic)
 * are mapped explicitly; everything else falls back to NFD + mark stripping.
 */

const LATIN: Record<string, string> = {
  ß: "ss", ẞ: "SS", æ: "ae", Æ: "AE", œ: "oe", Œ: "OE", ø: "o", Ø: "O", å: "a", Å: "A", ł: "l", Ł: "L", đ: "d", Đ: "D",
  ð: "d", Ð: "D", þ: "th", Þ: "TH", ı: "i", ħ: "h", Ħ: "H", ŋ: "ng", Ŋ: "NG", ĸ: "k", ſ: "s", ŀ: "l", Ŀ: "L",
  "&": " and ", "@": " at ", "%": " percent ", "€": " euro ", "$": " dollar ", "£": " pound ", "+": " plus ",
  "’": "", "'": "", "‘": "", "`": "",
};

/** German-style umlauts (ä → ae) when the option is on. */
const GERMAN: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue" };

const GREEK: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o",
  π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "yu", я: "ya", є: "ye", і: "i", ї: "yi", ґ: "g", ў: "u",
};

export const STOP_WORDS = new Set(
  "a an and are as at be but by for from has have how in into is it its of on or that the this to was what when where which who why will with your you".split(
    " ",
  ),
);

export function transliterate(input: string, german = false): string {
  let out = "";
  for (const ch of input) {
    if (german && GERMAN[ch]) {
      out += GERMAN[ch];
      continue;
    }
    if (LATIN[ch] !== undefined) {
      out += LATIN[ch];
      continue;
    }
    const lower = ch.toLowerCase();
    const greekKey = lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const g = GREEK[greekKey];
    if (g !== undefined) {
      out += ch === lower ? g : g.charAt(0).toUpperCase() + g.slice(1);
      continue;
    }
    const c = CYRILLIC[lower];
    if (c !== undefined) {
      out += ch === lower ? c : c.charAt(0).toUpperCase() + c.slice(1);
      continue;
    }
    out += ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  return out;
}

export interface SlugOptions {
  separator: "-" | "_" | ".";
  lowercase: boolean;
  removeStopWords: boolean;
  maxLength: number;
  german: boolean;
  keepNumbers: boolean;
}

export function slugify(text: string, o: SlugOptions): string {
  const ascii = transliterate(text, o.german);
  let words = ascii.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!o.keepNumbers) words = words.filter((w) => !/^\d+$/.test(w));
  if (o.removeStopWords) {
    const kept = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
    if (kept.length) words = kept;
  }
  if (o.lowercase) words = words.map((w) => w.toLowerCase());
  let slug = words.join(o.separator);
  if (o.maxLength > 0 && slug.length > o.maxLength) {
    // Cut at the last separator that fits, so words are not split.
    const cut = slug.slice(0, o.maxLength + 1);
    const idx = cut.lastIndexOf(o.separator);
    slug = idx > 0 ? cut.slice(0, idx) : slug.slice(0, o.maxLength);
  }
  return slug;
}
