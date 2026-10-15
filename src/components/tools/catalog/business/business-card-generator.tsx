"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Btn,
  Checkbox,
  Notice,
  PrivacyNote,
  ResetBtn,
  Segmented,
  TextField,
  ToolPanel,
  inputCls,
  usePersistentState,
} from "@/components/tools/kit";
import { FileDrop, Spinner, canvasToBlob, downloadBlob, fileToDataURL, loadImage } from "@/components/tools/engines/files";
import { embedUnicodeFonts, getPdfLib } from "@/components/tools/engines/pdf";
import {
  BLEED,
  CARD_SIZES,
  DEFAULT_CARD,
  FRONT_LAYOUTS,
  buildCardModel,
  buildCardPdf,
  normalizeDesign,
  qrRects,
  websiteUrl,
  type CardDesign,
  type CardModel,
  type Fonts,
  type FrontLayout,
  type Prim,
  type SideModel,
} from "./lib/card";
import { isHexColor } from "./lib/pdfText";

const FONT_STACK = "Arial, Helvetica, sans-serif";
const DPI = 300;

const noopSubscribe = () => () => {};

/** Measures text with the same font stack the preview and PNG use. */
function canvasFonts(): Fonts {
  const ctx = document.createElement("canvas").getContext("2d");
  const mk = (bold: boolean) => ({
    widthOfTextAtSize: (t: string, s: number) => {
      if (!ctx) return t.length * s * 0.56;
      ctx.font = `${bold ? 700 : 400} 100px ${FONT_STACK}`;
      return (ctx.measureText(t).width * s) / 100;
    },
  });
  return { regular: mk(false), bold: mk(true) };
}

const anchor = (a: "left" | "center" | "right") => (a === "left" ? "start" : a === "center" ? "middle" : "end");

function CardSvg({ side, model, logo, guides, title }: { side: SideModel; model: CardModel; logo: string | null; guides: boolean; title: string }) {
  const b = BLEED;
  const { w, h } = model;
  const vb = guides ? `${-b} ${-b} ${w + 2 * b} ${h + 2 * b}` : `0 0 ${w} ${h}`;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm font-medium text-ink">{title}</figcaption>
      <svg
        viewBox={vb}
        role="img"
        aria-label={side.description}
        className="block h-auto w-full max-w-[520px] rounded-md shadow-[0_0_0_1px_var(--line)]"
      >
        {side.prims.map((p, i) => (
          <PrimSvg key={i} p={p} logo={logo} />
        ))}
        {guides && (
          <rect x={0} y={0} width={w} height={h} fill="none" stroke="#e5484d" strokeWidth={0.6} strokeDasharray="3 2" />
        )}
      </svg>
      <p className="sr-only">{side.description}</p>
    </figure>
  );
}

function PrimSvg({ p, logo }: { p: Prim; logo: string | null }) {
  if (p.kind === "rect") return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.color} />;
  if (p.kind === "text")
    return (
      <text x={p.x} y={p.y} fontSize={p.size} fontWeight={p.bold ? 700 : 400} fontFamily={FONT_STACK} textAnchor={anchor(p.align)} fill={p.color}>
        {p.text}
      </text>
    );
  if (p.kind === "image") return logo ? <image href={logo} x={p.x} y={p.y} width={p.w} height={p.h} preserveAspectRatio="xMidYMid meet" /> : null;
  const d = qrRects(p)
    .map((r) => `M${r.x.toFixed(3)} ${r.y.toFixed(3)}h${r.w.toFixed(3)}v${r.h.toFixed(3)}h${(-r.w).toFixed(3)}z`)
    .join("");
  return <path d={d} fill={p.color} shapeRendering="crispEdges" />;
}

async function loadLogo(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return img;
}

