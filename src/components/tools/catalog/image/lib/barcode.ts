/**
 * Barcode value validation and check digits (GS1 mod-10, ISBN-10 mod-11).
 * Pure TypeScript.
 */

export type BarcodeFormat = "EAN13" | "EAN8" | "UPC" | "ISBN" | "ITF14" | "CODE128" | "CODE39";

export const BARCODE_FORMATS: { value: BarcodeFormat; label: string; hint: string }[] = [
  { value: "EAN13", label: "EAN-13", hint: "12 digits (check digit added) or 13 digits (check digit verified)." },
  { value: "EAN8", label: "EAN-8", hint: "7 digits (check digit added) or 8 digits (verified)." },
  { value: "UPC", label: "UPC-A", hint: "11 digits (check digit added) or 12 digits (verified)." },
  { value: "ISBN", label: "ISBN (as EAN-13)", hint: "ISBN-13 with or without hyphens, or an ISBN-10 to convert." },
  { value: "ITF14", label: "ITF-14", hint: "13 digits (check digit added) or 14 digits (verified)." },
  { value: "CODE128", label: "Code 128", hint: "Any ASCII text: letters, digits, punctuation." },
  { value: "CODE39", label: "Code 39", hint: "Digits, A to Z, space and - . $ / + %. Lowercase becomes uppercase." },
];

/** GS1 mod-10 check digit for the given data digits (check digit excluded). */
export function gs1CheckDigit(data: string) {
  let sum = 0;
  for (let i = data.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(data[i]) * w;
  return (10 - (sum % 10)) % 10;
}

/** ISBN-10 check character (0-9 or X) for 9 data digits. */
export function isbn10CheckChar(nine: string) {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(nine[i]) * (10 - i);
  const c = (11 - (sum % 11)) % 11;
  return c === 10 ? "X" : String(c);
}

export function isbn10To13(isbn10: string) {
  const data = `978${isbn10.slice(0, 9)}`;
  return data + gs1CheckDigit(data);
}

export type BarcodeCheck =
  | { ok: true; value: string; jsFormat: string; note: string | null }
  | { ok: false; error: string };

const GS1: Partial<Record<BarcodeFormat, { data: number; js: string; name: string }>> = {
  EAN13: { data: 12, js: "EAN13", name: "EAN-13" },
  EAN8: { data: 7, js: "EAN8", name: "EAN-8" },
  UPC: { data: 11, js: "UPC", name: "UPC-A" },
  ITF14: { data: 13, js: "ITF14", name: "ITF-14" },
};

export function validateBarcode(format: BarcodeFormat, raw: string): BarcodeCheck {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Enter a value to encode." };
  const gs1 = GS1[format];
  if (gs1) {
    const d = input.replace(/[\s-]/g, "");
    if (!/^\d+$/.test(d)) return { ok: false, error: `${gs1.name} accepts digits only.` };
    if (d.length === gs1.data) {
      const c = gs1CheckDigit(d);
      return { ok: true, value: d + c, jsFormat: gs1.js, note: `Check digit ${c} was calculated and added.` };
    }
    if (d.length === gs1.data + 1) {
      const expected = gs1CheckDigit(d.slice(0, -1));
      if (Number(d[d.length - 1]) !== expected)
        return { ok: false, error: `The check digit should be ${expected}, not ${d[d.length - 1]}. Check for a typo, or enter ${gs1.data} digits to have it calculated.` };
      return { ok: true, value: d, jsFormat: gs1.js, note: "Check digit verified." };
    }
    return { ok: false, error: `${gs1.name} needs ${gs1.data} or ${gs1.data + 1} digits; you entered ${d.length}.` };
  }
  if (format === "ISBN") {
    const d = input.replace(/^ISBN(-1[03])?:?\s*/i, "").replace(/[\s-]/g, "").toUpperCase();
    if (/^\d{9}[\dX]$/.test(d)) {
      const expected = isbn10CheckChar(d.slice(0, 9));
      if (d[9] !== expected) return { ok: false, error: `This ISBN-10's check character should be ${expected}, not ${d[9]}.` };
      const v = isbn10To13(d);
      return { ok: true, value: v, jsFormat: "EAN13", note: `ISBN-10 converted to ISBN-13 ${v}.` };
    }
    if (!/^\d+$/.test(d)) return { ok: false, error: "An ISBN contains digits only (an ISBN-10 may end in X)." };
    if (!/^97[89]/.test(d)) return { ok: false, error: "An ISBN-13 starts with 978 or 979." };
    if (d.length === 12) {
      const c = gs1CheckDigit(d);
      return { ok: true, value: d + c, jsFormat: "EAN13", note: `Check digit ${c} was calculated and added.` };
    }
    if (d.length === 13) {
      const expected = gs1CheckDigit(d.slice(0, 12));
      if (Number(d[12]) !== expected) return { ok: false, error: `The check digit should be ${expected}, not ${d[12]}.` };
      return { ok: true, value: d, jsFormat: "EAN13", note: "ISBN-13 check digit verified." };
    }
    return { ok: false, error: `An ISBN-13 has 13 digits; you entered ${d.length}.` };
  }
  if (format === "CODE128") {
    const bad = input.match(/[^\x00-\x7F]/);
    if (bad) return { ok: false, error: `Code 128 encodes ASCII only; "${bad[0]}" is not supported.` };
    if (input.length > 80) return { ok: false, error: "Keep Code 128 values to 80 characters or fewer so the barcode stays scannable." };
    return { ok: true, value: input, jsFormat: "CODE128", note: null };
  }
  // CODE39
  const up = input.toUpperCase();
  const bad = up.match(/[^0-9A-Z \-.$/+%]/);
  if (bad) return { ok: false, error: `Code 39 cannot encode "${bad[0]}". Allowed: 0-9, A-Z, space and - . $ / + %.` };
  if (up.length > 43) return { ok: false, error: "Keep Code 39 values to 43 characters or fewer." };
  return { ok: true, value: up, jsFormat: "CODE39", note: up !== input ? "Converted to uppercase (Code 39 has no lowercase)." : null };
}
