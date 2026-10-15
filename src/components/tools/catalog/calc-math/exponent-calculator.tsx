"use client";

import { FormulaTool, num, type FormulaSpec, type FormulaOutput } from "@/components/tools/engines/FormulaTool";
import { B0, Q, babs } from "./lib/rational";
import { digitCount, groupDigits, iroot, sciBig } from "./lib/bigint";
import { BigDigits } from "./ui";

/** Exact results are limited to about this many digits to keep the page responsive. */
const MAX_DIGITS = 200000;

function log10Abs(q: Q): number {
  const len = (b: bigint) => {
    const s = babs(b).toString();
    return s.length - 1 + Math.log10(Number(`0.${s.slice(0, 17)}`) * 10);
  };
  return len(q.n) - len(q.d);
}

function exactOutputs(r: Q, label: string): { outputs: FormulaOutput[]; visual?: React.ReactNode } {
  if (r.isInt()) {
    const digits = digitCount(r.n);
    const long = digits > 15;
    return {
      outputs: [
        { label, value: long ? sciBig(r.n) : groupDigits(r.n), primary: true, note: long ? "Full digits below." : undefined },
        { label: "Digits", value: digits.toLocaleString("en-US") },
      ],
      visual: long ? <BigDigits label={`All ${digits.toLocaleString("en-US")} digits`} value={r.n.toString()} /> : undefined,
    };
  }
  const text = r.toString();
  const dec = r.toNumber();
  return {
    outputs: [
      { label, value: text.length > 24 ? num(dec, 12) : text, primary: true, note: text.length > 24 ? "Exact fraction below." : undefined },
      { label: "Decimal", value: num(dec, 15) },
    ],
    visual: text.length > 24 ? <BigDigits label="Exact fraction" value={r.toAscii()} /> : undefined,
  };
}

const spec: FormulaSpec = {
  fields: [
    { id: "base", label: "Base (b)", type: "text", placeholder: "2, −3, 1.5 or 2/3" },
    { id: "exp", label: "Exponent (n)", type: "text", placeholder: "100, −2 or 1/3", hint: "Integers, decimals or fractions such as 2/3." },
  ],
  example: { base: "2", exp: "100" },
  compute: (v) => {
    const b = Q.parse(v.str("base"));
    const e = Q.parse(v.str("exp"));
    if (!b) return "The base is not a valid number.";
    if (!e) return "The exponent is not a valid number.";
    if (b.isZero() && e.sign() < 0) return "0 raised to a negative power is undefined (division by zero).";
    if (b.isZero() && e.isZero()) {
      return { outputs: [{ label: "bⁿ", value: "1", primary: true, note: "By convention 0⁰ = 1 in algebra and combinatorics." }] };
    }
    const lg = b.isZero() ? 0 : log10Abs(b);
    const steps: string[] = [];
    if (e.isInt()) {
      const n = Number(e.n);
      const estDigits = Math.abs(n * lg);
      if (!Number.isSafeInteger(n) || estDigits > MAX_DIGITS) {
        const L = n * lg;
        const exp10 = Math.floor(L);
        const mant = 10 ** (L - exp10);
        const sign = b.sign() < 0 && n % 2 !== 0 ? "−" : "";
        return {
          outputs: [
            { label: "bⁿ (approximate)", value: `${sign}${mant.toFixed(8)} × 10^${exp10}`, primary: true },
            { label: "Digits before the decimal point", value: L > 0 ? (exp10 + 1).toLocaleString("en-US") : "0" },
          ],
          steps: [`log₁₀|b| = ${lg.toPrecision(15)}`, `log₁₀|bⁿ| = n × log₁₀|b| = ${L.toPrecision(15)}`, `bⁿ = 10^${L.toPrecision(15)}`],
          notes: [`Exact digits are limited to about ${MAX_DIGITS.toLocaleString("en-US")}; this result is shown in scientific notation from logarithms.`],
        };
      }
      const r = b.pow(n);
      steps.push(n < 0 ? `b^(−k) = 1 / b^k, so ${b}^${n} = 1 / ${b}^${-n}` : `${b}^${n} = ${b} multiplied by itself ${n} times`);
      if (n < 0) steps.push(`${b}^${-n} = ${b.pow(-n).toString().slice(0, 60)}${b.pow(-n).toString().length > 60 ? "…" : ""}`);
      steps.push(`Exact result computed with arbitrary-precision integers (square-and-multiply).`);
      const o = exactOutputs(r, "bⁿ");
      return { outputs: o.outputs, visual: o.visual, steps };
    }
    // Fractional exponent p/q.
    const p = e.n;
    const q = e.d;
    if (q > BigInt(1000)) return "Fractional exponents need a denominator of 1000 or less (try a simpler fraction).";
    const qi = Number(q);
    steps.push(`n = ${e} = p/q with p = ${p}, q = ${q}`, `b^(p/q) = (root of index q of b)^p`);
    if (b.sign() < 0 && qi % 2 === 0) {
      return { outputs: [{ label: "bⁿ", value: "Not a real number", primary: true, note: "An even root of a negative number is complex." }], steps };
    }
    const neg = b.sign() < 0;
    const absB = b.abs();
    const rn = iroot(absB.n, qi);
    const rd = iroot(absB.d, qi);
    if (rn ** q === absB.n && rd ** q === absB.d) {
      let root = new Q(neg ? -rn : rn, rd);
      steps.push(`The root of index ${q} of ${b} is exactly ${root}`);
      const pn = Number(p);
      if (Math.abs(pn * log10Abs(root.isZero() ? Q.ONE : root)) > MAX_DIGITS) return "The result is too large to show exactly.";
      root = root.pow(pn);
      steps.push(`Raise to the power ${p}: ${root.toString().slice(0, 80)}`);
      const o = exactOutputs(root, "bⁿ (exact)");
      return { outputs: o.outputs, visual: o.visual, steps };
    }
    const mag = Math.pow(absB.toNumber(), e.toNumber());
    const val = neg && Number(p % BigInt(2)) !== 0 ? -mag : mag;
    steps.push(`No exact rational root, so the value is computed in floating point`, `|b|^n = ${num(absB.toNumber(), 12)}^${num(e.toNumber(), 12)} = ${num(mag, 15)}`);
    if (neg) steps.push(`q is odd, so the real root of a negative base is negative${Number(p % BigInt(2)) === 0 ? ", then an even power p makes it positive" : ""}`);
    return {
      outputs: [
        { label: "bⁿ (approximate)", value: num(val, 15), primary: true },
        { label: "Written as a root", value: `${q === BigInt(2) ? "√" : `${q}√`}(${b}^${p})`.replace("-", "−") },
      ],
      steps,
      notes: p === B0 ? undefined : ["Irrational result: shown to 15 significant digits (double precision)."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
