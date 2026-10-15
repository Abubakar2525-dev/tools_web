"use client";

import { useState } from "react";
import { Checkbox, Notice, PrivacyNote, ResetBtn, Segmented, ToolPanel } from "@/components/tools/kit";
import { glassmorphism } from "./lib/css";
import { CodeOutput, ColorInput, Slider } from "./shared";

const BACKDROPS = {
  aurora: "radial-gradient(circle at 20% 25%, #22d3ee 0 18%, transparent 19%), radial-gradient(circle at 78% 70%, #f472b6 0 22%, transparent 23%), radial-gradient(circle at 60% 15%, #facc15 0 12%, transparent 13%), linear-gradient(135deg, #312e81, #0f766e)",
  sunset: "radial-gradient(circle at 70% 30%, #fde68a 0 16%, transparent 17%), linear-gradient(160deg, #f97316, #db2777 55%, #4c1d95)",
  photo: "repeating-linear-gradient(45deg, #0f172a 0 18px, #1e293b 18px 36px), radial-gradient(circle at 30% 60%, #38bdf8, transparent 40%)",
  light: "radial-gradient(circle at 25% 30%, #a5b4fc 0 20%, transparent 21%), radial-gradient(circle at 75% 70%, #6ee7b7 0 18%, transparent 19%), #f8fafc",
} as const;
type Backdrop = keyof typeof BACKDROPS;

const START = { tint: "#ffffff", opacity: 0.18, blur: 14, saturate: 160, radius: 20, borderOpacity: 0.35, shadow: true };

export default function Tool() {
  const [o, setO] = useState(START);
  const [backdrop, setBackdrop] = useState<Backdrop>("aurora");
  const [textColor, setTextColor] = useState("#ffffff");
  const set = <K extends keyof typeof START>(k: K, v: (typeof START)[K]) => setO((x) => ({ ...x, [k]: v }));
  const g = glassmorphism(o);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ToolPanel title="Preview">
          <div className="relative grid min-h-80 place-items-center overflow-hidden rounded-xl p-6" style={{ background: BACKDROPS[backdrop] }}>
            <div
              className="w-full max-w-[300px] p-6"
              style={{
                background: g.bg,
                WebkitBackdropFilter: g.filter,
                backdropFilter: g.filter,
                border: `1px solid ${g.border}`,
                borderRadius: o.radius,
                boxShadow: o.shadow ? "0 8px 32px rgba(0, 0, 0, 0.18)" : undefined,
                color: textColor,
              }}
            >
              <p className="text-lg font-semibold">Frosted panel</p>
              <p className="mt-2 text-sm opacity-90">The background blurs behind this card. Check that text stays readable over the busiest part.</p>
            </div>
          </div>
          <div className="mt-4">
            <Segmented
              label="Backdrop"
              value={backdrop}
              onChange={setBackdrop}
              options={[
                { value: "aurora", label: "Aurora" },
                { value: "sunset", label: "Sunset" },
                { value: "photo", label: "Pattern" },
                { value: "light", label: "Light" },
              ]}
            />
          </div>
        </ToolPanel>

        <ToolPanel title="Settings" actions={<ResetBtn onClick={() => setO(START)} />}>
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <ColorInput label="Tint color" value={o.tint} onChange={(v) => set("tint", v)} />
            <ColorInput label="Preview text color" value={textColor} onChange={setTextColor} />
            <Slider label="Transparency (fill opacity)" value={Math.round(o.opacity * 100)} onChange={(v) => set("opacity", v / 100)} min={0} max={100} unit="%" />
            <Slider label="Blur" value={o.blur} onChange={(v) => set("blur", v)} min={0} max={40} unit="px" />
            <Slider label="Saturation" value={o.saturate} onChange={(v) => set("saturate", v)} min={50} max={250} unit="%" />
            <Slider label="Corner radius" value={o.radius} onChange={(v) => set("radius", v)} min={0} max={48} unit="px" />
            <Slider label="Border opacity" value={Math.round(o.borderOpacity * 100)} onChange={(v) => set("borderOpacity", v / 100)} min={0} max={100} unit="%" />
          </div>
          <div className="mt-4">
            <Checkbox label="Soft drop shadow" checked={o.shadow} onChange={(v) => set("shadow", v)} />
          </div>
          {o.opacity < 0.1 && o.blur < 6 && (
            <div className="mt-4">
              <Notice tone="warning">With very little fill and blur, text on the panel competes with the background. Raise one of them.</Notice>
            </div>
          )}
        </ToolPanel>
      </div>
      <ToolPanel title="CSS">
        <CodeOutput code={g.css} label="CSS with fallback" filename="glass.css" />
        <p className="mt-3 text-[0.8125rem] text-muted">
          backdrop-filter works in all current major browsers; the -webkit- prefix covers older Safari. The @supports block gives older browsers a
          more opaque panel instead of an unreadable clear one. Blur is GPU work, so avoid stacking many large glass layers.
        </p>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
