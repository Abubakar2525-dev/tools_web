"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { lengthChoices } from "./lib/units";
import { simplifySqrt } from "./lib/geometry";
import { Figure, mutedText, stroke, textStyle } from "./shared";

/** "5√2" style exact form when the radicand is a whole number. */
function exactRoot(sq: number): string | null {
  const r = Math.round(sq);
  if (Math.abs(sq - r) > 1e-9 * Math.max(1, sq) || r <= 0 || r > 1e12) return null;
  const [k, m] = simplifySqrt(r);
  if (m === 1) return String(k);
  return `${k === 1 ? "" : k}√${m}`;
}

const spec: FormulaSpec = {
  modes: [
    { id: "c", label: "Find hypotenuse c", fields: ["unit", "a", "b"] },
    { id: "a", label: "Find leg a", fields: ["unit", "b", "c"] },
    { id: "b", label: "Find leg b", fields: ["unit", "a", "c"] },
  ],
  fields: [
    { id: "unit", label: "Length unit", type: "select", options: lengthChoices },
    { id: "a", label: "Leg a", type: "number", gt: 0 },
    { id: "b", label: "Leg b", type: "number", gt: 0 },
    { id: "c", label: "Hypotenuse c", type: "number", gt: 0, hint: "The side opposite the right angle (the longest side)." },
  ],
  defaults: { unit: "u" },
  example: { unit: "u", a: "5", b: "12", c: "13" },
  lead: <p>For a right triangle, a² + b² = c², where c is the hypotenuse.</p>,
  compute: (v) => {
    const u = v.str("unit") === "u" ? "" : ` ${v.str("unit")}`;
    let a: number, b: number, c: number;
    const steps: string[] = [];
    let sqr: number;
    if (v.mode === "c") {
      a = v.num("a")!;
      b = v.num("b")!;
      sqr = a * a + b * b;
      c = Math.sqrt(sqr);
      steps.push(`c² = a² + b² = ${num(a)}² + ${num(b)}² = ${num(a * a)} + ${num(b * b)} = ${num(sqr)}`, `c = √${num(sqr)} = ${num(c)}`);
    } else {
      c = v.num("c")!;
      const leg = v.num(v.mode === "a" ? "b" : "a")!;
      if (leg >= c) return "The hypotenuse must be longer than either leg.";
      sqr = c * c - leg * leg;
      const x = Math.sqrt(sqr);
      const name = v.mode;
      const other = name === "a" ? "b" : "a";
      steps.push(`${name}² = c² − ${other}² = ${num(c)}² − ${num(leg)}² = ${num(c * c)} − ${num(leg * leg)} = ${num(sqr)}`, `${name} = √${num(sqr)} = ${num(x)}`);
      if (name === "a") {
        a = x;
        b = leg;
      } else {
        a = leg;
        b = x;
      }
    }
    const found = v.mode === "c" ? c : v.mode === "a" ? a : b;
    const exact = exactRoot(sqr);
    if (exact && exact.includes("√")) steps.push(`Exact form: √${num(sqr)} = ${exact}`);
    const A = (Math.atan2(a, b) * 180) / Math.PI;
    const s = Math.min(220 / b, 140 / a);
    const x0 = 50;
    const y0 = 170;
    return {
      outputs: [
        { label: `Side ${v.mode}`, value: `${num(found)}${u}`, primary: true, note: exact && exact.includes("√") ? `Exact: ${exact}` : undefined },
        { label: "Area", value: `${num((a * b) / 2)}${u ? `${u}²` : " sq units"}` },
        { label: "Perimeter", value: `${num(a + b + c)}${u}` },
        { label: "Angle opposite a", value: `${num(A, 6)}°` },
        { label: "Angle opposite b", value: `${num(90 - A, 6)}°` },
      ],
      steps,
      visual: (
        <Figure label={`Right triangle drawn to scale: legs ${num(a)} and ${num(b)}, hypotenuse ${num(c)}`} viewBox="0 0 320 200">
          <polygon points={`${x0},${y0} ${x0 + b * s},${y0} ${x0},${y0 - a * s}`} {...stroke} />
          <rect x={x0} y={y0 - 12} width={12} height={12} fill="none" stroke="var(--ink)" />
          <text x={x0 - 10} y={y0 - (a * s) / 2} textAnchor="end" {...textStyle}>a</text>
          <text x={x0 + (b * s) / 2} y={y0 + 18} textAnchor="middle" {...textStyle}>b</text>
          <text x={x0 + (b * s) / 2 + 10} y={y0 - (a * s) / 2 - 6} {...mutedText}>c</text>
        </Figure>
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
