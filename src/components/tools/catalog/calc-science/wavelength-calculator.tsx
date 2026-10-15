"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { energy, frequency, speed, wave } from "./lib/units";
import { C, E_CHARGE, H } from "./lib/constants";
import { emBand } from "./lib/physics";
import { unitOutputs } from "./shared";

const spec: FormulaSpec = {
  modes: [
    { id: "f", label: "From frequency", fields: ["f", "v"] },
    { id: "lambda", label: "From wavelength", fields: ["lambda", "v"] },
    { id: "E", label: "From photon energy", fields: ["E"] },
  ],
  fields: [
    { id: "f", label: "Frequency (f)", type: "number", gt: 0, units: frequency, defaultUnit: "THz" },
    { id: "lambda", label: "Wavelength (λ)", type: "number", gt: 0, units: wave },
    { id: "v", label: "Wave speed (v)", type: "number", gt: 0, units: speed, hint: "Defaults to the speed of light in vacuum. Sound in air at 20 °C is about 343 m/s." },
    { id: "E", label: "Photon energy (E)", type: "number", gt: 0, units: energy, defaultUnit: "eV" },
  ],
  defaults: { v: String(C) },
  example: { f: "545", "f:unit": "THz", lambda: "550", v: String(C), E: "2.25", "E:unit": "eV" },
  lead: <p>λ = v / f. For light, photon energy E = h f = h c / λ.</p>,
  compute: (v) => {
    let f: number;
    let vel: number;
    const steps: string[] = [];
    if (v.mode === "E") {
      const E = v.num("E")!;
      vel = C;
      f = E / H;
      steps.push(`f = E / h = ${num(E, 6)} J / 6.62607015e-34 J·s = ${num(f, 6)} Hz`);
    } else if (v.mode === "f") {
      f = v.num("f")!;
      vel = v.num("v")!;
    } else {
      const lambda = v.num("lambda")!;
      vel = v.num("v")!;
      f = vel / lambda;
      steps.push(`f = v / λ = ${num(vel)} / ${num(lambda, 6)} = ${num(f, 6)} Hz`);
    }
    const lambda = vel / f;
    if (v.mode !== "lambda") steps.push(`λ = v / f = ${num(vel)} / ${num(f, 6)} = ${num(lambda, 6)} m`);
    const isLight = Math.abs(vel - C) < 1e-6;
    const E = H * f;
    steps.push(`E = h f = ${num(E, 6)} J = ${num(E / E_CHARGE, 6)} eV`);
    const out = [
      { label: "Wavelength", value: lambda >= 1e-3 ? `${num(lambda)} m` : `${num(lambda * 1e9)} nm`, primary: true, note: isLight ? emBand(lambda) : undefined },
      ...unitOutputs("Wavelength", lambda, wave, ["nm", "um", "m"]),
      ...unitOutputs("Frequency", f, frequency, ["Hz", "THz"]),
      { label: "Period", value: `${num(1 / f, 6)} s` },
      { label: "Photon energy (eV)", value: num(E / E_CHARGE, 6) },
      { label: "Photon energy (J)", value: num(E, 6) },
    ];
    return {
      outputs: out,
      steps,
      notes: [
        isLight
          ? "Band boundaries are conventional; neighboring bands overlap in practice."
          : "The speed is not the speed of light, so this is treated as a general wave. Photon energy only applies to electromagnetic waves.",
      ],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
