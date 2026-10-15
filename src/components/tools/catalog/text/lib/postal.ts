/**
 * Postal code format rules for 28 countries. Each rule normalizes input
 * (uppercase, strip spaces, hyphens and dots), checks the compact pattern and
 * re-inserts the separator the national postal operator uses.
 * Self-contained for direct Node testing.
 */

export type PostalRule = {
  code: string;
  country: string;
  /** Name of the code locally. */
  term: string;
  /** Pattern for the compact form (no spaces or hyphens). */
  compact: RegExp;
  /** Builds the display form from the compact string. */
  format: (c: string) => string;
  example: string;
  description: string;
};

const same = (c: string) => c;
const at = (pos: number, sep: string) => (c: string) => `${c.slice(0, pos)}${sep}${c.slice(pos)}`;

export const POSTAL_RULES: PostalRule[] = [
  {
    code: "US",
    country: "United States",
    term: "ZIP code",
    compact: /^\d{5}(\d{4})?$/,
    format: (c) => (c.length === 9 ? at(5, "-")(c) : c),
    example: "94105-1804",
    description: "5 digits, optionally followed by a hyphen and 4 more digits (ZIP+4).",
  },
  {
    code: "CA",
    country: "Canada",
    term: "Postal code",
    compact: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/,
    format: at(3, " "),
    example: "K1A 0B1",
    description: "Letter-digit-letter, space, digit-letter-digit. D, F, I, O, Q and U are never used; W and Z never start a code.",
  },
  {
    code: "MX",
    country: "Mexico",
    term: "Código postal",
    compact: /^\d{5}$/,
    format: same,
    example: "06600",
    description: "5 digits.",
  },
  {
    code: "BR",
    country: "Brazil",
    term: "CEP",
    compact: /^\d{8}$/,
    format: at(5, "-"),
    example: "01310-200",
    description: "8 digits written as 5 digits, a hyphen, then 3 digits.",
  },
  {
    code: "GB",
    country: "United Kingdom",
    term: "Postcode",
    compact: /^(GIR0AA|[A-PR-UWYZ](\d[A-HJKPSTUW]?|\d\d|[A-HK-Y]\d[ABEHMNPRV-Y]?|[A-HK-Y]\d\d)\d[ABD-HJLNP-UW-Z]{2})$/,
    format: (c) => `${c.slice(0, -3)} ${c.slice(-3)}`,
    example: "SW1A 1AA",
    description: "An outward code of 2-4 characters, a space, then an inward code of a digit and two letters.",
  },
  {
    code: "IE",
    country: "Ireland",
    term: "Eircode",
    compact: /^([AC-FHKNPRTV-Y]\d{2}|D6W)[0-9AC-FHKNPRTV-Y]{4}$/,
    format: at(3, " "),
    example: "D02 X285",
    description: "A 3-character routing key and a 4-character unique identifier, separated by a space.",
  },
  {
    code: "DE",
    country: "Germany",
    term: "Postleitzahl",
    compact: /^(0[1-9]|[1-9]\d)\d{3}$/,
    format: same,
    example: "10117",
    description: "5 digits; codes start at 01001.",
  },
  {
    code: "FR",
    country: "France",
    term: "Code postal",
    compact: /^\d{5}$/,
    format: same,
    example: "75008",
    description: "5 digits; the first two usually match the département.",
  },
  {
    code: "IT",
    country: "Italy",
    term: "CAP",
    compact: /^\d{5}$/,
    format: same,
    example: "00184",
    description: "5 digits.",
  },
  {
    code: "ES",
    country: "Spain",
    term: "Código postal",
    compact: /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/,
    format: same,
    example: "28013",
    description: "5 digits; the first two (01-52) identify the province.",
  },
  {
    code: "PT",
    country: "Portugal",
    term: "Código postal",
    compact: /^[1-9]\d{6}$/,
    format: at(4, "-"),
    example: "1100-148",
    description: "4 digits, a hyphen, then 3 digits.",
  },
  {
    code: "NL",
    country: "Netherlands",
    term: "Postcode",
    compact: /^[1-9]\d{3}(?!SA|SD|SS)[A-Z]{2}$/,
    format: at(4, " "),
    example: "1012 AB",
    description: "4 digits (not starting with 0), a space, then 2 letters. SA, SD and SS are not used.",
  },
  {
    code: "BE",
    country: "Belgium",
    term: "Postcode",
    compact: /^[1-9]\d{3}$/,
    format: same,
    example: "1000",
    description: "4 digits from 1000 to 9999.",
  },
  {
    code: "CH",
    country: "Switzerland",
    term: "Postleitzahl / NPA",
    compact: /^[1-9]\d{3}$/,
    format: same,
    example: "8001",
    description: "4 digits from 1000 to 9999.",
  },
  {
    code: "AT",
    country: "Austria",
    term: "Postleitzahl",
    compact: /^[1-9]\d{3}$/,
    format: same,
    example: "1010",
    description: "4 digits from 1000 to 9999.",
  },
  {
    code: "SE",
    country: "Sweden",
    term: "Postnummer",
    compact: /^[1-9]\d{4}$/,
    format: at(3, " "),
    example: "111 52",
    description: "5 digits written as 3 digits, a space, then 2 digits.",
  },
  {
    code: "NO",
    country: "Norway",
    term: "Postnummer",
    compact: /^\d{4}$/,
    format: same,
    example: "0150",
    description: "4 digits.",
  },
  {
    code: "DK",
    country: "Denmark",
    term: "Postnummer",
    compact: /^[1-9]\d{3}$/,
    format: same,
    example: "1050",
    description: "4 digits from 1000 to 9999.",
  },
  {
    code: "FI",
    country: "Finland",
    term: "Postinumero",
    compact: /^\d{5}$/,
    format: same,
    example: "00100",
    description: "5 digits.",
  },
  {
    code: "PL",
    country: "Poland",
    term: "Kod pocztowy",
    compact: /^\d{5}$/,
    format: at(2, "-"),
    example: "00-950",
    description: "5 digits written as 2 digits, a hyphen, then 3 digits.",
  },
  {
    code: "CZ",
    country: "Czechia",
    term: "PSČ",
    compact: /^[1-7]\d{4}$/,
    format: at(3, " "),
    example: "110 00",
    description: "5 digits written as 3 digits, a space, then 2 digits; the first digit is 1 to 7.",
  },
  {
    code: "JP",
    country: "Japan",
    term: "Yūbin bangō",
    compact: /^\d{7}$/,
    format: at(3, "-"),
    example: "100-0005",
    description: "7 digits written as 3 digits, a hyphen, then 4 digits.",
  },
  {
    code: "KR",
    country: "South Korea",
    term: "Postal code",
    compact: /^\d{5}$/,
    format: same,
    example: "04524",
    description: "5 digits (the 6-digit format was retired in 2015).",
  },
  {
    code: "CN",
    country: "China",
    term: "Postal code",
    compact: /^[0-8]\d{5}$/,
    format: same,
    example: "100006",
    description: "6 digits.",
  },
  {
    code: "IN",
    country: "India",
    term: "PIN code",
    compact: /^[1-9]\d{5}$/,
    format: same,
    example: "110001",
    description: "6 digits; the first digit (1-9) identifies the postal region.",
  },
  {
    code: "AU",
    country: "Australia",
    term: "Postcode",
    compact: /^\d{4}$/,
    format: same,
    example: "2000",
    description: "4 digits.",
  },
  {
    code: "NZ",
    country: "New Zealand",
    term: "Postcode",
    compact: /^\d{4}$/,
    format: same,
    example: "6011",
    description: "4 digits.",
  },
  {
    code: "SG",
    country: "Singapore",
    term: "Postal code",
    compact: /^\d{6}$/,
    format: same,
    example: "049315",
    description: "6 digits.",
  },
];

