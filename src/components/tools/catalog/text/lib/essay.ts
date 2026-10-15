/** Essay word-count planning math. Self-contained for direct Node testing. */

export type Section = { id: string; name: string; percent: number };

/**
 * Splits `total` words across sections by percentage using the largest
 * remainder method, so the parts are whole numbers that add up exactly.
 * Percentages are normalized when they do not sum to 100.
 */
export function allocate(total: number, percents: number[]): number[] {
  const sum = percents.reduce((a, b) => a + Math.max(0, b), 0);
  if (!sum || total <= 0) return percents.map(() => 0);
  const exact = percents.map((p) => (Math.max(0, p) / sum) * total);
  const floors = exact.map(Math.floor);
  let left = Math.round(total) - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - floors[i] })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return floors;
}

/**
 * Rule-of-thumb words per page for a US Letter or A4 page with 1-inch
 * margins in a typical 12 pt serif font: about 500 single-spaced, 250
 * double-spaced. Line spacing scales lines per page; font size scales both
 * characters per line and lines per page, so density goes with (12 / size)².
 */
export function wordsPerPage(spacing: number, fontSize: number): number {
  const base = 500 / spacing;
  return base * (12 / fontSize) ** 2;
}

export function pages(words: number, wpp: number): number {
  return wpp > 0 ? words / wpp : 0;
}

/** Common essay structures (percentages sum to 100). */
export const TEMPLATES: Record<string, { label: string; sections: [string, number][] }> = {
  five: {
    label: "Five-paragraph essay",
    sections: [
      ["Introduction", 10],
      ["Body paragraph 1", 25],
      ["Body paragraph 2", 25],
      ["Body paragraph 3", 25],
      ["Conclusion", 15],
    ],
  },
  argument: {
    label: "Argumentative essay",
    sections: [
      ["Introduction and thesis", 10],
      ["Argument 1", 20],
      ["Argument 2", 20],
      ["Argument 3", 20],
      ["Counterargument and rebuttal", 20],
      ["Conclusion", 10],
    ],
  },
  report: {
    label: "Research report",
    sections: [
      ["Introduction", 10],
      ["Literature review", 20],
      ["Method", 15],
      ["Results", 20],
      ["Discussion", 25],
      ["Conclusion", 10],
    ],
  },
  reflective: {
    label: "Reflective essay",
    sections: [
      ["Introduction", 10],
      ["Description of the experience", 25],
      ["Feelings and analysis", 35],
      ["What you learned", 20],
      ["Conclusion and next steps", 10],
    ],
  },
};
