/** CSS string builders for the generator tools (pure). */

import {
  clip,
  formatHex,
  formatRgbLegacy,
  fromOklch,
  oklchToSrgb,
  parseColor,
  round,
  toGamut,
  toOklch,
} from "./color";

const px = (n: number) => (n === 0 ? "0" : `${round(n, 2)}px`);

/** Color with an opacity (0..1) as #rrggbb or rgba(). */
export function withOpacity(hex: string, opacity: number) {
  const c = parseColor(hex) ?? { r: 0, g: 0, b: 0, alpha: 1 };
  return formatRgbLegacy({ ...toGamut(c), alpha: Math.max(0, Math.min(1, opacity)) * c.alpha });
}

/* ------------------------------------------------------------------ */
/* Shorthand                                                           */
/* ------------------------------------------------------------------ */

/** Shortest 1-4 value shorthand for [top/top-left, right/top-right, bottom/bottom-right, left/bottom-left]. */
export function shorthand(v: [string, string, string, string]): string[] {
  const [a, b, c, d] = v;
  if (a === b && b === c && c === d) return [a];
  if (a === c && b === d) return [a, b];
  if (b === d) return [a, b, c];
  return [a, b, c, d];
}

export type Corner = { h: number; v: number };
export type RadiusUnit = "px" | "%" | "rem";

/** border-radius in its shortest form; corners are [top-left, top-right, bottom-right, bottom-left]. */
export function borderRadiusCss(corners: [Corner, Corner, Corner, Corner], unit: RadiusUnit) {
  const f = (n: number) => (n === 0 ? "0" : `${round(n, 3)}${unit}`);
  const hs = shorthand(corners.map((c) => f(c.h)) as [string, string, string, string]);
  const vs = shorthand(corners.map((c) => f(c.v)) as [string, string, string, string]);
  const same = hs.join(" ") === vs.join(" ");
  return same ? hs.join(" ") : `${hs.join(" ")} / ${vs.join(" ")}`;
}

/* ------------------------------------------------------------------ */
/* Gradient                                                            */
/* ------------------------------------------------------------------ */

export type GradientType = "linear" | "radial" | "conic";
export type Interp = "default" | "srgb" | "oklab" | "oklch" | "lab" | "hsl";
export type Stop = { id: string; color: string; pos: number };
export type GradientState = {
  type: GradientType;
  angle: number;
  shape: "circle" | "ellipse";
  size: "farthest-corner" | "closest-side" | "closest-corner" | "farthest-side";
  x: number;
  y: number;
  repeating: boolean;
  interp: Interp;
  stops: Stop[];
};

export function sortedStops(stops: Stop[]) {
  return [...stops].sort((a, b) => a.pos - b.pos);
}

/** The gradient function, e.g. "linear-gradient(135deg, #f00 0%, #00f 100%)". */
export function gradientValue(g: GradientState, withInterp = true) {
  const stops = sortedStops(g.stops)
    .map((s) => {
      const c = parseColor(s.color);
      const col = c ? (c.alpha < 1 ? formatRgbLegacy(c) : formatHex(c)) : s.color;
      return `${col} ${round(s.pos, 2)}%`;
    })
    .join(", ");
  const interp = withInterp && g.interp !== "default" ? `in ${g.interp}` : "";
  const pos = `at ${round(g.x, 2)}% ${round(g.y, 2)}%`;
  let head: string;
  if (g.type === "linear") head = [`${round(g.angle, 2)}deg`, interp].filter(Boolean).join(" ");
  else if (g.type === "radial") head = [`${g.shape} ${g.size} ${pos}`, interp].filter(Boolean).join(" ");
  else head = [`from ${round(g.angle, 2)}deg ${pos}`, interp].filter(Boolean).join(" ");
  const fn = `${g.repeating ? "repeating-" : ""}${g.type}-gradient`;
  return `${fn}(${head}, ${stops})`;
}

