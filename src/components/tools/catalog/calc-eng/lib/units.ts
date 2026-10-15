/**
 * Unit option lists and SI-prefix parsing shared by the electrical and
 * engineering calculators. Pure data and functions.
 */

export type UnitOpt = { value: string; label: string; factor: number; offset?: number };

const p = (value: string, label: string, factor: number): UnitOpt => ({ value, label, factor });

export const U = {
  volt: [p("V", "V", 1), p("mV", "mV", 1e-3), p("kV", "kV", 1e3), p("uV", "µV", 1e-6)],
  amp: [p("A", "A", 1), p("mA", "mA", 1e-3), p("uA", "µA", 1e-6), p("kA", "kA", 1e3)],
  ohm: [p("ohm", "Ω", 1), p("kohm", "kΩ", 1e3), p("Mohm", "MΩ", 1e6), p("mohm", "mΩ", 1e-3)],
  watt: [p("W", "W", 1), p("mW", "mW", 1e-3), p("kW", "kW", 1e3), p("MW", "MW", 1e6)],
  farad: [p("uF", "µF", 1e-6), p("nF", "nF", 1e-9), p("pF", "pF", 1e-12), p("mF", "mF", 1e-3), p("F", "F", 1)],
  henry: [p("mH", "mH", 1e-3), p("uH", "µH", 1e-6), p("nH", "nH", 1e-9), p("H", "H", 1)],
  hertz: [p("Hz", "Hz", 1), p("kHz", "kHz", 1e3), p("MHz", "MHz", 1e6), p("GHz", "GHz", 1e9)],
  coulomb: [p("C", "C", 1), p("mC", "mC", 1e-3), p("uC", "µC", 1e-6), p("nC", "nC", 1e-9), p("pC", "pC", 1e-12)],
  length: [p("m", "m", 1), p("cm", "cm", 1e-2), p("mm", "mm", 1e-3), p("km", "km", 1e3), p("in", "in", 0.0254), p("ft", "ft", 0.3048)],
  area: [p("mm2", "mm²", 1e-6), p("cm2", "cm²", 1e-4), p("m2", "m²", 1), p("in2", "in²", 0.00064516)],
  force: [p("N", "N", 1), p("kN", "kN", 1e3), p("MN", "MN", 1e6), p("lbf", "lbf", 4.4482216152605), p("kip", "kip", 4448.2216152605)],
  pressure: [p("MPa", "MPa", 1e6), p("GPa", "GPa", 1e9), p("kPa", "kPa", 1e3), p("Pa", "Pa", 1), p("psi", "psi", 6894.757293168), p("ksi", "ksi", 6894757.293168)],
  newton: [p("N", "N", 1), p("mN", "mN", 1e-3), p("kN", "kN", 1e3), p("uN", "µN", 1e-6)],
  seconds: [p("s", "s", 1), p("ms", "ms", 1e-3), p("us", "µs", 1e-6)],
  velocity: [p("m/s", "m/s", 1), p("km/h", "km/h", 1 / 3.6), p("ft/s", "ft/s", 0.3048), p("mph", "mph", 0.44704)],
  density: [p("kg/m3", "kg/m³", 1), p("g/cm3", "g/cm³", 1000), p("lb/ft3", "lb/ft³", 16.01846337)],
  dynVisc: [p("Pa.s", "Pa·s", 1), p("mPa.s", "mPa·s (cP)", 1e-3), p("P", "poise", 0.1)],
  kinVisc: [p("m2/s", "m²/s", 1), p("mm2/s", "mm²/s (cSt)", 1e-6), p("St", "stokes", 1e-4), p("ft2/s", "ft²/s", 0.09290304)],
  energy: [p("J", "J", 1), p("mJ", "mJ", 1e-3), p("kJ", "kJ", 1e3)],
};

const PREFIX: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  μ: 1e-6,
  m: 1e-3,
  "": 1,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
};

/**
 * Parses a list such as "220, 1k, 4.7k" or "10u 22n 100p" into base-unit
 * numbers. `unitSymbol` (e.g. "Ω", "F", "H") may follow the prefix.
 * Bare numbers are multiplied by `bareFactor`.
 */
export function parseSIList(raw: string, unitSymbols: string[], bareFactor = 1): number[] | string {
  const items = raw
    .split(/[\s,;+]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!items.length) return "Enter at least one value.";
  const out: number[] = [];
  const sym = unitSymbols.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`^(\\d+\\.?\\d*(?:[eE][-+]?\\d+)?|\\.\\d+)([pnuµμmkKMG]?)(?:${sym})?$`);
  for (const it of items) {
    const m = re.exec(it);
    if (!m) return `Could not read "${it}". Use numbers with optional prefixes such as 4.7k, 10u or 220n.`;
    const v = Number(m[1]) * (m[2] ? PREFIX[m[2]] : bareFactor);
    if (!(v > 0)) return `"${it}" must be greater than zero.`;
    out.push(v);
  }
  return out;
}

/** Engineering notation with SI prefix, e.g. 4.7e-6, "F" → "4.7 µF". */
export function si(raw: number, unit: string, sig = 4): string {
  const value = Number.isFinite(raw) ? Number(raw.toPrecision(sig)) : raw;
  if (value === 0) return `0 ${unit}`;
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
  const prefixes: [number, string][] = [
    [1e12, "T"],
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "µ"],
    [1e-9, "n"],
    [1e-12, "p"],
    [1e-15, "f"],
  ];
  const abs = Math.abs(value);
  for (const [f, pre] of prefixes) {
    if (abs >= f * 0.9999999999) {
      const v = Number((value / f).toPrecision(sig));
      return `${v.toLocaleString("en-US", { maximumFractionDigits: 12 })} ${pre}${unit}`;
    }
  }
  return `${value.toExponential(sig - 1)} ${unit}`;
}
