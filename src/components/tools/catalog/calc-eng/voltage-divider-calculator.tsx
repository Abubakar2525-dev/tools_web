"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { Figure } from "./ui";
import { U, si } from "./lib/units";
import { nearestStandard, formatOhms } from "./lib/resistor";

function Resistor({ x, y, label, value }: { x: number; y: number; label: string; value: string }) {
  // Vertical zig-zag between y and y+60.
  const pts = [`${x},${y}`, `${x},${y + 8}`];
  for (let i = 0; i < 6; i++) pts.push(`${x + (i % 2 ? -9 : 9)},${y + 12 + i * 7.5}`);
  pts.push(`${x},${y + 56}`, `${x},${y + 64}`);
  return (
    <g>
      <polyline points={pts.join(" ")} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" />
      <text x={x + 18} y={y + 30} className="fill-ink text-[13px] font-medium">
        {label}
      </text>
      <text x={x + 18} y={y + 46} className="fill-ink-2 text-[12px]">
        {value}
      </text>
    </g>
  );
}

function Schematic({ vin, r1, r2, vout, rl }: { vin: number; r1: number; r2: number; vout: number; rl: number | null }) {
  return (
    <Figure
      viewBox="0 0 340 250"
      title="Voltage divider schematic"
      desc={`Vin ${si(vin, "V")} across R1 ${si(r1, "Ω")} in series with R2 ${si(r2, "Ω")} to ground; Vout ${si(vout, "V")} is taken across R2${rl ? ` with a load of ${si(rl, "Ω")}` : ""}.`}
      maxWidth={380}
    >
      <g className="stroke-ink" strokeWidth={2} fill="none">
        <line x1={60} y1={30} x2={140} y2={30} />
        <line x1={140} y1={30} x2={140} y2={46} />
        <line x1={140} y1={110} x2={140} y2={130} />
        <line x1={140} y1={194} x2={140} y2={220} />
        <line x1={60} y1={220} x2={rl ? 260 : 220} y2={220} />
        <line x1={140} y1={120} x2={220} y2={120} />
        {rl && (
          <>
            <line x1={220} y1={120} x2={260} y2={120} />
            <line x1={260} y1={120} x2={260} y2={130} />
            <line x1={260} y1={194} x2={260} y2={220} />
          </>
        )}
      </g>
      <circle cx={60} cy={30} r={4} className="fill-ink" />
      <circle cx={60} cy={220} r={4} className="fill-ink" />
      <circle cx={220} cy={120} r={4} className="fill-accent-strong" />
      <text x={54} y={24} textAnchor="end" className="fill-ink text-[13px]">
        Vin {si(vin, "V", 3)}
      </text>
      <text x={54} y={238} textAnchor="end" className="fill-ink-2 text-[12px]">
        0 V
      </text>
      <text x={rl ? 210 : 228} y={rl ? 108 : 124} textAnchor={rl ? "end" : "start"} className="fill-accent-strong text-[13px] font-semibold">
        Vout {si(vout, "V", 4)}
      </text>
      <Resistor x={140} y={46} label="R1" value={si(r1, "Ω", 4)} />
      <Resistor x={140} y={130} label="R2" value={si(r2, "Ω", 4)} />
      {rl && <Resistor x={260} y={130} label="RL" value={si(rl, "Ω", 4)} />}
    </Figure>
  );
}

