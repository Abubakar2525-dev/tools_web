import { num } from "@/components/tools/engines/FormulaTool";
import { molarMass, parseFormula, prettyFormula } from "./lib/formula";

export type MolarInput = { mm: number; label: string; step: string; approximate: boolean } | { error: string } | null;

/**
 * Molar mass from a formula text field or, if the formula is empty, from a
 * numeric molar mass field. Returns null when both are empty.
 */
export function resolveMolarMass(formula: string, manual: number | null): MolarInput {
  const f = formula.trim();
  if (f) {
    try {
      const p = parseFormula(f);
      const r = molarMass(p.counts);
      const mm = r.molarMass * p.coefficient;
      return {
        mm,
        label: prettyFormula(p.formula),
        step: `M(${prettyFormula(p.formula)}) = ${r.rows.map((x) => `${x.count > 1 ? `${x.count} × ` : ""}${x.element.weight}`).join(" + ")} = ${num(mm, 7)} g/mol`,
        approximate: r.approximate,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not read the formula." };
    }
  }
  if (manual !== null) return { mm: manual, label: "solute", step: `M = ${num(manual, 7)} g/mol (entered)`, approximate: false };
  return null;
}
