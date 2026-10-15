"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { U } from "./lib/units";

/**
 * Fluid properties at 1 atm. Water: CRC Handbook of Chemistry and Physics
 * tables. Air: dry air at 20 °C, 101.325 kPa. Engine oil: unused engine oil at
 * 300 K from Incropera et al., Fundamentals of Heat and Mass Transfer, Table A.5.
 */
const FLUIDS: Record<string, { label: string; rho: number; mu: number }> = {
  water20: { label: "Water at 20 °C (ρ 998.2 kg/m³, μ 1.002 mPa·s)", rho: 998.2, mu: 1.002e-3 },
  water10: { label: "Water at 10 °C (ρ 999.7 kg/m³, μ 1.306 mPa·s)", rho: 999.7, mu: 1.306e-3 },
  water60: { label: "Water at 60 °C (ρ 983.2 kg/m³, μ 0.467 mPa·s)", rho: 983.2, mu: 0.4665e-3 },
  air20: { label: "Air at 20 °C, 1 atm (ρ 1.204 kg/m³, μ 18.25 µPa·s)", rho: 1.204, mu: 1.825e-5 },
  oil: { label: "Engine oil, unused, 27 °C (ρ 884 kg/m³, μ 0.486 Pa·s)", rho: 884.1, mu: 0.486 },
};

function regime(Re: number) {
  if (Re < 2300) return { label: "Laminar", note: "Re < 2300: smooth, layered flow in a pipe." };
  if (Re <= 4000) return { label: "Transitional", note: "2300 ≤ Re ≤ 4000: flow may switch between laminar and turbulent." };
  return { label: "Turbulent", note: "Re > 4000: chaotic mixing flow in a pipe." };
}

const spec: FormulaSpec = {
  lead: (
    <>
      <strong>Re = ρ v D ÷ μ = v D ÷ ν</strong>. For pipes, D is the inner diameter; for other shapes use the hydraulic diameter 4A ÷ P.
    </>
  ),
  modes: [
    { id: "preset", label: "Fluid preset", fields: ["fluid", "v", "D"] },
    { id: "dyn", label: "Density + dynamic viscosity", fields: ["rho", "mu", "v", "D"] },
    { id: "kin", label: "Kinematic viscosity", fields: ["nu", "v", "D"] },
  ],
  fields: [
    { id: "fluid", label: "Fluid", type: "select", options: Object.entries(FLUIDS).map(([value, f]) => ({ value, label: f.label })) },
    { id: "rho", label: "Density ρ", type: "number", units: U.density, gt: 0 },
    { id: "mu", label: "Dynamic viscosity μ", type: "number", units: U.dynVisc, gt: 0 },
    { id: "nu", label: "Kinematic viscosity ν", type: "number", units: U.kinVisc, gt: 0 },
    { id: "v", label: "Mean flow velocity v", type: "number", units: U.velocity, min: 0 },
    { id: "D", label: "Diameter or characteristic length D", type: "number", units: U.length, gt: 0 },
  ],
  defaults: { "D:unit": "mm", "mu:unit": "mPa.s", "nu:unit": "mm2/s" },
  example: { __mode: "preset", fluid: "water20", v: "1.5", D: "50", "D:unit": "mm" },
  compute: (v) => {
    const vel = v.num("v") as number;
    const D = v.num("D") as number;
    let Re: number;
    let nu: number;
    const steps: string[] = [];
    if (v.mode === "kin") {
      nu = v.num("nu") as number;
      Re = (vel * D) / nu;
      steps.push(`Re = v D ÷ ν = ${num(vel, 5)} × ${num(D, 5)} ÷ ${num(nu, 5)} = ${num(Re, 6)}`);
    } else {
      const f = v.mode === "preset" ? FLUIDS[v.str("fluid")] : { rho: v.num("rho") as number, mu: v.num("mu") as number };
      nu = f.mu / f.rho;
      Re = (f.rho * vel * D) / f.mu;
      steps.push(`Re = ρ v D ÷ μ = ${num(f.rho, 5)} × ${num(vel, 5)} × ${num(D, 5)} ÷ ${num(f.mu, 5)} = ${num(Re, 6)}`, `ν = μ ÷ ρ = ${num(nu, 5)} m²/s`);
    }
    const r = regime(Re);
    const vLam = (2300 * nu) / D;
    return {
      outputs: [
        { label: "Reynolds number", value: num(Re, 5), primary: true, note: `${r.label} (pipe flow)` },
        { label: "Flow regime in a pipe", value: r.label },
        { label: "Kinematic viscosity ν", value: `${num(nu * 1e6, 5)} mm²/s` },
        { label: "Velocity at Re = 2300", value: `${num(vLam, 5)} m/s` },
      ],
      steps,
      notes: [r.note, "The 2300 and 4000 limits are conventions for flow in circular pipes. Flat plates, open channels and flows around objects use different critical values."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
