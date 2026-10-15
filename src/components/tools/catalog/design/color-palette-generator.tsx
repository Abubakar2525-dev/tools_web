"use client";

import { useMemo, useState } from "react";
import { Btn, Checkbox, PrivacyNote, ResetBtn, Segmented, SelectField, TextField, ToolPanel } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { BLACK, WHITE, contrastRatio, formatHex, oklchToSrgb, parseColor, round, type Color } from "./lib/color";
import { HARMONIES, exportPalette, harmony, shadeScale, slugName, type ExportFormat, type Harmony, type ValueFormat } from "./lib/palette";
import { CodeOutput, ColorInput, Slider, textOn } from "./shared";

const FORMATS: { value: ExportFormat; label: string; ext: string; mime: string }[] = [
  { value: "css", label: "CSS variables", ext: "css", mime: "text/css" },
  { value: "tailwind4", label: "Tailwind v4", ext: "css", mime: "text/css" },
  { value: "tailwind3", label: "Tailwind v3", ext: "js", mime: "text/javascript" },
  { value: "scss", label: "SCSS", ext: "scss", mime: "text/x-scss" },
  { value: "json", label: "JSON", ext: "json", mime: "application/json" },
];

const baseOf = (s: string): Color => parseColor(s) ?? { r: 0.18, g: 0.49, b: 0.43, alpha: 1 };

export default function Tool() {
  const [base, setBase] = useState("#2f7d6d");
  const [name, setName] = useState("brand");
  const [anchor, setAnchor] = useState(true);
  const [drift, setDrift] = useState(0);
  const [kind, setKind] = useState<Harmony>("complementary");
  const [locked, setLocked] = useState<Record<number, string>>({});
  const [format, setFormat] = useState<ExportFormat>("css");
  const [values, setValues] = useState<ValueFormat>("hex");
  const [includeHarmony, setIncludeHarmony] = useState(true);
  const [copied, setCopied] = useState("");

  const shades = useMemo(() => shadeScale(baseOf(base), anchor, drift), [base, anchor, drift]);
  const slots = useMemo(
    () => harmony(baseOf(base), kind).map((c, i) => (locked[i] ? (parseColor(locked[i]) as Color) : c)),
    [base, kind, locked],
  );
  const prefix = slugName(name);

  const code = useMemo(() => {
    const groups = [{ name: prefix, colors: shades.map((s) => ({ key: String(s.step), color: s.color })) }];
    if (includeHarmony) groups.push({ name: `${prefix}-accent`, colors: slots.map((c, i) => ({ key: String(i + 1), color: c })) });
    return exportPalette(groups, format, values);
  }, [prefix, shades, slots, includeHarmony, format, values]);

  const copy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(`Copied ${hex}`);
    } catch {
      setCopied("Copy failed");
    }
  };

  const randomBase = () => {
    const h = Math.random() * 360;
    const c = oklchToSrgb([0.5 + Math.random() * 0.2, 0.08 + Math.random() * 0.1, h]);
    setBase(formatHex(c));
  };

  const fmt = FORMATS.find((f) => f.value === format)!;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Base color and shade scale"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={randomBase}>
              Random base
            </Btn>
            <ResetBtn
              onClick={() => {
                setBase("#2f7d6d");
                setName("brand");
                setAnchor(true);
                setDrift(0);
                setLocked({});
              }}
            />
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-3">
          <ColorInput label="Base color" value={base} onChange={setBase} />
          <TextField label="Palette name (used in variable names)" value={name} onChange={(e) => setName(e.target.value)} />
          <Slider label="Hue drift" value={drift} onChange={setDrift} min={-30} max={30} unit="°" />
        </div>
        <div className="mt-4">
          <Checkbox
            label="Keep the base color exactly at its nearest step"
            hint="Otherwise every step follows the lightness ladder, and the base may shift slightly."
            checked={anchor}
            onChange={setAnchor}
          />
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11" aria-label="Shade scale">
          {shades.map((s) => {
            const w = contrastRatio(s.color, WHITE);
            const b = contrastRatio(s.color, BLACK);
            return (
              <li key={s.step}>
                <button
                  type="button"
                  onClick={() => copy(s.hex)}
                  className="flex h-24 w-full flex-col justify-between rounded-lg p-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  style={{ background: s.hex, color: textOn(s.color) }}
                  aria-label={`${prefix}-${s.step} ${s.hex}${s.isBase ? ", base color" : ""}. Copy`}
                >
                  <span className="font-semibold">
                    {s.step}
                    {s.isBase && " • base"}
                  </span>
                  <span>
                    <span className="block font-mono">{s.hex}</span>
                    <span className="block opacity-90">
                      {w >= b ? `${round(w, 1)}:1 on white` : `${round(b, 1)}:1 on black`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="sr-only" aria-live="polite">
          {copied}
        </p>
        <p className="mt-3 text-[0.8125rem] text-muted">Click a swatch to copy its hex. The ratio shows text contrast with white or black, whichever is higher.</p>
      </ToolPanel>

      <ToolPanel title="Harmony">
        <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr] md:items-end">
          <SelectField
            label="Harmony rule"
            value={kind}
            onChange={(e) => setKind(e.target.value as Harmony)}
            options={HARMONIES.map((h) => ({ value: h.value, label: h.label }))}
            hint={HARMONIES.find((h) => h.value === kind)?.hint}
          />
          <div className="flex flex-wrap gap-2">
            <Btn variant="ghost" icon="spark" onClick={randomBase}>
              New base, keep locked
            </Btn>
            {Object.keys(locked).length > 0 && (
              <Btn variant="subtle" onClick={() => setLocked({})}>
                Unlock all
              </Btn>
            )}
          </div>
        </div>
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-5">
          {slots.map((c, i) => {
            const hex = formatHex(c);
            const isLocked = Boolean(locked[i]);
            return (
              <li key={i} className="overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
                <div className="flex h-24 items-end p-2 font-mono text-sm" style={{ background: hex, color: textOn(c) }}>
                  {hex}
                </div>
                <div className="flex gap-1 bg-surface p-1.5">
                  <button
                    type="button"
                    aria-pressed={isLocked}
                    onClick={() =>
                      setLocked((o) => {
                        const n = { ...o };
                        if (n[i]) delete n[i];
                        else n[i] = hex;
                        return n;
                      })
                    }
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm text-ink-2 hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-accent-soft aria-pressed:text-ink"
                  >
                    <Icon name="lock" size={15} />
                    {isLocked ? "Locked" : "Lock"}
                    <span className="sr-only"> color {i + 1}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(hex)}
                    className="grid h-10 w-10 place-items-center rounded-lg text-ink-2 hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <Icon name="copy" size={15} />
                    <span className="sr-only">Copy {hex}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[0.8125rem] text-muted">
          Hues are rotated in OKLCH, so lightness stays consistent across the set. Locked colors stay put when you change the base or the rule.
        </p>
      </ToolPanel>

      <ToolPanel title="Export">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Export format" value={format} onChange={setFormat} options={FORMATS.map((f) => ({ value: f.value, label: f.label }))} />
          <Segmented
            label="Color values"
            value={values}
            onChange={setValues}
            options={[
              { value: "hex", label: "Hex" },
              { value: "oklch", label: "OKLCH" },
            ]}
          />
        </div>
        <div className="mt-4">
          <Checkbox label="Include the harmony colors" checked={includeHarmony} onChange={setIncludeHarmony} />
        </div>
        <div className="mt-4">
          <CodeOutput code={code} label={`${fmt.label} code`} filename={`${prefix}-palette.${fmt.ext}`} mime={fmt.mime} />
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
