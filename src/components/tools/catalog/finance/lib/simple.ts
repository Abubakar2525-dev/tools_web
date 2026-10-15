/** Small everyday money formulas, kept pure so they can be unit-tested. */

/* ---------------- Discounts ---------------- */

export function salePrice(price: number, discountPct: number) {
  const savings = (price * discountPct) / 100;
  return { sale: price - savings, savings };
}

export function originalFromSale(sale: number, discountPct: number) {
  if (discountPct >= 100) return null;
  const original = sale / (1 - discountPct / 100);
  return { original, savings: original - sale };
}

/** Successive discounts: 20% then 10% is 28% off, not 30%. */
export function stackedDiscount(price: number, pcts: number[]) {
  let p = price;
  const steps: { pct: number; before: number; after: number }[] = [];
  for (const d of pcts) {
    const before = p;
    p = p * (1 - d / 100);
    steps.push({ pct: d, before, after: p });
  }
  return { final: p, savings: price - p, effectivePct: price > 0 ? ((price - p) / price) * 100 : 0, steps };
}

/* ---------------- Tips ---------------- */

/** Tip and split. When `roundUp`, each share is rounded up to a whole unit and the tip absorbs the difference. */
export function tip(bill: number, tipPct: number, people: number, roundUp: boolean) {
  const tipAmt = (bill * tipPct) / 100;
  const total = bill + tipAmt;
  const exactShare = total / people;
  const share = roundUp ? Math.ceil(exactShare - 1e-9) : exactShare;
  const finalTotal = share * people;
  const finalTip = finalTotal - bill;
  return {
    tip: finalTip,
    total: finalTotal,
    perPerson: share,
    tipPerPerson: finalTip / people,
    effectiveTipPct: bill > 0 ? (finalTip / bill) * 100 : 0,
  };
}

/* ---------------- Sales tax / VAT ---------------- */

export function addTax(net: number, ratePct: number) {
  const tax = (net * ratePct) / 100;
  return { net, tax, gross: net + tax };
}

export function removeTax(gross: number, ratePct: number) {
  const net = gross / (1 + ratePct / 100);
  return { net, tax: gross - net, gross };
}

/* ---------------- Simple interest ---------------- */

/** I = P r t with r as a decimal per year and t in years. */
export const simpleInterest = {
  interest: (p: number, ratePct: number, years: number) => (p * ratePct * years) / 100,
  principal: (i: number, ratePct: number, years: number) => (i * 100) / (ratePct * years),
  rate: (i: number, p: number, years: number) => (i * 100) / (p * years),
  time: (i: number, p: number, ratePct: number) => (i * 100) / (p * ratePct),
};

/* ---------------- Salary ---------------- */

export type PayPeriod = "hourly" | "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly" | "annual";

export type WorkPattern = { hoursPerWeek: number; daysPerWeek: number; weeksPerYear: number };

/** Annual pay from an amount per period. Hours, days and weeks use the work pattern; calendar periods do not. */
export function toAnnual(amount: number, period: PayPeriod, w: WorkPattern): number {
  switch (period) {
    case "hourly":
      return amount * w.hoursPerWeek * w.weeksPerYear;
    case "daily":
      return amount * w.daysPerWeek * w.weeksPerYear;
    case "weekly":
      return amount * w.weeksPerYear;
    case "biweekly":
      return amount * 26;
    case "semimonthly":
      return amount * 24;
    case "monthly":
      return amount * 12;
    case "annual":
      return amount;
  }
}

export function fromAnnual(annual: number, period: PayPeriod, w: WorkPattern): number {
  switch (period) {
    case "hourly":
      return annual / (w.hoursPerWeek * w.weeksPerYear);
    case "daily":
      return annual / (w.daysPerWeek * w.weeksPerYear);
    case "weekly":
      return annual / w.weeksPerYear;
    case "biweekly":
      return annual / 26;
    case "semimonthly":
      return annual / 24;
    case "monthly":
      return annual / 12;
    case "annual":
      return annual;
  }
}

/* ---------------- Rent affordability ---------------- */

export function rentAffordability(annualGross: number, monthlyDebts: number, rentPct: number, dtiPct: number) {
  const monthly = annualGross / 12;
  const byPercent = (monthly * rentPct) / 100;
  const by40x = annualGross / 40;
  const byDti = Math.max(0, (monthly * dtiPct) / 100 - monthlyDebts);
  const recommended = Math.min(byPercent, by40x, byDti);
  return { monthly, byPercent, by40x, byDti, recommended };
}

/* ---------------- Recurring costs ---------------- */

export type Cycle = "weekly" | "monthly" | "quarterly" | "semiannual" | "annual";

export const CYCLES: { value: Cycle; label: string; perYear: number }[] = [
  { value: "weekly", label: "Weekly", perYear: 52 },
  { value: "monthly", label: "Monthly", perYear: 12 },
  { value: "quarterly", label: "Every 3 months", perYear: 4 },
  { value: "semiannual", label: "Every 6 months", perYear: 2 },
  { value: "annual", label: "Yearly", perYear: 1 },
];

export function yearlyCost(price: number, cycle: Cycle): number {
  return price * (CYCLES.find((c) => c.value === cycle)?.perYear ?? 0);
}

/* ---------------- Unit price ---------------- */

export type Dimension = "mass" | "volume" | "count" | "length";

/** Unit factors to a base unit per dimension: grams, millilitres, items, metres. */
export const UNITS: { value: string; label: string; dim: Dimension; factor: number }[] = [
  { value: "g", label: "g", dim: "mass", factor: 1 },
  { value: "kg", label: "kg", dim: "mass", factor: 1000 },
  { value: "oz", label: "oz", dim: "mass", factor: 28.349523125 },
  { value: "lb", label: "lb", dim: "mass", factor: 453.59237 },
  { value: "ml", label: "ml", dim: "volume", factor: 1 },
  { value: "l", label: "L", dim: "volume", factor: 1000 },
  { value: "floz", label: "fl oz (US)", dim: "volume", factor: 29.5735295625 },
  { value: "gal", label: "gal (US)", dim: "volume", factor: 3785.411784 },
  { value: "m", label: "m", dim: "length", factor: 1 },
  { value: "ft", label: "ft", dim: "length", factor: 0.3048 },
  { value: "item", label: "items", dim: "count", factor: 1 },
];

/** Price per `perQty` of `perUnit`, given a price for `qty` of `unit`. */
export function unitPrice(price: number, qty: number, unit: string, perUnit: string, perQty = 1): number | null {
  const a = UNITS.find((u) => u.value === unit);
  const b = UNITS.find((u) => u.value === perUnit);
  if (!a || !b || a.dim !== b.dim || qty <= 0) return null;
  const baseQty = qty * a.factor;
  return (price / baseQty) * b.factor * perQty;
}
