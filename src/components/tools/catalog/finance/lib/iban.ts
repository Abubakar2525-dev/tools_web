/**
 * IBAN validation (ISO 13616) with country lengths and BBAN structures taken
 * from the SWIFT IBAN Registry. Structure codes: n = digits, a = upper-case
 * letters, c = upper-case letters or digits; "4!n" means exactly 4 digits.
 * `bank` / `branch` are [start, end) offsets inside the BBAN.
 */

type Entry = { name: string; length: number; bban: string; bank?: [number, number]; branch?: [number, number] };

export const IBAN_REGISTRY: Record<string, Entry> = {
  AD: { name: "Andorra", length: 24, bban: "4!n4!n12!c", bank: [0, 4], branch: [4, 8] },
  AE: { name: "United Arab Emirates", length: 23, bban: "3!n16!n", bank: [0, 3] },
  AL: { name: "Albania", length: 28, bban: "8!n16!c", bank: [0, 3], branch: [3, 7] },
  AT: { name: "Austria", length: 20, bban: "5!n11!n", bank: [0, 5] },
  AZ: { name: "Azerbaijan", length: 28, bban: "4!a20!c", bank: [0, 4] },
  BA: { name: "Bosnia and Herzegovina", length: 20, bban: "3!n3!n8!n2!n", bank: [0, 3], branch: [3, 6] },
  BE: { name: "Belgium", length: 16, bban: "3!n7!n2!n", bank: [0, 3] },
  BG: { name: "Bulgaria", length: 22, bban: "4!a4!n2!n8!c", bank: [0, 4], branch: [4, 8] },
  BH: { name: "Bahrain", length: 22, bban: "4!a14!c", bank: [0, 4] },
  BI: { name: "Burundi", length: 27, bban: "5!n5!n11!n2!n", bank: [0, 5], branch: [5, 10] },
  BR: { name: "Brazil", length: 29, bban: "8!n5!n10!n1!a1!c", bank: [0, 8], branch: [8, 13] },
  BY: { name: "Belarus", length: 28, bban: "4!c4!n16!c", bank: [0, 4] },
  CH: { name: "Switzerland", length: 21, bban: "5!n12!c", bank: [0, 5] },
  CR: { name: "Costa Rica", length: 22, bban: "4!n14!n", bank: [0, 4] },
  CY: { name: "Cyprus", length: 28, bban: "3!n5!n16!c", bank: [0, 3], branch: [3, 8] },
  CZ: { name: "Czechia", length: 24, bban: "4!n6!n10!n", bank: [0, 4] },
  DE: { name: "Germany", length: 22, bban: "8!n10!n", bank: [0, 8] },
  DJ: { name: "Djibouti", length: 27, bban: "5!n5!n11!n2!n", bank: [0, 5], branch: [5, 10] },
  DK: { name: "Denmark", length: 18, bban: "4!n9!n1!n", bank: [0, 4] },
  DO: { name: "Dominican Republic", length: 28, bban: "4!c20!n", bank: [0, 4] },
  EE: { name: "Estonia", length: 20, bban: "2!n14!n", bank: [0, 2] },
  EG: { name: "Egypt", length: 29, bban: "4!n4!n17!n", bank: [0, 4], branch: [4, 8] },
  ES: { name: "Spain", length: 24, bban: "4!n4!n1!n1!n10!n", bank: [0, 4], branch: [4, 8] },
  FI: { name: "Finland", length: 18, bban: "3!n11!n", bank: [0, 3] },
  FK: { name: "Falkland Islands", length: 18, bban: "2!a12!n", bank: [0, 2] },
  FO: { name: "Faroe Islands", length: 18, bban: "4!n9!n1!n", bank: [0, 4] },
  FR: { name: "France", length: 27, bban: "5!n5!n11!c2!n", bank: [0, 5], branch: [5, 10] },
  GB: { name: "United Kingdom", length: 22, bban: "4!a6!n8!n", bank: [0, 4], branch: [4, 10] },
  GE: { name: "Georgia", length: 22, bban: "2!a16!n", bank: [0, 2] },
  GI: { name: "Gibraltar", length: 23, bban: "4!a15!c", bank: [0, 4] },
  GL: { name: "Greenland", length: 18, bban: "4!n9!n1!n", bank: [0, 4] },
  GR: { name: "Greece", length: 27, bban: "3!n4!n16!c", bank: [0, 3], branch: [3, 7] },
  GT: { name: "Guatemala", length: 28, bban: "4!c20!c", bank: [0, 4] },
  HN: { name: "Honduras", length: 28, bban: "4!a20!n", bank: [0, 4] },
  HR: { name: "Croatia", length: 21, bban: "7!n10!n", bank: [0, 7] },
  HU: { name: "Hungary", length: 28, bban: "3!n4!n1!n15!n1!n", bank: [0, 3], branch: [3, 7] },
  IE: { name: "Ireland", length: 22, bban: "4!a6!n8!n", bank: [0, 4], branch: [4, 10] },
  IL: { name: "Israel", length: 23, bban: "3!n3!n13!n", bank: [0, 3], branch: [3, 6] },
  IQ: { name: "Iraq", length: 23, bban: "4!a3!n12!n", bank: [0, 4], branch: [4, 7] },
  IS: { name: "Iceland", length: 26, bban: "4!n2!n6!n10!n", bank: [0, 2], branch: [2, 4] },
  IT: { name: "Italy", length: 27, bban: "1!a5!n5!n12!c", bank: [1, 6], branch: [6, 11] },
  JO: { name: "Jordan", length: 30, bban: "4!a4!n18!c", bank: [0, 4], branch: [4, 8] },
  KW: { name: "Kuwait", length: 30, bban: "4!a22!c", bank: [0, 4] },
  KZ: { name: "Kazakhstan", length: 20, bban: "3!n13!c", bank: [0, 3] },
  LB: { name: "Lebanon", length: 28, bban: "4!n20!c", bank: [0, 4] },
  LC: { name: "Saint Lucia", length: 32, bban: "4!a24!c", bank: [0, 4] },
  LI: { name: "Liechtenstein", length: 21, bban: "5!n12!c", bank: [0, 5] },
  LT: { name: "Lithuania", length: 20, bban: "5!n11!n", bank: [0, 5] },
  LU: { name: "Luxembourg", length: 20, bban: "3!n13!c", bank: [0, 3] },
  LV: { name: "Latvia", length: 21, bban: "4!a13!c", bank: [0, 4] },
  LY: { name: "Libya", length: 25, bban: "3!n3!n15!n", bank: [0, 3], branch: [3, 6] },
  MC: { name: "Monaco", length: 27, bban: "5!n5!n11!c2!n", bank: [0, 5], branch: [5, 10] },
  MD: { name: "Moldova", length: 24, bban: "2!c18!c", bank: [0, 2] },
  ME: { name: "Montenegro", length: 22, bban: "3!n13!n2!n", bank: [0, 3] },
  MK: { name: "North Macedonia", length: 19, bban: "3!n10!c2!n", bank: [0, 3] },
  MN: { name: "Mongolia", length: 20, bban: "4!n12!n", bank: [0, 4] },
  MR: { name: "Mauritania", length: 27, bban: "5!n5!n11!n2!n", bank: [0, 5], branch: [5, 10] },
  MT: { name: "Malta", length: 31, bban: "4!a5!n18!c", bank: [0, 4], branch: [4, 9] },
  MU: { name: "Mauritius", length: 30, bban: "4!a2!n2!n12!n3!n3!a", bank: [0, 6], branch: [6, 8] },
  NI: { name: "Nicaragua", length: 28, bban: "4!a20!n", bank: [0, 4] },
  NL: { name: "Netherlands", length: 18, bban: "4!a10!n", bank: [0, 4] },
  NO: { name: "Norway", length: 15, bban: "4!n6!n1!n", bank: [0, 4] },
  OM: { name: "Oman", length: 23, bban: "3!n16!c", bank: [0, 3] },
  PK: { name: "Pakistan", length: 24, bban: "4!a16!c", bank: [0, 4] },
  PL: { name: "Poland", length: 28, bban: "8!n16!n", branch: [0, 8] },
  PS: { name: "Palestine", length: 29, bban: "4!a21!c", bank: [0, 4] },
  PT: { name: "Portugal", length: 25, bban: "4!n4!n11!n2!n", bank: [0, 4], branch: [4, 8] },
  QA: { name: "Qatar", length: 29, bban: "4!a21!c", bank: [0, 4] },
  RO: { name: "Romania", length: 24, bban: "4!a16!c", bank: [0, 4] },
  RS: { name: "Serbia", length: 22, bban: "3!n13!n2!n", bank: [0, 3] },
  RU: { name: "Russia", length: 33, bban: "9!n5!n15!c", bank: [0, 9], branch: [9, 14] },
  SA: { name: "Saudi Arabia", length: 24, bban: "2!n18!c", bank: [0, 2] },
  SC: { name: "Seychelles", length: 31, bban: "4!a2!n2!n16!n3!a", bank: [0, 6], branch: [6, 8] },
  SD: { name: "Sudan", length: 18, bban: "2!n12!n", bank: [0, 2] },
  SE: { name: "Sweden", length: 24, bban: "3!n16!n1!n", bank: [0, 3] },
  SI: { name: "Slovenia", length: 19, bban: "5!n8!n2!n", bank: [0, 2], branch: [2, 5] },
  SK: { name: "Slovakia", length: 24, bban: "4!n6!n10!n", bank: [0, 4] },
  SM: { name: "San Marino", length: 27, bban: "1!a5!n5!n12!c", bank: [1, 6], branch: [6, 11] },
  SO: { name: "Somalia", length: 23, bban: "4!n3!n12!n", bank: [0, 4], branch: [4, 7] },
  ST: { name: "Sao Tome and Principe", length: 25, bban: "4!n4!n11!n2!n", bank: [0, 4], branch: [4, 8] },
  SV: { name: "El Salvador", length: 28, bban: "4!a20!n", bank: [0, 4] },
  TL: { name: "Timor-Leste", length: 23, bban: "3!n14!n2!n", bank: [0, 3] },
  TN: { name: "Tunisia", length: 24, bban: "2!n3!n13!n2!n", bank: [0, 2], branch: [2, 5] },
  TR: { name: "Turkey", length: 26, bban: "5!n1!n16!c", bank: [0, 5] },
  UA: { name: "Ukraine", length: 29, bban: "6!n19!c", bank: [0, 6] },
  VA: { name: "Vatican City", length: 22, bban: "3!n15!n", bank: [0, 3] },
  VG: { name: "British Virgin Islands", length: 24, bban: "4!a16!n", bank: [0, 4] },
  XK: { name: "Kosovo", length: 20, bban: "4!n10!n2!n", bank: [0, 2], branch: [2, 4] },
  YE: { name: "Yemen", length: 30, bban: "4!a4!n18!c", bank: [0, 4], branch: [4, 8] },
};

