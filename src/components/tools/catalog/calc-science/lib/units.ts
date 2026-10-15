/**
 * Unit tables for the science calculators. Every factor converts a value in
 * the listed unit to the SI base unit (value * factor + offset). Factors are
 * exact by definition (NIST SP 811, SI Brochure 9th ed.) unless noted.
 */

export type Unit = { value: string; label: string; factor: number; offset?: number };

export const length: Unit[] = [
  { value: "m", label: "m", factor: 1 },
  { value: "km", label: "km", factor: 1000 },
  { value: "cm", label: "cm", factor: 0.01 },
  { value: "mm", label: "mm", factor: 0.001 },
  { value: "um", label: "µm", factor: 1e-6 },
  { value: "nm", label: "nm", factor: 1e-9 },
  { value: "in", label: "in", factor: 0.0254 },
  { value: "ft", label: "ft", factor: 0.3048 },
  { value: "yd", label: "yd", factor: 0.9144 },
  { value: "mi", label: "mi", factor: 1609.344 },
  { value: "nmi", label: "nautical mi", factor: 1852 },
];

/** Wavelength-friendly length list (base m). */
export const wave: Unit[] = [
  { value: "nm", label: "nm", factor: 1e-9 },
  { value: "pm", label: "pm", factor: 1e-12 },
  { value: "um", label: "µm", factor: 1e-6 },
  { value: "mm", label: "mm", factor: 1e-3 },
  { value: "cm", label: "cm", factor: 0.01 },
  { value: "m", label: "m", factor: 1 },
  { value: "km", label: "km", factor: 1000 },
];

/** Astronomical-friendly distance list (base m). */
export const distanceAstro: Unit[] = [
  { value: "m", label: "m", factor: 1 },
  { value: "km", label: "km", factor: 1000 },
  { value: "au", label: "au", factor: 149597870700 },
  { value: "re", label: "Earth radii", factor: 6.3781e6 },
  { value: "cm", label: "cm", factor: 0.01 },
  { value: "mi", label: "mi", factor: 1609.344 },
];

export const area: Unit[] = [
  { value: "m2", label: "m²", factor: 1 },
  { value: "cm2", label: "cm²", factor: 1e-4 },
  { value: "mm2", label: "mm²", factor: 1e-6 },
  { value: "km2", label: "km²", factor: 1e6 },
  { value: "ha", label: "ha", factor: 1e4 },
  { value: "in2", label: "in²", factor: 0.00064516 },
  { value: "ft2", label: "ft²", factor: 0.09290304 },
  { value: "yd2", label: "yd²", factor: 0.83612736 },
  { value: "acre", label: "acre", factor: 4046.8564224 },
];

export const volume: Unit[] = [
  { value: "m3", label: "m³", factor: 1 },
  { value: "L", label: "L", factor: 1e-3 },
  { value: "mL", label: "mL", factor: 1e-6 },
  { value: "cm3", label: "cm³", factor: 1e-6 },
  { value: "in3", label: "in³", factor: 1.6387064e-5 },
  { value: "ft3", label: "ft³", factor: 0.028316846592 },
  { value: "galUS", label: "US gal", factor: 3.785411784e-3 },
  { value: "galUK", label: "UK gal", factor: 4.54609e-3 },
];

/** Chemistry volume list with base litre. */
export const volumeL: Unit[] = [
  { value: "L", label: "L", factor: 1 },
  { value: "mL", label: "mL", factor: 1e-3 },
  { value: "uL", label: "µL", factor: 1e-6 },
  { value: "dm3", label: "dm³", factor: 1 },
  { value: "cm3", label: "cm³", factor: 1e-3 },
  { value: "m3", label: "m³", factor: 1000 },
];

export const mass: Unit[] = [
  { value: "kg", label: "kg", factor: 1 },
  { value: "g", label: "g", factor: 1e-3 },
  { value: "mg", label: "mg", factor: 1e-6 },
  { value: "t", label: "t (metric)", factor: 1000 },
  { value: "lb", label: "lb", factor: 0.45359237 },
  { value: "oz", label: "oz", factor: 0.028349523125 },
];

