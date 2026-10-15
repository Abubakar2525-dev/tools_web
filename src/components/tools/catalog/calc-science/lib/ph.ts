/**
 * pH helpers (aqueous solutions at 25 °C, concentrations in mol/L used as
 * activities, which is reasonable only for dilute solutions).
 */

import { KW_25C } from "./constants";

export const KW = KW_25C;

export interface PhState {
  pH: number;
  pOH: number;
  h: number;
  oh: number;
}

export function fromH(h: number): PhState {
  const oh = KW / h;
  return { pH: -Math.log10(h), pOH: -Math.log10(oh), h, oh };
}

export const fromPH = (pH: number) => fromH(10 ** -pH);
export const fromOH = (oh: number) => fromH(KW / oh);
export const fromPOH = (pOH: number) => fromOH(10 ** -pOH);

/**
 * Strong acid releasing `c` mol/L of H+ (already multiplied by protons per
 * formula unit). Includes water autoionization exactly:
 * [H+] = (c + √(c² + 4Kw)) / 2, which matters below about 1e-6 M.
 */
export function strongAcid(c: number): number {
  return (c + Math.sqrt(c * c + 4 * KW)) / 2;
}

/** Strong base releasing `c` mol/L of OH-. Returns [OH-]. */
export function strongBase(c: number): number {
  return (c + Math.sqrt(c * c + 4 * KW)) / 2;
}

/**
 * Weak monoprotic acid HA with initial concentration c and Ka. Solves
 * x² + Ka·x − Ka·c = 0 exactly (x = [H+] from the acid; water ignored).
 * Uses the numerically stable form of the quadratic root.
 */
export function weakExact(K: number, c: number): number {
  // x = (−K + √(K² + 4Kc)) / 2 = 2Kc / (K + √(K² + 4Kc))
  return (2 * K * c) / (K + Math.sqrt(K * K + 4 * K * c));
}

/** The common shortcut x ≈ √(K·c), valid when x/c < 5 %. */
export function weakApprox(K: number, c: number): number {
  return Math.sqrt(K * c);
}
