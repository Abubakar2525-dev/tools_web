"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { Q } from "./lib/rational";
import { quadraticExact } from "./lib/roots";
import { PlotFrame } from "./ui";

const paren = (q: Q) => (q.sign() < 0 ? `(${q})` : q.toString());

/** a x² + b x + c with tidy signs, e.g. "2x² − 3x + 1". */
function polyText(a: Q, b: Q, c: Q): string {
  const term = (k: Q, v: string, first: boolean) => {
    if (k.isZero()) return "";
    const abs = k.abs();
    const coef = v && abs.eq(Q.ONE) ? "" : abs.isInt() ? abs.toString() : `(${abs})`;
    const sign = k.sign() < 0 ? (first ? "−" : " − ") : first ? "" : " + ";
    return `${sign}${coef}${v}`;
  };
  const s = term(a, "x²", true) + term(b, "x", false) + term(c, "", false);
  return s || "0";
}

/** Linear factor (qx − p) for root p/q. */
const factor = (r: Q) => {
  const p = r.n;
  const q = r.d;
  const lead = q === BigInt(1) ? "x" : `${q}x`;
  if (p === BigInt(0)) return lead === "x" ? "x" : lead;
  return `(${lead} ${p < BigInt(0) ? "+" : "−"} ${(p < BigInt(0) ? -p : p).toString()})`;
};

function Graph({ a, b, c, roots, vertex }: { a: number; b: number; c: number; roots: number[]; vertex: [number, number] }) {
  const [h, k] = vertex;
  const spread = Math.max(roots.length === 2 ? Math.abs(roots[1] - roots[0]) : 0, 2 / Math.sqrt(Math.abs(a)), 2);
  const xMin = h - spread * 1.1;
  const xMax = h + spread * 1.1;
  const f = (x: number) => a * x * x + b * x + c;
  const ys = [f(xMin), f(xMax), k, 0];
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const padY = (yMax - yMin || 1) * 0.1;
  yMin -= padY;
  yMax += padY;
  const pts = Array.from({ length: 121 }, (_, i) => xMin + ((xMax - xMin) * i) / 120);
  const desc = `Parabola opening ${a > 0 ? "upward" : "downward"} with vertex at (${num(h, 6)}, ${num(k, 6)})${
    roots.length ? ` crossing the x-axis at ${roots.map((r) => num(r, 6)).join(" and ")}` : " and no x-intercepts"
  }.`;
  return (
    <PlotFrame xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} title="Graph of the quadratic" desc={desc}>
      {(sx, sy) => (
        <>
          <line x1={sx(h)} x2={sx(h)} y1={sy(yMin)} y2={sy(yMax)} stroke="var(--muted)" strokeDasharray="4 4" />
          <polyline fill="none" stroke="var(--accent)" strokeWidth={2.5} points={pts.map((x) => `${sx(x)},${sy(f(x))}`).join(" ")} />
          <circle cx={sx(h)} cy={sy(k)} r={5} fill="var(--ink)" />
          {roots.map((r, i) => (
            <circle key={i} cx={sx(r)} cy={sy(0)} r={5} fill="var(--surface)" stroke="var(--accent-strong)" strokeWidth={2.5} />
          ))}
        </>
      )}
    </PlotFrame>
  );
}

const spec: FormulaSpec = {
  lead: "Solves ax² + bx + c = 0. Coefficients can be integers, decimals or fractions like 3/4.",
  fields: [
    { id: "a", label: "a", type: "text", placeholder: "1" },
    { id: "b", label: "b", type: "text", placeholder: "−3" },
    { id: "c", label: "c", type: "text", placeholder: "2" },
  ],
  example: { a: "2", b: "3", c: "-1" },
  compute: (v) => {
    const a = Q.parse(v.str("a"));
    const b = Q.parse(v.str("b"));
    const c = Q.parse(v.str("c"));
    if (!a || !b || !c) return `Coefficient ${!a ? "a" : !b ? "b" : "c"} is not a valid number or fraction.`;
    if (a.isZero()) {
      if (b.isZero()) return "With a = 0 and b = 0 there is no variable left to solve for.";
      const x = c.neg().div(b);
      return {
        outputs: [{ label: "x (linear, since a = 0)", value: x.toString(), primary: true, note: `≈ ${num(x.toNumber(), 12)}` }],
        steps: [`a = 0, so the equation is linear: ${polyText(Q.ZERO, b, c)} = 0`, `x = −c / b = ${x}`],
      };
    }
    const r = quadraticExact(a, b, c);
    const disc = b.mul(b).sub(Q.int(4).mul(a).mul(c));
    const [h, k] = r.vertex;
    const steps = [
      `Equation: ${polyText(a, b, c)} = 0`,
      `Discriminant D = b² − 4ac = ${paren(b)}² − 4 × ${paren(a)} × ${paren(c)} = ${disc}`,
      disc.sign() > 0 ? "D > 0: two distinct real roots" : disc.isZero() ? "D = 0: one repeated real root" : "D < 0: two complex conjugate roots",
      `x = (−b ± √D) / 2a = (${b.neg()} ± √${paren(disc)}) / ${a.mul(Q.int(2))}`,
    ];
    if (!a.isInt() || !b.isInt() || !c.isInt()) steps.push(`Scaled to whole coefficients with the same roots: ${r.A}x² + ${r.B}x + ${r.C}`.replace(/\+ -/g, "− "));
    steps.push(`Simplified: x = ${r.combined}`);
    steps.push(`Vertex: x = −b / 2a = ${h}, y = c − b² / 4a = ${k}`);
    let factored = "Not factorable over the rationals";
    if (r.rational) {
      const [r1, r2] = r.rational;
      const lead = a.div(Q.int(Number(r1.d * r2.d)));
      const leadText = lead.eq(Q.ONE) ? "" : lead.eq(Q.ONE.neg()) ? "−" : lead.isInt() ? lead.toString() : `(${lead})`;
      factored = r.kind === "double" ? `${leadText}${factor(r1)}²` : `${leadText}${factor(r1)}${factor(r2)}`;
    }
    const num0 = r.numeric;
    const realRoots = r.kind === "complex" ? [] : r.kind === "double" ? [num0[0].re] : [num0[0].re, num0[1].re];
    const decimals =
      r.kind === "complex"
        ? `${num(num0[0].re, 10)} ± ${num(Math.abs(num0[0].im), 10)}i`
        : realRoots.map((x) => num(x, 12)).join(", ");
    return {
      outputs: [
        { label: r.kind === "double" ? "Root (repeated)" : "Roots", value: r.kind === "double" ? `x = ${r.exact[0]}` : `x = ${r.exact[0]}, ${r.exact[1]}`, primary: true, note: `Decimal: ${decimals}` },
        { label: "Discriminant", value: disc.toString() },
        { label: "Root type", value: r.kind === "two-rational" ? "2 rational" : r.kind === "two-irrational" ? "2 irrational" : r.kind === "double" ? "1 repeated" : "2 complex" },
        { label: "Vertex", value: `(${h}, ${k})` },
        { label: "Axis of symmetry", value: `x = ${h}` },
        { label: "y-intercept", value: `(0, ${c})` },
        { label: "Factored form", value: factored },
        { label: "Opens", value: a.sign() > 0 ? "Upward (minimum)" : "Downward (maximum)" },
      ],
      steps,
      visual: <Graph a={a.toNumber()} b={b.toNumber()} c={c.toNumber()} roots={realRoots} vertex={[h.toNumber(), k.toNumber()]} />,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
