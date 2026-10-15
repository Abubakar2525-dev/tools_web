"use client";

import { useState } from "react";
import { Btn, Notice, NumberField, PrivacyNote, Segmented, TextField, ToolPanel, parseNum } from "@/components/tools/kit";
import { ProgressBar } from "@/components/tools/engines/files";
import { parsePageRanges } from "@/components/tools/engines/pdf";
import { ImageResults, renderToBlob, type RenderedImage } from "./images";
import { PdfSourcePicker, outName, useJob, usePdfSource, type LoadedPdf } from "./shared";

export default function Tool() {
  const { state, load, clear } = usePdfSource({ edit: false });
  return (
    <ToolPanel title="Page thumbnails">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

const PRESETS = ["160", "320", "640", "1200"];

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const [width, setWidth] = useState("320");
  const [fmt, setFmt] = useState<"png" | "jpg">("png");
  const [range, setRange] = useState("");
  const [images, setImages] = useState<RenderedImage[]>([]);
  const job = useJob();

  const w = parseNum(width);
  const wErr = w === null || !Number.isInteger(w) || w < 32 || w > 4000 ? "Use a whole number of pixels from 32 to 4000." : null;
  const pages = parsePageRanges(range, pdf.pageCount);
  const rangeErr = typeof pages === "string" ? pages : null;

  const run = () =>
    job.run(async ({ alive, progress }) => {
      if (typeof pages === "string" || w === null) return;
      setImages([]);
      const acc: RenderedImage[] = [];
      const pad = String(pdf.pageCount).length;
      for (let i = 0; i < pages.length; i++) {
        if (!alive()) return;
        const p = pages[i];
        const vp = (await pdf.js.getPage(p)).getViewport({ scale: 1 });
        // Scale so the rendered width matches exactly (rounding down by at most 1 px).
        const scale = (w + 0.5) / vp.width;
        const res = await renderToBlob(pdf.js, p, scale, fmt === "png" ? "image/png" : "image/jpeg", fmt === "jpg" ? 0.85 : undefined);
        acc.push({ ...res, page: p, name: outName(pdf.file, `thumb-${String(p).padStart(pad, "0")}-${w}w`, fmt) });
        progress((i + 1) / pages.length);
        if (alive() && (i % 5 === 4 || i === pages.length - 1)) setImages(acc.slice());
      }
    });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Width presets</p>
        <Segmented<string>
          label="Width preset"
          value={width}
          onChange={setWidth}
          options={PRESETS.map((p) => ({ value: p, label: `${p} px` }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Width in pixels" hint="Height follows the page's aspect ratio." value={width} error={wErr} onChange={(e) => setWidth(e.target.value)} />
        <TextField
          label="Pages"
          hint={`Ranges like 1-3, 8. Leave blank for all ${pdf.pageCount}.`}
          placeholder="All pages"
          value={range}
          error={rangeErr}
          onChange={(e) => setRange(e.target.value)}
        />
      </div>
      <Segmented
        label="Image format"
        value={fmt}
        onChange={setFmt}
        options={[
          { value: "png", label: "PNG" },
          { value: "jpg", label: "JPG" },
        ]}
      />
      <Btn icon="image" disabled={Boolean(wErr || rangeErr) || job.busy} onClick={run}>
        Generate {Array.isArray(pages) && pages.length === 1 ? "preview" : "previews"}
      </Btn>
      {job.busy && <ProgressBar value={job.progress ?? 0} label="Rendering previews" />}
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {images.length > 0 && <ImageResults images={images} zipName={outName(pdf.file, "thumbnails", "zip")} />}
    </div>
  );
}
