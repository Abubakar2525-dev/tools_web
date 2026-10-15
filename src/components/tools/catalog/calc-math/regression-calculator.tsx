"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { parseNum } from "@/components/tools/kit";
import { linearRegression, type Regression } from "./lib/descriptive";
import { PlotFrame } from "./ui";

const MAX_POINTS = 5000;

function parsePairs(text: string): { xs: number[]; ys: number[] } | string {
  const xs: number[] = [];
  const ys: number[] = [];
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[\s,;\t]+/).filter(Boolean);
    if (parts.length !== 2) return `Line ${i + 1}: enter exactly two numbers (x and y).`;
    const x = parseNum(parts[0].replace(/−/g, "-"));
    const y = parseNum(parts[1].replace(/−/g, "-"));
    if (x === null || y === null) return `Line ${i + 1}: "${lines[i]}" is not two numbers.`;
    xs.push(x);
    ys.push(y);
  }
  return { xs, ys };
}

function Scatter({ r }: { r: Regression }) {
  const xs = r.residuals.map((p) => p.x);
  const ys = r.residuals.map((p) => p.y);
  let xMin = Math.min(...xs);
  let xMax = Math.max(...xs);
  let yMin = Math.min(...ys, ...r.residuals.map((p) => p.fit));
  let yMax = Math.max(...ys, ...r.residuals.map((p) => p.fit));
  const px = (xMax - xMin || 1) * 0.08;
  const py = (yMax - yMin || 1) * 0.1;
  xMin -= px;
  xMax += px;
  yMin -= py;
  yMax += py;
  const line = (x: number) => r.intercept + r.slope * x;
  return (
    <PlotFrame
      xMin={xMin}
      xMax={xMax}
      yMin={yMin}
      yMax={yMax}
      title="Scatter plot with least-squares line"
      desc={`${r.n} points with fitted line y = ${num(r.intercept, 6)} + ${num(r.slope, 6)}x; dashed segments show residuals.`}
    >
      {(sx, sy) => (
        <>
          {r.n <= 500 &&
            r.residuals.map((p, i) => (
              <line key={`r${i}`} x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y)} y2={sy(p.fit)} stroke="var(--muted)" strokeDasharray="3 3" />
            ))}
          <line x1={sx(xMin)} y1={sy(line(xMin))} x2={sx(xMax)} y2={sy(line(xMax))} stroke="var(--accent)" strokeWidth={2.5} />
          {r.residuals.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill="var(--ink)" fillOpacity={0.8} />
          ))}
        </>
      )}
    </PlotFrame>
  );
}

const spec: FormulaSpec = {
  fields: [
    {
      id: "data",
      label: "Data points (x, y)",
      type: "text",
      multiline: true,
      mono: true,
      placeholder: "1, 2\n2, 4\n3, 5\n4, 4\n5, 5",
      hint: "One point per line: x and y separated by a comma, space or tab (paste two spreadsheet columns).",
    },
    { id: "px", label: "Predict y at x", type: "number", optional: true, placeholder: "6" },
  ],
  example: { data: "1, 2\n2, 4\n3, 5\n4, 4\n5, 5", px: "6" },
  compute: (v) => {
    const parsed = parsePairs(v.str("data"));
    if (typeof parsed === "string") return parsed;
    if (parsed.xs.length > MAX_POINTS) return `At most ${MAX_POINTS.toLocaleString("en-US")} points.`;
    let r: Regression;
    try {
      r = linearRegression(parsed.xs, parsed.ys);
    } catch (e) {
      return e instanceof Error ? e.message : "Could not fit a line.";
    }
    const px = v.num("px");
    const sign = r.intercept < 0 ? "−" : "+";
    const eq = `ŷ = ${num(r.slope, 8)}x ${sign} ${num(Math.abs(r.intercept), 8)}`;
    const pFmt = r.pSlope < 1e-6 ? r.pSlope.toExponential(3) : num(r.pSlope, 6);
    return {
      outputs: [
        { label: "Regression line", value: eq, primary: true, note: px !== null ? `At x = ${num(px)}: ŷ = ${num(r.intercept + r.slope * px, 10)}` : undefined },
        { label: "Slope (b)", value: num(r.slope, 10) },
        { label: "Intercept (a)", value: num(r.intercept, 10) },
        { label: "Correlation r", value: Number.isFinite(r.r) ? num(r.r, 8) : "undefined" },
        { label: "R²", value: Number.isFinite(r.r2) ? num(r.r2, 8) : "undefined" },
        { label: "SE of slope", value: num(r.seSlope, 8) },
        { label: `t (df = ${r.df})`, value: Number.isFinite(r.tSlope) ? num(r.tSlope, 8) : "∞ (perfect fit)" },
        { label: "p-value (slope ≠ 0)", value: pFmt },
        { label: "Residual SE", value: num(r.se, 8) },
        { label: "Points (n)", value: String(r.n) },
      ],
      visual: <Scatter r={r} />,
      table: {
        caption: r.n > 200 ? "Residuals (first 200 points)" : "Residuals",
        columns: ["x", "y", "ŷ", "Residual"],
        rows: r.residuals.slice(0, 200).map((p) => [num(p.x, 10), num(p.y, 10), num(p.fit, 10), num(p.res, 8)]),
      },
      steps: [
        `x̄ = ${num(r.meanX, 10)}, ȳ = ${num(r.meanY, 10)}`,
        `Sxx = Σ(x − x̄)² = ${num(r.sxx, 10)}, Sxy = Σ(x − x̄)(y − ȳ) = ${num(r.sxy, 10)}, Syy = ${num(r.syy, 10)}`,
        `b = Sxy / Sxx = ${num(r.slope, 10)}`,
        `a = ȳ − b·x̄ = ${num(r.intercept, 10)}`,
        `r = Sxy / √(Sxx·Syy) = ${Number.isFinite(r.r) ? num(r.r, 8) : "undefined"}; R² = 1 − SSE/Syy = ${Number.isFinite(r.r2) ? num(r.r2, 8) : "undefined"}`,
        `SE(b) = √(SSE/(n − 2)) / √Sxx = ${num(r.seSlope, 8)}; t = b / SE(b) = ${Number.isFinite(r.tSlope) ? num(r.tSlope, 8) : "∞"}`,
        `Two-sided p from the t distribution with ${r.df} df = ${pFmt}`,
      ],
      notes: ["Least squares assumes a straight-line relationship with independent, roughly normal residuals of constant spread. Check the residuals for patterns."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
