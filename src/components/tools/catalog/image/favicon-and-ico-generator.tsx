"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, OutputBlock, PrivacyNote, Segmented, SelectField, TextField, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, canvasToBlob, downloadBlob, formatBytes, zipFiles } from "@/components/tools/engines/files";
import { ColorField, RangeField, errMsg, useDecodedImage, CHECKER } from "./shared";
import { encodeIco } from "./lib/encoders";
import { IMAGE_ACCEPT, makeCanvas, drawScaled } from "./lib/pipeline";

type Mode = "letter" | "image";
type Opts = {
  mode: Mode;
  text: string;
  fg: string;
  bg: string;
  radius: number;
  font: string;
  bold: boolean;
  fit: "cover" | "contain";
  padding: number;
  transparent: boolean;
};

const FONTS = [
  { value: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", label: "Sans serif" },
  { value: "Georgia, 'Times New Roman', serif", label: "Serif" },
  { value: "ui-monospace, Menlo, Consolas, monospace", label: "Monospace" },
];

const PREVIEW = [16, 32, 48, 180, 192, 512];

function roundRect(ctx: CanvasRenderingContext2D, size: number, radiusPct: number) {
  const r = (Math.min(50, Math.max(0, radiusPct)) / 100) * size;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(size, 0, size, size, r);
  ctx.arcTo(size, size, 0, size, r);
  ctx.arcTo(0, size, 0, 0, r);
  ctx.arcTo(0, 0, size, 0, r);
  ctx.closePath();
}

/** Draws one icon size. `opaque` forces a solid background (Apple touch icon). */
function renderIcon(size: number, o: Opts, bitmap: ImageBitmap | null, opaque = false) {
  const { canvas, ctx } = makeCanvas(size, size);
  if (o.mode === "letter") {
    ctx.fillStyle = o.bg;
    if (opaque) ctx.fillRect(0, 0, size, size);
    else {
      roundRect(ctx, size, o.radius);
      ctx.fill();
    }
    const text = o.text.trim().slice(0, 3) || "?";
    let fs = size * (text.length === 1 ? 0.62 : text.length === 2 ? 0.48 : 0.36);
    ctx.font = `${o.bold ? 700 : 500} ${fs}px ${o.font}`;
    const maxW = size * 0.82;
    const m = ctx.measureText(text);
    if (m.width > maxW) {
      fs *= maxW / m.width;
      ctx.font = `${o.bold ? 700 : 500} ${fs}px ${o.font}`;
    }
    ctx.fillStyle = o.fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const mm = ctx.measureText(text);
    // Centre on the actual glyph box rather than the em box.
    const asc = mm.actualBoundingBoxAscent || fs * 0.7;
    const desc = mm.actualBoundingBoxDescent || 0;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, size / 2, size / 2 + (asc - desc) / 2);
    return canvas;
  }
  if (!bitmap) return canvas;
  if (!o.transparent || opaque) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, size, size);
  }
  const pad = o.fit === "contain" ? Math.round((o.padding / 100) * size) : 0;
  const box = size - pad * 2;
  const bw = bitmap.width;
  const bh = bitmap.height;
  if (o.fit === "cover") {
    const s = Math.min(bw, bh);
    const sx = (bw - s) / 2;
    const sy = (bh - s) / 2;
    // Crop to a square first, then downscale in steps.
    const sq = makeCanvas(s, s);
    sq.ctx.drawImage(bitmap, sx, sy, s, s, 0, 0, s, s);
    ctx.drawImage(drawScaled(sq.canvas, box, box), pad, pad);
  } else {
    const k = Math.min(box / bw, box / bh);
    const w = Math.max(1, Math.round(bw * k));
    const h = Math.max(1, Math.round(bh * k));
    ctx.drawImage(drawScaled(bitmap, w, h), Math.round((size - w) / 2), Math.round((size - h) / 2));
  }
  return canvas;
}

type Output = { files: { name: string; blob: Blob }[]; html: string };