/** Renders one side to a canvas at 300 DPI. */
async function renderPng(side: SideModel, model: CardModel, logo: string | null, includeBleed: boolean): Promise<Blob> {
  const scale = DPI / 72;
  const off = includeBleed ? BLEED : 0;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((model.w + 2 * off) * scale);
  canvas.height = Math.round((model.h + 2 * off) * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  const img = logo ? await loadLogo(logo) : null;
  ctx.scale(scale, scale);
  ctx.translate(off, off);
  for (const p of side.prims) {
    if (p.kind === "rect") {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    } else if (p.kind === "text") {
      ctx.fillStyle = p.color;
      ctx.font = `${p.bold ? 700 : 400} ${p.size}px ${FONT_STACK}`;
      ctx.textAlign = p.align;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(p.text, p.x, p.y);
    } else if (p.kind === "image") {
      if (img) ctx.drawImage(img, p.x, p.y, p.w, p.h);
    } else {
      ctx.fillStyle = p.color;
      for (const r of qrRects(p)) ctx.fillRect(r.x, r.y, r.w + 0.01, r.h + 0.01);
    }
  }
  return canvasToBlob(canvas, "image/png");
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const invalid = draft !== null && !isHexColor(draft);
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={isHexColor(value) && value.length === 7 ? value : "#000000"}
          onChange={(e) => {
            setDraft(null);
            onChange(e.target.value);
          }}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
        />
        <input
          id={id}
          className={`${inputCls} h-11 font-mono`}
          value={shown}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-err` : undefined}
          onChange={(e) => {
            const v = e.target.value.trim();
            setDraft(v);
            if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase());
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
      {invalid && (
        <p id={`${id}-err`} className="mt-2 text-sm text-danger" role="alert">
          Use a 6-digit hex color such as #1f6f5c.
        </p>
      )}
    </div>
  );
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Tool() {
  const [raw, setRaw, clear] = usePersistentState<CardDesign>("business-card-generator", DEFAULT_CARD);
  const design = useMemo(() => normalizeDesign(raw), [raw]);
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const fonts = useMemo(() => (isClient ? canvasFonts() : null), [isClient]);
  const model = useMemo(() => (fonts ? buildCardModel(design, fonts) : null), [design, fonts]);

  const [guides, setGuides] = useState(true);
  const [pngBleed, setPngBleed] = useState(false);
  const [busy, setBusy] = useState<null | "pdf" | "front" | "back">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const set = <K extends keyof CardDesign>(k: K, v: CardDesign[K]) => {
    setRaw((prev) => ({ ...normalizeDesign(prev), [k]: v }));
    setDone(null);
  };

  const emailError = design.email.trim() && !EMAIL_OK.test(design.email.trim()) ? "This doesn't look like an email address." : null;
  const siteError = design.website.trim() && !websiteUrl(design.website) ? "Enter a web address such as example.com." : null;
  const nothing = !design.name.trim() && !design.company.trim();

  const onLogo = async (files: File[]) => {
    const f = files[0];
    setLogoError(null);
    try {
      const dataUrl = await fileToDataURL(f);
      if (!/^data:image\/(png|jpeg);/i.test(dataUrl)) throw new Error("Use a PNG or JPG logo.");
      const bmp = await loadImage(f);
      const logo = { dataUrl, w: bmp.width, h: bmp.height };
      bmp.close();
      set("logo", logo);
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : "This image could not be read.");
    }
  };

  const exportPdf = async () => {
    setBusy("pdf");
    setError(null);
    setDone(null);
    try {
      const lib = await getPdfLib();
      const { bytes } = await buildCardPdf(lib, design, embedUnicodeFonts);
      if (!mounted.current) return;
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), "business-card-print.pdf");
      setDone("Print PDF downloaded: page 1 is the front, page 2 is the back.");
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "The PDF could not be created.");
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const exportPng = async (side: "front" | "back") => {
    if (!model) return;
    setBusy(side);
    setError(null);
    setDone(null);
    try {
      const blob = await renderPng(model[side], model, design.logo?.dataUrl ?? null, pngBleed);
      if (!mounted.current) return;
      downloadBlob(blob, `business-card-${side}${pngBleed ? "-bleed" : ""}.png`);
      setDone(`${side === "front" ? "Front" : "Back"} PNG downloaded at 300 DPI.`);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "The PNG could not be created.");
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ToolPanel
          title="Card details"
          actions={
            <ResetBtn
              label="Reset to sample"
              onClick={() => {
                clear();
                setDone(null);
                setError(null);
              }}
            />
          }
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Name" value={design.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={60} />
              <TextField label="Job title" optional value={design.title} onChange={(e) => set("title", e.target.value)} maxLength={70} />
              <TextField label="Company" optional value={design.company} onChange={(e) => set("company", e.target.value)} maxLength={60} />
              <TextField label="Phone" optional type="tel" value={design.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} />
              <TextField label="Email" optional type="email" value={design.email} onChange={(e) => set("email", e.target.value)} error={emailError} maxLength={80} />
              <TextField label="Website" optional value={design.website} onChange={(e) => set("website", e.target.value)} error={siteError} maxLength={100} />
              <TextField label="Address" optional className="sm:col-span-2" value={design.address} onChange={(e) => set("address", e.target.value)} maxLength={120} />
              <TextField
                label="Tagline"
                optional
                className="sm:col-span-2"
                hint="Shown on the back of the card."
                value={design.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                maxLength={80}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-ink">Logo (optional)</p>
              <div className="mt-2">
                {design.logo ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg bg-sunken p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                    <img src={design.logo.dataUrl} alt="Uploaded logo" className="h-12 max-w-[140px] object-contain" />
                    <span className="text-sm text-muted">
                      {design.logo.w} × {design.logo.h} px
                    </span>
                    <Btn variant="subtle" icon="trash" onClick={() => set("logo", null)}>
                      Remove logo
                    </Btn>
                  </div>
                ) : (
                  <FileDrop
                    compact
                    accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                    maxSizeMB={1}
                    label="Choose a PNG or JPG logo"
                    hint="Up to 1 MB. A transparent PNG at 600 px or wider prints sharply."
                    onFiles={onLogo}
                  />
                )}
                {logoError && (
                  <div className="mt-2">
                    <Notice tone="error">{logoError}</Notice>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-ink" aria-hidden="true">
                  Size
                </p>
                <Segmented
                  label="Card size"
                  value={design.size}
                  onChange={(v) => set("size", v)}
                  options={[
                    { value: "us", label: CARD_SIZES.us.label },
                    { value: "eu", label: CARD_SIZES.eu.label },
                  ]}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-ink" aria-hidden="true">
                  Front layout
                </p>
                <Segmented<FrontLayout> label="Front layout" value={design.front} onChange={(v) => set("front", v)} options={FRONT_LAYOUTS} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField label="Accent color" value={design.accent} onChange={(v) => set("accent", v)} />
                <ColorField label="Background color" value={design.background} onChange={(v) => set("background", v)} />
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ink">Back side</legend>
              <Segmented
                label="Back background"
                value={design.backFill}
                onChange={(v) => set("backFill", v)}
                options={[
                  { value: "accent", label: "Accent background" },
                  { value: "background", label: "Same as front" },
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Checkbox label="Show logo" checked={design.backLogo} onChange={(v) => set("backLogo", v)} />
                <Checkbox label="Show company" checked={design.backCompany} onChange={(v) => set("backCompany", v)} />
                <Checkbox label="Show tagline" checked={design.backTagline} onChange={(v) => set("backTagline", v)} />
                <Checkbox label="Show QR code" checked={design.backQr} onChange={(v) => set("backQr", v)} />
              </div>
              {design.backQr && (
                <div>
                  <p className="mb-2 text-sm text-ink-2" aria-hidden="true">
                    QR code content
                  </p>
                  <Segmented
                    label="QR code content"
                    value={design.qrMode}
                    onChange={(v) => set("qrMode", v)}
                    options={[
                      { value: "url", label: "Website link" },
                      { value: "vcard", label: "Contact card (vCard)" },
                    ]}
                  />
                </div>
              )}
            </fieldset>
          </div>
        </ToolPanel>

        <ToolPanel title="Preview and export">
          <div className="space-y-5">
            <Checkbox
              label="Show bleed area and trim line"
              hint="The dashed red line is where the card is cut. Color outside it is the 3 mm bleed."
              checked={guides}
              onChange={setGuides}
            />
            {model ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <CardSvg title="Front" side={model.front} model={model} logo={design.logo?.dataUrl ?? null} guides={guides} />
                <CardSvg title="Back" side={model.back} model={model} logo={design.logo?.dataUrl ?? null} guides={guides} />
              </div>
            ) : (
              <Spinner label="Preparing preview" />
            )}
            {model?.warnings.map((w) => (
              <Notice key={w} tone="warning">
                {w}
              </Notice>
            ))}
            {nothing && <Notice tone="warning">Add a name or company so the card has something to print.</Notice>}

            <div className="space-y-3 rounded-xl bg-sunken p-4">
              <p className="text-sm font-medium text-ink">Print PDF</p>
              <Checkbox
                label="Crop marks"
                hint="Adds marks outside the bleed so the printer knows where to cut."
                checked={design.cropMarks}
                onChange={(v) => set("cropMarks", v)}
              />
              <Btn icon="download" onClick={exportPdf} disabled={busy !== null || nothing}>
                Download print PDF
              </Btn>
            </div>
            <div className="space-y-3 rounded-xl bg-sunken p-4">
              <p className="text-sm font-medium text-ink">PNG images (300 DPI)</p>
              <Checkbox label="Include the 3 mm bleed" checked={pngBleed} onChange={setPngBleed} />
              <div className="flex flex-wrap gap-2">
                <Btn variant="ghost" icon="image" onClick={() => exportPng("front")} disabled={busy !== null || !model || nothing}>
                  Front PNG
                </Btn>
                <Btn variant="ghost" icon="image" onClick={() => exportPng("back")} disabled={busy !== null || !model || nothing}>
                  Back PNG
                </Btn>
              </div>
            </div>
            <div aria-live="polite">
              {busy && <Spinner label={busy === "pdf" ? "Building the PDF" : "Rendering the image"} />}
              {done && <Notice tone="success">{done}</Notice>}
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <p className="text-[0.8125rem] text-muted">
              The PDF uses RGB colors and embedded Noto Sans text. Ask your printer whether they need CMYK; most online print
              services convert RGB files automatically.
            </p>
          </div>
        </ToolPanel>
      </div>
      <PrivacyNote stored />
    </div>
  );
}
