"use client";

import { useState } from "react";
import { Btn, Notice, PrivacyNote, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { Icon } from "@/components/ui/Icon";
import { PageGrid, TileBtn } from "./PageGrid";
import { DownloadResult, PdfSourcePicker, outName, pdfFromPages, savePdf, useJob, usePdfSource, type LoadedPdf, type Output } from "./shared";
import { normRot } from "./lib/layout";

export default function Tool() {
  const { state, load, clear } = usePdfSource();
  return (
    <ToolPanel title="Rotate pages">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

function Editor({ pdf }: { pdf: LoadedPdf }) {
  // Extra clockwise rotation per page (1-based), in degrees.
  const [rot, setRot] = useState<Record<number, number>>({});
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();
  const items = Array.from({ length: pdf.pageCount }, (_, i) => ({ id: String(i + 1), page: i + 1, rotation: rot[i + 1] ?? 0 }));
  const changed = items.filter((it) => normRot(it.rotation) !== 0).length;

  const turn = (page: number, delta: number) => {
    setRot((r) => ({ ...r, [page]: (r[page] ?? 0) + delta }));
    setOut(null);
  };
  const turnAll = (delta: number) => {
    setRot((r) => {
      const n: Record<number, number> = {};
      for (let p = 1; p <= pdf.pageCount; p++) n[p] = (r[p] ?? 0) + delta;
      return n;
    });
    setOut(null);
  };

  const run = () =>
    job.run(async ({ alive }) => {
      setOut(null);
      if (!pdf.lib) throw new Error("The PDF is not ready yet.");
      const doc = await pdfFromPages(
        pdf.lib,
        items.map((it) => it.page - 1),
        (i) => normRot(rot[i + 1] ?? 0),
      );
      const blob = await savePdf(doc);
      if (alive()) setOut({ blob, name: outName(pdf.file, "rotated"), detail: `${changed} ${changed === 1 ? "page" : "pages"} rotated` });
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Rotate every page">
        <Btn variant="ghost" onClick={() => turnAll(-90)}>
          All 90° left
        </Btn>
        <Btn variant="ghost" onClick={() => turnAll(90)}>
          All 90° right
        </Btn>
        <Btn variant="ghost" onClick={() => turnAll(180)}>
          All 180°
        </Btn>
        <Btn
          variant="subtle"
          icon="reset"
          onClick={() => {
            setRot({});
            setOut(null);
          }}
        >
          Clear rotations
        </Btn>
      </div>
      <PageGrid
        doc={pdf.js}
        items={items}
        label="Pages"
        actions={(it) => {
          const r = normRot(it.rotation ?? 0);
          return (
            <>
              <TileBtn label={`Rotate page ${it.page} 90 degrees left`} onClick={() => turn(it.page, -90)}>
                <Icon name="reset" size={16} />
              </TileBtn>
              <TileBtn label={`Rotate page ${it.page} 90 degrees right`} onClick={() => turn(it.page, 90)}>
                <Icon name="reset" size={16} className="-scale-x-100" />
              </TileBtn>
              <span className="ml-auto text-xs tabular-nums text-muted" aria-label={`Page ${it.page} turned ${r} degrees`}>
                {r ? `+${r}°` : "0°"}
              </span>
            </>
          );
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Btn icon="download" disabled={changed === 0 || job.busy} onClick={run}>
          Apply rotation
        </Btn>
        {changed === 0 && <span className="text-sm text-muted">Turn at least one page first.</span>}
        {job.busy && <Spinner label="Building PDF" />}
      </div>
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {out && <DownloadResult output={out} />}
    </div>
  );
}
