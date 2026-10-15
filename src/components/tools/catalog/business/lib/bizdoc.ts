/**
 * Shared model for invoices, receipts, quotations, purchase orders and
 * expense reports: document shape, per-kind labels, totals in integer minor
 * units, numbering and JSON import validation.
 */

import { LOCALES, allocate, currencyDigits, includedTax, isValidCurrency, minorToPlain, mulPct, mulQty, parseScaled, toMinor } from "./money";
import type { PageSizeId } from "./pdfText";

const LOCALE_IDS = new Set<string>(LOCALES.map((l) => l.value));

export type DocKind = "invoice" | "receipt" | "quote" | "po" | "expense";

export interface Party {
  name: string;
  company: string;
  address: string;
  email: string;
  phone: string;
  taxId: string;
}

export interface LineItem {
  id: string;
  description: string;
  qty: string;
  unitPrice: string;
  taxRate: string;
  discount: string;
  /** Expense reports only. */
  date: string;
  category: string;
}

export interface BizDoc {
  version: 1;
  kind: DocKind;
  title: string;
  number: string;
  issueDate: string;
  /** Due date (invoice), valid until (quote), delivery date (PO). */
  secondDate: string;
  reference: string;
  currency: string;
  locale: string;
  from: Party;
  to: Party;
  shipTo: Party;
  items: LineItem[];
  pricesIncludeTax: boolean;
  discountType: "percent" | "amount";
  discountValue: string;
  shipping: string;
  amountPaid: string;
  paidInFull: boolean;
  paymentMethod: string;
  notes: string;
  terms: string;
  logo: string | null;
  accent: string;
  pageSize: PageSizeId;
  showSignatures: boolean;
  signatures: string[];
}

export interface KindConfig {
  title: string;
  numberPrefix: string;
  fromLabel: string;
  toLabel: string;
  shipToLabel?: string;
  issueLabel: string;
  secondLabel?: string;
  secondDays?: number;
  referenceLabel: string;
  paidLabel: string;
  balanceLabel: string;
  showPaymentMethod: boolean;
  expense: boolean;
  defaultSignatures: string[];
  signaturesOn: boolean;
  notesPlaceholder: string;
  termsPlaceholder: string;
}

export const KINDS: Record<DocKind, KindConfig> = {
  invoice: {
    title: "Invoice",
    numberPrefix: "INV-",
    fromLabel: "From",
    toLabel: "Bill to",
    issueLabel: "Invoice date",
    secondLabel: "Due date",
    secondDays: 14,
    referenceLabel: "PO / reference",
    paidLabel: "Amount paid",
    balanceLabel: "Balance due",
    showPaymentMethod: false,
    expense: false,
    defaultSignatures: ["Authorized signature"],
    signaturesOn: false,
    notesPlaceholder: "Thank you for your business.",
    termsPlaceholder: "Payment due within 14 days. Bank: …, IBAN: …",
  },
  receipt: {
    title: "Receipt",
    numberPrefix: "RCPT-",
    fromLabel: "Received by",
    toLabel: "Received from",
    issueLabel: "Payment date",
    referenceLabel: "Invoice / transaction ref.",
    paidLabel: "Amount paid",
    balanceLabel: "Balance remaining",
    showPaymentMethod: true,
    expense: false,
    defaultSignatures: ["Received by"],
    signaturesOn: false,
    notesPlaceholder: "Thank you for your payment.",
    termsPlaceholder: "Refund policy or other terms (optional).",
  },
  quote: {
    title: "Quotation",
    numberPrefix: "QT-",
    fromLabel: "From",
    toLabel: "Prepared for",
    issueLabel: "Quote date",
    secondLabel: "Valid until",
    secondDays: 30,
    referenceLabel: "Project / reference",
    paidLabel: "Deposit received",
    balanceLabel: "Amount after deposit",
    showPaymentMethod: false,
    expense: false,
    defaultSignatures: ["Accepted by (client)"],
    signaturesOn: true,
    notesPlaceholder: "Scope, assumptions and what is not included.",
    termsPlaceholder: "50% deposit on acceptance, balance on delivery.",
  },
  po: {
    title: "Purchase order",
    numberPrefix: "PO-",
    fromLabel: "Buyer",
    toLabel: "Supplier",
    shipToLabel: "Ship to",
    issueLabel: "Order date",
    secondLabel: "Delivery date",
    secondDays: 14,
    referenceLabel: "Requisition / quote ref.",
    paidLabel: "Prepaid",
    balanceLabel: "Amount payable",
    showPaymentMethod: false,
    expense: false,
    defaultSignatures: ["Authorized by (buyer)", "Accepted by (supplier)"],
    signaturesOn: true,
    notesPlaceholder: "Delivery instructions, packaging, contact on site.",
    termsPlaceholder: "Payment net 30 from receipt of goods and a correct invoice.",
  },
  expense: {
    title: "Expense report",
    numberPrefix: "EXP-",
    fromLabel: "Employee",
    toLabel: "Submitted to",
    issueLabel: "Report date",
    referenceLabel: "Purpose / project",
    paidLabel: "Advance received",
    balanceLabel: "Amount to reimburse",
    showPaymentMethod: false,
    expense: true,
    defaultSignatures: ["Employee signature", "Approved by"],
    signaturesOn: true,
    notesPlaceholder: "Trip or project details, cost center.",
    termsPlaceholder: "I certify these expenses were incurred for business purposes.",
  },
};

