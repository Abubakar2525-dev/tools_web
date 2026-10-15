"use client";

import { useMemo, useState } from "react";
import {
  Btn,
  CellInput,
  CellSelect,
  CopyBtn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  SelectField,
  StatGrid,
  ToolPanel,
  parseNum,
  uid,
} from "@/components/tools/kit";
import { num } from "@/components/tools/engines/FormulaTool";
import { Figure } from "./ui";
import { solveBeam, validateBeam, type BeamResult, type Load, type Support } from "./lib/beam";

type System = "si" | "us";
type Row = { id: string; kind: "point" | "udl"; mag: string; a: string; b: string };

const UNITS = {
  si: { len: "m", force: "kN", dist: "kN/m", E: "GPa", I: "cm⁴", defl: "mm", moment: "kN·m", toL: 1, toF: 1e3, toE: 1e9, toI: 1e-8, deflOut: 1e3 },
  us: { len: "ft", force: "kip", dist: "kip/ft", E: "ksi", I: "in⁴", defl: "in", moment: "kip·ft", toL: 0.3048, toF: 4448.2216152605, toE: 6894757.293168, toI: 0.0254 ** 4, deflOut: 1 / 0.0254 },
} as const;

const MATERIALS: Record<System, { value: string; label: string }[]> = {
  si: [
    { value: "", label: "Custom" },
    { value: "200", label: "Structural steel (200 GPa)" },
    { value: "69", label: "Aluminum alloy (69 GPa)" },
    { value: "11", label: "Softwood timber, typical (11 GPa)" },
    { value: "30", label: "Concrete, typical (30 GPa)" },
  ],
  us: [
    { value: "", label: "Custom" },
    { value: "29000", label: "Structural steel (29,000 ksi)" },
    { value: "10000", label: "Aluminum alloy (10,000 ksi)" },
    { value: "1600", label: "Softwood timber, typical (1,600 ksi)" },
    { value: "4350", label: "Concrete, typical (4,350 ksi)" },
  ],
};

function parseInputs(L: string, E: string, I: string, rows: Row[], support: Support, system: System) {
  const u = UNITS[system];
  const Lv = parseNum(L);
  const Ev = parseNum(E);
  const Iv = parseNum(I);
  if (Lv === null || Ev === null || Iv === null) return { kind: "error" as const, error: "Enter the beam length, E and I." };
  const loads: Load[] = [];
  for (const [i, r] of rows.entries()) {
    const m = parseNum(r.mag);
    const a = parseNum(r.a);
    const b = r.kind === "udl" ? parseNum(r.b) : 0;
    if (m === null || a === null || b === null) return { kind: "error" as const, error: `Load ${i + 1}: fill in every field with a number.` };
    if (r.kind === "point") loads.push({ kind: "point", P: m * u.toF, a: a * u.toL });
    else loads.push({ kind: "udl", w: (m * u.toF) / u.toL, start: a * u.toL, end: b * u.toL });
  }
  const input = { L: Lv * u.toL, support, E: Ev * u.toE, I: Iv * u.toI, loads };
  const err = validateBeam(input);
  if (err) return { kind: "error" as const, error: err };
  return { kind: "ok" as const, input, result: solveBeam(input) };
}

const initialRows = (): Row[] => [{ id: uid(), kind: "point", mag: "20", a: "3", b: "" }];

