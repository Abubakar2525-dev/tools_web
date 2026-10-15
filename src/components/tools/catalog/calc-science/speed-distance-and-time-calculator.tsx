"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { length, speed, time } from "./lib/units";
import { unitOutputs } from "./shared";

function hms(sec: number): string {
  if (!Number.isFinite(sec)) return "";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h} h ${m} min ${r} s`;
}

const spec: FormulaSpec = {
  modes: [
    { id: "speed", label: "Find speed", fields: ["distance", "time"] },
    { id: "distance", label: "Find distance", fields: ["speed", "time"] },
    { id: "time", label: "Find time", fields: ["distance", "speed"] },
  ],
  fields: [
    { id: "distance", label: "Distance", type: "number", gt: 0, units: length, defaultUnit: "km" },
    { id: "speed", label: "Speed", type: "number", gt: 0, units: speed, defaultUnit: "kmh" },
    { id: "time", label: "Time", type: "number", gt: 0, units: time, defaultUnit: "h" },
  ],
  example: { distance: "150", "distance:unit": "km", time: "1.5", "time:unit": "h", speed: "100", "speed:unit": "kmh" },
  lead: <p>Speed = distance ÷ time. Each input can use its own unit; everything is converted to meters and seconds first.</p>,
  compute: (v) => {
    if (v.mode === "speed") {
      const d = v.num("distance")!;
      const t = v.num("time")!;
      const s = d / t;
      return {
        outputs: [{ label: "Speed (km/h)", value: num(s * 3.6), primary: true }, ...unitOutputs("Speed", s, speed, ["ms", "mph", "kn", "fts"])],
        steps: [`d = ${num(d)} m, t = ${num(t)} s`, `v = d / t = ${num(d)} / ${num(t)} = ${num(s)} m/s`, `${num(s)} m/s × 3.6 = ${num(s * 3.6)} km/h`],
        notes: ["This is the average speed over the whole trip."],
      };
    }
    if (v.mode === "distance") {
      const s = v.num("speed")!;
      const t = v.num("time")!;
      const d = s * t;
      return {
        outputs: [{ label: "Distance (km)", value: num(d / 1000), primary: true }, ...unitOutputs("Distance", d, length, ["m", "mi", "ft", "nmi"])],
        steps: [`v = ${num(s)} m/s, t = ${num(t)} s`, `d = v × t = ${num(s)} × ${num(t)} = ${num(d)} m`],
      };
    }
    const d = v.num("distance")!;
    const s = v.num("speed")!;
    const t = d / s;
    return {
      outputs: [
        { label: "Time", value: t >= 60 ? hms(t) : `${num(t)} s`, primary: true },
        ...unitOutputs("Time", t, time, ["h", "min", "s"]),
      ],
      steps: [`d = ${num(d)} m, v = ${num(s)} m/s`, `t = d / v = ${num(d)} / ${num(s)} = ${num(t)} s`],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
