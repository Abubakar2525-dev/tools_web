/**
 * Chemical formula parser shared by the molecular weight, mole, molarity,
 * stoichiometry and equation balancer tools.
 *
 * Supports: nested (), [] and {} groups with multipliers; hydrates and
 * adducts joined by "·", "•", "*" or "." with optional leading multipliers
 * (CuSO4·5H2O); a leading coefficient (2H2O); charges written as ^2-, ^+,
 * {3+}, a trailing sign (NH4+, OH-, Fe+++), a space before the charge
 * (SO4 2-), or digits+sign on a single atom (Fe3+); the electron "e-";
 * Unicode subscripts and superscripts (H₂O, SO₄²⁻).
 */

import { BY_SYMBOL, type Element } from "./elements";

export interface ParsedFormula {
  /** Input after normalization (without coefficient). */
  formula: string;
  /** Leading coefficient (1 when absent). */
  coefficient: number;
  /** Atom counts per element symbol for ONE formula unit, in first-seen order. */
  counts: Map<string, number>;
  /** Net charge of one formula unit. */
  charge: number;
  /** True for the electron "e-". */
  electron: boolean;
}

export class FormulaError extends Error {}

const SUB: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};
const SUP: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-",
};

/** Converts Unicode sub/superscripts and dashes to plain ASCII notation. */
export function normalizeFormula(input: string): string {
  let s = input.trim().replace(/[−–—]/g, "-");
  // Superscript runs become a caret charge: SO₄²⁻ → SO4^2-
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (m) => "^" + [...m].map((c) => SUP[c]).join(""));
  s = s.replace(/[₀-₉]/g, (c) => SUB[c]);
  return s;
}

/** Splits off the charge suffix. Returns body and charge. */
function splitCharge(s: string): { body: string; charge: number } {
  let m: RegExpMatchArray | null;
  const signed = (digits: string, sign: string) => (sign === "-" ? -1 : 1) * (digits === "" ? 1 : Number(digits));
  if ((m = s.match(/^(.*?)\s*\^\s*(\d*)\s*([+-])$/))) return { body: m[1], charge: signed(m[2], m[3]) };
  if ((m = s.match(/^(.*?)\s*\^\s*([+-])\s*(\d*)$/))) return { body: m[1], charge: signed(m[3], m[2]) };
  if ((m = s.match(/^(.*?)\{(\d*)([+-])\}$/))) return { body: m[1], charge: signed(m[2], m[3]) };
  if ((m = s.match(/^(.*?)\{([+-])(\d*)\}$/))) return { body: m[1], charge: signed(m[3], m[2]) };
  if ((m = s.match(/^(.*\S)\s+(\d*)([+-])$/))) return { body: m[1], charge: signed(m[2], m[3]) };
  if ((m = s.match(/^(.*?)(\++|-+)$/))) {
    const body = m[1];
    const n = m[2].length * (m[2][0] === "-" ? -1 : 1);
    // "Fe3+": digits before the sign on a single-atom body are the charge.
    const mono = body.match(/^([A-Z][a-z]?)(\d+)$/);
    if (mono && m[2].length === 1 && BY_SYMBOL.has(mono[1])) {
      return { body: mono[1], charge: Number(mono[2]) * Math.sign(n) };
    }
    return { body, charge: n };
  }
  return { body: s, charge: 0 };
}

function addInto(target: Map<string, number>, src: Map<string, number>, mult: number) {
  for (const [k, v] of src) target.set(k, (target.get(k) ?? 0) + v * mult);
}

const CLOSE: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** Parses a formula body (no charge) into atom counts. */
function parseBody(src: string): Map<string, number> {
  let i = 0;
  const readInt = (): number | null => {
    const m = src.slice(i).match(/^\d+/);
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };

  const parseSeq = (closer: string | null): Map<string, number> => {
    const out = new Map<string, number>();
    while (i < src.length) {
      const ch = src[i];
      if (ch === " ") {
        i++;
        continue;
      }
      if (closer && ch === closer) return out;
      if (ch === ")" || ch === "]" || ch === "}") throw new FormulaError(`Unmatched "${ch}" at position ${i + 1}.`);
      if (ch === "(" || ch === "[" || ch === "{") {
        const open = i;
        i++;
        const inner = parseSeq(CLOSE[ch]);
        if (src[i] !== CLOSE[ch]) throw new FormulaError(`Missing "${CLOSE[ch]}" for the "${ch}" at position ${open + 1}.`);
        i++;
        if (inner.size === 0) throw new FormulaError(`Empty brackets at position ${open + 1}.`);
        const n = readInt();
        if (n === 0) throw new FormulaError(`A group multiplier of 0 at position ${i} is not allowed.`);
        addInto(out, inner, n ?? 1);
        continue;
      }
      if (/[A-Z]/.test(ch)) {
        let sym = ch;
        if (i + 1 < src.length && /[a-z]/.test(src[i + 1])) sym += src[i + 1];
        if (!BY_SYMBOL.has(sym)) throw new FormulaError(`Unknown element "${sym}" at position ${i + 1}.`);
        i += sym.length;
        const n = readInt();
        if (n === 0) throw new FormulaError(`A count of 0 after ${sym} is not allowed.`);
        out.set(sym, (out.get(sym) ?? 0) + (n ?? 1));
        continue;
      }
      if (/[a-z]/.test(ch)) {
        throw new FormulaError(`Unexpected lowercase "${ch}" at position ${i + 1}. Element symbols start with a capital letter (Co is cobalt, CO is carbon monoxide).`);
      }
      if (/\d/.test(ch)) throw new FormulaError(`Unexpected number at position ${i + 1}. Put counts after the element or bracket they multiply.`);
      throw new FormulaError(`Unexpected character "${ch}" at position ${i + 1}.`);
    }
    if (closer) throw new FormulaError(`Missing "${closer}".`);
    return out;
  };

  return parseSeq(null);
}

