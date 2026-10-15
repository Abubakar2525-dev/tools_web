/**
 * Limiting reagent and yield calculations for a balanced equation.
 */

export interface StoichInput {
  /** Balanced coefficients of the reactants. */
  coefficients: number[];
  /** Moles of each reactant (null = not given / unlimited). */
  moles: (number | null)[];
}

export interface StoichResult {
  /** Index of the limiting reactant. */
  limiting: number;
  /** Reaction extent ξ in mol (moles of "reaction units"). */
  extent: number;
  /** Moles of each reactant left over (null if not given). */
  leftover: (number | null)[];
  /** Moles consumed of each reactant. */
  consumed: number[];
  /** Ties: indices of all reactants that run out together. */
  tiedLimiting: number[];
}

/** Returns null when no reactant amount is given. */
export function limitingReagent({ coefficients, moles }: StoichInput): StoichResult | null {
  let extent = Infinity;
  let limiting = -1;
  moles.forEach((n, i) => {
    if (n === null) return;
    const e = n / coefficients[i];
    if (e < extent) {
      extent = e;
      limiting = i;
    }
  });
  if (limiting < 0) return null;
  const tiedLimiting = moles
    .map((n, i) => (n !== null && Math.abs(n / coefficients[i] - extent) <= 1e-12 * Math.max(1, extent) ? i : -1))
    .filter((i) => i >= 0);
  const consumed = coefficients.map((c) => c * extent);
  const leftover = moles.map((n, i) => (n === null ? null : Math.max(0, n - consumed[i])));
  return { limiting, extent, leftover, consumed, tiedLimiting };
}

/** Theoretical yield in mol of a product with coefficient `coef` at extent ξ. */
export const theoreticalMoles = (extent: number, coef: number) => extent * coef;

export const percentYield = (actual: number, theoretical: number) => (actual / theoretical) * 100;
