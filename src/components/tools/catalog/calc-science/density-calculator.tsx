"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { density, mass, volume } from "./lib/units";
import { unitOutputs } from "./shared";

/** Approximate densities near room temperature, kg/m³ (typical handbook values). */
const REFERENCE: [string, number][] = [
  ["Air (sea level, 20 °C)", 1.204],
  ["Gasoline", 740],
  ["Ethanol", 789],
  ["Ice", 917],
  ["Water (4 °C)", 1000],
  ["Seawater", 1025],
  ["Aluminum", 2700],
  ["Iron", 7874],
  ["Copper", 8960],
  ["Lead", 11340],
  ["Mercury", 13534],
  ["Gold", 19300],
];

function nearest(rho: number): string {
  let best = REFERENCE[0];
  for (const r of REFERENCE) if (Math.abs(Math.log(r[1] / rho)) < Math.abs(Math.log(best[1] / rho))) best = r;
  const ratio = rho / best[1];
  return ratio > 0.9 && ratio < 1.1 ? `Close to ${best[0].toLowerCase()} (about ${num(best[1], 4)} kg/m³).` : "";
}

const spec: FormulaSpec = {
  modes: [
    { id: "rho", label: "Find density", fields: ["m", "V"] },
    { id: "m", label: "Find mass", fields: ["rho", "V"] },
    { id: "V", label: "Find volume", fields: ["rho", "m"] },
  ],
  fields: [
    { id: "m", label: "Mass (m)", type: "number", gt: 0, units: mass, defaultUnit: "g" },
    { id: "V", label: "Volume (V)", type: "number", gt: 0, units: volume, defaultUnit: "cm3" },
    { id: "rho", label: "Density (ρ)", type: "number", gt: 0, units: density, defaultUnit: "gcm3" },
  ],
  example: { m: "540", "m:unit": "g", V: "200", "V:unit": "cm3", rho: "2.7", "rho:unit": "gcm3" },
  compute: (v) => {
    if (v.mode === "rho") {
      const m = v.num("m")!;
      const V = v.num("V")!;
      const rho = m / V;
      const hint = nearest(rho);
      return {
        outputs: [{ label: "Density", value: `${num(rho)} kg/m³`, primary: true, note: hint || undefined }, ...unitOutputs("Density", rho, density, ["gcm3", "lbft3"])],
        steps: [`ρ = m / V = ${num(m)} kg / ${num(V)} m³ = ${num(rho)} kg/m³`],
        table: { caption: "Reference densities (approximate, room temperature)", columns: ["Material", "kg/m³", "g/cm³"], rows: REFERENCE.map(([n, d]) => [n, num(d, 5), num(d / 1000, 5)]) },
      };
    }
    if (v.mode === "m") {
      const rho = v.num("rho")!;
      const V = v.num("V")!;
      const m = rho * V;
      return { outputs: [{ label: "Mass", value: `${num(m)} kg`, primary: true }, ...unitOutputs("Mass", m, mass, ["g", "lb", "oz"])], steps: [`m = ρ × V = ${num(rho)} kg/m³ × ${num(V)} m³ = ${num(m)} kg`] };
    }
    const rho = v.num("rho")!;
    const m = v.num("m")!;
    const V = m / rho;
    return { outputs: [{ label: "Volume", value: `${num(V)} m³`, primary: true }, ...unitOutputs("Volume", V, volume, ["L", "cm3", "galUS"])], steps: [`V = m / ρ = ${num(m)} kg / ${num(rho)} kg/m³ = ${num(V)} m³`] };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
