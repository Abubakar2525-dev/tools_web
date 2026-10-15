"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { B0, babs, blcm } from "./lib/rational";
import { euclidSteps, groupDigits, parseBigInt, sciBig } from "./lib/bigint";

const spec: FormulaSpec = {
  fields: [
    {
      id: "nums",
      label: "Whole numbers",
      type: "text",
      multiline: true,
      placeholder: "84, 126, 210",
      hint: "Two or more integers separated by commas, spaces or new lines.",
    },
  ],
  example: { nums: "84, 126, 210" },
  compute: (v) => {
    const tokens = v.str("nums").split(/[\s,;]+/).filter(Boolean);
    const nums: bigint[] = [];
    for (const t of tokens) {
      const n = parseBigInt(t);
      if (n === null) return `"${t}" is not a whole number.`;
      nums.push(babs(n));
    }
    if (nums.length < 2) return "Enter at least two numbers.";
    if (nums.length > 100) return "Enter at most 100 numbers.";
    if (nums.every((n) => n === B0)) return "At least one number must be non-zero.";
    const steps: string[] = [];
    let g = nums[0];
    for (let i = 1; i < nums.length; i++) {
      const r = euclidSteps(g, nums[i]);
      steps.push(`gcd(${g}, ${nums[i]}):`, ...r.steps.slice(0, 30).map((s) => `  ${s}`), `  → ${r.gcd}`);
      g = r.gcd;
    }
    let l = nums[0];
    let zero = false;
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] === B0 || l === B0) {
        zero = true;
        break;
      }
      const prev = l;
      l = blcm(l, nums[i]);
      steps.push(`lcm(${prev}, ${nums[i]}) = ${prev} × ${nums[i]} ÷ gcd = ${l}`);
    }
    const lcmText = zero ? "0" : l.toString().length > 18 ? sciBig(l) : groupDigits(l);
    return {
      outputs: [
        { label: "Greatest common divisor (GCD)", value: groupDigits(g), primary: true },
        { label: "Least common multiple (LCM)", value: lcmText },
        { label: "Numbers", value: String(nums.length) },
        ...(nums.length === 2 && !zero ? [{ label: "Check: GCD × LCM", value: nums[0] * nums[1] === g * l ? "= a × b ✓" : "mismatch" }] : []),
      ],
      steps,
      notes: zero ? ["The LCM is 0 when any number is 0 (the only common multiple)."] : undefined,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
