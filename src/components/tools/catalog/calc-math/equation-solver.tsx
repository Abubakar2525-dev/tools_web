"use client";

import { all, create, type MathNode } from "mathjs";
import { FormulaTool, num, type FormulaSpec, type FormulaResult } from "@/components/tools/engines/FormulaTool";
import { polyEval, polyRoots, scanRoots, type Complex } from "./lib/roots";
import { Q } from "./lib/rational";
import { rref, type Mat } from "./lib/matrix";

const math = create(all);
const fracMath = create(all, { number: "Fraction" });

const RESERVED = new Set(["e", "E", "pi", "PI", "i", "Infinity", "NaN", "tau", "phi"]);

/** "lhs = rhs" → "(lhs) - (rhs)". Plain expressions are treated as "= 0". */
function toZeroForm(eq: string): string {
  const parts = eq.replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/").split("=");
  if (parts.length > 2) throw new Error("Use a single = sign per equation.");
  if (parts.length === 2) {
    if (!parts[0].trim() || !parts[1].trim()) throw new Error("Both sides of = need an expression.");
    return `(${parts[0]}) - (${parts[1]})`;
  }
  return parts[0];
}

function variablesOf(node: MathNode): string[] {
  const names = new Set<string>();
  node.traverse((n, path, parent) => {
    if (n.type === "SymbolNode" && !(parent?.type === "FunctionNode" && path === "fn")) {
      const name = (n as unknown as { name: string }).name;
      if (!RESERVED.has(name)) names.add(name);
    }
  });
  return [...names].sort();
}

const fmtC = (z: Complex) => {
  if (z.im === 0) return num(z.re, 12);
  const re = z.re === 0 ? "" : num(z.re, 12);
  const im = `${num(Math.abs(z.im), 12)}i`;
  return re ? `${re} ${z.im < 0 ? "−" : "+"} ${im}` : `${z.im < 0 ? "−" : ""}${im}`;
};

function solvePolynomial(eq: string): FormulaResult | string {
  const expr = toZeroForm(eq);
  const node = math.parse(expr);
  const vars = variablesOf(node);
  if (vars.length > 1) return `Polynomial mode takes one variable; found ${vars.join(", ")}. Use “System” mode for several unknowns.`;
  const v = vars[0] ?? "x";
  let r: { coefficients: number[]; denominator: MathNode | null; numerator: MathNode };
  try {
    r = math.rationalize(node, {}, true) as unknown as typeof r;
  } catch {
    return "This is not a polynomial (it may contain functions like sin or e^x). Try “Any equation” mode with a range.";
  }
  if (r.denominator && r.denominator.toString() !== "1" && /[a-z]/i.test(r.denominator.toString())) {
    return "The variable appears in a denominator. Multiply it out or use “Any equation” mode.";
  }
  const c = r.coefficients;
  if (!c || !c.length) return "Could not read polynomial coefficients.";
  while (c.length > 1 && c[c.length - 1] === 0) c.pop();
  const deg = c.length - 1;
  if (deg === 0) return c[0] === 0 ? "The equation is true for every value (0 = 0)." : "No solution: the equation reduces to a non-zero constant = 0.";
  if (deg > 30) return "Degree is limited to 30.";
  const roots = polyRoots(c);
  const real = roots.filter((z) => z.im === 0);
  const poly = r.numerator.toString();
  const resid = (z: Complex) => {
    const p = polyEval(c, z);
    return Math.hypot(p.re, p.im);
  };
  return {
    outputs: [
      { label: real.length ? `Real root${real.length > 1 ? "s" : ""}` : "Real roots", value: real.length ? real.map((z) => `${v} = ${num(z.re, 12)}`).join(", ") : "None", primary: true },
      { label: "Degree", value: String(deg) },
      { label: "Real / complex roots", value: `${real.length} / ${roots.length - real.length}` },
    ],
    table: {
      caption: "All roots (repeated roots listed once per multiplicity)",
      columns: ["#", "Root", "|p(root)|"],
      rows: roots.map((z, i) => [i + 1, fmtC(z), resid(z).toExponential(2)]),
    },
    steps: [
      `Rearranged to p(${v}) = 0 with p(${v}) = ${poly}`,
      `Coefficients from the constant term up: ${c.map((x) => num(x, 10)).join(", ")}`,
      `A degree-${deg} polynomial has ${deg} roots counted with multiplicity (fundamental theorem of algebra)`,
      deg === 1
        ? `Linear: ${v} = −(${num(c[0], 10)}) / ${num(c[1], 10)}`
        : "Roots found together with the Durand-Kerner iteration, then repeated roots grouped and polished with Newton's method",
    ],
    notes: ["Roots are numeric (about 12 significant digits). For exact surd form of a quadratic, use the quadratic equation solver."],
  };
}

