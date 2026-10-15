/**
 * Resistor color code (IEC 60062) and preferred-number series (IEC 60063).
 * Pure functions, no React.
 */

export type ColorName =
  | "black"
  | "brown"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "violet"
  | "grey"
  | "white"
  | "gold"
  | "silver"
  | "none";

export type ColorInfo = {
  name: ColorName;
  label: string;
  hex: string;
  /** Text color that is readable on top of `hex`. */
  ink: string;
  digit?: number;
  /** Power of ten for the multiplier band. */
  exp?: number;
  /** Tolerance in percent. */
  tol?: number;
  /** Temperature coefficient in ppm/K. */
  tempco?: number;
};

export const COLORS: ColorInfo[] = [
  { name: "black", label: "Black", hex: "#1c1c1c", ink: "#fff", digit: 0, exp: 0, tempco: 250 },
  { name: "brown", label: "Brown", hex: "#7a4a24", ink: "#fff", digit: 1, exp: 1, tol: 1, tempco: 100 },
  { name: "red", label: "Red", hex: "#d42a2a", ink: "#fff", digit: 2, exp: 2, tol: 2, tempco: 50 },
  { name: "orange", label: "Orange", hex: "#f08a1c", ink: "#1c1c1c", digit: 3, exp: 3, tol: 0.05, tempco: 15 },
  { name: "yellow", label: "Yellow", hex: "#f5d90a", ink: "#1c1c1c", digit: 4, exp: 4, tol: 0.02, tempco: 25 },
  { name: "green", label: "Green", hex: "#2f9a3f", ink: "#fff", digit: 5, exp: 5, tol: 0.5, tempco: 20 },
  { name: "blue", label: "Blue", hex: "#2a5fd4", ink: "#fff", digit: 6, exp: 6, tol: 0.25, tempco: 10 },
  { name: "violet", label: "Violet", hex: "#8a3fc7", ink: "#fff", digit: 7, exp: 7, tol: 0.1, tempco: 5 },
  { name: "grey", label: "Grey", hex: "#8c8c8c", ink: "#1c1c1c", digit: 8, exp: 8, tol: 0.01, tempco: 1 },
  { name: "white", label: "White", hex: "#f4f4f4", ink: "#1c1c1c", digit: 9, exp: 9 },
  { name: "gold", label: "Gold", hex: "#c9a43a", ink: "#1c1c1c", exp: -1, tol: 5 },
  { name: "silver", label: "Silver", hex: "#b8bcc2", ink: "#1c1c1c", exp: -2, tol: 10 },
  { name: "none", label: "None (no band)", hex: "transparent", ink: "#1c1c1c", tol: 20 },
];

export const colorInfo = (name: ColorName): ColorInfo => COLORS.find((c) => c.name === name) ?? COLORS[0];

export const digitColors = COLORS.filter((c) => c.digit !== undefined);
export const multiplierColors = COLORS.filter((c) => c.exp !== undefined);
export const toleranceColors = COLORS.filter((c) => c.tol !== undefined);
export const tempcoColors = COLORS.filter((c) => c.tempco !== undefined);

export type BandCount = 4 | 5 | 6;

export type Decoded = {
  ohms: number;
  digits: number[];
  exp: number;
  tolerance: number;
  tempco: number | null;
  min: number;
  max: number;
};

/**
 * Decodes bands. 4-band: d d mult tol. 5-band: d d d mult tol.
 * 6-band: d d d mult tol tempco.
 */
export function decodeBands(bands: ColorName[], count: BandCount): Decoded | string {
  const nDigits = count === 4 ? 2 : 3;
  if (bands.length < count) return "Choose a color for every band.";
  const digits: number[] = [];
  for (let i = 0; i < nDigits; i++) {
    const d = colorInfo(bands[i]).digit;
    if (d === undefined) return `Band ${i + 1} must be a digit color (black to white).`;
    digits.push(d);
  }
  const exp = colorInfo(bands[nDigits]).exp;
  if (exp === undefined) return `Band ${nDigits + 1} must be a multiplier color.`;
  const tol = colorInfo(bands[nDigits + 1]).tol;
  if (tol === undefined) return `Band ${nDigits + 2} is not a valid tolerance color.`;
  let tempco: number | null = null;
  if (count === 6) {
    const t = colorInfo(bands[5]).tempco;
    if (t === undefined) return "Band 6 is not a valid temperature coefficient color.";
    tempco = t;
  }
  const significand = digits.reduce((a, d) => a * 10 + d, 0);
  const ohms = roundSig(significand * 10 ** exp, 12);
  return { ohms, digits, exp, tolerance: tol, tempco, min: ohms * (1 - tol / 100), max: ohms * (1 + tol / 100) };
}

export function roundSig(n: number, sig: number) {
  if (n === 0 || !Number.isFinite(n)) return n;
  return Number(n.toPrecision(sig));
}

export type Encoded = { digits: number[]; exp: number; ohms: number; exact: boolean };

