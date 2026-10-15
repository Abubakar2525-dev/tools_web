/**
 * Reference data: paper sizes (exact, by standard), photo print sizes, and
 * approximate clothing and shoe size equivalents (our own compiled tables;
 * real sizing varies by brand and cut).
 */

export type PaperSize = { name: string; family: string; w: number; h: number; unit: "mm" | "in"; note?: string };

/**
 * ISO 216 / JIS P 0138 series: each size halves the previous one's long side,
 * rounding down to the nearest millimetre.
 */
export function halvingSeries(prefix: string, w0: number, h0: number, count = 11): { name: string; w: number; h: number }[] {
  const out: { name: string; w: number; h: number }[] = [];
  let w = w0;
  let h = h0;
  for (let i = 0; i < count; i++) {
    out.push({ name: `${prefix}${i}`, w, h });
    [w, h] = [Math.floor(h / 2), w];
  }
  return out;
}

export const paperSizes: PaperSize[] = [
  ...halvingSeries("A", 841, 1189).map((s) => ({ ...s, family: "ISO A (ISO 216)", unit: "mm" as const })),
  ...halvingSeries("B", 1000, 1414).map((s) => ({ ...s, family: "ISO B (ISO 216)", unit: "mm" as const })),
  ...halvingSeries("C", 917, 1297).map((s) => ({ ...s, family: "ISO C envelopes (ISO 269)", unit: "mm" as const })),
  { name: "DL", w: 110, h: 220, family: "ISO C envelopes (ISO 269)", unit: "mm", note: "envelope for A4 folded in thirds" },
  ...halvingSeries("JIS B", 1030, 1456).map((s) => ({ ...s, family: "JIS B (Japan)", unit: "mm" as const })),
  { name: "Letter", w: 8.5, h: 11, family: "North American", unit: "in" },
  { name: "Legal", w: 8.5, h: 14, family: "North American", unit: "in" },
  { name: "Tabloid", w: 11, h: 17, family: "North American", unit: "in" },
  { name: "Ledger", w: 17, h: 11, family: "North American", unit: "in", note: "Tabloid in landscape" },
  { name: "Executive", w: 7.25, h: 10.5, family: "North American", unit: "in" },
  { name: "Half Letter (Statement)", w: 5.5, h: 8.5, family: "North American", unit: "in" },
  { name: "Junior Legal", w: 5, h: 8, family: "North American", unit: "in" },
  { name: "ANSI A", w: 8.5, h: 11, family: "ANSI (ANSI/ASME Y14.1)", unit: "in" },
  { name: "ANSI B", w: 11, h: 17, family: "ANSI (ANSI/ASME Y14.1)", unit: "in" },
  { name: "ANSI C", w: 17, h: 22, family: "ANSI (ANSI/ASME Y14.1)", unit: "in" },
  { name: "ANSI D", w: 22, h: 34, family: "ANSI (ANSI/ASME Y14.1)", unit: "in" },
  { name: "ANSI E", w: 34, h: 44, family: "ANSI (ANSI/ASME Y14.1)", unit: "in" },
  { name: "Arch A", w: 9, h: 12, family: "Architectural (US)", unit: "in" },
  { name: "Arch B", w: 12, h: 18, family: "Architectural (US)", unit: "in" },
  { name: "Arch C", w: 18, h: 24, family: "Architectural (US)", unit: "in" },
  { name: "Arch D", w: 24, h: 36, family: "Architectural (US)", unit: "in" },
  { name: "Arch E", w: 36, h: 48, family: "Architectural (US)", unit: "in" },
  { name: "Arch E1", w: 30, h: 42, family: "Architectural (US)", unit: "in" },
];

export const paperFamilies = [...new Set(paperSizes.map((p) => p.family))];

export function paperDims(p: PaperSize) {
  const wIn = p.unit === "in" ? p.w : p.w / 25.4;
  const hIn = p.unit === "in" ? p.h : p.h / 25.4;
  return {
    wMm: p.unit === "mm" ? p.w : p.w * 25.4,
    hMm: p.unit === "mm" ? p.h : p.h * 25.4,
    wIn,
    hIn,
    wPt: wIn * 72,
    hPt: hIn * 72,
  };
}

export function pixelsAt(inches: number, dpi: number): number {
  return Math.round(inches * dpi);
}

/** Common photo print sizes in inches (portrait), plus A-series photo papers. */
export const photoSizes: { name: string; wIn: number; hIn: number }[] = [
  { name: "Wallet 2.5 × 3.5 in", wIn: 2.5, hIn: 3.5 },
  { name: "3.5 × 5 in", wIn: 3.5, hIn: 5 },
  { name: "4 × 6 in", wIn: 4, hIn: 6 },
  { name: "5 × 7 in", wIn: 5, hIn: 7 },
  { name: "8 × 10 in", wIn: 8, hIn: 10 },
  { name: "8.5 × 11 in (Letter)", wIn: 8.5, hIn: 11 },
  { name: "11 × 14 in", wIn: 11, hIn: 14 },
  { name: "12 × 18 in", wIn: 12, hIn: 18 },
  { name: "16 × 20 in", wIn: 16, hIn: 20 },
  { name: "20 × 30 in", wIn: 20, hIn: 30 },
  { name: "A6 (105 × 148 mm)", wIn: 105 / 25.4, hIn: 148 / 25.4 },
  { name: "A5 (148 × 210 mm)", wIn: 148 / 25.4, hIn: 210 / 25.4 },
  { name: "A4 (210 × 297 mm)", wIn: 210 / 25.4, hIn: 297 / 25.4 },
  { name: "A3 (297 × 420 mm)", wIn: 297 / 25.4, hIn: 420 / 25.4 },
];

