"use client";

import Link from "next/link";
import { useState } from "react";
import { Btn, Checkbox, CopyBtn, Notice, OutputBlock, PrivacyNote, StatGrid, TextField, ToolPanel, downloadFile, fmt } from "@/components/tools/kit";
import { ProgressBar } from "@/components/tools/engines/files";
import { parsePageRanges } from "@/components/tools/engines/pdf";
import { extractLines } from "./extract";
import { linesToText } from "./lib/text";
import { formatRanges } from "./lib/layout";
import { PdfSourcePicker, outName, useJob, usePdfSource, type LoadedPdf } from "./shared";

export default function Tool() {
  const { state, load, clear } = usePdfSource({ edit: false });
  return (
    <ToolPanel title="PDF to text">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

type Result = { pages: { page: number; text: string }[] };

const PREVIEW_LIMIT = 200_000;

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const [range, setRange] = useState("");
  const [separators, setSeparators] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const job = useJob();
  const pages = parsePageRanges(range, pdf.pageCount);
  const rangeErr = typeof pages === "string" ? pages : null;

  const run = () =>
    job.run(async ({ alive, progress }) => {
      if (typeof pages === "string") return;
      setResult(null);
      const acc: Result["pages"] = [];
      for (let i = 0; i < pages.length; i++) {
        if (!alive()) return;
        acc.push({ page: pages[i], text: linesToText(await extractLines(pdf.js, pages[i])) });
        progress((i + 1) / pages.length);
      }
      if (alive()) setResult({ pages: acc });
    });

  const text = result
    ? result.pages
        .map((p) => (separators ? `--- Page ${p.page} ---\n${p.text}` : p.text))
        .join(separators ? "\n\n" : "\n\f\n")
        .trim() + "\n"
    : "";
  const empty = result ? result.pages.filter((p) => !p.text.trim()).map((p) => p.page) : [];
  const words = text.trim() ? text.trim().split(/\s+/).filter((w) => !/^-+$/.test(w)).length : 0;

  return (
    <div className="space-y-5">
      <TextField
        label="Pages"
        optional
        hint={`Blank for all ${pdf.pageCount} pages, or ranges like 2-5.`}
        placeholder="All pages"
        value={range}
        error={rangeErr}
        onChange={(e) => setRange(e.target.value)}
      />
      <Checkbox
        label="Mark where each page starts"
        hint="Adds a line like --- Page 3 --- before each page. Without it, pages are separated by a form-feed character."
        checked={separators}
        onChange={setSeparators}
      />
      <Btn icon="text" disabled={Boolean(rangeErr) || job.busy} onClick={run}>
        Extract text
      </Btn>
      {job.busy && <ProgressBar value={job.progress ?? 0} label="Reading text" />}
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {result && (
        <div className="space-y-4">
          <StatGrid
            items={[
              { label: "Pages read", value: result.pages.length },
              { label: "Words", value: fmt(words, 0) },
              { label: "Characters", value: fmt(text.length, 0) },
            ]}
          />
          {empty.length > 0 && (
            <Notice tone="warning" title={empty.length === result.pages.length ? "No text layer found" : "Some pages have no text"}>
              {empty.length === result.pages.length ? "This looks like a scanned or image-only PDF." : `Pages ${formatRanges(empty)} returned no text; they are probably images.`} This tool reads the existing text layer and does not run OCR. Try{" "}
              <Link className="link" href="/tools/pdf-to-image">
                PDF to image
              </Link>{" "}
              followed by{" "}
              <Link className="link" href="/tools/image-to-text-ocr">
                Image to text (OCR)
              </Link>{" "}
              instead.
            </Notice>
          )}
          <div className="flex flex-wrap gap-2">
            <CopyBtn text={text} label="Copy text" />
            <Btn variant="ghost" icon="download" disabled={!text.trim()} onClick={() => downloadFile(outName(pdf.file, "", "txt"), text)}>
              Download .txt
            </Btn>
          </div>
          <OutputBlock label="Extracted text">
            {text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT)}\n\n[Preview truncated. Copy or download to get all ${fmt(text.length, 0)} characters.]` : text}
          </OutputBlock>
        </div>
      )}
    </div>
  );
}
