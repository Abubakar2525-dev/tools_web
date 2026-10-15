"use client";

import { useState } from "react";
import { Btn, Checkbox, Notice, NumberField, PrivacyNote, Segmented, SelectField, ToolPanel, parseNum } from "@/components/tools/kit";
import { ProgressBar } from "@/components/tools/engines/files";
import { getPdfLib } from "@/components/tools/engines/pdf";
import { DownloadResult, PdfSourcePicker, embedPageSafe, outName, savePdf, useJob, usePdfSource, type LoadedPdf, type Output } from "./shared";
import { PAPER, gridCells, mmToPt, nUpGrid, paperSize, placeInBox, type NUp, type Orientation, type PaperName } from "./lib/layout";

export default function Tool() {
  const { state, load, clear } = usePdfSource();
  return (
    <ToolPanel title="N-up pages">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const [n, setN] = useState<"2" | "4" | "6" | "9">("4");
  const [paper, setPaper] = useState<PaperName>("A4");
  const [orient, setOrient] = useState<Orientation | "auto">("auto");
  const [order, setOrder] = useState<"rows" | "columns">("rows");
  const [margin, setMargin] = useState("8");
  const [gap, setGap] = useState("4");
  const [border, setBorder] = useState(true);
  const [numbers, setNumbers] = useState(false);
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();

  const per = Number(n) as NUp;
  const grid = nUpGrid(per, orient);
  const mN = parseNum(margin);
  const gN = parseNum(gap);
  const mErr = mN === null || mN < 0 || mN > 40 ? "Use 0 to 40 mm." : null;
  const gErr = gN === null || gN < 0 || gN > 30 ? "Use 0 to 30 mm." : null;
  const sheets = Math.ceil(pdf.pageCount / per);
  const reset = () => setOut(null);

  const run = () =>
    job.run(async ({ alive, progress }) => {
      setOut(null);
      const src = pdf.lib;
      if (!src || mN === null || gN === null) return;
      const { PDFDocument, rgb, degrees } = await getPdfLib();
      const doc = await PDFDocument.create();
      const font = numbers ? await doc.embedFont((await getPdfLib()).StandardFonts.Helvetica) : null;
      const size = paperSize(paper, grid.orientation);
      const labelSpace = numbers ? 10 : 0;
      const cells = gridCells(size.w, size.h, grid.cols, grid.rows, mmToPt(mN), mmToPt(gN), order);
      const pages = src.getPages();
      for (let s = 0; s < sheets; s++) {
        if (!alive()) return;
        const sheet = doc.addPage([size.w, size.h]);
        for (let c = 0; c < per; c++) {
          const idx = s * per + c;
          if (idx >= pages.length) break;
          const cell = cells[c];
          const box = { x: cell.x, y: cell.y + labelSpace, w: cell.w, h: cell.h - labelSpace };
          const emb = await embedPageSafe(doc, pages[idx]);
          const pl = emb ? placeInBox(emb.width, emb.height, pages[idx].getRotation().angle, box) : null;
          if (emb && pl) sheet.drawPage(emb, { x: pl.x, y: pl.y, width: pl.width, height: pl.height, rotate: degrees(pl.rotate) });
          if (border) {
            const r = pages[idx].getRotation().angle % 180 !== 0;
            const b = pages[idx].getCropBox();
            const dw = (r ? b.height : b.width) * (pl?.scale ?? 1);
            const dh = (r ? b.width : b.height) * (pl?.scale ?? 1);
            sheet.drawRectangle({
              x: box.x + (box.w - dw) / 2,
              y: box.y + (box.h - dh) / 2,
              width: dw,
              height: dh,
              borderColor: rgb(0.6, 0.6, 0.6),
              borderWidth: 0.5,
            });
          }
          if (font) {
            const t = String(idx + 1);
            const tw = font.widthOfTextAtSize(t, 7);
            sheet.drawText(t, { x: cell.x + cell.w / 2 - tw / 2, y: cell.y + 1.5, size: 7, font, color: rgb(0.35, 0.35, 0.35) });
          }
        }
        progress((s + 1) / sheets);
        if (s % 10 === 9) await new Promise((r) => setTimeout(r, 0));
      }
      const blob = await savePdf(doc);
      if (alive()) setOut({ blob, name: outName(pdf.file, `${per}-up`), detail: `${sheets} ${sheets === 1 ? "sheet" : "sheets"}` });
    });

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Pages per sheet</p>
        <Segmented
          label="Pages per sheet"
          value={n}
          onChange={(v) => {
            setN(v);
            reset();
          }}
          options={[
            { value: "2", label: "2" },
            { value: "4", label: "4" },
            { value: "6", label: "6" },
            { value: "9", label: "9" },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Sheet size"
          value={paper}
          onChange={(e) => {
            setPaper(e.target.value as PaperName);
            reset();
          }}
          options={(["A4", "Letter", "A3", "Legal", "Tabloid", "A5"] as PaperName[]).map((p) => ({ value: p, label: PAPER[p].label }))}
        />
        <SelectField
          label="Sheet orientation"
          value={orient}
          onChange={(e) => {
            setOrient(e.target.value as Orientation | "auto");
            reset();
          }}
          options={[
            { value: "auto", label: "Automatic (best fit for the grid)" },
            { value: "portrait", label: "Portrait" },
            { value: "landscape", label: "Landscape" },
          ]}
        />
        <SelectField
          label="Reading order"
          value={order}
          onChange={(e) => {
            setOrder(e.target.value as "rows" | "columns");
            reset();
          }}
          options={[
            { value: "rows", label: "Across, then down" },
            { value: "columns", label: "Down, then across" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Margin (mm)" value={margin} error={mErr} onChange={(e) => { setMargin(e.target.value); reset(); }} />
          <NumberField label="Gap (mm)" value={gap} error={gErr} onChange={(e) => { setGap(e.target.value); reset(); }} />
        </div>
      </div>
      <Checkbox label="Draw a thin border around each page" checked={border} onChange={(v) => { setBorder(v); reset(); }} />
      <Checkbox label="Print the original page number under each page" checked={numbers} onChange={(v) => { setNumbers(v); reset(); }} />
      <p className="text-sm text-ink-2">
        Layout: {grid.cols} × {grid.rows} on {grid.orientation} {paper}. {pdf.pageCount} pages fit on <strong className="tabular-nums text-ink">{sheets}</strong>{" "}
        {sheets === 1 ? "sheet" : "sheets"}.
      </p>
      <Btn icon="layers" disabled={Boolean(mErr || gErr) || job.busy} onClick={run}>
        Create {per}-up PDF
      </Btn>
      {job.busy && <ProgressBar value={job.progress ?? 0} label="Laying out sheets" />}
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {out && <DownloadResult output={out} />}
    </div>
  );
}
