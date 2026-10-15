/**
 * Cryptographically secure random helpers. Every value comes from
 * crypto.getRandomValues; integers in a range use rejection sampling so
 * there is no modulo bias.
 */

export type RandomSource = (buf: Uint32Array) => Uint32Array;

const defaultSource: RandomSource = (buf) => crypto.getRandomValues(buf);

/** Uniform integer in [0, n). n must be between 1 and 2^32. */
export function randomInt(n: number, source: RandomSource = defaultSource): number {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError("Range must be 1..2^32");
  if (n === 1) return 0;
  // Largest multiple of n that fits in 2^32; reject values at or above it.
  const limit = 2 ** 32 - (2 ** 32 % n);
  const buf = new Uint32Array(1);
  for (;;) {
    source(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  // getRandomValues is limited to 65,536 bytes per call.
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(out.subarray(i, Math.min(n, i + 65536)));
  return out;
}

export function pick<T>(items: readonly T[], source?: RandomSource): T {
  return items[randomInt(items.length, source)];
}

/** Fisher-Yates shuffle (in place) with unbiased indices. */
export function shuffle<T>(arr: T[], source?: RandomSource): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, source);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

export const CHARSETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!#$%&()*+,-./:;<=>?@[]^_{|}~",
} as const;

export type CharsetKey = keyof typeof CHARSETS;

/** Characters that are easy to confuse when reading or typing. */
export const AMBIGUOUS = "Il1O0o|`'\";:.,{}[]()/\\";

export interface PasswordOptions {
  length: number;
  sets: CharsetKey[];
  excludeAmbiguous: boolean;
  /** Extra characters to remove from every set. */
  exclude?: string;
  /** Guarantee at least one character from each chosen set. */
  requireEach: boolean;
}

export function buildPools(opts: Pick<PasswordOptions, "sets" | "excludeAmbiguous" | "exclude">): string[] {
  const banned = new Set([...(opts.excludeAmbiguous ? AMBIGUOUS : ""), ...(opts.exclude ?? "")]);
  return opts.sets
    .map((k) => [...new Set(CHARSETS[k])].filter((c) => !banned.has(c)).join(""))
    .filter((p) => p.length > 0);
}

export function passwordError(opts: PasswordOptions): string | null {
  if (!Number.isInteger(opts.length) || opts.length < 4 || opts.length > 256) return "Length must be a whole number from 4 to 256.";
  const pools = buildPools(opts);
  if (pools.length === 0) return "Choose at least one character set with characters left after exclusions.";
  if (opts.requireEach && pools.length > opts.length) return "Length is shorter than the number of required character sets.";
  return null;
}

export function generatePassword(opts: PasswordOptions, source?: RandomSource): string {
  const err = passwordError(opts);
  if (err) throw new Error(err);
  const pools = buildPools(opts);
  const all = [...new Set(pools.join(""))];
  const chars: string[] = [];
  if (opts.requireEach) for (const p of pools) chars.push(pick([...p], source));
  while (chars.length < opts.length) chars.push(pick(all, source));
  return shuffle(chars, source).join("");
}

/**
 * Entropy of a password drawn uniformly from `alphabet` characters.
 * With "require each set" the true space is slightly smaller; we subtract
 * the excluded share exactly using inclusion-exclusion.
 */
export function passwordEntropyBits(opts: PasswordOptions): number {
  const pools = buildPools(opts);
  const alphabet = new Set(pools.join("")).size;
  if (alphabet === 0) return 0;
  const L = opts.length;
  if (!opts.requireEach || pools.length < 2) return L * Math.log2(alphabet);
  // Count strings of length L over the alphabet containing every pool (pools are disjoint).
  // Inclusion-exclusion: sum over subsets S of pools missing: (-1)^|S| (A - |S chars|)^L
  const sizes = pools.map((p) => p.length);
  const k = sizes.length;
  const terms: { sign: number; log: number }[] = [];
  for (let mask = 0; mask < 1 << k; mask++) {
    let missing = 0;
    let bits = 0;
    for (let i = 0; i < k; i++) if (mask & (1 << i)) {
      missing += sizes[i];
      bits++;
    }
    const base = alphabet - missing;
    if (base <= 0) continue;
    terms.push({ sign: bits % 2 ? -1 : 1, log: L * Math.log2(base) });
  }
  const maxLog = Math.max(...terms.map((t) => t.log));
  let sum = 0;
  for (const t of terms) sum += t.sign * 2 ** (t.log - maxLog);
  return maxLog + Math.log2(sum);
}

export function strengthLabel(bits: number): { label: string; level: 0 | 1 | 2 | 3 | 4 } {
  if (bits < 28) return { label: "Very weak", level: 0 };
  if (bits < 40) return { label: "Weak", level: 1 };
  if (bits < 60) return { label: "Fair", level: 2 };
  if (bits < 80) return { label: "Strong", level: 3 };
  return { label: "Very strong", level: 4 };
}

/* ------------------------------------------------------------------ */
/* Passphrases                                                         */
/* ------------------------------------------------------------------ */

export type Capitalization = "lower" | "title" | "upper" | "one";

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalization: Capitalization;
  addNumber: boolean;
  addSymbol: boolean;
}

export const PASSPHRASE_SYMBOLS = "!#$%&*+-=?@^_~";

