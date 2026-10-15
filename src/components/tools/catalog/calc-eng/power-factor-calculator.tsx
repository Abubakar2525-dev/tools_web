"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { Figure } from "./ui";
import { U, si } from "./lib/units";

const va = [
  { value: "kVA", label: "kVA", factor: 1e3 },
  { value: "VA", label: "VA", factor: 1 },
  { value: "MVA", label: "MVA", factor: 1e6 },
];
const vars = [
  { value: "kvar", label: "kvar", factor: 1e3 },
  { value: "var", label: "var", factor: 1 },
  { value: "Mvar", label: "Mvar", factor: 1e6 },
];
const watts = [
  { value: "kW", label: "kW", factor: 1e3 },
  { value: "W", label: "W", factor: 1 },
  { value: "MW", label: "MW", factor: 1e6 },
];

const correction = ["target", "Vcap", "f", "system"];

function Triangle({ P, Q, S, phi, Q2 }: { P: number; Q: number; S: number; phi: number; Q2: number | null }) {
  const W = 360,
    H = 200;
  const scale = Math.min(280 / P, 150 / Math.max(Q, 1e-12));
  const x0 = 40,
    y0 = 180;
  const px = x0 + P * scale;
  const qy = y0 - Q * scale;
  const q2y = Q2 !== null ? y0 - Q2 * scale : null;
  return (
    <Figure
      viewBox={`0 0 ${W + 60} ${H + 10}`}
      title="Power triangle"
      desc={`Real power P = ${si(P, "W")} along the base, reactive power Q = ${si(Q, "var")} vertical, apparent power S = ${si(S, "VA")} on the hypotenuse, angle φ = ${num(phi, 4)}°.${Q2 !== null ? ` Dashed line: after correction Q = ${si(Q2, "var")}.` : ""}`}
    >
      <polygon points={`${x0},${y0} ${px},${y0} ${px},${qy}`} className="fill-accent-soft stroke-accent-strong" strokeWidth={2} />
      {q2y !== null && <line x1={x0} y1={y0} x2={px} y2={q2y} className="stroke-ink" strokeWidth={2} strokeDasharray="6 4" />}
      <text x={(x0 + px) / 2} y={y0 + 18} textAnchor="middle" className="fill-ink text-[13px]">
        P = {si(P, "W", 3)}
      </text>
      <text x={px + 6} y={(y0 + qy) / 2} className="fill-ink text-[13px]">
        Q = {si(Q, "var", 3)}
      </text>
      <text x={(x0 + px) / 2 - 10} y={(y0 + qy) / 2 - 8} textAnchor="end" className="fill-ink text-[13px]">
        S = {si(S, "VA", 3)}
      </text>
      <text x={x0 + 34} y={y0 - 6} className="fill-ink-2 text-[12px]">
        φ = {num(phi, 3)}°
      </text>
    </Figure>
  );
}