/** Finds digit and multiplier bands for a value. `nDigits` is 2 (4-band) or 3 (5/6-band). */
export function encodeValue(ohms: number, nDigits: 2 | 3): Encoded | string {
  if (!(ohms > 0) || !Number.isFinite(ohms)) return "Enter a resistance greater than zero.";
  let exp = Math.floor(Math.log10(ohms)) - (nDigits - 1);
  let sig = Math.round(roundSig(ohms / 10 ** exp, 12));
  if (sig >= 10 ** nDigits) {
    sig = Math.round(sig / 10);
    exp += 1;
  }
  if (exp < -2) return `Too small for color bands with ${nDigits} digits (smallest multiplier is silver, ×0.01).`;
  if (exp > 9) return "Too large for color bands (largest multiplier is white, ×10⁹).";
  const digits = String(sig).padStart(nDigits, "0").split("").map(Number);
  const value = roundSig(sig * 10 ** exp, 12);
  return { digits, exp, ohms: value, exact: Math.abs(value - ohms) <= Math.abs(ohms) * 1e-9 };
}

export const colorForDigit = (d: number): ColorName => digitColors[d].name;
export const colorForExp = (e: number): ColorName => {
  const c = multiplierColors.find((x) => x.exp === e);
  if (!c) throw new Error(`No multiplier color for 10^${e}`);
  return c.name;
};
export const colorForTol = (t: number): ColorName | null => toleranceColors.find((x) => x.tol === t)?.name ?? null;

/* ------------------------------------------------------------------ */
/* IEC 60063 preferred numbers                                          */
/* ------------------------------------------------------------------ */

/** E24 uses historical values that do not follow the formula exactly (e.g. 2.7, 3.3, 4.7). */
const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];

/**
 * E192 values per IEC 60063 are round(10^(i/192), 3 significant digits) with
 * one exception: 9.20 instead of the computed 9.19. E96 and E48 are every 2nd
 * and 4th value of E192.
 */
function e192(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 192; i++) {
    let v = Math.round(10 ** (i / 192) * 100) / 100;
    if (i === 185) v = 9.2;
    out.push(v);
  }
  return out;
}

export type SeriesName = "E6" | "E12" | "E24" | "E48" | "E96" | "E192";

export const SERIES: Record<SeriesName, number[]> = (() => {
  const big = e192();
  return {
    E6: E24.filter((_, i) => i % 4 === 0),
    E12: E24.filter((_, i) => i % 2 === 0),
    E24,
    E48: big.filter((_, i) => i % 4 === 0),
    E96: big.filter((_, i) => i % 2 === 0),
    E192: big,
  };
})();

/** Tolerance usually paired with each series. */
export const SERIES_TOL: Record<SeriesName, number> = { E6: 20, E12: 10, E24: 5, E48: 2, E96: 1, E192: 0.5 };

export type Nearest = { below: number; above: number; nearest: number; errorPct: number };

/** Nearest standard values below/above `ohms` (inclusive) and the closest one by relative error. */
export function nearestStandard(ohms: number, series: SeriesName): Nearest {
  const base = SERIES[series];
  const decade = Math.floor(Math.log10(ohms));
  const candidates: number[] = [];
  for (let d = decade - 1; d <= decade + 1; d++) for (const b of base) candidates.push(roundSig(b * 10 ** d, 6));
  candidates.sort((a, b) => a - b);
  let below = candidates[0];
  let above = candidates[candidates.length - 1];
  for (const c of candidates) {
    if (c <= ohms * (1 + 1e-12)) below = c;
    if (c >= ohms * (1 - 1e-12)) {
      above = c;
      break;
    }
  }
  const eb = Math.abs(ohms - below) / ohms;
  const ea = Math.abs(above - ohms) / ohms;
  const nearest = eb <= ea ? below : above;
  return { below, above, nearest, errorPct: ((nearest - ohms) / ohms) * 100 };
}

/** Formats ohms as "4.7 kΩ". */
export function formatOhms(ohms: number): string {
  const units: [number, string][] = [
    [1e9, "GΩ"],
    [1e6, "MΩ"],
    [1e3, "kΩ"],
    [1, "Ω"],
    [1e-3, "mΩ"],
  ];
  for (const [f, u] of units) {
    if (Math.abs(ohms) >= f || f === 1e-3) {
      const v = roundSig(ohms / f, 6);
      return `${v.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${u}`;
    }
  }
  return `${ohms} Ω`;
}

/** Parses "4k7", "4.7k", "4.7 kΩ", "1M" (mega), "10m" (milli), "220R", "0R22", "470". */
export function parseOhms(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "").replace(/ω|Ω|ohms?$/gi, "");
  if (!s) return null;
  const mult: Record<string, number> = { r: 1, R: 1, k: 1e3, K: 1e3, m: 1e-3, M: 1e6, g: 1e9, G: 1e9 };
  // RKM code: digits, letter, digits (e.g. 4k7, 0R22)
  const rkm = /^(\d+)([rRkKmMgG])(\d+)$/.exec(s);
  if (rkm) {
    const m = mult[rkm[2]];
    return Number(`${rkm[1]}.${rkm[3]}`) * m;
  }
  const plain = /^(\d+\.?\d*|\.\d+)([rRkKmMgG]?)$/.exec(s);
  if (!plain) return null;
  const m = plain[2] ? mult[plain[2]] : 1;
  const v = Number(plain[1]) * m;
  return Number.isFinite(v) ? v : null;
}
