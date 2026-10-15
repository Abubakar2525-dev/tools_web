"use client";

import { FormulaTool, num, type FormulaSpec, type UnitOption } from "@/components/tools/engines/FormulaTool";

const LEN_UNITS: UnitOption[] = [
  { value: "in", label: "in", factor: 1 },
  { value: "cm", label: "cm", factor: 1 / 2.54 },
];

function gcdInt(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

const NAMED: Record<string, string> = { "16:9": "widescreen", "16:10": "common on laptops", "4:3": "classic", "64:27": "marketed as 21:9", "43:18": "marketed as 21:9", "32:9": "super ultrawide", "3:2": "common on 2-in-1 laptops", "5:4": "classic monitor" };

function ratioText(w: number, h: number): string {
  const g = gcdInt(w, h);
  const r = `${Math.round(w) / g}:${Math.round(h) / g}`;
  return NAMED[r] ? `${r} (${NAMED[r]})` : r;
}

function sizeOutputs(wIn: number, hIn: number) {
  return [
    { label: "Width", value: `${num(wIn, 4)} in (${num(wIn * 2.54, 4)} cm)` },
    { label: "Height", value: `${num(hIn, 4)} in (${num(hIn * 2.54, 4)} cm)` },
    { label: "Area", value: `${num(wIn * hIn, 4)} in² (${num(wIn * hIn * 6.4516, 4)} cm²)` },
  ];
}

const spec: FormulaSpec = {
  modes: [
    { id: "res", label: "Diagonal + resolution", fields: ["diag", "hres", "vres"] },
    { id: "ratio", label: "Diagonal + aspect ratio", fields: ["diag", "rw", "rh"] },
    { id: "dims", label: "Width + height", fields: ["w", "h"] },
  ],
  fields: [
    { id: "diag", label: "Diagonal", type: "number", units: LEN_UNITS, gt: 0, hint: "Visible screen diagonal, corner to corner." },
    { id: "hres", label: "Horizontal resolution", type: "number", suffix: "px", gt: 0, integer: true },
    { id: "vres", label: "Vertical resolution", type: "number", suffix: "px", gt: 0, integer: true },
    { id: "rw", label: "Aspect ratio width", type: "number", gt: 0 },
    { id: "rh", label: "Aspect ratio height", type: "number", gt: 0 },
    { id: "w", label: "Screen width", type: "number", units: LEN_UNITS, gt: 0 },
    { id: "h", label: "Screen height", type: "number", units: LEN_UNITS, gt: 0 },
  ],
  defaults: { diag: "27", hres: "2560", vres: "1440", rw: "16", rh: "9", w: "23.5", h: "13.2" },
  example: { diag: "15.6", hres: "1920", vres: "1080", rw: "16", rh: "10" },
  compute: (v) => {
    if (v.mode === "dims") {
      const w = v.num("w")!;
      const h = v.num("h")!;
      const d = Math.hypot(w, h);
      return {
        outputs: [
          { label: "Diagonal", value: `${num(d, 4)} in`, primary: true, note: `${num(d * 2.54, 4)} cm` },
          ...sizeOutputs(w, h),
          { label: "Aspect ratio", value: `${num(Math.max(w, h) / Math.min(w, h), 4)} : 1` },
        ],
        steps: [`Diagonal = √(width² + height²)`, `√(${num(w, 6)}² + ${num(h, 6)}²) = ${num(d, 6)} in`],
      };
    }
    const d = v.num("diag")!;
    const rw = v.mode === "res" ? v.num("hres")! : v.num("rw")!;
    const rh = v.mode === "res" ? v.num("vres")! : v.num("rh")!;
    const k = Math.hypot(rw, rh);
    const wIn = (d * rw) / k;
    const hIn = (d * rh) / k;
    const steps = [`Width = diagonal × ${num(rw)} ÷ √(${num(rw)}² + ${num(rh)}²) = ${num(wIn, 6)} in`, `Height = diagonal × ${num(rh)} ÷ √(${num(rw)}² + ${num(rh)}²) = ${num(hIn, 6)} in`];
    if (v.mode === "ratio") {
      return {
        outputs: [{ label: "Screen size", value: `${num(wIn, 4)} × ${num(hIn, 4)} in`, primary: true, note: `${num(wIn * 2.54, 4)} × ${num(hIn * 2.54, 4)} cm` }, ...sizeOutputs(wIn, hIn)],
        steps,
      };
    }
    const ppi = k / d;
    return {
      outputs: [
        { label: "Pixel density", value: `${num(ppi, 4)} PPI`, primary: true, note: `${num(wIn, 4)} × ${num(hIn, 4)} in visible area` },
        ...sizeOutputs(wIn, hIn),
        { label: "Dot pitch", value: `${num(25.4 / ppi, 3)} mm` },
        { label: "Aspect ratio", value: ratioText(rw, rh) },
        { label: "Total pixels", value: `${num((rw * rh) / 1e6, 4)} MP` },
      ],
      steps: [`Diagonal in pixels = √(${rw}² + ${rh}²) = ${num(k, 6)}`, `PPI = ${num(k, 6)} ÷ ${num(d, 6)} in = ${num(ppi, 6)}`, ...steps, `Dot pitch = 25.4 mm ÷ PPI = ${num(25.4 / ppi, 4)} mm`],
      notes: ["Assumes square pixels. Advertised diagonals are often rounded, so measured sizes can differ slightly."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
