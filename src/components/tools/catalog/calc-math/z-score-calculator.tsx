"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { normalCdf, normalInv, normalPdf } from "./lib/distributions";
import { PlotFrame } from "./ui";

const pct = (p: number) => `${num(p * 100, 8)}%`;

/** Standard normal curve with shaded region(s). Intervals are [from, to] in z units. */
function NormalCurve({ shade, label }: { shade: [number, number][]; label: string }) {
  const lo = -4;
  const hi = 4;
  const xs = Array.from({ length: 161 }, (_, i) => lo + ((hi - lo) * i) / 160);
  return (
    <PlotFrame xMin={lo} xMax={hi} yMin={0} yMax={0.42} title="Standard normal curve" desc={label}>
      {(sx, sy) => (
        <>
          {shade.map(([a, b], k) => {
            const from = Math.max(lo, a);
            const to = Math.min(hi, b);
            if (!(to > from)) return null;
            const pts = Array.from({ length: 81 }, (_, i) => from + ((to - from) * i) / 80);
            const d = `M ${sx(from)} ${sy(0)} ${pts.map((x) => `L ${sx(x)} ${sy(normalPdf(x))}`).join(" ")} L ${sx(to)} ${sy(0)} Z`;
            return <path key={k} d={d} fill="var(--accent)" opacity={0.28} />;
          })}
          <polyline fill="none" stroke="var(--accent-strong)" strokeWidth={2.5} points={xs.map((x) => `${sx(x)},${sy(normalPdf(x))}`).join(" ")} />
        </>
      )}
    </PlotFrame>
  );
}

const spec: FormulaSpec = {
  modes: [
    { id: "x", label: "Value to z", fields: ["x", "mu", "sigma"] },
    { id: "prob", label: "z to probability", fields: ["z1", "z2"] },
    { id: "pct", label: "Percentile to z", fields: ["p"] },
  ],
  fields: [
    { id: "x", label: "Value (x)", type: "number", placeholder: "85" },
    { id: "mu", label: "Mean (μ)", type: "number", placeholder: "70" },
    { id: "sigma", label: "Standard deviation (σ)", type: "number", gt: 0, placeholder: "10" },
    { id: "z1", label: "z", type: "number", placeholder: "1.96" },
    { id: "z2", label: "Second z (for between)", type: "number", optional: true, placeholder: "−1.96", hint: "Optional: gives the probability between the two z-scores." },
    { id: "p", label: "Percentile", type: "number", gt: 0, max: 99.9999999, suffix: "%", placeholder: "97.5" },
  ],
  example: { x: "85", mu: "70", sigma: "10", z1: "1.96", z2: "-1.96", p: "97.5" },
  compute: (v) => {
    if (v.mode === "pct") {
      const p = v.num("p");
      if (p === null) return null;
      if (p >= 100) return "The percentile must be below 100.";
      const z = normalInv(p / 100);
      return {
        outputs: [
          { label: "z-score", value: num(z, 10), primary: true },
          { label: "Area to the left", value: pct(p / 100) },
          { label: "Area to the right", value: pct(1 - p / 100) },
          { label: "Two-sided ±z covers", value: z > 0 ? pct(2 * (p / 100) - 1) : "n/a" },
        ],
        steps: [`z = Φ⁻¹(${num(p / 100, 10)}) = ${num(z, 10)}`, "Inverse normal: Acklam's rational approximation refined with Halley's method against an accurate Φ"],
        visual: <NormalCurve shade={[[-Infinity, z]]} label={`Shaded area left of z = ${num(z, 6)} is ${pct(p / 100)}.`} />,
      };
    }
    let z: number;
    const steps: string[] = [];
    if (v.mode === "x") {
      const x = v.num("x");
      const mu = v.num("mu");
      const sigma = v.num("sigma");
      if (x === null || mu === null || sigma === null) return null;
      z = (x - mu) / sigma;
      steps.push(`z = (x − μ) / σ = (${num(x)} − ${num(mu)}) / ${num(sigma)} = ${num(z, 10)}`);
    } else {
      const z1 = v.num("z1");
      if (z1 === null) return null;
      z = z1;
      const z2 = v.num("z2");
      if (z2 !== null) {
        const a = Math.min(z1, z2);
        const b = Math.max(z1, z2);
        const between = normalCdf(b) - normalCdf(a);
        return {
          outputs: [
            { label: `P(${num(a)} < Z < ${num(b)})`, value: pct(between), primary: true },
            { label: "Outside both", value: pct(1 - between) },
            { label: `P(Z < ${num(a)})`, value: pct(normalCdf(a)) },
            { label: `P(Z > ${num(b)})`, value: pct(normalCdf(-b)) },
          ],
          steps: [`P(a < Z < b) = Φ(b) − Φ(a) = ${num(normalCdf(b), 12)} − ${num(normalCdf(a), 12)} = ${num(between, 12)}`],
          visual: <NormalCurve shade={[[a, b]]} label={`Shaded area between z = ${num(a, 6)} and z = ${num(b, 6)} is ${pct(between)}.`} />,
        };
      }
    }
    const left = normalCdf(z);
    const right = normalCdf(-z);
    const two = 2 * normalCdf(-Math.abs(z));
    steps.push(`P(Z < z) = Φ(${num(z, 8)}) = ${num(left, 12)}`, `P(Z > z) = 1 − Φ(z) = ${num(right, 12)}`, `Two-tailed: 2 × P(Z > |z|) = ${num(two, 12)}`);
    return {
      outputs: [
        { label: "z-score", value: num(z, 10), primary: true, note: `${num(Math.abs(z), 6)} standard deviations ${z >= 0 ? "above" : "below"} the mean` },
        { label: "Percentile (area left)", value: pct(left) },
        { label: "Area right", value: pct(right) },
        { label: "Two-tailed area beyond ±|z|", value: pct(two) },
        { label: "Within ±|z|", value: pct(1 - two) },
      ],
      steps,
      visual: <NormalCurve shade={[[-Infinity, z]]} label={`Shaded area left of z = ${num(z, 6)} is ${pct(left)}.`} />,
      notes: ["Probabilities assume the values follow a normal distribution."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
