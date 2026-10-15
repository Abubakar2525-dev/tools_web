"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { B0, B1, Q, bgcd, blcm } from "./lib/rational";

function parseRatio(raw: string): Q[] | string {
  const parts = raw.split(/\s*[:∶]\s*|\s+to\s+/i).filter((p) => p.trim() !== "");
  if (parts.length < 2) return "Enter at least two parts separated by colons, e.g. 12:18.";
  const out: Q[] = [];
  for (const p of parts) {
    const v = Q.parse(p);
    if (!v) return `"${p.trim()}" is not a number or fraction.`;
    if (v.sign() <= 0) return "Ratio parts must be positive.";
    out.push(v);
  }
  return out;
}

/** Scales rational parts to whole numbers and divides by their gcd. */
function simplest(parts: Q[]): { ints: bigint[]; scale: bigint; g: bigint } {
  const scale = parts.reduce((l, p) => blcm(l, p.d), B1);
  const raw = parts.map((p) => (p.n * scale) / p.d);
  const g = raw.reduce((a, b) => bgcd(a, b), B0);
  return { ints: raw.map((v) => v / g), scale, g };
}

const spec: FormulaSpec = {
  modes: [
    { id: "simplify", label: "Simplify", fields: ["ratio"] },
    { id: "solve", label: "Solve a:b = c:x", fields: ["a", "b", "c"] },
    { id: "divide", label: "Divide an amount", fields: ["amount", "ratio"] },
  ],
  fields: [
    { id: "ratio", label: "Ratio", type: "text", placeholder: "12:18 or 1.5:2.25:3", hint: "Two or more parts separated by colons. Decimals and fractions are fine." },
    { id: "a", label: "a", type: "text", placeholder: "3" },
    { id: "b", label: "b", type: "text", placeholder: "4" },
    { id: "c", label: "c", type: "text", placeholder: "15" },
    { id: "amount", label: "Amount to divide", type: "text", placeholder: "600" },
  ],
  example: { ratio: "12:18:30", a: "3", b: "4", c: "15", amount: "600" },
  compute: (v) => {
    if (v.mode === "solve") {
      const [a, b, c] = ["a", "b", "c"].map((id) => Q.parse(v.str(id)));
      if (!a || !b || !c) return "Enter a, b and c as numbers or fractions.";
      if (a.isZero()) return "a must not be 0.";
      const x = b.mul(c).div(a);
      return {
        outputs: [
          { label: "x", value: x.toString(), primary: true, note: x.isInt() ? undefined : `≈ ${x.toFixed(10)}` },
          { label: "Proportion", value: `${a} : ${b} = ${c} : ${x}` },
          { label: "Scale factor (c ÷ a)", value: c.div(a).toString() },
        ],
        steps: [`a : b = c : x means a/b = c/x`, `Cross-multiply: a × x = b × c`, `x = (b × c) ÷ a = (${b} × ${c}) ÷ ${a}`, `x = ${b.mul(c)} ÷ ${a} = ${x}`],
      };
    }
    const parts = parseRatio(v.str("ratio"));
    if (typeof parts === "string") return parts;
    const { ints, scale, g } = simplest(parts);
    const simple = ints.join(" : ");
    if (v.mode === "simplify") {
      const total = ints.reduce((s, x) => s + x, B0);
      const steps = [`Input: ${parts.map(String).join(" : ")}`];
      if (scale !== B1) steps.push(`Multiply every part by ${scale} to clear decimals and fractions`);
      steps.push(`Greatest common divisor of the whole parts = ${g}`, `Divide each part by ${g}: ${simple}`);
      return {
        outputs: [
          { label: "Simplest form", value: simple, primary: true },
          { label: "As fractions of the whole", value: ints.map((x) => new Q(x, total).toString()).join(", ") },
          { label: "As percentages", value: ints.map((x) => `${new Q(x * BigInt(100), total).toFixed(2)}%`).join(", ") },
          ...(ints.length === 2 ? [{ label: "Unit ratio", value: `1 : ${new Q(ints[1], ints[0]).toFixed(6)}` }] : []),
        ],
        steps,
      };
    }
    const amount = Q.parse(v.str("amount"));
    if (!amount) return "Enter the amount as a number.";
    const total = ints.reduce((s, x) => s + x, B0);
    const share = amount.div(new Q(total));
    const shares = ints.map((x) => share.mul(new Q(x)));
    return {
      outputs: [
        { label: "Shares", value: shares.map((s) => s.toFixed(4)).join(" : "), primary: true },
        { label: "Total parts", value: total.toString() },
        { label: "One part", value: share.toFixed(6) },
      ],
      table: {
        columns: ["Part", "Ratio", "Share (exact)", "Share"],
        rows: shares.map((s, i) => [i + 1, ints[i].toString(), s.toString(), s.toFixed(4)]),
      },
      steps: [`Simplified ratio: ${simple}`, `Total parts = ${ints.join(" + ")} = ${total}`, `One part = ${amount} ÷ ${total} = ${share}`, ...shares.map((s, i) => `Part ${i + 1} = ${ints[i]} × ${share} = ${s}`)],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
