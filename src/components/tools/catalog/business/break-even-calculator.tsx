"use client";

import { FormulaTool, fixed, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { breakEven } from "./lib/calc";

function Chart({ fixedCost, price, variable, beUnits, expected }: { fixedCost: number; price: number; variable: number; beUnits: number; expected: number | null }) {
  const W = 560;
  const H = 300;
  const pad = { l: 64, r: 16, t: 16, b: 40 };
  const maxX = Math.max(beUnits * 2, expected ? expected * 1.15 : 0, 1);
  const maxY = Math.max(price * maxX, fixedCost + variable * maxX) * 1.05;
  const x = (u: number) => pad.l + (u / maxX) * (W - pad.l - pad.r);
  const y = (val: number) => H - pad.b - (val / maxY) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const short = (n: number) => (Math.abs(n) >= 1e6 ? `${num(n / 1e6, 3)}M` : Math.abs(n) >= 1e3 ? `${num(n / 1e3, 3)}k` : num(n, 3));
  const beRevenue = beUnits * price;
  return (
    <figure className="rounded-xl bg-sunken p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Break-even chart. Revenue and total cost lines cross at ${num(beUnits, 6)} units and ${fixed(beRevenue)} of revenue. Below that volume costs exceed revenue; above it the business makes a profit.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(maxY * t)} y2={y(maxY * t)} stroke="var(--line)" />
            <text x={pad.l - 8} y={y(maxY * t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {short(maxY * t)}
            </text>
            <text x={x(maxX * t)} y={H - pad.b + 18} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {short(maxX * t)}
            </text>
          </g>
        ))}
        <text x={(W + pad.l) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--muted)">
          Units sold
        </text>
        <polygon points={`${x(0)},${y(fixedCost)} ${x(beUnits)},${y(beRevenue)} ${x(0)},${y(0)}`} fill="var(--danger)" opacity="0.1" />
        <polygon points={`${x(beUnits)},${y(beRevenue)} ${x(maxX)},${y(price * maxX)} ${x(maxX)},${y(fixedCost + variable * maxX)}`} fill="var(--accent)" opacity="0.14" />
        <line x1={x(0)} x2={x(maxX)} y1={y(fixedCost)} y2={y(fixedCost)} stroke="var(--muted)" strokeDasharray="4 4" />
        <line x1={x(0)} x2={x(maxX)} y1={y(fixedCost)} y2={y(fixedCost + variable * maxX)} stroke="var(--danger)" strokeWidth="2" />
        <line x1={x(0)} x2={x(maxX)} y1={y(0)} y2={y(price * maxX)} stroke="var(--accent)" strokeWidth="2.5" />
        {expected !== null && (
          <line x1={x(expected)} x2={x(expected)} y1={y(0)} y2={y(maxY)} stroke="var(--ink)" strokeDasharray="2 4" />
        )}
        <circle cx={x(beUnits)} cy={y(beRevenue)} r="5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-5 bg-accent" /> Revenue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-5 bg-danger" /> Total cost
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0 w-5 border-t border-dashed border-muted" /> Fixed costs
        </span>
        <span>Circle: break-even point{expected !== null ? "; dotted line: expected sales" : ""}</span>
      </figcaption>
    </figure>
  );
}

const spec: FormulaSpec = {
  fields: [
    { id: "fixed", label: "Fixed costs for the period", type: "number", min: 0, hint: "Rent, salaries, insurance: costs that don't change with volume.", placeholder: "12000" },
    { id: "price", label: "Selling price per unit", type: "number", gt: 0, placeholder: "45" },
    { id: "variable", label: "Variable cost per unit", type: "number", min: 0, hint: "Materials, packaging, payment fees, shipping per unit.", placeholder: "18" },
    { id: "target", label: "Target profit", type: "number", min: 0, optional: true, hint: "Leave empty for the plain break-even point." },
    { id: "expected", label: "Expected unit sales", type: "number", min: 0, optional: true, hint: "Adds margin of safety and expected profit." },
  ],
  example: { fixed: "12000", price: "45", variable: "18", expected: "600" },
  compute: (v) => {
    const F = v.num("fixed");
    const p = v.num("price");
    const vc = v.num("variable");
    if (F === null || p === null || vc === null) return null;
    const target = v.num("target") ?? 0;
    const expected = v.num("expected");
    const be = breakEven(F, p, vc, target);
    if (!be) return "The price must be higher than the variable cost per unit, otherwise every sale adds to the loss and there is no break-even point.";
    const outputs = [
      { label: target ? "Units needed for the target profit" : "Break-even units", value: num(be.units, 10), primary: true, note: `Exact value ${num(be.exactUnits, 8)} units, rounded up to whole units` },
      { label: "Break-even revenue", value: fixed(be.revenue) },
      { label: "Contribution per unit", value: fixed(be.contribution) },
      { label: "Contribution margin ratio", value: `${num(be.cmRatio * 100, 6)}%` },
    ];
    const steps = [
      `Contribution per unit = price − variable cost = ${fixed(p)} − ${fixed(vc)} = ${fixed(be.contribution)}`,
      `Units = (fixed costs${target ? " + target profit" : ""}) ÷ contribution = ${fixed(F + target)} ÷ ${fixed(be.contribution)} = ${num(be.exactUnits, 8)}`,
      `Revenue = units × price = ${num(be.exactUnits, 8)} × ${fixed(p)} = ${fixed(be.revenue)}`,
    ];
    if (expected !== null) {
      const profit = expected * be.contribution - F;
      const plain = F / be.contribution;
      const safety = expected > 0 ? ((expected - plain) / expected) * 100 : 0;
      outputs.push({ label: "Profit at expected sales", value: fixed(profit) });
      outputs.push({ label: "Margin of safety", value: `${num(safety, 4)}%` });
      steps.push(`Profit at ${num(expected)} units = ${num(expected)} × ${fixed(be.contribution)} − ${fixed(F)} = ${fixed(profit)}`);
      steps.push(`Margin of safety = (expected − break-even) ÷ expected = ${num(safety, 4)}%`);
    }
    return {
      outputs,
      steps,
      visual: <Chart fixedCost={F} price={p} variable={vc} beUnits={F / be.contribution} expected={expected} />,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