const spec: FormulaSpec = {
  lead: (
    <>
      Unloaded: <strong>Vout = Vin × R2 ÷ (R1 + R2)</strong>. With a load RL, R2 is replaced by R2 ∥ RL.
    </>
  ),
  modes: [
    { id: "vout", label: "Find Vout", fields: ["vin", "r1", "r2", "rl"] },
    { id: "r2", label: "Find R2", fields: ["vin", "vout", "r1"] },
    { id: "r1", label: "Find R1", fields: ["vin", "vout", "r2"] },
  ],
  fields: [
    { id: "vin", label: "Input voltage Vin", type: "number", units: U.volt, gt: 0 },
    { id: "vout", label: "Desired output Vout", type: "number", units: U.volt, gt: 0 },
    { id: "r1", label: "R1 (top)", type: "number", units: U.ohm, gt: 0 },
    { id: "r2", label: "R2 (bottom)", type: "number", units: U.ohm, gt: 0 },
    { id: "rl", label: "Load resistance RL", type: "number", units: U.ohm, optional: true, gt: 0, hint: "Optional: shows how the load pulls Vout down." },
  ],
  defaults: { "r1:unit": "kohm", "r2:unit": "kohm", "rl:unit": "kohm" },
  example: { __mode: "vout", vin: "12", r1: "10", r2: "4.7", "r1:unit": "kohm", "r2:unit": "kohm" },
  compute: (v) => {
    const vin = v.num("vin") as number;
    if (v.mode === "vout") {
      const r1 = v.num("r1") as number;
      const r2 = v.num("r2") as number;
      const rl = v.num("rl");
      const vout = (vin * r2) / (r1 + r2);
      const I = vin / (r1 + r2);
      const steps = [`Vout = Vin × R2 ÷ (R1 + R2) = ${si(vin, "V")} × ${si(r2, "Ω")} ÷ ${si(r1 + r2, "Ω")} = ${si(vout, "V")}`, `I = Vin ÷ (R1 + R2) = ${si(I, "A")}`];
      const outputs = [
        { label: rl ? "Vout (no load)" : "Output voltage Vout", value: si(vout, "V"), primary: !rl },
        { label: "Divider ratio", value: num(r2 / (r1 + r2), 5) },
        { label: "Divider current", value: si(I, "A") },
        { label: "Power in R1 / R2", value: `${si(I * I * r1, "W", 3)} / ${si(I * I * r2, "W", 3)}` },
        { label: "Thevenin resistance", value: si((r1 * r2) / (r1 + r2), "Ω") },
      ];
      let vl = vout;
      if (rl) {
        const rp = (r2 * rl) / (r2 + rl);
        vl = (vin * rp) / (r1 + rp);
        steps.push(`R2 ∥ RL = ${si(r2, "Ω")} × ${si(rl, "Ω")} ÷ (${si(r2 + rl, "Ω")}) = ${si(rp, "Ω")}`, `Vout loaded = ${si(vin, "V")} × ${si(rp, "Ω")} ÷ ${si(r1 + rp, "Ω")} = ${si(vl, "V")}`);
        outputs.unshift({ label: "Vout with load", value: si(vl, "V"), primary: true });
        outputs.push({ label: "Drop caused by load", value: `${num(((vout - vl) / vout) * 100, 4)}%` }, { label: "Load current", value: si(vl / rl, "A") });
      }
      return { outputs, steps, visual: <Schematic vin={vin} r1={r1} r2={r2} vout={vl} rl={rl} /> };
    }
    const vout = v.num("vout") as number;
    if (vout >= vin) return "A resistive divider can only produce Vout lower than Vin.";
    if (v.mode === "r2") {
      const r1 = v.num("r1") as number;
      const r2 = (r1 * vout) / (vin - vout);
      const e = nearestStandard(r2, "E24");
      const actual = (vin * e.nearest) / (r1 + e.nearest);
      return {
        outputs: [
          { label: "R2", value: si(r2, "Ω"), primary: true },
          { label: "Nearest E24 value", value: formatOhms(e.nearest) },
          { label: "Vout with E24 value", value: si(actual, "V") },
          { label: "Divider current", value: si(vin / (r1 + r2), "A") },
        ],
        steps: [`R2 = R1 × Vout ÷ (Vin − Vout) = ${si(r1, "Ω")} × ${si(vout, "V")} ÷ ${si(vin - vout, "V")} = ${si(r2, "Ω")}`],
        visual: <Schematic vin={vin} r1={r1} r2={r2} vout={vout} rl={null} />,
      };
    }
    const r2 = v.num("r2") as number;
    const r1 = (r2 * (vin - vout)) / vout;
    const e = nearestStandard(r1, "E24");
    const actual = (vin * r2) / (e.nearest + r2);
    return {
      outputs: [
        { label: "R1", value: si(r1, "Ω"), primary: true },
        { label: "Nearest E24 value", value: formatOhms(e.nearest) },
        { label: "Vout with E24 value", value: si(actual, "V") },
        { label: "Divider current", value: si(vin / (r1 + r2), "A") },
      ],
      steps: [`R1 = R2 × (Vin − Vout) ÷ Vout = ${si(r2, "Ω")} × ${si(vin - vout, "V")} ÷ ${si(vout, "V")} = ${si(r1, "Ω")}`],
      visual: <Schematic vin={vin} r1={r1} r2={r2} vout={vout} rl={null} />,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
