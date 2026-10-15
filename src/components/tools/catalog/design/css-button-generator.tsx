"use client";

import { useState } from "react";
import { Checkbox, PrivacyNote, ResetBtn, SelectField, TextField, ToolPanel } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { contrastRatio, formatHex, parseColor, toOklch, type Color } from "./lib/color";
import { buttonCss, shiftLightness, type ButtonState } from "./lib/css";
import { CodeOutput, ColorInput, Slider } from "./shared";

const START: ButtonState = {
  label: "Get started",
  fontSize: 16,
  fontWeight: 600,
  padX: 22,
  padY: 12,
  radius: 10,
  bg: "#0f766e",
  fg: "#ffffff",
  borderWidth: 0,
  borderColor: "#0b5a54",
  hoverBg: "#0b5d57",
  hoverFg: "#ffffff",
  focusRing: "#2563eb",
  shadow: true,
  uppercase: false,
  transition: true,
};

const hex = (s: string, fb: string) => formatHex({ ...(parseColor(s) ?? (parseColor(fb) as Color)), alpha: 1 });
const clampN = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

/** Normalizes every value that goes into CSS (colors become hex, numbers are clamped). */
function sanitize(s: ButtonState): ButtonState {
  return {
    ...s,
    fontSize: clampN(s.fontSize, 10, 40),
    fontWeight: clampN(Math.round(s.fontWeight / 100) * 100, 100, 900),
    padX: clampN(s.padX, 0, 80),
    padY: clampN(s.padY, 0, 40),
    radius: clampN(s.radius, 0, 999),
    borderWidth: clampN(s.borderWidth, 0, 8),
    bg: hex(s.bg, START.bg),
    fg: hex(s.fg, START.fg),
    borderColor: hex(s.borderColor, START.borderColor),
    hoverBg: hex(s.hoverBg, START.hoverBg),
    hoverFg: hex(s.hoverFg, START.hoverFg),
    focusRing: hex(s.focusRing, START.focusRing),
  };
}

function autoHover(bg: string) {
  const c = parseColor(bg);
  if (!c) return bg;
  return shiftLightness(bg, toOklch(c)[0] > 0.35 ? -0.07 : 0.1);
}

