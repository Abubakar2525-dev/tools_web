"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { parseNum } from "@/components/tools/kit";

function parseBase(raw: string): number | string {
  const s = raw.trim().toLowerCase();
  if (s === "e") return Math.E;
  const b = parseNum(s);
  if (b === null) return "Enter the base as a number or the letter e.";
  if (b <= 0 || b === 1) return "The base must be positive and not equal to 1.";
  return b;
}

const baseLabel = (raw: string) => (raw.trim().toLowerCase() === "e" ? "e" : raw.trim());

/** Rounds results that are integers up to float noise (log₂ 8 = 2.9999999999999996 → 3). */
const clean = (x: number) => (Math.abs(x - Math.round(x)) < 1e-12 * Math.max(1, Math.abs(x)) ? Math.round(x) : x);

const spec: FormulaSpec = {
  modes: [
    { id: "log", label: "Find log", fields: ["base", "x"] },
    { id: "arg", label: "Solve for x", fields: ["base", "y"] },
    { id: "base", label: "Solve for base", fields: ["x", "y"] },
  ],
  fields: [
    { id: "base", label: "Base (b)", type: "text", placeholder: "10, 2 or e", hint: "Type e for the natural logarithm." },
    { id: "x", label: "Argument (x)", type: "number", gt: 0, placeholder: "1000" },
    { id: "y", label: "Logarithm value (y)", type: "number", placeholder: "3" },
  ],
  defaults: { base: "10" },
  example: { base: "2", x: "1024", y: "10" },
  compute: (v) => {
    if (v.mode === "base") {
      const x = v.num("x");
      const y = v.num("y");
      if (x === null || y === null) return null;
      if (y === 0) return "y cannot be 0: b⁰ = 1 for every base.";
      if (x === 1) return "x = 1 gives y = 0 for every base, so the base cannot be determined.";
      const b = clean(Math.pow(x, 1 / y));
      if (!(b > 0) || b === 1 || !Number.isFinite(b)) return "No valid base exists for these values.";
      return {
        outputs: [
          { label: "Base b", value: num(b, 15), primary: true },
          { label: "Check", value: `${num(b, 10)}^${num(y)} ≈ ${num(Math.pow(b, y), 12)}` },
        ],
        steps: [`log_b(${num(x)}) = ${num(y)} means b^${num(y)} = ${num(x)}`, `b = ${num(x)}^(1/${num(y)})`, `b = ${num(b, 15)}`],
      };
    }
    const bRaw = v.str("base");
    const b = parseBase(bRaw);
    if (typeof b === "string") return bRaw.trim() ? b : null;
    const bl = baseLabel(bRaw);
    if (v.mode === "arg") {
      const y = v.num("y");
      if (y === null) return null;
      const x = clean(Math.pow(b, y));
      if (!Number.isFinite(x)) return "The result is too large to represent.";
      return {
        outputs: [
          { label: "x", value: num(x, 15), primary: true },
          { label: "Check", value: `log_${bl}(${num(x, 10)}) = ${num(y)}` },
        ],
        steps: [`log_${bl}(x) = ${num(y)} means x = ${bl}^${num(y)}`, `x = ${num(x, 15)}`],
      };
    }
    const x = v.num("x");
    if (x === null) return null;
    const lnx = Math.log(x);
    const lnb = Math.log(b);
    const y = clean(lnx / lnb);
    return {
      outputs: [
        { label: `log_${bl}(${num(x)})`, value: num(y, 15), primary: true },
        { label: "ln x", value: num(lnx, 12) },
        { label: "log₁₀ x", value: num(clean(Math.log10(x)), 12) },
        { label: "log₂ x", value: num(clean(Math.log2(x)), 12) },
      ],
      steps: [
        `Change of base: log_${bl}(x) = ln(x) / ln(${bl})`,
        `ln(${num(x)}) = ${num(lnx, 12)}`,
        ...(b === Math.E ? [] : [`ln(${bl}) = ${num(lnb, 12)}`]),
        `log_${bl}(${num(x)}) = ${num(lnx, 12)} / ${num(lnb, 12)} = ${num(y, 15)}`,
        `Check: ${bl}^${num(y, 10)} ≈ ${num(Math.pow(b, y), 12)}`,
      ],
      notes: ["Results use double precision, about 15 significant digits. Values within rounding noise of a whole number are shown as that whole number."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
