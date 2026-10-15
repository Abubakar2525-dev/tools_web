/**
 * Color science for the design tools (pure TS, no DOM).
 *
 * Internal representation: gamma-encoded sRGB channels as unclamped floats
 * (0..1 inside the sRGB gamut, outside it for wide-gamut input) plus alpha.
 *
 * Conversions follow CSS Color Level 4:
 * - sRGB transfer function with the 0.04045 threshold, linear sRGB <-> XYZ D65.
 * - CIELAB/LCH use the D50 white point; XYZ is adapted D65 <-> D50 with the
 *   Bradford matrices published in CSS Color 4.
 * - OKLab/OKLCH per Björn Ottosson (2020), from linear sRGB.
 * - Gamut mapping: the CSS Color 4 algorithm (reduce OKLCH chroma until the
 *   clipped color is within ΔEOK 0.02 of the target).
 */

import { NAMED_COLORS } from "./named-colors";

export type Color = { r: number; g: number; b: number; alpha: number };
export type Vec3 = [number, number, number];

/* ------------------------------------------------------------------ */
/* Matrices                                                            */
/* ------------------------------------------------------------------ */

const mul = (m: number[][], v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

const LIN_SRGB_TO_XYZ = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];
const XYZ_TO_LIN_SRGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const D65_TO_D50 = [
  [1.0479297925449969, 0.022946870601609652, -0.05019226628920524],
  [0.02962780877005599, 0.9904344267538799, -0.017073799063418826],
  [-0.009243040646204504, 0.015055191490298152, 0.7518742814281371],
];
const D50_TO_D65 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const LIN_P3_TO_XYZ = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
];
const XYZ_TO_LIN_P3 = [
  [2.4934969119414254, -0.9313836179191239, -0.40271078445071684],
  [-0.8294889695615747, 1.7626640603183463, 0.023624685841943577],
  [0.03584583024378447, -0.07617238926804182, 0.9568845240076872],
];
const D50_WHITE: Vec3 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

/* ------------------------------------------------------------------ */
/* Transfer functions and spaces                                       */
/* ------------------------------------------------------------------ */

export function toLinear(c: number) {
  const a = Math.abs(c);
  return a <= 0.04045 ? c / 12.92 : Math.sign(c) * ((a + 0.055) / 1.055) ** 2.4;
}
export function fromLinear(c: number) {
  const a = Math.abs(c);
  return a > 0.0031308 ? Math.sign(c) * (1.055 * a ** (1 / 2.4) - 0.055) : 12.92 * c;
}

export const linearRgb = (c: Color): Vec3 => [toLinear(c.r), toLinear(c.g), toLinear(c.b)];
const fromLinearRgb = (v: Vec3, alpha = 1): Color => ({ r: fromLinear(v[0]), g: fromLinear(v[1]), b: fromLinear(v[2]), alpha });

export const toXyzD65 = (c: Color): Vec3 => mul(LIN_SRGB_TO_XYZ, linearRgb(c));
export const fromXyzD65 = (xyz: Vec3, alpha = 1): Color => fromLinearRgb(mul(XYZ_TO_LIN_SRGB, xyz), alpha);

/** OKLab [L 0..1, a, b] from sRGB (Ottosson's direct linear-sRGB matrices). */
export function toOklab(c: Color): Vec3 {
  const [r, g, b] = linearRgb(c);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function fromOklab([L, a, b]: Vec3, alpha = 1): Color {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return fromLinearRgb(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ],
    alpha,
  );
}

const ACHROMATIC = 1e-4;

