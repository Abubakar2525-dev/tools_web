"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { hillFormula, molarMass, parseFormula, prettyFormula } from "./lib/formula";
import { ELEMENTS } from "./lib/elements";
import { NA } from "./lib/constants";

function WeightsTable() {
  return (
    <details className="rounded-xl bg-sunken p-4">
      <summary className="cursor-pointer text-sm font-medium text-ink">Atomic weights used (all 118 elements)</summary>
      <div className="mt-3 max-h-[320px] overflow-auto rounded-lg bg-surface" tabIndex={0} aria-label="Atomic weights table">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-line">
              <th scope="col" className="px-3 py-2 font-medium">Z</th>
              <th scope="col" className="px-3 py-2 font-medium">Symbol</th>
              <th scope="col" className="px-3 py-2 font-medium">Name</th>
              <th scope="col" className="px-3 py-2 font-medium">Atomic weight</th>
            </tr>
          </thead>
          <tbody>
            {ELEMENTS.map((e) => (
              <tr key={e.number} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5 tabular-nums text-muted">{e.number}</td>
                <td className="px-3 py-1.5 font-medium">{e.symbol}</td>
                <td className="px-3 py-1.5 text-ink-2">{e.name}</td>
                <td className="px-3 py-1.5 tabular-nums text-ink-2">{e.weightText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.8125rem] text-muted">Brackets mark elements with no stable isotopes: the value is a mass number, not a measured average.</p>
    </details>
  );
}

const spec: FormulaSpec = {
  fields: [
    {
      id: "formula",
      label: "Chemical formula",
      type: "text",
      mono: true,
      placeholder: "e.g. Ca(OH)2 or CuSO4·5H2O",
      hint: "Case matters (Co is cobalt, CO is carbon monoxide). Use ( ) [ ] for groups and · * or . for hydrates.",
    },
  ],
  example: { formula: "CuSO4·5H2O" },
  compute: (v) => {
    const p = parseFormula(v.str("formula"));
    const r = molarMass(p.counts);
    const M = r.molarMass * p.coefficient;
    const totalAtoms = [...p.counts.values()].reduce((a, b) => a + b, 0);
    const notes: string[] = [];
    if (p.coefficient !== 1) notes.push(`The leading ${p.coefficient} multiplies the whole formula; the molar mass of one ${prettyFormula(p.formula)} unit is ${num(r.molarMass, 7)} g/mol.`);
    if (r.approximate) notes.push("Includes an element with no stable isotopes; its mass number was used, so the result is approximate.");
    if (p.charge !== 0) notes.push("The mass of the gained or lost electrons (about 0.00055 g/mol each) is ignored, as is usual.");
    return {
      outputs: [
        { label: `Molar mass of ${p.coefficient !== 1 ? `${p.coefficient} ` : ""}${prettyFormula(p.formula)}`, value: `${num(M, 7)} g/mol`, primary: true },
        { label: "Hill formula", value: prettyFormula(hillFormula(p.counts)) },
        { label: "Empirical formula", value: prettyFormula(hillFormula(p.counts, true)) },
        { label: "Atoms per formula unit", value: num(totalAtoms) },
        { label: "Mass of one unit", value: `${num(r.molarMass / NA, 6)} g` },
        { label: "Elements", value: String(p.counts.size) },
      ],
      table: {
        caption: "Percent composition by mass",
        columns: ["Element", "Atoms", "Atomic weight", "Mass (g/mol)", "Mass %"],
        rows: r.rows.map((x) => [`${x.element.name} (${x.element.symbol})`, x.count, x.element.weightText, num(x.mass, 7), `${x.percent.toFixed(3)}%`]),
      },
      steps: [
        ...r.rows.map((x) => `${x.element.symbol}: ${x.count} × ${x.element.weight} = ${num(x.mass, 7)} g/mol`),
        `Sum = ${num(r.molarMass, 7)} g/mol`,
      ],
      notes,
      visual: <WeightsTable />,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
