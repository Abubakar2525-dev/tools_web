/** UTF-8 byte encodings (binary, hex, decimal) and ROT ciphers. Self-contained. */

const enc = new TextEncoder();

export function utf8Bytes(text: string): Uint8Array {
  return enc.encode(text);
}

/** Strict UTF-8 decode: throws a readable error on invalid sequences. */
export function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("These bytes are not valid UTF-8 text. Check for missing or extra digits.");
  }
}

/* ------------------------------------------------------------------ */
/* Binary                                                              */
/* ------------------------------------------------------------------ */

export function textToBinary(text: string, sep = " "): string {
  return Array.from(utf8Bytes(text), (b) => b.toString(2).padStart(8, "0")).join(sep);
}

export function binaryToText(input: string): string {
  const cleaned = input.replace(/0b/gi, " ").trim();
  if (!cleaned) return "";
  if (/[^01\s,;|_-]/.test(cleaned)) throw new Error("Binary input may contain only 0, 1 and separators (spaces, commas).");
  const groups = cleaned.split(/[\s,;|_-]+/).filter(Boolean);
  let bits: string[];
  if (groups.length === 1 && groups[0].length > 8) {
    if (groups[0].length % 8 !== 0) throw new Error(`Got ${groups[0].length} bits without separators, which is not a multiple of 8.`);
    bits = groups[0].match(/.{8}/g) ?? [];
  } else bits = groups;
  const bad = bits.find((g) => g.length > 8);
  if (bad) throw new Error(`"${bad}" is longer than 8 bits. Each group must be one byte.`);
  return decodeUtf8(Uint8Array.from(bits, (g) => parseInt(g, 2)));
}

/* ------------------------------------------------------------------ */
/* Hex                                                                 */
/* ------------------------------------------------------------------ */

export function textToHex(text: string, o: { sep?: string; prefix?: string; upper?: boolean } = {}): string {
  return Array.from(utf8Bytes(text), (b) => {
    const h = b.toString(16).padStart(2, "0");
    return (o.prefix ?? "") + (o.upper ? h.toUpperCase() : h);
  }).join(o.sep ?? " ");
}

export function hexToText(input: string): string {
  const cleaned = input.replace(/0x|\\x|%|U\+/gi, " ").trim();
  if (!cleaned) return "";
  if (/[^0-9a-f\s,:;-]/i.test(cleaned)) throw new Error("Hex input may contain only 0-9, A-F, optional 0x or \\x prefixes and separators.");
  const groups = cleaned.split(/[\s,:;-]+/).filter(Boolean);
  let pairs: string[];
  if (groups.every((g) => g.length <= 2)) pairs = groups;
  else {
    const joined = groups.join("");
    if (joined.length % 2 !== 0) throw new Error("Hex input has an odd number of digits. Each byte needs two digits.");
    pairs = joined.match(/.{2}/g) ?? [];
  }
  return decodeUtf8(Uint8Array.from(pairs, (p) => parseInt(p, 16)));
}

/* ------------------------------------------------------------------ */
/* Decimal codes                                                       */
/* ------------------------------------------------------------------ */

export type CodeMode = "codepoint" | "utf8";

export function textToCodes(text: string, mode: CodeMode, sep = " "): string {
  if (mode === "utf8") return Array.from(utf8Bytes(text), String).join(sep);
  return Array.from(text, (c) => String(c.codePointAt(0))).join(sep);
}

export function codesToText(input: string, mode: CodeMode): string {
  const cleaned = input.trim();
  if (!cleaned) return "";
  const tokens = cleaned.split(/[\s,;]+/).filter(Boolean);
  const nums = tokens.map((t) => {
    const n = /^0x[0-9a-f]+$/i.test(t) ? parseInt(t, 16) : /^\d+$/.test(t) ? Number(t) : NaN;
    if (!Number.isInteger(n)) throw new Error(`"${t}" is not a whole number.`);
    return n;
  });
  if (mode === "utf8") {
    const bad = nums.find((n) => n > 255);
    if (bad !== undefined) throw new Error(`${bad} is not a byte (0 to 255). Switch to code points for values above 255.`);
    return decodeUtf8(Uint8Array.from(nums));
  }
  const bad = nums.find((n) => n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff));
  if (bad !== undefined) throw new Error(`${bad} is not a valid Unicode code point.`);
  return String.fromCodePoint(...nums);
}

/* ------------------------------------------------------------------ */
/* ROT ciphers                                                         */
/* ------------------------------------------------------------------ */

export type RotMode = "rot13" | "rot5" | "rot18" | "rot47";

export function rot(text: string, mode: RotMode): string {
  let out = "";
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (ch.length > 1) {
      out += ch;
      continue;
    }
    if (mode === "rot47") {
      out += c >= 33 && c <= 126 ? String.fromCharCode(33 + ((c - 33 + 47) % 94)) : ch;
      continue;
    }
    const letters = mode === "rot13" || mode === "rot18";
    const digits = mode === "rot5" || mode === "rot18";
    if (letters && c >= 65 && c <= 90) out += String.fromCharCode(65 + ((c - 65 + 13) % 26));
    else if (letters && c >= 97 && c <= 122) out += String.fromCharCode(97 + ((c - 97 + 13) % 26));
    else if (digits && c >= 48 && c <= 57) out += String.fromCharCode(48 + ((c - 48 + 5) % 10));
    else out += ch;
  }
  return out;
}
