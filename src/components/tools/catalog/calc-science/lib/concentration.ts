/**
 * Concentration conversions through a common pivot: grams of solute per
 * litre of solution (g/L).
 *
 * - % w/v  = g solute / 100 mL solution
 * - % w/w  = g solute / 100 g solution        (needs solution density)
 * - % v/v  = mL solute / 100 mL solution      (needs solute density; assumes the solute's own volume)
 * - ppm, ppb = mass/mass (mg/kg, µg/kg)       (needs solution density)
 * - mol/L                                    (needs molar mass)
 */

export type ConcUnit = "wv" | "ww" | "vv" | "ppm" | "ppb" | "gL" | "mgL" | "M" | "mM";

export const CONC_UNITS: { value: ConcUnit; label: string }[] = [
  { value: "wv", label: "% w/v (g per 100 mL)" },
  { value: "ww", label: "% w/w (g per 100 g)" },
  { value: "vv", label: "% v/v (mL per 100 mL)" },
  { value: "ppm", label: "ppm (mg/kg)" },
  { value: "ppb", label: "ppb (µg/kg)" },
  { value: "gL", label: "g/L" },
  { value: "mgL", label: "mg/L" },
  { value: "M", label: "mol/L (M)" },
  { value: "mM", label: "mmol/L (mM)" },
];

export interface ConcParams {
  /** Solution density in g/mL. */
  solutionDensity: number | null;
  /** Solute density in g/mL (pure solute, for % v/v). */
  soluteDensity: number | null;
  /** Molar mass in g/mol. */
  molarMass: number | null;
}

/** Missing parameter name or null. */
export function needs(u: ConcUnit, p: ConcParams): string | null {
  if ((u === "ww" || u === "ppm" || u === "ppb") && !p.solutionDensity) return "solution density";
  if (u === "vv" && !p.soluteDensity) return "solute density";
  if ((u === "M" || u === "mM") && !p.molarMass) return "molar mass";
  return null;
}

/** Value in unit u → g/L. Returns null if a needed parameter is missing. */
export function toGL(x: number, u: ConcUnit, p: ConcParams): number | null {
  if (needs(u, p)) return null;
  const rho = (p.solutionDensity ?? 0) * 1000; // g/L of solution
  switch (u) {
    case "wv":
      return x * 10;
    case "ww":
      return (x / 100) * rho;
    case "vv":
      return x * 10 * (p.soluteDensity ?? 0);
    case "ppm":
      return x * 1e-6 * rho;
    case "ppb":
      return x * 1e-9 * rho;
    case "gL":
      return x;
    case "mgL":
      return x / 1000;
    case "M":
      return x * (p.molarMass ?? 0);
    case "mM":
      return (x / 1000) * (p.molarMass ?? 0);
  }
}

/** g/L → unit u. Returns null if a needed parameter is missing. */
export function fromGL(gl: number, u: ConcUnit, p: ConcParams): number | null {
  if (needs(u, p)) return null;
  const rho = (p.solutionDensity ?? 0) * 1000;
  switch (u) {
    case "wv":
      return gl / 10;
    case "ww":
      return (gl / rho) * 100;
    case "vv":
      return gl / 10 / (p.soluteDensity ?? 1);
    case "ppm":
      return (gl / rho) * 1e6;
    case "ppb":
      return (gl / rho) * 1e9;
    case "gL":
      return gl;
    case "mgL":
      return gl * 1000;
    case "M":
      return gl / (p.molarMass ?? 1);
    case "mM":
      return (gl / (p.molarMass ?? 1)) * 1000;
  }
}
