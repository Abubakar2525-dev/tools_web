"use client";

import { useState } from "react";
import { CopyBtn, NumberField, PrivacyNote, ResetBtn, Segmented, SelectField, StatGrid, ToolPanel, parseNum } from "@/components/tools/kit";
import { num } from "@/components/tools/engines/FormulaTool";
import { paperDims, paperFamilies, paperSizes, pixelsAt, type PaperSize } from "./lib/sizes";

const FAMILY_OPTIONS = [{ value: "all", label: "All families" }, ...paperFamilies.map((f) => ({ value: f, label: f }))];
const DPI_OPTIONS = ["72", "96", "150", "300", "600", "custom"].map((d) => ({ value: d, label: d === "custom" ? "Custom" : `${d} DPI` }));
const keyOf = (p: PaperSize) => `${p.family}|${p.name}`;
const DEFAULT_KEY = keyOf(paperSizes.find((p) => p.name === "A4")!);

function dims(p: PaperSize, landscape: boolean) {
  const d = paperDims(p);
  const swap = landscape ? d.wMm < d.hMm : d.wMm > d.hMm;
  return swap ? { wMm: d.hMm, hMm: d.wMm, wIn: d.hIn, hIn: d.wIn, wPt: d.hPt, hPt: d.wPt } : d;
}

const mm = (x: number) => num(Math.round(x * 10) / 10);
const inch = (x: number) => num(Math.round(x * 100) / 100);
const pt = (x: number) => num(Math.round(x * 10) / 10);

export default function Tool() {
  const [family, setFamily] = useState("all");
  const [selected, setSelected] = useState(DEFAULT_KEY);
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait");
  const [dpiChoice, setDpiChoice] = useState("300");
  const [customDpi, setCustomDpi] = useState("200");

  const list = family === "all" ? paperSizes : paperSizes.filter((p) => p.family === family);
  const current = paperSizes.find((p) => keyOf(p) === selected) ?? paperSizes[0];
  const landscape = orient === "landscape";
  const d = dims(current, landscape);

  const cd = parseNum(customDpi);
  const dpiErr = dpiChoice === "custom" && (cd === null || cd <= 0 || cd > 10000) ? "Enter a DPI between 1 and 10000." : null;
  const dpi = dpiChoice === "custom" ? (dpiErr ? null : cd) : Number(dpiChoice);

  const px = dpi ? `${pixelsAt(d.wIn, dpi).toLocaleString("en-US")} × ${pixelsAt(d.hIn, dpi).toLocaleString("en-US")} px` : "n/a";
  const summary = `${current.name}: ${mm(d.wMm)} × ${mm(d.hMm)} mm, ${inch(d.wIn)} × ${inch(d.hIn)} in, ${pt(d.wPt)} × ${pt(d.hPt)} pt${dpi ? `, ${px} at ${num(dpi)} DPI` : ""}`;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Look up a size"
        actions={
          <>
            <CopyBtn text={summary} label="Copy dimensions" />
            <ResetBtn
              onClick={() => {
                setFamily("all");
                setSelected(DEFAULT_KEY);
                setOrient("portrait");
                setDpiChoice("300");
                setCustomDpi("200");
              }}
            />
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Family"
            value={family}
            onChange={(e) => {
              const f = e.target.value;
              setFamily(f);
              const first = f === "all" ? null : paperSizes.find((p) => p.family === f);
              if (first && current.family !== f) setSelected(keyOf(first));
            }}
            options={FAMILY_OPTIONS}
          />
          <SelectField
            label="Paper size"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            options={list.map((p) => ({ value: keyOf(p), label: family === "all" ? `${p.name} (${p.family})` : p.name }))}
          />
          <SelectField label="Pixels at" value={dpiChoice} onChange={(e) => setDpiChoice(e.target.value)} options={DPI_OPTIONS} />
          {dpiChoice === "custom" && (
            <NumberField label="Custom DPI" value={customDpi} onChange={(e) => setCustomDpi(e.target.value)} error={dpiErr} />
          )}
        </div>
        <div className="mt-5">
          <Segmented
            label="Orientation"
            value={orient}
            onChange={setOrient}
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
        </div>
        <div className="mt-6" aria-live="polite">
          <p className="mb-3 text-sm text-ink-2">
            <strong className="text-ink">{current.name}</strong> · {current.family}
            {current.note ? ` · ${current.note}` : ""}
          </p>
          <StatGrid
            items={[
              { label: "Millimeters", value: `${mm(d.wMm)} × ${mm(d.hMm)}` },
              { label: "Centimeters", value: `${num(Math.round(d.wMm) / 10)} × ${num(Math.round(d.hMm) / 10)}` },
              { label: "Inches", value: `${inch(d.wIn)} × ${inch(d.hIn)}` },
              { label: "Points (1/72 in)", value: `${pt(d.wPt)} × ${pt(d.hPt)}` },
              { label: dpi ? `Pixels at ${num(dpi)} DPI` : "Pixels", value: px.replace(" px", "") },
              { label: "Aspect ratio", value: `1 : ${num(Math.max(d.wMm, d.hMm) / Math.min(d.wMm, d.hMm), 4)}` },
            ]}
          />
        </div>
      </ToolPanel>

      <ToolPanel title={family === "all" ? "All paper sizes" : family}>
        <div className="max-h-[560px] overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label="Paper size table">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Paper sizes in {orient} orientation with pixels at the chosen DPI.</caption>
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line">
                {["Size", "mm", "inches", "points", dpi ? `px at ${num(dpi)} DPI` : "px"].map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const r = dims(p, landscape);
                const active = keyOf(p) === selected;
                return (
                  <tr key={keyOf(p)} className={`border-b border-line last:border-0 ${active ? "bg-accent-soft" : ""}`}>
                    <th scope="row" className="whitespace-nowrap px-4 py-2 text-left font-medium text-ink">
                      <button type="button" className="min-h-10 underline-offset-2 hover:underline" onClick={() => setSelected(keyOf(p))} aria-pressed={active}>
                        {p.name}
                      </button>
                      {family === "all" && <span className="ml-2 font-normal text-muted">{p.family.split(" (")[0]}</span>}
                    </th>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">
                      {mm(r.wMm)} × {mm(r.hMm)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">
                      {inch(r.wIn)} × {inch(r.hIn)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">
                      {pt(r.wPt)} × {pt(r.hPt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">{dpi ? `${pixelsAt(r.wIn, dpi)} × ${pixelsAt(r.hIn, dpi)}` : "n/a"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[0.8125rem] text-muted">
          ISO and JIS sizes are defined in whole millimeters; North American, ANSI and architectural sizes are defined in inches. Converted values are rounded for
          display, and pixel counts are rounded to the nearest pixel.
        </p>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
