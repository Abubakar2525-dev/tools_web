"use client";

import { useState } from "react";
import { Btn, Checkbox, PrivacyNote, ResetBtn, ToolPanel, uid } from "@/components/tools/kit";
import { boxShadowValue, type ShadowLayer } from "./lib/css";
import { CodeOutput, ColorInput, Slider } from "./shared";

const layer = (p: Partial<ShadowLayer> = {}): ShadowLayer => ({
  id: uid(),
  x: 0,
  y: 8,
  blur: 24,
  spread: -4,
  color: "#0f172a",
  opacity: 0.18,
  inset: false,
  enabled: true,
  ...p,
});

const PRESETS: { name: string; layers: Partial<ShadowLayer>[] }[] = [
  { name: "Soft", layers: [{ y: 8, blur: 24, spread: -4, opacity: 0.18 }] },
  { name: "Layered", layers: [{ y: 1, blur: 2, spread: 0, opacity: 0.08 }, { y: 4, blur: 8, spread: -2, opacity: 0.1 }, { y: 16, blur: 32, spread: -8, opacity: 0.16 }] },
  { name: "Crisp", layers: [{ x: 4, y: 4, blur: 0, spread: 0, opacity: 1 }] },
  { name: "Inner", layers: [{ y: 2, blur: 6, spread: 0, opacity: 0.25, inset: true }] },
  { name: "Glow", layers: [{ y: 0, blur: 24, spread: 2, color: "#6366f1", opacity: 0.55 }] },
  { name: "Lifted", layers: [{ y: 24, blur: 48, spread: -12, opacity: 0.3 }, { y: 2, blur: 4, spread: 0, opacity: 0.06 }] },
];

const fresh = () => [layer()];

export default function Tool() {
  const [layers, setLayers] = useState<ShadowLayer[]>(fresh);
  const [box, setBox] = useState("#ffffff");
  const [canvas, setCanvas] = useState("#eef2f6");
  const [radius, setRadius] = useState(16);

  const update = (id: string, patch: Partial<ShadowLayer>) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const move = (i: number, d: number) =>
    setLayers((ls) => {
      const j = i + d;
      if (j < 0 || j >= ls.length) return ls;
      const n = [...ls];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const value = boxShadowValue(layers);
  const css = `box-shadow: ${value};`;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ToolPanel title="Preview" actions={<ResetBtn onClick={() => setLayers(fresh())} />}>
          <div className="grid h-72 place-items-center rounded-xl shadow-[0_0_0_1px_var(--line)]" style={{ background: canvas }}>
            <div className="h-36 w-36 sm:h-44 sm:w-44" style={{ background: box, borderRadius: radius, boxShadow: value }} role="img" aria-label={`Box with shadow: ${value}`} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <ColorInput label="Box color" value={box} onChange={setBox} />
            <ColorInput label="Background" value={canvas} onChange={setCanvas} />
            <Slider label="Box radius" value={radius} onChange={setRadius} min={0} max={100} unit="px" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Btn key={p.name} variant="subtle" onClick={() => setLayers(p.layers.map((l) => layer({ x: 0, ...l })))}>
                {p.name}
              </Btn>
            ))}
          </div>
          <div className="mt-5">
            <CodeOutput code={css} label="CSS" filename="box-shadow.css" />
          </div>
        </ToolPanel>

        <ToolPanel
          title={`Layers (${layers.length})`}
          actions={
            <Btn variant="ghost" icon="plus" disabled={layers.length >= 8} onClick={() => setLayers((ls) => [...ls, layer({ y: 2, blur: 6, spread: 0, opacity: 0.1 })])}>
              Add layer
            </Btn>
          }
        >
          <p className="mb-4 text-[0.8125rem] text-muted">The first layer is drawn on top. Use the arrows to reorder.</p>
          <ol className="space-y-4">
            {layers.map((l, i) => (
              <li key={l.id} className="rounded-xl bg-sunken p-4">
                <fieldset>
                  <legend className="sr-only">Layer {i + 1}</legend>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">Layer {i + 1}</p>
                    <div className="flex flex-wrap gap-1">
                      <Btn variant="subtle" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move layer ${i + 1} up`}>
                        ↑
                      </Btn>
                      <Btn variant="subtle" disabled={i === layers.length - 1} onClick={() => move(i, 1)} aria-label={`Move layer ${i + 1} down`}>
                        ↓
                      </Btn>
                      <Btn variant="subtle" icon="copy" onClick={() => setLayers((ls) => [...ls.slice(0, i + 1), { ...l, id: uid() }, ...ls.slice(i + 1)])} aria-label={`Duplicate layer ${i + 1}`}>
                        Duplicate
                      </Btn>
                      <Btn variant="danger" icon="trash" disabled={layers.length <= 1} onClick={() => setLayers((ls) => ls.filter((x) => x.id !== l.id))} aria-label={`Remove layer ${i + 1}`}>
                        Remove
                      </Btn>
                    </div>
                  </div>
                  <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
                    <Slider label="Horizontal offset" value={l.x} onChange={(v) => update(l.id, { x: v })} min={-100} max={100} unit="px" />
                    <Slider label="Vertical offset" value={l.y} onChange={(v) => update(l.id, { y: v })} min={-100} max={100} unit="px" />
                    <Slider label="Blur" value={l.blur} onChange={(v) => update(l.id, { blur: v })} min={0} max={150} unit="px" />
                    <Slider label="Spread" value={l.spread} onChange={(v) => update(l.id, { spread: v })} min={-60} max={60} unit="px" />
                    <ColorInput label="Shadow color" value={l.color} onChange={(v) => update(l.id, { color: v })} />
                    <Slider label="Opacity" value={Math.round(l.opacity * 100)} onChange={(v) => update(l.id, { opacity: v / 100 })} min={0} max={100} unit="%" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-6">
                    <Checkbox label="Inset (inner shadow)" checked={l.inset} onChange={(v) => update(l.id, { inset: v })} />
                    <Checkbox label="Enabled" checked={l.enabled} onChange={(v) => update(l.id, { enabled: v })} />
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
        </ToolPanel>
      </div>
      <PrivacyNote />
    </div>
  );
}
