"use client";

import { useState } from "react";
import { Btn, Checkbox, Notice, NumberField, PrivacyNote, SelectField, ToolPanel, parseNum } from "@/components/tools/kit";
import { ProgressBar } from "@/components/tools/engines/files";
import { getPdfLib } from "@/components/tools/engines/pdf";
import { DownloadResult, PdfSourcePicker, embedPageSafe, outName, savePdf, useJob, usePdfSource, type LoadedPdf, type Output } from "./shared";
import { PAPER, bookletSides, mmToPt, normRot, paperSize, placeInBox, type PaperName } from "./lib/layout";

export default function Tool() {
  const { state, load, clear } = usePdfSource();
  return (
    <ToolPanel title="Booklet maker">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

type Sheet = "auto" | PaperName;

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const [sheet, setSheet] = useState<Sheet>("auto");
  const [margin, setMargin] = useState("0");
  const [rtl, setRtl] = useState(false);
  const [fold, setFold] = useState(false);
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();

  const marginN = parseNum(margin);
  const marginErr = marginN === null || marginN < 0 || marginN > 40 ? "Use 0 to 40 mm." : null;
  const sides = bookletSides(pdf.pageCount, rtl);
  const padded = sides.length * 2 - pdf.pageCount;

  const run = () =>
    job.run(async ({ alive, progress }) => {
      setOut(null);
      const src = pdf.lib;
      if (!src || marginN === null) return;
      const { PDFDocument, rgb, degrees } = await getPdfLib();
      const doc = await PDFDocument.create();
      const pages = src.getPages();
      // Displayed size of each source page.
      const disp = pages.map((p) => {
        const b = p.getCropBox();
        const r = normRot(p.getRotation().angle);
        return r === 90 || r === 270 ? { w: b.height, h: b.width } : { w: b.width, h: b.height };
      });
      let sw: number;
      let sh: number;
      if (sheet === "auto") {
        sw = 2 * Math.max(...disp.map((d) => d.w));
        sh = Math.max(...disp.map((d) => d.h));
      } else {
        const s = paperSize(sheet, "landscape");
        sw = s.w;
        sh = s.h;
      }
      const m = mmToPt(marginN);
      const embedded = new Map<number, Awaited<ReturnType<typeof embedPageSafe>>>();
      for (let i = 0; i < sides.length; i++) {
        if (!alive()) return;
        const side = sides[i];
        const page = doc.addPage([sw, sh]);
        const slots: [number | null, { x: number; y: number; w: number; h: number }][] = [
          [side.left, { x: m, y: m, w: sw / 2 - 2 * m, h: sh - 2 * m }],
          [side.right, { x: sw / 2 + m, y: m, w: sw / 2 - 2 * m, h: sh - 2 * m }],
        ];
        for (const [num, box] of slots) {
          if (num === null) continue;
          if (!embedded.has(num)) embedded.set(num, await embedPageSafe(doc, pages[num - 1]));
          const emb = embedded.get(num);
          if (!emb) continue;
          const pl = placeInBox(emb.width, emb.height, pages[num - 1].getRotation().angle, box);
          page.drawPage(emb, { x: pl.x, y: pl.y, width: pl.width, height: pl.height, rotate: degrees(pl.rotate) });
        }
        if (fold) page.drawLine({ start: { x: sw / 2, y: sh - 14 }, end: { x: sw / 2, y: sh }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
        progress((i + 1) / sides.length);
      }
      const blob = await savePdf(doc);
      if (alive()) setOut({ blob, name: outName(pdf.file, "booklet"), detail: `${sides.length / 2} sheets, ${sides.length} sides` });
    });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Sheet size (landscape)"
          value={sheet}
          onChange={(e) => {
            setSheet(e.target.value as Sheet);
            setOut(null);
          }}
          options={[
            { value: "auto", label: "Auto: two pages side by side at 100%" },
            ...(["A4", "Letter", "A3", "Tabloid", "Legal"] as PaperName[]).map((p) => ({ value: p, label: PAPER[p].label })),
          ]}
        />
        <NumberField
          label="Margin inside each half (mm)"
          value={margin}
          error={marginErr}
          onChange={(e) => {
            setMargin(e.target.value);
            setOut(null);
          }}
        />
      </div>
      <Checkbox label="Right-to-left binding" hint="For Arabic, Hebrew or manga-style booklets that open from the right." checked={rtl} onChange={(v) => { setRtl(v); setOut(null); }} />
      <Checkbox label="Print a short fold mark at the top center" checked={fold} onChange={(v) => { setFold(v); setOut(null); }} />

      <div className="rounded-xl bg-sunken p-4 text-sm text-ink-2">
        <p>
          {pdf.pageCount} pages{padded > 0 ? ` + ${padded} blank ${padded === 1 ? "page" : "pages"}` : ""} = {sides.length * 2} booklet pages on{" "}
          <strong className="text-ink">{sides.length / 2}</strong> {sides.length / 2 === 1 ? "sheet" : "sheets"} ({sides.length} printed sides).
        </p>
        <ol className="mt-2 max-h-40 space-y-0.5 overflow-auto tabular-nums" aria-label="Imposition order">
          {sides.slice(0, 120).map((s) => (
            <li key={`${s.sheet}-${s.side}`}>
              Sheet {s.sheet} {s.side}: {s.left ?? "blank"} | {s.right ?? "blank"}
            </li>
          ))}
        </ol>
      </div>

      <Btn icon="book" disabled={Boolean(marginErr) || job.busy} onClick={run}>
        Make booklet
      </Btn>
      {job.busy && <ProgressBar value={job.progress ?? 0} label="Imposing pages" />}
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {out && (
        <>
          <DownloadResult output={out} />
          <Notice tone="info" title="How to print">
            Print double-sided and choose <strong>flip on short edge</strong>, at 100% scale (not &quot;fit to page&quot;). Stack the sheets in order, fold the stack in half and staple along the fold.
          </Notice>
        </>
      )}
    </div>
  );
}