export const EXPENSE_CATEGORIES = [
  "Travel",
  "Lodging",
  "Meals",
  "Transport",
  "Mileage",
  "Office supplies",
  "Software",
  "Phone and internet",
  "Training",
  "Client entertainment",
  "Other",
] as const;

export const emptyParty = (): Party => ({ name: "", company: "", address: "", email: "", phone: "", taxId: "" });

let idCounter = 0;
export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `i${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export const emptyItem = (kind: DocKind): LineItem => ({
  id: newId(),
  description: "",
  qty: "1",
  unitPrice: "",
  taxRate: "",
  discount: "",
  date: "",
  category: kind === "expense" ? "Travel" : "",
});

export function blankDoc(kind: DocKind): BizDoc {
  const k = KINDS[kind];
  return {
    version: 1,
    kind,
    title: k.title,
    number: `${k.numberPrefix}0001`,
    issueDate: "",
    secondDate: "",
    reference: "",
    currency: "USD",
    locale: "en-US",
    from: emptyParty(),
    to: emptyParty(),
    shipTo: emptyParty(),
    items: [{ ...emptyItem(kind), id: "item-1" }],
    pricesIncludeTax: kind === "expense",
    discountType: "percent",
    discountValue: "",
    shipping: "",
    amountPaid: "",
    paidInFull: kind === "receipt",
    paymentMethod: kind === "receipt" ? "Bank transfer" : "",
    notes: "",
    terms: "",
    logo: null,
    accent: "#1f6f5c",
    pageSize: "a4",
    showSignatures: k.signaturesOn,
    signatures: [...k.defaultSignatures],
  };
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function localTodayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(iso: string, locale: string): string {
  if (!isIsoDate(iso)) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/* Numbering                                                           */
/* ------------------------------------------------------------------ */

/** "INV-0042" → "INV-0043", "2026/9" → "2026/10", "Q-A" → "Q-A-2". Keeps zero padding. */
export function incrementDocNumber(current: string): string {
  const s = current.trim();
  const m = s.match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return s ? `${s}-2` : "1";
  const [, pre, digits, post] = m;
  const next = String(BigInt(digits) + BigInt(1));
  return `${pre}${next.padStart(digits.length, "0")}${post}`;
}

/* ------------------------------------------------------------------ */
/* Totals                                                              */
/* ------------------------------------------------------------------ */

export const QTY_SCALE = 3;
export const PCT_SCALE = 3;

export interface LineCalc {
  id: string;
  qty: number | null;
  unit: number | null;
  rate: number;
  gross: number;
  lineDiscount: number;
  net: number;
  errors: { qty?: string; unitPrice?: string; taxRate?: string; discount?: string };
}

export interface TaxLine {
  /** Rate scaled by 10^PCT_SCALE. */
  rate: number;
  base: number;
  tax: number;
}

export interface Totals {
  digits: number;
  lines: LineCalc[];
  /** Sum of line nets (after line discounts). */
  subtotal: number;
  discount: number;
  taxes: TaxLine[];
  taxTotal: number;
  shipping: number;
  total: number;
  paid: number;
  balance: number;
  byCategory: { category: string; amount: number }[];
  errors: string[];
  fieldErrors: { discount?: string; shipping?: string; paid?: string; currency?: string };
}

function pct(raw: string, label: string): { v: number; err?: string } {
  if (!raw.trim()) return { v: 0 };
  const v = parseScaled(raw.replace(/%$/, ""), PCT_SCALE);
  if (v === null) return { v: 0, err: `${label}: enter a number like 7.5` };
  if (v < 0 || v > 100 * 10 ** PCT_SCALE) return { v: 0, err: `${label}: use 0 to 100` };
  return { v };
}

/** Calculates every line and the document totals in integer minor units. */
export function computeTotals(doc: BizDoc): Totals {
  const currencyOk = isValidCurrency(doc.currency);
  const currency = currencyOk ? doc.currency : "USD";
  const digits = currencyDigits(currency);
  const errors: string[] = [];
  const fieldErrors: Totals["fieldErrors"] = {};
  if (!currencyOk) fieldErrors.currency = "Use a 3-letter ISO currency code, like USD.";

  const lines: LineCalc[] = doc.items.map((it) => {
    const e: LineCalc["errors"] = {};
    const qtyRaw = it.qty.trim() === "" ? "1" : it.qty;
    const qty = parseScaled(qtyRaw, QTY_SCALE);
    if (qty === null) e.qty = "Enter a quantity";
    else if (Math.abs(qty) > 1e9 * 10 ** QTY_SCALE) e.qty = "Quantity is too large";
    const unit = it.unitPrice.trim() === "" ? 0 : toMinor(it.unitPrice, currency);
    if (unit === null) e.unitPrice = "Enter a price like 120.50";
    else if (Math.abs(unit) > 1e13) e.unitPrice = "Price is too large";
    const r = pct(it.taxRate, "Tax");
    if (r.err) e.taxRate = r.err;
    const d = pct(it.discount, "Discount");
    if (d.err) e.discount = d.err;
    const ok = !e.qty && !e.unitPrice;
    const gross = ok ? mulQty(qty as number, unit as number, QTY_SCALE) : 0;
    const lineDiscount = ok && !d.err ? mulPct(gross, d.v, PCT_SCALE) : 0;
    return {
      id: it.id,
      qty: e.qty ? null : qty,
      unit: e.unitPrice ? null : unit,
      rate: r.err ? 0 : r.v,
      gross,
      lineDiscount,
      net: gross - lineDiscount,
      errors: e,
    };
  });
  if (lines.some((l) => Object.keys(l.errors).length)) errors.push("Some line items have invalid values and count as zero.");

  const subtotal = lines.reduce((a, l) => a + l.net, 0);

  // Document-level discount, applied before tax.
  const isExpense = doc.kind === "expense";
  let discount = 0;
  if (!isExpense && doc.discountValue.trim()) {
    if (doc.discountType === "percent") {
      const d = pct(doc.discountValue, "Discount");
      if (d.err) fieldErrors.discount = "Enter a percentage from 0 to 100.";
      else discount = mulPct(subtotal, d.v, PCT_SCALE);
    } else {
      const v = toMinor(doc.discountValue, currency);
      if (v === null || v < 0) fieldErrors.discount = "Enter a positive amount.";
      else discount = Math.min(v, Math.max(subtotal, 0));
    }
  }

  // Group nets by tax rate and spread the discount across groups exactly.
  const rates: number[] = [];
  const bases: number[] = [];
  for (const l of lines) {
    const i = rates.indexOf(l.rate);
    if (i === -1) {
      rates.push(l.rate);
      bases.push(l.net);
    } else bases[i] += l.net;
  }
  const discParts = allocate(discount, bases.map((b) => Math.max(b, 0)));
  const taxes: TaxLine[] = [];
  rates.forEach((rate, i) => {
    const base = bases[i] - discParts[i];
    if (rate === 0) return;
    if (doc.pricesIncludeTax) {
      const tax = includedTax(base, rate, PCT_SCALE);
      taxes.push({ rate, base: base - tax, tax });
    } else {
      taxes.push({ rate, base, tax: mulPct(base, rate, PCT_SCALE) });
    }
  });
  taxes.sort((a, b) => a.rate - b.rate);
  const taxTotal = taxes.reduce((a, t) => a + t.tax, 0);

  let shipping = 0;
  if (!isExpense && doc.shipping.trim()) {
    const v = toMinor(doc.shipping, currency);
    if (v === null || v < 0) fieldErrors.shipping = "Enter a positive amount.";
    else shipping = v;
  }

  const total = subtotal - discount + (doc.pricesIncludeTax ? 0 : taxTotal) + shipping;

  let paid = 0;
  if (doc.kind === "receipt" && doc.paidInFull) paid = total;
  else if (doc.amountPaid.trim()) {
    const v = toMinor(doc.amountPaid, currency);
    if (v === null || v < 0) fieldErrors.paid = "Enter a positive amount.";
    else paid = v;
  }

  const cats = new Map<string, number>();
  if (doc.kind === "expense") {
    doc.items.forEach((it, i) => {
      const c = it.category.trim() || "Uncategorized";
      cats.set(c, (cats.get(c) ?? 0) + lines[i].net);
    });
  }

  return {
    digits,
    lines,
    subtotal,
    discount,
    taxes,
    taxTotal,
    shipping,
    total,
    paid,
    balance: total - paid,
    byCategory: Array.from(cats, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    errors,
    fieldErrors,
  };
}

/** "7500" at scale 3 → "7.5%". */
export function formatRate(rateScaled: number): string {
  return `${Number((rateScaled / 10 ** PCT_SCALE).toFixed(PCT_SCALE))}%`;
}

/* ------------------------------------------------------------------ */
/* JSON import                                                         */
/* ------------------------------------------------------------------ */

const str = (v: unknown, max = 5000): string => (typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v) : "");

function party(v: unknown): Party {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    name: str(o.name, 300),
    company: str(o.company, 300),
    address: str(o.address, 1000),
    email: str(o.email, 300),
    phone: str(o.phone, 100),
    taxId: str(o.taxId, 100),
  };
}

/**
 * Normalizes any stored or imported object into a complete BizDoc: unknown
 * fields are dropped, missing ones get defaults, strings are length-capped.
 */
export function normalizeDoc(data: unknown, kind: DocKind, keepIds = true): BizDoc {
  const base = blankDoc(kind);
  if (!data || typeof data !== "object" || Array.isArray(data)) return base;
  const o = data as Record<string, unknown>;
  const seen = new Set<string>();
  const items: LineItem[] = (Array.isArray(o.items) ? (o.items as unknown[]) : []).slice(0, 500).map((raw, index) => {
    const it = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    // Stored drafts keep stable ids (deterministic fallback); imports get fresh ones.
    let id = keepIds ? (typeof it.id === "string" && it.id ? it.id : `row-${index}`) : newId();
    if (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    return {
      id,
      description: str(it.description, 2000),
      qty: str(it.qty, 30),
      unitPrice: str(it.unitPrice, 30),
      taxRate: str(it.taxRate, 12),
      discount: str(it.discount, 12),
      date: str(it.date, 10),
      category: str(it.category, 80),
    };
  });
  const logo = typeof o.logo === "string" && /^data:image\/(png|jpeg);base64,/.test(o.logo) && o.logo.length < 3_000_000 ? o.logo : null;
  const currency = typeof o.currency === "string" && isValidCurrency(o.currency) ? o.currency.toUpperCase() : base.currency;
  return {
    ...base,
    title: typeof o.title === "string" ? o.title.slice(0, 80) : base.title,
    number: typeof o.number === "string" ? o.number.slice(0, 60) : base.number,
    issueDate: isIsoDate(str(o.issueDate)) ? str(o.issueDate) : "",
    secondDate: isIsoDate(str(o.secondDate)) ? str(o.secondDate) : "",
    reference: str(o.reference, 200),
    currency,
    locale: typeof o.locale === "string" && LOCALE_IDS.has(o.locale) ? o.locale : base.locale,
    from: party(o.from),
    to: party(o.to),
    shipTo: party(o.shipTo),
    items,
    pricesIncludeTax: typeof o.pricesIncludeTax === "boolean" ? o.pricesIncludeTax : base.pricesIncludeTax,
    discountType: o.discountType === "amount" ? "amount" : "percent",
    discountValue: str(o.discountValue, 30),
    shipping: str(o.shipping, 30),
    amountPaid: str(o.amountPaid, 30),
    paidInFull: typeof o.paidInFull === "boolean" ? o.paidInFull : base.paidInFull,
    paymentMethod: typeof o.paymentMethod === "string" ? o.paymentMethod.slice(0, 100) : base.paymentMethod,
    notes: str(o.notes),
    terms: str(o.terms),
    logo,
    accent: typeof o.accent === "string" && /^#[0-9a-f]{6}$/i.test(o.accent) ? o.accent : base.accent,
    pageSize: o.pageSize === "letter" ? "letter" : "a4",
    showSignatures: typeof o.showSignatures === "boolean" ? o.showSignatures : base.showSignatures,
    signatures: Array.isArray(o.signatures) ? (o.signatures as unknown[]).map((x) => str(x, 80)).slice(0, 4) : base.signatures,
  };
}

/** Validates an imported JSON export. Returns an error message for unusable input. */
export function parseDocJson(text: string, expectedKind: DocKind): BizDoc | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return "This file is not valid JSON.";
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return "Expected a JSON object exported from this tool.";
  if (!Array.isArray((data as Record<string, unknown>).items)) return "The file has no line items, so it does not look like a document export.";
  return normalizeDoc(data, expectedKind, false);
}

/** Rows for a CSV export of the line items (amounts as plain decimals). */
export function itemsCsvRows(doc: BizDoc, t: Totals): (string | number)[][] {
  const plain = (minor: number) => minorToPlain(minor, t.digits);
  if (doc.kind === "expense") {
    const rows: (string | number)[][] = [["Date", "Category", "Description", `Amount (${doc.currency})`, "Tax %"]];
    doc.items.forEach((it, i) => rows.push([it.date, it.category, it.description, plain(t.lines[i].net), it.taxRate]));
    rows.push([], ["", "", "Total", plain(t.total), ""], ["", "", KINDS.expense.paidLabel, plain(t.paid), ""], ["", "", KINDS.expense.balanceLabel, plain(t.balance), ""]);
    return rows;
  }
  const rows: (string | number)[][] = [["Description", "Quantity", `Unit price (${doc.currency})`, "Discount %", "Tax %", `Amount (${doc.currency})`]];
  doc.items.forEach((it, i) => rows.push([it.description, it.qty || "1", it.unitPrice, it.discount, it.taxRate, plain(t.lines[i].net)]));
  rows.push([], ["Subtotal", "", "", "", "", plain(t.subtotal)]);
  if (t.discount) rows.push(["Discount", "", "", "", "", plain(-t.discount)]);
  t.taxes.forEach((x) => rows.push([`Tax ${formatRate(x.rate)}${doc.pricesIncludeTax ? " (included)" : ""}`, "", "", "", "", plain(x.tax)]));
  if (t.shipping) rows.push(["Shipping", "", "", "", "", plain(t.shipping)]);
  rows.push(["Total", "", "", "", "", plain(t.total)]);
  return rows;
}
