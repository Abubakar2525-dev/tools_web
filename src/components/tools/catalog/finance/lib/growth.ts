/** Time-value-of-money helpers: compound growth, contributions, SIP, goals, ROI, retirement. */

/** Compounding periods per year; 0 means continuous. */
export type Compounding = 1 | 2 | 4 | 12 | 52 | 365 | 0;

/** Effective rate for one sub-period when `perYear` sub-periods make a year. */
export function periodRate(annualPct: number, compounding: Compounding, perYear: number): number {
  const r = annualPct / 100;
  if (compounding === 0) return Math.exp(r / perYear) - 1;
  return Math.pow(1 + r / compounding, compounding / perYear) - 1;
}

/** Effective annual rate (APY) for a nominal rate and compounding frequency. */
export function effectiveAnnual(annualPct: number, compounding: Compounding): number {
  return periodRate(annualPct, compounding, 1);
}

export type GrowthYear = {
  year: number;
  contributions: number;
  interest: number;
  /** Cumulative contributions including the starting amount. */
  totalContributed: number;
  totalInterest: number;
  balance: number;
};

export type CompoundInput = {
  principal: number;
  annualPct: number;
  years: number;
  compounding: Compounding;
  contribution: number;
  /** Contributions per year (1, 4, 12, 26, 52). */
  contribPerYear: number;
  /** true: deposit at the start of each contribution period (annuity due). */
  atStart: boolean;
  /** % increase applied to the contribution amount at the start of every year after the first. */
  contribGrowthPct?: number;
};

/**
 * Simulates the balance one contribution period at a time using the
 * effective rate for that period, which is exact for any compounding
 * frequency as long as deposits land on period boundaries.
 * Fractional final years are supported (rounded to whole contribution periods).
 */
export function compoundGrowth(i: CompoundInput): { final: number; years: GrowthYear[] } {
  const p = Math.max(1, Math.round(i.contribPerYear));
  const rate = periodRate(i.annualPct, i.compounding, p);
  const totalPeriods = Math.round(i.years * p);
  let bal = i.principal;
  let totalContributed = i.principal;
  let totalInterest = 0;
  let yContrib = 0;
  let yInterest = 0;
  const years: GrowthYear[] = [];
  let amount = i.contribution;
  for (let k = 1; k <= totalPeriods; k++) {
    if (k > 1 && (k - 1) % p === 0 && i.contribGrowthPct) amount *= 1 + i.contribGrowthPct / 100;
    if (i.atStart) {
      bal += amount;
      yContrib += amount;
    }
    const int = bal * rate;
    bal += int;
    yInterest += int;
    if (!i.atStart) {
      bal += amount;
      yContrib += amount;
    }
    if (k % p === 0 || k === totalPeriods) {
      totalContributed += yContrib;
      totalInterest += yInterest;
      years.push({
        year: Math.ceil(k / p),
        contributions: yContrib,
        interest: yInterest,
        totalContributed,
        totalInterest,
        balance: bal,
      });
      yContrib = 0;
      yInterest = 0;
    }
  }
  return { final: bal, years };
}

/** Closed form FV for a lump sum with periodic compounding (used for checks). */
export function fvLump(principal: number, annualPct: number, years: number, compounding: Compounding): number {
  if (compounding === 0) return principal * Math.exp((annualPct / 100) * years);
  return principal * Math.pow(1 + annualPct / 100 / compounding, compounding * years);
}

/**
 * SIP future value with monthly investments at the start of each month
 * (annuity due), monthly rate = annual / 12, and an optional yearly step-up.
 * Without step-up this equals P × [((1+i)^n − 1) / i] × (1+i).
 */
export function sip(monthly: number, annualPct: number, years: number, stepUpPct = 0) {
  const i = annualPct / 100 / 12;
  const n = Math.round(years * 12);
  let bal = 0;
  let invested = 0;
  let amt = monthly;
  const rows: { year: number; monthly: number; invested: number; value: number }[] = [];
  for (let k = 1; k <= n; k++) {
    if (k > 1 && (k - 1) % 12 === 0) amt *= 1 + stepUpPct / 100;
    bal = (bal + amt) * (1 + i);
    invested += amt;
    if (k % 12 === 0 || k === n) rows.push({ year: Math.ceil(k / 12), monthly: amt, invested, value: bal });
  }
  return { value: bal, invested, gains: bal - invested, rows };
}

export function sipClosedForm(monthly: number, annualPct: number, years: number): number {
  const i = annualPct / 100 / 12;
  const n = Math.round(years * 12);
  if (i === 0) return monthly * n;
  return monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
}

/**
 * Level end-of-month deposit needed to grow `current` to `goal` in `months`
 * at `annualPct` compounded monthly. Returns 0 if already on track.
 */
export function savingsNeeded(goal: number, current: number, annualPct: number, months: number): number {
  const i = annualPct / 100 / 12;
  if (months <= 0) return NaN;
  const growth = Math.pow(1 + i, months);
  const shortfall = goal - current * growth;
  if (shortfall <= 0) return 0;
  if (i === 0) return shortfall / months;
  return (shortfall * i) / (growth - 1);
}

/** ROI and annualized return (CAGR). */
export function roi(invested: number, returned: number, years?: number | null) {
  const gain = returned - invested;
  const roiPct = (gain / invested) * 100;
  const cagrPct = years && years > 0 && returned >= 0 ? (Math.pow(returned / invested, 1 / years) - 1) * 100 : null;
  return { gain, roiPct, cagrPct };
}

export type RetirementInput = {
  currentAge: number;
  retireAge: number;
  savings: number;
  monthly: number;
  /** Annual % raise in monthly contribution. */
  contribGrowthPct: number;
  returnPct: number;
  inflationPct: number;
  /** Desired annual retirement income in today's money. */
  incomeToday: number;
  /** Other annual income in retirement in today's money (pension, Social Security). */
  otherIncomeToday: number;
  withdrawalPct: number;
};

export function retirement(i: RetirementInput) {
  const years = i.retireAge - i.currentAge;
  const growth = compoundGrowth({
    principal: i.savings,
    annualPct: i.returnPct,
    years,
    compounding: 12,
    contribution: i.monthly,
    contribPerYear: 12,
    atStart: false,
    contribGrowthPct: i.contribGrowthPct,
  });
  const infl = Math.pow(1 + i.inflationPct / 100, years);
  const neededIncomeNominal = Math.max(0, i.incomeToday - i.otherIncomeToday) * infl;
  const target = neededIncomeNominal / (i.withdrawalPct / 100);
  const projected = growth.final;
  const gap = target - projected;
  // Extra level monthly saving (end of month, same return) that closes the gap.
  const extraMonthly = gap > 0 ? savingsNeeded(gap, 0, i.returnPct, years * 12) : 0;
  return {
    years,
    projected,
    projectedReal: projected / infl,
    target,
    targetReal: target / infl,
    gap,
    extraMonthly,
    sustainableIncome: projected * (i.withdrawalPct / 100),
    sustainableIncomeReal: (projected * (i.withdrawalPct / 100)) / infl,
    rows: growth.years,
    inflFactor: infl,
  };
}
