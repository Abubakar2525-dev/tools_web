"use client";

import { useState } from "react";
import { Checkbox, Segmented } from "@/components/tools/kit";
import { getPdfLib } from "@/components/tools/engines/pdf";
import { ProcessTool } from "./process";
import { NumInput } from "./shared";
import { geomOf, loadForEdit, reframePage } from "./lib/write";
import { type Sides, marginContentRect, mmToPt, viewSize } from "./lib/geometry";

const SIDES: (keyof Sides)[] = ["top", "right", "bottom", "left"];

export default function Tool() {
  const [unit, setUnit] = useState<"mm" | "pt">("mm");
  const [same, setSame] = useState(true);
  const [sides, setSides] = useState<Sides>({ top: 15, right: 15, bottom: 15, left: 15 });

  const toPt = (v: number) => (unit === "mm" ? mmToPt(v) : v);
  const ptSides: Sides = { top: toPt(sides.top), right: toPt(sides.right), bottom: toPt(sides.bottom), left: toPt(sides.left) };
  const key = JSON.stringify({ unit, sides });

  return (
    <ProcessTool
      suffix="margins"
      actionLabel="Add margins"
      doneMessage="Margins added. Page sizes are unchanged; content was scaled down to fit."
      settingsKey={key}
      validate={() => (SIDES.every((s) => sides[s] === 0) ? "Set at least one margin above zero." : null)}
      sourceOverlay={(scale, geom) => {
        const { w, h } = viewSize(geom);
        const r = marginContentRect(w, h, ptSides);
        if (typeof r === "string") return null;
        return (
          <svg className="h-full w-full">
            <rect x={r.x * scale} y={r.y * scale} width={r.w * scale} height={r.h * scale} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4" />
          </svg>
        );
      }}
      sourceHint="The dashed outline shows where the page content will sit after adding margins."
      process={async (source) => {
        const L = await getPdfLib();
        const doc = await loadForEdit(L, source.bytes);
        doc.getPages().forEach((page, i) => {
          const { w, h } = viewSize(geomOf(L, page));
          const r = marginContentRect(w, h, ptSides);
          if (typeof r === "string") throw new Error(`Page ${i + 1}: ${r}`);
          reframePage(L, doc, page, w, h, r);
        });
        return doc.save();
      }}
      settings={() => (
        <section aria-label="Margin settings" className="space-y-4">
          <Segmented
            label="Unit"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "mm", label: "Millimeters" },
              { value: "pt", label: "Points" },
            ]}
          />
          <Checkbox label="Same margin on all sides" checked={same} onChange={setSame} />
          {same ? (
            <NumInput
              key={`all${unit}${sides.top}`}
              label="Margin"
              suffix={unit}
              value={sides.top}
              min={0}
              max={unit === "mm" ? 150 : 425}
              onCommit={(v) => setSides({ top: v, right: v, bottom: v, left: v })}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {SIDES.map((s) => (
                <NumInput
                  key={`${s}${unit}${sides[s]}`}
                  label={s[0].toUpperCase() + s.slice(1)}
                  suffix={unit}
                  value={sides[s]}
                  min={0}
                  max={unit === "mm" ? 150 : 425}
                  onCommit={(v) => setSides((x) => ({ ...x, [s]: v }))}
                />
              ))}
            </div>
          )}
          <p className="text-[0.8125rem] text-muted">Content is scaled evenly (never stretched) and centered in the space left inside the margins.</p>
        </section>
      )}
    />
  );
}
