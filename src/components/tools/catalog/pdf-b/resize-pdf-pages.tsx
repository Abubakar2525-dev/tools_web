"use client";

import { useState } from "react";
import { Checkbox, SelectField } from "@/components/tools/kit";
import { getPdfLib } from "@/components/tools/engines/pdf";
import { ProcessTool } from "./process";
import { NumInput } from "./shared";
import { geomOf, loadForEdit, reframePage } from "./lib/write";
import { PAPER, type PaperName, fitInside, mmToPt, viewSize } from "./lib/geometry";

type Orientation = "auto" | "portrait" | "landscape";

/** Target page size for a source page of w×h. */
function targetSize(paper: PaperName, o: Orientation, w: number, h: number) {
  const p = PAPER[paper];
  const landscape = o === "landscape" || (o === "auto" && w > h);
  return landscape ? { W: p.h, H: p.w } : { W: p.w, H: p.h };
}

export default function Tool() {
  const [paper, setPaper] = useState<PaperName>("A4");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [marginMm, setMarginMm] = useState(0);
  const [upscale, setUpscale] = useState(true);
  const key = JSON.stringify({ paper, orientation, marginMm, upscale });

  return (
    <ProcessTool
      suffix={paper.toLowerCase()}
      actionLabel={`Resize to ${paper}`}
      doneMessage={`Every page is now ${PAPER[paper].label}.`}
      settingsKey={key}
      process={async (source) => {
        const L = await getPdfLib();
        const doc = await loadForEdit(L, source.bytes);
        const m = mmToPt(marginMm);
        for (const page of doc.getPages()) {
          const { w, h } = viewSize(geomOf(L, page));
          const { W, H } = targetSize(paper, orientation, w, h);
          const box = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
          if (box.w < 20 || box.h < 20) throw new Error("The margin is too large for this paper size.");
          const f = fitInside(w, h, box, upscale);
          reframePage(L, doc, page, W, H, { x: f.x, y: f.y, w: f.w, h: f.h });
        }
        return doc.save();
      }}
      settings={() => (
        <section aria-label="Resize settings" className="space-y-4">
          <SelectField
            label="Paper size"
            value={paper}
            onChange={(e) => setPaper(e.target.value as PaperName)}
            options={(Object.keys(PAPER) as PaperName[]).map((k) => ({ value: k, label: PAPER[k].label }))}
          />
          <SelectField
            label="Orientation"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as Orientation)}
            options={[
              { value: "auto", label: "Match each page (auto)" },
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
          <NumInput key={`m${marginMm}`} label="Margin" suffix="mm" value={marginMm} min={0} max={80} onCommit={setMarginMm} />
          <Checkbox label="Enlarge pages smaller than the paper" checked={upscale} onChange={setUpscale} hint="Off keeps small pages at 100% and centers them." />
          <p className="text-[0.8125rem] text-muted">Content keeps its proportions. If the shapes differ, the leftover space becomes white borders.</p>
        </section>
      )}
    />
  );
}
