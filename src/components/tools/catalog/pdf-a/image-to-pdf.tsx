"use client";

import { useState } from "react";
import type { PDFDocument, PDFImage } from "pdf-lib";
import { Btn, Notice, NumberField, PrivacyNote, ResetBtn, SelectField, ToolPanel, parseNum, uid } from "@/components/tools/kit";
import { FileDrop, ProgressBar, canvasToBlob, fileToBytes, formatBytes, useObjectUrl } from "@/components/tools/engines/files";
import { IMAGE_ACCEPT, decodeImage } from "@/components/tools/catalog/image/lib/pipeline";
import { getPdfLib } from "@/components/tools/engines/pdf";
import { Icon } from "@/components/ui/Icon";
import { TileBtn } from "./PageGrid";
import { DownloadResult, savePdf, useJob, type Output } from "./shared";
import { jpegOrientation, sniffImage } from "./lib/bytes";
import { PAPER, mmToPt, moveItem, type PaperName } from "./lib/layout";

type Item = { id: string; file: File };
type Size = "fit" | PaperName;
type Orient = "auto" | "portrait" | "landscape";

/** Embeds an image, re-encoding through a canvas when pdf-lib can't take it directly or EXIF rotation applies. */
async function embedImage(doc: PDFDocument, file: File): Promise<PDFImage> {
  const bytes = await fileToBytes(file);
  const kind = sniffImage(bytes);
  if (kind === "jpeg" && jpegOrientation(bytes) === 1) return doc.embedJpg(bytes);
  if (kind === "png") return doc.embedPng(bytes);
  const bmp = await decodeImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  if (kind === "jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const type = kind === "jpeg" ? "image/jpeg" : "image/png";
  const blob = await canvasToBlob(canvas, type, 0.92);
  canvas.width = canvas.height = 0;
  const out = new Uint8Array(await blob.arrayBuffer());
  return type === "image/jpeg" ? doc.embedJpg(out) : doc.embedPng(out);
}

function Thumb({ file }: { file: File }) {
  const url = useObjectUrl(file);
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-sunken">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL
        <img src={url} alt="" className="max-h-full max-w-full object-contain" />
      )}
    </div>
  );
}