export function gradientCss(g: GradientState) {
  const first = sortedStops(g.stops)[0];
  const fb = first ? parseColor(first.color) : null;
  const lines = [];
  if (fb) lines.push(`background-color: ${formatHex(fb)};`);
  if (g.interp !== "default") lines.push(`background-image: ${gradientValue(g, false)};`);
  lines.push(`background-image: ${gradientValue(g)};`);
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Box shadow                                                          */
/* ------------------------------------------------------------------ */

export type ShadowLayer = {
  id: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  inset: boolean;
  enabled: boolean;
};

export function shadowLayerValue(l: ShadowLayer) {
  return `${l.inset ? "inset " : ""}${px(l.x)} ${px(l.y)} ${px(Math.max(0, l.blur))} ${px(l.spread)} ${withOpacity(l.color, l.opacity)}`;
}

export function boxShadowValue(layers: ShadowLayer[]) {
  const on = layers.filter((l) => l.enabled);
  return on.length ? on.map(shadowLayerValue).join(",\n    ") : "none";
}

/* ------------------------------------------------------------------ */
/* Neumorphism                                                         */
/* ------------------------------------------------------------------ */

export type NeuShape = "flat" | "concave" | "convex" | "pressed";
export type NeuLight = "top-left" | "top-right" | "bottom-right" | "bottom-left";

export function neumorphism(o: {
  color: string;
  size: number;
  radius: number;
  distance: number;
  blur: number;
  intensity: number;
  shape: NeuShape;
  light: NeuLight;
}) {
  const base = toGamut(parseColor(o.color) ?? { r: 0.88, g: 0.89, b: 0.91, alpha: 1 });
  const [L, C, H] = toOklch(base);
  const k = o.intensity; // 0..0.3 lightness delta
  const light = oklchToSrgb([Math.min(1, L + k), C * 0.9, H]);
  const dark = oklchToSrgb([Math.max(0, L - k), C, H]);
  const dx = o.light === "top-left" || o.light === "bottom-left" ? 1 : -1;
  const dy = o.light === "top-left" || o.light === "top-right" ? 1 : -1;
  const d = o.distance;
  const lightHex = formatHex(light);
  const darkHex = formatHex(dark);
  const angle = { "top-left": 145, "top-right": 225, "bottom-right": 315, "bottom-left": 45 }[o.light];
  const lighter = formatHex(oklchToSrgb([Math.min(1, L + k / 3), C, H]));
  const darker = formatHex(oklchToSrgb([Math.max(0, L - k / 3), C, H]));
  let background = formatHex(base);
  if (o.shape === "concave") background = `linear-gradient(${angle}deg, ${darker}, ${lighter})`;
  if (o.shape === "convex") background = `linear-gradient(${angle}deg, ${lighter}, ${darker})`;
  const outer = `${px(d * dx)} ${px(d * dy)} ${px(o.blur)} ${darkHex}, ${px(-d * dx)} ${px(-d * dy)} ${px(o.blur)} ${lightHex}`;
  const inner = `inset ${px(d * dx)} ${px(d * dy)} ${px(o.blur)} ${darkHex}, inset ${px(-d * dx)} ${px(-d * dy)} ${px(o.blur)} ${lightHex}`;
  const shadow = o.shape === "pressed" ? inner : outer;
  return {
    surface: formatHex(base),
    background,
    shadow,
    css: [
      `border-radius: ${px(o.radius)};`,
      `background: ${background};`,
      `box-shadow: ${shadow};`,
    ].join("\n"),
  };
}

/* ------------------------------------------------------------------ */
/* Glassmorphism                                                       */
/* ------------------------------------------------------------------ */

export function glassmorphism(o: {
  tint: string;
  opacity: number;
  blur: number;
  saturate: number;
  radius: number;
  borderOpacity: number;
  shadow: boolean;
}) {
  const bg = withOpacity(o.tint, o.opacity);
  const fallbackBg = withOpacity(o.tint, Math.min(0.92, o.opacity + 0.55));
  const border = withOpacity("#ffffff", o.borderOpacity);
  const filter = `blur(${px(o.blur)})${o.saturate !== 100 ? ` saturate(${round(o.saturate, 0)}%)` : ""}`;
  const lines = [
    `.glass {`,
    `  background: ${bg};`,
    `  -webkit-backdrop-filter: ${filter};`,
    `  backdrop-filter: ${filter};`,
    `  border: 1px solid ${border};`,
    `  border-radius: ${px(o.radius)};`,
  ];
  if (o.shadow) lines.push(`  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);`);
  lines.push(
    `}`,
    ``,
    `/* Browsers without backdrop-filter get a more opaque panel so text stays readable. */`,
    `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {`,
    `  .glass {`,
    `    background: ${fallbackBg};`,
    `  }`,
    `}`,
  );
  return { bg, fallbackBg, border, filter, css: lines.join("\n") };
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

/** Shifts OKLCH lightness (positive = lighter). */
export function shiftLightness(hex: string, delta: number): string {
  const c = parseColor(hex);
  if (!c) return hex;
  const [L, C, H] = toOklch(clip(c));
  return formatHex(toGamut(fromOklch([Math.min(1, Math.max(0, L + delta)), C, H])));
}

export type ButtonState = {
  label: string;
  fontSize: number;
  fontWeight: number;
  padX: number;
  padY: number;
  radius: number;
  bg: string;
  fg: string;
  borderWidth: number;
  borderColor: string;
  hoverBg: string;
  hoverFg: string;
  focusRing: string;
  shadow: boolean;
  uppercase: boolean;
  transition: boolean;
};

export function buttonCss(s: ButtonState, cls = "btn") {
  const L: string[] = [];
  L.push(`.${cls} {`);
  L.push(`  display: inline-flex;`);
  L.push(`  align-items: center;`);
  L.push(`  justify-content: center;`);
  L.push(`  gap: 0.5em;`);
  L.push(`  min-height: 44px;`);
  L.push(`  padding: ${px(s.padY)} ${px(s.padX)};`);
  L.push(`  font: inherit;`);
  L.push(`  font-size: ${px(s.fontSize)};`);
  L.push(`  font-weight: ${s.fontWeight};`);
  L.push(`  line-height: 1.2;`);
  if (s.uppercase) {
    L.push(`  text-transform: uppercase;`);
    L.push(`  letter-spacing: 0.04em;`);
  }
  L.push(`  color: ${s.fg};`);
  L.push(`  background-color: ${s.bg};`);
  L.push(`  border: ${s.borderWidth > 0 ? `${px(s.borderWidth)} solid ${s.borderColor}` : "0"};`);
  L.push(`  border-radius: ${px(s.radius)};`);
  if (s.shadow) L.push(`  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12), 0 4px 12px -4px rgba(0, 0, 0, 0.2);`);
  L.push(`  cursor: pointer;`);
  if (s.transition) L.push(`  transition: background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease;`);
  L.push(`}`);
  L.push(``);
  L.push(`.${cls}:hover {`);
  L.push(`  background-color: ${s.hoverBg};`);
  L.push(`  color: ${s.hoverFg};`);
  L.push(`}`);
  L.push(``);
  L.push(`.${cls}:active {`);
  L.push(`  transform: translateY(1px);`);
  L.push(`}`);
  L.push(``);
  L.push(`.${cls}:focus-visible {`);
  L.push(`  outline: 3px solid ${s.focusRing};`);
  L.push(`  outline-offset: 2px;`);
  L.push(`}`);
  L.push(``);
  L.push(`.${cls}:disabled,`);
  L.push(`.${cls}[aria-disabled="true"] {`);
  L.push(`  opacity: 0.5;`);
  L.push(`  cursor: not-allowed;`);
  L.push(`  transform: none;`);
  L.push(`}`);
  L.push(``);
  L.push(`.${cls}:disabled:hover {`);
  L.push(`  background-color: ${s.bg};`);
  L.push(`  color: ${s.fg};`);
  L.push(`}`);
  if (s.transition) {
    L.push(``);
    L.push(`@media (prefers-reduced-motion: reduce) {`);
    L.push(`  .${cls} {`);
    L.push(`    transition: none;`);
    L.push(`  }`);
    L.push(`}`);
  }
  return L.join("\n");
}
