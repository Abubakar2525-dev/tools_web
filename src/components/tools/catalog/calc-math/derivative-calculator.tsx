"use client";

import { derivative, parse, simplify, type MathNode } from "mathjs";
import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { parseNum } from "@/components/tools/kit";

const ORD = ["", "f′(x)", "f″(x)", "f‴(x)"];

const spec: FormulaSpec = {
  fields: [
    {
      id: "f",
      label: "Function f(x)",
      type: "text",
      mono: true,
      placeholder: "x^3 * sin(x)",
      hint: "Use ^ for powers. Functions: sin, cos, tan, exp, log (natural), sqrt, abs. Implicit multiplication works: 3x^2.",
    },
    { id: "v", label: "Variable", type: "text", mono: true, placeholder: "x" },
    {
      id: "order",
      label: "Order",
      type: "select",
      options: [
        { value: "1", label: "First derivative" },
        { value: "2", label: "Second derivative" },
        { value: "3", label: "Third derivative" },
      ],
    },
    { id: "at", label: "Evaluate at", type: "text", optional: true, placeholder: "e.g. 2 or pi/4", hint: "Optional point for the value of each derivative." },
  ],
  defaults: { v: "x", order: "1" },
  example: { f: "x^3 * sin(x)", v: "x", order: "2", at: "pi/2" },
  compute: (v) => {
    const name = v.str("v").trim();
    if (!/^[a-zA-Z]\w*$/.test(name)) return "The variable must be a name such as x or t.";
    let node: MathNode;
    try {
      node = parse(v.str("f").replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/"));
    } catch (e) {
      return `Could not read the function: ${e instanceof Error ? e.message : "syntax error"}.`;
    }
    const order = Number(v.str("order"));
    const results: MathNode[] = [];
    let cur = node;
    try {
      for (let i = 0; i < order; i++) {
        cur = simplify(derivative(cur, name));
        results.push(cur);
      }
    } catch (e) {
      return `Could not differentiate: ${e instanceof Error ? e.message : "unsupported expression"}.`;
    }
    const atRaw = v.str("at").trim();
    let at: number | null = null;
    if (atRaw) {
      const n = parseNum(atRaw);
      if (n !== null) at = n;
      else {
        try {
          const val = parse(atRaw).evaluate();
          if (typeof val === "number") at = val;
        } catch {
          /* handled below */
        }
        if (at === null) return "The evaluation point must be a number or a constant expression like pi/4.";
      }
    }
    const evalAt = (nd: MathNode) => {
      if (at === null) return null;
      try {
        const r = nd.evaluate({ [name]: at });
        return typeof r === "number" ? r : null;
      } catch {
        return null;
      }
    };
    const label = (i: number) => ORD[i].replace("x", name);
    const last = results[results.length - 1];
    const val = evalAt(last);
    const outputs = [
      { label: label(order), value: last.toString(), primary: true, note: at !== null ? `At ${name} = ${atRaw}: ${val === null ? "undefined" : num(val, 12)}` : undefined },
      ...results.slice(0, -1).map((r, i) => ({ label: label(i + 1), value: r.toString() })),
    ];
    if (at !== null) {
      const f0 = evalAt(node);
      outputs.push({ label: `f(${atRaw})`, value: f0 === null ? "undefined" : num(f0, 12) });
      results.slice(0, -1).forEach((r, i) => {
        const y = evalAt(r);
        outputs.push({ label: `${label(i + 1).replace(`(${name})`, `(${atRaw})`)}`, value: y === null ? "undefined" : num(y, 12) });
      });
    }
    return {
      outputs,
      steps: [
        `Parsed as: f(${name}) = ${node.toString()}`,
        ...results.map((r, i) => `${label(i + 1)} = d/d${name} [${i === 0 ? "f" : label(i)}] = ${r.toString()}`),
        "Symbolic differentiation (sum, product, quotient and chain rules) followed by algebraic simplification",
      ],
      notes: ["Simplified forms can look different from a textbook answer while being equal. Trig functions use radians."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
