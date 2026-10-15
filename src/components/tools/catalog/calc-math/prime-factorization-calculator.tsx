"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { digitCount, divisorCount, divisorSum, divisorsFrom, factorize, groupDigits, isPrime, parseBigInt } from "./lib/bigint";
import { BigDigits } from "./ui";

const MAX_DIGITS = 40;
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[Number(d)]);

const spec: FormulaSpec = {
  fields: [{ id: "n", label: "Whole number", type: "text", placeholder: "360", hint: `Integer from 2 up to ${MAX_DIGITS} digits.` }],
  example: { n: "360" },
  compute: (v) => {
    const n = parseBigInt(v.str("n"));
    if (n === null) return "Enter a whole number (digits only).";
    if (n < BigInt(2)) return "Enter a number of 2 or more. 0 and 1 have no prime factorization.";
    if (digitCount(n) > MAX_DIGITS) return `Numbers are limited to ${MAX_DIGITS} digits.`;
    let f: [bigint, number][];
    try {
      f = factorize(n, Date.now() + 2000);
    } catch (e) {
      return e instanceof Error ? e.message : "Factoring failed.";
    }
    const expForm = f.map(([p, e]) => (e > 1 ? `${p}${sup(e)}` : `${p}`)).join(" × ");
    const flat = f.flatMap(([p, e]) => Array.from({ length: e }, () => p));
    // Division ladder: divide by the smallest prime factor each time.
    const steps: string[] = [];
    let rest = n;
    for (const p of flat) {
      if (steps.length >= 40) {
        steps.push("…");
        break;
      }
      const next = rest / p;
      steps.push(`${groupDigits(rest)} ÷ ${p} = ${groupDigits(next)}`);
      rest = next;
    }
    steps.push(`Result: ${expForm}`);
    const count = divisorCount(f);
    const sigma = divisorSum(f);
    const proper = sigma - n;
    const kind = proper === n ? "Perfect (proper divisors sum to n)" : proper > n ? "Abundant" : "Deficient";
    const listDivisors = count <= BigInt(5000);
    const divisors = listDivisors ? divisorsFrom(f) : [];
    const prime = f.length === 1 && f[0][1] === 1;
    return {
      outputs: [
        { label: "Prime factorization", value: expForm, primary: true, note: prime ? "This number is prime." : undefined },
        { label: "Number of divisors", value: groupDigits(count) },
        { label: "Sum of divisors", value: groupDigits(sigma) },
        { label: "Distinct primes", value: String(f.length) },
        { label: "Classification", value: prime ? "Prime" : kind },
        { label: "Prime test", value: isPrime(n).prime ? "Prime" : "Composite" },
      ],
      table: {
        caption: "Prime powers",
        columns: ["Prime", "Exponent", "Power"],
        rows: f.map(([p, e]) => [groupDigits(p), e, groupDigits(p ** BigInt(e))]),
      },
      visual: listDivisors ? (
        <BigDigits label={`All ${divisors.length.toLocaleString("en-US")} divisors`} value={divisors.join(", ")} />
      ) : undefined,
      steps: [
        ...steps,
        `Divisor count = ${f.map(([, e]) => `(${e} + 1)`).join(" × ")} = ${count}`,
      ],
      notes: listDivisors ? undefined : ["There are more than 5,000 divisors, so the list is not shown."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
