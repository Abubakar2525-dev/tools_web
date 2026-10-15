"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Notice, PrivacyNote, Segmented, SelectField, ToolPanel, uid } from "@/components/tools/kit";
import { FileDrop, ProgressBar, canvasToBlob } from "@/components/tools/engines/files";
import { IMAGE_ACCEPT, decodeImage } from "@/components/tools/catalog/image/lib/pipeline";
import { getPdfLib } from "@/components/tools/engines/pdf";
import { Icon } from "@/components/ui/Icon";
import { TileBtn } from "./PageGrid";
import { DownloadResult, savePdf, useJob, type Output } from "./shared";
import { adaptiveThreshold, defaultQuad, grayscaleFilter, isConvexQuad, quadOutputSize, warpPerspective, type Quad, type RGBA } from "./lib/scan";
import { PAPER, moveItem } from "./lib/layout";

type Filter = "original" | "gray" | "bw";
type ScanPage = { id: string; src: HTMLCanvasElement; quad: Quad; filter: Filter };

const MAX_SOURCE = 2400;
const CORNER_NAMES = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"] as const;

function toCanvas(img: CanvasImageSource, w: number, h: number) {
  const s = Math.min(1, MAX_SOURCE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function rotateCanvas(src: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = src.height;
  c.height = src.width;
  const ctx = c.getContext("2d");
  if (!ctx) return src;
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Warps and filters a page. `maxSide` limits the output for previews. */
function processPage(p: ScanPage, maxSide: number): RGBA {
  const ctx = p.src.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  const data = ctx.getImageData(0, 0, p.src.width, p.src.height);
  const { width, height } = quadOutputSize(p.quad, maxSide);
  let img = warpPerspective({ data: data.data, width: data.width, height: data.height }, p.quad, width, height);
  if (p.filter === "gray") img = grayscaleFilter(img);
  else if (p.filter === "bw") img = adaptiveThreshold(img);
  return img;
}

function drawRGBA(canvas: HTMLCanvasElement, img: RGBA) {
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const id = ctx.createImageData(img.width, img.height);
  id.data.set(img.data);
  ctx.putImageData(id, 0, 0);
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

function Camera({ onCapture }: { onCapture: (c: HTMLCanvasElement) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"off" | "starting" | "live" | "error">("off");
  const [msg, setMsg] = useState("");

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setStatus("off");
  };
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    },
    [],
  );

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setMsg("This browser can't use the camera here (it needs a secure https page). Upload photos instead.");
      return;
    }
    setStatus("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      setStatus("live");
    } catch (e) {
      const name = (e as { name?: string }).name;
      setStatus("error");
      setMsg(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow it in your browser's site settings, or upload photos instead."
          : name === "NotFoundError"
            ? "No camera was found. Upload photos instead."
            : "The camera could not be started. Upload photos instead.",
      );
    }
  };

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    onCapture(toCanvas(v, v.videoWidth, v.videoHeight));
  };

  return (
    <div className="space-y-3">
      <div className={status === "live" || status === "starting" ? "" : "hidden"}>
        <video ref={video} playsInline muted aria-label="Camera preview" className="max-h-[420px] w-full rounded-xl bg-night object-contain" />
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "live" ? (
          <>
            <Btn icon="eye" onClick={capture}>
              Capture page
            </Btn>
            <Btn variant="ghost" onClick={stop}>
              Turn camera off
            </Btn>
          </>
        ) : (
          <Btn variant="ghost" icon="eye" disabled={status === "starting"} onClick={start}>
            {status === "starting" ? "Starting camera…" : "Use camera"}
          </Btn>
        )}
      </div>
      {status === "error" && <Notice tone="warning">{msg}</Notice>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Corner editor                                                       */
/* ------------------------------------------------------------------ */

function CornerEditor({ page, onQuad }: { page: ScanPage; onQuad: (q: Quad) => void }) {
  const display = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const { width: w, height: h } = page.src;

  useEffect(() => {
    const c = display.current;
    if (!c) return;
    c.width = page.src.width;
    c.height = page.src.height;
    c.getContext("2d")?.drawImage(page.src, 0, 0);
  }, [page.src]);

  const setCorner = (i: number, x: number, y: number) => {
    const q = page.quad.map((p) => ({ ...p })) as Quad;
    q[i] = { x: Math.max(0, Math.min(w, x)), y: Math.max(0, Math.min(h, y)) };
    onQuad(q);
  };

  const fromPointer = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h };
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const poly = page.quad.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div ref={box} className="relative w-full touch-none select-none">
      <canvas ref={display} className="block h-auto w-full rounded-lg" aria-label="Photo being cropped" role="img" />
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <polygon points={poly} fill="color-mix(in oklch, var(--accent) 18%, transparent)" stroke="var(--accent)" strokeWidth={Math.max(w, h) / 300} />
      </svg>
      {page.quad.map((p, i) => (
        <button
          key={CORNER_NAMES[i]}
          type="button"
          aria-label={`${CORNER_NAMES[i]} corner, at ${Math.round((p.x / w) * 100)}% across and ${Math.round((p.y / h) * 100)}% down. Use arrow keys to move, Shift for bigger steps.`}
          className="absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing"
          style={{ left: pct(p.x, w), top: pct(p.y, h) }}
          onPointerDown={(e) => {
            dragging.current = i;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragging.current !== i) return;
            const pt = fromPointer(e);
            if (pt) setCorner(i, pt.x, pt.y);
          }}
          onPointerUp={() => (dragging.current = null)}
          onPointerCancel={() => (dragging.current = null)}
          onKeyDown={(e) => {
            const step = (e.shiftKey ? 0.02 : 0.004) * Math.max(w, h);
            const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
            if (!d) return;
            e.preventDefault();
            setCorner(i, p.x + d[0], p.y + d[1]);
          }}
        >
          <span className="h-5 w-5 rounded-full border-2 border-white bg-accent shadow-md" />
          <span className="absolute -top-5 rounded bg-night px-1 text-[10px] font-medium text-night-ink">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

function NumericCorners({ page, onQuad }: { page: ScanPage; onQuad: (q: Quad) => void }) {
  const { width: w, height: h } = page.src;
  return (
    <details className="rounded-lg bg-sunken px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-ink">Exact corner positions (%)</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {page.quad.map((p, i) => (
          <fieldset key={CORNER_NAMES[i]} className="flex items-center gap-2">
            <legend className="mb-1 text-[0.8125rem] text-muted">
              {i + 1}. {CORNER_NAMES[i]}
            </legend>
            {(["x", "y"] as const).map((axis) => (
              <label key={axis} className="flex items-center gap-1">
                <span className="text-muted">{axis === "x" ? "Across" : "Down"}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={Math.round(((axis === "x" ? p.x / w : p.y / h) * 100) * 10) / 10}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    const q = page.quad.map((c) => ({ ...c })) as Quad;
                    q[i] = axis === "x" ? { x: (Math.max(0, Math.min(100, v)) / 100) * w, y: p.y } : { x: p.x, y: (Math.max(0, Math.min(100, v)) / 100) * h };
                    onQuad(q);
                  }}
                  className="h-10 w-20 rounded-md bg-surface px-2 tabular-nums shadow-[inset_0_0_0_1px_var(--line-strong)]"
                />
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </details>
  );
}

function Preview({ page }: { page: ScanPage }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const c = ref.current;
      if (!c || !isConvexQuad(page.quad)) return;
      try {
        drawRGBA(c, processPage(page, 700));
      } catch {
        /* invalid shape: the notice explains */
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [page]);
  return <canvas ref={ref} role="img" aria-label="Corrected page preview" className="block h-auto max-h-[480px] w-full rounded-lg bg-sunken object-contain shadow-sm" />;
}

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [size, setSize] = useState<"A4" | "Letter" | "fit">("A4");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();

  const active = pages.find((p) => p.id === current) ?? pages[pages.length - 1] ?? null;
  const update = (id: string, patch: Partial<ScanPage>) => {
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setOut(null);
  };
  const addCanvas = (c: HTMLCanvasElement) => {
    const id = uid();
    setPages((ps) => [...ps, { id, src: c, quad: defaultQuad(c.width, c.height), filter: "gray" }]);
    setCurrent(id);
    setOut(null);
  };

  const addFiles = async (files: File[]) => {
    setLoadErr(null);
    for (const f of files) {
      try {
        const bmp = await decodeImage(f);
        addCanvas(toCanvas(bmp, bmp.width, bmp.height));
        bmp.close();
      } catch (e) {
        setLoadErr(`${f.name}: ${e instanceof Error ? e.message : "could not be opened."}`);
      }
    }
  };

  const badShape = active ? !isConvexQuad(active.quad) : false;
  const anyBad = pages.some((p) => !isConvexQuad(p.quad));

  const exportPdf = () =>
    job.run(async ({ alive, progress }) => {
      setOut(null);
      const { PDFDocument } = await getPdfLib();
      const doc = await PDFDocument.create();
      for (let i = 0; i < pages.length; i++) {
        if (!alive()) return;
        const img = processPage(pages[i], 2400);
        const c = document.createElement("canvas");
        drawRGBA(c, img);
        const blob = await canvasToBlob(c, "image/jpeg", pages[i].filter === "original" ? 0.85 : 0.8);
        c.width = c.height = 0;
        const jpg = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        let pw: number;
        let ph: number;
        if (size === "fit") {
          // Treat the corrected image as 200 pixels per inch.
          pw = (img.width * 72) / 200;
          ph = (img.height * 72) / 200;
        } else {
          const p = PAPER[size];
          const land = img.width > img.height;
          pw = land ? p.h : p.w;
          ph = land ? p.w : p.h;
        }
        const page = doc.addPage([pw, ph]);
        const s = Math.min(pw / img.width, ph / img.height);
        page.drawImage(jpg, { x: (pw - img.width * s) / 2, y: (ph - img.height * s) / 2, width: img.width * s, height: img.height * s });
        progress((i + 1) / pages.length);
        await new Promise((r) => setTimeout(r, 0));
      }
      const blob = await savePdf(doc);
      if (alive()) setOut({ blob, name: `scan-${new Date().toISOString().slice(0, 10)}.pdf`, detail: `${pages.length} ${pages.length === 1 ? "page" : "pages"}` });
    });

  return (
    <ToolPanel title="Scan documents">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Camera onCapture={addCanvas} />
          <FileDrop accept={IMAGE_ACCEPT} multiple maxFiles={50} maxSizeMB={40} compact allowPaste label="Or upload photos" hint="PNG, JPG, WebP, AVIF, GIF, BMP or HEIC up to 40 MB each." onFiles={addFiles} />
        </div>
        {loadErr && <Notice tone="error">{loadErr}</Notice>}

        {active && (
          <section aria-labelledby="scan-edit" className="space-y-4">
            <h3 id="scan-edit" className="text-sm font-medium text-ink">
              Page {pages.indexOf(active) + 1}: drag the four corners onto the document&apos;s edges
            </h3>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <CornerEditor page={active} onQuad={(q) => update(active.id, { quad: q })} />
                <div className="flex flex-wrap gap-2">
                  <Btn variant="subtle" icon="reset" onClick={() => update(active.id, { quad: defaultQuad(active.src.width, active.src.height) })}>
                    Reset corners
                  </Btn>
                  <Btn variant="subtle" onClick={() => update(active.id, { quad: defaultQuad(active.src.width, active.src.height, 0) })}>
                    Whole photo
                  </Btn>
                  <Btn
                    variant="subtle"
                    onClick={() => {
                      const r = rotateCanvas(active.src);
                      update(active.id, { src: r, quad: defaultQuad(r.width, r.height) });
                    }}
                  >
                    Rotate photo 90°
                  </Btn>
                </div>
                <NumericCorners page={active} onQuad={(q) => update(active.id, { quad: q })} />
              </div>
              <div className="space-y-3">
                <Segmented
                  label="Cleanup filter"
                  value={active.filter}
                  onChange={(f) => update(active.id, { filter: f })}
                  options={[
                    { value: "original", label: "Color" },
                    { value: "gray", label: "Grayscale" },
                    { value: "bw", label: "Black & white" },
                  ]}
                />
                {badShape ? (
                  <Notice tone="warning">The corners cross over or overlap. Put them in order: top-left, top-right, bottom-right, bottom-left.</Notice>
                ) : (
                  <Preview page={active} />
                )}
              </div>
            </div>
          </section>
        )}

        {pages.length > 0 && (
          <section aria-labelledby="scan-pages" className="space-y-3">
            <h3 id="scan-pages" className="text-sm font-medium text-ink">
              Pages ({pages.length})
            </h3>
            <ol className="flex flex-wrap gap-2" aria-label="Scanned pages, in order">
              {pages.map((p, i) => (
                <li key={p.id} className={`flex items-center gap-1 rounded-xl p-1.5 ${p.id === active?.id ? "shadow-[0_0_0_2px_var(--accent)]" : "shadow-[0_0_0_1px_var(--line)]"}`}>
                  <Btn variant="subtle" aria-pressed={p.id === active?.id} onClick={() => setCurrent(p.id)}>
                    Page {i + 1}
                    {!isConvexQuad(p.quad) && " (fix corners)"}
                  </Btn>
                  <TileBtn label={`Move page ${i + 1} earlier`} disabled={i === 0} onClick={() => { setPages((ps) => moveItem(ps, i, -1)); setOut(null); }}>
                    <Icon name="arrow" size={16} className="rotate-180" />
                  </TileBtn>
                  <TileBtn label={`Move page ${i + 1} later`} disabled={i === pages.length - 1} onClick={() => { setPages((ps) => moveItem(ps, i, 1)); setOut(null); }}>
                    <Icon name="arrow" size={16} />
                  </TileBtn>
                  <TileBtn label={`Remove page ${i + 1}`} onClick={() => { setPages((ps) => ps.filter((x) => x.id !== p.id)); setOut(null); }}>
                    <Icon name="trash" size={16} />
                  </TileBtn>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-end gap-3">
              <SelectField
                label="PDF page size"
                value={size}
                onChange={(e) => { setSize(e.target.value as "A4" | "Letter" | "fit"); setOut(null); }}
                options={[
                  { value: "A4", label: "A4" },
                  { value: "Letter", label: "US Letter" },
                  { value: "fit", label: "Fit to each scan" },
                ]}
                className="w-56"
              />
              <Btn icon="file" className="h-11" disabled={anyBad || job.busy} onClick={exportPdf}>
                Create PDF
              </Btn>
            </div>
            {anyBad && <p className="text-sm text-danger">Fix the corners on the marked pages first.</p>}
            {job.busy && <ProgressBar value={job.progress ?? 0} label="Processing pages" />}
            {job.error && <Notice tone="error">{job.error}</Notice>}
            {out && <DownloadResult output={out} />}
          </section>
        )}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}
