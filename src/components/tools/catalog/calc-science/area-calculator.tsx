"use client";

import { FormulaTool, num, type FormulaResult, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { lengthChoices, lengthFactor } from "./lib/units";
import { apothem, circumradiusPolygon, ellipsePerimeter, heron, regularPolygonArea } from "./lib/geometry";
import { Figure, mutedText, stroke, textStyle } from "./shared";

const unitField = { id: "unit", label: "Length unit", type: "select" as const, options: lengthChoices };

function sq(u: string) {
  return u === "u" ? "square units" : `${u}²`;
}
function ln(u: string) {
  return u === "u" ? "" : ` ${u}`;
}

/** Area in m² for the selected unit, or null for "no unit". */
function areaSI(a: number, u: string) {
  const f = lengthFactor(u);
  return f === null ? null : a * f * f;
}

function finish(
  area: number,
  perimeter: number,
  u: string,
  steps: string[],
  visual: React.ReactNode,
  extra: { label: string; value: string }[] = [],
  perimeterLabel = "Perimeter",
): FormulaResult {
  const si = areaSI(area, u);
  return {
    outputs: [
      { label: "Area", value: `${num(area)} ${sq(u)}`, primary: true },
      { label: perimeterLabel, value: `${num(perimeter)}${ln(u)}` },
      ...extra,
      ...(si !== null && u !== "m" ? [{ label: "Area in m²", value: num(si) }] : []),
      ...(si !== null && u !== "ft" ? [{ label: "Area in ft²", value: num(si / 0.09290304) }] : []),
    ],
    steps,
    visual,
  };
}

const W = 320;
const Hh = 200;

function fitBox(w: number, h: number) {
  const s = Math.min((W - 80) / w, (Hh - 60) / h);
  return { s, ox: (W - w * s) / 2, oy: (Hh - h * s) / 2 };
}

const spec: FormulaSpec = {
  modes: [
    { id: "square", label: "Square", fields: ["unit", "side"] },
    { id: "rectangle", label: "Rectangle", fields: ["unit", "length", "width"] },
    { id: "triangle", label: "Triangle", fields: ["unit", "ta", "tb", "tc"] },
    { id: "circle", label: "Circle", fields: ["unit", "radius"] },
    { id: "ellipse", label: "Ellipse", fields: ["unit", "semiA", "semiB"] },
    { id: "trapezoid", label: "Trapezoid", fields: ["unit", "base1", "base2", "height", "leg1", "leg2"] },
    { id: "parallelogram", label: "Parallelogram", fields: ["unit", "pbase", "pside", "pheight"] },
    { id: "sector", label: "Sector", fields: ["unit", "radius", "angle"] },
    { id: "polygon", label: "Regular polygon", fields: ["unit", "sides", "side"] },
  ],
  fields: [
    unitField,
    { id: "side", label: "Side length (s)", type: "number", gt: 0 },
    { id: "length", label: "Length (l)", type: "number", gt: 0 },
    { id: "width", label: "Width (w)", type: "number", gt: 0 },
    { id: "ta", label: "Side a", type: "number", gt: 0 },
    { id: "tb", label: "Side b", type: "number", gt: 0 },
    { id: "tc", label: "Side c", type: "number", gt: 0 },
    { id: "radius", label: "Radius (r)", type: "number", gt: 0 },
    { id: "semiA", label: "Semi-major axis (a)", type: "number", gt: 0, hint: "Half the longest width." },
    { id: "semiB", label: "Semi-minor axis (b)", type: "number", gt: 0, hint: "Half the shortest width." },
    { id: "base1", label: "Parallel side a", type: "number", gt: 0 },
    { id: "base2", label: "Parallel side b", type: "number", gt: 0 },
    { id: "height", label: "Height (h)", type: "number", gt: 0, hint: "Perpendicular distance between the parallel sides." },
    { id: "leg1", label: "Leg c", type: "number", gt: 0, optional: true, hint: "Needed for the perimeter only." },
    { id: "leg2", label: "Leg d", type: "number", gt: 0, optional: true },
    { id: "pbase", label: "Base (b)", type: "number", gt: 0 },
    { id: "pside", label: "Slanted side (a)", type: "number", gt: 0 },
    { id: "pheight", label: "Height (h)", type: "number", gt: 0, hint: "Perpendicular to the base." },
    { id: "angle", label: "Central angle (θ)", type: "number", gt: 0, max: 360, suffix: "°" },
    { id: "sides", label: "Number of sides (n)", type: "number", integer: true, min: 3, max: 1000 },
  ],
  defaults: { unit: "cm" },
  example: { unit: "cm", side: "4", length: "8", width: "5", ta: "5", tb: "6", tc: "7", radius: "3", semiA: "5", semiB: "3", base1: "10", base2: "6", height: "4", leg1: "5", leg2: "4.5", pbase: "9", pside: "5", pheight: "4", angle: "60", sides: "6" },
  compute: (v) => {
    const u = v.str("unit");
    const L = (n: number) => `${num(n)}${ln(u)}`;
    switch (v.mode) {
      case "square": {
        const s = v.num("side")!;
        const { s: k, ox, oy } = fitBox(1, 1);
        return finish(s * s, 4 * s, u, [`A = s² = ${num(s)}² = ${num(s * s)}`, `P = 4s = 4 × ${num(s)} = ${num(4 * s)}`],
          <Figure label={`Square with side ${L(s)}`} viewBox={`0 0 ${W} ${Hh}`}>
            <rect x={ox} y={oy} width={k} height={k} {...stroke} />
            <text x={W / 2} y={oy + k + 18} textAnchor="middle" {...textStyle}>s = {L(s)}</text>
          </Figure>);
      }
      case "rectangle": {
        const l = v.num("length")!;
        const w = v.num("width")!;
        const { s: k, ox, oy } = fitBox(l, w);
        return finish(l * w, 2 * (l + w), u, [`A = l × w = ${num(l)} × ${num(w)} = ${num(l * w)}`, `P = 2(l + w) = 2(${num(l)} + ${num(w)}) = ${num(2 * (l + w))}`],
          <Figure label={`Rectangle ${L(l)} by ${L(w)}, drawn to scale`} viewBox={`0 0 ${W} ${Hh}`}>
            <rect x={ox} y={oy} width={l * k} height={w * k} {...stroke} />
            <text x={W / 2} y={oy + w * k + 18} textAnchor="middle" {...textStyle}>l = {L(l)}</text>
            <text x={ox + l * k + 8} y={Hh / 2} {...textStyle}>w = {L(w)}</text>
          </Figure>,
          [{ label: "Diagonal", value: L(Math.hypot(l, w)) }]);
      }
      case "triangle": {
        const a = v.num("ta")!;
        const b = v.num("tb")!;
        const c = v.num("tc")!;
        const [x, y, z] = [a, b, c].sort((p, q) => p - q);
        if (x + y <= z) return `These sides break the triangle inequality: ${num(x)} + ${num(y)} must be greater than ${num(z)}.`;
        const A = heron(a, b, c);
        const s = (a + b + c) / 2;
        // Draw with c on the base.
        const cx = (b * b + c * c - a * a) / (2 * c);
        const cy = Math.sqrt(Math.max(0, b * b - cx * cx));
        const minX = Math.min(0, cx);
        const maxX = Math.max(c, cx);
        const { s: k, ox, oy } = fitBox(maxX - minX, cy);
        const P = (px: number, py: number) => `${ox + (px - minX) * k},${oy + (cy - py) * k}`;
        return finish(A, a + b + c, u, [
          `s = (a + b + c) / 2 = ${num(s)}`,
          `A = √(s(s − a)(s − b)(s − c)) = √(${num(s)} × ${num(s - a)} × ${num(s - b)} × ${num(s - c)}) = ${num(A)}`,
          `P = a + b + c = ${num(a + b + c)}`,
        ],
          <Figure label={`Triangle with sides ${L(a)}, ${L(b)} and ${L(c)}, drawn to scale`} viewBox={`0 0 ${W} ${Hh}`}>
            <polygon points={`${P(0, 0)} ${P(c, 0)} ${P(cx, cy)}`} {...stroke} />
            <text x={ox + (c / 2 - minX) * k} y={oy + cy * k + 18} textAnchor="middle" {...textStyle}>c</text>
            <text x={ox + ((c + cx) / 2 - minX) * k + 8} y={oy + (cy / 2) * k} {...textStyle}>a</text>
            <text x={ox + (cx / 2 - minX) * k - 14} y={oy + (cy / 2) * k} {...textStyle}>b</text>
          </Figure>,
          [{ label: "Height to side c", value: L((2 * A) / c) }]);
      }
      case "circle": {
        const r = v.num("radius")!;
        return finish(Math.PI * r * r, 2 * Math.PI * r, u, [`A = πr² = π × ${num(r)}² = ${num(Math.PI * r * r)}`, `C = 2πr = ${num(2 * Math.PI * r)}`],
          <Figure label={`Circle with radius ${L(r)}`} viewBox={`0 0 ${W} ${Hh}`}>
            <circle cx={W / 2} cy={Hh / 2} r={70} {...stroke} />
            <line x1={W / 2} y1={Hh / 2} x2={W / 2 + 70} y2={Hh / 2} stroke="var(--ink)" strokeWidth={1.5} />
            <text x={W / 2 + 35} y={Hh / 2 - 8} textAnchor="middle" {...textStyle}>r</text>
          </Figure>,
          [{ label: "Diameter", value: L(2 * r) }], "Circumference");
      }
      case "ellipse": {
        let a = v.num("semiA")!;
        let b = v.num("semiB")!;
        if (b > a) [a, b] = [b, a];
        const A = Math.PI * a * b;
        const P = ellipsePerimeter(a, b);
        const { s: k } = fitBox(2 * a, 2 * b);
        return {
          ...finish(A, P, u, [`A = πab = π × ${num(a)} × ${num(b)} = ${num(A)}`, `h = ((a − b)/(a + b))² = ${num(((a - b) / (a + b)) ** 2)}`, `P ≈ π(a + b)(1 + 3h / (10 + √(4 − 3h))) = ${num(P)}`],
            <Figure label={`Ellipse with semi-axes ${L(a)} and ${L(b)}, drawn to scale`} viewBox={`0 0 ${W} ${Hh}`}>
              <ellipse cx={W / 2} cy={Hh / 2} rx={a * k} ry={b * k} {...stroke} />
              <line x1={W / 2} y1={Hh / 2} x2={W / 2 + a * k} y2={Hh / 2} stroke="var(--ink)" strokeWidth={1.5} />
              <line x1={W / 2} y1={Hh / 2} x2={W / 2} y2={Hh / 2 - b * k} stroke="var(--ink)" strokeWidth={1.5} />
              <text x={W / 2 + (a * k) / 2} y={Hh / 2 + 16} textAnchor="middle" {...textStyle}>a</text>
              <text x={W / 2 + 6} y={Hh / 2 - (b * k) / 2} {...textStyle}>b</text>
            </Figure>, [], "Perimeter (approx.)"),
          notes: ["An ellipse has no simple exact perimeter formula. This uses Ramanujan's second approximation, which is accurate to far better than 0.01% for typical shapes."],
        };
      }
      case "trapezoid": {
        const a = v.num("base1")!;
        const b = v.num("base2")!;
        const h = v.num("height")!;
        const c = v.num("leg1");
        const d = v.num("leg2");
        const A = ((a + b) / 2) * h;
        const hasLegs = c !== null && d !== null;
        if (hasLegs && (c! < h || d! < h)) return "Each leg must be at least as long as the height.";
        const steps = [`A = (a + b) / 2 × h = (${num(a)} + ${num(b)}) / 2 × ${num(h)} = ${num(A)}`];
        if (hasLegs) steps.push(`P = a + b + c + d = ${num(a + b + c! + d!)}`);
        const top = Math.min(a, b);
        const bottom = Math.max(a, b);
        const { s: k, ox, oy } = fitBox(bottom, h);
        const off = ((bottom - top) / 2) * k;
        const fig = (
          <Figure label={`Trapezoid with parallel sides ${L(a)} and ${L(b)} and height ${L(h)}; legs drawn symmetric`} viewBox={`0 0 ${W} ${Hh}`}>
            <polygon points={`${ox},${oy + h * k} ${ox + bottom * k},${oy + h * k} ${ox + bottom * k - off},${oy} ${ox + off},${oy}`} {...stroke} />
            <line x1={ox + off} y1={oy} x2={ox + off} y2={oy + h * k} stroke="var(--muted)" strokeDasharray="4 4" />
            <text x={ox + off + 6} y={oy + (h * k) / 2} {...mutedText}>h</text>
          </Figure>
        );
        if (!hasLegs) {
          return { outputs: [{ label: "Area", value: `${num(A)} ${sq(u)}`, primary: true }, { label: "Median (midsegment)", value: L((a + b) / 2) }], steps, visual: fig, notes: ["Enter both legs to get the perimeter."] };
        }
        return finish(A, a + b + c! + d!, u, steps, fig, [{ label: "Median (midsegment)", value: L((a + b) / 2) }]);
      }
      case "parallelogram": {
        const b = v.num("pbase")!;
        const a = v.num("pside")!;
        const h = v.num("pheight")!;
        if (h > a) return "The height cannot be longer than the slanted side.";
        const off = Math.sqrt(a * a - h * h);
        const { s: k, ox, oy } = fitBox(b + off, h);
        const theta = (Math.asin(h / a) * 180) / Math.PI;
        return finish(b * h, 2 * (a + b), u, [`A = b × h = ${num(b)} × ${num(h)} = ${num(b * h)}`, `P = 2(a + b) = ${num(2 * (a + b))}`],
          <Figure label={`Parallelogram with base ${L(b)}, side ${L(a)} and height ${L(h)}, drawn to scale`} viewBox={`0 0 ${W} ${Hh}`}>
            <polygon points={`${ox},${oy + h * k} ${ox + b * k},${oy + h * k} ${ox + (b + off) * k},${oy} ${ox + off * k},${oy}`} {...stroke} />
            <line x1={ox + off * k} y1={oy} x2={ox + off * k} y2={oy + h * k} stroke="var(--muted)" strokeDasharray="4 4" />
          </Figure>,
          [{ label: "Interior angle", value: `${num(theta, 6)}° and ${num(180 - theta, 6)}°` }]);
      }
      case "sector": {
        const r = v.num("radius")!;
        const deg = v.num("angle")!;
        const t = (deg * Math.PI) / 180;
        const arc = r * t;
        const A = 0.5 * r * r * t;
        const R = 75;
        const cx = W / 2;
        const cy = Hh / 2 + 10;
        const x2 = cx + R * Math.cos(-t);
        const y2 = cy + R * Math.sin(-t);
        const path = deg >= 360 ? undefined : `M ${cx} ${cy} L ${cx + R} ${cy} A ${R} ${R} 0 ${deg > 180 ? 1 : 0} 0 ${x2} ${y2} Z`;
        return finish(A, deg >= 360 ? 2 * Math.PI * r : 2 * r + arc, u, [
          `θ = ${num(deg)}° = ${num(t)} rad`,
          `A = ½r²θ = 0.5 × ${num(r)}² × ${num(t)} = ${num(A)}`,
          `Arc length = rθ = ${num(arc)}`,
          `P = 2r + rθ = ${num(2 * r + arc)}`,
        ],
          <Figure label={`Circular sector with radius ${L(r)} and angle ${num(deg)} degrees`} viewBox={`0 0 ${W} ${Hh}`}>
            {path ? <path d={path} {...stroke} /> : <circle cx={cx} cy={cy} r={R} {...stroke} />}
          </Figure>,
          [{ label: "Arc length", value: L(arc) }, { label: "Chord length", value: L(2 * r * Math.sin(Math.min(t, 2 * Math.PI) / 2)) }]);
      }
      case "polygon": {
        const n = v.num("sides")!;
        const s = v.num("side")!;
        const A = regularPolygonArea(n, s);
        const ap = apothem(n, s);
        const R = circumradiusPolygon(n, s);
        const pts = Array.from({ length: Math.min(n, 200) }, (_, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / Math.min(n, 200);
          return `${W / 2 + 80 * Math.cos(ang)},${Hh / 2 + 80 * Math.sin(ang)}`;
        }).join(" ");
        return finish(A, n * s, u, [
          `A = n s² / (4 tan(π/n)) = ${num(n)} × ${num(s)}² / (4 × tan(π/${num(n)})) = ${num(A)}`,
          `Apothem = s / (2 tan(π/n)) = ${num(ap)}`,
          `P = n × s = ${num(n * s)}`,
        ],
          <Figure label={`Regular polygon with ${n} sides of ${L(s)}`} viewBox={`0 0 ${W} ${Hh}`}>
            <polygon points={pts} {...stroke} />
          </Figure>,
          [
            { label: "Apothem (inradius)", value: L(ap) },
            { label: "Circumradius", value: L(R) },
            { label: "Interior angle", value: `${num(((n - 2) * 180) / n, 8)}°` },
          ]);
      }
    }
    return null;
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
