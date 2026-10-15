"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { DataTable } from "./ui";
import { parseGenotype, phenotypeOf, punnett, ratio, type PunnettResult } from "./lib/genetics";

function Grid({ r }: { r: PunnettResult }) {
  return (
    <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
      <table className="w-full border-collapse text-center text-sm">
        <caption className="px-4 pt-3 text-left text-[0.8125rem] text-muted">
          Punnett square: rows are parent 1 gametes, columns are parent 2 gametes. Each cell is one equally likely offspring genotype; shaded cells show only recessive traits.
        </caption>
        <thead>
          <tr>
            <td className="border-b border-line px-2 py-2" />
            {r.cols.map((c, j) => (
              <th key={j} scope="col" className="border-b border-line px-2 py-2 font-mono font-semibold text-ink">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row, i) => (
            <tr key={i}>
              <th scope="row" className="border-r border-line px-2 py-2 font-mono font-semibold text-ink">
                {row}
              </th>
              {r.grid[i].map((cell, j) => {
                const recessiveAll = phenotypeOf(cell)
                  .split(" ")
                  .every((p) => !p.endsWith("_"));
                return (
                  <td key={j} className={`border border-line px-2 py-2 font-mono ${recessiveAll ? "bg-sunken text-ink" : "text-ink-2"}`}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const spec: FormulaSpec = {
  lead: (
    <>
      Type each parent&apos;s genotype with two letters per gene, uppercase for the dominant allele: <code>Aa</code>, <code>AaBb</code> or <code>AaBbCc</code>.
    </>
  ),
  fields: [
    { id: "p1", label: "Parent 1 genotype", type: "text", mono: true, placeholder: "AaBb" },
    { id: "p2", label: "Parent 2 genotype", type: "text", mono: true, placeholder: "AaBb" },
  ],
  example: { p1: "AaBb", p2: "AaBb" },
  resultsTitle: "Offspring",
  compute: (v) => {
    const a = parseGenotype(v.str("p1"));
    if (typeof a === "string") return `Parent 1: ${a}`;
    const b = parseGenotype(v.str("p2"));
    if (typeof b === "string") return `Parent 2: ${b}`;
    const r = punnett(a, b);
    if (typeof r === "string") return r;
    const gRatio = ratio(r.genotypes.map((g) => g.count));
    const pRatio = ratio(r.phenotypes.map((p) => p.count));
    const cross = r.genes.length === 1 ? "Monohybrid" : r.genes.length === 2 ? "Dihybrid" : "Trihybrid";
    return {
      outputs: [
        { label: "Phenotype ratio", value: r.phenotypes.length === 1 ? "All alike" : pRatio, primary: true, note: r.phenotypes.map((p) => p.phenotype).join(" : ") },
        { label: "Genotype ratio", value: gRatio },
        { label: "Cross type", value: cross },
        { label: "Grid size", value: `${r.rows.length} × ${r.cols.length}` },
        { label: "Distinct genotypes", value: String(r.genotypes.length) },
      ],
      steps: [
        `Parent 1 gametes: ${[...new Set(r.rows)].join(", ")}`,
        `Parent 2 gametes: ${[...new Set(r.cols)].join(", ")}`,
        `Each gene splits its two alleles evenly into gametes, and genes assort independently.`,
      ],
      visual: (
        <div className="space-y-5">
          <Grid r={r} />
          <DataTable
            caption="Genotypes"
            columns={["Genotype", "Count", "Fraction", "Percent"]}
            rows={r.genotypes.map((g) => [g.genotype, g.count, `${g.count / gcdOf(g.count, r.total)}/${r.total / gcdOf(g.count, r.total)}`, `${num((g.count / r.total) * 100, 4)}%`])}
          />
          <DataTable
            caption="Phenotypes (A_ means at least one dominant allele)"
            columns={["Phenotype", "Meaning", "Count", "Percent"]}
            rows={r.phenotypes.map((p) => [p.phenotype, p.description, p.count, `${num((p.count / r.total) * 100, 4)}%`])}
          />
        </div>
      ),
      notes: ["Assumes complete dominance, independent assortment (unlinked genes) and equal survival of all offspring. Real crosses vary around these expected ratios."],
    };
  },
};

function gcdOf(a: number, b: number): number {
  return b === 0 ? a : gcdOf(b, a % b);
}

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
