/**
 * Full-tank (fill-to-fill) fuel consumption log. Pure functions.
 * Each segment runs from one full fill-up to the next; fuel added at every
 * fill after the first full one (including partial fills) is charged to the
 * segment that ends at the next full fill.
 */

export type Fill = { odo: number; fuel: number; full: boolean; cost: number | null };

export type Segment = { endIndex: number; distance: number; fuel: number; cost: number | null; per100: number; perUnit: number };

export type LogResult = { segments: Segment[]; distance: number; fuel: number; cost: number | null; per100: number | null; perUnit: number | null };

export function analyzeLog(fills: Fill[]): LogResult | string {
  if (fills.length < 2) return "Add at least two fill-ups: a full tank to start and the next full tank.";
  for (let i = 1; i < fills.length; i++) {
    if (fills[i].odo <= fills[i - 1].odo) return `Fill-up ${i + 1}: the odometer must be higher than the previous reading.`;
  }
  const start = fills.findIndex((f) => f.full);
  if (start < 0) return "Mark at least one fill-up as a full tank.";
  const segments: Segment[] = [];
  let fuel = 0;
  let cost: number | null = 0;
  let from = start;
  for (let i = start + 1; i < fills.length; i++) {
    fuel += fills[i].fuel;
    cost = cost !== null && fills[i].cost !== null ? cost + (fills[i].cost as number) : null;
    if (fills[i].full) {
      const distance = fills[i].odo - fills[from].odo;
      segments.push({ endIndex: i, distance, fuel, cost, per100: (fuel / distance) * 100, perUnit: distance / fuel });
      fuel = 0;
      cost = 0;
      from = i;
    }
  }
  if (!segments.length) return "Add a second full-tank fill-up to close the first segment.";
  const D = segments.reduce((s, x) => s + x.distance, 0);
  const F = segments.reduce((s, x) => s + x.fuel, 0);
  const C = segments.every((s) => s.cost !== null) ? segments.reduce((s, x) => s + (x.cost as number), 0) : null;
  return { segments, distance: D, fuel: F, cost: C, per100: (F / D) * 100, perUnit: D / F };
}
