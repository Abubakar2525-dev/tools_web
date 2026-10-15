"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";

const mapUnits = [
  { value: "cm", label: "cm", factor: 0.01 },
  { value: "mm", label: "mm", factor: 0.001 },
  { value: "in", label: "inches", factor: 0.0254 },
];
const realUnits = [
  { value: "km", label: "km", factor: 1000 },
  { value: "m", label: "m", factor: 1 },
  { value: "mi", label: "miles", factor: 1609.344 },
  { value: "ft", label: "feet", factor: 0.3048 },
];

function realOut(m: number) {
  return [
    { label: "In kilometers", value: `${num(m / 1000, 6)} km` },
    { label: "In meters", value: `${num(m, 6)} m` },
    { label: "In miles", value: `${num(m / 1609.344, 6)} mi` },
    { label: "In feet", value: `${num(m / 0.3048, 6)} ft` },
  ];
}

function verbal(N: number) {
  return `1 cm = ${num(N / 100000, 6)} km · 1 in = ${num(N / 63360, 6)} mi`;
}

const spec: FormulaSpec = {
  lead: (
    <>
      A scale of <strong>1 : N</strong> means one unit on the map is N of the same units on the ground.
    </>
  ),
  modes: [
    { id: "toReal", label: "Map to real", fields: ["N", "map"] },
    { id: "toMap", label: "Real to map", fields: ["N", "real"] },
    { id: "scale", label: "Find the scale", fields: ["map", "real"] },
  ],
  fields: [
    { id: "N", label: "Scale denominator N (1 : N)", type: "number", gt: 0, placeholder: "25000" },
    { id: "map", label: "Distance on the map", type: "number", gt: 0, units: mapUnits },
    { id: "real", label: "Distance on the ground", type: "number", gt: 0, units: realUnits },
  ],
  example: { __mode: "toReal", N: "25000", map: "8.4", "map:unit": "cm" },
  compute: (v) => {
    if (v.mode === "toReal") {
      const N = v.num("N") as number;
      const map = v.num("map") as number;
      const real = map * N;
      return {
        outputs: [{ label: "Real distance", value: real >= 1000 ? `${num(real / 1000, 6)} km` : `${num(real, 6)} m`, primary: true, note: verbal(N) }, ...realOut(real)],
        steps: [`Real = map × N = ${num(map, 6)} m × ${num(N)} = ${num(real, 6)} m`],
      };
    }
    if (v.mode === "toMap") {
      const N = v.num("N") as number;
      const real = v.num("real") as number;
      const map = real / N;
      return {
        outputs: [
          { label: "Map distance", value: `${num(map * 100, 6)} cm`, primary: true, note: verbal(N) },
          { label: "In millimeters", value: `${num(map * 1000, 6)} mm` },
          { label: "In inches", value: `${num(map / 0.0254, 6)} in` },
        ],
        steps: [`Map = real ÷ N = ${num(real, 6)} m ÷ ${num(N)} = ${num(map, 6)} m = ${num(map * 100, 6)} cm`],
      };
    }
    const map = v.num("map") as number;
    const real = v.num("real") as number;
    const N = real / map;
    return {
      outputs: [
        { label: "Scale", value: `1 : ${num(Math.round(N))}`, primary: true, note: verbal(N) },
        { label: "Exact ratio", value: `1 : ${num(N, 8)}` },
      ],
      steps: [`N = real ÷ map = ${num(real, 6)} m ÷ ${num(map, 6)} m = ${num(N, 8)}`],
      notes: ["Measure along a straight line. Map projections distort scale slightly away from their reference lines, so long distances on small-scale maps are approximate."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
