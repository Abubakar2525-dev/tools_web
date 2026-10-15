"use client";

import { useState } from "react";
import { Btn, Checkbox, Notice, NumberField, PrivacyNote, SelectField, TextArea, TextField, ToolPanel, fmt, parseNum } from "@/components/tools/kit";
import { FileDrop, Spinner } from "@/components/tools/engines/files";
import { DownloadResult, savePdf, useJob, type Output } from "./shared";
import { TextWriter } from "./textpdf";
import { PAPER, mmToPt, paperSize, type Orientation, type PaperName } from "./lib/layout";

export default function Tool() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [paper, setPaper] = useState<PaperName>("A4");
  const [orient, setOrient] = useState<Orientation>("portrait");
  const [fontSize, setFontSize] = useState("11");
  const [spacing, setSpacing] = useState("1.4");
  const [margin, setMargin] = useState("20");
  const [numbers, setNumbers] = useState(true);
  const [name, setName] = useState("document");
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();

  const fs = parseNum(fontSize);
  const sp = parseNum(spacing);
  const mg = parseNum(margin);
  const errs = {
    fs: fs === null || fs < 6 || fs > 36 ? "Use 6 to 36 pt." : null,
    sp: sp === null || sp < 1 || sp > 3 ? "Use 1 to 3." : null,
    mg: mg === null || mg < 5 || mg > 60 ? "Use 5 to 60 mm." : null,
  };
  const bad = Boolean(errs.fs || errs.sp || errs.mg);
  const touch = () => setOut(null);

  const run = () =>
    job.run(async ({ alive }) => {
      setOut(null);
      if (fs === null || sp === null || mg === null) return;
      const size = paperSize(paper, orient);
      const m = mmToPt(mg);
      const w = await TextWriter.create(size.w, size.h, { top: m, right: m, bottom: m, left: m });
      if (title.trim()) {
        w.text(title.trim(), { size: fs * 1.6, bold: true, lineHeight: 1.25 });
        w.space(fs * 0.8);
      }
      // A form-feed character starts a new page, as in plain-text print files.
      text.split("\f").forEach((chunk, i) => {
        if (i > 0) w.newPage();
        w.text(chunk, { size: fs, lineHeight: sp });
      });
      if (numbers) w.pageNumbers();
      if (title.trim()) w.doc.setTitle(title.trim());
      const blob = await savePdf(w.doc);
      if (alive()) setOut({ blob, name: `${(name.trim() || "document").replace(/[\\/:*?"<>|]+/g, "_")}.pdf`, detail: `${w.pages.length} ${w.pages.length === 1 ? "page" : "pages"}` });
    });

  return (
    <ToolPanel title="Text to PDF">
      <div className="space-y-5">
        <FileDrop
          accept=".txt,.md,.csv,.log,text/plain"
          maxSizeMB={10}
          compact
          label="Load a text file (optional)"
          hint="Plain text up to 10 MB. Or type below."
          onFiles={async (f) => {
            if (!f[0]) return;
            setText(await f[0].text());
            setName(f[0].name.replace(/\.[^.]+$/, ""));
            touch();
          }}
        />
        <TextField label="Title" optional hint="Printed in bold at the top of the first page." value={title} onChange={(e) => { setTitle(e.target.value); touch(); }} />
        <TextArea
          label="Text"
          value={text}
          onChange={(e) => { setText(e.target.value); touch(); }}
          placeholder="Type or paste your text here."
          className="[&_textarea]:min-h-[260px]"
        />
        <p className="text-[0.8125rem] text-muted tabular-nums">{fmt(text.length, 0)} characters</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Page size"
            value={paper}
            onChange={(e) => { setPaper(e.target.value as PaperName); touch(); }}
            options={(["A4", "Letter", "Legal", "A5", "A3"] as PaperName[]).map((p) => ({ value: p, label: PAPER[p].label }))}
          />
          <SelectField
            label="Orientation"
            value={orient}
            onChange={(e) => { setOrient(e.target.value as Orientation); touch(); }}
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
          <NumberField label="Font size (pt)" value={fontSize} error={errs.fs} onChange={(e) => { setFontSize(e.target.value); touch(); }} />
          <NumberField label="Line spacing" hint="1.0 is tight, 1.5 is airy." value={spacing} error={errs.sp} onChange={(e) => { setSpacing(e.target.value); touch(); }} />
          <NumberField label="Margins (mm)" value={margin} error={errs.mg} onChange={(e) => { setMargin(e.target.value); touch(); }} />
          <TextField label="File name" value={name} onChange={(e) => { setName(e.target.value); touch(); }} />
        </div>
        <Checkbox label="Add page numbers (Page 1 of N)" checked={numbers} onChange={(v) => { setNumbers(v); touch(); }} />
        <div className="flex flex-wrap items-center gap-3">
          <Btn icon="file" disabled={!text.trim() || bad || job.busy} onClick={run}>
            Create PDF
          </Btn>
          {job.busy && <Spinner label="Laying out pages" />}
        </div>
        {job.error && <Notice tone="error">{job.error}</Notice>}
        {out && <DownloadResult output={out} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}