/* ------------------------------------------------------------------ */
/* Clothing (approximate)                                              */
/* ------------------------------------------------------------------ */

export type SizeTable = { id: string; title: string; systems: string[]; rows: string[][]; note: string };

export const clothingTables: SizeTable[] = [
  {
    id: "women-dresses",
    title: "Women's dresses, tops and suits",
    systems: ["US", "UK / AU", "EU (DE / FR)", "Italy", "Japan", "Letter"],
    rows: [
      ["0", "4", "32", "36", "3", "XXS"],
      ["2", "6", "34", "38", "5", "XS"],
      ["4", "8", "36", "40", "7", "S"],
      ["6", "10", "38", "42", "9", "S"],
      ["8", "12", "40", "44", "11", "M"],
      ["10", "14", "42", "46", "13", "M"],
      ["12", "16", "44", "48", "15", "L"],
      ["14", "18", "46", "50", "17", "L"],
      ["16", "20", "48", "52", "19", "XL"],
      ["18", "22", "50", "54", "21", "XL"],
      ["20", "24", "52", "56", "23", "XXL"],
    ],
    note: "France often runs one size above Germany for the same garment; many brands label EU sizes with the French number.",
  },
  {
    id: "men-suits",
    title: "Men's suits and jackets",
    systems: ["US / UK (chest in)", "EU / Italy", "Japan", "Letter", "Chest (cm, approx.)"],
    rows: [
      ["34", "44", "S", "XS", "86"],
      ["36", "46", "S", "S", "91"],
      ["38", "48", "M", "S", "97"],
      ["40", "50", "L", "M", "102"],
      ["42", "52", "LL", "L", "107"],
      ["44", "54", "LL", "L", "112"],
      ["46", "56", "3L", "XL", "117"],
      ["48", "58", "4L", "XXL", "122"],
      ["50", "60", "4L", "XXL", "127"],
    ],
    note: "Jacket sizes are chest measurements; the EU number is roughly chest in cm divided by 2. Japanese letter sizes vary widely between makers.",
  },
  {
    id: "men-shirts",
    title: "Men's dress shirts (collar)",
    systems: ["US / UK (in)", "EU / Japan (cm)", "Letter"],
    rows: [
      ["14", "36", "XS"],
      ["14.5", "37", "S"],
      ["15", "38", "S"],
      ["15.5", "39", "M"],
      ["15.75", "40", "M"],
      ["16", "41", "L"],
      ["16.5", "42", "L"],
      ["17", "43", "XL"],
      ["17.5", "44", "XL"],
      ["18", "45", "XXL"],
      ["18.5", "46", "XXL"],
    ],
    note: "Collar sizes are neck circumference. Fit (slim, regular) changes the body size even at the same collar.",
  },
];

/* ------------------------------------------------------------------ */
/* Shoes (approximate)                                                 */
/* ------------------------------------------------------------------ */

export const shoeSystems = ["US men", "US women", "UK", "EU", "Mondopoint (mm)", "Japan (cm)"];

/** [US men, US women, UK, EU, foot length cm]. Adult sizes, approximate. */
const SHOE_BASE: [number, number, number, number, number][] = [
  [4, 5.5, 3.5, 36, 22],
  [4.5, 6, 4, 37, 22.5],
  [5, 6.5, 4.5, 37.5, 23],
  [5.5, 7, 5, 38, 23.5],
  [6, 7.5, 5.5, 38.5, 24],
  [6.5, 8, 6, 39, 24.5],
  [7, 8.5, 6.5, 40, 25],
  [7.5, 9, 7, 40.5, 25.5],
  [8, 9.5, 7.5, 41, 26],
  [8.5, 10, 8, 42, 26.5],
  [9, 10.5, 8.5, 42.5, 27],
  [9.5, 11, 9, 43, 27.5],
  [10, 11.5, 9.5, 44, 28],
  [10.5, 12, 10, 44.5, 28.5],
  [11, 12.5, 10.5, 45, 29],
  [11.5, 13, 11, 45.5, 29.5],
  [12, 13.5, 11.5, 46, 30],
  [13, 14.5, 12.5, 47.5, 31],
  [14, 15.5, 13.5, 48.5, 32],
];

export const shoeRows: string[][] = SHOE_BASE.map(([m, w, uk, eu, cm]) => [
  String(m),
  String(w),
  String(uk),
  String(eu),
  String(Math.round(cm * 10)),
  String(cm),
]);

/** Finds the row whose value in column `col` is nearest to `value`. */
export function nearestRow(rows: string[][], col: number, value: number): { row: string[]; exact: boolean } | null {
  let best: string[] | null = null;
  let bestD = Infinity;
  for (const r of rows) {
    const v = parseFloat(r[col]);
    if (!Number.isFinite(v)) continue;
    const d = Math.abs(v - value);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best ? { row: best, exact: bestD < 1e-9 } : null;
}
