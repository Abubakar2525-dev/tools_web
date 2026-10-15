"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, Notice, PrivacyNote, Segmented, SelectField, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, loadImage, useObjectUrl } from "@/components/tools/engines/files";
import { Icon } from "@/components/ui/Icon";
import { formatRgb, nearestNamed, round, toOklch } from "./lib/color";
import { kmeans, pixelsToLab, sampleSize, type Cluster } from "./lib/kmeans";
import { exportPalette, type ExportFormat } from "./lib/palette";
import { CodeOutput, textOn } from "./shared";

type Sort = "coverage" | "lightness" | "hue";
const EXPORTS: { value: ExportFormat | "hex"; label: string }[] = [
  { value: "hex", label: "Hex list" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "json", label: "JSON" },
];

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [k, setK] = useState("6");
  const [result, setResult] = useState<{ clusters: Cluster[]; pixels: number; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("coverage");
  const [exp, setExp] = useState<ExportFormat | "hex">("hex");
  const [copied, setCopied] = useState("");
  const run = useRef(0);
  const preview = useObjectUrl(file);

  useEffect(() => () => {
    run.current++;
  }, []);

  const analyze = async (f: File, count: number) => {
    const id = ++run.current;
    setBusy(true);
    setError(null);
    try {
      const bm = await loadImage(f);
      const { w, h } = sampleSize(bm.width, bm.height, 40000);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas is not available in this browser.");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bm, 0, 0, w, h);
      bm.close();
      const data = ctx.getImageData(0, 0, w, h).data;
      // Yield so the spinner can paint before the clustering work.
      await new Promise((r) => setTimeout(r, 16));
      if (id !== run.current) return;
      const pts = pixelsToLab(data);
      if (!pts.length) throw new Error("This image is fully transparent, so there are no colors to extract.");
      const clusters = kmeans(pts, count, 30, 7);
      if (id !== run.current) return;
      setResult({ clusters, pixels: pts.length / 3, key: `${f.name}-${count}` });
    } catch (e) {
      if (id === run.current) setError(e instanceof Error ? e.message : "Could not analyze this image.");
    } finally {
      if (id === run.current) setBusy(false);
    }
  };

  const sorted = useMemo(() => {
    if (!result) return [];
    const cs = [...result.clusters];
    if (sort === "lightness") cs.sort((a, b) => b.lab[0] - a.lab[0]);
    if (sort === "hue") cs.sort((a, b) => toOklch(a.color)[2] - toOklch(b.color)[2]);
    return cs;
  }, [result, sort]);

  const code = useMemo(() => {
    if (!sorted.length) return "";
    if (exp === "hex") return sorted.map((c) => `${c.hex}  ${round(c.share * 100, 1)}%`).join("\n") + "\n";
    return exportPalette([{ name: "image", colors: sorted.map((c, i) => ({ key: String(i + 1), color: c.color })) }], exp);
  }, [sorted, exp]);

  const copy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(`Copied ${hex}`);
    } catch {
      setCopied("Copy failed");
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Image">
        {!file ? (
          <FileDrop
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.avif,.bmp"
            maxSizeMB={40}
            allowPaste
            hint="PNG, JPG, WebP, GIF or AVIF up to 40 MB. The image never leaves your device."
            onFiles={([f]) => {
              setFile(f);
              setResult(null);
              analyze(f, Number(k));
            }}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-3">
              <FileChip
                file={file}
                onRemove={() => {
                  run.current++;
                  setFile(null);
                  setResult(null);
                  setBusy(false);
                }}
              />
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={preview} alt="Uploaded image being analyzed" className="max-h-[320px] w-full rounded-xl bg-sunken object-contain" />
              )}
            </div>
            <div className="min-w-0 space-y-4">
              <SelectField
                label="Number of colors"
                value={k}
                onChange={(e) => {
                  setK(e.target.value);
                  analyze(file, Number(e.target.value));
                }}
                options={["3", "4", "5", "6", "8", "10", "12"]}
              />
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Sort swatches by</p>
                <Segmented
                  label="Sort swatches by"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "coverage", label: "Coverage" },
                    { value: "lightness", label: "Lightness" },
                    { value: "hue", label: "Hue" },
                  ]}
                />
              </div>
              {busy && <Spinner label="Finding dominant colors" />}
              {error && <Notice tone="error">{error}</Notice>}
              {result && !busy && (
                <p className="text-[0.8125rem] text-muted">
                  Clustered {result.pixels.toLocaleString("en-US")} sampled pixels. Transparent pixels are ignored.
                </p>
              )}
            </div>
          </div>
        )}
      </ToolPanel>

      <ToolPanel title="Palette">
        {!sorted.length ? (
          <EmptyState icon="palette" title="No palette yet">
            Add an image to extract its dominant colors.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            <div className="flex h-12 overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]" aria-hidden="true">
              {sorted.map((c) => (
                <div key={c.hex} style={{ background: c.hex, width: `${c.share * 100}%` }} />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {sorted.map((c) => (
                <li key={c.hex} className="overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
                  <button
                    type="button"
                    onClick={() => copy(c.hex)}
                    className="flex h-24 w-full flex-col justify-end p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                    style={{ background: c.hex, color: textOn(c.color) }}
                  >
                    <span className="font-mono text-sm font-semibold">{c.hex}</span>
                    <span className="text-xs">{round(c.share * 100, 1)}% of image</span>
                    <span className="sr-only">. Copy</span>
                  </button>
                  <div className="flex items-center justify-between gap-2 bg-surface px-2 py-1.5 text-xs text-muted">
                    <span className="truncate">{nearestNamed(c.color).name}</span>
                    <Icon name="copy" size={14} />
                  </div>
                  <p className="sr-only">{formatRgb(c.color)}</p>
                </li>
              ))}
            </ul>
            <p className="sr-only" aria-live="polite">
              {copied}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented label="Export format" value={exp} onChange={setExp} options={EXPORTS} />
            </div>
            <CodeOutput code={code} label="Palette export" filename={`image-palette.${exp === "hex" ? "txt" : exp}`} mime={exp === "json" ? "application/json" : "text/plain"} />
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
