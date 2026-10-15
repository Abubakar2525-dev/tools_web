"use client";

import { useState } from "react";
import { Checkbox, NumberField, PrivacyNote, ResetBtn, Segmented, SelectField, TextField, ToolPanel, fmt, parseNum } from "@/components/tools/kit";
import { RATIOS, buildScale, ratioOf, scaleCss } from "./lib/typescale";
import { CodeOutput, Slider } from "./shared";

const START = {
  minBase: "16",
  maxBase: "19",
  minRatio: "1.2",
  maxRatio: "1.25",
  minCustom: "1.2",
  maxCustom: "1.25",
  minVw: "360",
  maxVw: "1280",
  up: "5",
  down: "2",
};

const ratioOptions = [...RATIOS.map((r) => ({ value: r.value, label: r.label })), { value: "custom", label: "Custom" }];

export default function Tool() {
  const [v, setV] = useState(START);
  const [fluid, setFluid] = useState(true);
  const [naming, setNaming] = useState<"step" | "tshirt">("step");
  const [sample, setSample] = useState("The quick brown fox");
  const [previewW, setPreviewW] = useState(1280);
  const set = (k: keyof typeof START, val: string) => setV((o) => ({ ...o, [k]: val }));

  const n = (k: keyof typeof START) => parseNum(v[k]);
  const errors: Partial<Record<keyof typeof START, string>> = {};
  const pos = (k: keyof typeof START, lo: number, hi: number, label: string) => {
    const x = n(k);
    if (x === null || x < lo || x > hi) errors[k] = `${label} must be between ${lo} and ${hi}.`;
  };
  pos("minBase", 8, 64, "Size");
  pos("up", 0, 10, "Steps");
  pos("down", 0, 5, "Steps");
  if (v.minRatio === "custom") pos("minCustom", 1.01, 3, "Ratio");
  if (fluid) {
    pos("maxBase", 8, 64, "Size");
    pos("minVw", 200, 3000, "Width");
    pos("maxVw", 200, 4000, "Width");
    if (v.maxRatio === "custom") pos("maxCustom", 1.01, 3, "Ratio");
    if (!errors.minVw && !errors.maxVw && (n("maxVw") as number) <= (n("minVw") as number)) errors.maxVw = "Must be larger than the minimum width.";
  }
  const ok = Object.keys(errors).length === 0;

  const minRatio = ratioOf(v.minRatio, n("minCustom"));
  const maxRatio = ratioOf(v.maxRatio, n("maxCustom"));
  const steps = (() => {
    if (!ok || !minRatio || (fluid && !maxRatio)) return [];
    return buildScale({
      minBase: n("minBase") as number,
      minRatio,
      maxBase: fluid ? (n("maxBase") as number) : (n("minBase") as number),
      maxRatio: fluid ? (maxRatio as number) : minRatio,
      minVw: n("minVw") ?? 360,
      maxVw: n("maxVw") ?? 1280,
      up: Math.round(n("up") as number),
      down: Math.round(n("down") as number),
      fluid,
    });
  })();

  const minVw = n("minVw") ?? 360;
  const maxVw = n("maxVw") ?? 1280;
  const sizeAt = (minPx: number, maxPx: number) => {
    if (!fluid) return minPx;
    const t = Math.min(1, Math.max(0, (previewW - minVw) / (maxVw - minVw)));
    return minPx + (maxPx - minPx) * t;
  };
  const css = steps.length ? scaleCss(steps, naming, naming === "step" ? "step" : "text") : "";

  return (
    <div className="space-y-5">
      <ToolPanel title="Scale settings" actions={<ResetBtn onClick={() => { setV(START); setFluid(true); }} />}>
        <div className="mb-5">
          <Checkbox label="Fluid sizes with clamp()" hint="Sizes grow smoothly from the minimum to the maximum viewport width." checked={fluid} onChange={setFluid} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label={fluid ? "Base size at min width (px)" : "Base size (px)"} value={v.minBase} onChange={(e) => set("minBase", e.target.value)} error={errors.minBase} />
          <SelectField label={fluid ? "Ratio at min width" : "Ratio"} value={v.minRatio} onChange={(e) => set("minRatio", e.target.value)} options={ratioOptions} />
          {v.minRatio === "custom" && <NumberField label="Custom ratio" value={v.minCustom} onChange={(e) => set("minCustom", e.target.value)} error={errors.minCustom} />}
          {fluid && (
            <>
              <NumberField label="Base size at max width (px)" value={v.maxBase} onChange={(e) => set("maxBase", e.target.value)} error={errors.maxBase} />
              <SelectField label="Ratio at max width" value={v.maxRatio} onChange={(e) => set("maxRatio", e.target.value)} options={ratioOptions} />
              {v.maxRatio === "custom" && <NumberField label="Custom ratio (max)" value={v.maxCustom} onChange={(e) => set("maxCustom", e.target.value)} error={errors.maxCustom} />}
              <NumberField label="Min viewport width (px)" value={v.minVw} onChange={(e) => set("minVw", e.target.value)} error={errors.minVw} />
              <NumberField label="Max viewport width (px)" value={v.maxVw} onChange={(e) => set("maxVw", e.target.value)} error={errors.maxVw} />
            </>
          )}
          <NumberField label="Steps above base" value={v.up} onChange={(e) => set("up", e.target.value)} error={errors.up} />
          <NumberField label="Steps below base" value={v.down} onChange={(e) => set("down", e.target.value)} error={errors.down} />
        </div>
      </ToolPanel>

      {steps.length > 0 && (
        <ToolPanel title="Preview">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Sample text" value={sample} maxLength={80} onChange={(e) => setSample(e.target.value)} />
            {fluid && <Slider label="Preview at viewport width" value={previewW} onChange={setPreviewW} min={Math.round(Math.min(minVw, maxVw))} max={Math.round(Math.max(minVw, maxVw))} unit="px" />}
          </div>
          <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
            {steps.map((s) => {
              const px = sizeAt(s.minPx, s.maxPx);
              return (
                <li key={s.step} className="grid gap-1 bg-surface px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
                  <span className="text-[0.8125rem] text-muted tabular-nums">
                    {naming === "step" ? `step ${s.step}` : s.name} · {fmt(px, 1)}px
                  </span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-ink" style={{ fontSize: px, lineHeight: 1.2 }}>
                    {sample || "Aa"}
                  </span>
                </li>
              );
            })}
          </ul>
        </ToolPanel>
      )}

      {steps.length > 0 && (
        <ToolPanel title="CSS custom properties">
          <div className="mb-4">
            <Segmented
              label="Variable names"
              value={naming}
              onChange={setNaming}
              options={[
                { value: "step", label: "--step-n" },
                { value: "tshirt", label: "--text-sm/lg" },
              ]}
            />
          </div>
          <div className="mb-5 overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["Step", "Name", fluid ? "Min (px)" : "Size (px)", ...(fluid ? ["Max (px)"] : []), "Value"].map((c) => (
                    <th key={c} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.step} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 tabular-nums text-ink-2">{s.step}</td>
                    <td className="px-4 py-2 text-ink-2">{s.name}</td>
                    <td className="px-4 py-2 tabular-nums text-ink-2">{fmt(s.minPx, 2)}</td>
                    {fluid && <td className="px-4 py-2 tabular-nums text-ink-2">{fmt(s.maxPx, 2)}</td>}
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-[0.8rem] text-ink-2">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CodeOutput code={css} label="CSS" filename="type-scale.css" />
          <p className="mt-3 text-[0.8125rem] text-muted">
            rem values assume a 16px root size. Because the preferred value mixes rem and vw, text still scales when people change their browser
            font size.
          </p>
        </ToolPanel>
      )}
      <PrivacyNote />
    </div>
  );
}
