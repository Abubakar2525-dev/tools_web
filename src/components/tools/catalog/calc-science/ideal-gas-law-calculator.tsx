"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { amount, pressure, temperature, volume } from "./lib/units";
import { R } from "./lib/constants";
import { unitOutputs } from "./shared";

const spec: FormulaSpec = {
  modes: [
    { id: "P", label: "Find P", fields: ["V", "n", "T"] },
    { id: "V", label: "Find V", fields: ["P", "n", "T"] },
    { id: "n", label: "Find n", fields: ["P", "V", "T"] },
    { id: "T", label: "Find T", fields: ["P", "V", "n"] },
    { id: "V2", label: "Combined: find V₂", fields: ["P1", "V1", "T1", "P2", "T2"] },
    { id: "P2", label: "Combined: find P₂", fields: ["P1", "V1", "T1", "V2", "T2"] },
    { id: "T2", label: "Combined: find T₂", fields: ["P1", "V1", "T1", "P2", "V2"] },
  ],
  fields: [
    { id: "P", label: "Pressure (P)", type: "number", gt: 0, units: pressure, defaultUnit: "kPa" },
    { id: "V", label: "Volume (V)", type: "number", gt: 0, units: volume, defaultUnit: "L" },
    { id: "n", label: "Amount (n)", type: "number", gt: 0, units: amount },
    { id: "T", label: "Temperature (T)", type: "number", units: temperature, defaultUnit: "C" },
    { id: "P1", label: "Initial pressure (P₁)", type: "number", gt: 0, units: pressure, defaultUnit: "kPa" },
    { id: "V1", label: "Initial volume (V₁)", type: "number", gt: 0, units: volume, defaultUnit: "L" },
    { id: "T1", label: "Initial temperature (T₁)", type: "number", units: temperature, defaultUnit: "C" },
    { id: "P2", label: "Final pressure (P₂)", type: "number", gt: 0, units: pressure, defaultUnit: "kPa" },
    { id: "V2", label: "Final volume (V₂)", type: "number", gt: 0, units: volume, defaultUnit: "L" },
    { id: "T2", label: "Final temperature (T₂)", type: "number", units: temperature, defaultUnit: "C" },
  ],
  example: { P: "101.325", V: "22.414", n: "1", T: "0", P1: "100", V1: "2", T1: "20", P2: "200", V2: "1.2", T2: "80" },
  lead: <p>PV = nRT with R = 8.314462618 J/(mol·K). The combined law P₁V₁/T₁ = P₂V₂/T₂ applies to a fixed amount of gas.</p>,
  compute: (v) => {
    const tempInputs: Record<string, string[]> = { P: ["T"], V: ["T"], n: ["T"], T: [], V2: ["T1", "T2"], P2: ["T1", "T2"], T2: ["T1"] };
    if ((tempInputs[v.mode] ?? []).some((id) => v.num(id)! <= 0)) return "Temperatures must be above absolute zero (0 K, −273.15 °C).";
    const P = v.num("P");
    const V = v.num("V");
    const n = v.num("n");
    const T = v.num("T");
    switch (v.mode) {
      case "P": {
        const p = (n! * R * T!) / V!;
        return { outputs: [{ label: "Pressure", value: `${num(p / 1000)} kPa`, primary: true }, ...unitOutputs("Pressure", p, pressure, ["atm", "bar", "psi", "mmHg"])], steps: [`P = nRT / V = ${num(n!)} × 8.314462618 × ${num(T!)} K / ${num(V!)} m³ = ${num(p)} Pa`] };
      }
      case "V": {
        const vol = (n! * R * T!) / P!;
        return { outputs: [{ label: "Volume", value: `${num(vol * 1000)} L`, primary: true }, ...unitOutputs("Volume", vol, volume, ["m3", "mL", "ft3"])], steps: [`V = nRT / P = ${num(n!)} × 8.314462618 × ${num(T!)} K / ${num(P!)} Pa = ${num(vol)} m³`] };
      }
      case "n": {
        const nn = (P! * V!) / (R * T!);
        return { outputs: [{ label: "Amount", value: `${num(nn)} mol`, primary: true }, { label: "Molecules", value: num(nn * 6.02214076e23, 6) }], steps: [`n = PV / RT = ${num(P!)} Pa × ${num(V!)} m³ / (8.314462618 × ${num(T!)} K) = ${num(nn)} mol`] };
      }
      case "T": {
        const t = (P! * V!) / (n! * R);
        return { outputs: [{ label: "Temperature", value: `${num(t)} K`, primary: true }, ...unitOutputs("Temperature", t, temperature, ["C", "F"])], steps: [`T = PV / nR = ${num(P!)} × ${num(V!)} / (${num(n!)} × 8.314462618) = ${num(t)} K`] };
      }
    }
    const P1 = v.num("P1")!;
    const V1 = v.num("V1")!;
    const T1 = v.num("T1")!;
    const k = (P1 * V1) / T1;
    if (v.mode === "V2") {
      const res = (k * v.num("T2")!) / v.num("P2")!;
      return { outputs: [{ label: "Final volume", value: `${num(res * 1000)} L`, primary: true }, ...unitOutputs("Volume", res, volume, ["m3", "mL"])], steps: [`P₁V₁ / T₁ = ${num(k)} J/K`, `V₂ = (P₁V₁ / T₁) × T₂ / P₂ = ${num(res)} m³`] };
    }
    if (v.mode === "P2") {
      const res = (k * v.num("T2")!) / v.num("V2")!;
      return { outputs: [{ label: "Final pressure", value: `${num(res / 1000)} kPa`, primary: true }, ...unitOutputs("Pressure", res, pressure, ["atm", "bar", "psi"])], steps: [`P₁V₁ / T₁ = ${num(k)} J/K`, `P₂ = (P₁V₁ / T₁) × T₂ / V₂ = ${num(res)} Pa`] };
    }
    const res = (v.num("P2")! * v.num("V2")!) / k;
    return { outputs: [{ label: "Final temperature", value: `${num(res)} K`, primary: true }, ...unitOutputs("Temperature", res, temperature, ["C", "F"])], steps: [`P₁V₁ / T₁ = ${num(k)} J/K`, `T₂ = P₂V₂ / (P₁V₁ / T₁) = ${num(res)} K`] };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