/** Parses one species, e.g. "2CuSO4·5H2O", "SO4^2-", "Fe3+", "e-". */
export function parseFormula(input: string): ParsedFormula {
  let s = normalizeFormula(input);
  if (s === "") throw new FormulaError("Enter a chemical formula.");
  let coefficient = 1;
  const cm = s.match(/^(\d+)\s*(?=[A-Z([{]|e[-^{]|e$)/);
  if (cm) {
    coefficient = Number(cm[1]);
    if (coefficient === 0) throw new FormulaError("A coefficient of 0 is not allowed.");
    s = s.slice(cm[0].length);
  }
  if (/^e(\^?-1?|\{-1?\}|\^?\{?-\}?)?$/.test(s) || s === "e") {
    return { formula: "e-", coefficient, counts: new Map(), charge: -1, electron: true };
  }
  const { body, charge } = splitCharge(s);
  if (body.trim() === "") throw new FormulaError("No elements found.");
  // Hydrate / adduct separators. A "." between letters/digits is a separator, never a decimal.
  const parts = body.split(/\s*[·•*.]\s*/);
  const counts = new Map<string, number>();
  parts.forEach((p, idx) => {
    if (p.trim() === "") throw new FormulaError(idx === 0 ? "The formula starts with a separator." : "Empty part after a hydrate separator.");
    let part = p.trim();
    let mult = 1;
    const pm = part.match(/^(\d+)\s*/);
    if (pm) {
      if (idx === 0 && cm) throw new FormulaError("Unexpected number at the start of the formula.");
      mult = Number(pm[1]);
      if (mult === 0) throw new FormulaError("A multiplier of 0 is not allowed.");
      part = part.slice(pm[0].length);
      if (idx === 0) coefficient *= mult;
      if (idx === 0) mult = 1;
    }
    const inner = parseBody(part);
    if (inner.size === 0) throw new FormulaError("No elements found.");
    addInto(counts, inner, mult);
  });
  return { formula: body.trim() + chargeText(charge), coefficient, counts, charge, electron: false };
}

export function chargeText(charge: number): string {
  if (charge === 0) return "";
  const mag = Math.abs(charge);
  return `^${mag === 1 ? "" : mag}${charge > 0 ? "+" : "-"}`;
}

export interface CompositionRow {
  element: Element;
  count: number;
  mass: number;
  percent: number;
}

export interface MolarMassResult {
  molarMass: number;
  rows: CompositionRow[];
  /** True when any element used a bracketed mass number. */
  approximate: boolean;
}

/** Molar mass (g/mol) of one formula unit and its percent composition by mass. */
export function molarMass(counts: Map<string, number>): MolarMassResult {
  let total = 0;
  let approximate = false;
  const rows: CompositionRow[] = [];
  for (const [sym, n] of counts) {
    const el = BY_SYMBOL.get(sym);
    if (!el) throw new FormulaError(`Unknown element "${sym}".`);
    if (el.bracketed) approximate = true;
    const mass = el.weight * n;
    total += mass;
    rows.push({ element: el, count: n, mass, percent: 0 });
  }
  for (const r of rows) r.percent = total > 0 ? (r.mass / total) * 100 : 0;
  return { molarMass: total, rows, approximate };
}

/** Parses a formula and returns its molar mass in g/mol (ignores any coefficient). */
export function molarMassOf(input: string): number {
  return molarMass(parseFormula(input).counts).molarMass;
}

/** Empirical formula (counts divided by their GCD) in Hill order. */
export function hillFormula(counts: Map<string, number>, reduce = false): string {
  const entries = [...counts.entries()];
  let g = 0;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  if (reduce) for (const [, n] of entries) g = gcd(g, n);
  const div = reduce && g > 1 ? g : 1;
  const hasC = counts.has("C");
  entries.sort(([a], [b]) => {
    if (hasC) {
      const rank = (s: string) => (s === "C" ? 0 : s === "H" ? 1 : 2);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return entries.map(([s, n]) => s + (n / div === 1 ? "" : String(n / div))).join("");
}

/** Pretty print a formula with Unicode subscripts and superscript charge. */
export function prettyFormula(f: string): string {
  const supMap: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻" };
  const subMap: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
  if (f === "e-") return "e⁻";
  const ci = f.indexOf("^");
  const body = ci >= 0 ? f.slice(0, ci) : f;
  const charge = ci >= 0 ? f.slice(ci + 1) : "";
  // Digits directly after a letter or closing bracket are subscripts; digits after a separator are multipliers.
  const b = body.replace(/([A-Za-z)\]}])(\d+)/g, (_, p: string, d: string) => p + [...d].map((c) => subMap[c]).join(""));
  const pb = b.replace(/\s*[*.•]\s*/g, "·");
  return pb + [...charge].map((c) => supMap[c] ?? c).join("");
}
