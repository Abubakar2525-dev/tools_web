/**
 * Pure calculation helpers for the business calculators (pay, pricing,
 * planning). All functions are deterministic and unit-tested.
 */

/* ------------------------------------------------------------------ */
/* Time and hours                                                      */
/* ------------------------------------------------------------------ */

/** "9:30", "09:30", "930", "9.5" (decimal hours) or "9:30 pm" → minutes after midnight, or null. */
export function parseClock(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  const m = s.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap.startsWith("p") && h !== 12) h += 12;
    if (ap.startsWith("a") && h === 12) h = 0;
  } else if (h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** Worked minutes between two clock times minus a break; crosses midnight when out ≤ in. */
export function shiftMinutes(inMin: number, outMin: number, breakMin = 0): number {
  let span = outMin - inMin;
  if (span <= 0) span += 24 * 60;
  return Math.max(0, span - Math.max(0, breakMin));
}

/** 450 → "7:30". */
export function hm(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const a = Math.round(Math.abs(minutes));
  return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}

export interface OvertimeRules {
  /** Daily hours after which overtime starts (null = no daily rule). */
  dailyOT: number | null;
  /** Daily hours after which double time starts (null = none). */
  dailyDT: number | null;
  /** Weekly regular-hour limit (null = none). */
  weeklyOT: number | null;
}

export interface DaySplit {
  hours: number;
  regular: number;
  overtime: number;
  double: number;
}

/**
 * Splits hours per day into regular, overtime and double time. Daily rules
 * apply first; then regular hours beyond the weekly limit become overtime
 * (in day order), so no hour is counted twice.
 */
export function splitOvertime(days: number[], r: OvertimeRules): { days: DaySplit[]; regular: number; overtime: number; double: number; total: number } {
  const out: DaySplit[] = days.map((h) => {
    const hours = Math.max(0, h);
    const dtStart = r.dailyDT ?? Infinity;
    const otStart = r.dailyOT ?? Infinity;
    const double = Math.max(0, hours - dtStart);
    const overtime = Math.max(0, Math.min(hours, dtStart) - otStart);
    return { hours, regular: hours - double - overtime, overtime, double };
  });
  if (r.weeklyOT !== null) {
    let cum = 0;
    for (const d of out) {
      const room = Math.max(0, r.weeklyOT - cum);
      const moved = Math.max(0, d.regular - room);
      cum += d.regular;
      d.regular -= moved;
      d.overtime += moved;
    }
  }
  const sum = (k: keyof DaySplit) => out.reduce((a, d) => a + d[k], 0);
  return { days: out, regular: sum("regular"), overtime: sum("overtime"), double: sum("double"), total: sum("hours") };
}

/* ------------------------------------------------------------------ */
/* Commission                                                          */
/* ------------------------------------------------------------------ */

export interface Tier {
  /** Upper bound of the band (inclusive); null = no limit. */
  upTo: number | null;
  /** Rate in percent. */
  rate: number;
}

/** Validates tiers: ascending limits, only the last may be open-ended. */
export function checkTiers(tiers: Tier[]): string | null {
  if (!tiers.length) return "Add at least one tier.";
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (t.rate < 0) return `Tier ${i + 1}: the rate can't be negative.`;
    if (t.upTo === null && i !== tiers.length - 1) return `Tier ${i + 1}: only the last tier can be open-ended.`;
    if (t.upTo !== null && t.upTo <= 0) return `Tier ${i + 1}: the limit must be above zero.`;
    const prev = tiers[i - 1]?.upTo;
    if (i > 0 && t.upTo !== null && prev !== null && prev !== undefined && t.upTo <= prev) return `Tier ${i + 1}: limits must increase from tier to tier.`;
  }
  return null;
}

export interface CommissionBand {
  from: number;
  to: number | null;
  rate: number;
  amountInBand: number;
  commission: number;
}

/**
 * Marginal: each band's rate applies only to the sales inside that band.
 * Full tier: the rate of the band the total falls into applies to all sales.
 * Sales above the last limit (when it is not open-ended) earn the last rate.
 */
export function tieredCommission(sales: number, tiers: Tier[], mode: "marginal" | "full"): { commission: number; bands: CommissionBand[]; effectiveRate: number } {
  const bands: CommissionBand[] = [];
  let from = 0;
  tiers.forEach((t, i) => {
    const last = i === tiers.length - 1;
    const to = last ? null : t.upTo;
    const inBand = Math.max(0, Math.min(sales, to ?? Infinity) - from);
    bands.push({ from, to, rate: t.rate, amountInBand: inBand, commission: 0 });
    from = to ?? from;
  });
  let commission = 0;
  if (mode === "marginal") {
    for (const b of bands) {
      b.commission = (b.amountInBand * b.rate) / 100;
      commission += b.commission;
    }
  } else {
    const hit = bands.find((b) => b.to === null || sales <= b.to) ?? bands[bands.length - 1];
    if (hit) {
      commission = (sales * hit.rate) / 100;
      hit.commission = commission;
    }
  }
  return { commission, bands, effectiveRate: sales > 0 ? (commission / sales) * 100 : 0 };
}

