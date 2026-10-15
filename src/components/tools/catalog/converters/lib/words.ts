/**
 * English number words: cardinal (US or UK "and"), ordinal, cheque and
 * currency styles, and parsing words back to a number. Short scale
 * (billion = 10^9). Integers use BigInt so large values stay exact.
 */

const B0 = BigInt(0);
const B1 = BigInt(1);
const B100 = BigInt(100);
const B1000 = BigInt(1000);

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export const SCALES = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion", "sextillion", "septillion", "octillion", "nonillion", "decillion"];
export const MAX_INT_DIGITS = SCALES.length * 3; // 36 digits

export type WordStyle = "us" | "uk";

function under100(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

function under1000(n: number, style: WordStyle): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return under100(r);
  if (!r) return `${ONES[h]} hundred`;
  return `${ONES[h]} hundred ${style === "uk" ? "and " : ""}${under100(r)}`;
}

/** Cardinal words for a non-negative BigInt. */
export function intToWords(n: bigint, style: WordStyle = "us"): string {
  if (n === B0) return "zero";
  const groups: number[] = [];
  let x = n;
  while (x > B0) {
    groups.push(Number(x % B1000));
    x /= B1000;
  }
  if (groups.length > SCALES.length) throw new Error("Number is too large.");
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    let w = under1000(g, style);
    // UK: "one thousand and five" when the last group is below 100 and higher groups exist.
    if (style === "uk" && i === 0 && g < 100 && groups.length > 1) w = `and ${w}`;
    parts.push(SCALES[i] ? `${w} ${SCALES[i]}` : w);
  }
  return parts.join(" ");
}

const ORD_IRREGULAR: Record<string, string> = {
  one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth",
};

/** Turns the last word of a cardinal into its ordinal form. */
export function ordinalize(words: string): string {
  const m = words.match(/^(.*?)([a-z]+)$/);
  if (!m) return words;
  const [, head, last] = m;
  let o: string;
  if (ORD_IRREGULAR[last]) o = ORD_IRREGULAR[last];
  else if (last.endsWith("y")) o = `${last.slice(0, -1)}ieth`;
  else o = `${last}th`;
  return head + o;
}

export function ordinalSuffix(n: bigint): string {
  const h = Number(n % B100);
  if (h >= 11 && h <= 13) return "th";
  return ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][Number(n % BigInt(10))];
}

export type ParsedNumber = { negative: boolean; int: bigint; frac: string };

/** Accepts "1234", "-1,234.567", "0.5". */
export function parseNumberString(raw: string): ParsedNumber | string {
  const s = raw.trim().replace(/[,\s_]/g, "");
  const m = s.match(/^([-+]?)(\d*)(?:\.(\d*))?$/);
  if (!m || (m[2] === "" && !m[3])) return "Enter a number such as 1234 or 1,234.56.";
  const intStr = (m[2] || "0").replace(/^0+(?=\d)/, "");
  if (intStr.length > MAX_INT_DIGITS) return `Numbers up to ${MAX_INT_DIGITS} digits (decillions) are supported.`;
  return { negative: m[1] === "-", int: BigInt(intStr), frac: m[3] ?? "" };
}