export default function Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const [size, setSize] = useState<Size>("A4");
  const [orient, setOrient] = useState<Orient>("auto");
  const [margin, setMargin] = useState("10");
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();
  const m = parseNum(margin);
  const mErr = m === null || m < 0 || m > 50 ? "Use 0 to 50 mm." : null;
  const touch = () => setOut(null);

  const run = () =>
    job.run(async ({ alive, progress }) => {
      setOut(null);
      if (m === null) return;
      const { PDFDocument } = await getPdfLib();
      const doc = await PDFDocument.create();
      const mp = mmToPt(m);
      for (let i = 0; i < items.length; i++) {
        if (!alive()) return;
        let img: PDFImage;
        try {
          img = await embedImage(doc, items[i].file);
        } catch (e) {
          throw new Error(`${items[i].file.name}: ${e instanceof Error ? e.message : "could not be read."}`);
        }
        // Images are measured at 96 pixels per inch (1 px = 0.75 pt).
        const iw = img.width * 0.75;
        const ih = img.height * 0.75;
        let pw: number;
        let ph: number;
        if (size === "fit") {
          pw = iw + 2 * mp;
          ph = ih + 2 * mp;
        } else {
          const p = PAPER[size];
          const land = orient === "landscape" || (orient === "auto" && iw > ih);
          pw = land ? p.h : p.w;
          ph = land ? p.w : p.h;
        }
        const page = doc.addPage([pw, ph]);
        const bw = pw - 2 * mp;
        const bh = ph - 2 * mp;
        const s = size === "fit" ? 1 : Math.min(bw / iw, bh / ih);
        const dw = iw * s;
        const dh = ih * s;
        page.drawImage(img, { x: mp + (bw - dw) / 2, y: mp + (bh - dh) / 2, width: dw, height: dh });
        progress((i + 1) / items.length);
        await new Promise((r) => setTimeout(r, 0));
      }
      const blob = await savePdf(doc);
      if (alive()) setOut({ blob, name: items.length === 1 ? items[0].file.name.replace(/\.[^.]+$/, "") + ".pdf" : "images.pdf", detail: `${items.length} pages` });
    });

  return (
    <ToolPanel
      title="Images to PDF"
      actions={items.length > 0 && <ResetBtn label="Clear all" onClick={() => { job.cancel(); setItems([]); touch(); }} />}
    >
      <div className="space-y-5">
        <FileDrop
          accept={IMAGE_ACCEPT}
          multiple
          maxFiles={200}
          maxSizeMB={50}
          allowPaste
          compact={items.length > 0}
          label="Choose images or drop them here"
          hint="PNG, JPG, WebP, AVIF, GIF, BMP or HEIC up to 50 MB each. Full-resolution images are preserved where possible."
          onFiles={(fs) => {
            setItems((it) => [...it, ...fs.map((file) => ({ id: uid(), file }))]);
            touch();
          }}
        />
        {items.length > 0 && (
          <>
            <ol className="space-y-2" aria-label="Images, in page order">
              {items.map((it, i) => (
                <li key={it.id} className="flex items-center gap-3 rounded-xl p-2 shadow-[0_0_0_1px_var(--line)]">
                  <span className="w-6 text-right text-sm tabular-nums text-ink">{i + 1}.</span>
                  <Thumb file={it.file} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink" title={it.file.name}>
                      {it.file.name}
                    </p>
                    <p className="text-[0.8125rem] tabular-nums text-muted">{formatBytes(it.file.size)}</p>
                  </div>
                  <div className="flex gap-1">
                    <TileBtn label={`Move ${it.file.name} up`} disabled={i === 0} onClick={() => { setItems((x) => moveItem(x, i, -1)); touch(); }}>
                      <Icon name="arrow" size={16} className="-rotate-90" />
                    </TileBtn>
                    <TileBtn label={`Move ${it.file.name} down`} disabled={i === items.length - 1} onClick={() => { setItems((x) => moveItem(x, i, 1)); touch(); }}>
                      <Icon name="arrow" size={16} className="rotate-90" />
                    </TileBtn>
                    <TileBtn label={`Remove ${it.file.name}`} onClick={() => { setItems((x) => x.filter((y) => y.id !== it.id)); touch(); }}>
                      <Icon name="close" size={16} />
                    </TileBtn>
                  </div>
                </li>
              ))}
            </ol>
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Page size"
                value={size}
                onChange={(e) => { setSize(e.target.value as Size); touch(); }}
                options={[
                  { value: "fit", label: "Fit to each image" },
                  { value: "A4", label: PAPER.A4.label },
                  { value: "Letter", label: PAPER.Letter.label },
                  { value: "Legal", label: PAPER.Legal.label },
                  { value: "A3", label: PAPER.A3.label },
                  { value: "A5", label: PAPER.A5.label },
                ]}
              />
              <SelectField
                label="Orientation"
                value={orient}
                disabled={size === "fit"}
                onChange={(e) => { setOrient(e.target.value as Orient); touch(); }}
                options={[
                  { value: "auto", label: "Match each image" },
                  { value: "portrait", label: "Portrait" },
                  { value: "landscape", label: "Landscape" },
                ]}
              />
              <NumberField label="Margin (mm)" value={margin} error={mErr} onChange={(e) => { setMargin(e.target.value); touch(); }} />
            </div>
            <Btn icon="file" disabled={Boolean(mErr) || job.busy} onClick={run}>
              Create PDF ({items.length} {items.length === 1 ? "page" : "pages"})
            </Btn>
          </>
        )}
        {job.busy && <ProgressBar value={job.progress ?? 0} label="Adding images" />}
        {job.error && <Notice tone="error">{job.error}</Notice>}
        {out && <DownloadResult output={out} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}