function solveGeneral(eq: string, lo: number, hi: number): FormulaResult | string {
  if (!(hi > lo)) return "The range end must be greater than the start.";
  const node = math.parse(toZeroForm(eq));
  const vars = variablesOf(node);
  if (vars.length > 1) return `Use one variable; found ${vars.join(", ")}.`;
  const v = vars[0] ?? "x";
  const code = node.compile();
  const f = (x: number) => {
    try {
      const y = code.evaluate({ [v]: x });
      return typeof y === "number" ? y : NaN;
    } catch {
      return NaN;
    }
  };
  const { roots, poles } = scanRoots(f, lo, hi, 4000);
  const shown = roots.slice(0, 200);
  return {
    outputs: [
      { label: roots.length === 1 ? "Root" : "Roots", value: roots.length ? shown.slice(0, 8).map((x) => `${v} ≈ ${num(x, 12)}`).join(", ") + (roots.length > 8 ? ", …" : "") : "None found in this range", primary: true },
      { label: "Roots found", value: String(roots.length) },
      { label: "Search range", value: `${num(lo)} to ${num(hi)}` },
    ],
    table: roots.length ? { columns: ["#", v, `f(${v})`], rows: shown.map((x, i) => [i + 1, num(x, 14), f(x).toExponential(2)]) } : undefined,
    steps: [
      `Rearranged to f(${v}) = ${node.toString()} = 0`,
      `Sampled f at 4,001 evenly spaced points from ${num(lo)} to ${num(hi)}`,
      "Each sign change was refined with Brent's method (bisection safeguarded by interpolation) to full double precision",
      "Points where |f| dips to zero without changing sign (touching roots) were refined by minimizing |f|",
      ...(poles ? [`Ignored ${poles} sign change${poles > 1 ? "s" : ""} where f jumps through infinity (a pole, not a root)`] : []),
    ],
    notes: ["Numeric search: roots closer together than the sampling step, or outside the range, can be missed. Narrow the range to look closer."],
  };
}

type Lin = { coeffs: Q[]; constant: Q };

/** Reads a linear equation exactly (Fraction arithmetic). Returns null when it is not linear or not rational. */
function linearExact(expr: string, vars: string[]): Lin | null | "nonlinear" {
  let code: ReturnType<MathNode["compile"]>;
  try {
    code = fracMath.parse(expr).compile();
  } catch {
    return null;
  }
  const evalAt = (vals: number[]): Q | null => {
    try {
      const scope: Record<string, unknown> = {};
      vars.forEach((name, i) => (scope[name] = fracMath.fraction(vals[i])));
      const r = code.evaluate(scope) as { toFraction?: () => string };
      if (!r || typeof r.toFraction !== "function") return null;
      return Q.parse(r.toFraction());
    } catch {
      return null;
    }
  };
  const zero = vars.map(() => 0);
  const c0 = evalAt(zero);
  if (!c0) return null;
  const coeffs: Q[] = [];
  for (let i = 0; i < vars.length; i++) {
    const p = zero.slice();
    p[i] = 1;
    const ci = evalAt(p);
    if (!ci) return null;
    coeffs.push(ci.sub(c0));
  }
  // Linearity check at two other points.
  for (const pt of [vars.map((_, i) => i + 2), vars.map((_, i) => 7 - 3 * i)]) {
    const got = evalAt(pt);
    if (!got) return null;
    const want = coeffs.reduce((s, c, i) => s.add(c.mul(Q.int(pt[i]))), c0);
    if (!got.eq(want)) return "nonlinear";
  }
  return { coeffs, constant: c0 };
}

function linearFloat(expr: string, vars: string[]): Lin | "nonlinear" {
  const code = math.parse(expr).compile();
  const f = (vals: number[]) => {
    const scope: Record<string, number> = {};
    vars.forEach((name, i) => (scope[name] = vals[i]));
    const y = code.evaluate(scope);
    if (typeof y !== "number") throw new Error("Coefficients must be real numbers.");
    return y;
  };
  const zero = vars.map(() => 0);
  const c0 = f(zero);
  const cs = vars.map((_, i) => {
    const p = zero.slice();
    p[i] = 1;
    return f(p) - c0;
  });
  const pt = vars.map((_, i) => i + 2);
  const want = cs.reduce((s, c, i) => s + c * pt[i], c0);
  if (Math.abs(f(pt) - want) > 1e-9 * Math.max(1, Math.abs(want))) return "nonlinear";
  return { coeffs: cs.map((x) => Q.fromNumber(x)), constant: Q.fromNumber(c0) };
}

