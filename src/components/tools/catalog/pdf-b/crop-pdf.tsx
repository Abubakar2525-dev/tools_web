"use client";

import { useState } from "react";
import { Checkbox, Segmented, TextField } from "@/components/tools/kit";
import { getPdfLib } from "@/components/tools/engines/pdf";
import { ProcessTool } from "./process";
import { NumInput, rangeOrError } from "./shared";
import { cropPage, geomOf, loadForEdit } from "./lib/write";
import { type Sides, cropRect, viewSize } from "./lib/geometry";

const SIDES: (keyof Sides)[] = ["top", "right", "bottom", "left"];
const r1 = (v: number) => Math.round(v * 10) / 10;

export default function Tool() {
  const [unit, setUnit] = useState<"%" | "pt">("%");
  const [sides, setSides] = useState<Sides>({ top: 5, right: 5, bottom: 5, left: 5 });
  const [same, setSame] = useState(false);
  const [pages, setPages] = useState("");
  const key = JSON.stringify({ unit, sides, pages });

  return (
    <ProcessTool
      suffix="cropped"
      actionLabel="Crop pages"
      doneMessage="Pages cropped."
      settingsKey={key}
      sourceMode="rect"
      sourceHint="Drag a rectangle on the page to choose the area to keep, or type trim amounts. The shaded area will be hidden."
      onSourceCreate={(g, geom) => {
        if (g.kind !== "rect" || g.w < 10 || g.h < 10) return;
        const { w, h } = viewSize(geom);
        setUnit("pt");
        setSame(false);
        setSides({ top: r1(Math.max(0, g.y)), left: r1(Math.max(0, g.x)), right: r1(Math.max(0, w - g.x - g.w)), bottom: r1(Math.max(0, h - g.y - g.h)) });
      }}
      sourceOverlay={(scale, geom) => {
        const { w, h } = viewSize(geom);
        const r = cropRect(geom, sides, unit);
        if (typeof r === "string") return null;
        return (
          <svg className="h-full w-full">
            <path
              fillRule="evenodd"
              fill="rgb(15 23 42 / 0.45)"
              d={`M0 0H${w * scale}V${h * scale}H0Z M${r.x * scale} ${r.y * scale}h${r.w * scale}v${r.h * scale}h${-r.w * scale}Z`}
            />
            <rect x={r.x * scale} y={r.y * scale} width={r.w * scale} height={r.h * scale} fill="none" stroke="var(--accent)" strokeWidth={2} />
          </svg>
        );
      }}
      validate={({ numPages }) => {
        if (SIDES.every((s) => sides[s] === 0)) return "Set at least one side to trim.";
        if (unit === "%" && SIDES.some((s) => sides[s] >= 100)) return "Each percentage must be below 100.";
        if (unit === "%" && (sides.left + sides.right >= 100 || sides.top + sides.bottom >= 100)) return "Opposite sides together must trim less than 100%.";
        return rangeOrError(pages, numPages).error;
      }}
      process={async (source, { numPages }) => {
        const L = await getPdfLib();
        const doc = await loadForEdit(L, source.bytes);
        const r = rangeOrError(pages, numPages);
        if (!r.pages) throw new Error(r.error);
        for (const p of r.pages) {
          const page = doc.getPage(p - 1);
          const rect = cropRect(geomOf(L, page), sides, unit);
          if (typeof rect === "string") throw new Error(`Page ${p}: ${rect}`);
          cropPage(L, page, rect);
        }
        return doc.save();
      }}
      settings={() => (
        <section aria-label="Crop settings" className="space-y-4">
          <Segmented
            label="Unit"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "%", label: "Percent" },
              { value: "pt", label: "Points" },
            ]}
          />
          <Checkbox label="Same trim on all sides" checked={same} onChange={setSame} />
          {same ? (
            <NumInput key={`all${unit}${sides.top}`} label="Trim each side" suffix={unit} value={sides.top} min={0} max={unit === "%" ? 49 : 5000} onCommit={(v) => setSides({ top: v, right: v, bottom: v, left: v })} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {SIDES.map((s) => (
                <NumInput
                  key={`${s}${unit}${sides[s]}`}
                  label={`Trim ${s}`}
                  suffix={unit}
                  value={sides[s]}
                  min={0}
                  max={unit === "%" ? 99 : 5000}
                  onCommit={(v) => setSides((x) => ({ ...x, [s]: v }))}
                />
              ))}
            </div>
          )}
          <TextField label="Pages" optional placeholder="All pages" hint="Examples: 1, 3-5" value={pages} onChange={(e) => setPages(e.target.value)} />
          <p className="text-[0.8125rem] text-muted">Cropping sets the visible area (CropBox). Trimmed content is hidden, not deleted, so it can still be recovered from the file.</p>
        </section>
      )}
    />
  );
}
