"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { elapsed, halfLifeFrom, remaining } from "./lib/physics";
import { Figure, mutedText } from "./shared";
import { fromBase, timeLong, unitLabel } from "./lib/units";

const PER: Record<string, string> = { s: "second", min: "minute", h: "hour", d: "day", y: "year" };

function DecayCurve({ n0, half, tMark, nMark }: { n0: number; half: number; tMark: number; nMark: number }) {
  const W = 360;
  const H = 200;
  const pl = 40;
  const pb = 26;
  const tMax = Math.max(5 * half, tMark * 1.15);
  const X = (t: number) => pl + (t / tMax) * (W - pl - 12);
  const Y = (n: number) => H - pb - (n / n0) * (H - pb - 12);
  const pts = Array.from({ length: 101 }, (_, i) => {
    const t = (tMax * i) / 100;
    return `${X(t).toFixed(1)},${Y(remaining(n0, t, half)).toFixed(1)}`;
  }).join(" ");
  return (
    <Figure label={`Decay curve: amount falls by half every half-life; marked point at ${num(nMark, 4)} remaining`} viewBox={`0 0 ${W} ${H}`} caption="Amount remaining over time">
      <line x1={pl} y1={H - pb} x2={W - 8} y2={H - pb} stroke="var(--line-strong)" />
      <line x1={pl} y1={H - pb} x2={pl} y2={8} stroke="var(--line-strong)" />
      {[1, 2, 3, 4, 5].filter((k) => k * half <= tMax).map((k) => (
        <g key={k}>
          <line x1={X(k * half)} y1={H - pb} x2={X(k * half)} y2={Y(n0 / 2 ** k)} stroke="var(--line)" strokeDasharray="3 3" />
          <text x={X(k * half)} y={H - pb + 15} textAnchor="middle" {...mutedText}>{k}T</text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke="var(--accent-strong)" strokeWidth={2.5} />
      <circle cx={X(tMark)} cy={Y(nMark)} r={4.5} fill="var(--accent-strong)" />
      <text x={pl - 6} y={Y(n0) + 4} textAnchor="end" {...mutedText}>N₀</text>
      <text x={pl - 6} y={H - pb + 4} textAnchor="end" {...mutedText}>0</text>
    </Figure>
  );
}

const spec: FormulaSpec = {
  modes: [
    { id: "N", label: "Amount remaining", fields: ["n0", "t", "half"] },
    { id: "t", label: "Time elapsed", fields: ["n0", "n", "half"] },
    { id: "half", label: "Half-life", fields: ["n0", "n", "t"] },
  ],
  fields: [
    { id: "n0", label: "Initial amount (N₀)", type: "number", gt: 0, hint: "Any unit: grams, atoms, becquerels, percent." },
    { id: "n", label: "Remaining amount (N)", type: "number", gt: 0, hint: "Same unit as the initial amount." },
    { id: "t", label: "Elapsed time (t)", type: "number", gt: 0, units: timeLong, defaultUnit: "y" },
    { id: "half", label: "Half-life (T½)", type: "number", gt: 0, units: timeLong, defaultUnit: "y", hint: "Carbon-14: 5,730 years. Iodine-131: 8.02 days." },
  ],
  example: { n0: "100", n: "25", t: "11460", half: "5730" },
  lead: <p>N = N₀ × (½)^(t / T½). The decay constant is λ = ln 2 / T½ and the mean lifetime is τ = 1 / λ.</p>,
  compute: (v) => {
    const n0 = v.num("n0")!;
    let N: number, t: number, half: number;
    const steps: string[] = [];
    const tu = v.unit(v.mode === "half" ? "t" : "half");
    const show = (s: number) => `${num(fromBase(s, timeLong, tu))} ${unitLabel(timeLong, tu)}`;
    if (v.mode === "N") {
      t = v.num("t")!;
      half = v.num("half")!;
      N = remaining(n0, t, half);
      steps.push(`t / T½ = ${num(t / half)} half-lives`, `N = ${num(n0)} × 0.5^${num(t / half)} = ${num(N)}`);
    } else {
      N = v.num("n")!;
      if (N >= n0) return "The remaining amount must be smaller than the initial amount.";
      if (v.mode === "t") {
        half = v.num("half")!;
        t = elapsed(n0, N, half);
        steps.push(`t = T½ × log₂(N₀ / N) = T½ × log₂(${num(n0 / N)}) = ${num(t / half)} × T½`);
      } else {
        t = v.num("t")!;
        half = halfLifeFrom(n0, N, t);
        steps.push(`T½ = t / log₂(N₀ / N) = t / ${num(Math.log2(n0 / N))}`);
      }
    }
    const lambda = Math.LN2 / half;
    steps.push(`λ = ln 2 / T½ = ${num(lambda, 6)} per second`);
    const rows = Array.from({ length: 8 }, (_, k) => [k, show(k * half), num(n0 / 2 ** k), `${num(100 / 2 ** k)}%`]);
    return {
      outputs: [
        v.mode === "N"
          ? { label: "Amount remaining", value: num(N), primary: true, note: `${num((N / n0) * 100, 6)}% of the original` }
          : v.mode === "t"
            ? { label: "Time elapsed", value: show(t), primary: true }
            : { label: "Half-life", value: show(half), primary: true },
        { label: "Fraction remaining", value: `${num((N / n0) * 100, 6)}%` },
        { label: "Half-lives elapsed", value: num(t / half, 6) },
        { label: "Decay constant λ", value: `${num(lambda * timeLong.find((x) => x.value === tu)!.factor, 6)} per ${PER[tu] ?? "s"}` },
        { label: "Mean lifetime τ", value: show(1 / lambda) },
      ],
      steps,
      table: { caption: "Amount after whole half-lives", columns: ["Half-lives", "Time", "Amount", "Percent"], rows },
      visual: <DecayCurve n0={n0} half={half} tMark={t} nMark={N} />,
      notes: ["Radioactive decay is random: these are expected values, which are very accurate for large numbers of atoms."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
