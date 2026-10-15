"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";

const COMMON: { label: string; w: number; h: number; use: string }[] = [
  { label: "1:1", w: 1, h: 1, use: "Square posts, avatars" },
  { label: "5:4", w: 5, h: 4, use: "Large-format prints" },
  { label: "4:3", w: 4, h: 3, use: "Classic TV, tablets, many cameras" },
  { label: "3:2", w: 3, h: 2, use: "35mm photos, many laptops" },
  { label: "16:10", w: 16, h: 10, use: "Laptop and desktop displays" },
  { label: "16:9", w: 16, h: 9, use: "HD video, YouTube, TVs" },
  { label: "1.85:1", w: 1.85, h: 1, use: "Cinema (flat)" },
  { label: "2:1", w: 2, h: 1, use: "Univisium, wide banners" },
  { label: "21:9", w: 21, h: 9, use: "Ultrawide monitors (marketing name)" },
  { label: "2.39:1", w: 2.39, h: 1, use: "Cinema (scope)" },
  { label: "4:5", w: 4, h: 5, use: "Portrait feed posts" },
  { label: "2:3", w: 2, h: 3, use: "Portrait photos, posters" },
  { label: "9:16", w: 9, h: 16, use: "Stories, Reels, Shorts" },
];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Simplest integer ratio; decimals are scaled to 3 places first. */
function simplify(w: number, h: number) {
  const scale = Number.isInteger(w) && Number.isInteger(h) ? 1 : 1000;
  const a = Math.round(w * scale);
  const b = Math.round(h * scale);
  const g = gcd(a, b) || 1;
  return [a / g, b / g];
}

function nearest(r: number) {
  let best = COMMON[0];
  for (const c of COMMON) if (Math.abs(Math.log(c.w / c.h / r)) < Math.abs(Math.log(best.w / best.h / r))) best = c;
  return best;
}

function Rect({ w, h, label }: { w: number; h: number; label: string }) {
  const s = Math.min(280 / w, 180 / h);
  const rw = w * s;
  const rh = h * s;
  return (
    <svg viewBox="0 0 300 200" className="w-full max-w-[420px]" role="img" aria-label={label}>
      <rect x="0" y="0" width="300" height="200" fill="var(--bg-sunken)" rx="10" />
      <rect x={150 - rw / 2} y={100 - rh / 2} width={rw} height={rh} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" rx="3" />
      <line x1={150 - rw / 2} y1={100 - rh / 2} x2={150 + rw / 2} y2={100 + rh / 2} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth="1" />
      <text x="150" y="104" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">
        {label}
      </text>
    </svg>
  );
}

const spec: FormulaSpec = {
  modes: [
    { id: "ratio", label: "Find the ratio", fields: ["w", "h"] },
    { id: "resize", label: "Resize keeping ratio", fields: ["rw", "rh", "nw", "nh"] },
  ],
  fields: [
    { id: "w", label: "Width", type: "number", gt: 0, placeholder: "1920", suffix: "px" },
    { id: "h", label: "Height", type: "number", gt: 0, placeholder: "1080", suffix: "px" },
    { id: "rw", label: "Original width (or ratio W)", type: "number", gt: 0, placeholder: "16" },
    { id: "rh", label: "Original height (or ratio H)", type: "number", gt: 0, placeholder: "9" },
    { id: "nw", label: "New width", type: "number", gt: 0, optional: true, hint: "Fill in one of the two new sizes." },
    { id: "nh", label: "New height", type: "number", gt: 0, optional: true },
  ],
  defaults: { w: "1920", h: "1080", rw: "16", rh: "9", nw: "1280" },
  example: { w: "1366", h: "768", rw: "1920", rh: "1080", nw: "", nh: "720" },
  compute: (v) => {
    if (v.mode === "ratio") {
      const w = v.num("w")!;
      const h = v.num("h")!;
      const [a, b] = simplify(w, h);
      const r = w / h;
      const near = nearest(r);
      const dev = ((r / (near.w / near.h) - 1) * 100);
      return {
        outputs: [
          { label: "Aspect ratio", value: `${num(a)}:${num(b)}`, primary: true, note: `Closest common ratio: ${near.label} (${dev >= 0 ? "+" : ""}${num(dev, 3)}%)` },
          { label: "Decimal", value: `${num(r, 5)}:1` },
          { label: "Orientation", value: r > 1 ? "Landscape" : r < 1 ? "Portrait" : "Square" },
          { label: "Megapixels", value: num((w * h) / 1e6, 4) },
          { label: "Diagonal", value: num(Math.hypot(w, h), 6) },
        ],
        steps: [`GCD(${num(Math.round(w))}, ${num(Math.round(h))}) used to reduce ${num(w)}:${num(h)} → ${num(a)}:${num(b)}`, `${num(w)} ÷ ${num(h)} = ${num(r, 6)}`],
        visual: <Rect w={w} h={h} label={`${num(a)}:${num(b)}`} />,
        table: {
          caption: `Common ratios at a width of ${num(w)}`,
          columns: ["Ratio", "Height at this width", "Typical use"],
          rows: COMMON.map((c) => [c.label, num(Math.round((w * c.h) / c.w)), c.use]),
        },
      };
    }
    const rw = v.num("rw")!;
    const rh = v.num("rh")!;
    const nw = v.num("nw");
    const nh = v.num("nh");
    if (nw === null && nh === null) return null;
    if (nw !== null && nh !== null) return "Enter only one new size; the other is calculated.";
    const r = rw / rh;
    const W = nw ?? (nh as number) * r;
    const H = nh ?? (nw as number) / r;
    const [a, b] = simplify(rw, rh);
    return {
      outputs: [
        { label: nw !== null ? "New height" : "New width", value: num(nw !== null ? H : W, 8), primary: true, note: `Rounded: ${num(Math.round(nw !== null ? H : W))} px` },
        { label: "New size", value: `${num(Math.round(W))} × ${num(Math.round(H))}` },
        { label: "Ratio kept", value: `${num(a)}:${num(b)}` },
        { label: "Scale", value: `${num((W / rw) * 100, 5)}%` },
      ],
      steps:
        nw !== null
          ? [`height = new width × original height ÷ original width`, `= ${num(nw)} × ${num(rh)} ÷ ${num(rw)} = ${num(H, 8)}`]
          : [`width = new height × original width ÷ original height`, `= ${num(nh as number)} × ${num(rw)} ÷ ${num(rh)} = ${num(W, 8)}`],
      visual: <Rect w={W} h={H} label={`${num(Math.round(W))} × ${num(Math.round(H))}`} />,
      notes: Number.isInteger(W) && Number.isInteger(H) ? undefined : ["Pixel sizes must be whole numbers, so the rounded size changes the ratio very slightly."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
