"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { Figure } from "./ui";

/** WHO adult BMI classification (kg/m²). */
const CATS = [
  { max: 16, label: "Underweight (severe thinness)" },
  { max: 17, label: "Underweight (moderate thinness)" },
  { max: 18.5, label: "Underweight (mild thinness)" },
  { max: 25, label: "Normal weight" },
  { max: 30, label: "Overweight (pre-obese)" },
  { max: 35, label: "Obesity class I" },
  { max: 40, label: "Obesity class II" },
  { max: Infinity, label: "Obesity class III" },
];

const category = (bmi: number) => CATS.find((c) => bmi < c.max)?.label ?? "";

function Gauge({ bmi }: { bmi: number }) {
  const lo = 12,
    hi = 45,
    W = 520,
    x0 = 20,
    w = W - 40;
  const sx = (b: number) => x0 + ((Math.min(Math.max(b, lo), hi) - lo) / (hi - lo)) * w;
  const bands = [
    { a: lo, b: 18.5, label: "Under", cls: "fill-sunken" },
    { a: 18.5, b: 25, label: "Normal", cls: "fill-accent-soft" },
    { a: 25, b: 30, label: "Over", cls: "fill-sunken" },
    { a: 30, b: hi, label: "Obese", cls: "fill-line-strong" },
  ];
  return (
    <Figure viewBox={`0 0 ${W} 90`} title="BMI scale" desc={`Your BMI of ${num(bmi, 3)} falls in: ${category(bmi)}. Cut-offs at 18.5, 25 and 30.`}>
      {bands.map((b) => (
        <g key={b.label}>
          <rect x={sx(b.a)} y={30} width={sx(b.b) - sx(b.a)} height={22} className={`${b.cls} stroke-line-strong`} />
          <text x={(sx(b.a) + sx(b.b)) / 2} y={68} textAnchor="middle" className="fill-ink-2 text-[11px]">
            {b.label}
          </text>
        </g>
      ))}
      {[18.5, 25, 30].map((t) => (
        <text key={t} x={sx(t)} y={84} textAnchor="middle" className="fill-muted text-[10px]">
          {t}
        </text>
      ))}
      <polygon points={`${sx(bmi) - 7},14 ${sx(bmi) + 7},14 ${sx(bmi)},28`} className="fill-ink" />
      <text x={sx(bmi)} y={10} textAnchor="middle" className="fill-ink text-[11px] font-semibold">
        {num(bmi, 3)}
      </text>
    </Figure>
  );
}

const spec: FormulaSpec = {
  lead: (
    <>
      <strong>BMI = weight (kg) ÷ height (m)²</strong>. For adults aged 20 and over. It is a screening number, not a diagnosis.
    </>
  ),
  modes: [
    { id: "metric", label: "Metric", fields: ["cm", "kg"] },
    { id: "us", label: "US units", fields: ["ft", "in", "lb"] },
  ],
  fields: [
    { id: "cm", label: "Height", type: "number", suffix: "cm", gt: 50, max: 272 },
    { id: "kg", label: "Weight", type: "number", suffix: "kg", gt: 10, max: 650 },
    { id: "ft", label: "Height (feet)", type: "number", suffix: "ft", min: 1, max: 8, integer: true },
    { id: "in", label: "Height (inches)", type: "number", suffix: "in", min: 0, max: 11.99, optional: true },
    { id: "lb", label: "Weight", type: "number", suffix: "lb", gt: 20, max: 1400 },
  ],
  example: { __mode: "metric", cm: "175", kg: "72" },
  compute: (v) => {
    let m: number, kg: number;
    const us = v.mode === "us";
    if (us) {
      m = ((v.num("ft") as number) * 12 + (v.num("in") ?? 0)) * 0.0254;
      kg = (v.num("lb") as number) * 0.45359237;
    } else {
      m = (v.num("cm") as number) / 100;
      kg = v.num("kg") as number;
    }
    const bmi = kg / (m * m);
    const lowKg = 18.5 * m * m;
    const highKg = 24.9 * m * m;
    const range = us ? `${num(lowKg / 0.45359237, 3)} to ${num(highKg / 0.45359237, 3)} lb` : `${num(lowKg, 3)} to ${num(highKg, 3)} kg`;
    return {
      outputs: [
        { label: "BMI", value: num(Math.round(bmi * 10) / 10, 4), primary: true, note: category(bmi) },
        { label: "WHO category", value: category(bmi) },
        { label: "Healthy weight range for this height", value: range },
        { label: "BMI Prime (BMI ÷ 25)", value: num(bmi / 25, 3) },
      ],
      steps: [
        us ? `Height = ${num(m / 0.0254, 4)} in = ${num(m, 4)} m; weight = ${num(kg, 5)} kg` : `Height = ${num(m, 4)} m`,
        `BMI = ${num(kg, 5)} ÷ ${num(m, 4)}² = ${num(bmi, 5)}`,
        `Healthy range = 18.5 × ${num(m, 4)}² to 24.9 × ${num(m, 4)}²`,
      ],
      visual: <Gauge bmi={bmi} />,
      notes: [
        "BMI does not separate muscle from fat or show where fat is stored, so it can misclassify athletes, older adults and some ethnic groups. It is not for children or teens (they use age and sex percentiles) or during pregnancy. Talk to a health professional about your own situation.",
      ],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