export type PostalResult = { input: string; valid: boolean; formatted: string; reason?: string };

/** Removes spaces, hyphens, dots and a leading country prefix like "D-" or "NL-". */
export function compactPostal(input: string, countryCode: string): string {
  let s = input.trim().toUpperCase();
  s = s.replace(new RegExp(`^${countryCode}[-\\s]+`), "");
  if (countryCode === "DE") s = s.replace(/^D-/, "");
  if (countryCode === "AT") s = s.replace(/^A-/, "");
  if (countryCode === "CH") s = s.replace(/^CH-/, "");
  return s.replace(/[\s.\-–—]+/g, "");
}

export function checkPostal(input: string, rule: PostalRule): PostalResult {
  const raw = input.trim();
  if (!raw) return { input, valid: false, formatted: "", reason: "Empty" };
  const c = compactPostal(raw, rule.code);
  if (/[^A-Z0-9]/.test(c)) return { input, valid: false, formatted: "", reason: "Contains characters that are not letters or digits" };
  if (!rule.compact.test(c)) {
    const digitsOnly = /^\d+$/.test(c);
    const sample = rule.example.replace(/[\s-]/g, "");
    const lengths = rule.code === "US" ? [5, 9] : [sample.length];
    const reason =
      digitsOnly && /^\d+$/.test(sample) && !lengths.includes(c.length)
        ? `Expected ${lengths.join(" or ")} digits, got ${c.length}`
        : `Does not match the ${rule.country} format`;
    return { input, valid: false, formatted: "", reason };
  }
  return { input, valid: true, formatted: rule.format(c) };
}
