"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { Figure } from "./ui";
import { U, si } from "./lib/units";

/** Coulomb constant k = 1/(4π ε0), CODATA 2018 ε0 = 8.8541878128e-12 F/m. */
const K = 8.9875517923e9;

function Diagram({ q1, q2, attract }: { q1: number; q2: number; attract: boolean }) {
  const sign = (q: number) => (q > 0 ? "+" : q < 0 ? "−" : "0");
  const arrow = (x: number, dir: 1 | -1) => (
    <g className="stroke-accent-strong" strokeWidth={3} fill="none">
      <line x1={x} y1={60} x2={x + dir * 46} y2={60} />
      <polyline points={`${x + dir * 36},52 ${x + dir * 46},60 ${x + dir * 36},68`} />
    </g>
  );
  return (
    <Figure
      viewBox="0 0 420 120"
      title="Force directions between the two charges"
      desc={attract ? "Opposite signs: the charges pull toward each other (attraction)." : "Same signs: the charges push apart (repulsion)."}
    >
      <line x1={110} y1={100} x2={310} y2={100} className="stroke-line-strong" strokeDasharray="4 4" />
      <text x={210} y={115} textAnchor="middle" className="fill-muted text-[12px]">
        r
      </text>
      {[
        { x: 110, q: q1, label: "q₁" },
        { x: 310, q: q2, label: "q₂" },
      ].map((c) => (
        <g key={c.label}>
          <circle cx={c.x} cy={60} r={24} className={c.q >= 0 ? "fill-accent-soft stroke-accent-strong" : "fill-sunken stroke-ink"} strokeWidth={2} />
          <text x={c.x} y={67} textAnchor="middle" className="fill-ink text-[22px] font-semibold">
            {sign(c.q)}
          </text>
          <text x={c.x} y={24} textAnchor="middle" className="fill-ink-2 text-[13px]">
            {c.label}
          </text>
        </g>
      ))}
      {attract ? (
        <>
          {arrow(140, 1)}
          {arrow(280, -1)}
        </>
      ) : (
        <>
          {arrow(80, -1)}
          {arrow(340, 1)}
        </>
      )}
    </Figure>
  );
}

const spec: FormulaSpec = {
  lead: (
    <>
      <strong>F = k · |q₁ · q₂| ÷ (εr · r²)</strong>, with k = 8.9875517923 × 10⁹ N·m²/C². Enter charges with their sign (negative for electrons).
    </>
  ),
  modes: [
    { id: "force", label: "Force", fields: ["q1", "q2", "r", "er"] },
    { id: "dist", label: "Distance", fields: ["q1", "q2", "F", "er"] },
    { id: "charge", label: "Second charge", fields: ["q1", "F", "r", "er"] },
  ],
  fields: [
    { id: "q1", label: "Charge q₁", type: "number", units: U.coulomb },
    { id: "q2", label: "Charge q₂", type: "number", units: U.coulomb },
    { id: "r", label: "Distance r", type: "number", units: U.length, gt: 0 },
    { id: "F", label: "Force magnitude F", type: "number", units: U.newton, gt: 0 },
    { id: "er", label: "Relative permittivity εr", type: "number", optional: true, gt: 0, placeholder: "1", hint: "1 for vacuum (air ≈ 1.0006, water ≈ 80)." },
  ],
  defaults: { "q1:unit": "uC", "q2:unit": "uC", "r:unit": "cm" },
  example: { __mode: "force", q1: "3", q2: "-5", r: "10", "q1:unit": "uC", "q2:unit": "uC", "r:unit": "cm" },
  compute: (v) => {
    const er = v.num("er") ?? 1;
    const q1 = v.num("q1") as number;
    if (v.mode === "force") {
      const q2 = v.num("q2") as number;
      const r = v.num("r") as number;
      const F = (K * Math.abs(q1 * q2)) / (er * r * r);
      const attract = q1 * q2 < 0;
      const kind = q1 * q2 === 0 ? "No force (a charge is zero)" : attract ? "Attraction" : "Repulsion";
      return {
        outputs: [
          { label: "Force magnitude", value: si(F, "N"), primary: true, note: kind },
          { label: "Interaction", value: kind.split(" (")[0] },
          { label: "Signed force on q₂ along the line (+ = away from q₁)", value: si(attract ? -F : F, "N") },
          { label: "Field from q₁ at q₂", value: `${num(Math.abs((K * q1) / (er * r * r)), 4)} N/C` },
        ],
        steps: [
          `F = k · |q₁q₂| ÷ (εr · r²)`,
          `= 8.9875517923e9 × |${num(q1, 4)} × ${num(q2, 4)}| ÷ (${num(er)} × ${num(r, 4)}²)`,
          `= ${si(F, "N")}`,
        ],
        visual: q1 * q2 !== 0 ? <Diagram q1={q1} q2={q2} attract={attract} /> : undefined,
      };
    }
    if (v.mode === "dist") {
      const q2 = v.num("q2") as number;
      const F = v.num("F") as number;
      if (q1 * q2 === 0) return "Both charges must be non-zero to solve for distance.";
      const r = Math.sqrt((K * Math.abs(q1 * q2)) / (er * F));
      return {
        outputs: [
          { label: "Distance r", value: si(r, "m"), primary: true },
          { label: "Interaction", value: q1 * q2 < 0 ? "Attraction" : "Repulsion" },
        ],
        steps: [`r = √(k · |q₁q₂| ÷ (εr · F))`, `= √(8.9875517923e9 × ${num(Math.abs(q1 * q2), 4)} ÷ (${num(er)} × ${num(F, 4)}))`, `= ${si(r, "m")}`],
      };
    }
    const F = v.num("F") as number;
    const r = v.num("r") as number;
    if (q1 === 0) return "q₁ must be non-zero to solve for q₂.";
    const q2 = (F * er * r * r) / (K * Math.abs(q1));
    return {
      outputs: [
        { label: "Magnitude of q₂", value: si(q2, "C"), primary: true, note: "Same sign as q₁ if they repel, opposite if they attract." },
        { label: "Elementary charges", value: num(q2 / 1.602176634e-19, 4) },
      ],
      steps: [`|q₂| = F · εr · r² ÷ (k · |q₁|)`, `= ${num(F, 4)} × ${num(er)} × ${num(r, 4)}² ÷ (8.9875517923e9 × ${num(Math.abs(q1), 4)})`, `= ${si(q2, "C")}`],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
