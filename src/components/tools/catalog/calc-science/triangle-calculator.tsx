"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { lengthChoices } from "./lib/units";
import { describe, solveAAS, solveASA, solveSAS, solveSSA, solveSSS, vertices, type Triangle, type TriangleInfo } from "./lib/triangle";
import { Figure, mutedText, stroke, textStyle } from "./shared";

const angleHint = "Angle opposite the side with the same letter.";

function TriangleSvg({ t, unit, index }: { t: TriangleInfo; unit: string; index?: number }) {
  const W = 300;
  const H = 210;
  const v = vertices(t);
  const xs = [v.A[0], v.B[0], v.C[0]];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = v.C[1];
  const s = Math.min((W - 70) / (maxX - minX), (H - 60) / maxY);
  const ox = (W - (maxX - minX) * s) / 2;
  const oy = (H - maxY * s) / 2 + maxY * s;
  const P = (p: [number, number]): [number, number] => [ox + (p[0] - minX) * s, oy - p[1] * s];
  const [A, B, C] = [P(v.A), P(v.B), P(v.C)];
  const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const cx = (A[0] + B[0] + C[0]) / 3;
  const cy = (A[1] + B[1] + C[1]) / 3;
  const away = (p: [number, number], d = 14): [number, number] => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / len) * d, p[1] + (dy / len) * d + 4];
  };
  const u = unit === "u" ? "" : ` ${unit}`;
  const label = `${index ? `Solution ${index}: ` : ""}triangle drawn to scale with a = ${num(t.a, 5)}${u}, b = ${num(t.b, 5)}${u}, c = ${num(t.c, 5)}${u}, angles A = ${num((t.A * 180) / Math.PI, 5)}°, B = ${num((t.B * 180) / Math.PI, 5)}°, C = ${num((t.C * 180) / Math.PI, 5)}°`;
  return (
    <Figure label={label} viewBox={`0 0 ${W} ${H}`} caption={index ? `Solution ${index}, to scale` : "Drawn to scale"}>
      <polygon points={`${A.join(",")} ${B.join(",")} ${C.join(",")}`} {...stroke} strokeLinejoin="round" />
      {(
        [
          ["A", A],
          ["B", B],
          ["C", C],
        ] as const
      ).map(([n, p]) => {
        const [x, y] = away(p);
        return (
          <text key={n} x={x} y={y} textAnchor="middle" {...textStyle} fontWeight={600}>
            {n}
          </text>
        );
      })}
      {(
        [
          ["a", mid(B, C)],
          ["b", mid(A, C)],
          ["c", mid(A, B)],
        ] as const
      ).map(([n, p]) => {
        const [x, y] = away(p, 12);
        return (
          <text key={n} x={x} y={y} textAnchor="middle" {...mutedText} fontStyle="italic">
            {n}
          </text>
        );
      })}
    </Figure>
  );
}

