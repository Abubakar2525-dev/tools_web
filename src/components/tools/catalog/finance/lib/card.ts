/** Payment card number checks: Luhn (mod 10) and network detection from IIN ranges. */

export type Network = {
  id: string;
  name: string;
  /** Valid lengths for this network. */
  lengths: number[];
  /** Inclusive numeric prefix ranges, compared on the same number of digits. */
  ranges: [string, string][];
  /** Grouping pattern for display, e.g. [4, 6, 5]. */
  groups?: number[];
};

const r = (a: string, b = a): [string, string] => [a, b];
const span = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * Ordered most specific first; the longest matching prefix wins.
 * Sources: public network acceptance guides (IIN ranges change over time;
 * this list covers the widely published ranges).
 */
export const NETWORKS: Network[] = [
  { id: "amex", name: "American Express", lengths: [15], ranges: [r("34"), r("37")], groups: [4, 6, 5] },
  { id: "diners", name: "Diners Club", lengths: span(14, 19), ranges: [r("300", "305"), r("3095"), r("36"), r("38", "39")], groups: [4, 6, 4] },
  { id: "jcb", name: "JCB", lengths: span(16, 19), ranges: [r("3528", "3589")] },
  { id: "visa", name: "Visa", lengths: [13, 16, 19], ranges: [r("4")] },
  { id: "mastercard", name: "Mastercard", lengths: [16], ranges: [r("51", "55"), r("2221", "2720")] },
  {
    id: "maestro",
    name: "Maestro",
    lengths: span(12, 19),
    ranges: [r("5018"), r("5020"), r("5038"), r("5893"), r("6304"), r("6759"), r("6761", "6763")],
  },
  { id: "discover", name: "Discover", lengths: span(16, 19), ranges: [r("6011"), r("644", "649"), r("65"), r("622126", "622925")] },
  { id: "unionpay", name: "UnionPay", lengths: span(16, 19), ranges: [r("62")] },
];

/** Strips spaces and dashes. Returns null if anything else is present. */
export function cleanCardNumber(input: string): string | null {
  const s = input.replace(/[\s-]/g, "");
  return /^\d*$/.test(s) ? s : null;
}

export function luhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Check digit that would make `partial` + digit pass Luhn. */
export function luhnCheckDigit(partial: string): number {
  for (let d = 0; d <= 9; d++) if (luhn(partial + d)) return d;
  return -1;
}

function matchLen(digits: string, [lo, hi]: [string, string]): number {
  const len = lo.length;
  if (digits.length < len) return 0;
  const p = Number(digits.slice(0, len));
  return p >= Number(lo) && p <= Number(hi) ? len : 0;
}

/** All networks whose ranges match, best (longest prefix) first. Co-badged ranges can match two. */
export function detectNetworks(digits: string): Network[] {
  const hits: { n: Network; len: number }[] = [];
  for (const n of NETWORKS) {
    const len = Math.max(0, ...n.ranges.map((rg) => matchLen(digits, rg)));
    if (len > 0) hits.push({ n, len });
  }
  return hits.sort((a, b) => b.len - a.len).map((h) => h.n);
}

/** Shows the first 6 and last 4 digits, masks the rest. */
export function maskCard(digits: string): string {
  if (digits.length <= 10) return digits.replace(/\d(?=\d{4})/g, "•");
  return digits.slice(0, 6) + "•".repeat(digits.length - 10) + digits.slice(-4);
}

export function groupCard(s: string, groups?: number[]): string {
  const g = groups ?? [];
  if (g.length && g.reduce((a, b) => a + b, 0) === s.length) {
    const out: string[] = [];
    let i = 0;
    for (const n of g) {
      out.push(s.slice(i, i + n));
      i += n;
    }
    return out.join(" ");
  }
  return s.replace(/(.{4})(?=.)/g, "$1 ");
}

export function checkCard(input: string) {
  const digits = cleanCardNumber(input);
  if (digits === null) return { kind: "invalid-chars" as const };
  if (digits.length === 0) return { kind: "empty" as const };
  const networks = detectNetworks(digits);
  const primary = networks[0] ?? null;
  const luhnOk = digits.length >= 8 && luhn(digits);
  const lengthOk = primary ? primary.lengths.includes(digits.length) : digits.length >= 12 && digits.length <= 19;
  return {
    kind: "ok" as const,
    digits,
    length: digits.length,
    networks,
    primary,
    luhnOk,
    lengthOk,
    valid: luhnOk && lengthOk,
    masked: groupCard(maskCard(digits), primary?.groups),
    expectedCheckDigit: digits.length > 1 ? luhnCheckDigit(digits.slice(0, -1)) : null,
  };
}
