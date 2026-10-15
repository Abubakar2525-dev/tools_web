"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Checkbox, Notice, PrivacyNote, ResetBtn, Segmented, ToolPanel } from "@/components/tools/kit";
import {
  FileDrop,
  FileChip,
  ProgressBar,
  baseName,
  useCanEncode,
  canvasToBlob,
  downloadBlob,
  formatBytes,
  useObjectUrl,
  zipFiles,
} from "@/components/tools/engines/files";
import { IMAGE_ACCEPT, decodeImage } from "@/components/tools/catalog/image/lib/pipeline";
import { IMAGE_PRESETS, PLATFORM_NAMES, type ImagePreset, type PlatformId } from "./lib/platforms";
import { fitRect, ratioLabel } from "./lib/geometry";
import { ColorField, RangeField } from "./shared/controls";
import { drawBlurred } from "./shared/scene";

type Mode = "fill" | "fit" | "blur";
type Format = "jpeg" | "png" | "webp";

interface Output {
  preset: ImagePreset;
  blob: Blob;
  upscaled: boolean;
}

const MIME: Record<Format, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const EXT: Record<Format, string> = { jpeg: "jpg", png: "png", webp: "webp" };

const PLATFORMS = Array.from(new Set(IMAGE_PRESETS.map((p) => p.platform)));

function renderPreset(bmp: ImageBitmap, p: ImagePreset, mode: Mode, color: string, fx: number, fy: number, format: Format, clearBars: boolean) {
  const c = document.createElement("canvas");
  c.width = p.w;
  c.height = p.h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.imageSmoothingQuality = "high";
  // PNG/WebP "fit" can keep transparent bars; JPG has no alpha, so it is always painted
  if (!(mode === "fit" && format !== "jpeg" && clearBars)) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, p.w, p.h);
  }
  if (mode === "fill") {
    const r = fitRect(bmp.width, bmp.height, p.w, p.h, "cover", fx, fy);
    ctx.drawImage(bmp, r.x, r.y, r.w, r.h);
  } else {
    if (mode === "blur") {
      const cover = fitRect(bmp.width, bmp.height, p.w, p.h, "cover");
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, p.w, p.h);
      ctx.clip();
      drawBlurred(ctx, bmp, bmp.width, bmp.height, cover, Math.max(p.w, p.h) / 30);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, p.w, p.h);
      ctx.restore();
    }
    const r = fitRect(bmp.width, bmp.height, p.w, p.h, "contain");
    ctx.drawImage(bmp, r.x, r.y, r.w, r.h);
  }
  return c;
}