export default function Tool() {
  const [s, setS] = useState<ButtonState>(START);
  const [autoH, setAutoH] = useState(true);
  const [page, setPage] = useState("#ffffff");
  const set = <K extends keyof ButtonState>(k: K, v: ButtonState[K]) => setS((o) => ({ ...o, [k]: v }));

  const eff = sanitize(autoH ? { ...s, hoverBg: autoHover(s.bg), hoverFg: s.fg } : s);
  const css = buttonCss(eff, "btn");
  const pageHex = hex(page, "#ffffff");
  const previewCss =
    buttonCss(eff, "sgen-btn") +
    `\n.sgen-btn.sgen-hover { background-color: ${eff.hoverBg}; color: ${eff.hoverFg}; }\n.sgen-btn.sgen-focus { outline: 3px solid ${eff.focusRing}; outline-offset: 2px; }\n`;
  const html = `<button class="btn" type="button">${s.label.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</button>`;

  const c = (a: string, b: string) => contrastRatio(parseColor(a) as Color, parseColor(b) as Color);
  const checks = [
    { label: "Text on button", ratio: c(eff.fg, eff.bg), need: eff.fontSize >= 24 || (eff.fontSize >= 18.66 && eff.fontWeight >= 700) ? 3 : 4.5 },
    { label: "Text on hover", ratio: c(eff.hoverFg, eff.hoverBg), need: eff.fontSize >= 24 || (eff.fontSize >= 18.66 && eff.fontWeight >= 700) ? 3 : 4.5 },
    { label: "Focus ring on page", ratio: c(eff.focusRing, pageHex), need: 3 },
    eff.borderWidth > 0
      ? { label: "Border on page", ratio: Math.max(c(eff.borderColor, pageHex), c(eff.bg, pageHex)), need: 3 }
      : { label: "Button shape on page", ratio: c(eff.bg, pageHex), need: 3 },
  ];

  return (
    <div className="space-y-5">
      {/* Values are sanitized: colors are re-serialized as hex and numbers clamped. */}
      <style>{previewCss}</style>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ToolPanel title="Style" actions={<ResetBtn onClick={() => { setS(START); setAutoH(true); }} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Button text" value={s.label} maxLength={40} onChange={(e) => set("label", e.target.value)} />
            <SelectField
              label="Font weight"
              value={String(s.fontWeight)}
              onChange={(e) => set("fontWeight", Number(e.target.value))}
              options={[
                { value: "400", label: "Regular (400)" },
                { value: "500", label: "Medium (500)" },
                { value: "600", label: "Semibold (600)" },
                { value: "700", label: "Bold (700)" },
              ]}
            />
            <Slider label="Font size" value={s.fontSize} onChange={(v) => set("fontSize", v)} min={10} max={40} unit="px" />
            <Slider label="Corner radius" value={s.radius} onChange={(v) => set("radius", v)} min={0} max={40} unit="px" />
            <Slider label="Horizontal padding" value={s.padX} onChange={(v) => set("padX", v)} min={0} max={80} unit="px" />
            <Slider label="Vertical padding" value={s.padY} onChange={(v) => set("padY", v)} min={0} max={40} unit="px" />
            <ColorInput label="Background" value={s.bg} onChange={(v) => set("bg", v)} />
            <ColorInput label="Text color" value={s.fg} onChange={(v) => set("fg", v)} />
            <Slider label="Border width" value={s.borderWidth} onChange={(v) => set("borderWidth", v)} min={0} max={8} unit="px" />
            {s.borderWidth > 0 ? <ColorInput label="Border color" value={s.borderColor} onChange={(v) => set("borderColor", v)} /> : <div />}
            <ColorInput label="Focus ring" value={s.focusRing} onChange={(v) => set("focusRing", v)} />
            <ColorInput label="Page background" hint="Used for the preview and the ring check." value={page} onChange={setPage} />
          </div>
          <div className="mt-5 space-y-3">
            <Checkbox label="Derive the hover color automatically" hint="Shifts the background lightness in OKLCH." checked={autoH} onChange={setAutoH} />
            {!autoH && (
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorInput label="Hover background" value={s.hoverBg} onChange={(v) => set("hoverBg", v)} />
                <ColorInput label="Hover text" value={s.hoverFg} onChange={(v) => set("hoverFg", v)} />
              </div>
            )}
            <Checkbox label="Drop shadow" checked={s.shadow} onChange={(v) => set("shadow", v)} />
            <Checkbox label="Uppercase label" checked={s.uppercase} onChange={(v) => set("uppercase", v)} />
            <Checkbox label="Transitions" hint="Turned off automatically for people who prefer reduced motion." checked={s.transition} onChange={(v) => set("transition", v)} />
          </div>
        </ToolPanel>

        <ToolPanel title="Preview">
          <div className="space-y-5 rounded-xl p-6 shadow-[0_0_0_1px_var(--line)]" style={{ background: pageHex }}>
            <div className="text-center">
              <button type="button" className="sgen-btn">
                {s.label || "Button"}
              </button>
              <p className="mt-2 text-xs" style={{ color: contrastRatio(parseColor(pageHex) as Color, { r: 0, g: 0, b: 0, alpha: 1 }) > 7 ? "#475569" : "#e2e8f0" }}>
                Live: hover it, or Tab to it to see the focus ring.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { name: "Default", cls: "" },
                { name: "Hover", cls: "sgen-hover" },
                { name: "Focus", cls: "sgen-focus" },
                { name: "Disabled", cls: "", disabled: true },
              ].map((st) => (
                <div key={st.name} className="flex flex-col items-center gap-2">
                  <button type="button" tabIndex={-1} aria-hidden="true" disabled={st.disabled} className={`sgen-btn ${st.cls}`} style={{ pointerEvents: "none" }}>
                    {s.label || "Button"}
                  </button>
                  <span className="rounded bg-surface/90 px-1.5 text-xs text-ink-2">{st.name}</span>
                </div>
              ))}
            </div>
          </div>
          <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
            {checks.map((k) => {
              const ok = Math.floor(k.ratio * 100) / 100 >= k.need;
              return (
                <li key={k.label} className="flex items-center gap-3 bg-surface px-4 py-2.5 text-sm">
                  <Icon name={ok ? "check" : "alert"} size={16} className={ok ? "text-accent-strong" : "text-danger"} />
                  <span className="flex-1 text-ink">{k.label}</span>
                  <span className="tabular-nums text-ink-2">{(Math.floor(k.ratio * 100) / 100).toFixed(2)}:1</span>
                  <span className={`w-28 text-right font-medium ${ok ? "text-accent-strong" : "text-danger"}`}>
                    {ok ? "Pass" : "Fail"} (needs {k.need}:1)
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[0.8125rem] text-muted">Text checks use WCAG 1.4.3; ring and shape checks use 1.4.11 non-text contrast.</p>
        </ToolPanel>
      </div>
      <ToolPanel title="Code">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <CodeOutput code={css} label="CSS" filename="button.css" />
          <CodeOutput code={html} label="HTML" />
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
