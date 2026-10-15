"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";

type V = number[];

function parseVec(raw: string): V | string {
  const parts = raw.replace(/[()[\]⟨⟩<>]/g, "").split(/[\s,;]+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return "Enter 2 or 3 components, e.g. 1, 2, 3.";
  const out: number[] = [];
  for (const p of parts) {
    const n = Number(p.replace(/−/g, "-"));
    if (!Number.isFinite(n) || p.trim() === "") return `"${p}" is not a number.`;
    out.push(n);
  }
  return out;
}

const fv = (v: V) => `(${v.map((x) => num(x, 10)).join(", ")})`;
const dot = (a: V, b: V) => a.reduce((s, x, i) => s + x * b[i], 0);
const mag = (a: V) => Math.hypot(...a);

const OPS = [
  { value: "add", label: "A + B" },
  { value: "sub", label: "A − B" },
  { value: "dot", label: "Dot product A · B" },
  { value: "cross", label: "Cross product A × B" },
  { value: "angle", label: "Angle between A and B" },
  { value: "proj", label: "Projection of A onto B" },
  { value: "mag", label: "Magnitude and unit vector of A" },
];

const spec: FormulaSpec = {
  fields: [
    { id: "a", label: "Vector A", type: "text", placeholder: "3, -2, 5", hint: "2D or 3D components." },
    { id: "b", label: "Vector B", type: "text", placeholder: "1, 4, -1" },
    { id: "op", label: "Main result", type: "select", options: OPS },
  ],
  defaults: { op: "dot" },
  example: { a: "3, -2, 5", b: "1, 4, -1", op: "cross" },
  compute: (v) => {
    const a0 = parseVec(v.str("a"));
    const b0 = parseVec(v.str("b"));
    if (typeof a0 === "string") return `Vector A: ${a0}`;
    if (typeof b0 === "string") return `Vector B: ${b0}`;
    if (a0.length !== b0.length) return "A and B must have the same number of components.";
    const a = a0;
    const b = b0;
    const is3 = a.length === 3;
    const sum = a.map((x, i) => x + b[i]);
    const diff = a.map((x, i) => x - b[i]);
    const d = dot(a, b);
    const ma = mag(a);
    const mb = mag(b);
    const cross = is3 ? [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] : [a[0] * b[1] - a[1] * b[0]];
    const cosT = ma && mb ? Math.max(-1, Math.min(1, d / (ma * mb))) : NaN;
    const theta = Math.acos(cosT);
    const proj = mb ? b.map((x) => (d / (mb * mb)) * x) : null;
    const unit = ma ? a.map((x) => x / ma) : null;
    const op = v.str("op");
    const crossText = is3 ? fv(cross) : `${num(cross[0], 10)} (z-component; 2D cross product is a scalar)`;
    const angleText = Number.isNaN(theta) ? "undefined (zero vector)" : `${num((theta * 180) / Math.PI, 10)}° (${num(theta, 10)} rad)`;
    const primary: Record<string, { label: string; value: string; steps: string[] }> = {
      add: { label: "A + B", value: fv(sum), steps: [`Add components: ${a.map((x, i) => `${num(x)} + ${num(b[i])}`).join(", ")}`] },
      sub: { label: "A − B", value: fv(diff), steps: [`Subtract components: ${a.map((x, i) => `${num(x)} − ${num(b[i])}`).join(", ")}`] },
      dot: { label: "A · B", value: num(d, 12), steps: [`A · B = ${a.map((x, i) => `(${num(x)})(${num(b[i])})`).join(" + ")} = ${num(d, 12)}`] },
      cross: {
        label: "A × B",
        value: crossText,
        steps: is3
          ? [
              `x: a₂b₃ − a₃b₂ = (${num(a[1])})(${num(b[2])}) − (${num(a[2])})(${num(b[1])}) = ${num(cross[0], 12)}`,
              `y: a₃b₁ − a₁b₃ = (${num(a[2])})(${num(b[0])}) − (${num(a[0])})(${num(b[2])}) = ${num(cross[1], 12)}`,
              `z: a₁b₂ − a₂b₁ = (${num(a[0])})(${num(b[1])}) − (${num(a[1])})(${num(b[0])}) = ${num(cross[2], 12)}`,
              `|A × B| = ${num(mag(cross), 12)} (area of the parallelogram spanned by A and B)`,
            ]
          : [`a₁b₂ − a₂b₁ = ${num(cross[0], 12)}`],
      },
      angle: {
        label: "Angle θ",
        value: angleText,
        steps: [`cos θ = (A · B) / (|A||B|) = ${num(d, 10)} / (${num(ma, 10)} × ${num(mb, 10)}) = ${num(cosT, 12)}`, `θ = arccos(${num(cosT, 12)}) = ${angleText}`],
      },
      proj: {
        label: "proj_B A",
        value: proj ? fv(proj) : "undefined (B is zero)",
        steps: [`proj_B A = ((A · B) / |B|²) B = (${num(d, 10)} / ${num(mb * mb, 10)}) × ${fv(b)}`, `Scalar projection = (A · B) / |B| = ${mb ? num(d / mb, 12) : "undefined"}`],
      },
      mag: {
        label: "|A|",
        value: num(ma, 12),
        steps: [`|A| = √(${a.map((x) => `${num(x)}²`).join(" + ")}) = ${num(ma, 12)}`, `Unit vector Â = A / |A| = ${unit ? fv(unit) : "undefined"}`],
      },
    };
    const main = primary[op];
    return {
      outputs: [
        { label: main.label, value: main.value, primary: true },
        { label: "A + B", value: fv(sum) },
        { label: "A − B", value: fv(diff) },
        { label: "A · B", value: num(d, 12) },
        { label: "A × B", value: is3 ? fv(cross) : num(cross[0], 12) },
        { label: "|A|, |B|", value: `${num(ma, 10)}, ${num(mb, 10)}` },
        { label: "Angle", value: angleText },
        { label: "Unit A", value: unit ? fv(unit) : "undefined" },
        { label: "proj_B A", value: proj ? fv(proj) : "undefined" },
        { label: "Relationship", value: Math.abs(d) < 1e-12 * (ma * mb || 1) ? "Perpendicular" : mag(cross) < 1e-12 * (ma * mb || 1) ? "Parallel" : "Neither" },
      ],
      steps: main.steps,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
