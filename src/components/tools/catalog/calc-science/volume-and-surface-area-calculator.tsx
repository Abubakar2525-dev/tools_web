"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { lengthChoices, lengthFactor } from "./lib/units";
import { apothem, cone, rectPyramid, regularPolygonArea, torus, type SolidResult } from "./lib/geometry";

const PI = Math.PI;

function solve(mode: string, n: (id: string) => number): SolidResult | string {
  switch (mode) {
    case "cube": {
      const a = n("edge");
      return { volume: a ** 3, surface: 6 * a * a, extra: [{ label: "Space diagonal", value: a * Math.sqrt(3), kind: "len" }], formula: ["V = a³", "A = 6a²"] };
    }
    case "cuboid": {
      const [l, w, h] = [n("length"), n("width"), n("height")];
      return {
        volume: l * w * h,
        surface: 2 * (l * w + l * h + w * h),
        extra: [{ label: "Space diagonal", value: Math.sqrt(l * l + w * w + h * h), kind: "len" }],
        formula: ["V = l·w·h", "A = 2(lw + lh + wh)"],
      };
    }
    case "sphere": {
      const r = n("radius");
      return { volume: (4 / 3) * PI * r ** 3, surface: 4 * PI * r * r, formula: ["V = 4/3 πr³", "A = 4πr²"] };
    }
    case "hemisphere": {
      const r = n("radius");
      return {
        volume: (2 / 3) * PI * r ** 3,
        surface: 3 * PI * r * r,
        lateral: 2 * PI * r * r,
        formula: ["V = 2/3 πr³", "A = 2πr² (curved) + πr² (flat base) = 3πr²"],
      };
    }
    case "cylinder": {
      const [r, h] = [n("radius"), n("height")];
      return { volume: PI * r * r * h, surface: 2 * PI * r * (r + h), lateral: 2 * PI * r * h, formula: ["V = πr²h", "A = 2πr(r + h)"] };
    }
    case "cone":
      return cone(n("radius"), n("height"));
    case "pyramid":
      return rectPyramid(n("length"), n("width"), n("height"));
    case "prism": {
      const [k, s, h] = [n("sides"), n("edge"), n("height")];
      const base = regularPolygonArea(k, s);
      return {
        volume: base * h,
        surface: 2 * base + k * s * h,
        lateral: k * s * h,
        extra: [
          { label: "Base area", value: base, kind: "area" },
          { label: "Base apothem", value: apothem(k, s), kind: "len" },
        ],
        formula: ["Base B = n·a² / (4 tan(π/n))", "V = B·h", "A = 2B + n·a·h"],
      };
    }
    case "torus": {
      const [R, r] = [n("major"), n("minor")];
      if (r > R) return "The tube radius (r) cannot be larger than the distance to its center (R); the shape would intersect itself.";
      return torus(R, r);
    }
  }
  return "Choose a shape.";
}

const spec: FormulaSpec = {
  modes: [
    { id: "cube", label: "Cube", fields: ["unit", "edge"] },
    { id: "cuboid", label: "Cuboid", fields: ["unit", "length", "width", "height"] },
    { id: "sphere", label: "Sphere", fields: ["unit", "radius"] },
    { id: "hemisphere", label: "Hemisphere", fields: ["unit", "radius"] },
    { id: "cylinder", label: "Cylinder", fields: ["unit", "radius", "height"] },
    { id: "cone", label: "Cone", fields: ["unit", "radius", "height"] },
    { id: "pyramid", label: "Pyramid", fields: ["unit", "length", "width", "height"] },
    { id: "prism", label: "Prism", fields: ["unit", "sides", "edge", "height"] },
    { id: "torus", label: "Torus", fields: ["unit", "major", "minor"] },
  ],
  fields: [
    { id: "unit", label: "Length unit", type: "select", options: lengthChoices },
    { id: "edge", label: "Edge length (a)", type: "number", gt: 0 },
    { id: "length", label: "Length (l)", type: "number", gt: 0, hint: "For a pyramid: base length." },
    { id: "width", label: "Width (w)", type: "number", gt: 0, hint: "For a pyramid: base width." },
    { id: "height", label: "Height (h)", type: "number", gt: 0, hint: "Perpendicular height." },
    { id: "radius", label: "Radius (r)", type: "number", gt: 0 },
    { id: "sides", label: "Sides of the base polygon (n)", type: "number", integer: true, min: 3, max: 1000, hint: "3 for a triangular prism, 6 for hexagonal." },
    { id: "major", label: "Major radius (R)", type: "number", gt: 0, hint: "Center of the hole to the center of the tube." },
    { id: "minor", label: "Tube radius (r)", type: "number", gt: 0 },
  ],
  defaults: { unit: "cm" },
  example: { unit: "cm", edge: "4", length: "6", width: "4", height: "10", radius: "3", sides: "6", major: "8", minor: "2" },
  compute: (v) => {
    const r = solve(v.mode, (id) => v.num(id)!);
    if (typeof r === "string") return r;
    const unit = v.str("unit");
    const u = unit === "u" ? "" : unit;
    const vol = (x: number) => (u ? `${num(x)} ${u}³` : `${num(x)} cubic units`);
    const ar = (x: number) => (u ? `${num(x)} ${u}²` : `${num(x)} square units`);
    const len = (x: number) => (u ? `${num(x)} ${u}` : num(x));
    const f = lengthFactor(unit);
    const outputs = [
      { label: "Volume", value: vol(r.volume), primary: true },
      { label: "Total surface area", value: ar(r.surface) },
      ...(r.lateral !== undefined ? [{ label: v.mode === "hemisphere" ? "Curved surface" : "Lateral surface", value: ar(r.lateral) }] : []),
      ...(r.extra ?? []).map((e) => ({ label: e.label, value: e.kind === "len" ? len(e.value) : ar(e.value) })),
    ];
    if (f !== null) {
      const m3 = r.volume * f ** 3;
      outputs.push({ label: "Volume in liters", value: num(m3 * 1000) });
      if (unit !== "m") outputs.push({ label: "Volume in m³", value: num(m3) });
    }
    return {
      outputs,
      steps: [...r.formula, `V = ${num(r.volume)}`, `A = ${num(r.surface)}`],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
