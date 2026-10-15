"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { digitCount, doubleFactorial, factorial, factorialTrailingZeros, groupDigits, sciBig, trailingZeros } from "./lib/bigint";
import { BigDigits } from "./ui";

const MAX_N = 20000;

const spec: FormulaSpec = {
  fields: [
    { id: "n", label: "n", type: "number", integer: true, min: 0, max: MAX_N, placeholder: "25", hint: `Whole number from 0 to ${MAX_N.toLocaleString("en-US")}.` },
    {
      id: "kind",
      label: "Calculate",
      type: "select",
      options: [
        { value: "single", label: "n! (factorial)" },
        { value: "double", label: "n!! (double factorial)" },
      ],
    },
  ],
  example: { n: "25", kind: "single" },
  compute: (v) => {
    const n = v.num("n");
    if (n === null) return null;
    const dbl = v.str("kind") === "double";
    const r = dbl ? doubleFactorial(n) : factorial(n);
    const digits = digitCount(r);
    const tz = dbl ? trailingZeros(r) : factorialTrailingZeros(n);
    const label = dbl ? `${n}!!` : `${n}!`;
    const steps: string[] = [];
    if (dbl) {
      const terms: number[] = [];
      for (let k = n; k > 0 && terms.length < 6; k -= 2) terms.push(k);
      steps.push(`${label} = ${terms.join(" × ")}${n - 2 * terms.length > 0 ? " × …" : ""}${n === 0 ? "1 (empty product)" : ""}`);
      steps.push(n % 2 === 0 ? `Even n: n!! = 2^(n/2) × (n/2)! = 2^${n / 2} × ${n / 2}!` : `Odd n: n!! = n! ÷ (2^((n−1)/2) × ((n−1)/2)!)`);
    } else {
      const terms: number[] = [];
      for (let k = n; k > 0 && terms.length < 6; k--) terms.push(k);
      steps.push(n < 2 ? `${n}! = 1 (by definition)` : `${label} = ${terms.join(" × ")}${n > 6 ? " × … × 1" : ""}`);
      if (n >= 5) {
        const parts: string[] = [];
        for (let p = 5; p <= n; p *= 5) parts.push(`⌊${n}/${p}⌋`);
        steps.push(`Trailing zeros (Legendre): ${parts.join(" + ")} = ${tz}`);
      }
    }
    steps.push(`Computed exactly with BigInt (product tree), ${digits.toLocaleString("en-US")} digits`);
    const long = digits > 15;
    return {
      outputs: [
        { label, value: long ? sciBig(r) : groupDigits(r), primary: true, note: long ? "Scientific notation; every digit is listed below." : undefined },
        { label: "Number of digits", value: digits.toLocaleString("en-US") },
        { label: "Trailing zeros", value: tz.toLocaleString("en-US") },
      ],
      visual: <BigDigits label={`Exact value of ${label}`} value={r.toString()} />,
      steps,
      notes: [`Inputs are capped at ${MAX_N.toLocaleString("en-US")} so the page stays responsive (${MAX_N.toLocaleString("en-US")}! has 77,338 digits).`],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