/** Rectangular [L, a, b] to polar [L, C, H°]. Hue is 0 when achromatic. */
export function toPolar([L, a, b]: Vec3, eps = ACHROMATIC): Vec3 {
  const C = Math.hypot(a, b);
  let H = C < eps ? 0 : (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}
export function fromPolar([L, C, H]: Vec3): Vec3 {
  const h = (H * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

export const toOklch = (c: Color): Vec3 => toPolar(toOklab(c));
export const fromOklch = (lch: Vec3, alpha = 1): Color => fromOklab(fromPolar(lch), alpha);

const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

/** CIELAB D50 [L 0..100, a, b]. */
export function toLab(c: Color): Vec3 {
  const xyz = mul(D65_TO_D50, toXyzD65(c));
  const f = xyz.map((v, i) => {
    const t = v / D50_WHITE[i];
    return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
  });
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}
export function fromLab([L, a, b]: Vec3, alpha = 1): Color {
  const f1 = (L + 16) / 116;
  const f0 = a / 500 + f1;
  const f2 = f1 - b / 200;
  const x = f0 ** 3 > EPS ? f0 ** 3 : (116 * f0 - 16) / KAPPA;
  const y = L > KAPPA * EPS ? ((L + 16) / 116) ** 3 : L / KAPPA;
  const z = f2 ** 3 > EPS ? f2 ** 3 : (116 * f2 - 16) / KAPPA;
  const d50: Vec3 = [x * D50_WHITE[0], y * D50_WHITE[1], z * D50_WHITE[2]];
  return fromXyzD65(mul(D50_TO_D65, d50), alpha);
}
export const toLch = (c: Color): Vec3 => toPolar(toLab(c), 0.0015);
export const fromLch = (lch: Vec3, alpha = 1): Color => fromLab(fromPolar(lch), alpha);

/** Display P3 (gamma-encoded, sRGB transfer curve). */
export function toP3(c: Color): Vec3 {
  const lin = mul(XYZ_TO_LIN_P3, toXyzD65(c));
  return [fromLinear(lin[0]), fromLinear(lin[1]), fromLinear(lin[2])];
}
export function fromP3(v: Vec3, alpha = 1): Color {
  return fromXyzD65(mul(LIN_P3_TO_XYZ, [toLinear(v[0]), toLinear(v[1]), toLinear(v[2])]), alpha);
}

/* HSL / HSV / HWB (all on gamma-encoded sRGB, values in 0..1, hue in degrees) */

export function toHsl(c: Color): Vec3 {
  const { r, g, b } = clip(c);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  return [hueOf(r, g, b, max, d), s, l];
}
export function fromHsl([h, s, l]: Vec3, alpha = 1): Color {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: f(0), g: f(8), b: f(4), alpha };
}
function hueOf(r: number, g: number, b: number, max: number, d: number) {
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
export function toHsv(c: Color): Vec3 {
  const { r, g, b } = clip(c);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  return [d === 0 ? 0 : hueOf(r, g, b, max, d), max === 0 ? 0 : d / max, max];
}
export function fromHsv([h, s, v]: Vec3, alpha = 1): Color {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: f(5), g: f(3), b: f(1), alpha };
}
export function toHwb(c: Color): Vec3 {
  const [h, , v] = toHsv(c);
  const { r, g, b } = clip(c);
  return [h, Math.min(r, g, b), 1 - v];
}
export function fromHwb([h, w, bl]: Vec3, alpha = 1): Color {
  if (w + bl >= 1) {
    const gray = w / (w + bl);
    return { r: gray, g: gray, b: gray, alpha };
  }
  const base = fromHsl([h, 1, 0.5]);
  const f = (x: number) => x * (1 - w - bl) + w;
  return { r: f(base.r), g: f(base.g), b: f(base.b), alpha };
}

/** Naive device CMYK (no ICC profile): [c, m, y, k] in 0..1. */
export function toCmyk(c: Color): [number, number, number, number] {
  const { r, g, b } = clip(c);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
}
export function fromCmyk([c, m, y, k]: [number, number, number, number], alpha = 1): Color {
  return { r: (1 - c) * (1 - k), g: (1 - m) * (1 - k), b: (1 - y) * (1 - k), alpha };
}

/* ------------------------------------------------------------------ */
/* Gamut                                                               */
/* ------------------------------------------------------------------ */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** In sRGB gamut, with a tolerance of half an 8-bit step so rounded input values still count. */
export function inSrgbGamut(c: Color, eps = 0.5 / 255) {
  return [c.r, c.g, c.b].every((v) => v >= -eps && v <= 1 + eps);
}
export function inP3Gamut(c: Color, eps = 1e-4) {
  return toP3(c).every((v) => v >= -eps && v <= 1 + eps);
}
/** Per-channel clipping into sRGB. */
export function clip(c: Color): Color {
  return { r: clamp01(c.r), g: clamp01(c.g), b: clamp01(c.b), alpha: clamp01(c.alpha) };
}

export function deltaEOK(a: Color, b: Color) {
  const x = toOklab(a);
  const y = toOklab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** CSS Color 4 gamut mapping to sRGB (binary search on OKLCH chroma). */
export function toGamut(c: Color): Color {
  if (inSrgbGamut(c)) return clip(c);
  const [L, C, H] = toOklch(c);
  if (L >= 1) return { r: 1, g: 1, b: 1, alpha: c.alpha };
  if (L <= 0) return { r: 0, g: 0, b: 0, alpha: c.alpha };
  const JND = 0.02;
  let lo = 0;
  let hi = C;
  let minInGamut = true;
  let current = fromOklch([L, C, H], c.alpha);
  let clipped = clip(current);
  if (deltaEOK(clipped, current) < JND) return clipped;
  while (hi - lo > 1e-4) {
    const mid = (lo + hi) / 2;
    current = fromOklch([L, mid, H], c.alpha);
    if (minInGamut && inSrgbGamut(current)) {
      lo = mid;
      continue;
    }
    clipped = clip(current);
    const e = deltaEOK(clipped, current);
    if (e < JND) {
      if (JND - e < 1e-4) return clipped;
      minInGamut = false;
      lo = mid;
    } else hi = mid;
  }
  return clip(current);
}

/** OKLCH → in-gamut sRGB. */
export const oklchToSrgb = (lch: Vec3, alpha = 1) => toGamut(fromOklch(lch, alpha));

/* ------------------------------------------------------------------ */
/* Contrast                                                            */
/* ------------------------------------------------------------------ */

/** WCAG 2.x relative luminance (sRGB, 0.04045 threshold as in current WCAG text). */
export function relativeLuminance(c: Color) {
  const [r, g, b] = linearRgb(clip(c));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1..21. Alpha is ignored; composite first. */
export function contrastRatio(a: Color, b: Color) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Source-over compositing of `top` onto an opaque `bottom`. */
export function composite(top: Color, bottom: Color): Color {
  const a = clamp01(top.alpha);
  const b = clip(bottom);
  const t = clip(top);
  return { r: t.r * a + b.r * (1 - a), g: t.g * a + b.g * (1 - a), b: t.b * a + b.b * (1 - a), alpha: 1 };
}

/**
 * APCA Lc (contrast of text on background), constants from APCA 0.0.98G-4g.
 * Informational only: APCA is a draft candidate for WCAG 3, not a standard.
 * Positive = dark text on light background, negative = light on dark.
 */
export function apcaContrast(text: Color, bg: Color) {
  const Y = (c: Color) => {
    const { r, g, b } = clip(c);
    return 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
  };
  const soft = (y: number) => (y > 0.022 ? y : y + (0.022 - y) ** 1.414);
  const yt = soft(Y(text));
  const yb = soft(Y(bg));
  if (Math.abs(yb - yt) < 0.0005) return 0;
  let out: number;
  if (yb > yt) {
    const sapc = (yb ** 0.56 - yt ** 0.57) * 1.14;
    out = sapc < 0.1 ? 0 : sapc - 0.027;
  } else {
    const sapc = (yb ** 0.65 - yt ** 0.62) * 1.14;
    out = sapc > -0.1 ? 0 : sapc + 0.027;
  }
  return out * 100;
}

export type WcagChecks = {
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  ui: boolean;
};
/**
 * WCAG compares the unrounded ratio with the threshold; we round down to
 * 2 decimals first so a displayed "4.50" can never fail.
 */
export function wcagChecks(ratio: number): WcagChecks {
  const r = Math.floor(ratio * 100) / 100;
  return { aaNormal: r >= 4.5, aaLarge: r >= 3, aaaNormal: r >= 7, aaaLarge: r >= 4.5, ui: r >= 3 };
}

/**
 * Nearest color to `c` (by OKLCH lightness change, hue and chroma kept) that
 * reaches `target` contrast against `against`. Returns null if impossible.
 */
export function nearestPassing(c: Color, against: Color, target: number): { color: Color; deltaL: number } | null {
  const [L, C, H] = toOklch(clip(c));
  const meets = (x: Color) => Math.floor(contrastRatio(x, against) * 100) / 100 >= target;
  const start = quantize(toGamut(fromOklch([L, C, H])));
  if (meets(start)) return { color: { ...start, alpha: 1 }, deltaL: 0 };
  let best: { color: Color; deltaL: number } | null = null;
  for (const dir of [1, -1]) {
    for (let step = 1; step <= 1000; step++) {
      const nl = L + (dir * step) / 1000;
      if (nl < 0 || nl > 1) break;
      const cand = quantize(oklchToSrgb([nl, C, H]));
      if (meets(cand)) {
        const d = Math.abs(nl - L);
        if (!best || d < best.deltaL) best = { color: cand, deltaL: d };
        break;
      }
    }
  }
  return best;
}

/** Rounds channels to 8-bit steps (what a hex code can express). */
export function quantize(c: Color): Color {
  const q = (x: number) => Math.round(clamp01(x) * 255) / 255;
  return { r: q(c.r), g: q(c.g), b: q(c.b), alpha: c.alpha };
}

/** Black or white, whichever contrasts more with `bg`. */
export function readableOn(bg: Color): Color {
  const white = { r: 1, g: 1, b: 1, alpha: 1 };
  const black = { r: 0, g: 0, b: 0, alpha: 1 };
  return contrastRatio(white, bg) >= contrastRatio(black, bg) ? white : black;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Rounds and strips trailing zeros; avoids "-0". */
export function round(n: number, d = 2) {
  const p = 10 ** d;
  const v = Math.round((n + Number.EPSILON * Math.sign(n)) * p) / p;
  return String(Object.is(v, -0) ? 0 : v);
}

const byte = (x: number) => Math.round(clamp01(x) * 255);
const hex2 = (n: number) => n.toString(16).padStart(2, "0");
const alphaPart = (a: number, sep = " / ") => (a < 1 ? `${sep}${round(a, 3)}` : "");

/** #rrggbb (or #rrggbbaa when alpha < 1). Out-of-gamut colors are gamut mapped first. */
export function formatHex(c: Color, forceAlpha = false) {
  const g = toGamut(c);
  const s = `#${hex2(byte(g.r))}${hex2(byte(g.g))}${hex2(byte(g.b))}`;
  return c.alpha < 1 || forceAlpha ? s + hex2(byte(c.alpha)) : s;
}
export function formatRgb(c: Color) {
  const g = toGamut(c);
  return `rgb(${byte(g.r)} ${byte(g.g)} ${byte(g.b)}${alphaPart(c.alpha)})`;
}
export function formatRgbLegacy(c: Color) {
  const g = toGamut(c);
  return c.alpha < 1
    ? `rgba(${byte(g.r)}, ${byte(g.g)}, ${byte(g.b)}, ${round(c.alpha, 3)})`
    : `rgb(${byte(g.r)}, ${byte(g.g)}, ${byte(g.b)})`;
}
export function formatHsl(c: Color) {
  const [h, s, l] = toHsl(toGamut(c));
  return `hsl(${round(h, 1)} ${round(s * 100, 1)}% ${round(l * 100, 1)}%${alphaPart(c.alpha)})`;
}
export function formatHsv(c: Color) {
  const [h, s, v] = toHsv(toGamut(c));
  return `hsv(${round(h, 1)}, ${round(s * 100, 1)}%, ${round(v * 100, 1)}%)`;
}
export function formatHwb(c: Color) {
  const [h, w, b] = toHwb(toGamut(c));
  return `hwb(${round(h, 1)} ${round(w * 100, 1)}% ${round(b * 100, 1)}%${alphaPart(c.alpha)})`;
}
export function formatCmyk(c: Color) {
  const [cy, m, y, k] = toCmyk(toGamut(c));
  return `cmyk(${round(cy * 100, 1)}%, ${round(m * 100, 1)}%, ${round(y * 100, 1)}%, ${round(k * 100, 1)}%)`;
}
export function formatLab(c: Color) {
  const [L, a, b] = toLab(c);
  return `lab(${round(L, 2)}% ${round(a, 2)} ${round(b, 2)}${alphaPart(c.alpha)})`;
}
export function formatLch(c: Color) {
  const [L, C, H] = toLch(c);
  return `lch(${round(L, 2)}% ${round(C, 2)} ${round(H, 2)}${alphaPart(c.alpha)})`;
}
export function formatOklab(c: Color) {
  const [L, a, b] = toOklab(c);
  return `oklab(${round(L * 100, 2)}% ${round(a, 4)} ${round(b, 4)}${alphaPart(c.alpha)})`;
}
export function formatOklch(c: Color) {
  const [L, C, H] = toOklch(c);
  return `oklch(${round(L * 100, 2)}% ${round(C, 4)} ${round(H, 2)}${alphaPart(c.alpha)})`;
}
export function formatP3(c: Color) {
  const [r, g, b] = toP3(c);
  return `color(display-p3 ${round(r, 4)} ${round(g, 4)} ${round(b, 4)}${alphaPart(c.alpha)})`;
}

export type FormatId = "hex" | "rgb" | "hsl" | "hsv" | "hwb" | "cmyk" | "lab" | "lch" | "oklab" | "oklch" | "p3";
export const FORMATS: { id: FormatId; label: string; fn: (c: Color) => string }[] = [
  { id: "hex", label: "HEX", fn: (c) => formatHex(c) },
  { id: "rgb", label: "RGB", fn: formatRgb },
  { id: "hsl", label: "HSL", fn: formatHsl },
  { id: "hsv", label: "HSV / HSB", fn: formatHsv },
  { id: "hwb", label: "HWB", fn: formatHwb },
  { id: "cmyk", label: "CMYK (naive)", fn: formatCmyk },
  { id: "lab", label: "CIELAB", fn: formatLab },
  { id: "lch", label: "CIE LCH", fn: formatLch },
  { id: "oklab", label: "OKLab", fn: formatOklab },
  { id: "oklch", label: "OKLCH", fn: formatOklch },
  { id: "p3", label: "Display P3", fn: formatP3 },
];

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export function parseHex(s: string): Color | null {
  const m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length <= 4) h = [...h].map((x) => x + x).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), alpha: h.length === 8 ? n(6) : 1 };
}

type Tok = { v: number; pct: boolean; unit: string } | "none";

function parseTokens(body: string, expected: number): { parts: Tok[]; alpha: Tok | null } | null {
  let main = body.trim();
  let alphaStr: string | null = null;
  if (main.includes("/")) {
    const [a, b, ...rest] = main.split("/");
    if (rest.length) return null;
    main = a.trim();
    alphaStr = b.trim();
  }
  let items = main.includes(",") ? main.split(",").map((x) => x.trim()) : main.split(/\s+/);
  items = items.filter((x) => x !== "");
  if (alphaStr === null && main.includes(",") && items.length === expected + 1) alphaStr = items.pop() ?? null;
  const tok = (t: string): Tok | null => {
    if (t.toLowerCase() === "none") return "none";
    const m = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(%|deg|rad|grad|turn)?$/i.exec(t);
    if (!m) return null;
    return { v: Number(m[1]), pct: m[2] === "%", unit: (m[2] ?? "").toLowerCase() };
  };
  const parts: Tok[] = [];
  for (const it of items) {
    const t = tok(it);
    if (!t) return null;
    parts.push(t);
  }
  let alpha: Tok | null = null;
  if (alphaStr !== null) {
    alpha = tok(alphaStr);
    if (!alpha) return null;
  }
  return { parts, alpha };
}

const val = (t: Tok, pctScale: number) => (t === "none" ? 0 : t.pct ? (t.v / 100) * pctScale : t.v);
const hueVal = (t: Tok) => {
  if (t === "none") return 0;
  const f = t.unit === "rad" ? 180 / Math.PI : t.unit === "grad" ? 0.9 : t.unit === "turn" ? 360 : 1;
  return (((t.v * f) % 360) + 360) % 360;
};
const alphaVal = (t: Tok | null) => (t === null ? 1 : clamp01(val(t, 1)));

/**
 * Parses CSS color syntax (hex, named, rgb[a], hsl[a], hwb, lab, lch, oklab,
 * oklch, color(srgb|srgb-linear|display-p3|xyz|xyz-d50|xyz-d65)) plus the
 * non-CSS notations hsv()/hsb() and cmyk()/device-cmyk().
 */
export function parseColor(input: string): Color | null {
  const s = input.trim().toLowerCase().replace(/;$/, "").trim();
  if (!s) return null;
  if (s === "transparent") return { r: 0, g: 0, b: 0, alpha: 0 };
  const named = NAMED_COLORS[s];
  if (named) return parseHex(named);
  if (/^#?[0-9a-f]+$/.test(s)) return parseHex(s);
  const m = /^([a-z-]+)\((.*)\)$/.exec(s);
  if (!m) return null;
  const fn = m[1];
  if (fn === "color") {
    const sp = /^([a-z0-9-]+)\s+(.*)$/.exec(m[2].trim());
    if (!sp) return null;
    const tk = parseTokens(sp[2], 3);
    if (!tk || tk.parts.length !== 3) return null;
    const v = tk.parts.map((p) => val(p, 1)) as Vec3;
    const a = alphaVal(tk.alpha);
    switch (sp[1]) {
      case "srgb":
        return { r: v[0], g: v[1], b: v[2], alpha: a };
      case "srgb-linear":
        return fromLinearRgb(v, a);
      case "display-p3":
        return fromP3(v, a);
      case "xyz":
      case "xyz-d65":
        return fromXyzD65(v, a);
      case "xyz-d50":
        return fromXyzD65(mul(D50_TO_D65, v), a);
      default:
        return null;
    }
  }
  const tk = parseTokens(m[2], fn === "cmyk" || fn === "device-cmyk" ? 4 : 3);
  if (!tk) return null;
  const p = tk.parts;
  const a = alphaVal(tk.alpha);
  switch (fn) {
    case "rgb":
    case "rgba": {
      if (p.length !== 3) return null;
      return { r: val(p[0], 255) / 255, g: val(p[1], 255) / 255, b: val(p[2], 255) / 255, alpha: a };
    }
    case "hsl":
    case "hsla": {
      if (p.length !== 3) return null;
      return fromHsl([hueVal(p[0]), clamp01(val(p[1], 100) / 100), clamp01(val(p[2], 100) / 100)], a);
    }
    case "hsv":
    case "hsb": {
      if (p.length !== 3) return null;
      return fromHsv([hueVal(p[0]), clamp01(val(p[1], 100) / 100), clamp01(val(p[2], 100) / 100)], a);
    }
    case "hwb": {
      if (p.length !== 3) return null;
      return fromHwb([hueVal(p[0]), clamp01(val(p[1], 100) / 100), clamp01(val(p[2], 100) / 100)], a);
    }
    case "lab": {
      if (p.length !== 3) return null;
      return fromLab([Math.max(0, val(p[0], 100)), val(p[1], 125), val(p[2], 125)], a);
    }
    case "lch": {
      if (p.length !== 3) return null;
      return fromLch([Math.max(0, val(p[0], 100)), Math.max(0, val(p[1], 150)), hueVal(p[2])], a);
    }
    case "oklab": {
      if (p.length !== 3) return null;
      return fromOklab([Math.max(0, val(p[0], 1)), val(p[1], 0.4), val(p[2], 0.4)], a);
    }
    case "oklch": {
      if (p.length !== 3) return null;
      return fromOklch([Math.max(0, val(p[0], 1)), Math.max(0, val(p[1], 0.4)), hueVal(p[2])], a);
    }
    case "cmyk":
    case "device-cmyk": {
      if (p.length !== 4) return null;
      const q = p.map((x) => clamp01(val(x, 1))) as [number, number, number, number];
      return fromCmyk(q, a);
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Named colors                                                        */
/* ------------------------------------------------------------------ */

let namedLab: { name: string; lab: Vec3 }[] | null = null;

/** Nearest CSS named color by ΔEOK (Euclidean distance in OKLab). */
export function nearestNamed(c: Color): { name: string; hex: string; deltaE: number } {
  if (!namedLab) {
    namedLab = Object.entries(NAMED_COLORS).map(([name, hex]) => ({ name, lab: toOklab(parseHex(hex) as Color) }));
  }
  const lab = toOklab(toGamut(c));
  let best = namedLab[0];
  let bestD = Infinity;
  for (const n of namedLab) {
    const d = Math.hypot(n.lab[0] - lab[0], n.lab[1] - lab[1], n.lab[2] - lab[2]);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return { name: best.name, hex: NAMED_COLORS[best.name], deltaE: bestD };
}

/** Exact named color for a hex, if any (e.g. "#ff0000" → "red"). */
export function exactName(hex: string) {
  const h = hex.toLowerCase();
  return Object.entries(NAMED_COLORS).find(([, v]) => v === h)?.[0] ?? null;
}

export const WHITE: Color = { r: 1, g: 1, b: 1, alpha: 1 };
export const BLACK: Color = { r: 0, g: 0, b: 0, alpha: 1 };

/** Mix in OKLab (t = 0 → a, 1 → b). */
export function mixOklab(a: Color, b: Color, t: number): Color {
  const x = toOklab(a);
  const y = toOklab(b);
  return toGamut(fromOklab([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t], a.alpha + (b.alpha - a.alpha) * t));
}

/** Convenience: hex string → Color, falling back to `fallback`. */
export function hexOr(hex: string, fallback: Color = BLACK) {
  return parseColor(hex) ?? fallback;
}