const spec: FormulaSpec = {
  lead: (
    <>
      Assumes sinusoidal voltage and current and a lagging (inductive) load. <strong>PF = cos φ = P ÷ S</strong>, <strong>Q = P · tan φ</strong>. Fill the optional correction fields to size a capacitor bank.
    </>
  ),
  modes: [
    { id: "ppf", label: "P and PF", fields: ["P", "pf", ...correction] },
    { id: "ps", label: "P and S", fields: ["P", "S", ...correction] },
    { id: "pq", label: "P and Q", fields: ["P", "Q", ...correction] },
    { id: "vi", label: "V, I and PF", fields: ["V", "I", "pf", "system", "target", "f"] },
  ],
  fields: [
    { id: "P", label: "Real power P", type: "number", units: watts, gt: 0 },
    { id: "S", label: "Apparent power S", type: "number", units: va, gt: 0 },
    { id: "Q", label: "Reactive power Q", type: "number", units: vars, min: 0 },
    { id: "pf", label: "Power factor (cos φ)", type: "number", gt: 0, max: 1, placeholder: "0.75" },
    { id: "V", label: "Voltage (line-to-line for three-phase)", type: "number", units: U.volt, gt: 0 },
    { id: "I", label: "Current (line current for three-phase)", type: "number", units: U.amp, gt: 0 },
    {
      id: "system",
      label: "System",
      type: "select",
      options: [
        { value: "single", label: "Single-phase" },
        { value: "delta", label: "Three-phase, capacitors in delta" },
        { value: "star", label: "Three-phase, capacitors in star (wye)" },
      ],
    },
    { id: "target", label: "Target power factor", type: "number", optional: true, gt: 0, max: 1, placeholder: "0.95" },
    { id: "Vcap", label: "Supply voltage (line-to-line for three-phase)", type: "number", units: U.volt, optional: true, gt: 0, hint: "Needed for capacitance in µF." },
    { id: "f", label: "Frequency", type: "number", suffix: "Hz", optional: true, gt: 0, placeholder: "50" },
  ],
  defaults: { f: "50", "V:unit": "V", "Vcap:unit": "V" },
  example: { __mode: "ppf", P: "100", pf: "0.75", target: "0.95", Vcap: "400", f: "50", system: "delta" },
  compute: (v) => {
    let P = 0,
      S = 0,
      Q = 0,
      pf = 0;
    const steps: string[] = [];
    const system = v.str("system");
    const three = system !== "single";
    if (v.mode === "ppf") {
      P = v.num("P") as number;
      pf = v.num("pf") as number;
      S = P / pf;
      Q = Math.sqrt(Math.max(0, S * S - P * P));
      steps.push(`S = P ÷ PF = ${si(P, "W")} ÷ ${num(pf, 4)} = ${si(S, "VA")}`);
    } else if (v.mode === "ps") {
      P = v.num("P") as number;
      S = v.num("S") as number;
      if (P > S * (1 + 1e-12)) return "Real power cannot exceed apparent power.";
      pf = P / S;
      Q = Math.sqrt(Math.max(0, S * S - P * P));
      steps.push(`PF = P ÷ S = ${si(P, "W")} ÷ ${si(S, "VA")} = ${num(pf, 4)}`);
    } else if (v.mode === "pq") {
      P = v.num("P") as number;
      Q = v.num("Q") as number;
      S = Math.hypot(P, Q);
      pf = P / S;
      steps.push(`S = √(P² + Q²) = ${si(S, "VA")}`, `PF = P ÷ S = ${num(pf, 4)}`);
    } else {
      const V = v.num("V") as number;
      const I = v.num("I") as number;
      pf = v.num("pf") as number;
      S = three ? Math.sqrt(3) * V * I : V * I;
      P = S * pf;
      Q = Math.sqrt(Math.max(0, S * S - P * P));
      steps.push(three ? `S = √3 × V × I = √3 × ${si(V, "V")} × ${si(I, "A")} = ${si(S, "VA")}` : `S = V × I = ${si(V, "V")} × ${si(I, "A")} = ${si(S, "VA")}`, `P = S × PF = ${si(P, "W")}`);
    }
    if (v.mode !== "pq") steps.push(`Q = √(S² − P²) = ${si(Q, "var")}`);
    const phi = (Math.acos(Math.min(1, pf)) * 180) / Math.PI;
    steps.push(`φ = arccos(${num(pf, 4)}) = ${num(phi, 5)}°`);

    const outputs = [
      { label: "Power factor", value: num(pf, 4), primary: true, note: `Lagging, φ = ${num(phi, 4)}°` },
      { label: "Real power P", value: si(P, "W") },
      { label: "Reactive power Q", value: si(Q, "var") },
      { label: "Apparent power S", value: si(S, "VA") },
      { label: "Phase angle φ", value: `${num(phi, 4)}°` },
    ];
    const notes: string[] = [];
    let Q2: number | null = null;
    const target = v.num("target");
    if (target !== null) {
      if (target <= pf + 1e-12) notes.push(`The target (${num(target, 4)}) is not higher than the present power factor (${num(pf, 4)}), so no correction is needed.`);
      else {
        const t1 = Math.tan((phi * Math.PI) / 180);
        const t2 = Math.tan(Math.acos(target));
        const Qc = P * (t1 - t2);
        Q2 = Q - Qc;
        const S2 = P / target;
        outputs.push({ label: "Capacitor kvar needed (Qc)", value: si(Qc, "var") }, { label: "Apparent power after", value: si(S2, "VA") });
        steps.push(`Qc = P × (tan φ₁ − tan φ₂) = ${si(P, "W")} × (${num(t1, 5)} − ${num(t2, 5)}) = ${si(Qc, "var")}`);
        const V = v.mode === "vi" ? v.num("V") : v.num("Vcap");
        const f = v.num("f");
        if (V !== null && f !== null) {
          const w = 2 * Math.PI * f;
          let C: number;
          if (system === "single") {
            C = Qc / (w * V * V);
            steps.push(`C = Qc ÷ (2πf V²) = ${si(Qc, "var")} ÷ (2π × ${num(f)} × ${num(V)}²) = ${si(C, "F")}`);
            outputs.push({ label: "Capacitance", value: si(C, "F") });
          } else if (system === "delta") {
            C = Qc / (3 * w * V * V);
            steps.push(`Delta: each of 3 capacitors sees the line voltage, C = Qc ÷ (3 × 2πf × V²) = ${si(C, "F")} per phase`);
            outputs.push({ label: "Capacitance per phase (delta)", value: si(C, "F") });
          } else {
            const Vp = V / Math.sqrt(3);
            C = Qc / (3 * w * Vp * Vp);
            steps.push(`Star: each capacitor sees V ÷ √3 = ${num(Vp, 5)} V, C = Qc ÷ (3 × 2πf × (V/√3)²) = ${si(C, "F")} per phase`);
            outputs.push({ label: "Capacitance per phase (star)", value: si(C, "F") });
          }
          const I1 = three ? S / (Math.sqrt(3) * V) : S / V;
          const I2 = three ? S2 / (Math.sqrt(3) * V) : S2 / V;
          outputs.push({ label: "Line current before → after", value: `${si(I1, "A", 3)} → ${si(I2, "A", 3)}` });
        } else notes.push("Add the supply voltage and frequency to convert the kvar into capacitance.");
      }
    }
    if (three && v.mode !== "vi") notes.push("For three-phase, P, Q and S are totals for all three phases.");
    return { outputs, steps, notes, visual: <Triangle P={P} Q={Q} S={S} phi={phi} Q2={Q2} /> };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
