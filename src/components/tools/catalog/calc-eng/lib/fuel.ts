/** Fuel economy conversions. Pure functions. */

export const L_PER_USGAL = 3.785411784;
export const L_PER_UKGAL = 4.54609;
export const KM_PER_MI = 1.609344;

export type Economy = "l100" | "mpgus" | "mpguk" | "kml";

/** Converts a fuel economy figure to liters per 100 km. */
export function toL100(value: number, unit: Economy): number {
  switch (unit) {
    case "l100":
      return value;
    case "kml":
      return 100 / value;
    case "mpgus":
      return (100 * L_PER_USGAL) / (value * KM_PER_MI);
    case "mpguk":
      return (100 * L_PER_UKGAL) / (value * KM_PER_MI);
  }
}

export function fromL100(l100: number, unit: Economy): number {
  // The conversion is its own inverse for every unit except l100.
  return unit === "l100" ? l100 : toL100(l100, unit);
}

export const ECONOMY_OPTIONS = [
  { value: "l100", label: "L/100 km" },
  { value: "mpgus", label: "mpg (US)" },
  { value: "mpguk", label: "mpg (UK)" },
  { value: "kml", label: "km/L" },
];

export const VOLUME_FACTOR: Record<string, number> = { L: 1, usgal: L_PER_USGAL, ukgal: L_PER_UKGAL };
