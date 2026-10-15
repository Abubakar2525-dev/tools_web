"use client";

import { FormulaTool, num, type FormulaResult, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { molarity } from "./lib/units";
import { KW, fromH, fromOH, fromPH, fromPOH, strongAcid, strongBase, weakApprox, weakExact, type PhState } from "./lib/ph";

function classify(pH: number) {
  if (pH < 6.995) return "Acidic";
  if (pH > 7.005) return "Basic (alkaline)";
  return "Neutral";
}

function result(s: PhState, steps: string[], notes: string[] = []): FormulaResult {
  return {
    outputs: [
      { label: "pH", value: num(s.pH, 5), primary: true, note: `${classify(s.pH)} at 25 °C` },
      { label: "pOH", value: num(s.pOH, 5) },
      { label: "[H⁺] (mol/L)", value: num(s.h, 5) },
      { label: "[OH⁻] (mol/L)", value: num(s.oh, 5) },
    ],
    steps: [...steps, `pH = −log₁₀[H⁺] = ${num(s.pH, 5)}`, `pOH = 14 − pH = ${num(s.pOH, 5)}`, `[OH⁻] = Kw / [H⁺] = 1.0e-14 / ${num(s.h, 5)} = ${num(s.oh, 5)} M`],
    notes: [...notes, "Uses Kw = 1.0 × 10⁻¹⁴ (25 °C) and treats concentrations as activities, which is accurate only for dilute solutions."],
  };
}

const spec: FormulaSpec = {
  modes: [
    { id: "pH", label: "From pH", fields: ["pH"] },
    { id: "h", label: "From [H⁺]", fields: ["h"] },
    { id: "pOH", label: "From pOH", fields: ["pOH"] },
    { id: "oh", label: "From [OH⁻]", fields: ["oh"] },
    { id: "sa", label: "Strong acid", fields: ["c", "nprot"] },
    { id: "sb", label: "Strong base", fields: ["c", "nprot"] },
    { id: "wa", label: "Weak acid (Ka)", fields: ["c", "kType", "K"] },
    { id: "wb", label: "Weak base (Kb)", fields: ["c", "kType", "K"] },
  ],
  fields: [
    { id: "pH", label: "pH", type: "number", min: -2, max: 16 },
    { id: "pOH", label: "pOH", type: "number", min: -2, max: 16 },
    { id: "h", label: "[H⁺] concentration", type: "number", gt: 0, units: molarity },
    { id: "oh", label: "[OH⁻] concentration", type: "number", gt: 0, units: molarity },
    { id: "c", label: "Concentration", type: "number", gt: 0, units: molarity },
    { id: "nprot", label: "H⁺ or OH⁻ released per formula unit", type: "number", integer: true, min: 1, max: 4, hint: "1 for HCl or NaOH, 2 for Ba(OH)2. H2SO4's second proton is not fully strong, so 2 slightly overestimates." },
    {
      id: "kType",
      label: "Constant given as",
      type: "select",
      options: [
        { value: "K", label: "K (Ka or Kb)" },
        { value: "pK", label: "pK (pKa or pKb)" },
      ],
    },
    { id: "K", label: "Ka / Kb or pKa / pKb", type: "number", gt: 0, hint: "Acetic acid: Ka = 1.8e-5 (pKa 4.76). Ammonia: Kb = 1.8e-5." },
  ],
  defaults: { nprot: "1" },
  example: { pH: "3.5", pOH: "4", h: "0.001", oh: "0.01", c: "0.1", nprot: "1", kType: "K", K: "1.8e-5" },
  compute: (v) => {
    switch (v.mode) {
      case "pH":
        return result(fromPH(v.num("pH")!), [`[H⁺] = 10^(−pH) = ${num(10 ** -v.num("pH")!, 5)} M`]);
      case "h":
        return result(fromH(v.num("h")!), []);
      case "pOH":
        return result(fromPOH(v.num("pOH")!), [`[OH⁻] = 10^(−pOH) = ${num(10 ** -v.num("pOH")!, 5)} M`, `[H⁺] = Kw / [OH⁻]`]);
      case "oh":
        return result(fromOH(v.num("oh")!), [`[H⁺] = Kw / [OH⁻] = ${num(KW / v.num("oh")!, 5)} M`]);
      case "sa":
      case "sb": {
        const c = v.num("c")! * v.num("nprot")!;
        const x = v.mode === "sa" ? strongAcid(c) : strongBase(c);
        const ion = v.mode === "sa" ? "H⁺" : "OH⁻";
        const steps = [
          `Full dissociation releases ${num(c, 5)} M ${ion}`,
          `Including water: [${ion}] = (c + √(c² + 4Kw)) / 2 = ${num(x, 6)} M`,
        ];
        const notes = c < 1e-6 ? ["At this dilution water's own ions matter, so the pH stays close to 7 rather than following −log c."] : [];
        return result(v.mode === "sa" ? fromH(x) : fromOH(x), steps, notes);
      }
      default: {
        const c = v.num("c")!;
        const K = v.str("kType") === "pK" ? 10 ** -v.num("K")! : v.num("K")!;
        const x = weakExact(K, c);
        const approx = weakApprox(K, c);
        const pct = (x / c) * 100;
        const acid = v.mode === "wa";
        const ion = acid ? "H⁺" : "OH⁻";
        const k = acid ? "Ka" : "Kb";
        const steps = [
          `${k} = ${num(K, 5)}, c = ${num(c, 5)} M`,
          `${k} = x² / (c − x), so x² + ${k}·x − ${k}·c = 0`,
          `x = [${ion}] = (−${k} + √(${k}² + 4·${k}·c)) / 2 = ${num(x, 6)} M`,
          `Shortcut √(${k}·c) = ${num(approx, 6)} M`,
        ];
        const notes = [
          pct < 5
            ? `Percent ionization is ${num(pct, 3)}%, below 5%, so the √(K·c) shortcut would also be acceptable here (pH differs by ${num(Math.abs(Math.log10(approx / x)), 2)}).`
            : `Percent ionization is ${num(pct, 3)}%, above 5%, so the √(K·c) shortcut would be noticeably off. The exact quadratic is used.`,
        ];
        if (x < 1e-6) notes.push("The ion concentration from the weak acid or base is close to what water itself provides, so this simple model becomes less accurate.");
        const r = result(acid ? fromH(x) : fromOH(x), steps, notes);
        r.outputs.push({ label: "Percent ionized", value: `${num(pct, 4)}%` });
        return r;
      }
    }
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
