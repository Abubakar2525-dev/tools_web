/** Loan maths: level payment (EMI), amortization schedules, mortgage PITI + PMI. */

/**
 * Level periodic payment for a fully amortizing loan.
 * EMI = P r (1+r)^n / ((1+r)^n − 1), with r the periodic rate; P / n when r = 0.
 */
export function emi(principal: number, periodicRate: number, periods: number): number {
  if (periods <= 0) return NaN;
  if (periodicRate === 0) return principal / periods;
  const f = Math.pow(1 + periodicRate, periods);
  return (principal * periodicRate * f) / (f - 1);
}

export type AmortRow = {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  extra: number;
  balance: number;
};

export type Amortization = {
  payment: number;
  rows: AmortRow[];
  totalInterest: number;
  totalPaid: number;
  months: number;
};

/**
 * Monthly schedule. `extra` is an additional principal payment made with
 * every scheduled payment. The final payment is trimmed to the remaining balance.
 */
export function amortize(principal: number, annualRatePct: number, months: number, extra = 0): Amortization {
  const r = annualRatePct / 100 / 12;
  const payment = emi(principal, r, months);
  const rows: AmortRow[] = [];
  let bal = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  for (let k = 1; k <= months && bal > 0.005; k++) {
    const interest = bal * r;
    let princ = payment - interest;
    let ex = extra;
    if (princ >= bal) {
      princ = bal;
      ex = 0;
    } else if (princ + ex > bal) {
      ex = bal - princ;
    }
    bal = bal - princ - ex;
    if (Math.abs(bal) < 0.005) bal = 0;
    totalInterest += interest;
    totalPaid += interest + princ + ex;
    rows.push({ period: k, payment: interest + princ, principal: princ, interest, extra: ex, balance: bal });
  }
  return { payment, rows, totalInterest, totalPaid, months: rows.length };
}

export type YearRow = { year: number; principal: number; interest: number; extra: number; balance: number };

/** Groups a monthly schedule into loan years (12 payments each). */
export function byYear(rows: AmortRow[]): YearRow[] {
  const out: YearRow[] = [];
  for (const r of rows) {
    const y = Math.ceil(r.period / 12);
    let cur = out[out.length - 1];
    if (!cur || cur.year !== y) {
      cur = { year: y, principal: 0, interest: 0, extra: 0, balance: 0 };
      out.push(cur);
    }
    cur.principal += r.principal;
    cur.interest += r.interest;
    cur.extra += r.extra;
    cur.balance = r.balance;
  }
  return out;
}

export type MortgageInput = {
  homePrice: number;
  downPayment: number;
  annualRatePct: number;
  years: number;
  propertyTaxYear: number;
  insuranceYear: number;
  /** Annual PMI as % of the original loan amount; charged while LTV > 80% (or until 78% if `pmiTo78`). */
  pmiRatePct: number;
  /** When true PMI stops once the balance reaches 78% of the home price; otherwise it is paid for the whole loan. */
  pmiTo78: boolean;
  hoaMonth: number;
  extraMonth: number;
};

export type MortgageResult = {
  loan: number;
  ltvPct: number;
  pi: number;
  taxMonth: number;
  insMonth: number;
  pmiMonth: number;
  hoaMonth: number;
  firstMonthTotal: number;
  pmiMonths: number;
  totalPmi: number;
  base: Amortization;
  withExtra: Amortization;
  /** PMI-free month total (P&I + tax + insurance + HOA). */
  afterPmiTotal: number;
};

export function mortgage(i: MortgageInput): MortgageResult {
  const loan = Math.max(0, i.homePrice - i.downPayment);
  const months = Math.round(i.years * 12);
  const base = amortize(loan, i.annualRatePct, months, 0);
  const withExtra = i.extraMonth > 0 ? amortize(loan, i.annualRatePct, months, i.extraMonth) : base;
  const ltvPct = i.homePrice > 0 ? (loan / i.homePrice) * 100 : 0;
  const needsPmi = ltvPct > 80 && i.pmiRatePct > 0;
  const pmiMonth = needsPmi ? (loan * i.pmiRatePct) / 100 / 12 : 0;
  let pmiMonths = 0;
  if (needsPmi) {
    if (!i.pmiTo78) pmiMonths = withExtra.months;
    else {
      // PMI is paid with each payment while the balance before that payment is above 78% of the price.
      const limit = 0.78 * i.homePrice;
      let bal = loan;
      for (const r of withExtra.rows) {
        if (bal <= limit + 1e-9) break;
        pmiMonths++;
        bal = r.balance;
      }
    }
  }
  const taxMonth = i.propertyTaxYear / 12;
  const insMonth = i.insuranceYear / 12;
  const pi = base.payment;
  return {
    loan,
    ltvPct,
    pi,
    taxMonth,
    insMonth,
    pmiMonth,
    hoaMonth: i.hoaMonth,
    firstMonthTotal: pi + taxMonth + insMonth + pmiMonth + i.hoaMonth,
    pmiMonths,
    totalPmi: pmiMonth * pmiMonths,
    base,
    withExtra,
    afterPmiTotal: pi + taxMonth + insMonth + i.hoaMonth,
  };
}