/** Chemistry mass list with base gram. */
export const massG: Unit[] = [
  { value: "g", label: "g", factor: 1 },
  { value: "mg", label: "mg", factor: 1e-3 },
  { value: "ug", label: "µg", factor: 1e-6 },
  { value: "kg", label: "kg", factor: 1000 },
];

/** Astronomical masses (base kg). Earth and Sun masses are IAU/JPL nominal values. */
export const massAstro: Unit[] = [
  { value: "kg", label: "kg", factor: 1 },
  { value: "t", label: "t", factor: 1000 },
  { value: "me", label: "Earth masses", factor: 5.9722e24 },
  { value: "ms", label: "Solar masses", factor: 1.98847e30 },
  { value: "g", label: "g", factor: 1e-3 },
];

export const time: Unit[] = [
  { value: "s", label: "s", factor: 1 },
  { value: "ms", label: "ms", factor: 1e-3 },
  { value: "min", label: "min", factor: 60 },
  { value: "h", label: "h", factor: 3600 },
  { value: "d", label: "days", factor: 86400 },
];

/** Long time spans; year is the Julian year (365.25 d). */
export const timeLong: Unit[] = [
  { value: "s", label: "s", factor: 1 },
  { value: "min", label: "min", factor: 60 },
  { value: "h", label: "h", factor: 3600 },
  { value: "d", label: "days", factor: 86400 },
  { value: "y", label: "years", factor: 31557600 },
];

export const speed: Unit[] = [
  { value: "ms", label: "m/s", factor: 1 },
  { value: "kmh", label: "km/h", factor: 1 / 3.6 },
  { value: "mph", label: "mph", factor: 0.44704 },
  { value: "fts", label: "ft/s", factor: 0.3048 },
  { value: "kn", label: "knots", factor: 1852 / 3600 },
];

export const accel: Unit[] = [
  { value: "ms2", label: "m/s²", factor: 1 },
  { value: "fts2", label: "ft/s²", factor: 0.3048 },
  { value: "g0", label: "g (standard)", factor: 9.80665 },
  { value: "gal", label: "cm/s² (Gal)", factor: 0.01 },
];

export const force: Unit[] = [
  { value: "N", label: "N", factor: 1 },
  { value: "kN", label: "kN", factor: 1000 },
  { value: "lbf", label: "lbf", factor: 4.4482216152605 },
  { value: "kgf", label: "kgf", factor: 9.80665 },
  { value: "dyn", label: "dyn", factor: 1e-5 },
];

export const energy: Unit[] = [
  { value: "J", label: "J", factor: 1 },
  { value: "kJ", label: "kJ", factor: 1000 },
  { value: "MJ", label: "MJ", factor: 1e6 },
  { value: "Wh", label: "Wh", factor: 3600 },
  { value: "kWh", label: "kWh", factor: 3.6e6 },
  { value: "cal", label: "cal", factor: 4.184 },
  { value: "kcal", label: "kcal", factor: 4184 },
  { value: "eV", label: "eV", factor: 1.602176634e-19 },
  { value: "BTU", label: "BTU", factor: 1055.05585262 },
  { value: "ftlbf", label: "ft·lbf", factor: 1.3558179483314004 },
];

export const power: Unit[] = [
  { value: "W", label: "W", factor: 1 },
  { value: "kW", label: "kW", factor: 1000 },
  { value: "MW", label: "MW", factor: 1e6 },
  { value: "hp", label: "hp (mechanical)", factor: 745.69987158227022 },
  { value: "PS", label: "hp (metric)", factor: 735.49875 },
  { value: "BTUh", label: "BTU/h", factor: 1055.05585262 / 3600 },
];

