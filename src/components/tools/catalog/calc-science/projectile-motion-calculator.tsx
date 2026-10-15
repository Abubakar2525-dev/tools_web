"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { accel, angle, length, speed } from "./lib/units";
import { G0 } from "./lib/constants";
import { projectile, projectilePoint } from "./lib/physics";
import { Figure, mutedText } from "./shared";

function Trajectory({ v0, th, h0, g, range, maxH, apexT, T }: { v0: number; th: number; h0: number; g: number; range: number; maxH: number; apexT: number; T: number }) {
  const W = 360;
  const H = 220;
  const padL = 44;
  const padB = 28;
  const padT = 16;
  const padR = 16;
  const xMax = Math.max(range, 1e-9);
  const yMax = Math.max(maxH, 1e-9);
  const sx = (W - padL - padR) / xMax;
  const sy = (H - padT - padB) / yMax;
  // Equal scale when it fits reasonably; otherwise stretch and say so.
  const equal = Math.min(sx, sy);
  const ratio = Math.max(sx, sy) / equal;
  const useEqual = ratio < 2.5;
  const kx = useEqual ? equal : sx;
  const ky = useEqual ? equal : sy;
  const X = (x: number) => padL + x * kx;
  const Y = (y: number) => H - padB - y * ky;
  const pts: string[] = [];
  const N = 80;
  for (let i = 0; i <= N; i++) {
    const [x, y] = projectilePoint(v0, th, h0, g, (T * i) / N);
    pts.push(`${X(x).toFixed(2)},${Y(Math.max(0, y)).toFixed(2)}`);
  }
  const [ax, ay] = projectilePoint(v0, th, h0, g, apexT);
  return (
    <Figure
      label={`Trajectory: launched from height ${num(h0, 4)} m, peaks at ${num(maxH, 4)} m, lands ${num(range, 4)} m away after ${num(T, 4)} s`}
      viewBox={`0 0 ${W} ${H}`}
      caption={useEqual ? "Path drawn to scale" : "Horizontal and vertical axes use different scales"}
    >
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--line-strong)" />
      <line x1={padL} y1={H - padB} x2={padL} y2={padT} stroke="var(--line-strong)" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent-strong)" strokeWidth={2.5} strokeLinecap="round" />
      {apexT > 0 && <circle cx={X(ax)} cy={Y(ay)} r={4} fill="var(--accent-strong)" />}
      {apexT > 0 && (
        <line x1={X(ax)} y1={Y(ay)} x2={X(ax)} y2={H - padB} stroke="var(--muted)" strokeDasharray="3 4" />
      )}
      <text x={padL - 6} y={Y(maxH) + 4} textAnchor="end" {...mutedText}>{num(maxH, 3)}</text>
      <text x={padL - 6} y={H - padB + 4} textAnchor="end" {...mutedText}>0</text>
      <text x={X(range)} y={H - padB + 18} textAnchor="end" {...mutedText}>{num(range, 3)} m</text>
    </Figure>
  );
}

const spec: FormulaSpec = {
  fields: [
    { id: "v0", label: "Launch speed (v₀)", type: "number", gt: 0, units: speed },
    { id: "theta", label: "Launch angle (θ)", type: "number", min: -90, max: 90, units: angle, hint: "Above horizontal; use a negative value to throw downward." },
    { id: "h0", label: "Launch height (h₀)", type: "number", min: 0, units: length, hint: "Height above the landing level." },
    { id: "g", label: "Gravity (g)", type: "number", gt: 0, units: accel, hint: "9.80665 on Earth, 1.62 on the Moon, 3.71 on Mars." },
  ],
  defaults: { h0: "0", g: String(G0) },
  example: { v0: "25", theta: "40", h0: "1.5", g: String(G0) },
  compute: (v) => {
    const v0 = v.num("v0")!;
    const th = v.num("theta")!;
    const h0 = v.num("h0")!;
    const g = v.num("g")!;
    if (Math.abs(th) > Math.PI / 2 + 1e-12) return "Use an angle between −90° and 90°.";
    if (h0 === 0 && th <= 0) return "From ground level the angle must be above 0°, otherwise the projectile never leaves the ground.";
    const p = projectile(v0, th, h0, g);
    const rows: (string | number)[][] = [];
    for (let i = 0; i <= 10; i++) {
      const t = (p.flightTime * i) / 10;
      const [x, y] = projectilePoint(v0, th, h0, g, t);
      rows.push([num(t, 5), num(x, 6), num(Math.max(0, y), 6)]);
    }
    const thDeg = (th * 180) / Math.PI;
    return {
      outputs: [
        { label: "Horizontal range", value: `${num(p.range)} m`, primary: true },
        { label: "Flight time", value: `${num(p.flightTime)} s` },
        { label: "Maximum height", value: `${num(p.maxHeight)} m` },
        { label: "Time to peak", value: `${num(p.timeToApex)} s` },
        { label: "Impact speed", value: `${num(p.impactSpeed)} m/s` },
        { label: "Impact angle", value: `${num((p.impactAngle * 180) / Math.PI, 6)}° below horizontal` },
      ],
      steps: [
        `vₓ = v₀ cos θ = ${num(v0)} × cos ${num(thDeg, 6)}° = ${num(p.vx)} m/s`,
        `v_y = v₀ sin θ = ${num(p.vy)} m/s`,
        `t = (v_y + √(v_y² + 2gh₀)) / g = ${num(p.flightTime)} s`,
        `Range = vₓ × t = ${num(p.range)} m`,
        `h_max = h₀ + v_y² / 2g = ${num(p.maxHeight)} m`,
        `Impact speed = √(vₓ² + (v_y − gt)²) = ${num(p.impactSpeed)} m/s`,
      ],
      table: { caption: "Position over time", columns: ["t (s)", "x (m)", "y (m)"], rows },
      visual: <Trajectory v0={v0} th={th} h0={h0} g={g} range={p.range} maxH={p.maxHeight} apexT={p.timeToApex} T={p.flightTime} />,
      notes: ["Ignores air resistance and assumes flat ground and constant gravity. Real balls fall short of these numbers, especially at high speed."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