function solveSystem(text: string): FormulaResult | string {
  const lines = text.split(/\n|;/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return "Enter at least one equation.";
  if (lines.length > 10) return "Enter at most 10 equations.";
  const exprs = lines.map(toZeroForm);
  const varSet = new Set<string>();
  for (const e of exprs) variablesOf(math.parse(e)).forEach((x) => varSet.add(x));
  const vars = [...varSet].sort();
  if (!vars.length) return "No variables found. Write equations like 2x + 3y = 7.";
  if (vars.length > 10) return "At most 10 unknowns.";
  let exact = true;
  const rows: Lin[] = [];
  for (let i = 0; i < exprs.length; i++) {
    const lin = linearExact(exprs[i], vars);
    if (lin === "nonlinear") return `Equation ${i + 1} is not linear. Each term must be a number times one variable.`;
    if (lin === null) {
      exact = false;
      const fl = linearFloat(exprs[i], vars);
      if (fl === "nonlinear") return `Equation ${i + 1} is not linear.`;
      rows.push(fl);
    } else rows.push(lin);
  }
  const aug: Mat = rows.map((r) => [...r.coeffs, r.constant.neg()]);
  const res = rref(aug, 1);
  const n = vars.length;
  const inconsistent = res.m.some((row) => row.slice(0, n).every((x) => x.isZero()) && !row[n].isZero());
  const show = (q: Q) => (exact ? q.toString() : num(q.toNumber(), 12));
  const steps = [
    "Augmented matrix [coefficients | constant]:",
    ...aug.map((r) => `  [ ${r.slice(0, n).map(show).join("  ")} | ${show(r[n])} ]`),
    "Gauss-Jordan elimination:",
    ...res.ops.slice(0, 40).map((o) => `  ${o}`),
    ...(res.ops.length > 40 ? ["  …"] : []),
  ];
  if (inconsistent) {
    return {
      outputs: [{ label: "Solution", value: "No solution", primary: true, note: "The equations contradict each other (a row reduces to 0 = non-zero)." }, { label: "Rank", value: String(res.rank) }],
      steps,
    };
  }
  const free = vars.filter((_, j) => !res.pivots.includes(j));
  if (free.length) {
    const exprsOut = res.pivots.map((pc, ri) => {
      const row = res.m[ri];
      const terms = free
        .map((fv) => {
          const j = vars.indexOf(fv);
          const c = row[j].neg();
          if (c.isZero()) return "";
          return `${c.sign() < 0 ? "−" : "+"} ${c.abs().eq(Q.ONE) ? "" : show(c.abs())}${fv}`;
        })
        .filter(Boolean)
        .join(" ");
      return `${vars[pc]} = ${show(row[n])} ${terms}`.replace(/= 0 \+ /, "= ").replace(/= 0 − /, "= −");
    });
    return {
      outputs: [
        { label: "Solution", value: "Infinitely many solutions", primary: true, note: `Free variable${free.length > 1 ? "s" : ""}: ${free.join(", ")}` },
        { label: "Rank", value: `${res.rank} of ${n} unknowns` },
      ],
      table: { columns: ["Unknown", "Expression"], rows: exprsOut.map((e) => [e.split(" = ")[0], e.split(" = ").slice(1).join(" = ")]) },
      steps,
    };
  }
  const sol = vars.map((_, j) => res.m[res.pivots.indexOf(j)][n]);
  return {
    outputs: [
      { label: "Solution", value: vars.map((x, j) => `${x} = ${show(sol[j])}`).join(", "), primary: true },
      ...vars.map((x, j) => ({ label: `${x} (decimal)`, value: num(sol[j].toNumber(), 12) })),
    ],
    steps: [...steps, `Read off: ${vars.map((x, j) => `${x} = ${show(sol[j])}`).join(", ")}`],
    notes: exact ? ["Exact: all coefficients were rational, so the elimination used exact fractions."] : ["Some coefficients are irrational, so values are shown as decimals."],
  };
}

const spec: FormulaSpec = {
  modes: [
    { id: "poly", label: "Polynomial", fields: ["poly"] },
    { id: "general", label: "Any equation", fields: ["general", "lo", "hi"] },
    { id: "system", label: "System", fields: ["system"] },
  ],
  fields: [
    { id: "poly", label: "Polynomial equation", type: "text", mono: true, placeholder: "x^3 - 6x^2 + 11x - 6 = 0", hint: "Use ^ for powers. Implicit multiplication works: 3x^2." },
    { id: "general", label: "Equation in one variable", type: "text", mono: true, placeholder: "cos(x) = x", hint: "Functions: sin, cos, tan, exp, log (natural), sqrt, abs. Angles in radians." },
    { id: "lo", label: "Search from", type: "number", placeholder: "-10" },
    { id: "hi", label: "Search to", type: "number", placeholder: "10" },
    { id: "system", label: "Linear equations (one per line)", type: "text", multiline: true, mono: true, placeholder: "2x + 3y = 7\nx - y = 1", hint: "Up to 10 equations and unknowns." },
  ],
  defaults: { lo: "-10", hi: "10" },
  example: { poly: "x^3 - 6x^2 + 11x - 6 = 0", general: "cos(x) = x", lo: "-10", hi: "10", system: "2x + 3y - z = 5\nx - y + 2z = 3\n3x + y + z = 10" },
  compute: (v) => {
    try {
      if (v.mode === "poly") return solvePolynomial(v.str("poly"));
      if (v.mode === "general") {
        const lo = v.num("lo");
        const hi = v.num("hi");
        if (lo === null || hi === null) return null;
        return solveGeneral(v.str("general"), lo, hi);
      }
      return solveSystem(v.str("system"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return `Could not read the equation${msg ? `: ${msg}` : "."}`;
    }
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