/**
 * Draw against commission. A recoverable draw creates a balance owed when
 * commission falls short, repaid from later commission above the draw.
 */
export function settleDraw(commission: number, draw: number, owedBefore: number, recoverable: boolean): { paid: number; owedAfter: number; repaid: number } {
  const owed = recoverable ? Math.max(0, owedBefore) : 0;
  const available = commission - owed;
  if (available >= draw) return { paid: available, owedAfter: 0, repaid: owed };
  if (commission >= draw) {
    // Enough to cover the draw, part of the old balance gets repaid.
    const repaid = commission - draw;
    return { paid: draw, owedAfter: owed - repaid, repaid };
  }
  return { paid: draw, owedAfter: recoverable ? owed + (draw - commission) : 0, repaid: 0 };
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

export const marginFromMarkup = (markupPct: number) => (markupPct / (100 + markupPct)) * 100;
export const markupFromMargin = (marginPct: number) => (marginPct / (100 - marginPct)) * 100;

export function breakEven(fixed: number, price: number, variable: number, targetProfit = 0) {
  const cm = price - variable;
  if (cm <= 0) return null;
  const exactUnits = (fixed + targetProfit) / cm;
  return { contribution: cm, cmRatio: cm / price, exactUnits, units: Math.ceil(exactUnits - 1e-9), revenue: exactUnits * price };
}

/* ------------------------------------------------------------------ */
/* Subscription revenue                                                */
/* ------------------------------------------------------------------ */

export interface MrrRow {
  month: number;
  newCustomers: number;
  churned: number;
  customers: number;
  mrr: number;
  cumulative: number;
}

/**
 * Month-by-month subscription projection. New sign-ups grow by `growthPct`
 * per month; `churnPct` of the customers at the start of each month cancel.
 */
export function projectMrr(start: number, arpu: number, newPerMonth: number, growthPct: number, churnPct: number, months: number): MrrRow[] {
  const rows: MrrRow[] = [];
  let c = start;
  let cum = 0;
  for (let m = 1; m <= months; m++) {
    const churned = (c * churnPct) / 100;
    const add = newPerMonth * Math.pow(1 + growthPct / 100, m - 1);
    c = c - churned + add;
    const mrr = c * arpu;
    cum += mrr;
    rows.push({ month: m, newCustomers: add, churned, customers: c, mrr, cumulative: cum });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Cash flow                                                           */
/* ------------------------------------------------------------------ */

export interface CashRow {
  inflow: number;
  outflow: number;
}

export function cashFlow(opening: number, rows: CashRow[]) {
  let bal = opening;
  let runsOutAt: number | null = null;
  const out = rows.map((r, i) => {
    const net = r.inflow - r.outflow;
    const openBal = bal;
    bal += net;
    if (runsOutAt === null && bal < 0) runsOutAt = i;
    return { ...r, net, opening: openBal, closing: bal };
  });
  const nets = out.map((r) => r.net);
  const totalIn = rows.reduce((a, r) => a + r.inflow, 0);
  const totalOut = rows.reduce((a, r) => a + r.outflow, 0);
  const avgNet = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : 0;
  const recent = nets.slice(-3);
  const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const burn = recentAvg < 0 ? -recentAvg : 0;
  /** Months of cash left after the last month, at the recent average burn. */
  const runwayAfter = burn > 0 && bal > 0 ? bal / burn : null;
  return { rows: out, closing: bal, totalIn, totalOut, avgNet, burn, runwayAfter, runsOutAt };
}

/* ------------------------------------------------------------------ */
/* Project quote                                                       */
/* ------------------------------------------------------------------ */

export function projectQuote(labor: number, expenses: number, contingencyPct: number, marginPct: number, taxPct: number) {
  if (marginPct >= 100) return null;
  const base = labor + expenses;
  const contingency = (base * contingencyPct) / 100;
  const cost = base + contingency;
  const price = cost / (1 - marginPct / 100);
  const profit = price - cost;
  const tax = (price * taxPct) / 100;
  return { base, contingency, cost, price, profit, tax, total: price + tax, markup: cost > 0 ? (profit / cost) * 100 : 0 };
}

/* ------------------------------------------------------------------ */
/* Meetings                                                            */
/* ------------------------------------------------------------------ */

export interface AttendeeGroup {
  count: number;
  amount: number;
  basis: "hourly" | "annual";
}

/** Fully loaded cost per hour of a meeting. */
export function meetingHourlyCost(groups: AttendeeGroup[], hoursPerYear: number, overheadPct: number): number {
  const mult = 1 + overheadPct / 100;
  return groups.reduce((a, g) => a + g.count * (g.basis === "hourly" ? g.amount : g.amount / hoursPerYear) * mult, 0);
}
