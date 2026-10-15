/** Modular type scales and fluid clamp() sizes (pure). */

export const RATIOS: { value: string; label: string; ratio: number }[] = [
  { value: "1.067", label: "Minor second (1.067)", ratio: 16 / 15 },
  { value: "1.125", label: "Major second (1.125)", ratio: 1.125 },
  { value: "1.2", label: "Minor third (1.2)", ratio: 1.2 },
  { value: "1.25", label: "Major third (1.25)", ratio: 1.25 },
  { value: "1.333", label: "Perfect fourth (1.333)", ratio: 4 / 3 },
  { value: "1.414", label: "Augmented fourth (1.414)", ratio: Math.SQRT2 },
  { value: "1.5", label: "Perfect fifth (1.5)", ratio: 1.5 },
  { value: "1.618", label: "Golden ratio (1.618)", ratio: (1 + Math.sqrt(5)) / 2 },
];

export function ratioOf(value: string, custom: number | null): number | null {
  if (value === "custom") return custom;
  return RATIOS.find((r) => r.value === value)?.ratio ?? null;
}

const r4 = (n: number) => {
  const v = Math.round(n * 10000) / 10000;
  return String(Object.is(v, -0) ? 0 : v);
};

/** Size in px for step `n` (0 = base): base × ratio^n. */
export const stepSize = (base: number, ratio: number, n: number) => base * ratio ** n;

/**
 * Fluid size between two viewport widths (Utopia-style linear interpolation):
 * size = intercept + slope × 100vw, clamped to [min, max].
 */
export function fluid(minPx: number, maxPx: number, minVw: number, maxVw: number, root = 16) {
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const intercept = minPx - slope * minVw;
  const lo = Math.min(minPx, maxPx);
  const hi = Math.max(minPx, maxPx);
  const sign = slope < 0 ? "-" : "+";
  const pref = `${r4(intercept / root)}rem ${sign} ${r4(Math.abs(slope * 100))}vw`;
  return {
    slope,
    intercept,
    css: slope === 0 ? `${r4(minPx / root)}rem` : `clamp(${r4(lo / root)}rem, ${pref}, ${r4(hi / root)}rem)`,
  };
}

export type ScaleStep = { step: number; name: string; minPx: number; maxPx: number; value: string };

const NAMES: Record<number, string> = { [-3]: "2xs", [-2]: "xs", [-1]: "sm", 0: "base", 1: "lg", 2: "xl", 3: "2xl", 4: "3xl", 5: "4xl", 6: "5xl", 7: "6xl", 8: "7xl" };

export function buildScale(o: {
  minBase: number;
  minRatio: number;
  maxBase: number;
  maxRatio: number;
  minVw: number;
  maxVw: number;
  up: number;
  down: number;
  fluid: boolean;
  root?: number;
}): ScaleStep[] {
  const root = o.root ?? 16;
  const out: ScaleStep[] = [];
  for (let s = o.up; s >= -o.down; s--) {
    const minPx = stepSize(o.minBase, o.minRatio, s);
    const maxPx = o.fluid ? stepSize(o.maxBase, o.maxRatio, s) : minPx;
    const value = o.fluid ? fluid(minPx, maxPx, o.minVw, o.maxVw, root).css : `${r4(minPx / root)}rem`;
    out.push({ step: s, name: NAMES[s] ?? `step-${s}`, minPx, maxPx, value });
  }
  return out;
}

export function scaleCss(steps: ScaleStep[], naming: "step" | "tshirt", prefix = "font-size") {
  const lines = steps.map((s) => `  --${prefix}-${naming === "step" ? s.step : s.name}: ${s.value};`);
  return `:root {\n${lines.join("\n")}\n}\n`;
}
