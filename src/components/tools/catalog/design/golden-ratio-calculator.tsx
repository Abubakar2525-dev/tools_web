"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";

const PHI = (1 + Math.sqrt(5)) / 2;

/** Golden rectangle subdivided into squares, with the quarter-circle spiral. */
function GoldenRect({ long, short, unit }: { long: number; short: number; unit: string }) {
  const W = 320;
  const H = W / PHI;
  let x = 10;
  let y = 10;
  let w = W;
  let h = H;
  const squares: { x: number; y: number; s: number }[] = [];
  let d = `M ${x} ${y + h}`;
  for (let i = 0; i < 9; i++) {
    const dir = i % 4;
    if (dir === 0) {
      const s = h;
      squares.push({ x, y, s });
      d += ` A ${s} ${s} 0 0 1 ${x + s} ${y}`;
      x += s;
      w -= s;
    } else if (dir === 1) {
      const s = w;
      squares.push({ x, y, s });
      d += ` A ${s} ${s} 0 0 1 ${x + s} ${y + s}`;
      y += s;
      h -= s;
    } else if (dir === 2) {
      const s = h;
      squares.push({ x: x + w - s, y, s });
      d += ` A ${s} ${s} 0 0 1 ${x + w - s} ${y + s}`;
      w -= s;
    } else {
      const s = w;
      squares.push({ x, y: y + h - s, s });
      d += ` A ${s} ${s} 0 0 1 ${x} ${y + h - s}`;
      h -= s;
    }
  }
  return (
    <figure>
      <svg viewBox={`0 0 ${W + 20} ${H + 44}`} className="w-full max-w-[460px]" role="img" aria-label={`Golden rectangle: ${num(long, 6)} ${unit} by ${num(short, 6)} ${unit}, split into a square and a smaller golden rectangle, with the golden spiral`}>
        <rect x="10" y="10" width={W} height={H} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
        {squares.map((s, i) => (
          <rect key={i} x={s.x} y={s.y} width={s.s} height={s.s} fill="none" stroke="var(--accent)" strokeWidth="1" opacity={0.7} />
        ))}
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth="1.8" />
        <text x={10 + H / 2} y={H + 32} textAnchor="middle" fontSize="13" fill="var(--ink)">
          a = {num(short, 5)}
        </text>
        <text x={10 + H + (W - H) / 2} y={H + 32} textAnchor="middle" fontSize="13" fill="var(--ink-2)">
          b = {num(long - short, 5)}
        </text>
      </svg>
    </figure>
  );
}

const spec: FormulaSpec = {
  modes: [
    { id: "total", label: "Split a length", fields: ["total", "unit"] },
    { id: "long", label: "From the longer part", fields: ["a", "unit"] },
    { id: "short", label: "From the shorter part", fields: ["b", "unit"] },
  ],
  fields: [
    { id: "total", label: "Total length", type: "number", gt: 0, placeholder: "960" },
    { id: "a", label: "Longer part (a)", type: "number", gt: 0, placeholder: "593.3" },
    { id: "b", label: "Shorter part (b)", type: "number", gt: 0, placeholder: "366.7" },
    { id: "unit", label: "Unit label", type: "text", placeholder: "px", optional: true, hint: "Only used for display." },
  ],
  defaults: { total: "960", unit: "px" },
  example: { total: "1200", unit: "px" },
  lead: (
    <>
      φ = (1 + √5) ÷ 2 ≈ 1.6180339887. A length is split in the golden ratio when total ÷ a = a ÷ b = φ.
    </>
  ),
  compute: (v) => {
    const u = v.str("unit").trim();
    let total: number;
    if (v.mode === "total") total = v.num("total")!;
    else if (v.mode === "long") total = v.num("a")! * PHI;
    else total = v.num("b")! * PHI * PHI;
    const a = total / PHI;
    const b = total - a;
    const sfx = u ? ` ${u}` : "";
    const steps =
      v.mode === "total"
        ? [`a = total ÷ φ = ${num(total)} ÷ 1.6180339887 = ${num(a, 8)}`, `b = total − a = ${num(total)} − ${num(a, 8)} = ${num(b, 8)}`]
        : v.mode === "long"
          ? [`total = a × φ = ${num(v.num("a")!)} × 1.6180339887 = ${num(total, 8)}`, `b = a ÷ φ = ${num(b, 8)}`]
          : [`a = b × φ = ${num(v.num("b")!)} × 1.6180339887 = ${num(a, 8)}`, `total = a + b = ${num(total, 8)}`];
    const rows: (string | number)[][] = [];
    let len = total;
    for (let i = 0; i < 7; i++) {
      rows.push([i === 0 ? "Total" : `Section ${i}`, `${num(len, 6)}${sfx}`, `${num(len / PHI, 6)}${sfx}`]);
      len /= PHI;
    }
    return {
      outputs: [
        { label: "Longer part (a)", value: `${num(a, 8)}${sfx}`, primary: true, note: `Shorter part (b): ${num(b, 8)}${sfx}` },
        { label: "Shorter part (b)", value: `${num(b, 8)}${sfx}` },
        { label: "Total", value: `${num(total, 8)}${sfx}` },
        { label: "Share of a", value: `${num((a / total) * 100, 6)}%` },
        { label: "Golden rectangle", value: `${num(total, 6)} × ${num(a, 6)}` },
        { label: "Next size up", value: `${num(total * PHI, 6)}${sfx}` },
      ],
      steps,
      visual: <GoldenRect long={total} short={a} unit={u} />,
      table: { caption: "Successive golden sections (each row is the previous longer part)", columns: ["Length", "Value", "Its longer part"], rows },
      notes: ["The golden rectangle shown is total wide and a tall: removing an a × a square leaves a smaller golden rectangle, and so on."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
