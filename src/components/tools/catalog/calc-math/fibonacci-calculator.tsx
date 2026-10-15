"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { digitCount, fib, fibIndex, fibPair, groupDigits, isqrt, parseBigInt, sciBig } from "./lib/bigint";
import { BigDigits } from "./ui";

const MAX_N = 200000;
const MAX_LIST = 1000;

const spec: FormulaSpec = {
  modes: [
    { id: "nth", label: "Nth term", fields: ["n"] },
    { id: "list", label: "List terms", fields: ["from", "to"] },
    { id: "test", label: "Is it Fibonacci?", fields: ["x"] },
  ],
  fields: [
    { id: "n", label: "n", type: "number", integer: true, min: -MAX_N, max: MAX_N, placeholder: "100", hint: "F(0) = 0, F(1) = 1. Negative n uses F(−n) = (−1)ⁿ⁺¹ F(n)." },
    { id: "from", label: "From n", type: "number", integer: true, min: 0, max: MAX_N, placeholder: "0" },
    { id: "to", label: "To n", type: "number", integer: true, min: 0, max: MAX_N, placeholder: "20" },
    { id: "x", label: "Number to test", type: "text", placeholder: "144" },
  ],
  example: { n: "100", from: "0", to: "20", x: "6765" },
  compute: (v) => {
    if (v.mode === "nth") {
      const n = v.num("n");
      if (n === null) return null;
      const f = fib(n);
      const digits = digitCount(f);
      const long = digits > 15;
      const k = Math.floor(Math.abs(n) / 2);
      const [a, b] = Math.abs(n) > 1 ? fibPair(k) : [BigInt(0), BigInt(1)];
      const steps = [
        "Fast doubling: F(2k) = F(k) × (2F(k+1) − F(k)) and F(2k+1) = F(k)² + F(k+1)²",
        `This needs about ${Math.max(1, Math.ceil(Math.log2(Math.abs(n) + 1)))} doubling steps instead of ${Math.abs(n)} additions`,
      ];
      if (Math.abs(n) > 1 && digitCount(b) < 25) {
        steps.push(`k = ${k}: F(${k}) = ${a}, F(${k + 1}) = ${b}`);
        steps.push(
          Math.abs(n) % 2 === 0
            ? `F(${Math.abs(n)}) = ${a} × (2 × ${b} − ${a}) = ${groupDigits(fib(Math.abs(n)))}`
            : `F(${Math.abs(n)}) = ${a}² + ${b}² = ${groupDigits(fib(Math.abs(n)))}`,
        );
      }
      if (n < 0) steps.push(`Negative index: F(${n}) = (−1)^${-n + 1} × F(${-n})`);
      const phi = (1 + Math.sqrt(5)) / 2;
      const binet = Math.abs(n) <= 1470 ? Math.pow(phi, Math.abs(n)) / Math.sqrt(5) : Infinity;
      if (Number.isFinite(binet) && Math.abs(n) > 0) steps.push(`Binet check: φ^${Math.abs(n)} / √5 ≈ ${binet.toPrecision(12)}`);
      return {
        outputs: [
          { label: `F(${n})`, value: long ? sciBig(f) : groupDigits(f), primary: true, note: long ? "Full digits below." : undefined },
          { label: "Digits", value: digits.toLocaleString("en-US") },
          { label: "Parity", value: f % BigInt(2) === BigInt(0) ? "Even" : "Odd" },
        ],
        visual: long ? <BigDigits label={`F(${n}), ${digits.toLocaleString("en-US")} digits`} value={f.toString()} /> : undefined,
        steps,
        notes: [`n is limited to ±${MAX_N.toLocaleString("en-US")} (F(200,000) has 41,798 digits).`],
      };
    }
    if (v.mode === "list") {
      const from = v.num("from");
      const to = v.num("to");
      if (from === null || to === null) return null;
      if (to < from) return "“To n” must be at least “From n”.";
      if (to - from + 1 > MAX_LIST) return `List at most ${MAX_LIST.toLocaleString("en-US")} terms at a time.`;
      let [a, b] = fibPair(from);
      const rows: (string | number)[][] = [];
      for (let i = from; i <= to; i++) {
        const s = a.toString();
        rows.push([i, s.length > 40 ? `${s.slice(0, 20)}…${s.slice(-8)} (${s.length} digits)` : groupDigits(a)]);
        [a, b] = [b, a + b];
      }
      return {
        outputs: [
          { label: "Terms listed", value: String(rows.length), primary: true },
          { label: "Range", value: `F(${from}) to F(${to})` },
        ],
        table: { columns: ["n", "F(n)"], rows },
        steps: [`Start from F(${from}) and F(${from + 1}) (fast doubling), then add: F(n+1) = F(n) + F(n−1)`],
      };
    }
    const x = parseBigInt(v.str("x"));
    if (x === null) return "Enter a whole number.";
    if (x < BigInt(0)) return "Enter a non-negative number.";
    if (digitCount(x) > 5000) return "Numbers are limited to 5,000 digits.";
    const t = BigInt(5) * x * x;
    const plus = t + BigInt(4);
    const minus = t - BigInt(4);
    const sq = (y: bigint) => y >= BigInt(0) && isqrt(y) ** BigInt(2) === y;
    const idx = fibIndex(x);
    const isFib = idx !== null;
    const short = (y: bigint) => (digitCount(y) > 30 ? sciBig(y) : groupDigits(y));
    return {
      outputs: [
        { label: "Fibonacci number?", value: isFib ? "Yes" : "No", primary: true, note: isFib ? `It is F(${idx})${x === BigInt(1) ? " and F(2)" : ""}.` : undefined },
        { label: "5x² + 4 is a square", value: sq(plus) ? "Yes" : "No" },
        { label: "5x² − 4 is a square", value: sq(minus) ? "Yes" : "No" },
      ],
      steps: [
        "Test: x is a Fibonacci number exactly when 5x² + 4 or 5x² − 4 is a perfect square",
        `5x² + 4 = ${short(plus)}${sq(plus) ? ` = ${short(isqrt(plus))}²` : " (not a square)"}`,
        `5x² − 4 = ${short(minus)}${sq(minus) ? ` = ${short(isqrt(minus))}²` : " (not a square)"}`,
      ],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