function Thumb({ out, name }: { out: Output; name: string }) {
  const url = useObjectUrl(out.blob);
  return (
    <figure className="flex flex-col gap-2 rounded-lg bg-sunken p-3">
      <div className="grid aspect-square place-items-center overflow-hidden rounded-md bg-[repeating-conic-gradient(var(--line)_0_25%,var(--surface)_0_50%)] bg-[length:16px_16px]">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={url} alt={`${PLATFORM_NAMES[out.preset.platform]} ${out.preset.label} preview`} className="max-h-full max-w-full object-contain" />
        )}
      </div>
      <figcaption className="text-[0.8125rem] leading-snug">
        <span className="font-medium text-ink">
          {PLATFORM_NAMES[out.preset.platform]}: {out.preset.label}
        </span>
        <span className="block tabular-nums text-muted">
          {out.preset.w}×{out.preset.h} · {formatBytes(out.blob.size)}
          {out.upscaled ? " · upscaled" : ""}
        </span>
      </figcaption>
      <Btn variant="ghost" icon="download" onClick={() => downloadBlob(out.blob, name)}>
        Download
      </Btn>
    </figure>
  );
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(["ig-square", "ig-portrait", "x-landscape", "li-landscape"]));
  const [mode, setMode] = useState<Mode>("blur");
  const [color, setColor] = useState("#ffffff");
  const [clearBars, setClearBars] = useState(false);
  const [fx, setFx] = useState(0.5);
  const [fy, setFy] = useState(0.5);
  const [format, setFormat] = useState<Format>("jpeg");
  const [quality, setQuality] = useState(0.9);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef(0);
  const srcUrl = useObjectUrl(file);

  const webpOk = useCanEncode("image/webp");
  const formats = useMemo(() => (["jpeg", "png", "webp"] as Format[]).filter((f) => f !== "webp" || webpOk), [webpOk]);

  useEffect(() => {
    const runs = runRef;
    return () => {
      runs.current++;
    };
  }, []);

  const onFile = async (files: File[]) => {
    setError(null);
    setOutputs([]);
    try {
      const b = await decodeImage(files[0]);
      bmp?.close();
      setBmp(b);
      setFile(files[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.");
    }
  };

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const generate = async () => {
    if (!bmp) return;
    const list = IMAGE_PRESETS.filter((p) => selected.has(p.id));
    if (!list.length) {
      setError("Pick at least one size.");
      return;
    }
    const token = ++runRef.current;
    setError(null);
    setOutputs([]);
    setProgress(0);
    const res: Output[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const c = renderPreset(bmp, p, mode, color, fx, fy, format, clearBars);
        const blob = await canvasToBlob(c, MIME[format], format === "png" ? undefined : quality);
        c.width = c.height = 0;
        if (runRef.current !== token) return;
        const cover = mode === "fill" ? Math.max(p.w / bmp.width, p.h / bmp.height) : Math.min(p.w / bmp.width, p.h / bmp.height);
        res.push({ preset: p, blob, upscaled: cover > 1.01 });
        setProgress((i + 1) / list.length);
        setOutputs([...res]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      if (runRef.current === token) setProgress(null);
    }
  };

  const nameFor = (o: Output) => `${baseName(file?.name ?? "image")}-${o.preset.id}-${o.preset.w}x${o.preset.h}.${EXT[format]}`;

  const reset = () => {
    runRef.current++;
    bmp?.close();
    setBmp(null);
    setFile(null);
    setOutputs([]);
    setError(null);
    setProgress(null);
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Resize one image for every platform" actions={file ? <ResetBtn onClick={reset} /> : undefined}>
        <div className="space-y-5">
          {!file ? (
            <FileDrop accept={IMAGE_ACCEPT} maxSizeMB={40} onFiles={onFile} allowPaste label="Choose an image or drop it here" hint="PNG, JPG, WebP, AVIF, GIF, BMP or HEIC up to 40 MB." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              {srcUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img src={srcUrl} alt={`Source image ${file.name}`} className="max-h-40 w-auto rounded-lg object-contain" />
              )}
              <div className="min-w-0 space-y-2">
                <FileChip file={file} onRemove={reset} />
                {bmp && (
                  <p className="text-[0.8125rem] tabular-nums text-muted">
                    {bmp.width}×{bmp.height} px ({ratioLabel(bmp.width, bmp.height)})
                  </p>
                )}
              </div>
            </div>
          )}
          {error && <Notice tone="error">{error}</Notice>}

          <fieldset>
            <legend className="text-sm font-medium text-ink">Sizes</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              <Btn variant="subtle" onClick={() => setSelected(new Set(IMAGE_PRESETS.map((p) => p.id)))}>
                Select all
              </Btn>
              <Btn variant="subtle" onClick={() => setSelected(new Set())}>
                Clear
              </Btn>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PLATFORMS.map((pl: PlatformId) => (
                <div key={pl}>
                  <p className="text-sm font-semibold text-ink">{PLATFORM_NAMES[pl]}</p>
                  <div className="mt-1.5 space-y-1.5">
                    {IMAGE_PRESETS.filter((p) => p.platform === pl).map((p) => (
                      <Checkbox
                        key={p.id}
                        checked={selected.has(p.id)}
                        onChange={(v) => toggle(p.id, v)}
                        label={
                          <>
                            {p.label} <span className="tabular-nums text-muted">{p.w}×{p.h}</span>
                          </>
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-ink">When the shape differs</p>
                <Segmented
                  label="Resize mode"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "fill", label: "Fill (crop)" },
                    { value: "fit", label: "Fit (bars)" },
                    { value: "blur", label: "Fit on blur" },
                  ]}
                />
              </div>
              {mode === "fill" && (
                <>
                  <RangeField label="Keep visible: horizontal" value={fx} min={0} max={1} step={0.01} onChange={setFx} format={(v) => (v < 0.34 ? "left" : v > 0.66 ? "right" : "center")} />
                  <RangeField label="Keep visible: vertical" value={fy} min={0} max={1} step={0.01} onChange={setFy} format={(v) => (v < 0.34 ? "top" : v > 0.66 ? "bottom" : "middle")} />
                </>
              )}
              {mode === "fit" && (
                <>
                  {format !== "jpeg" && <Checkbox label="Transparent bars" checked={clearBars} onChange={setClearBars} />}
                  {(format === "jpeg" || !clearBars) && <ColorField label="Bar color" value={color} onChange={setColor} />}
                </>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Format</p>
                <Segmented
                  label="Output format"
                  value={format}
                  onChange={setFormat}
                  options={formats.map((f) => ({ value: f, label: f === "jpeg" ? "JPG" : f.toUpperCase() }))}
                />
              </div>
              {format !== "png" && (
                <RangeField label="Quality" value={quality} min={0.5} max={1} step={0.01} onChange={setQuality} format={(v) => `${Math.round(v * 100)}%`} />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Btn icon="image" onClick={generate} disabled={!bmp || progress !== null || selected.size === 0}>
              Create {selected.size} image{selected.size === 1 ? "" : "s"}
            </Btn>
            {outputs.length > 1 && progress === null && (
              <Btn
                variant="ghost"
                icon="download"
                onClick={async () => downloadBlob(await zipFiles(outputs.map((o) => ({ name: nameFor(o), data: o.blob })), 0), `${baseName(file?.name ?? "images")}-social.zip`)}
              >
                Download all as ZIP
              </Btn>
            )}
          </div>
          {progress !== null && <ProgressBar value={progress} label="Creating images" />}
          {outputs.some((o) => o.upscaled) && (
            <Notice tone="warning">Some sizes are larger than your source image, so they were upscaled and may look soft.</Notice>
          )}
        </div>
      </ToolPanel>

      {outputs.length > 0 && (
        <ToolPanel title="Results">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {outputs.map((o) => (
              <Thumb key={o.preset.id} out={o} name={nameFor(o)} />
            ))}
          </div>
        </ToolPanel>
      )}
      <p className="text-[0.8125rem] text-muted">Sizes reflect each platform&apos;s published guidance as of October 2026. Platforms change them, so check before a big campaign.</p>
      <PrivacyNote />
    </div>
  );
}