export default function Tool() {
  const [support, setSupport] = useState<Support>("simple");
  const [system, setSystem] = useState<System>("si");
  const [L, setL] = useState("6");
  const [E, setE] = useState("200");
  const [I, setI] = useState("8000");
  const [rows, setRows] = useState<Row[]>(initialRows);

  const u = UNITS[system];

  const parsed = useMemo(() => parseInputs(L, E, I, rows, support, system), [L, E, I, rows, support, system]);

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const reset = () => {
    setSupport("simple");
    setSystem("si");
    setL("6");
    setE("200");
    setI("8000");
    setRows(initialRows());
  };

  const changeSystem = (s: System) => {
    setSystem(s);
    if (s === "us") {
      setL("20");
      setE("29000");
      setI("200");
      setRows([{ id: uid(), kind: "point", mag: "5", a: "10", b: "" }]);
    } else reset();
  };

  const F = (n: number) => `${num(n / u.toF, 5)} ${u.force}`;
  const Mf = (n: number) => `${num(n / (u.toF * u.toL), 5)} ${u.moment}`;
  const X = (n: number) => `${num(n / u.toL, 4)} ${u.len}`;
  const D = (n: number) => `${num(n * u.deflOut, 4)} ${u.defl}`;
  const Wd = (n: number) => `${num((n * u.toL) / u.toF, 5)} ${u.dist}`;

  const res = parsed.kind === "ok" ? parsed.result : null;
  const summary = res
    ? [
        support === "simple" ? `Reaction A (x = 0): ${F(res.RA)}` : `Fixed-end reaction: ${F(res.RA)}`,
        support === "simple" ? `Reaction B (x = L): ${F(res.RB)}` : `Fixed-end moment: ${Mf(res.MA)}`,
        `Max sagging moment: ${Mf(res.maxMoment.value)} at x = ${X(res.maxMoment.x)}`,
        `Max hogging moment: ${Mf(res.minMoment.value)} at x = ${X(res.minMoment.x)}`,
        `Max shear: ${F(res.maxShear.value)} at x = ${X(res.maxShear.x)}`,
        `Max deflection: ${D(res.maxDeflection.value)} at x = ${X(res.maxDeflection.x)}`,
      ].join("\n")
    : "";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <ToolPanel title="Beam" actions={<ResetBtn onClick={reset} />}>
          <div className="space-y-5">
            <Segmented
              label="Support type"
              value={support}
              onChange={setSupport}
              options={[
                { value: "simple", label: "Simply supported" },
                { value: "cantilever", label: "Cantilever (fixed at left)" },
              ]}
            />
            <Segmented
              label="Units"
              value={system}
              onChange={changeSystem}
              options={[
                { value: "si", label: "SI (m, kN)" },
                { value: "us", label: "US (ft, kip)" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label={`Span L (${u.len})`} value={L} onChange={(e) => setL(e.target.value)} />
              <SelectField label="Material preset" value={MATERIALS[system].some((m) => m.value === E) ? E : ""} onChange={(e) => e.target.value && setE(e.target.value)} options={MATERIALS[system]} />
              <NumberField label={`Elastic modulus E (${u.E})`} value={E} onChange={(e) => setE(e.target.value)} />
              <NumberField label={`Second moment of area I (${u.I})`} value={I} onChange={(e) => setI(e.target.value)} hint="From the section table, about the bending axis." />
            </div>
          </div>
        </ToolPanel>

        <ToolPanel title="Loads">
          <p className="mb-4 text-[0.8125rem] text-muted">
            Downward loads are positive. Positions are measured from the left end{support === "cantilever" ? " (the fixed support)" : ""}.
          </p>
          <ul className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.id} className="rounded-xl bg-sunken p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <span className="w-full text-sm font-medium text-ink">Load {i + 1}</span>
                  <CellSelect
                    label={`Load ${i + 1} type`}
                    className="w-full sm:w-36"
                    value={r.kind}
                    onChange={(e) => update(r.id, { kind: e.target.value as Row["kind"], b: e.target.value === "udl" && !r.b ? String(parseNum(L) ?? "") : r.b })}
                    options={[
                      { value: "point", label: "Point load" },
                      { value: "udl", label: "Distributed (UDL)" },
                    ]}
                  />
                  <label className="flex min-w-[7rem] flex-1 flex-col text-[0.8125rem] text-muted">
                    {r.kind === "point" ? `P (${u.force})` : `w (${u.dist})`}
                    <CellInput label={`Load ${i + 1} magnitude`} inputMode="decimal" value={r.mag} onChange={(e) => update(r.id, { mag: e.target.value })} />
                  </label>
                  <label className="flex min-w-[6rem] flex-1 flex-col text-[0.8125rem] text-muted">
                    {r.kind === "point" ? `at x (${u.len})` : `from x (${u.len})`}
                    <CellInput label={`Load ${i + 1} ${r.kind === "point" ? "position" : "start"}`} inputMode="decimal" value={r.a} onChange={(e) => update(r.id, { a: e.target.value })} />
                  </label>
                  {r.kind === "udl" && (
                    <label className="flex min-w-[6rem] flex-1 flex-col text-[0.8125rem] text-muted">
                      to x ({u.len})
                      <CellInput label={`Load ${i + 1} end`} inputMode="decimal" value={r.b} onChange={(e) => update(r.id, { b: e.target.value })} />
                    </label>
                  )}
                  <Btn variant="danger" icon="trash" aria-label={`Remove load ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="min-h-10">
                    <span className="sr-only sm:not-sr-only">Remove</span>
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn variant="ghost" icon="plus" onClick={() => setRows((rs) => [...rs, { id: uid(), kind: "point", mag: "10", a: String((parseNum(L) ?? 0) / 2), b: "" }])}>
              Add point load
            </Btn>
            <Btn variant="ghost" icon="plus" onClick={() => setRows((rs) => [...rs, { id: uid(), kind: "udl", mag: "5", a: "0", b: String(parseNum(L) ?? "") }])}>
              Add UDL
            </Btn>
          </div>
        </ToolPanel>
      </div>

      <ToolPanel title="Results" actions={summary ? <CopyBtn text={summary} label="Copy results" /> : undefined}>
        {parsed.kind === "error" ? (
          parsed.error.startsWith("Enter") ? (
            <EmptyState icon="calculator" title="Enter the beam and its loads" />
          ) : (
            <Notice tone="error">{parsed.error}</Notice>
          )
        ) : (
          res && (
            <div className="space-y-5">
              <ResultCard label="Maximum deflection" value={D(Math.abs(res.maxDeflection.value))} detail={`${res.maxDeflection.value <= 0 ? "Downward" : "Upward"} at x = ${X(res.maxDeflection.x)}. Span/deflection = ${num(parsed.input.L / Math.abs(res.maxDeflection.value || 1e-30), 4)}.`} />
              <StatGrid
                items={[
                  ...(support === "simple"
                    ? [
                        { label: "Reaction A (x = 0)", value: F(res.RA) },
                        { label: "Reaction B (x = L)", value: F(res.RB) },
                      ]
                    : [
                        { label: "Fixed-end reaction", value: F(res.RA) },
                        { label: "Fixed-end moment", value: Mf(res.MA) },
                      ]),
                  { label: "Max sagging moment", value: `${Mf(res.maxMoment.value)} @ ${X(res.maxMoment.x)}` },
                  { label: "Max hogging moment", value: `${Mf(res.minMoment.value)} @ ${X(res.minMoment.x)}` },
                  { label: "Max |shear|", value: `${F(Math.abs(res.maxShear.value))} @ ${X(res.maxShear.x)}` },
                  { label: "Total load", value: F(res.totalLoad) },
                ]}
              />
              <Diagrams res={res} L={parsed.input.L} loads={parsed.input.loads} support={support} fmt={{ F, Mf, X, D, W: Wd }} />
              <Notice>
                Sign convention: loads positive downward, reactions positive upward, shear is the net upward force left of the section, sagging moment is positive, deflection is
                positive upward (negative values sag down). Deflection integrates M ÷ EI numerically over {res.xs.length.toLocaleString()} points (small-deflection Euler-Bernoulli theory, self-weight not included unless you add it as a UDL).
              </Notice>
            </div>
          )
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}

type Fmt = { F: (n: number) => string; Mf: (n: number) => string; X: (n: number) => string; D: (n: number) => string; W: (n: number) => string };

function Diagrams({ res, L, loads, support, fmt }: { res: BeamResult; L: number; loads: Load[]; support: Support; fmt: Fmt }) {
  const W = 600,
    left = 50,
    right = 30;
  const plotW = W - left - right;
  const sx = (x: number) => left + (x / L) * plotW;

  const chart = (values: number[], top: number, h: number, label: string, f: (n: number) => string, invert = false, marks: number[] = []) => {
    const max = Math.max(...values.map(Math.abs), 1e-30);
    const mid = top + h / 2;
    const sy = (v: number) => mid - ((invert ? -v : v) / max) * (h / 2 - 8);
    const pts = res.xs.map((x, i) => `${sx(x).toFixed(1)},${sy(values[i]).toFixed(1)}`);
    const area = `${sx(0)},${mid} ${pts.join(" ")} ${sx(L)},${mid}`;
    return (
      <g>
        <text x={6} y={top + 12} className="fill-ink text-[12px] font-semibold">
          {label}
        </text>
        <polygon points={area} className="fill-accent-soft" />
        <line x1={sx(0)} y1={mid} x2={sx(L)} y2={mid} className="stroke-line-strong" />
        <polyline points={pts.join(" ")} fill="none" className="stroke-accent-strong" strokeWidth={1.8} />
        {marks.map((i) => {
          const x = sx(res.xs[i]);
          const y = sy(values[i]);
          const above = y < mid || (y === mid && !invert);
          return (
            <g key={`${label}-${i}`}>
              <circle cx={x} cy={y} r={3} className="fill-ink" />
              <text x={Math.min(Math.max(x, left + 30), W - 40)} y={above ? y - 6 : y + 14} textAnchor="middle" className="fill-ink text-[11px]">
                {f(values[i])}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  const idxOf = (arr: number[], pick: (a: number, b: number) => boolean) => {
    let k = 0;
    for (let i = 1; i < arr.length; i++) if (pick(arr[i], arr[k])) k = i;
    return k;
  };
  const vMax = idxOf(res.V, (a, b) => a > b);
  const vMin = idxOf(res.V, (a, b) => a < b);
  const mMax = idxOf(res.M, (a, b) => a > b);
  const mMin = idxOf(res.M, (a, b) => a < b);
  const yMax = idxOf(res.y, (a, b) => Math.abs(a) > Math.abs(b));
  const uniq = (xs: number[], values: number[]) => [...new Set(xs)].filter((i) => Math.abs(values[i]) > 1e-9 * Math.max(...values.map(Math.abs)));

  const beamY = 70;
  const maxP = Math.max(...loads.map((l) => Math.abs(l.kind === "point" ? l.P : l.w * L)), 1e-30);

  const desc = `Shear ranges from ${fmt.F(res.V[vMin])} to ${fmt.F(res.V[vMax])}. Moment ranges from ${fmt.Mf(res.M[mMin])} to ${fmt.Mf(res.M[mMax])}. Maximum deflection ${fmt.D(Math.abs(res.y[yMax]))} at x = ${fmt.X(res.xs[yMax])}.`;

  return (
    <Figure viewBox={`0 0 ${W} 560`} title="Load, shear, moment and deflection diagrams" desc={desc} maxWidth={720}>
      {/* Loading diagram */}
      <text x={6} y={14} className="fill-ink text-[12px] font-semibold">
        Loading
      </text>
      <rect x={sx(0)} y={beamY - 4} width={plotW} height={8} className="fill-ink" />
      {support === "simple" ? (
        <>
          <polygon points={`${sx(0)},${beamY + 4} ${sx(0) - 10},${beamY + 22} ${sx(0) + 10},${beamY + 22}`} className="fill-none stroke-ink" strokeWidth={2} />
          <circle cx={sx(L)} cy={beamY + 13} r={8} className="fill-none stroke-ink" strokeWidth={2} />
          <line x1={sx(L) - 14} y1={beamY + 23} x2={sx(L) + 14} y2={beamY + 23} className="stroke-ink" strokeWidth={2} />
          <text x={sx(0)} y={beamY + 38} textAnchor="middle" className="fill-ink-2 text-[11px]">
            A: {fmt.F(res.RA)}
          </text>
          <text x={sx(L)} y={beamY + 38} textAnchor="middle" className="fill-ink-2 text-[11px]">
            B: {fmt.F(res.RB)}
          </text>
        </>
      ) : (
        <>
          <line x1={sx(0)} y1={beamY - 30} x2={sx(0)} y2={beamY + 30} className="stroke-ink" strokeWidth={3} />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <line key={k} x1={sx(0)} y1={beamY - 28 + k * 11} x2={sx(0) - 10} y2={beamY - 20 + k * 11} className="stroke-ink" strokeWidth={1.5} />
          ))}
          <text x={sx(0) + 4} y={beamY + 42} className="fill-ink-2 text-[11px]">
            R = {fmt.F(res.RA)}, M = {fmt.Mf(res.MA)}
          </text>
        </>
      )}
      {loads.map((l, k) => {
        if (l.kind === "point") {
          const x = sx(l.a);
          const len = 18 + 22 * (Math.abs(l.P) / maxP);
          const down = l.P >= 0;
          const y1 = down ? beamY - 6 - len : beamY - 6;
          const y2 = down ? beamY - 6 : beamY - 6 - len;
          return (
            <g key={k} className="stroke-accent-strong" strokeWidth={2}>
              <line x1={x} y1={y1} x2={x} y2={y2} />
              <polyline points={down ? `${x - 5},${y2 - 7} ${x},${y2} ${x + 5},${y2 - 7}` : `${x - 5},${y2 + 7} ${x},${y2} ${x + 5},${y2 + 7}`} fill="none" />
              <text x={x} y={Math.min(y1, y2) - 4} textAnchor="middle" className="fill-ink stroke-none text-[11px]">
                {fmt.F(l.P)}
              </text>
            </g>
          );
        }
        const x1 = sx(l.start),
          x2 = sx(l.end);
        const n = Math.max(2, Math.round((x2 - x1) / 18));
        return (
          <g key={k} className="stroke-ink-2" strokeWidth={1.3}>
            <line x1={x1} y1={beamY - 30} x2={x2} y2={beamY - 30} />
            {Array.from({ length: n + 1 }, (_, i) => {
              const x = x1 + ((x2 - x1) * i) / n;
              return (
                <g key={i}>
                  <line x1={x} y1={beamY - 30} x2={x} y2={beamY - 7} />
                  <polyline points={`${x - 3},${beamY - 12} ${x},${beamY - 7} ${x + 3},${beamY - 12}`} fill="none" />
                </g>
              );
            })}
            <text x={(x1 + x2) / 2} y={beamY - 35} textAnchor="middle" className="fill-ink stroke-none text-[11px]">
              {fmt.W(l.w)}
            </text>
          </g>
        );
      })}

      {chart(res.V, 130, 130, "Shear V", fmt.F, false, uniq([vMax, vMin], res.V))}
      {chart(res.M, 275, 140, "Moment M (sagging +)", fmt.Mf, false, uniq([mMax, mMin], res.M))}
      {chart(res.y, 430, 110, "Deflection", fmt.D, false, uniq([yMax], res.y))}
      <text x={sx(0)} y={555} textAnchor="middle" className="fill-muted text-[11px]">
        0
      </text>
      <text x={sx(L)} y={555} textAnchor="middle" className="fill-muted text-[11px]">
        {fmt.X(L)}
      </text>
    </Figure>
  );
}
