"use client";

import { useState } from "react";
import { PrivacyNote, ResetBtn, Segmented, ToolPanel } from "@/components/tools/kit";
import { neumorphism, type NeuLight, type NeuShape } from "./lib/css";
import { CodeOutput, ColorInput, Slider } from "./shared";

const START = { color: "#e0e5ec", size: 180, radius: 32, distance: 14, blur: 28, intensity: 0.07, shape: "flat" as NeuShape, light: "top-left" as NeuLight };

const LIGHTS: { value: NeuLight; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
];

export default function Tool() {
  const [o, setO] = useState(START);
  const set = <K extends keyof typeof START>(k: K, v: (typeof START)[K]) => setO((x) => ({ ...x, [k]: v }));
  const r = neumorphism(o);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ToolPanel title="Preview">
          <div className="grid min-h-80 place-items-center overflow-hidden rounded-xl p-8" style={{ background: r.surface }}>
            <div
              style={{ width: o.size, height: o.size, maxWidth: "100%", borderRadius: o.radius, background: r.background, boxShadow: r.shadow }}
              role="img"
              aria-label={`${o.shape} neumorphic shape lit from the ${o.light.replace("-", " ")}`}
            />
          </div>
          <div className="mt-4 space-y-3">
            <Segmented
              label="Shape"
              value={o.shape}
              onChange={(v) => set("shape", v)}
              options={[
                { value: "flat", label: "Flat" },
                { value: "concave", label: "Concave" },
                { value: "convex", label: "Convex" },
                { value: "pressed", label: "Pressed" },
              ]}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Light source</p>
              <Segmented label="Light source" value={o.light} onChange={(v) => set("light", v)} options={LIGHTS} />
            </div>
          </div>
        </ToolPanel>

        <ToolPanel title="Settings" actions={<ResetBtn onClick={() => setO(START)} />}>
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <ColorInput label="Surface color" hint="The element and its background share this color." value={o.color} onChange={(v) => set("color", v)} />
            <Slider label="Size" value={o.size} onChange={(v) => set("size", v)} min={60} max={320} unit="px" />
            <Slider label="Corner radius" value={o.radius} onChange={(v) => set("radius", v)} min={0} max={160} unit="px" />
            <Slider label="Distance" value={o.distance} onChange={(v) => set("distance", v)} min={2} max={50} unit="px" />
            <Slider label="Blur" value={o.blur} onChange={(v) => set("blur", v)} min={0} max={100} unit="px" />
            <Slider label="Intensity" value={Math.round(o.intensity * 100)} onChange={(v) => set("intensity", v / 100)} min={1} max={25} unit="%" />
          </div>
          <div className="mt-5">
            <CodeOutput code={`/* Put the element on a background of ${r.surface}. */\n${r.css}`} label="CSS" filename="neumorphism.css" />
          </div>
          <p className="mt-3 text-[0.8125rem] text-muted">
            Neumorphic edges are low contrast by design, so they rarely meet the 3:1 non-text contrast guideline. Pair them with a visible label,
            icon or border for anything interactive.
          </p>
        </ToolPanel>
      </div>
      <PrivacyNote />
    </div>
  );
}
