"use client";

import { useState } from "react";
import { Btn, Notice, NumberField, PrivacyNote, Segmented, TextField, ToolPanel, parseNum } from "@/components/tools/kit";
import { ProgressBar, zipFiles } from "@/components/tools/engines/files";
import { parsePageRanges } from "@/components/tools/engines/pdf";
import { DownloadResult, PdfSourcePicker, outName, pdfFromPages, savePdf, useJob, usePdfSource, type LoadedPdf, type Output } from "./shared";
import { chunkPages, formatRanges } from "./lib/layout";

type Mode = "each" | "every" | "ranges";

export default function Tool() {
  const { state, load, clear } = usePdfSource();
  return (
    <ToolPanel title="Split a PDF">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

/** Each comma-separated part ("1-3", "4", "8-") becomes one output file. */
function parseGroups(input: string, n: number): number[][] | string {
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "Type at least one range, for example 1-3, 4-6, 7-.";
  const groups: number[][] = [];
  for (const part of parts) {
    const r = parsePageRanges(part, n);
    if (typeof r === "string") return r;
    groups.push(r);
  }
  return groups;
}

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const [mode, setMode] = useState<Mode>("each");
  const [every, setEvery] = useState("2");
  const [ranges, setRanges] = useState("");
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();
  const n = pdf.pageCount;

  const everyN = parseNum(every);
  const everyErr = mode === "every" && (everyN === null || !Number.isInteger(everyN) || everyN < 1) ? "Enter a whole number of pages, 1 or more." : null;
  const groupsOrErr: number[][] | string =
    mode === "each" ? chunkPages(n, 1) : mode === "every" ? (everyErr ? everyErr : chunkPages(n, everyN ?? 1)) : parseGroups(ranges, n);
  const groups = typeof groupsOrErr === "string" ? null : groupsOrErr;
  const rangesErr = mode === "ranges" && ranges.trim() && typeof groupsOrErr === "string" ? groupsOrErr : null;

  const run = () =>
    job.run(async ({ alive, progress }) => {
      setOut(null);
      if (!pdf.lib || !groups) return;
      const width = String(groups.length).length;
      const files: { name: string; data: Blob }[] = [];
      for (let i = 0; i < groups.length; i++) {
        if (!alive()) return;
        const g = groups[i];
        const doc = await pdfFromPages(pdf.lib, g.map((p) => p - 1));
        const label = g.length === 1 ? `page-${g[0]}` : `part-${String(i + 1).padStart(width, "0")}_p${formatRanges(g).replace(/, /g, "_")}`;
        files.push({ name: outName(pdf.file, label.slice(0, 80)), data: await savePdf(doc) });
        progress((i + 1) / (groups.length + 1));
        await new Promise((r) => setTimeout(r, 0));
      }
      if (!alive()) return;
      if (files.length === 1) setOut({ blob: files[0].data, name: files[0].name, detail: `${groups[0].length} pages` });
      else {
        const blob = await zipFiles(files, 0);
        if (alive()) setOut({ blob, name: outName(pdf.file, "split", "zip"), detail: `${files.length} PDFs` });
      }
    });

  return (
    <div className="space-y-5">
      <Segmented
        label="How to split"
        value={mode}
        onChange={(v) => {
          setMode(v);
          setOut(null);
        }}
        options={[
          { value: "each", label: "Every page" },
          { value: "every", label: "Every N pages" },
          { value: "ranges", label: "Custom ranges" },
        ]}
      />
      {mode === "every" && (
        <NumberField
          label="Pages per file"
          value={every}
          error={everyErr}
          onChange={(e) => {
            setEvery(e.target.value);
            setOut(null);
          }}
          className="max-w-[12rem]"
        />
      )}
      {mode === "ranges" && (
        <TextField
          label="Ranges, one file per comma"
          hint={`Example: 1-3, 4-6, 7- makes three files. This PDF has ${n} pages.`}
          placeholder="1-3, 4-6, 7-"
          value={ranges}
          error={rangesErr}
          onChange={(e) => {
            setRanges(e.target.value);
            setOut(null);
          }}
        />
      )}
      {groups && (
        <div>
          <p className="text-sm text-ink-2">
            This makes <strong className="tabular-nums">{groups.length}</strong> {groups.length === 1 ? "file" : "files"}
            {groups.length > 1 ? ", delivered as a ZIP" : ""}.
          </p>
          <ol className="mt-2 max-h-48 overflow-auto rounded-lg bg-sunken px-4 py-2 text-sm text-ink-2" aria-label="Planned files">
            {groups.slice(0, 200).map((g, i) => (
              <li key={i} className="tabular-nums">
                File {i + 1}: {g.length === 1 ? "page" : "pages"} {formatRanges(g)}
              </li>
            ))}
            {groups.length > 200 && <li>…and {groups.length - 200} more</li>}
          </ol>
        </div>
      )}
      <Btn icon="scissors" disabled={!groups || job.busy} onClick={run}>
        Split PDF
      </Btn>
      {job.busy && <ProgressBar value={job.progress ?? 0} label="Splitting" />}
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {out && <DownloadResult output={out} label={out.name.endsWith(".zip") ? "Download ZIP" : "Download PDF"} />}
    </div>
  );
}
