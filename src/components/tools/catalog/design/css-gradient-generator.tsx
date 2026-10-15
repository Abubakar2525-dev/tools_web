"use client";

import { useState } from "react";
import { Btn, Checkbox, PrivacyNote, ResetBtn, Segmented, SelectField, ToolPanel, uid } from "@/components/tools/kit";
import { formatHex, mixOklab, parseColor } from "./lib/color";
import { gradientCss, gradientValue, sortedStops, type GradientState, type GradientType, type Interp, type Stop } from "./lib/css";
import { CodeOutput, ColorInput, Slider, checker } from "./shared";

const mk = (color: string, pos: number): Stop => ({ id: uid(), color, pos });

const PRESETS: { name: string; g: Partial<Omit<GradientState, "stops">> & { stops: [string, number][] } }[] = [
  { name: "Sunset", g: { type: "linear", angle: 135, stops: [["#ff7e5f", 0], ["#feb47b", 100]] } },
  { name: "Ocean", g: { type: "linear", angle: 160, stops: [["#0f3460", 0], ["#16a3b8", 55], ["#a8e6cf", 100]] } },
  { name: "Aurora", g: { type: "linear", angle: 90, interp: "oklch", stops: [["#00c9a7", 0], ["#845ec2", 100]] } },
  { name: "Spotlight", g: { type: "radial", shape: "circle", x: 30, y: 30, stops: [["#ffffff", 0], ["#c7d2fe", 35], ["#312e81", 100]] } },
  { name: "Color wheel", g: { type: "conic", angle: 0, interp: "oklch", stops: [["#ff4d4d", 0], ["#ffd84d", 25], ["#4dff88", 50], ["#4d9bff", 75], ["#ff4d4d", 100]] } },
  { name: "Stripes", g: { type: "linear", angle: 45, repeating: true, stops: [["#1f2937", 0], ["#1f2937", 10], ["#f59e0b", 10], ["#f59e0b", 20]] } },
];

const DEFAULT: GradientState = {
  type: "linear",
  angle: 135,
  shape: "ellipse",
  size: "farthest-corner",
  x: 50,
  y: 50,
  repeating: false,
  interp: "default",
  stops: [mk("#4f46e5", 0), mk("#06b6d4", 100)],
};

