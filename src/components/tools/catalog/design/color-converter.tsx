"use client";

import { useMemo, useState } from "react";
import { Btn, Notice, PrivacyNote, ResetBtn, SplitGrid, StatGrid, TextField, ToolPanel } from "@/components/tools/kit";
import {
  clip,
  exactName,
  formatHex,
  formatOklch,
  inP3Gamut,
  inSrgbGamut,
  nearestNamed,
  parseColor,
  round,
  toGamut,
} from "./lib/color";
import { FormatTable, checker, textOn } from "./shared";

const EXAMPLES = ["#1e90ff", "rgb(255 99 71 / 0.8)", "hsl(150 60% 40%)", "oklch(70% 0.2 320)", "lab(60% 40 -60)", "cmyk(0%, 60%, 90%, 5%)", "color(display-p3 0 1 0)", "rebeccapurple"];

export default function Tool() {
  const [input, setInput] = useState("#1e90ff");
  const parsed = useMemo(() => parseColor(input), [input]);
  const info = useMemo(() => {
    if (!parsed) return null;
    const mapped = toGamut(parsed);
    const clipped = clip(parsed);
    const named = nearestNamed(parsed);
    return {
      inSrgb: inSrgbGamut(parsed),
      inP3: inP3Gamut(parsed),
      mappedHex: formatHex(mapped),
      clippedHex: formatHex({ ...clipped, alpha: parsed.alpha }),
      named,
      exact: exactName(formatHex({ ...parsed, alpha: 1 })),
    };
  }, [parsed]);

  return (
    <div className="space-y-5">
      <ToolPanel title="Color converter" actions={<ResetBtn onClick={() => setInput("#1e90ff")} />}>
        <SplitGrid>
          <div className="min-w-0 space-y-4">
            <TextField
              label="Color"
              hint="Any CSS color: hex, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch(), color(), a named color, or hsv() / cmyk()."
              value={input}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setInput(e.target.value)}
              error={input.trim() && !parsed ? "This color could not be read. Check the syntax and the number of values." : null}
            />
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <Btn key={ex} variant="subtle" onClick={() => setInput(ex)} className="font-mono !text-[0.8rem]">
                  {ex}
                </Btn>
              ))}
            </div>
            {parsed && info && (
              <>
                <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]" style={{ background: checker }}>
                  <div
                    className="grid h-36 place-items-center font-mono text-sm"
                    style={{ background: formatOklch(parsed), color: textOn(toGamut(parsed)) }}
                  >
                    {info.mappedHex}
                  </div>
                </div>
                <StatGrid
                  items={[
                    { label: "Nearest named color", value: info.named.name },
                    { label: "Difference (ΔE OK)", value: round(info.named.deltaE * 100, 2) },
                    { label: "Alpha", value: `${round(parsed.alpha * 100, 1)}%` },
                  ]}
                />
                {info.exact && <Notice tone="success">This is exactly the CSS named color “{info.exact}”.</Notice>}
                {!info.inSrgb && (
                  <Notice tone="warning" title="Outside the sRGB gamut">
                    <p>
                      This color cannot be shown exactly on a standard sRGB screen{info.inP3 ? ", but it fits in Display P3" : " or in Display P3"}. The
                      sRGB-based formats below use CSS gamut mapping (chroma reduced in OKLCH): <code>{info.mappedHex}</code>. Simple per-channel
                      clipping would give <code>{info.clippedHex}</code>. LAB, LCH, OKLab, OKLCH and P3 keep the original values.
                    </p>
                  </Notice>
                )}
              </>
            )}
          </div>
          <div className="min-w-0">
            {parsed ? (
              <FormatTable color={parsed} />
            ) : (
              <Notice tone="info">Type a color on the left to see it in every format.</Notice>
            )}
            <p className="mt-3 text-[0.8125rem] text-muted">
              CMYK here is a simple formula without an ICC print profile, so it will not match what a printer produces. ΔE OK is shown ×100 (about
              2 is a just-noticeable difference).
            </p>
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
