/**
 * Letter-grade scales and grade arithmetic. Pure functions.
 */

export type ScaleRow = { letter: string; min: number };

export const SCALE_PRESETS: Record<string, { label: string; rows: ScaleRow[] }> = {
  standard: {
    label: "A-F (90/80/70/60)",
    rows: [
      { letter: "A", min: 90 },
      { letter: "B", min: 80 },
      { letter: "C", min: 70 },
      { letter: "D", min: 60 },
      { letter: "F", min: 0 },
    ],
  },
  plusminus: {
    label: "A-F with plus and minus",
    rows: [
      { letter: "A+", min: 97 },
      { letter: "A", min: 93 },
      { letter: "A-", min: 90 },
      { letter: "B+", min: 87 },
      { letter: "B", min: 83 },
      { letter: "B-", min: 80 },
      { letter: "C+", min: 77 },
      { letter: "C", min: 73 },
      { letter: "C-", min: 70 },
      { letter: "D+", min: 67 },
      { letter: "D", min: 63 },
      { letter: "D-", min: 60 },
      { letter: "F", min: 0 },
    ],
  },
  passfail: {
    label: "Pass/fail at 50%",
    rows: [
      { letter: "Pass", min: 50 },
      { letter: "Fail", min: 0 },
    ],
  },
};

/** Parses "A=90, B=80, C 70, F=0" (any separator). Sorted high to low. */
export function parseScale(raw: string): ScaleRow[] | string {
  const items = raw
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!items.length) return "Enter a scale such as A=90, B=80, C=70, D=60, F=0.";
  const rows: ScaleRow[] = [];
  for (const it of items) {
    const m = /^(.+?)\s*(?:=|:|>=|≥|\s)\s*(-?\d+(?:\.\d+)?)\s*%?$/.exec(it);
    if (!m) return `Could not read "${it}". Use letter=minimum, for example B=80.`;
    rows.push({ letter: m[1].trim(), min: Number(m[2]) });
  }
  rows.sort((a, b) => b.min - a.min);
  return rows;
}

export function letterFor(percent: number, rows: ScaleRow[]): string {
  for (const r of rows) if (percent >= r.min - 1e-9) return r.letter;
  return rows[rows.length - 1]?.letter ?? "";
}

/**
 * Required final exam score: target = current·(1−w) + final·w
 * → final = (target − current·(1−w)) / w. Weights are fractions.
 */
export function requiredFinal(current: number, finalWeight: number, target: number): number {
  return (target - current * (1 - finalWeight)) / finalWeight;
}

/** Required GPA on the remaining credits to reach a target cumulative GPA. */
export function requiredGpa(currentGpa: number, doneCredits: number, remainingCredits: number, target: number): number {
  return (target * (doneCredits + remainingCredits) - currentGpa * doneCredits) / remainingCredits;
}