export default function Tool() {
  const [mode, setMode] = useState<Mode>("letter");
  const [text, setText] = useState("S");
  const [fg, setFg] = useState("#ffffff");
  const [bg, setBg] = useState("#1f6f5c");
  const [radius, setRadius] = useState(22);
  const [font, setFont] = useState(FONTS[0].value);
  const [bold, setBold] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [fit, setFit] = useState<"cover" | "contain">("contain");
  const [padding, setPadding] = useState(0);
  const [transparent, setTransparent] = useState(true);
  const [appName, setAppName] = useState("My site");
  const [themeColor, setThemeColor] = useState("#1f6f5c");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ key: string; data: Output } | null>(null);

  const { bitmap, error: decodeError, loading } = useDecodedImage(mode === "image" ? file : null);
  const opts: Opts = { mode, text, fg, bg, radius, font, bold, fit, padding, transparent };
  const key = JSON.stringify(opts) + appName + themeColor + (file ? `${file.name}${file.size}` : "");
  const current = output && output.key === key ? output.data : null;
  const canRender = mode === "letter" ? text.trim().length > 0 : !!bitmap;

  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    PREVIEW.forEach((size, i) => {
      const target = refs.current[i];
      if (!target) return;
      const ctx = target.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      if (!canRender) return;
      ctx.drawImage(renderIcon(size, { mode, text, fg, bg, radius, font, bold, fit, padding, transparent }, bitmap, size === 180), 0, 0);
    });
  }, [mode, text, fg, bg, radius, font, bold, fit, padding, transparent, bitmap, canRender]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const png = async (size: number, opaque = false) => canvasToBlob(renderIcon(size, opts, bitmap, opaque), "image/png");
      const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
      const [p16, p32, p48, p180, p192, p512] = await Promise.all([png(16), png(32), png(48), png(180, true), png(192), png(512)]);
      const ico = encodeIco([
        { size: 16, png: await bytes(p16) },
        { size: 32, png: await bytes(p32) },
        { size: 48, png: await bytes(p48) },
      ]);
      const name = appName.trim() || "My site";
      const manifest = JSON.stringify(
        {
          name,
          short_name: name.slice(0, 12),
          icons: [
            { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
          ],
          theme_color: themeColor,
          background_color: themeColor,
          display: "standalone",
        },
        null,
        2,
      );
      const html = [
        '<link rel="icon" href="/favicon.ico" sizes="48x48">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
        '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
        '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
        '<link rel="manifest" href="/site.webmanifest">',
        `<meta name="theme-color" content="${themeColor}">`,
      ].join("\n");
      setOutput({
        key,
        data: {
          html,
          files: [
            { name: "favicon.ico", blob: new Blob([ico as BlobPart], { type: "image/x-icon" }) },
            { name: "favicon-16x16.png", blob: p16 },
            { name: "favicon-32x32.png", blob: p32 },
            { name: "apple-touch-icon.png", blob: p180 },
            { name: "android-chrome-192x192.png", blob: p192 },
            { name: "android-chrome-512x512.png", blob: p512 },
            { name: "site.webmanifest", blob: new Blob([manifest], { type: "application/manifest+json" }) },
          ],
        },
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Favicon generator">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-5">
            <Segmented
              label="Source"
              value={mode}
              onChange={setMode}
              options={[
                { value: "letter", label: "Letters" },
                { value: "image", label: "Image" },
              ]}
            />
            {mode === "letter" ? (
              <>
                <TextField label="Letters (1 to 3)" value={text} maxLength={3} onChange={(e) => setText(e.target.value)} error={text.trim() ? null : "Enter at least one character."} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField label="Text color" value={fg} onChange={setFg} />
                  <ColorField label="Background" value={bg} onChange={setBg} />
                </div>
                <RangeField label="Corner radius" value={radius} onChange={setRadius} min={0} max={50} unit="%" hint="50% makes a circle." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Font" value={font} onChange={(e) => setFont(e.target.value)} options={FONTS} />
                  <div className="self-end pb-2">
                    <Checkbox label="Bold" checked={bold} onChange={setBold} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {file ? (
                  <FileChip file={file} onRemove={() => setFile(null)} />
                ) : (
                  <FileDrop onFiles={(f) => setFile(f[0] ?? null)} accept={IMAGE_ACCEPT} maxSizeMB={30} allowPaste label="Choose a logo or image" hint="A square image of 512 px or more works best (SVG and PNG are ideal)." />
                )}
                {loading && <Spinner label="Reading image" />}
                {decodeError && <Notice tone="error">{decodeError}</Notice>}
                <Segmented
                  label="Fit"
                  value={fit}
                  onChange={setFit}
                  options={[
                    { value: "contain", label: "Fit whole image" },
                    { value: "cover", label: "Crop to square" },
                  ]}
                />
                {fit === "contain" && <RangeField label="Padding" value={padding} onChange={setPadding} min={0} max={30} unit="%" />}
                <Checkbox label="Transparent background" checked={transparent} onChange={setTransparent} hint="The Apple touch icon always gets the background color, because iOS shows transparency as black." />
                <ColorField label="Background color" value={bg} onChange={setBg} />
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="App name (for the manifest)" value={appName} onChange={(e) => setAppName(e.target.value)} />
              <ColorField label="Theme color" value={themeColor} onChange={setThemeColor} />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div className="rounded-xl p-4" style={CHECKER}>
              <div className="flex flex-wrap items-end gap-4" role="group" aria-label="Icon previews at each size">
                {PREVIEW.map((size, i) => (
                  <figure key={size} className="text-center">
                    <canvas
                      ref={(el) => {
                        refs.current[i] = el;
                      }}
                      width={size}
                      height={size}
                      role="img"
                      aria-label={`${size} by ${size} pixel icon preview`}
                      style={{ width: Math.min(size, 96), height: Math.min(size, 96) }}
                      className="mx-auto"
                    />
                    <figcaption className="mt-1 rounded bg-surface/90 px-1 text-xs tabular-nums text-ink-2">{size}px</figcaption>
                  </figure>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn icon="spark" disabled={!canRender || busy} onClick={generate}>
                {busy ? "Generating…" : current ? "Regenerate" : "Generate files"}
              </Btn>
              {current && (
                <Btn
                  variant="ghost"
                  icon="download"
                  onClick={async () => {
                    try {
                      downloadBlob(await zipFiles(current.files.map((f) => ({ name: f.name, data: f.blob }))), "favicon-package.zip");
                    } catch (e) {
                      setError(errMsg(e));
                    }
                  }}
                >
                  Download ZIP
                </Btn>
              )}
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            {current ? (
              <>
                <ul className="space-y-1.5 text-sm">
                  {current.files.map((f) => (
                    <li key={f.name} className="flex items-center justify-between gap-3 rounded-lg bg-sunken px-3 py-1.5">
                      <span className="truncate font-mono text-[0.8125rem]">{f.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-muted">{formatBytes(f.blob.size)}</span>
                        <Btn variant="subtle" icon="download" aria-label={`Download ${f.name}`} onClick={() => downloadBlob(f.blob, f.name)} />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">HTML for your page head</p>
                  <CopyBtn text={current.html} />
                </div>
                <OutputBlock label="HTML snippet">
                  <code>{current.html}</code>
                </OutputBlock>
              </>
            ) : (
              <EmptyState icon="image" title="Files appear here">
                Adjust the design, then generate favicon.ico (16, 32 and 48 px), PNG icons, a web manifest and the HTML tags.
              </EmptyState>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
