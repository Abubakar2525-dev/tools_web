"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { U, parseSIList, si } from "./lib/units";

const spec: FormulaSpec = {
  lead: (
    <>
      Ideal capacitors: no leakage, ESR or tolerance. Pick what you want to work out.
    </>
  ),
  modes: [
    { id: "combo", label: "Series / parallel", fields: ["list", "bare"] },
    { id: "charge", label: "Charge and energy", fields: ["C", "V"] },
    { id: "xc", label: "Reactance", fields: ["C", "f"] },
    { id: "rc", label: "RC time constant", fields: ["R", "C"] },
  ],
  fields: [
    { id: "list", label: "Capacitor values", type: "text", mono: true, placeholder: "10u, 22u, 47u", hint: "Separate with commas or spaces. Prefixes p, n, u (µ), m work." },
    {
      id: "bare",
      label: "Unit for bare numbers",
      type: "select",
      options: [
        { value: "1e-6", label: "µF" },
        { value: "1e-9", label: "nF" },
        { value: "1e-12", label: "pF" },
        { value: "1", label: "F" },
      ],
    },
    { id: "C", label: "Capacitance C", type: "number", units: U.farad, gt: 0 },
    { id: "V", label: "Voltage V", type: "number", units: U.volt, min: 0 },
    { id: "f", label: "Frequency f", type: "number", units: U.hertz, gt: 0 },
    { id: "R", label: "Resistance R", type: "number", units: U.ohm, gt: 0 },
  ],
  defaults: { "R:unit": "kohm" },
  example: { __mode: "combo", list: "10u, 22u, 47u" },
  compute: (v) => {
    if (v.mode === "combo") {
      const vals = parseSIList(v.str("list"), ["F"], Number(v.str("bare")));
      if (typeof vals === "string") return vals;
      const par = vals.reduce((a, b) => a + b, 0);
      const ser = 1 / vals.reduce((a, b) => a + 1 / b, 0);
      return {
        outputs: [
          { label: "Parallel total", value: si(par, "F"), primary: true },
          { label: "Series total", value: si(ser, "F") },
          { label: "Capacitors", value: String(vals.length) },
        ],
        steps: [
          `Parallel: C = ${vals.map((x) => si(x, "F")).join(" + ")} = ${si(par, "F")}`,
          `Series: 1/C = ${vals.map((x) => `1/${si(x, "F")}`).join(" + ")}`,
          `Series: C = ${si(ser, "F")}`,
        ],
        notes: ["Capacitors combine the opposite way to resistors: parallel values add, series values combine as reciprocals. In series, each capacitor's voltage rating still matters because the voltage split depends on the values."],
      };
    }
    const C = v.num("C") as number;
    if (v.mode === "charge") {
      const V = v.num("V") as number;
      const Q = C * V;
      const E = 0.5 * C * V * V;
      return {
        outputs: [
          { label: "Charge Q", value: si(Q, "C"), primary: true },
          { label: "Stored energy E", value: si(E, "J") },
        ],
        steps: [`Q = C × V = ${si(C, "F")} × ${si(V, "V")} = ${si(Q, "C")}`, `E = ½ C V² = 0.5 × ${si(C, "F")} × ${num(V)}² = ${si(E, "J")}`],
      };
    }
    if (v.mode === "xc") {
      const f = v.num("f") as number;
      const X = 1 / (2 * Math.PI * f * C);
      return {
        outputs: [
          { label: "Capacitive reactance Xc", value: si(X, "Ω"), primary: true },
          { label: "Impedance (ideal)", value: `−j${si(X, "Ω")}` },
        ],
        steps: [`Xc = 1 ÷ (2π f C) = 1 ÷ (2π × ${si(f, "Hz")} × ${si(C, "F")}) = ${si(X, "Ω")}`],
        notes: ["Current leads voltage by 90° in an ideal capacitor. Reactance halves each time the frequency doubles."],
      };
    }
    const R = v.num("R") as number;
    const tau = R * C;
    const fc = 1 / (2 * Math.PI * tau);
    return {
      outputs: [
        { label: "Time constant τ", value: si(tau, "s"), primary: true },
        { label: "Time to ~99.3% (5τ)", value: si(5 * tau, "s") },
        { label: "Cutoff frequency (RC filter)", value: si(fc, "Hz") },
      ],
      steps: [`τ = R × C = ${si(R, "Ω")} × ${si(C, "F")} = ${si(tau, "s")}`, `fc = 1 ÷ (2π R C) = ${si(fc, "Hz")}`],
      table: {
        caption: "Charging from 0 V toward the supply (discharge mirrors it)",
        columns: ["Time", "Elapsed", "Charge (% of supply)", "Remaining when discharging"],
        rows: [1, 2, 3, 4, 5].map((k) => [`${k}τ`, si(k * tau, "s"), `${num((1 - Math.exp(-k)) * 100, 4)}%`, `${num(Math.exp(-k) * 100, 4)}%`]),
      },
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
