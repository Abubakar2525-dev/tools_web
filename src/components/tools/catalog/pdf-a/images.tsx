"use client";

/** Shared pieces for tools that turn PDF pages into image files. */

import { Btn } from "@/components/tools/kit";
import { downloadBlob, formatBytes, useObjectUrl, zipFiles } from "@/components/tools/engines/files";
import { renderPage } from "@/components/tools/engines/pdf";
import type { PdfJsDoc } from "./shared";

export type RenderedImage = { name: string; blob: Blob; width: number; height: number; page: number };

/** Safe canvas budget across browsers (iOS Safari caps canvases near 16.7 MP). */
export const MAX_PIXELS = 16_000_000;
export const MAX_SIDE = 16_000;

/** Scale for a page so that it respects the canvas budget. Returns the scale and whether it was reduced. */
export async function safeScale(doc: PdfJsDoc, page: number, wanted: number) {
  const pg = await doc.getPage(page);
  const vp = pg.getViewport({ scale: 1 });
  let s = wanted;
  const w = vp.width * s;
  const h = vp.height * s;
  const k = Math.min(1, Math.sqrt(MAX_PIXELS / (w * h)), MAX_SIDE / Math.max(w, h));
  s *= k;
  return { scale: s, reduced: k < 1 };
}

export async function renderToBlob(doc: PdfJsDoc, page: number, scale: number, type: string, quality?: number) {
  const canvas = await renderPage(doc, page, scale);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("This browser could not encode the image."))), type, quality),
  );
  const out = { blob, width: canvas.width, height: canvas.height };
  canvas.width = canvas.height = 0;
  return out;
}

function ImageRow({ img }: { img: RenderedImage }) {
  const url = useObjectUrl(img.blob);
  return (
    <li className="flex items-center gap-3 rounded-lg p-2 shadow-[0_0_0_1px_var(--line)]">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-sunken">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL
          <img src={url} alt={`Page ${img.page} preview`} className="max-h-full max-w-full object-contain" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink" title={img.name}>
          {img.name}
        </p>
        <p className="text-[0.8125rem] tabular-nums text-muted">
          {img.width} × {img.height} px · {formatBytes(img.blob.size)}
        </p>
      </div>
      <Btn variant="ghost" icon="download" onClick={() => downloadBlob(img.blob, img.name)} aria-label={`Download ${img.name}`}>
        <span className="hidden sm:inline">Download</span>
      </Btn>
    </li>
  );
}

export function ImageResults({ images, zipName }: { images: RenderedImage[]; zipName: string }) {
  const total = images.reduce((n, i) => n + i.blob.size, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2" role="status">
          {images.length} {images.length === 1 ? "image" : "images"} · {formatBytes(total)}
        </p>
        {images.length > 1 && (
          <Btn
            icon="download"
            onClick={async () => {
              const blob = await zipFiles(
                images.map((i) => ({ name: i.name, data: i.blob })),
                0,
              );
              downloadBlob(blob, zipName);
            }}
          >
            Download all (ZIP)
          </Btn>
        )}
      </div>
      <ul className="grid max-h-[520px] gap-2 overflow-auto p-0.5 sm:grid-cols-2" aria-label="Generated images">
        {images.map((img) => (
          <ImageRow key={img.name} img={img} />
        ))}
      </ul>
    </div>
  );
}
