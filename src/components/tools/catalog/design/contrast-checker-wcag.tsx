"use client";

import { useMemo, useState } from "react";
import { Btn, PrivacyNote, ResetBtn, ToolPanel } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import {
  WHITE,
  apcaContrast,
  composite,
  contrastRatio,
  formatHex,
  nearestPassing,
  parseColor,
  round,
  wcagChecks,
  type Color,
} from "./lib/color";
import { ColorInput } from "./shared";

const CHECKS: { key: keyof ReturnType<typeof wcagChecks>; label: string; need: number; detail: string }[] = [
  { key: "aaNormal", label: "AA, normal text", need: 4.5, detail: "SC 1.4.3, below 24px (18pt) or 18.66px (14pt) bold" },
  { key: "aaLarge", label: "AA, large text", need: 3, detail: "SC 1.4.3, at least 24px, or 18.66px bold" },
  { key: "aaaNormal", label: "AAA, normal text", need: 7, detail: "SC 1.4.6" },
  { key: "aaaLarge", label: "AAA, large text", need: 4.5, detail: "SC 1.4.6" },
  { key: "ui", label: "UI components and graphics", need: 3, detail: "SC 1.4.11, borders, icons, focus rings, chart lines" },
];

const TARGETS = [
  { need: 3, label: "3:1 (large text, UI)" },
  { need: 4.5, label: "4.5:1 (AA text)" },
  { need: 7, label: "7:1 (AAA text)" },
];

export default function Tool() {
  const [fg, setFg] = useState("#6b7280");
  const [bg, setBg] = useState("#f8fafc");

  const r = useMemo(() => {
    const f0 = parseColor(fg);
    const b0 = parseColor(bg);
    if (!f0 || !b0) return null;
    // Background alpha is composited over white; text alpha over the background.
    const b = composite(b0, WHITE);
    const f = composite(f0, b);
    const ratio = contrastRatio(f, b);
    const suggestions = TARGETS.map((t) => ({
      ...t,
      fg: nearestPassing(f, b, t.need),
      bg: nearestPassing(b, f, t.need),
    }));
    return { f, b, ratio, checks: wcagChecks(ratio), apca: apcaContrast(f, b), suggestions, translucent: f0.alpha < 1 || b0.alpha < 1 };
  }, [fg, bg]);

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Colors"
        actions={
          <>
            <Btn
              variant="ghost"
              icon="swap"
              onClick={() => {
                setFg(bg);
                setBg(fg);
              }}
            >
              Swap
            </Btn>
            <ResetBtn
              onClick={() => {
                setFg("#6b7280");
                setBg("#f8fafc");
              }}
            />
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <ColorInput label="Text (foreground)" value={fg} onChange={setFg} />
          <ColorInput label="Background" value={bg} onChange={setBg} />
        </div>
      </ToolPanel>

      {r && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ToolPanel title="Result">
            <div className="rounded-xl bg-accent-soft p-5" aria-live="polite" aria-atomic="true">
              <p className="text-sm text-ink-2">Contrast ratio (WCAG 2.2)</p>
              <p className="mt-1 font-display text-[2.5rem] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
                {(Math.floor(r.ratio * 100) / 100).toFixed(2)}:1
              </p>
              <p className="mt-2 text-sm text-ink-2">
                APCA Lc {round(r.apca, 1)} <span className="text-muted">(informational: APCA is a draft method for WCAG 3, not a requirement)</span>
              </p>
            </div>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
              {CHECKS.map((c) => {
                const ok = r.checks[c.key];
                return (
                  <li key={c.key} className="flex items-start gap-3 bg-surface px-4 py-3">
                    <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${ok ? "bg-accent-soft text-accent-strong" : "bg-[color-mix(in_oklch,var(--danger)_12%,transparent)] text-danger"}`}>
                      <Icon name={ok ? "check" : "close"} size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {c.label} <span className="font-normal text-muted">needs {c.need}:1</span>
                      </p>
                      <p className="text-[0.8125rem] text-muted">{c.detail}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${ok ? "text-accent-strong" : "text-danger"}`}>{ok ? "Pass" : "Fail"}</span>
                  </li>
                );
              })}
            </ul>
            {r.translucent && (
              <p className="mt-3 text-[0.8125rem] text-muted">
                Transparent colors were flattened first: the background over white, then the text over that background ({formatHex(r.f)} on{" "}
                {formatHex(r.b)}).
              </p>
            )}
          </ToolPanel>

          <ToolPanel title="Preview">
            <div className="space-y-4 rounded-xl p-5 shadow-[0_0_0_1px_var(--line)]" style={{ background: formatHex(r.b), color: formatHex(r.f) }}>
              <p style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>Large heading text</p>
              <p style={{ fontSize: 16, lineHeight: 1.6 }}>
                Normal body text at 16px. The quick brown fox jumps over the lazy dog, then reads the fine print twice.
              </p>
              <p style={{ fontSize: 13 }}>Small caption at 13px</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium" style={{ border: `2px solid ${formatHex(r.f)}` }}>
                  Outlined button
                </span>
                <svg width="28" height="28" viewBox="0 0 24 24" aria-label="Sample icon" role="img">
                  <path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" fill="none" stroke={formatHex(r.f)} strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </ToolPanel>
        </div>
      )}

      {r && (
        <ToolPanel title="Nearest passing colors">
          <p className="mb-4 text-sm text-ink-2">
            Each suggestion keeps the hue and chroma and changes only OKLCH lightness, as little as possible, so the color still feels like yours.
          </p>
          <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-2.5 font-medium text-ink">Target</th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-ink">Adjust text</th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-ink">Adjust background</th>
                </tr>
              </thead>
              <tbody>
                {r.suggestions.map((s) => (
                  <tr key={s.need} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-2 font-normal text-ink-2">{s.label}</th>
                    <td className="px-4 py-2">
                      <Suggestion c={s.fg?.color ?? null} dl={s.fg?.deltaL ?? 0} onUse={(h) => setFg(h)} pair={r.b} role="text" />
                    </td>
                    <td className="px-4 py-2">
                      <Suggestion c={s.bg?.color ?? null} dl={s.bg?.deltaL ?? 0} onUse={(h) => setBg(h)} pair={r.f} role="background" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ToolPanel>
      )}
      <PrivacyNote />
    </div>
  );
}

function Suggestion({ c, dl, onUse, pair, role }: { c: Color | null; dl: number; onUse: (hex: string) => void; pair: Color; role: "text" | "background" }) {
  if (!c) return <span className="text-muted">Not reachable by lightness alone</span>;
  const hex = formatHex(c);
  if (dl === 0) return <span className="inline-flex items-center gap-1.5 text-accent-strong"><Icon name="check" size={14} />Already passes</span>;
  const ratio = contrastRatio(c, pair);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="inline-block h-6 w-6 rounded-md shadow-[inset_0_0_0_1px_var(--line-strong)]" style={{ background: hex }} aria-hidden="true" />
      <code className="font-mono">{hex}</code>
      <span className="text-xs text-muted">{(Math.floor(ratio * 100) / 100).toFixed(2)}:1</span>
      <Btn variant="subtle" onClick={() => onUse(hex)} aria-label={`Use ${hex} as ${role} color`}>
        Use
      </Btn>
    </span>
  );
}