export function numberToWords(raw: string, style: WordStyle = "us"): string {
  const p = parseNumberString(raw);
  if (typeof p === "string") throw new Error(p);
  const isZero = p.int === B0 && /^0*$/.test(p.frac);
  let w = intToWords(p.int, style);
  if (p.frac) w += ` point ${p.frac.split("").map((d) => ONES[Number(d)]).join(" ")}`;
  return (p.negative && !isZero ? "minus " : "") + w;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export type Currency = { id: string; major: [string, string]; minor: [string, string]; symbol: string };
export const CURRENCIES: Currency[] = [
  { id: "USD", major: ["dollar", "dollars"], minor: ["cent", "cents"], symbol: "$" },
  { id: "EUR", major: ["euro", "euros"], minor: ["cent", "cents"], symbol: "€" },
  { id: "GBP", major: ["pound", "pounds"], minor: ["penny", "pence"], symbol: "£" },
  { id: "CAD", major: ["Canadian dollar", "Canadian dollars"], minor: ["cent", "cents"], symbol: "CA$" },
  { id: "AUD", major: ["Australian dollar", "Australian dollars"], minor: ["cent", "cents"], symbol: "A$" },
  { id: "INR", major: ["rupee", "rupees"], minor: ["paisa", "paise"], symbol: "₹" },
  { id: "PKR", major: ["rupee", "rupees"], minor: ["paisa", "paise"], symbol: "Rs" },
];

/** Splits into whole units and cents, rounding half up to 2 decimals. */
export function toCents(p: ParsedNumber): { whole: bigint; cents: number } {
  const f = (p.frac + "000").slice(0, 3);
  let cents = Number(f.slice(0, 2));
  let whole = p.int;
  if (Number(f[2]) >= 5) cents += 1;
  if (cents === 100) {
    cents = 0;
    whole += B1;
  }
  return { whole, cents };
}

/** "One thousand two hundred thirty-four and 56/100 dollars" */
export function chequeWords(raw: string, cur: Currency, style: WordStyle = "us"): string {
  const p = parseNumberString(raw);
  if (typeof p === "string") throw new Error(p);
  const { whole, cents } = toCents(p);
  const w = intToWords(whole, style);
  return `${capitalize(w)} and ${String(cents).padStart(2, "0")}/100 ${cur.major[1]}`;
}

/** "one thousand two hundred thirty-four dollars and fifty-six cents" */
export function currencyWords(raw: string, cur: Currency, style: WordStyle = "us"): string {
  const p = parseNumberString(raw);
  if (typeof p === "string") throw new Error(p);
  const { whole, cents } = toCents(p);
  const major = `${intToWords(whole, style)} ${whole === B1 ? cur.major[0] : cur.major[1]}`;
  if (!cents) return major;
  const minor = `${intToWords(BigInt(cents), style)} ${cents === 1 ? cur.minor[0] : cur.minor[1]}`;
  return `${major} and ${minor}`;
}

/* ------------------------------------------------------------------ */
/* Words back to number                                                */
/* ------------------------------------------------------------------ */

const WORD_VALUE: Record<string, number> = {};
ONES.forEach((w, i) => (WORD_VALUE[w] = i));
TENS.forEach((w, i) => {
  if (w) WORD_VALUE[w] = i * 10;
});
const ORDINAL_WORD: Record<string, string> = {};
for (const w of [...ONES, ...TENS.filter(Boolean), "hundred", ...SCALES.filter(Boolean)]) ORDINAL_WORD[ordinalize(w)] = w;

export type WordsParse = { ok: true; value: string; ordinal: boolean } | { ok: false; error: string };

/** Parses "two hundred and forty-five", "minus three point one four", "twenty-first", "a million". */
export function wordsToNumber(raw: string): WordsParse {
  const tokens = raw
    .toLowerCase()
    .replace(/[,]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return { ok: false, error: "Type a number in words, for example: two hundred and five." };
  let negative = false;
  let i = 0;
  if (tokens[0] === "minus" || tokens[0] === "negative") {
    negative = true;
    i = 1;
  }
  let total = B0;
  let current = B0;
  let any = false;
  let ordinal = false;
  let last: "none" | "unit" | "teen" | "tens" | "hundred" | "scale" = "none";
  let lastScale = Infinity;
  let frac = "";
  for (; i < tokens.length; i++) {
    let t = tokens[i];
    if (t === "and") continue;
    if (t === "a" && (tokens[i + 1] === "hundred" || SCALES.includes(tokens[i + 1] ?? ""))) {
      t = "one";
    }
    if (t === "point" || t === "dot") {
      const rest = tokens.slice(i + 1);
      if (!rest.length) return { ok: false, error: 'Add digits after "point".' };
      for (const d of rest) {
        const v = d === "oh" || d === "o" ? 0 : WORD_VALUE[d];
        if (v === undefined || v > 9) return { ok: false, error: `After "point", say single digits (zero to nine). "${d}" is not one.` };
        frac += String(v);
      }
      break;
    }
    if (ORDINAL_WORD[t]) {
      if (i !== tokens.length - 1) return { ok: false, error: `"${t}" can only be the last word.` };
      ordinal = true;
      t = ORDINAL_WORD[t];
    }
    if (/^\d+$/.test(t) && t.length <= 3) {
      if (last === "unit" || last === "teen" || last === "tens") return { ok: false, error: `"${t}" cannot follow another number word here.` };
      current += BigInt(t);
      last = "unit";
      any = true;
      continue;
    }
    const v = WORD_VALUE[t];
    if (v !== undefined) {
      if (v < 10) {
        if (last === "unit" || last === "teen") return { ok: false, error: `"${t}" cannot follow another single number word.` };
        last = "unit";
      } else if (v < 20) {
        if (last === "unit" || last === "teen" || last === "tens") return { ok: false, error: `"${t}" cannot follow another number word here.` };
        last = "teen";
      } else {
        if (last === "unit" || last === "teen" || last === "tens") return { ok: false, error: `"${t}" cannot follow another number word here.` };
        last = "tens";
      }
      current += BigInt(v);
      any = true;
      continue;
    }
    if (t === "hundred") {
      if (last === "hundred") return { ok: false, error: '"hundred" cannot repeat.' };
      if (current === B0) current = B1;
      if (current >= B100) return { ok: false, error: 'Use "thousand" rather than e.g. "twelve hundred hundred".' };
      current *= B100;
      last = "hundred";
      any = true;
      continue;
    }
    const sIdx = SCALES.indexOf(t);
    if (sIdx > 0) {
      if (sIdx >= lastScale) return { ok: false, error: `"${t}" is out of order. Larger scales come first.` };
      if (current === B0) current = B1;
      total += current * B1000 ** BigInt(sIdx);
      current = B0;
      lastScale = sIdx;
      last = "scale";
      any = true;
      continue;
    }
    return { ok: false, error: `"${t}" is not a recognized number word.` };
  }
  if (!any && !frac) return { ok: false, error: "No number words found." };
  if (ordinal && frac) return { ok: false, error: "Ordinals cannot have a decimal part." };
  total += current;
  const isZero = total === B0 && /^0*$/.test(frac);
  const value = `${negative && !isZero ? "-" : ""}${total.toString()}${frac ? `.${frac}` : ""}`;
  return { ok: true, value, ordinal };
}