const spec: FormulaSpec = {
  modes: [
    { id: "sss", label: "SSS", fields: ["unit", "ang", "a", "b", "c"] },
    { id: "sas", label: "SAS", fields: ["unit", "ang", "b", "A", "c"] },
    { id: "asa", label: "ASA", fields: ["unit", "ang", "A", "c", "B"] },
    { id: "aas", label: "AAS", fields: ["unit", "ang", "A", "B", "a"] },
    { id: "ssa", label: "SSA", fields: ["unit", "ang", "a", "b", "A"] },
  ],
  fields: [
    { id: "unit", label: "Length unit", type: "select", options: lengthChoices },
    {
      id: "ang",
      label: "Angle unit",
      type: "select",
      options: [
        { value: "deg", label: "Degrees" },
        { value: "rad", label: "Radians" },
      ],
    },
    { id: "a", label: "Side a", type: "number", gt: 0 },
    { id: "b", label: "Side b", type: "number", gt: 0 },
    { id: "c", label: "Side c", type: "number", gt: 0 },
    { id: "A", label: "Angle A", type: "number", gt: 0, hint: angleHint },
    { id: "B", label: "Angle B", type: "number", gt: 0, hint: angleHint },
  ],
  defaults: { unit: "u" },
  example: { unit: "u", ang: "deg", a: "6", b: "8", c: "10", A: "35", B: "65" },
  lead: (
    <p>
      Sides <em>a</em>, <em>b</em>, <em>c</em> sit opposite angles <em>A</em>, <em>B</em>, <em>C</em>. SAS uses the angle between
      sides b and c; ASA uses the side c between angles A and B; SSA uses angle A opposite side a, which can give two triangles.
    </p>
  ),
  compute: (v) => {
    const toRad = (x: number) => (v.str("ang") === "rad" ? x : (x * Math.PI) / 180);
    const n = (id: string) => v.num(id)!;
    let res;
    switch (v.mode) {
      case "sss":
        res = solveSSS(n("a"), n("b"), n("c"));
        break;
      case "sas":
        res = solveSAS(n("b"), toRad(n("A")), n("c"));
        break;
      case "asa":
        res = solveASA(toRad(n("A")), n("c"), toRad(n("B")));
        break;
      case "aas":
        res = solveAAS(toRad(n("A")), toRad(n("B")), n("a"));
        break;
      default:
        res = solveSSA(n("a"), n("b"), toRad(n("A")));
    }
    if (!res.ok) return res.reason;
    const unit = v.str("unit");
    const u = unit === "u" ? "" : ` ${unit}`;
    const u2 = unit === "u" ? " sq units" : ` ${unit}²`;
    const infos = res.solutions.map((t: Triangle) => describe(t));
    const dg = (r: number) => `${num((r * 180) / Math.PI, 7)}°`;
    const rows: [string, (t: TriangleInfo) => string][] = [
      ["Side a", (t) => num(t.a) + u],
      ["Side b", (t) => num(t.b) + u],
      ["Side c", (t) => num(t.c) + u],
      ["Angle A", (t) => dg(t.A)],
      ["Angle B", (t) => dg(t.B)],
      ["Angle C", (t) => dg(t.C)],
      ["Area", (t) => num(t.area) + u2],
      ["Perimeter", (t) => num(t.perimeter) + u],
      ["Height to a", (t) => num(t.ha) + u],
      ["Height to b", (t) => num(t.hb) + u],
      ["Height to c", (t) => num(t.hc) + u],
      ["Inradius", (t) => num(t.inradius) + u],
      ["Circumradius", (t) => num(t.circumradius) + u],
      ["Type", (t) => `${t.bySides}, ${t.byAngles}`],
    ];
    const t0 = infos[0];
    const two = infos.length === 2;
    const steps: string[] = [];
    if (v.mode === "sss") {
      steps.push(`A = arccos((b² + c² − a²) / 2bc) = ${dg(t0.A)}`, `B = arccos((a² + c² − b²) / 2ac) = ${dg(t0.B)}`, `C = 180° − A − B = ${dg(t0.C)}`);
    } else if (v.mode === "sas") {
      steps.push(`a = √(b² + c² − 2bc·cos A) = ${num(t0.a)}`, `B = arccos((a² + c² − b²) / 2ac) = ${dg(t0.B)}`, `C = 180° − A − B = ${dg(t0.C)}`);
    } else if (v.mode === "asa" || v.mode === "aas") {
      steps.push(`C = 180° − A − B = ${dg(t0.C)}`, `Law of sines: a / sin A = b / sin B = c / sin C = ${num(t0.a / Math.sin(t0.A))}`, `a = ${num(t0.a)}, b = ${num(t0.b)}, c = ${num(t0.c)}`);
    } else {
      steps.push(`sin B = b·sin A / a = ${num(Math.sin(t0.B))}`);
      if (two) steps.push(`B₁ = arcsin(${num(Math.sin(t0.B))}) = ${dg(infos[0].B)}`, `B₂ = 180° − B₁ = ${dg(infos[1].B)} (also valid because a < b)`);
      else steps.push(`B = ${dg(t0.B)}`);
      steps.push(...infos.map((t, i) => `${two ? `Solution ${i + 1}: ` : ""}C = 180° − A − B = ${dg(t.C)}, c = a·sin C / sin A = ${num(t.c)}`));
    }
    steps.push(...infos.map((t, i) => `${two ? `Solution ${i + 1}: ` : ""}Area (Heron) = √(s(s − a)(s − b)(s − c)) = ${num(t.area)}, s = ${num(t.perimeter / 2)}`));
    return {
      outputs: two
        ? [
            { label: "Ambiguous case", value: "2 triangles", primary: true, note: "Both triangles below satisfy the given side-side-angle values." },
            { label: "Area, solution 1", value: num(infos[0].area) + u2 },
            { label: "Area, solution 2", value: num(infos[1].area) + u2 },
          ]
        : [
            { label: "Area", value: num(t0.area) + u2, primary: true, note: `${t0.bySides[0].toUpperCase()}${t0.bySides.slice(1)}, ${t0.byAngles} triangle` },
            { label: "Perimeter", value: num(t0.perimeter) + u },
            { label: "Side a", value: num(t0.a) + u },
            { label: "Side b", value: num(t0.b) + u },
            { label: "Side c", value: num(t0.c) + u },
            { label: "Angles A, B, C", value: `${num((t0.A * 180) / Math.PI, 5)}°, ${num((t0.B * 180) / Math.PI, 5)}°, ${num((t0.C * 180) / Math.PI, 5)}°` },
          ],
      table: {
        caption: two ? "Both solutions" : "All values",
        columns: two ? ["Quantity", "Solution 1", "Solution 2"] : ["Quantity", "Value"],
        rows: rows.map(([label, f]) => [label, ...infos.map(f)]),
      },
      steps,
      visual: (
        <div className={two ? "grid gap-3 sm:grid-cols-2" : ""}>
          {infos.map((t, i) => (
            <TriangleSvg key={i} t={t} unit={unit} index={two ? i + 1 : undefined} />
          ))}
        </div>
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
