/** Currency formatting, CSV and small money helpers shared by the finance tools. */

export type CurrencyInfo = { code: string; name: string; locale: string };

/** Common currencies, each with a locale that formats it naturally. */
export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", name: "US dollar", locale: "en-US" },
  { code: "EUR", name: "Euro", locale: "de-DE" },
  { code: "GBP", name: "British pound", locale: "en-GB" },
  { code: "INR", name: "Indian rupee", locale: "en-IN" },
  { code: "PKR", name: "Pakistani rupee", locale: "en-PK" },
  { code: "CAD", name: "Canadian dollar", locale: "en-CA" },
  { code: "AUD", name: "Australian dollar", locale: "en-AU" },
  { code: "NZD", name: "New Zealand dollar", locale: "en-NZ" },
  { code: "JPY", name: "Japanese yen", locale: "ja-JP" },
  { code: "CNY", name: "Chinese yuan", locale: "zh-CN" },
  { code: "CHF", name: "Swiss franc", locale: "de-CH" },
  { code: "SEK", name: "Swedish krona", locale: "sv-SE" },
  { code: "NOK", name: "Norwegian krone", locale: "nb-NO" },
  { code: "DKK", name: "Danish krone", locale: "da-DK" },
  { code: "PLN", name: "Polish zloty", locale: "pl-PL" },
  { code: "AED", name: "UAE dirham", locale: "en-AE" },
  { code: "SAR", name: "Saudi riyal", locale: "en-SA" },
  { code: "SGD", name: "Singapore dollar", locale: "en-SG" },
  { code: "HKD", name: "Hong Kong dollar", locale: "en-HK" },
  { code: "ZAR", name: "South African rand", locale: "en-ZA" },
  { code: "NGN", name: "Nigerian naira", locale: "en-NG" },
  { code: "KES", name: "Kenyan shilling", locale: "en-KE" },
  { code: "BRL", name: "Brazilian real", locale: "pt-BR" },
  { code: "MXN", name: "Mexican peso", locale: "es-MX" },
  { code: "KRW", name: "South Korean won", locale: "ko-KR" },
  { code: "TRY", name: "Turkish lira", locale: "tr-TR" },
  { code: "BDT", name: "Bangladeshi taka", locale: "en-BD" },
  { code: "PHP", name: "Philippine peso", locale: "en-PH" },
  { code: "IDR", name: "Indonesian rupiah", locale: "id-ID" },
  { code: "MYR", name: "Malaysian ringgit", locale: "en-MY" },
];

export const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code}: ${c.name}` }));

const fmtCache = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, digits?: number) {
  const key = `${currency}|${digits ?? "d"}`;
  let f = fmtCache.get(key);
  if (!f) {
    const info = CURRENCIES.find((c) => c.code === currency);
    const opts: Intl.NumberFormatOptions = { style: "currency", currency };
    if (digits !== undefined) {
      opts.minimumFractionDigits = digits;
      opts.maximumFractionDigits = digits;
    }
    try {
      f = new Intl.NumberFormat(info?.locale ?? "en-US", opts);
    } catch {
      f = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    }
    fmtCache.set(key, f);
  }
  return f;
}

/** Formats an amount in the given currency (locale chosen per currency). */
export function money(n: number, currency = "USD", digits?: number): string {
  if (!Number.isFinite(n)) return "n/a";
  // Round first so tiny negatives never show as "-0.00".
  const f = formatter(currency, digits);
  const d = f.resolvedOptions().maximumFractionDigits ?? 2;
  let v = Math.round(n * 10 ** d) / 10 ** d;
  if (v === 0) v = 0;
  return f.format(v);
}

/** Number of minor-unit digits for a currency (2 for USD, 0 for JPY). */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Plain percentage with up to `digits` decimals, e.g. pct(12.345) → "12.35%". */
export function pct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "n/a";
  const r = Math.round((n + Number.EPSILON * Math.sign(n)) * 10 ** digits) / 10 ** digits;
  return `${(Object.is(r, -0) ? 0 : r).toLocaleString("en-US", { maximumFractionDigits: digits })}%`;
}

/** Round to cents (or other minor units) without floating noise. */
export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON * Math.sign(n)) * f) / f;
}

/** RFC 4180 CSV with CRLF line endings. */
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          let s = String(c);
          // Neutralize spreadsheet formulas in user text (numbers are left alone).
          if (typeof c === "string" && /^[=+\-@]/.test(s) && !/^[-+]?\d/.test(s)) s = `'${s}`;
          return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

/**
 * Splits `totalMinor` (integer minor units) proportionally to `weights` so the
 * parts sum exactly to the total (largest remainder method).
 */
export function allocate(totalMinor: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (totalMinor * w) / sum);
  const floors = exact.map((x) => Math.floor(x));
  let left = totalMinor - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) floors[order[k].i] += 1;
  return floors;
}
