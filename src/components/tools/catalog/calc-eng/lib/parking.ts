/**
 * Parking tariff model. Pure functions.
 * - "blocks": the first block (e.g. first hour) has its own price, then every
 *   started additional block is charged; an optional cap applies per 24 h.
 * - "flat": one price per started 24 h period.
 */

export type Tariff = {
  kind: "blocks" | "flat";
  firstMinutes: number;
  firstPrice: number;
  blockMinutes: number;
  blockPrice: number;
  /** Cap per 24 h period; null for no cap. */
  dailyMax: number | null;
  flatPrice: number;
  /** Minutes free at the start (grace period). */
  grace: number;
};

function dayCost(t: Tariff, minutes: number): number {
  if (minutes <= 0) return 0;
  if (t.kind === "flat") return t.flatPrice;
  let c: number;
  if (minutes <= t.firstMinutes) c = t.firstPrice;
  else {
    const extra = minutes - t.firstMinutes;
    const blocks = t.blockMinutes > 0 ? Math.ceil(extra / t.blockMinutes - 1e-9) : 0;
    c = t.firstPrice + blocks * t.blockPrice;
  }
  return t.dailyMax !== null ? Math.min(c, t.dailyMax) : c;
}

/** Total cost for a stay of `minutes`. Each full 24 h is charged as a full day, then the remainder. */
export function parkingCost(t: Tariff, minutes: number): number {
  if (minutes <= t.grace) return 0;
  const days = Math.floor(minutes / 1440);
  const rem = minutes - days * 1440;
  return days * dayCost(t, 1440) + dayCost(t, rem);
}