export const pressure: Unit[] = [
  { value: "Pa", label: "Pa", factor: 1 },
  { value: "kPa", label: "kPa", factor: 1000 },
  { value: "MPa", label: "MPa", factor: 1e6 },
  { value: "bar", label: "bar", factor: 1e5 },
  { value: "atm", label: "atm", factor: 101325 },
  { value: "psi", label: "psi", factor: 6894.757293168361 },
  { value: "mmHg", label: "mmHg", factor: 133.322387415 },
  { value: "torr", label: "torr", factor: 101325 / 760 },
];

export const density: Unit[] = [
  { value: "kgm3", label: "kg/m³", factor: 1 },
  { value: "gcm3", label: "g/cm³", factor: 1000 },
  { value: "gmL", label: "g/mL", factor: 1000 },
  { value: "gL", label: "g/L", factor: 1 },
  { value: "lbft3", label: "lb/ft³", factor: 16.018463373960138 },
  { value: "lbin3", label: "lb/in³", factor: 27679.904710203125 },
];

export const temperature: Unit[] = [
  { value: "K", label: "K", factor: 1 },
  { value: "C", label: "°C", factor: 1, offset: 273.15 },
  { value: "F", label: "°F", factor: 5 / 9, offset: 273.15 - (32 * 5) / 9 },
];

export const angle: Unit[] = [
  { value: "deg", label: "degrees", factor: Math.PI / 180 },
  { value: "rad", label: "radians", factor: 1 },
];

export const frequency: Unit[] = [
  { value: "Hz", label: "Hz", factor: 1 },
  { value: "kHz", label: "kHz", factor: 1e3 },
  { value: "MHz", label: "MHz", factor: 1e6 },
  { value: "GHz", label: "GHz", factor: 1e9 },
  { value: "THz", label: "THz", factor: 1e12 },
  { value: "rpm", label: "rpm", factor: 1 / 60 },
];

export const momentum: Unit[] = [
  { value: "kgms", label: "kg·m/s", factor: 1 },
  { value: "Ns", label: "N·s", factor: 1 },
  { value: "gcms", label: "g·cm/s", factor: 1e-5 },
  { value: "lbfts", label: "lb·ft/s", factor: 0.45359237 * 0.3048 },
];

export const amount: Unit[] = [
  { value: "mol", label: "mol", factor: 1 },
  { value: "mmol", label: "mmol", factor: 1e-3 },
  { value: "umol", label: "µmol", factor: 1e-6 },
  { value: "kmol", label: "kmol", factor: 1e3 },
];

export const molarity: Unit[] = [
  { value: "M", label: "mol/L (M)", factor: 1 },
  { value: "mM", label: "mmol/L (mM)", factor: 1e-3 },
  { value: "uM", label: "µmol/L (µM)", factor: 1e-6 },
  { value: "nM", label: "nmol/L (nM)", factor: 1e-9 },
];

/** Plain list of length unit choices for "one unit for the whole shape" selects. */
export const lengthChoices = [
  { value: "m", label: "meters (m)" },
  { value: "cm", label: "centimeters (cm)" },
  { value: "mm", label: "millimeters (mm)" },
  { value: "km", label: "kilometers (km)" },
  { value: "in", label: "inches (in)" },
  { value: "ft", label: "feet (ft)" },
  { value: "yd", label: "yards (yd)" },
  { value: "mi", label: "miles (mi)" },
  { value: "u", label: "no unit" },
];

/** Converts a base-unit value into the given unit. */
export function fromBase(v: number, list: Unit[], unit: string): number {
  const u = list.find((x) => x.value === unit) ?? list[0];
  return (v - (u.offset ?? 0)) / u.factor;
}

/** Converts a value in the given unit to the base unit. */
export function toBase(v: number, list: Unit[], unit: string): number {
  const u = list.find((x) => x.value === unit) ?? list[0];
  return v * u.factor + (u.offset ?? 0);
}

export function unitLabel(list: Unit[], unit: string): string {
  return (list.find((x) => x.value === unit) ?? list[0]).label;
}

/** Length factor in meters for a lengthChoices value (null for "no unit"). */
export function lengthFactor(unit: string): number | null {
  if (unit === "u") return null;
  return length.find((x) => x.value === unit)?.factor ?? null;
}
