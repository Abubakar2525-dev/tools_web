"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { compassPoint, destination, finalBearing, formatDMS, haversine, initialBearing, midpoint, parseAngle, parseLatLon } from "./lib/geo";
import { Figure } from "./ui";

function Compass({ bearing, label }: { bearing: number; label: string }) {
  const r = 60,
    c = 80;
  const rad = (bearing * Math.PI) / 180;
  const x = c + r * Math.sin(rad);
  const y = c - r * Math.cos(rad);
  return (
    <Figure viewBox="0 0 160 160" title="Compass" desc={`${label}: ${num(bearing, 5)}° from true north (${compassPoint(bearing)}).`} maxWidth={200}>
      <circle cx={c} cy={c} r={r} className="fill-none stroke-line-strong" strokeWidth={1.5} />
      {(["N", "E", "S", "W"] as const).map((d, i) => (
        <text key={d} x={c + (r + 12) * Math.sin((i * Math.PI) / 2)} y={c - (r + 12) * Math.cos((i * Math.PI) / 2) + 4} textAnchor="middle" className="fill-ink-2 text-[11px] font-medium">
          {d}
        </text>
      ))}
      <line x1={c} y1={c} x2={x} y2={y} className="stroke-accent-strong" strokeWidth={3} strokeLinecap="round" />
      <circle cx={c} cy={c} r={3} className="fill-ink" />
    </Figure>
  );
}

const spec: FormulaSpec = {
  lead: <>Great-circle bearings on a spherical Earth (mean radius 6371.0088 km), measured clockwise from true north.</>,
  modes: [
    { id: "two", label: "Between two points", fields: ["a", "b"] },
    { id: "dest", label: "Destination point", fields: ["a", "brg", "dist"] },
  ],
  fields: [
    { id: "a", label: "Start point", type: "text", mono: true, placeholder: "50.0664, -5.7147" },
    { id: "b", label: "End point", type: "text", mono: true, placeholder: "58.6439, -3.0700" },
    { id: "brg", label: "Bearing", type: "text", placeholder: "96.02 or 96° 01′ 18″", hint: "Degrees clockwise from true north." },
    {
      id: "dist",
      label: "Distance",
      type: "number",
      gt: 0,
      units: [
        { value: "km", label: "km", factor: 1000 },
        { value: "mi", label: "miles", factor: 1609.344 },
        { value: "nmi", label: "nautical miles", factor: 1852 },
        { value: "m", label: "m", factor: 1 },
      ],
    },
  ],
  example: { __mode: "two", a: "50.0664, -5.7147", b: "58.6439, -3.0700" },
  compute: (v) => {
    const a = parseLatLon(v.str("a"));
    if (typeof a === "string") return `Start point: ${a}`;
    if (v.mode === "two") {
      const b = parseLatLon(v.str("b"));
      if (typeof b === "string") return `End point: ${b}`;
      if (a.lat === b.lat && a.lon === b.lon) return "The two points are identical, so there is no bearing.";
      const ib = initialBearing(a, b);
      const fb = finalBearing(a, b);
      const m = midpoint(a, b);
      const d = haversine(a, b) / 1000;
      return {
        outputs: [
          { label: "Initial bearing", value: `${num(ib, 6)}°`, primary: true, note: `${compassPoint(ib)} · ${formatDMS(ib, "lat", 1).replace(/ [NS]$/, "")}` },
          { label: "Final bearing", value: `${num(fb, 6)}° (${compassPoint(fb)})` },
          { label: "Back bearing (B to A)", value: `${num((fb + 180) % 360, 6)}°` },
          { label: "Midpoint", value: `${m.lat.toFixed(6)}, ${m.lon.toFixed(6)}` },
          { label: "Great-circle distance", value: `${num(d, 6)} km` },
        ],
        steps: [
          `θ = atan2(sin Δλ · cos φ₂, cos φ₁ · sin φ₂ − sin φ₁ · cos φ₂ · cos Δλ) = ${num(ib, 8)}°`,
          `Final bearing = (initial bearing from B to A + 180°) mod 360 = ${num(fb, 8)}°`,
        ],
        visual: <Compass bearing={ib} label="Initial bearing" />,
        notes: ["On a great circle the heading changes along the way (unless you travel due north, south or along the equator), which is why the initial and final bearings differ."],
      };
    }
    const brg = parseAngle(v.str("brg"));
    if (typeof brg === "string") return `Bearing: ${brg}`;
    const dist = v.num("dist") as number;
    const d = destination(a, brg, dist);
    const fb = finalBearing(a, d);
    return {
      outputs: [
        { label: "Destination", value: `${d.lat.toFixed(6)}, ${d.lon.toFixed(6)}`, primary: true, note: `${formatDMS(d.lat, "lat")}, ${formatDMS(d.lon, "lon")}` },
        { label: "Final bearing on arrival", value: `${num(fb, 6)}°` },
      ],
      steps: [
        `δ = distance ÷ R = ${num(dist)} m ÷ 6371008.8 m = ${num(dist / 6371008.8, 8)} rad`,
        `φ₂ = asin(sin φ₁ cos δ + cos φ₁ sin δ cos θ) = ${num(d.lat, 9)}°`,
        `λ₂ = λ₁ + atan2(sin θ sin δ cos φ₁, cos δ − sin φ₁ sin φ₂) = ${num(d.lon, 9)}°`,
      ],
      visual: <Compass bearing={((brg % 360) + 360) % 360} label="Start bearing" />,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