export function generatePassphrase(list: readonly string[], opts: PassphraseOptions, source?: RandomSource): string {
  const words = Array.from({ length: opts.words }, () => pick(list, source));
  let cased = words.map((w) => {
    if (opts.capitalization === "title") return w.charAt(0).toUpperCase() + w.slice(1);
    if (opts.capitalization === "upper") return w.toUpperCase();
    return w;
  });
  if (opts.capitalization === "one") {
    const i = randomInt(cased.length, source);
    cased = cased.map((w, j) => (j === i ? w.toUpperCase() : w));
  }
  if (opts.addNumber) {
    const i = randomInt(cased.length, source);
    cased[i] = `${cased[i]}${randomInt(10, source)}`;
  }
  if (opts.addSymbol) {
    const i = randomInt(cased.length, source);
    cased[i] = `${cased[i]}${pick([...PASSPHRASE_SYMBOLS], source)}`;
  }
  return cased.join(opts.separator);
}

/** Entropy assuming the attacker knows the word list and every option. */
export function passphraseEntropyBits(listSize: number, opts: PassphraseOptions): number {
  let bits = opts.words * Math.log2(listSize);
  if (opts.capitalization === "one") bits += Math.log2(opts.words);
  if (opts.addNumber) bits += Math.log2(10) + Math.log2(opts.words);
  if (opts.addSymbol) bits += Math.log2(PASSPHRASE_SYMBOLS.length) + Math.log2(opts.words);
  return bits;
}

/* ------------------------------------------------------------------ */
/* PINs                                                                */
/* ------------------------------------------------------------------ */

/** Frequently chosen PINs that should be avoided (dates, keypad patterns, repeats). */
const COMMON_PINS = new Set([
  "1234", "1111", "0000", "1212", "7777", "1004", "2000", "4444", "2222", "6969", "9999", "3333", "5555", "6666",
  "1122", "1313", "8888", "4321", "2001", "1010", "2580", "0852", "1470", "1478", "3690", "7410", "9630", "1990",
  "123456", "654321", "111111", "000000", "123123", "112233", "121212", "159753", "147258", "258369", "696969",
  "123321", "666666", "777777", "888888", "999999", "555555", "222222", "333333", "444444", "102030",
]);

export type PinIssue = "repeated" | "sequential" | "common" | "few-digits" | "year";

/** Returns why a PIN is predictable, or an empty list when none of the checks fire. */
export function pinIssues(pin: string): PinIssue[] {
  const issues: PinIssue[] = [];
  const d = [...pin].map(Number);
  if (/(\d)\1\1/.test(pin) || new Set(d).size === 1) issues.push("repeated");
  let run = 1;
  let maxRun = 1;
  for (let i = 1; i < d.length; i++) {
    const step = d[i] - d[i - 1];
    const prevStep = i > 1 ? d[i - 1] - d[i - 2] : null;
    if ((step === 1 || step === -1) && (prevStep === null || prevStep === step)) run++;
    else if (step === 1 || step === -1) run = 2;
    else run = 1;
    maxRun = Math.max(maxRun, run);
  }
  if (maxRun >= 3) issues.push("sequential");
  if (COMMON_PINS.has(pin)) issues.push("common");
  if (pin.length >= 4 && new Set(d).size <= Math.ceil(pin.length / 3)) issues.push("few-digits");
  if (pin.length === 4 && /^(19[4-9]\d|20[0-3]\d)$/.test(pin)) issues.push("year");
  return issues;
}

export function generatePin(length: number, avoidWeak: boolean, source?: RandomSource): string {
  if (!Number.isInteger(length) || length < 4 || length > 12) throw new RangeError("PIN length must be 4 to 12.");
  for (let attempt = 0; attempt < 1000; attempt++) {
    let pin = "";
    for (let i = 0; i < length; i++) pin += String(randomInt(10, source));
    if (!avoidWeak || pinIssues(pin).length === 0) return pin;
  }
  throw new Error("Could not generate a PIN that passes the filters.");
}

/** Share of all PINs of this length that pass the filters (exact count for length ≤ 5, sampled above). */
export function pinAcceptedShare(length: number): number {
  if (length <= 5) {
    const total = 10 ** length;
    let ok = 0;
    for (let i = 0; i < total; i++) if (pinIssues(String(i).padStart(length, "0")).length === 0) ok++;
    return ok / total;
  }
  // Deterministic sample (same answer on server and client); this is an estimate, not key material.
  let seed = 0x9e3779b9;
  const next = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let ok = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    let pin = "";
    for (let j = 0; j < length; j++) pin += String(Math.floor(next() * 10));
    if (pinIssues(pin).length === 0) ok++;
  }
  return ok / n;
}

/* ------------------------------------------------------------------ */
/* Random strings / secret keys                                        */
/* ------------------------------------------------------------------ */

export const ALNUM = CHARSETS.upper + CHARSETS.lower + CHARSETS.digits;

export function randomFromAlphabet(alphabet: string, length: number, source?: RandomSource): string {
  const chars = [...new Set(alphabet)];
  if (chars.length < 2) throw new Error("The character set needs at least two different characters.");
  let s = "";
  for (let i = 0; i < length; i++) s += pick(chars, source);
  return s;
}
