"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { U, parseSIList, si } from "./lib/units";

/** Vacuum permeability, CODATA 2018. */
const MU0 = 1.25663706212e-6;

const spec: FormulaSpec = {
  lead: <>Ideal inductors with no mutual coupling, winding resistance or core saturation.</>,
  modes: [
    { id: "combo", label: "Series / parallel", fields: ["list", "bare"] },
    { id: "energy", label: "Energy", fields: ["L", "I"] },
    { id: "xl", label: "Reactance", fields: ["L", "f"] },
    { id: "rl", label: "RL time constant", fields: ["L", "R"] },
    { id: "sol", label: "Solenoid", fields: ["N", "d", "len", "mur"] },
  ],
  fields: [
    { id: "list", label: "Inductor values", type: "text", mono: true, placeholder: "10m, 22m, 4.7m", hint: "Separate with commas or spaces. Prefixes n, u (µ), m work." },
    {
      id: "bare",
      label: "Unit for bare numbers",
      type: "select",
      options: [
        { value: "1e-3", label: "mH" },
        { value: "1e-6", label: "µH" },
        { value: "1e-9", label: "nH" },
        { value: "1", label: "H" },
      ],
    },
    { id: "L", label: "Inductance L", type: "number", units: U.henry, gt: 0 },
    { id: "I", label: "Current I", type: "number", units: U.amp, min: 0 },
    { id: "f", label: "Frequency f", type: "number", units: U.hertz, gt: 0 },
    { id: "R", label: "Resistance R", type: "number", units: U.ohm, gt: 0 },
    { id: "N", label: "Number of turns N", type: "number", gt: 0, integer: true },
    { id: "d", label: "Coil diameter", type: "number", units: U.length, gt: 0 },
    { id: "len", label: "Coil length", type: "number", units: U.length, gt: 0 },
    { id: "mur", label: "Core relative permeability μr", type: "number", optional: true, gt: 0, placeholder: "1", hint: "1 for an air core." },
  ],
  defaults: { "d:unit": "mm", "len:unit": "mm" },
  example: { __mode: "sol", N: "100", d: "10", len: "50", "d:unit": "mm", "len:unit": "mm" },
  compute: (v) => {
    if (v.mode === "combo") {
      const vals = parseSIList(v.str("list"), ["H"], Number(v.str("bare")));
      if (typeof vals === "string") return vals;
      const ser = vals.reduce((a, b) => a + b, 0);
      const par = 1 / vals.reduce((a, b) => a + 1 / b, 0);
      return {
        outputs: [
          { label: "Series total", value: si(ser, "H"), primary: true },
          { label: "Parallel total", value: si(par, "H") },
          { label: "Inductors", value: String(vals.length) },
        ],
        steps: [`Series: L = ${vals.map((x) => si(x, "H")).join(" + ")} = ${si(ser, "H")}`, `Parallel: 1/L = ${vals.map((x) => `1/${si(x, "H")}`).join(" + ")}`, `Parallel: L = ${si(par, "H")}`],
        notes: ["These totals assume the coils do not share magnetic flux. Coupled coils add or subtract a mutual inductance term."],
      };
    }
    if (v.mode === "sol") {
      const N = v.num("N") as number;
      const d = v.num("d") as number;
      const len = v.num("len") as number;
      const mur = v.num("mur") ?? 1;
      const A = (Math.PI * d * d) / 4;
      const L = (MU0 * mur * N * N * A) / len;
      const notes = ["Long-solenoid formula: it assumes a uniform field inside the coil and ignores end effects. Short, fat coils come out lower in practice."];
      if (len < d) notes.unshift("The coil is shorter than its diameter, so this approximation will noticeably overestimate the inductance.");
      return {
        outputs: [
          { label: "Inductance L", value: si(L, "H"), primary: true },
          { label: "Cross-section area", value: `${num(A * 1e6, 5)} mm²` },
          { label: "Turns per meter", value: num(N / len, 5) },
        ],
        steps: [`A = π d² ÷ 4 = ${num(A, 5)} m²`, `L = μ0 μr N² A ÷ l = 1.25663706e-6 × ${num(mur)} × ${num(N)}² × ${num(A, 5)} ÷ ${num(len, 5)}`, `= ${si(L, "H")}`],
        notes,
      };
    }
    const L = v.num("L") as number;
    if (v.mode === "energy") {
      const I = v.num("I") as number;
      const E = 0.5 * L * I * I;
      return {
        outputs: [
          { label: "Stored energy", value: si(E, "J"), primary: true },
          { label: "Flux linkage LI", value: `${num(L * I, 5)} Wb·turns` },
        ],
        steps: [`E = ½ L I² = 0.5 × ${si(L, "H")} × ${num(I)}² = ${si(E, "J")}`],
      };
    }
    if (v.mode === "xl") {
      const f = v.num("f") as number;
      const X = 2 * Math.PI * f * L;
      return {
        outputs: [
          { label: "Inductive reactance XL", value: si(X, "Ω"), primary: true },
          { label: "Impedance (ideal)", value: `+j${si(X, "Ω")}` },
        ],
        steps: [`XL = 2π f L = 2π × ${si(f, "Hz")} × ${si(L, "H")} = ${si(X, "Ω")}`],
        notes: ["Current lags voltage by 90° in an ideal inductor. Reactance rises in proportion to frequency."],
      };
    }
    const R = v.num("R") as number;
    const tau = L / R;
    return {
      outputs: [
        { label: "Time constant τ", value: si(tau, "s"), primary: true },
        { label: "Time to ~99.3% (5τ)", value: si(5 * tau, "s") },
        { label: "Cutoff frequency (RL filter)", value: si(R / (2 * Math.PI * L), "Hz") },
      ],
      steps: [`τ = L ÷ R = ${si(L, "H")} ÷ ${si(R, "Ω")} = ${si(tau, "s")}`],
      table: {
        caption: "Current rise toward its final value V/R",
        columns: ["Time", "Elapsed", "Current (% of final)"],
        rows: [1, 2, 3, 4, 5].map((k) => [`${k}τ`, si(k * tau, "s"), `${num((1 - Math.exp(-k)) * 100, 4)}%`]),
      },
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
