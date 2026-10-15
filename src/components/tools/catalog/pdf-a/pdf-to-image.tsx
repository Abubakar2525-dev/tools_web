"use client";

import { useState } from "react";
import { Btn, Notice, NumberField, PrivacyNote, SelectField, TextField, ToolPanel, parseNum } from "@/components/tools/kit";
import { ProgressBar, useCanEncode } from "@/components/tools/engines/files";
import { parsePageRanges } from "@/components/tools/engines/pdf";
import { ImageResults, renderToBlob, safeScale, type RenderedImage } from "./images";
import { PdfSourcePicker, outName, useJob, usePdfSource, type LoadedPdf } from "./shared";

type Fmt = "image/png" | "image/jpeg" | "image/webp";
const EXT: Record<Fmt, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export default function Tool() {
  const { state, load, clear } = usePdfSource({ edit: false });
  return (
    <ToolPanel title="PDF to image">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const [format, setFormat] = useState<Fmt>("image/png");
  const [dpi, setDpi] = useState("150");
  const [quality, setQuality] = useState("90");
  const [range, setRange] = useState("");
  const [images, setImages] = useState<RenderedImage[]>([]);
  const [reduced, setReduced] = useState(false);
  const job = useJob();
  const webpOk = useCanEncode("image/webp");

  const dpiN = parseNum(dpi);
  const dpiErr = dpiN === null || dpiN < 36 || dpiN > 600 ? "Use a resolution between 36 and 600 DPI." : null;
  const qN = parseNum(quality);
  const qErr = format !== "image/png" && (qN === null || qN < 10 || qN > 100) ? "Quality must be between 10 and 100." : null;
  const pages = parsePageRanges(range, pdf.pageCount);
  const rangeErr = typeof pages === "string" ? pages : null;

  const run = () =>
    job.run(async ({ alive, progress }) => {
      if (typeof pages === "string" || dpiN === null) return;
      setImages([]);
      setReduced(false);
      const acc: RenderedImage[] = [];
      let anyReduced = false;
      const pad = String(pdf.pageCount).length;
      for (let i = 0; i < pages.length; i++) {
        if (!alive()) return;
        const p = pages[i];
        const { scale, reduced: r } = await safeScale(pdf.js, p, dpiN / 72);
        anyReduced ||= r;
        const res = await renderToBlob(pdf.js, p, scale, format, format === "image/png" ? undefined : (qN ?? 90) / 100);
        acc.push({ ...res, page: p, name: outName(pdf.file, `page-${String(p).padStart(pad, "0")}`, EXT[format]) });
        progress((i + 1) / pages.length);
        // Show results progressively for long documents.
        if (alive() && (i % 5 === 4 || i === pages.length - 1)) setImages(acc.slice());
      }
      if (alive()) setReduced(anyReduced);
    });

  const formats = [
    { value: "image/png", label: "PNG (lossless)" },
    { value: "image/jpeg", label: "JPG (smaller)" },
    ...(webpOk ? [{ value: "image/webp", label: "WebP" }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Format" options={formats} value={format} onChange={(e) => setFormat(e.target.value as Fmt)} />
        <SelectField
          label="Resolution preset"
          options={[
            { value: "72", label: "72 DPI (screen, small)" },
            { value: "96", label: "96 DPI" },
            { value: "150", label: "150 DPI (good default)" },
            { value: "200", label: "200 DPI" },
            { value: "300", label: "300 DPI (print)" },
            { value: "custom", label: "Custom" },
          ]}
          value={["72", "96", "150", "200", "300"].includes(dpi) ? dpi : "custom"}
          onChange={(e) => setDpi(e.target.value === "custom" ? "120" : e.target.value)}
        />
        <NumberField label="DPI" hint="Pixels per inch of the page. 36 to 600." value={dpi} error={dpiErr} onChange={(e) => setDpi(e.target.value)} />
        {format !== "image/png" ? (
          <NumberField label="Quality (%)" hint="Higher is sharper and larger." value={quality} error={qErr} onChange={(e) => setQuality(e.target.value)} />
        ) : (
          <div />
        )}
        <TextField
          label="Pages"
          optional
          hint={`Blank for all ${pdf.pageCount} pages, or ranges like 1-3, 8.`}
          placeholder="All pages"
          value={range}
          error={rangeErr}
          onChange={(e) => setRange(e.target.value)}
          className="sm:col-span-2"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Btn icon="image" disabled={Boolean(dpiErr || qErr || rangeErr) || job.busy} onClick={run}>
          Convert {Array.isArray(pages) ? pages.length : ""} {Array.isArray(pages) && pages.length === 1 ? "page" : "pages"}
        </Btn>
        {job.busy && (
          <Btn variant="subtle" onClick={job.cancel}>
            Stop
          </Btn>
        )}
      </div>
      {job.busy && <ProgressBar value={job.progress ?? 0} label="Rendering pages" />}
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {reduced && <Notice tone="warning">Some pages were too large for a browser canvas at this DPI, so they were rendered at the largest safe size instead.</Notice>}
      {images.length > 0 && <ImageResults images={images} zipName={outName(pdf.file, "images", "zip")} />}
    </div>
  );
}
