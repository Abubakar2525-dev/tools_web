"use client";

import { useEffect, useState } from "react";
import { Btn, Checkbox, Notice, NumberField, PrivacyNote, SelectField, ToolPanel, fmt, parseNum } from "@/components/tools/kit";
import { ProgressBar } from "@/components/tools/engines/files";
import { embedUnicodeFonts, getPdfLib } from "@/components/tools/engines/pdf";
import { thumbnailUrl } from "./PageGrid";
import { DownloadResult, PdfSourcePicker, embedPageSafe, outName, savePdf, useJob, usePdfSource, type LoadedPdf, type Output, type PdfJsDoc } from "./shared";
import { PAPER, mmToPt, normRot, paperSize, placeInBox, posterPlan, ptToMm, type Orientation, type PaperName, type PosterPlan } from "./lib/layout";

export default function Tool() {
  const { state, load, clear } = usePdfSource();
  return (
    <ToolPanel title="Poster tiles">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

const int = (s: string, lo: number, hi: number) => {
  const v = parseNum(s);
  return v !== null && Number.isInteger(v) && v >= lo && v <= hi ? v : null;
};

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const [pageStr, setPageStr] = useState("1");
  const [cols, setCols] = useState("2");
  const [rows, setRows] = useState("2");
  const [paper, setPaper] = useState<PaperName>("A4");
  const [orient, setOrient] = useState<Orientation>("portrait");
  const [margin, setMargin] = useState("10");
  const [overlap, setOverlap] = useState("10");
  const [labels, setLabels] = useState(true);
  const [guides, setGuides] = useState(true);
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();

  const page = int(pageStr, 1, pdf.pageCount);
  const c = int(cols, 1, 10);
  const r = int(rows, 1, 10);
  const m = parseNum(margin);
  const o = parseNum(overlap);
  const errs = {
    page: page === null ? `Choose a page from 1 to ${pdf.pageCount}.` : null,
    cols: c === null ? "Use 1 to 10." : null,
    rows: r === null ? "Use 1 to 10." : null,
    margin: m === null || m < 0 || m > 30 ? "Use 0 to 30 mm." : null,
    overlap: o === null || o < 0 || o > 50 ? "Use 0 to 50 mm." : null,
  };
  const anyErr = Object.values(errs).some(Boolean);

  const src = pdf.lib;
  const srcPage = src && page !== null ? src.getPage(page - 1) : null;
  const rot = srcPage ? normRot(srcPage.getRotation().angle) : 0;
  const box = srcPage?.getCropBox();
  const dispW = box ? (rot % 180 ? box.height : box.width) : 0;
  const dispH = box ? (rot % 180 ? box.width : box.height) : 0;
  const sheet = paperSize(paper, orient);
  const planOrErr = !anyErr && box ? posterPlan(dispW, dispH, sheet.w, sheet.h, c!, r!, mmToPt(m!), mmToPt(o!)) : null;
  const plan = planOrErr && typeof planOrErr !== "string" ? planOrErr : null;
  const planErr = typeof planOrErr === "string" ? planOrErr : null;
  const touch = () => setOut(null);

  const run = () =>
    job.run(async ({ alive, progress }) => {
      setOut(null);
      if (!src || !srcPage || !plan || m === null || o === null) return;
      const lib = await getPdfLib();
      const { PDFDocument, rgb, degrees, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = lib;
      const doc = await PDFDocument.create();
      const fonts = labels ? await embedUnicodeFonts(doc) : null;
      const emb = await embedPageSafe(doc, srcPage);
      if (!emb) throw new Error("This page has no content to enlarge.");
      const mp = mmToPt(m);
      const ov = mmToPt(o);
      const pl = placeInBox(emb.width, emb.height, rot, { x: plan.art.x, y: plan.art.y, w: plan.art.w, h: plan.art.h });
      for (let i = 0; i < plan.tiles.length; i++) {
        if (!alive()) return;
        const t = plan.tiles[i];
        const sh = doc.addPage([sheet.w, sheet.h]);
        sh.pushOperators(pushGraphicsState(), rectangle(mp, mp, plan.printW, plan.printH), clip(), endPath());
        sh.drawPage(emb, { x: pl.x + t.dx, y: pl.y + t.dy, width: pl.width, height: pl.height, rotate: degrees(pl.rotate) });
        sh.pushOperators(popGraphicsState());
        const grey = rgb(0.55, 0.55, 0.55);
        if (guides && ov > 0) {
          const dash = { thickness: 0.5, color: grey, dashArray: [4, 3] };
          // Where the neighbouring tile's edge lands: align it here, then trim or tape.
          if (t.col < c! - 1) sh.drawLine({ start: { x: mp + plan.printW - ov, y: mp }, end: { x: mp + plan.printW - ov, y: mp + plan.printH }, ...dash });
          if (t.row < r! - 1) sh.drawLine({ start: { x: mp, y: mp + ov }, end: { x: mp + plan.printW, y: mp + ov }, ...dash });
        }
        if (fonts) {
          const text = `${t.label}  ·  row ${t.label.replace(/\d+$/, "")}, column ${t.col + 1}  ·  ${c} × ${r} tiles  ·  page ${page}`;
          const size = 8;
          const y = mp >= 12 ? sheet.h - mp + 4 : sheet.h - mp - 12;
          const x = mp >= 12 ? mp : mp + 4;
          if (mp < 12) sh.drawRectangle({ x: x - 2, y: y - 3, width: fonts.regular.widthOfTextAtSize(text, size) + 4, height: size + 5, color: rgb(1, 1, 1), opacity: 0.85 });
          sh.drawText(text, { x, y, size, font: fonts.bold, color: rgb(0.25, 0.25, 0.25) });
        }
        progress((i + 1) / plan.tiles.length);
      }
      const blob = await savePdf(doc);
      if (alive()) setOut({ blob, name: outName(pdf.file, `poster-${c}x${r}`), detail: `${plan.tiles.length} sheets` });
    });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField label="Page to enlarge" value={pageStr} error={errs.page} onChange={(e) => { setPageStr(e.target.value); touch(); }} />
        <NumberField label="Columns (sheets across)" value={cols} error={errs.cols} onChange={(e) => { setCols(e.target.value); touch(); }} />
        <NumberField label="Rows (sheets down)" value={rows} error={errs.rows} onChange={(e) => { setRows(e.target.value); touch(); }} />
        <SelectField
          label="Sheet size"
          value={paper}
          onChange={(e) => { setPaper(e.target.value as PaperName); touch(); }}
          options={(["A4", "Letter", "A3", "Legal", "Tabloid"] as PaperName[]).map((p) => ({ value: p, label: PAPER[p].label }))}
        />
        <SelectField
          label="Sheet orientation"
          value={orient}
          onChange={(e) => { setOrient(e.target.value as Orientation); touch(); }}
          options={[
            { value: "portrait", label: "Portrait" },
            { value: "landscape", label: "Landscape" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Margin (mm)" hint="Unprinted edge" value={margin} error={errs.margin} onChange={(e) => { setMargin(e.target.value); touch(); }} />
          <NumberField label="Overlap (mm)" hint="Shared strip" value={overlap} error={errs.overlap} onChange={(e) => { setOverlap(e.target.value); touch(); }} />
        </div>
      </div>
      <Checkbox label="Label each tile (A1, A2, B1…)" checked={labels} onChange={(v) => { setLabels(v); touch(); }} />
      <Checkbox label="Draw dashed overlap guides" hint="Shows where the next tile's edge should line up." checked={guides} onChange={(v) => { setGuides(v); touch(); }} />
      {planErr && <Notice tone="error">{planErr}</Notice>}
      {plan && page !== null && (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
          <PosterPreview doc={pdf.js} page={page} plan={plan} cols={c!} rows={r!} />
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted">Finished poster</dt>
              <dd className="tabular-nums text-ink">
                {fmt(ptToMm(plan.art.w) / 10, 1)} × {fmt(ptToMm(plan.art.h) / 10, 1)} cm ({fmt(plan.art.w / 72, 1)} × {fmt(plan.art.h / 72, 1)} in)
              </dd>
            </div>
            <div>
              <dt className="text-muted">Enlargement</dt>
              <dd className="tabular-nums text-ink">{fmt(plan.scale * 100, 0)}%</dd>
            </div>
            <div>
              <dt className="text-muted">Sheets</dt>
              <dd className="tabular-nums text-ink">{plan.tiles.length}</dd>
            </div>
          </dl>
        </div>
      )}
      <Btn icon="layers" disabled={anyErr || !plan || job.busy} onClick={run}>
        Create poster tiles
      </Btn>
      {job.busy && <ProgressBar value={job.progress ?? 0} label="Building tiles" />}
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {out && (
        <>
          <DownloadResult output={out} />
          <Notice tone="info" title="Assembling">
            Print at 100% (actual size). Lay the sheets out by label, A1 at the top left. Trim the overlap strip from one sheet along the dashed line, or lay it over its neighbour, then tape from the back.
          </Notice>
        </>
      )}
    </div>
  );
}

function PosterPreview({ doc, page, plan, cols, rows }: { doc: PdfJsDoc; page: number; plan: PosterPlan; cols: number; rows: number }) {
  const [img, setImg] = useState<{ page: number; url: string } | null>(null);
  useEffect(() => {
    let alive = true;
    thumbnailUrl(doc, page, 480).then(
      (url) => alive && setImg({ page, url }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [doc, page]);
  const W = plan.posterW;
  const H = plan.posterH;
  const stroke = Math.max(W, H) / 300;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Preview: page ${page} split into ${cols} columns and ${rows} rows of sheets`}
      className="h-auto max-h-[420px] w-full rounded-lg bg-sunken"
    >
      {img && img.page === page && <image href={img.url} x={plan.art.x} y={H - plan.art.y - plan.art.h} width={plan.art.w} height={plan.art.h} preserveAspectRatio="none" />}
      {plan.tiles.map((t) => {
        const tx = t.col * ((plan.posterW - plan.printW) / Math.max(1, cols - 1));
        const ty = t.row * ((plan.posterH - plan.printH) / Math.max(1, rows - 1));
        return (
          <g key={t.label}>
            <rect x={tx} y={ty} width={plan.printW} height={plan.printH} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeDasharray={`${stroke * 4} ${stroke * 3}`} />
            <text x={tx + stroke * 6} y={ty + stroke * 18} fontSize={stroke * 14} fill="var(--accent-strong)" fontWeight="600">
              {t.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
