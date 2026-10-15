/**
 * Money helpers that keep amounts in integer minor units (cents, pence, yen)
 * so totals never pick up floating-point drift. Multiplication by quantities
 * and percentages goes through BigInt with round-half-away-from-zero.
 */

export const CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "JPY", "CNY", "INR", "PKR", "BDT", "LKR", "AED", "SAR", "QAR",
  "EGP", "NGN", "KES", "ZAR", "GHS", "TRY", "PLN", "CZK", "HUF", "SEK", "NOK", "DKK", "RON", "BRL", "MXN", "ARS",
  "CLP", "COP", "PEN", "SGD", "HKD", "MYR", "IDR", "PHP", "THB", "VND", "KRW", "TWD", "ILS", "KWD", "BHD", "OMR", "JOD",
] as const;

export const LOCALES = [
  { value: "en-US", label: "English (US) 1,234.56" },
  { value: "en-GB", label: "English (UK) 1,234.56" },
  { value: "en-IN", label: "English (India) 1,23,456.78" },
  { value: "de-DE", label: "German 1.234,56" },
  { value: "fr-FR", label: "French 1 234,56" },
  { value: "es-ES", label: "Spanish 1234,56" },
  { value: "it-IT", label: "Italian 1.234,56" },
  { value: "nl-NL", label: "Dutch 1.234,56" },
  { value: "pt-BR", label: "Portuguese (BR) 1.234,56" },
  { value: "de-CH", label: "Swiss 1’234.56" },
] as const;

const digitCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (USD 2, JPY 0, KWD 3). */
export function currencyDigits(code: string): number {
  const c = code.toUpperCase();
  const hit = digitCache.get(c);
  if (hit !== undefined) return hit;
  let d = 2;
  try {
    d = new Intl.NumberFormat("en", { style: "currency", currency: c }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    d = 2;
  }
  digitCache.set(c, d);
  return d;
}

export function isValidCurrency(code: string): boolean {
  if (!/^[A-Za-z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code.toUpperCase() });
    return true;
  } catch {
    return false;
  }
}

/** Rounds a BigInt division half away from zero. */
function divRound(n: bigint, d: bigint): bigint {
  const neg = n < BigInt(0) !== d < BigInt(0);
  const an = n < BigInt(0) ? -n : n;
  const ad = d < BigInt(0) ? -d : d;
  const q = an / ad;
  const r = an % ad;
  const rounded = r * BigInt(2) >= ad ? q + BigInt(1) : q;
  return neg ? -rounded : rounded;
}

/**
 * Parses a decimal string exactly into an integer scaled by 10^scale.
 * "1,234.565" with scale 2 → 123457. Returns null for invalid input; "" → null.
 */
export function parseScaled(raw: string, scale: number): number | null {
  const s = raw.trim().replace(/[,\s_]/g, "");
  if (!s) return null;
  const m = s.match(/^([-+])?(\d*)(?:\.(\d*))?$/);
  if (!m || (!m[2] && !m[3])) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const intPart = m[2] || "0";
  const frac = m[3] ?? "";
  const keep = frac.slice(0, scale).padEnd(scale, "0");
  const rest = frac.slice(scale);
  let v = BigInt(intPart + keep);
  if (rest && Number(rest[0]) >= 5) v += BigInt(1);
  const n = Number(v);
  if (!Number.isSafeInteger(n)) return null;
  return sign * n;
}

/** Parses a money string to minor units for a currency. */
export const toMinor = (raw: string, currency: string) => parseScaled(raw, currencyDigits(currency));

/** Minor units → plain decimal string without grouping, e.g. 123457 → "1234.57". */
export function minorToPlain(minor: number, digits: number): string {
  const neg = minor < 0;
  const a = Math.abs(Math.round(minor));
  if (digits === 0) return `${neg ? "-" : ""}${a}`;
  const s = String(a).padStart(digits + 1, "0");
  return `${neg ? "-" : ""}${s.slice(0, -digits)}.${s.slice(-digits)}`;
}

/** qty (scaled by 10^qtyScale) × unit price (minor) → minor units, rounded. */
export function mulQty(qtyScaled: number, unitMinor: number, qtyScale = 3): number {
  return Number(divRound(BigInt(qtyScaled) * BigInt(unitMinor), BigInt(10) ** BigInt(qtyScale)));
}

/** amount × percent (scaled by 10^pctScale, so 7.5% = 7500 at scale 3) / 100 → minor, rounded. */
export function mulPct(amountMinor: number, pctScaled: number, pctScale = 3): number {
  return Number(divRound(BigInt(amountMinor) * BigInt(pctScaled), BigInt(100) * BigInt(10) ** BigInt(pctScale)));
}

/** Tax contained in a tax-inclusive amount: amount × r / (100 + r), rounded. */
export function includedTax(grossMinor: number, pctScaled: number, pctScale = 3): number {
  const hundred = BigInt(100) * BigInt(10) ** BigInt(pctScale);
  return Number(divRound(BigInt(grossMinor) * BigInt(pctScaled), hundred + BigInt(pctScaled)));
}

/**
 * Splits `total` across `weights` proportionally with the largest-remainder
 * method so the parts always add up exactly to `total`.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0 || weights.length === 0) return weights.map(() => 0);
  const T = BigInt(total);
  const S = BigInt(sum);
  const raw = weights.map((w) => {
    const p = BigInt(w) * T;
    return { q: p / S, r: p % S };
  });
  const parts = raw.map((x) => Number(x.q));
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, i) => ({ i, r: x.r < BigInt(0) ? -x.r : x.r }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  const step = left >= 0 ? 1 : -1;
  for (let k = 0; left !== 0 && k < order.length * 2; k++) {
    parts[order[k % order.length].i] += step;
    left -= step;
  }
  return parts;
}

const fmtCache = new Map<string, Intl.NumberFormat>();

/** Formats minor units with Intl, e.g. (123457, "EUR", "de-DE") → "1.234,57 €". */
export function formatMoney(minor: number, currency: string, locale = "en-US", display: "symbol" | "code" = "symbol"): string {
  const digits = currencyDigits(currency);
  const key = `${locale}|${currency}|${display}`;
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: display,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    } catch {
      f = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    }
    fmtCache.set(key, f);
  }
  return f.format(minor / 10 ** digits);
}

/** Formats a scaled number (e.g. quantity at scale 3) for display, trimming zeros. */
export function formatScaled(v: number, scale: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: scale }).format(v / 10 ** scale);
}
