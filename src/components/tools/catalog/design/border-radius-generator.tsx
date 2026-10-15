"use client";

import { useState } from "react";
import { Btn, Checkbox, PrivacyNote, ResetBtn, Segmented, ToolPanel } from "@/components/tools/kit";
import { borderRadiusCss, type Corner, type RadiusUnit } from "./lib/css";
import { CodeOutput, ColorInput, Slider } from "./shared";

type Corners = [Corner, Corner, Corner, Corner];
const NAMES = ["Top left", "Top right", "Bottom right", "Bottom left"];
const START: Corners = [
  { h: 24, v: 24 },
  { h: 24, v: 24 },
  { h: 24, v: 24 },
  { h: 24, v: 24 },
];

const PRESETS: { name: string; unit: RadiusUnit; c: Corners }[] = [
  { name: "Pill", unit: "px", c: [{ h: 999, v: 999 }, { h: 999, v: 999 }, { h: 999, v: 999 }, { h: 999, v: 999 }] },
  { name: "Circle / ellipse", unit: "%", c: [{ h: 50, v: 50 }, { h: 50, v: 50 }, { h: 50, v: 50 }, { h: 50, v: 50 }] },
  { name: "Leaf", unit: "px", c: [{ h: 0, v: 0 }, { h: 80, v: 80 }, { h: 0, v: 0 }, { h: 80, v: 80 }] },
  { name: "Speech bubble", unit: "px", c: [{ h: 24, v: 24 }, { h: 24, v: 24 }, { h: 24, v: 24 }, { h: 4, v: 4 }] },
  { name: "Blob", unit: "%", c: [{ h: 30, v: 30 }, { h: 70, v: 30 }, { h: 70, v: 70 }, { h: 30, v: 70 }] },
  { name: "Tab", unit: "px", c: [{ h: 16, v: 16 }, { h: 16, v: 16 }, { h: 0, v: 0 }, { h: 0, v: 0 }] },
];

export default function Tool() {
  const [corners, setCorners] = useState<Corners>(START);
  const [unit, setUnit] = useState<RadiusUnit>("px");
  const [linked, setLinked] = useState(true);
  const [elliptical, setElliptical] = useState(false);
  const [w, setW] = useState(260);
  const [h, setH] = useState(180);
  const [fill, setFill] = useState("#0f766e");

  const max = unit === "%" ? 50 : unit === "rem" ? 20 : 200;
  const step = unit === "rem" ? 0.125 : 1;
  const effective: Corners = elliptical ? corners : (corners.map((c) => ({ h: c.h, v: c.h })) as Corners);
  const value = borderRadiusCss(effective, unit);

  const setCorner = (i: number, axis: "h" | "v", v: number) =>
    setCorners((cs) => cs.map((c, j) => (linked || j === i ? { ...c, [axis]: v, ...(elliptical ? {} : { v }) } : c)) as Corners);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ToolPanel
          title="Corners"
          actions={
            <ResetBtn
              onClick={() => {
                setCorners(START);
                setUnit("px");
                setElliptical(false);
                setLinked(true);
              }}
            />
          }
        >
          <div className="space-y-4">
            <Segmented
              label="Unit"
              value={unit}
              onChange={(u) => {
                setUnit(u);
                const lim = u === "%" ? 50 : u === "rem" ? 20 : 200;
                setCorners((cs) => cs.map((c) => ({ h: Math.min(c.h, lim), v: Math.min(c.v, lim) })) as Corners);
              }}
              options={[
                { value: "px", label: "px" },
                { value: "%", label: "%" },
                { value: "rem", label: "rem" },
              ]}
            />
            <div className="flex flex-wrap gap-6">
              <Checkbox label="Same radius for all corners" checked={linked} onChange={setLinked} />
              <Checkbox label="Elliptical corners" hint="Separate horizontal and vertical radii." checked={elliptical} onChange={setElliptical} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(linked ? [0] : [0, 1, 2, 3]).map((i) => (
                <fieldset key={i} className="rounded-xl bg-sunken p-4">
                  <legend className="sr-only">{linked ? "All corners" : NAMES[i]}</legend>
                  <p className="mb-2 text-sm font-semibold text-ink">{linked ? "All corners" : NAMES[i]}</p>
                  <Slider
                    label={elliptical ? "Horizontal radius" : "Radius"}
                    value={corners[i].h}
                    onChange={(v) => setCorner(i, "h", v)}
                    min={0}
                    max={Math.max(max, corners[i].h)}
                    step={step}
                    unit={unit}
                  />
                  {elliptical && (
                    <Slider label="Vertical radius" value={corners[i].v} onChange={(v) => setCorner(i, "v", v)} min={0} max={Math.max(max, corners[i].v)} step={step} unit={unit} />
                  )}
                </fieldset>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Btn
                  key={p.name}
                  variant="subtle"
                  onClick={() => {
                    setUnit(p.unit);
                    setCorners(p.c);
                    const ell = p.c.some((c) => c.h !== c.v);
                    setElliptical(ell);
                    setLinked(p.c.every((c) => c.h === p.c[0].h && c.v === p.c[0].v));
                  }}
                >
                  {p.name}
                </Btn>
              ))}
            </div>
          </div>
        </ToolPanel>

        <ToolPanel title="Preview">
          <div className="grid min-h-72 place-items-center overflow-hidden rounded-xl bg-sunken p-6 shadow-[0_0_0_1px_var(--line)]">
            <div
              style={{ width: w, height: h, maxWidth: "100%", background: fill, borderRadius: value }}
              role="img"
              aria-label={`Shape with border-radius ${value}`}
            />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Slider label="Preview width" value={w} onChange={setW} min={40} max={400} unit="px" />
            <Slider label="Preview height" value={h} onChange={setH} min={40} max={400} unit="px" />
            <ColorInput label="Fill" value={fill} onChange={setFill} />
          </div>
          <div className="mt-5">
            <CodeOutput code={`border-radius: ${value};`} label="CSS (shortest form)" filename="border-radius.css" />
          </div>
          <p className="mt-3 text-[0.8125rem] text-muted">
            When two radii on one side add up to more than that side, browsers scale all corners down proportionally, so very large values
            make a pill rather than overlapping curves.
          </p>
        </ToolPanel>
      </div>
      <PrivacyNote />
    </div>
  );
}