/** Removes spaces, dashes and an "IBAN" prefix; upper-cases. */
export function normalizeIban(input: string): string {
  return input
    .toUpperCase()
    .replace(/^IBAN[:\s]*/, "")
    .replace(/[\s\-.]/g, "");
}

/** Groups of 4 characters separated by spaces (paper / print format). */
export function printFormat(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})(?=.)/g, "$1 ");
}

/** ISO 7064 MOD 97-10 on an IBAN (country + check digits moved to the end), chunked arithmetic. */
export function mod97(iban: string): number {
  const s = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    const val = code >= 65 && code <= 90 ? String(code - 55) : ch;
    for (const d of val) rem = (rem * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return rem;
}

/** Computes the two check digits for a country code and BBAN. */
export function checkDigits(country: string, bban: string): string {
  const r = mod97(`${country}00${bban}`);
  return String(98 - r).padStart(2, "0");
}

/** Converts "4!n6!c" into a RegExp. */
export function bbanRegex(format: string): RegExp {
  const parts = format.match(/\d+!?[nac]/g) ?? [];
  const body = parts
    .map((p) => {
      const m = /^(\d+)(!?)([nac])$/.exec(p);
      if (!m) return "";
      const cls = m[3] === "n" ? "[0-9]" : m[3] === "a" ? "[A-Z]" : "[A-Z0-9]";
      return m[2] ? `${cls}{${m[1]}}` : `${cls}{1,${m[1]}}`;
    })
    .join("");
  return new RegExp(`^${body}$`);
}

/** Human-readable structure, e.g. "4 letters, 6 digits, 8 digits". */
export function describeFormat(format: string): string {
  const parts = format.match(/\d+!?[nac]/g) ?? [];
  return parts
    .map((p) => {
      const m = /^(\d+)!?([nac])$/.exec(p);
      if (!m) return p;
      const n = Number(m[1]);
      const kind = m[2] === "n" ? (n === 1 ? "digit" : "digits") : m[2] === "a" ? (n === 1 ? "letter" : "letters") : n === 1 ? "letter or digit" : "letters or digits";
      return `${n} ${kind}`;
    })
    .join(", ");
}

export type IbanCheck = {
  input: string;
  iban: string;
  country: string | null;
  countryName: string | null;
  expectedLength: number | null;
  checks: { label: string; ok: boolean; detail: string }[];
  valid: boolean;
  bban: string;
  bank: string | null;
  branch: string | null;
  account: string | null;
  suggestedCheckDigits: string | null;
};

export function validateIban(input: string): IbanCheck {
  const iban = normalizeIban(input);
  const checks: IbanCheck["checks"] = [];
  const country = /^[A-Z]{2}/.test(iban) ? iban.slice(0, 2) : null;
  const entry = country ? IBAN_REGISTRY[country] : undefined;
  const charsetOk = /^[A-Z0-9]+$/.test(iban);
  checks.push({
    label: "Characters",
    ok: charsetOk,
    detail: charsetOk ? "Only letters A to Z and digits." : "Contains characters other than letters and digits.",
  });
  checks.push({
    label: "Country code",
    ok: !!entry,
    detail: entry ? `${country}: ${entry.name}` : country ? `${country} is not an IBAN country in the SWIFT registry.` : "The first two characters must be a country code.",
  });
  const cdOk = /^[A-Z]{2}[0-9]{2}/.test(iban);
  checks.push({ label: "Check digits", ok: cdOk, detail: cdOk ? `Characters 3 and 4: ${iban.slice(2, 4)}` : "Characters 3 and 4 must be digits." });
  const lenOk = !!entry && iban.length === entry.length;
  checks.push({
    label: "Length",
    ok: lenOk,
    detail: entry ? `${iban.length} of ${entry.length} characters` : `${iban.length} characters`,
  });
  const bban = iban.slice(4);
  let structOk = false;
  if (entry) {
    structOk = lenOk && bbanRegex(entry.bban).test(bban);
    checks.push({
      label: "Account structure",
      ok: structOk,
      detail: structOk ? `Matches ${describeFormat(entry.bban)}` : `Expected ${describeFormat(entry.bban)}`,
    });
  }
  const modOk = charsetOk && cdOk && iban.length > 4 && mod97(iban) === 1;
  checks.push({
    label: "Checksum (mod 97)",
    ok: modOk,
    detail: modOk ? "Remainder is 1, as required." : charsetOk && iban.length > 4 ? `Remainder is ${mod97(iban)}, expected 1.` : "Cannot compute.",
  });
  const valid = checks.every((c) => c.ok);
  const slice = (r?: [number, number]) => (r && bban.length >= r[1] ? bban.slice(r[0], r[1]) : null);
  let accountStart = 0;
  if (entry?.branch) accountStart = entry.branch[1];
  else if (entry?.bank) accountStart = entry.bank[1];
  const suggested =
    entry && lenOk && structOk && charsetOk && !modOk ? checkDigits(country as string, bban) : null;
  return {
    input,
    iban,
    country,
    countryName: entry?.name ?? null,
    expectedLength: entry?.length ?? null,
    checks,
    valid,
    bban,
    bank: slice(entry?.bank),
    branch: slice(entry?.branch),
    account: entry && bban.length > accountStart ? bban.slice(accountStart) : null,
    suggestedCheckDigits: suggested,
  };
}