export default function Tool() {
  const [g, setG] = useState<GradientState>(DEFAULT);
  const set = <K extends keyof GradientState>(k: K, v: GradientState[K]) => setG((o) => ({ ...o, [k]: v }));
  const setStop = (id: string, patch: Partial<Stop>) => setG((o) => ({ ...o, stops: o.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addStop = () => {
    const st = sortedStops(g.stops);
    let best = 0;
    let gap = -1;
    for (let i = 0; i < st.length - 1; i++) {
      if (st[i + 1].pos - st[i].pos > gap) {
        gap = st[i + 1].pos - st[i].pos;
        best = i;
      }
    }
    const a = st[best];
    const b = st[best + 1] ?? st[best];
    const ca = parseColor(a.color);
    const cb = parseColor(b.color);
    const color = ca && cb ? formatHex(mixOklab(ca, cb, 0.5)) : "#888888";
    setG((o) => ({ ...o, stops: [...o.stops, mk(color, Math.round((a.pos + b.pos) / 2))] }));
  };

  const value = gradientValue(g);
  const css = gradientCss(g);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ToolPanel title="Gradient" actions={<ResetBtn onClick={() => setG({ ...DEFAULT, stops: [mk("#4f46e5", 0), mk("#06b6d4", 100)] })} />}>
          <div className="space-y-5">
            <Segmented
              label="Gradient type"
              value={g.type}
              onChange={(v: GradientType) => set("type", v)}
              options={[
                { value: "linear", label: "Linear" },
                { value: "radial", label: "Radial" },
                { value: "conic", label: "Conic" },
              ]}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              {g.type !== "radial" && (
                <Slider label={g.type === "linear" ? "Angle" : "Start angle"} value={g.angle} onChange={(v) => set("angle", v)} min={0} max={360} unit="°" />
              )}
              {g.type === "radial" && (
                <>
                  <SelectField
                    label="Shape"
                    value={g.shape}
                    onChange={(e) => set("shape", e.target.value as GradientState["shape"])}
                    options={[
                      { value: "ellipse", label: "Ellipse" },
                      { value: "circle", label: "Circle" },
                    ]}
                  />
                  <SelectField
                    label="Size"
                    value={g.size}
                    onChange={(e) => set("size", e.target.value as GradientState["size"])}
                    options={["farthest-corner", "farthest-side", "closest-corner", "closest-side"]}
                  />
                </>
              )}
              {g.type !== "linear" && (
                <>
                  <Slider label="Center X" value={g.x} onChange={(v) => set("x", v)} min={0} max={100} unit="%" />
                  <Slider label="Center Y" value={g.y} onChange={(v) => set("y", v)} min={0} max={100} unit="%" />
                </>
              )}
              <SelectField
                label="Interpolation color space"
                hint="OKLab/OKLCH avoid muddy midpoints. A plain fallback line is included for older browsers."
                value={g.interp}
                onChange={(e) => set("interp", e.target.value as Interp)}
                options={[
                  { value: "default", label: "Default (sRGB, widest support)" },
                  { value: "oklab", label: "OKLab" },
                  { value: "oklch", label: "OKLCH (vivid, hue path)" },
                  { value: "lab", label: "CIELAB" },
                  { value: "hsl", label: "HSL" },
                  { value: "srgb", label: "sRGB (explicit)" },
                ]}
              />
            </div>
            <Checkbox label="Repeating gradient" hint="Repeats the stop pattern; use positions below 100% to see it." checked={g.repeating} onChange={(v) => set("repeating", v)} />
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Btn
                  key={p.name}
                  variant="subtle"
                  onClick={() =>
                    setG({ ...DEFAULT, ...p.g, stops: p.g.stops.map(([c, pos]) => mk(c, pos)) })
                  }
                >
                  {p.name}
                </Btn>
              ))}
            </div>
          </div>
        </ToolPanel>

        <ToolPanel title="Preview">
          <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]" style={{ background: checker }}>
            <div className="h-64 w-full sm:h-80" style={{ backgroundImage: value }} role="img" aria-label={`Gradient preview: ${value}`} />
          </div>
          <div className="mt-5">
            <CodeOutput code={css} label="CSS" filename="gradient.css" />
          </div>
        </ToolPanel>
      </div>

      <ToolPanel
        title="Color stops"
        actions={
          <Btn variant="ghost" icon="plus" onClick={addStop} disabled={g.stops.length >= 12}>
            Add stop
          </Btn>
        }
      >
        <div className="mb-5 h-6 rounded-md shadow-[0_0_0_1px_var(--line)]" style={{ backgroundImage: gradientValue({ ...g, type: "linear", angle: 90, repeating: false }) }} aria-hidden="true" />
        <ol className="space-y-4">
          {g.stops.map((s, i) => (
            <li key={s.id} className="grid items-end gap-4 rounded-xl bg-sunken p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <ColorInput label={`Stop ${i + 1} color`} value={s.color} onChange={(v) => setStop(s.id, { color: v })} />
              <Slider label={`Stop ${i + 1} position`} value={s.pos} onChange={(v) => setStop(s.id, { pos: v })} min={0} max={100} unit="%" />
              <Btn
                variant="danger"
                icon="trash"
                disabled={g.stops.length <= 2}
                onClick={() => setG((o) => ({ ...o, stops: o.stops.filter((x) => x.id !== s.id) }))}
                aria-label={`Remove stop ${i + 1}`}
              >
                Remove
              </Btn>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[0.8125rem] text-muted">The CSS lists stops in position order. A gradient needs at least two.</p>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
