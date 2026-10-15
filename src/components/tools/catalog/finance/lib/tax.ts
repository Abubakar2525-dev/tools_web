/**
 * Payroll and income tax estimates.
 *
 * United States, tax year 2026 (federal only):
 * - Brackets and standard deductions: IRS Rev. Proc. 2025-32, sections 4.01 and 4.14
 *   (https://www.irs.gov/pub/irs-drop/rp-25-32.pdf).
 * - Social Security wage base $184,500 for 2026: SSA (https://www.ssa.gov/oact/cola/cbb.html).
 * - Employee Social Security 6.2%, Medicare 1.45%, Additional Medicare Tax 0.9% above
 *   $200,000 (single, head of household) / $250,000 (married filing jointly):
 *   IRS Topic 751 and Topic 560.
 *
 * United Kingdom, tax year 2026 to 2027 (6 April 2026 to 5 April 2027), England,
 * Wales and Northern Ireland (Scotland has its own bands):
 * - Personal allowance £12,570, reduced by £1 for every £2 of adjusted net income
 *   over £100,000; basic rate 20% on the first £37,700 of taxable income, higher
 *   40% up to £125,140, additional 45% above (https://www.gov.uk/income-tax-rates).
 * - Employee Class 1 National Insurance (category A): 8% between the primary
 *   threshold £12,570 and upper earnings limit £50,270, 2% above
 *   (https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027).
 */

export type Bracket = { upTo: number; rate: number };
export type UsStatus = "single" | "mfj" | "hoh";

export const US_TAX_YEAR = 2026;
export const UK_TAX_YEAR = "2026 to 2027";

export const US_STANDARD_DEDUCTION: Record<UsStatus, number> = { single: 16100, mfj: 32200, hoh: 24150 };

export const US_BRACKETS: Record<UsStatus, Bracket[]> = {
  single: [
    { upTo: 12400, rate: 0.1 },
    { upTo: 50400, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201775, rate: 0.24 },
    { upTo: 256225, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  mfj: [
    { upTo: 24800, rate: 0.1 },
    { upTo: 100800, rate: 0.12 },
    { upTo: 211400, rate: 0.22 },
    { upTo: 403550, rate: 0.24 },
    { upTo: 512450, rate: 0.32 },
    { upTo: 768700, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  hoh: [
    { upTo: 17700, rate: 0.1 },
    { upTo: 67450, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201750, rate: 0.24 },
    { upTo: 256200, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

export const US_SS_RATE = 0.062;
export const US_SS_WAGE_BASE = 184500;
export const US_MEDICARE_RATE = 0.0145;
export const US_ADDL_MEDICARE_RATE = 0.009;
export const US_ADDL_MEDICARE_THRESHOLD: Record<UsStatus, number> = { single: 200000, mfj: 250000, hoh: 200000 };

/** Progressive tax on `taxable` with a bracket table. Returns tax and marginal rate. */
export function progressiveTax(taxable: number, brackets: Bracket[]) {
  let tax = 0;
  let lower = 0;
  let marginal = brackets[0]?.rate ?? 0;
  const parts: { from: number; to: number; rate: number; tax: number }[] = [];
  for (const b of brackets) {
    if (taxable <= lower) break;
    const top = Math.min(taxable, b.upTo);
    const t = (top - lower) * b.rate;
    parts.push({ from: lower, to: top, rate: b.rate, tax: t });
    tax += t;
    marginal = b.rate;
    lower = b.upTo;
  }
  return { tax, marginal, parts };
}

export function usTakeHome(gross: number, status: UsStatus, preTax401k = 0) {
  const deduction = US_STANDARD_DEDUCTION[status];
  const agi = Math.max(0, gross - preTax401k);
  const taxable = Math.max(0, agi - deduction);
  const fed = progressiveTax(taxable, US_BRACKETS[status]);
  // FICA applies to wages before traditional 401(k) deferrals.
  const ss = Math.min(gross, US_SS_WAGE_BASE) * US_SS_RATE;
  const medicare = gross * US_MEDICARE_RATE;
  const addlMedicare = Math.max(0, gross - US_ADDL_MEDICARE_THRESHOLD[status]) * US_ADDL_MEDICARE_RATE;
  const totalTax = fed.tax + ss + medicare + addlMedicare;
  const net = gross - preTax401k - totalTax;
  return {
    gross,
    preTax401k,
    deduction,
    taxable,
    federal: fed.tax,
    marginal: fed.marginal,
    brackets: fed.parts,
    ss,
    medicare,
    addlMedicare,
    totalTax,
    net,
    effectivePct: gross > 0 ? (totalTax / gross) * 100 : 0,
  };
}

export const UK_PERSONAL_ALLOWANCE = 12570;
export const UK_TAPER_START = 100000;
export const UK_BASIC_BAND = 37700;
export const UK_ADDITIONAL_FROM = 125140;
export const UK_NI_PT = 12570;
export const UK_NI_UEL = 50270;
export const UK_NI_MAIN = 0.08;
export const UK_NI_UPPER = 0.02;

/** Personal allowance after the £1-per-£2 taper above £100,000 of adjusted net income. */
export function ukPersonalAllowance(adjustedNetIncome: number): number {
  const reduction = Math.floor(Math.max(0, adjustedNetIncome - UK_TAPER_START) / 2);
  return Math.max(0, UK_PERSONAL_ALLOWANCE - reduction);
}

/**
 * UK estimate on an annual employment income (gross salary only; pension
 * contributions, benefits in kind and student loans are not modelled). NI is computed on
 * annual earnings (payroll actually works per pay period, so results can differ
 * slightly for uneven pay).
 */
export function ukTakeHome(gross: number) {
  const pa = ukPersonalAllowance(gross);
  const taxable = Math.max(0, gross - pa);
  const basic = Math.min(taxable, UK_BASIC_BAND) * 0.2;
  const higher = Math.max(0, Math.min(taxable, UK_ADDITIONAL_FROM) - UK_BASIC_BAND) * 0.4;
  const additional = Math.max(0, taxable - UK_ADDITIONAL_FROM) * 0.45;
  const incomeTax = basic + higher + additional;
  const niMain = Math.max(0, Math.min(gross, UK_NI_UEL) - UK_NI_PT) * UK_NI_MAIN;
  const niUpper = Math.max(0, gross - UK_NI_UEL) * UK_NI_UPPER;
  const ni = niMain + niUpper;
  let marginal = 0;
  if (taxable > UK_ADDITIONAL_FROM) marginal = 0.45;
  else if (gross > UK_TAPER_START && pa > 0) marginal = 0.6;
  else if (taxable > UK_BASIC_BAND) marginal = 0.4;
  else if (taxable > 0) marginal = 0.2;
  const niMarginal = gross > UK_NI_UEL ? UK_NI_UPPER : gross > UK_NI_PT ? UK_NI_MAIN : 0;
  const totalTax = incomeTax + ni;
  return {
    gross,
    personalAllowance: pa,
    taxable,
    basic,
    higher,
    additional,
    incomeTax,
    ni,
    niMain,
    niUpper,
    totalTax,
    net: gross - totalTax,
    marginal,
    niMarginal,
    effectivePct: gross > 0 ? (totalTax / gross) * 100 : 0,
  };
}
