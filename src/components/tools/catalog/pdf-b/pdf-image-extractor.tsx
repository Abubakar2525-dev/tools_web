"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Checkbox, Notice, PrivacyNote, Segmented, StatGrid, ToolPanel } from "@/components/tools/kit";
import { ProgressBar, baseName, canvasToBlob, downloadBlob, formatBytes, zipFiles } from "@/components/tools/engines/files";
import { getPdfjs, openPdf } from "@/components/tools/engines/pdf";
import { NumInput, PdfPicker, type PdfSource } from "./shared";
import { fnv1a } from "./lib/text";

interface Found {
  name: string;
  page: number;
  width: number;
  height: number;
  blob: Blob;
  url: string;
}

interface ImgLike {
  width?: number;
  height?: number;
  bitmap?: ImageBitmap;
  data?: Uint8Array | Uint8ClampedArray;
  kind?: number;
}

type PdfPage = Awaited<ReturnType<Awaited<ReturnType<typeof openPdf>>["getPage"]>>;

/** Waits for an image object that pdf.js decoded while building the operator list. */
function getObj(page: PdfPage, id: string): Promise<ImgLike | null> {
  const store = id.startsWith("g_") ? page.commonObjs : page.objs;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 8000);
    try {
      store.get(id, (d: unknown) => {
        window.clearTimeout(timer);
        resolve((d as ImgLike) ?? null);
      });
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Draws pdf.js image data (bitmap or raw pixels) onto a new canvas. */
function toCanvas(img: ImgLike): HTMLCanvasElement | null {
  const w = img.width ?? img.bitmap?.width ?? 0;
  const h = img.height ?? img.bitmap?.height ?? 0;
  if (!w || !h) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
    return c;
  }
  const src = img.data;
  if (!src) return null;
  const out = ctx.createImageData(w, h);
  const d = out.data;
  if (img.kind === 3 && src.length >= w * h * 4) {
    d.set(src.subarray(0, w * h * 4));
  } else if (img.kind === 2 && src.length >= w * h * 3) {
    for (let i = 0, j = 0; i < w * h; i++, j += 3) {
      d[i * 4] = src[j];
      d[i * 4 + 1] = src[j + 1];
      d[i * 4 + 2] = src[j + 2];
      d[i * 4 + 3] = 255;
    }
  } else if (img.kind === 1) {
    // 1 bit per pixel, rows padded to whole bytes; set bits are white.
    const rowBytes = Math.ceil(w / 8);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const bit = (src[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        const o = (y * w + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = v;
        d[o + 3] = 255;
      }
    }
  } else return null;
  ctx.putImageData(out, 0, 0);
  return c;
}

export default function Tool() {
  const [source, setSource] = useState<PdfSource | null>(null);
  const [format, setFormat] = useState<"png" | "jpg">("png");
  const [minSize, setMinSize] = useState(16);
  const [dedupe, setDedupe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{ items: Found[]; skipped: number; masks: number } | null>(null);
  const runId = useRef(0);
  const urls = useRef<string[]>([]);

  const revokeAll = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
  };

  useEffect(
    () => () => {
      runId.current++;
      revokeAll();
    },
    [],
  );

  async function extract() {
    if (!source) return;
    const id = ++runId.current;
    revokeAll();
    setBusy(true);
    setError(null);
    setFound(null);
    setProgress(0);
    let doc: Awaited<ReturnType<typeof openPdf>> | null = null;
    try {
      const pdfjs = await getPdfjs();
      const { OPS } = pdfjs;
      doc = await openPdf(source.bytes);
      const items: Found[] = [];
      const seen = new Set<string>();
      let skipped = 0;
      let masks = 0;
      const stem = baseName(source.file.name);
      for (let p = 1; p <= doc.numPages; p++) {
        if (id !== runId.current) return;
        const page = await doc.getPage(p);
        const ops = await page.getOperatorList();
        let n = 0;
        for (let i = 0; i < ops.fnArray.length; i++) {
          const fn = ops.fnArray[i];
          const args = ops.argsArray[i] as unknown[];
          if (fn === OPS.paintImageMaskXObject || fn === OPS.paintImageMaskXObjectGroup || fn === OPS.paintSolidColorImageMask) {
            masks++;
            continue;
          }
          let img: ImgLike | null = null;
          let objId: string | null = null;
          if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
            objId = String(args[0]);
            img = await getObj(page, objId);
          } else if (fn === OPS.paintInlineImageXObject) {
            img = args[0] as ImgLike;
          } else continue;
          if (!img) {
            skipped++;
            continue;
          }
          const canvas = toCanvas(img);
          if (!canvas) {
            skipped++;
            continue;
          }
          if (canvas.width < minSize && canvas.height < minSize) continue;
          if (dedupe) {
            const ctx = canvas.getContext("2d");
            const px = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height).data : new Uint8ClampedArray();
            const key = `${canvas.width}x${canvas.height}:${fnv1a(px, Math.max(1, Math.floor(px.length / 4_000_000)))}`;
            if (seen.has(key) || (objId && objId.startsWith("g_") && seen.has(objId))) continue;
            seen.add(key);
            if (objId) seen.add(objId);
          }
          let blob: Blob;
          if (format === "jpg") {
            const flat = document.createElement("canvas");
            flat.width = canvas.width;
            flat.height = canvas.height;
            const fctx = flat.getContext("2d");
            if (fctx) {
              fctx.fillStyle = "#ffffff";
              fctx.fillRect(0, 0, flat.width, flat.height);
              fctx.drawImage(canvas, 0, 0);
            }
            blob = await canvasToBlob(flat, "image/jpeg", 0.92);
          } else blob = await canvasToBlob(canvas, "image/png");
          n++;
          const url = URL.createObjectURL(blob);
          urls.current.push(url);
          items.push({ name: `${stem}-p${p}-${n}.${format}`, page: p, width: canvas.width, height: canvas.height, blob, url });
        }
        page.cleanup();
        setProgress(p / doc.numPages);
      }
      if (id === runId.current) setFound({ items, skipped, masks });
    } catch (e) {
      if (id === runId.current) setError(e instanceof Error ? e.message : "Images could not be extracted.");
    } finally {
      if (doc) void doc.loadingTask.destroy().catch(() => undefined);
      if (id === runId.current) setBusy(false);
    }
  }

  const total = found ? found.items.reduce((s, f) => s + f.blob.size, 0) : 0;

  return (
    <ToolPanel title={source ? undefined : "Choose a PDF"}>
      <div className="space-y-5">
        <PdfPicker
          source={source}
          onChange={(s) => {
            runId.current++;
            revokeAll();
            setSource(s);
            setFound(null);
            setError(null);
            setBusy(false);
          }}
        />
        {source && (
          <div className="flex flex-wrap items-end gap-4">
            <Segmented
              label="Output format"
              value={format}
              onChange={setFormat}
              options={[
                { value: "png", label: "PNG (lossless)" },
                { value: "jpg", label: "JPG (smaller)" },
              ]}
            />
            <NumInput key={`min${minSize}`} label="Skip images smaller than" suffix="px" value={minSize} min={1} max={2000} onCommit={(v) => setMinSize(Math.round(v))} className="w-44" />
            <Checkbox label="Skip duplicates" checked={dedupe} onChange={setDedupe} />
            <Btn icon="image" onClick={extract} disabled={busy}>
              {busy ? "Extracting…" : "Extract images"}
            </Btn>
          </div>
        )}
        {busy && <ProgressBar value={progress} label="Scanning pages" />}
        {error && <Notice tone="error">{error}</Notice>}
        {found && found.items.length === 0 && (
          <Notice tone="info" title="No raster images found">
            This PDF has no embedded pictures above the size limit. Text and vector drawings are not images; to capture them, render pages with PDF to image.
            {found.masks > 0 ? ` ${found.masks} stencil mask${found.masks === 1 ? " was" : "s were"} skipped.` : ""}
          </Notice>
        )}
        {found && found.items.length > 0 && (
          <div className="space-y-4">
            <StatGrid
              items={[
                { label: "Images", value: found.items.length },
                { label: "Total size", value: formatBytes(total) },
                { label: "Skipped", value: found.skipped + found.masks },
              ]}
            />
            <Btn
              icon="download"
              onClick={async () => {
                const zip = await zipFiles(found.items.map((f) => ({ name: f.name, data: f.blob })), 0);
                downloadBlob(zip, `${baseName(source?.file.name ?? "pdf")}-images.zip`);
              }}
            >
              Download all as ZIP
            </Btn>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {found.items.map((f) => (
                <li key={f.url} className="space-y-2 rounded-xl bg-sunken p-2">
                  <div className="grid h-32 place-items-center rounded-lg bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                    <img src={f.url} alt={`Image ${f.name} from page ${f.page}`} className="max-h-32 max-w-full object-contain" />
                  </div>
                  <p className="text-[0.8125rem] text-ink-2">
                    Page {f.page} · {f.width} × {f.height} px · {formatBytes(f.blob.size)}
                  </p>
                  <Btn variant="ghost" icon="download" className="w-full justify-center" onClick={() => downloadBlob(f.blob, f.name)}>
                    Save
                  </Btn>
                </li>
              ))}
            </ul>
            {found.skipped > 0 && <p className="text-sm text-muted">{found.skipped} image{found.skipped === 1 ? "" : "s"} could not be decoded and were skipped.</p>}
          </div>
        )}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}
