"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { B1, B10, Q } from "./lib/rational";
import { digitCount, factorize, iroot } from "./lib/bigint";
import { BigDigits } from "./ui";

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[Number(d)]);
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const rootSym = (n: number) => (n === 2 ? "√" : `${sup(n)}√`);

/** n-th root of a non-negative rational to `digits` decimals using integer roots (no float error). */
function preciseRoot(x: Q, n: number, digits: number): string {
  const guard = digits + 5;
  const N = BigInt(n);
  const scaled = x.n * x.d ** (N - B1) * B10 ** (N * BigInt(guard));
  const R = iroot(scaled, n);
  return new Q(R, x.d * B10 ** BigInt(guard)).toFixed(digits);
}

/** x = k^n · m with m free of n-th powers (integers up to ~10^30). */
function simplifyRadical(x: bigint, n: number): { k: bigint; m: bigint } | null {
  if (digitCount(x) > 30) return null;
  let k = B1;
  let m = B1;
  try {
    for (const [p, e] of factorize(x, Date.now() + 400)) {
      k *= p ** BigInt(Math.floor(e / n));
      m *= p ** BigInt(e % n);
    }
  } catch {
    return null;
  }
  return { k, m };
}

const spec: FormulaSpec = {
  fields: [
    { id: "x", label: "Radicand (x)", type: "text", placeholder: "72, 2, 0.5 or 8/27" },
    { id: "n", label: "Root index (n)", type: "number", integer: true, min: 2, max: 100, placeholder: "2", hint: "2 for square root, 3 for cube root." },
    {
      id: "digits",
      label: "Decimal places",
      type: "select",
      options: ["15", "30", "50", "100", "500"].map((d) => ({ value: d, label: `${d} digits` })),
    },
  ],
  defaults: { n: "2", digits: "30" },
  example: { x: "72", n: "2", digits: "30" },
  compute: (v) => {
    const x = Q.parse(v.str("x"));
    const n = v.num("n");
    if (!x) return "The radicand is not a valid number.";
    if (n === null) return null;
    const digits = Number(v.str("digits"));
    if (digitCount(x.n) + digitCount(x.d) > 2000) return "The radicand is too long (2,000 digits maximum).";
    const neg = x.sign() < 0;
    if (neg && n % 2 === 0) {
      const absRoot = preciseRoot(x.abs(), n, Math.min(digits, 30));
      return {
        outputs: [
          { label: `${rootSym(n)}x`, value: "Not a real number", primary: true, note: "An even root of a negative number has no real value." },
          ...(n === 2 ? [{ label: "Principal complex root", value: `${absRoot}i` }] : []),
        ],
        steps: [`${rootSym(n)}(${x}) = ${rootSym(n)}(${x.abs()}) × ${rootSym(n)}(−1), and ${rootSym(n)}(−1) is not real`],
      };
    }
    const ax = x.abs();
    const steps: string[] = [];
    const rn = iroot(ax.n, n);
    const rd = iroot(ax.d, n);
    const exact = rn ** BigInt(n) === ax.n && rd ** BigInt(n) === ax.d;
    const decimal = (neg ? "−" : "") + preciseRoot(ax, n, digits);
    let simplified: string | null = null;
    if (exact) {
      const r = new Q(neg ? -rn : rn, rd);
      steps.push(`(${r.abs()})^${n} = ${ax}, so the root is exact`);
      simplified = r.toString();
    } else if (x.isInt()) {
      const s = simplifyRadical(ax.n, n);
      if (s) {
        const power = n === 2 ? "squares" : n === 3 ? "cubes" : `${ord(n)} powers`;
        if (s.k !== B1) steps.push(`Factor out perfect ${power}: ${ax} = ${s.k}^${n} × ${s.m}`);
        if (s.k !== B1) {
          simplified = `${neg ? "−" : ""}${s.k}${rootSym(n)}${s.m}`;
          steps.push(`${rootSym(n)}${ax} = ${s.k} × ${rootSym(n)}${s.m}`);
        } else {
          simplified = `${neg ? "−" : ""}${rootSym(n)}${ax}`;
          steps.push(`No perfect ${ord(n)}-power factor, so ${rootSym(n)}${ax} is already in simplest form`);
        }
      }
    }
    steps.push(`Decimal: integer ${ord(n)} root of x × 10^(${n} × ${digits + 5}), then rounded to ${digits} places, so every digit shown is correct`);
    return {
      outputs: [
        { label: `${rootSym(n)}x`, value: simplified ?? `${rootSym(n)}(${x})`, primary: true, note: exact ? "Exact rational root." : `≈ ${decimal.slice(0, 18)}…` },
        { label: "Exact?", value: exact ? "Yes, rational" : "No, irrational" },
        { label: "Index", value: String(n) },
      ],
      visual: <BigDigits label={`Decimal value (${digits} places${exact ? "" : ", rounded"})`} value={decimal} />,
      steps,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
