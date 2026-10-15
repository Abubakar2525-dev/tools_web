/** Palette generation in OKLCH: 50-950 shade scales, hue harmonies and code exports. */

import { formatHex, formatOklch, oklchToSrgb, toOklch, type Color } from "./color";

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Step = (typeof STEPS)[number];

/** Target OKLCH lightness for each step (our own perceptually even ladder). */
export const STEP_L = [0.975, 0.935, 0.88, 0.8, 0.71, 0.63, 0.55, 0.47, 0.395, 0.325, 0.25];
/** Relative chroma per step: low near white/black, full in the middle. */
export const STEP_C = [0.1, 0.22, 0.42, 0.66, 0.88, 1, 1, 0.92, 0.8, 0.66, 0.5];

export type Shade = { step: Step; color: Color; hex: string; isBase: boolean };

/** Index of the step whose target lightness is closest to `L`. */
export function nearestStepIndex(L: number) {
  let best = 0;
  for (let i = 1; i < STEP_L.length; i++) if (Math.abs(STEP_L[i] - L) < Math.abs(STEP_L[best] - L)) best = i;
  return best;
}

/**
 * Builds an 11-step scale around `base` keeping its OKLCH hue. Chroma is scaled
 * relative to the base's step and gamut mapped into sRGB. With `anchor`, the
 * base color is placed unchanged at its nearest step.
 */
export function shadeScale(base: Color, anchor = true, hueShift = 0): Shade[] {
  const [L0, C0, H0] = toOklch(base);
  const bi = nearestStepIndex(L0);
  const peak = Math.min(0.37, C0 / STEP_C[bi]);
  return STEPS.map((step, i) => {
    if (anchor && i === bi) {
      const c = { ...base, alpha: 1 };
      return { step, color: c, hex: formatHex(c), isBase: true };
    }
    // Optional hue drift: lighter steps rotate one way, darker the other.
    const H = (H0 + hueShift * ((i - bi) / 10) + 360) % 360;
    const color = oklchToSrgb([STEP_L[i], peak * STEP_C[i], H]);
    return { step, color, hex: formatHex(color), isBase: !anchor && i === bi };
  });
}

export type Harmony = "complementary" | "analogous" | "triadic" | "split" | "tetradic" | "monochromatic";

export const HARMONIES: { value: Harmony; label: string; hint: string }[] = [
  { value: "complementary", label: "Complementary", hint: "Base plus the hue opposite it (180°), with tints and a shade." },
  { value: "analogous", label: "Analogous", hint: "Neighboring hues 30° and 60° either side of the base." },
  { value: "triadic", label: "Triadic", hint: "Three hues 120° apart, plus a tint and shade of the base." },
  { value: "split", label: "Split complementary", hint: "Base plus the two hues 30° either side of its complement." },
  { value: "tetradic", label: "Tetradic (square)", hint: "Four hues 90° apart, plus a tint of the base." },
  { value: "monochromatic", label: "Monochromatic", hint: "One hue at five lightness levels." },
];

/** [hue offset °, lightness delta, chroma factor] for each of the five slots. */
const RECIPES: Record<Harmony, [number, number, number][]> = {
  complementary: [[0, 0, 1], [180, 0, 1], [0, 0.18, 0.5], [180, 0.18, 0.5], [0, -0.2, 0.9]],
  analogous: [[-60, 0, 1], [-30, 0, 1], [0, 0, 1], [30, 0, 1], [60, 0, 1]],
  triadic: [[0, 0, 1], [120, 0, 1], [240, 0, 1], [0, 0.2, 0.45], [0, -0.22, 0.9]],
  split: [[0, 0, 1], [150, 0, 1], [210, 0, 1], [0, 0.2, 0.45], [0, -0.22, 0.9]],
  tetradic: [[0, 0, 1], [90, 0, 1], [180, 0, 1], [270, 0, 1], [0, 0.22, 0.4]],
  monochromatic: [[0, -0.3, 0.8], [0, -0.15, 0.95], [0, 0, 1], [0, 0.15, 0.7], [0, 0.28, 0.35]],
};

/** Five colors following the chosen harmony, rotated in OKLCH and gamut mapped. */
export function harmony(base: Color, kind: Harmony): Color[] {
  const [L, C, H] = toOklch(base);
  return RECIPES[kind].map(([dh, dl, cf]) => {
    if (dh === 0 && dl === 0 && cf === 1) return { ...base, alpha: 1 };
    const nl = Math.min(0.98, Math.max(0.08, L + dl));
    return oklchToSrgb([nl, C * cf, (H + dh + 360) % 360]);
  });
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export type PaletteGroup = { name: string; colors: { key: string; color: Color }[] };
export type ExportFormat = "css" | "tailwind4" | "tailwind3" | "scss" | "json";
export type ValueFormat = "hex" | "oklch";

export function slugName(s: string, fallback = "brand") {
  const v = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return /^[a-z]/.test(v) ? v : v ? `c-${v}` : fallback;
}

export function exportPalette(groups: PaletteGroup[], format: ExportFormat, values: ValueFormat = "hex"): string {
  const v = (c: Color) => (values === "oklch" ? formatOklch(c) : formatHex(c));
  switch (format) {
    case "css":
      return `:root {\n${groups.map((g) => g.colors.map((c) => `  --${g.name}-${c.key}: ${v(c.color)};`).join("\n")).join("\n\n")}\n}\n`;
    case "tailwind4":
      return `@theme {\n${groups.map((g) => g.colors.map((c) => `  --color-${g.name}-${c.key}: ${v(c.color)};`).join("\n")).join("\n\n")}\n}\n`;
    case "tailwind3": {
      const body = groups
        .map((g) => `        "${g.name}": {\n${g.colors.map((c) => `          "${c.key}": "${v(c.color)}",`).join("\n")}\n        },`)
        .join("\n");
      return `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${body}\n      },\n    },\n  },\n};\n`;
    }
    case "scss":
      return groups
        .map(
          (g) =>
            `${g.colors.map((c) => `$${g.name}-${c.key}: ${v(c.color)};`).join("\n")}\n\n$${g.name}: (\n${g.colors
              .map((c) => `  "${c.key}": $${g.name}-${c.key},`)
              .join("\n")}\n);`,
        )
        .join("\n\n") + "\n";
    case "json": {
      const o: Record<string, Record<string, string>> = {};
      for (const g of groups) {
        o[g.name] = {};
        for (const c of g.colors) o[g.name][c.key] = v(c.color);
      }
      return JSON.stringify(o, null, 2) + "\n";
    }
  }
}
