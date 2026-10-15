"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Btn,
  Checkbox,
  Notice,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SelectField,
  TextArea,
  ToolPanel,
  fmt,
  uid,
} from "@/components/tools/kit";
import { FileDrop, Spinner, useCanEncode, canvasToBlob, downloadBlob, formatBytes, loadImage } from "@/components/tools/engines/files";
import type { AnyIcon } from "@/components/ui/Icon";
import type { CanvasSize } from "../lib/platforms";
import { searchQuality } from "../lib/misc";
import { clamp, type Rect } from "../lib/geometry";
import { ColorField, RangeField } from "./controls";
import {
  FONTS,
  describeScene,
  imageLayer,
  renderScene,
  textLayer,
  type Background,
  type FontKey,
  type ImageLayer,
  type Layer,
  type Scene,
  type TextLayer,
} from "./scene";

export type ExportFormat = "png" | "jpeg" | "webp";

export interface EditorConfig {
  slug: string;
  title: string;
  sizes: CanvasSize[];
  /** Allow a custom width/height entry. */
  customSize?: boolean;
  initial: (size: { w: number; h: number }) => Scene;
  templates?: { id: string; label: string; apply: (size: { w: number; h: number }, current: Scene) => Scene }[];
  formats: ExportFormat[];
  defaultFormat: ExportFormat;
  /** When set, JPG/WebP exports search for the highest quality under this size. */
  maxBytes?: number;
  maxBytesLabel?: string;
  quickAdds?: { label: string; icon: AnyIcon; make: (size: { w: number; h: number }) => TextLayer }[];
  /** Short note shown under the size picker. */
  sizeNote?: string;
  /** Extra content under the export controls (e.g. a meta-tag snippet). */
  extra?: (size: { w: number; h: number }) => React.ReactNode;
}

const MIME: Record<ExportFormat, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
const EXT: Record<ExportFormat, string> = { png: "png", jpeg: "jpg", webp: "webp" };
const LABEL: Record<ExportFormat, string> = { png: "PNG", jpeg: "JPG", webp: "WebP" };

const PREVIEW_MAX = 1400;

type Drag = { id: string; startX: number; startY: number; ox: number; oy: number };

function scaleLayer(L: Layer, k: number): Layer {
  if (L.kind === "text")
    return {
      ...L,
      size: Math.max(6, Math.round(L.size * k)),
      outline: Math.round(L.outline * k * 10) / 10,
      shadow: Math.round(L.shadow * k),
      badgePad: Math.round(L.badgePad * k),
      badgeRadius: Math.round(L.badgeRadius * k),
    };
  return { ...L, radius: Math.round(L.radius * k), border: Math.round(L.border * k), shadow: Math.round(L.shadow * k) };
}

export function CanvasEditor({ config }: { config: EditorConfig }) {
  const first = config.sizes[0];
  const [sizeId, setSizeId] = useState(first.id);
  const [custom, setCustom] = useState({ w: "1500", h: "500" });
  const preset = config.sizes.find((s) => s.id === sizeId);
  const customW = clamp(Math.round(Number(custom.w) || 0), 0, 8000);
  const customH = clamp(Math.round(Number(custom.h) || 0), 0, 8000);
  const customError = sizeId === "custom" && (customW < 50 || customH < 50) ? "Use a width and height between 50 and 8000 px." : null;
  const W = sizeId === "custom" ? Math.max(50, customW) : (preset?.w ?? first.w);
  const H = sizeId === "custom" ? Math.max(50, customH) : (preset?.h ?? first.h);
  const zones = useMemo(() => (sizeId === "custom" ? [] : (preset?.zones ?? [])), [sizeId, preset]);

  const [scene, setScene] = useState<Scene>(() => config.initial({ w: first.w, h: first.h }));
  const [selected, setSelected] = useState<string | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [format, setFormat] = useState<ExportFormat>(config.defaultFormat);
  const [quality, setQuality] = useState(0.9);
  const [busy, setBusy] = useState(false);
  const [exported, setExported] = useState<{ size: number; quality: number | null; fits: boolean; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontTick, setFontTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boundsRef = useRef<Map<string, Rect>>(new Map());
  const dragRef = useRef<Drag | null>(null);
  const prevSize = useRef({ w: first.w, h: first.h });

  const webpOk = useCanEncode("image/webp");
  const formats = useMemo(() => config.formats.filter((f) => f !== "webp" || webpOk), [config.formats, webpOk]);

  // Re-render once web fonts are ready so canvas text uses them.
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, []);

  const scale = Math.min(1, PREVIEW_MAX / W);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = Math.round(W * scale);
    c.height = Math.round(H * scale);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    boundsRef.current = renderScene(ctx, scene, W, H, { scale, zones: showZones ? zones : [], selectedId: selected });
  }, [scene, W, H, scale, zones, showZones, selected, fontTick]);

  const changeSize = (id: string, nextW?: number, nextH?: number) => {
    const target = id === "custom" ? { w: nextW ?? W, h: nextH ?? H } : (config.sizes.find((s) => s.id === id) ?? first);
    const k = Math.min(target.w / prevSize.current.w, target.h / prevSize.current.h);
    if (Number.isFinite(k) && k > 0 && Math.abs(k - 1) > 0.001) setScene((s) => ({ ...s, layers: s.layers.map((L) => scaleLayer(L, k)) }));
    prevSize.current = { w: target.w, h: target.h };
    setSizeId(id);
    setExported(null);
  };

  const updateLayer = useCallback((id: string, patch: Partial<TextLayer> | Partial<ImageLayer>) => {
    setScene((s) => ({ ...s, layers: s.layers.map((L) => (L.id === id ? ({ ...L, ...patch } as Layer) : L)) }));
    setExported(null);
  }, []);
  const updateBg = (patch: Partial<Background>) => {
    setScene((s) => ({ ...s, bg: { ...s.bg, ...patch } }));
    setExported(null);
  };

  const sel = scene.layers.find((L) => L.id === selected) ?? null;

  const addText = (L?: TextLayer) => {
    const layer = L ?? textLayer({ text: "New text", size: Math.round(H / 10), y: 0.5 });
    setScene((s) => ({ ...s, layers: [...s.layers, layer] }));
    setSelected(layer.id);
  };

  const addImage = async (files: File[]) => {
    setError(null);
    try {
      const bmp = await loadImage(files[0]);
      const L = imageLayer(bmp, files[0].name, { w: 0.2, x: 0.85, y: 0.2 });
      setScene((s) => ({ ...s, layers: [...s.layers, L] }));
      setSelected(L.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.");
    }
  };

  const setBgImage = async (files: File[]) => {
    setError(null);
    try {
      const bmp = await loadImage(files[0]);
      scene.bg.image?.close();
      updateBg({ mode: "image", image: bmp, imageName: files[0].name, zoom: 1, focusX: 0.5, focusY: 0.5 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.");
    }
  };

  const removeLayer = (id: string) => {
    setScene((s) => {
      const L = s.layers.find((x) => x.id === id);
      if (L?.kind === "image") L.bitmap.close();
      return { ...s, layers: s.layers.filter((x) => x.id !== id) };
    });
    setSelected(null);
  };

  const moveZ = (id: string, dir: -1 | 1) =>
    setScene((s) => {
      const i = s.layers.findIndex((L) => L.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.layers.length) return s;
      const layers = s.layers.slice();
      [layers[i], layers[j]] = [layers[j], layers[i]];
      return { ...s, layers };
    });

  const duplicate = (id: string) => {
    const L = scene.layers.find((x) => x.id === id);
    if (!L || L.kind !== "text") return;
    const copy: TextLayer = { ...L, id: uid(), y: clamp(L.y + 0.08, 0, 1) };
    setScene((s) => ({ ...s, layers: [...s.layers, copy] }));
    setSelected(copy.id);
  };

  const reset = () => {
    for (const L of scene.layers) if (L.kind === "image") L.bitmap.close();
    scene.bg.image?.close();
    setScene(config.initial({ w: W, h: H }));
    setSelected(null);
    setExported(null);
    setError(null);
  };

  /* -------------------------- pointer + keyboard -------------------------- */

  const toScene = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toScene(e);
    const hit = [...scene.layers].reverse().find((L) => {
      const b = boundsRef.current.get(L.id);
      return b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    });
    if (!hit) {
      setSelected(null);
      return;
    }
    setSelected(hit.id);
    dragRef.current = { id: hit.id, startX: p.x, startY: p.y, ox: hit.x, oy: hit.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toScene(e);
    updateLayer(d.id, { x: clamp(d.ox + (p.x - d.startX) / W, -0.2, 1.2), y: clamp(d.oy + (p.y - d.startY) / H, -0.2, 1.2) });
  };
  const endDrag = () => {
    dragRef.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!sel) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      updateLayer(sel.id, { x: clamp(sel.x + m[0], -0.2, 1.2), y: clamp(sel.y + m[1], -0.2, 1.2) });
    }
  };

  /* -------------------------------- export -------------------------------- */

  const doExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Your browser could not create a drawing canvas at this size.");
      renderScene(ctx, scene, W, H);
      const mime = MIME[format];
      const name = `${config.slug}-${W}x${H}.${EXT[format]}`;
      let blob: Blob;
      let q: number | null = null;
      let fits = true;
      if (format !== "png" && config.maxBytes) {
        const r = await searchQuality(async (qq) => {
          const b = await canvasToBlob(c, mime, qq);
          return { result: b, size: b.size };
        }, config.maxBytes, { min: 0.4, max: 0.95 });
        blob = r.result;
        q = r.quality;
        fits = r.fits;
      } else {
        blob = await canvasToBlob(c, mime, format === "png" ? undefined : quality);
        q = format === "png" ? null : quality;
        if (config.maxBytes) fits = blob.size <= config.maxBytes;
      }
      downloadBlob(blob, name);
      setExported({ size: blob.size, quality: q, fits, name });
      c.width = c.height = 0;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------- render -------------------------------- */

  const sizeOptions = [
    ...config.sizes.map((s) => ({ value: s.id, label: s.label })),
    ...(config.customSize ? [{ value: "custom", label: "Custom size" }] : []),
  ];

  return (
    <div className="space-y-5">
      <ToolPanel
        title={config.title}
        actions={
          <>
            <Btn variant="ghost" icon="plus" onClick={() => addText()}>
              Add text
            </Btn>
            {config.quickAdds?.map((q) => (
              <Btn key={q.label} variant="ghost" icon={q.icon} onClick={() => addText(q.make({ w: W, h: H }))}>
                {q.label}
              </Btn>
            ))}
            <ResetBtn onClick={reset} />
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Canvas size" value={sizeId} onChange={(e) => changeSize(e.target.value)} options={sizeOptions} />
          {sizeId === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <SizeInput label="Width (px)" value={custom.w} onChange={(v) => setCustom((c) => ({ ...c, w: v }))} onCommit={() => changeSize("custom", customW, customH)} />
              <SizeInput label="Height (px)" value={custom.h} onChange={(v) => setCustom((c) => ({ ...c, h: v }))} onCommit={() => changeSize("custom", customW, customH)} />
            </div>
          )}
          {config.templates && (
            <div>
              <p className="text-sm font-medium text-ink">Layout template</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {config.templates.map((t) => (
                  <Btn
                    key={t.id}
                    variant="ghost"
                    onClick={() => {
                      setScene((s) => t.apply({ w: W, h: H }, s));
                      setSelected(null);
                      setExported(null);
                    }}
                  >
                    {t.label}
                  </Btn>
                ))}
              </div>
            </div>
          )}
        </div>
        {customError && (
          <div className="mt-3">
            <Notice tone="error">{customError}</Notice>
          </div>
        )}
        {(preset?.note || config.sizeNote) && sizeId !== "custom" && (
          <p className="mt-3 text-[0.8125rem] text-muted">{preset?.note ?? config.sizeNote}</p>
        )}

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-lg bg-[repeating-conic-gradient(var(--sunken)_0_25%,var(--surface)_0_50%)] bg-[length:20px_20px] shadow-[0_0_0_1px_var(--line)]">
              <canvas
                ref={canvasRef}
                tabIndex={0}
                role="img"
                aria-label={`Design preview. ${describeScene(scene, W, H)}${sel ? ` Selected: ${sel.name}. Arrow keys move it, Shift for bigger steps.` : " Click a layer to select it."}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onKeyDown}
                className="block h-auto w-full cursor-move touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-[0.8125rem] text-muted">
              <span className="tabular-nums">
                Output {W}×{H} px. Drag a layer, or select it and use the arrow keys.
              </span>
              {zones.length > 0 && <Checkbox label="Show safe zones (not exported)" checked={showZones} onChange={setShowZones} />}
            </div>

            <LayerList
              layers={scene.layers}
              selected={selected}
              onSelect={setSelected}
              onUp={(id) => moveZ(id, 1)}
              onDown={(id) => moveZ(id, -1)}
              onRemove={removeLayer}
            />
            <FileDrop compact accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml" maxSizeMB={25} onFiles={addImage} label="Add a logo or image layer" hint="PNG with transparency works best for logos. Up to 25 MB." />
          </div>

          <div className="min-w-0 space-y-4">
            {sel?.kind === "text" ? (
              <TextProps L={sel} W={W} onChange={(p) => updateLayer(sel.id, p)} onDuplicate={() => duplicate(sel.id)} onRemove={() => removeLayer(sel.id)} />
            ) : sel?.kind === "image" ? (
              <ImageProps L={sel} onChange={(p) => updateLayer(sel.id, p)} onRemove={() => removeLayer(sel.id)} />
            ) : (
              <BgProps bg={scene.bg} onChange={updateBg} onImage={setBgImage} />
            )}
            {sel && (
              <Btn variant="subtle" onClick={() => setSelected(null)}>
                Edit background
              </Btn>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4 border-t border-line pt-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Format</p>
              <Segmented
                label="Export format"
                value={format}
                onChange={(v) => {
                  setFormat(v);
                  setExported(null);
                }}
                options={formats.map((f) => ({ value: f, label: LABEL[f] }))}
              />
            </div>
            {format !== "png" && !config.maxBytes && (
              <div className="w-56">
                <RangeField label="Quality" value={quality} min={0.4} max={1} step={0.01} onChange={setQuality} format={(v) => `${Math.round(v * 100)}%`} />
              </div>
            )}
            <Btn icon="download" onClick={doExport} disabled={busy || !!customError}>
              Download {LABEL[format]}
            </Btn>
            {busy && <Spinner label="Exporting" />}
          </div>
          {config.maxBytes && format !== "png" && (
            <p className="text-[0.8125rem] text-muted">
              {LABEL[format]} quality is chosen automatically: the highest setting that stays under {config.maxBytesLabel ?? formatBytes(config.maxBytes)}.
            </p>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {exported && (
            <Notice tone={exported.fits ? "success" : "warning"} title={exported.fits ? "Downloaded" : "Downloaded, but over the size limit"}>
              {exported.name}: {formatBytes(exported.size)}
              {exported.quality !== null ? `, quality ${fmt(exported.quality * 100, 0)}%` : ""}.
              {!exported.fits &&
                (format === "png"
                  ? ` That is over ${config.maxBytesLabel ?? "the limit"}. Export as JPG to shrink it automatically.`
                  : ` Even the lowest quality is over ${config.maxBytesLabel ?? "the limit"}. Try a smaller canvas size or a simpler background.`)}
            </Notice>
          )}
          {config.extra?.({ w: W, h: H })}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

function SizeInput({ label, value, onChange, onCommit }: { label: string; value: string; onChange: (v: string) => void; onCommit: () => void }) {
  return (
    <label className="text-sm font-medium text-ink">
      {label}
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={onCommit}
        onKeyDown={(e) => e.key === "Enter" && onCommit()}
        className="mt-2 block h-11 w-full rounded-lg bg-surface px-3 text-[1rem] text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]"
      />
    </label>
  );
}

function LayerList({
  layers,
  selected,
  onSelect,
  onUp,
  onDown,
  onRemove,
}: {
  layers: Layer[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onUp: (id: string) => void;
  onDown: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const ordered = [...layers].reverse();
  return (
    <div>
      <p className="text-sm font-medium text-ink">Layers (top first)</p>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg shadow-[0_0_0_1px_var(--line)]">
        {ordered.map((L, i) => (
          <li key={L.id} className={`flex items-center gap-1 px-2 py-1 ${selected === L.id ? "bg-accent-soft" : "bg-surface"}`}>
            <button
              type="button"
              onClick={() => onSelect(L.id)}
              aria-pressed={selected === L.id}
              className="min-h-10 min-w-0 flex-1 truncate rounded-md px-2 text-left text-sm text-ink hover:bg-sunken"
            >
              <span className="text-muted">{L.kind === "text" ? (L.badge ? "Badge" : "Text") : "Image"}: </span>
              {L.kind === "text" ? L.text.split("\n")[0] || "(empty)" : L.name}
            </button>
            <IconBtn label={`Move ${L.kind} layer up`} disabled={i === 0} onClick={() => onUp(L.id)}>
              ↑
            </IconBtn>
            <IconBtn label={`Move ${L.kind} layer down`} disabled={i === ordered.length - 1} onClick={() => onDown(L.id)}>
              ↓
            </IconBtn>
            <IconBtn label={`Delete ${L.kind} layer`} onClick={() => onRemove(L.id)}>
              ×
            </IconBtn>
          </li>
        ))}
        <li className={`flex items-center px-2 py-1 ${selected === null ? "bg-accent-soft" : "bg-surface"}`}>
          <button type="button" onClick={() => onSelect(null)} aria-pressed={selected === null} className="min-h-10 flex-1 rounded-md px-2 text-left text-sm text-ink hover:bg-sunken">
            <span className="text-muted">Background</span>
          </button>
        </li>
      </ul>
    </div>
  );
}

function IconBtn({ label, children, ...rest }: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-base text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-30"
      {...rest}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function TextProps({
  L,
  W,
  onChange,
  onDuplicate,
  onRemove,
}: {
  L: TextLayer;
  W: number;
  onChange: (p: Partial<TextLayer>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const unit = Math.max(1, Math.round(W / 1280));
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-ink">Text layer</p>
      <TextArea label="Text" value={L.text} rows={3} onChange={(e) => onChange({ text: e.target.value })} className="[&_textarea]:min-h-[88px]" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Font"
          value={L.font}
          onChange={(e) => onChange({ font: e.target.value as FontKey })}
          options={(Object.keys(FONTS) as FontKey[]).map((k) => ({ value: k, label: FONTS[k].label }))}
        />
        <SelectField
          label="Weight"
          value={String(L.weight)}
          onChange={(e) => onChange({ weight: Number(e.target.value) })}
          options={[
            { value: "400", label: "Regular" },
            { value: "600", label: "Semibold" },
            { value: "700", label: "Bold" },
            { value: "800", label: "Extra bold" },
            { value: "900", label: "Black" },
          ]}
        />
      </div>
      <RangeField label="Font size" value={L.size} min={8} max={Math.round(W / 4)} onChange={(v) => onChange({ size: v })} format={(v) => `${v} px`} />
      <ColorField label="Text color" value={L.color} onChange={(v) => onChange({ color: v })} />
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Alignment</p>
        <Segmented
          label="Text alignment"
          value={L.align}
          onChange={(v) => onChange({ align: v })}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Checkbox label="Uppercase" checked={L.upper} onChange={(v) => onChange({ upper: v })} />
        <Checkbox label="Italic" checked={L.italic} onChange={(v) => onChange({ italic: v })} />
      </div>
      <RangeField label="Outline width" value={L.outline} min={0} max={20 * unit} onChange={(v) => onChange({ outline: v })} format={(v) => `${v} px`} />
      {L.outline > 0 && <ColorField label="Outline color" value={L.outlineColor} onChange={(v) => onChange({ outlineColor: v })} />}
      <RangeField label="Shadow blur" value={L.shadow} min={0} max={40 * unit} onChange={(v) => onChange({ shadow: v })} format={(v) => `${v} px`} />
      {L.shadow > 0 && <ColorField label="Shadow color" value={L.shadowColor} onChange={(v) => onChange({ shadowColor: v })} />}
      <Checkbox label="Badge background" checked={L.badge} onChange={(v) => onChange({ badge: v })} hint="Draws a rounded box behind the text." />
      {L.badge && (
        <>
          <ColorField label="Badge color" value={L.badgeColor} onChange={(v) => onChange({ badgeColor: v })} />
          <RangeField label="Badge padding" value={L.badgePad} min={0} max={60 * unit} onChange={(v) => onChange({ badgePad: v })} format={(v) => `${v} px`} />
          <RangeField label="Badge corner radius" value={L.badgeRadius} min={0} max={60 * unit} onChange={(v) => onChange({ badgeRadius: v })} format={(v) => `${v} px`} />
        </>
      )}
      <RangeField label="Max width" value={L.maxWidth} min={0.1} max={1} step={0.01} onChange={(v) => onChange({ maxWidth: v })} format={pct} />
      <RangeField label="Line height" value={L.lineHeight} min={0.8} max={2} step={0.05} onChange={(v) => onChange({ lineHeight: v })} format={(v) => v.toFixed(2)} />
      <PositionFields x={L.x} y={L.y} onChange={onChange} />
      <RangeField label="Opacity" value={L.opacity} min={0.1} max={1} step={0.05} onChange={(v) => onChange({ opacity: v })} format={pct} />
      <div className="flex flex-wrap gap-2">
        <Btn variant="ghost" icon="copy" onClick={onDuplicate}>
          Duplicate
        </Btn>
        <Btn variant="danger" icon="trash" onClick={onRemove}>
          Delete
        </Btn>
      </div>
    </div>
  );
}

function PositionFields({ x, y, onChange }: { x: number; y: number; onChange: (p: { x?: number; y?: number }) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <RangeField label="Horizontal position" value={x} min={0} max={1} step={0.005} onChange={(v) => onChange({ x: v })} format={pct} />
      <RangeField label="Vertical position" value={y} min={0} max={1} step={0.005} onChange={(v) => onChange({ y: v })} format={pct} />
    </div>
  );
}

function ImageProps({ L, onChange, onRemove }: { L: ImageLayer; onChange: (p: Partial<ImageLayer>) => void; onRemove: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-ink">
        Image layer <span className="font-normal text-muted">({L.name})</span>
      </p>
      <RangeField label="Width" value={L.w} min={0.03} max={1.5} step={0.005} onChange={(v) => onChange({ w: v })} format={pct} />
      <PositionFields x={L.x} y={L.y} onChange={onChange} />
      <RangeField label="Opacity" value={L.opacity} min={0.1} max={1} step={0.05} onChange={(v) => onChange({ opacity: v })} format={pct} />
      <Checkbox label="Circle crop" checked={L.circle} onChange={(v) => onChange({ circle: v })} />
      {!L.circle && <RangeField label="Corner radius" value={L.radius} min={0} max={200} onChange={(v) => onChange({ radius: v })} format={(v) => `${v} px`} />}
      <RangeField label="Border" value={L.border} min={0} max={40} onChange={(v) => onChange({ border: v })} format={(v) => `${v} px`} />
      {L.border > 0 && <ColorField label="Border color" value={L.borderColor} onChange={(v) => onChange({ borderColor: v })} />}
      <RangeField label="Shadow" value={L.shadow} min={0} max={80} onChange={(v) => onChange({ shadow: v })} format={(v) => `${v} px`} />
      <Btn variant="danger" icon="trash" onClick={onRemove}>
        Delete image
      </Btn>
    </div>
  );
}

function BgProps({ bg, onChange, onImage }: { bg: Background; onChange: (p: Partial<Background>) => void; onImage: (f: File[]) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-ink">Background</p>
      <Segmented
        label="Background type"
        value={bg.mode}
        onChange={(v) => onChange({ mode: v })}
        options={[
          { value: "color", label: "Color" },
          { value: "gradient", label: "Gradient" },
          { value: "image", label: "Image" },
        ]}
      />
      <ColorField label={bg.mode === "gradient" ? "Start color" : "Color"} value={bg.color} onChange={(v) => onChange({ color: v })} />
      {bg.mode === "gradient" && (
        <>
          <ColorField label="End color" value={bg.color2} onChange={(v) => onChange({ color2: v })} />
          <RangeField label="Angle" value={bg.angle} min={0} max={360} step={5} onChange={(v) => onChange({ angle: v })} format={(v) => `${v}°`} />
        </>
      )}
      {bg.mode === "image" && (
        <>
          <FileDrop compact accept="image/png,image/jpeg,image/webp,image/gif,image/avif" maxSizeMB={40} onFiles={onImage} label={bg.image ? "Replace background image" : "Choose a background image"} hint="JPG, PNG, WebP or AVIF up to 40 MB." />
          {bg.image && (
            <>
              <Segmented
                label="Image fit"
                value={bg.fit}
                onChange={(v) => onChange({ fit: v })}
                options={[
                  { value: "cover", label: "Fill (crop)" },
                  { value: "contain", label: "Fit (show all)" },
                ]}
              />
              <RangeField label="Zoom" value={bg.zoom} min={1} max={3} step={0.01} onChange={(v) => onChange({ zoom: v })} format={(v) => `${v.toFixed(2)}×`} />
              <RangeField label="Horizontal focus" value={bg.focusX} min={0} max={1} step={0.01} onChange={(v) => onChange({ focusX: v })} format={pct} />
              <RangeField label="Vertical focus" value={bg.focusY} min={0} max={1} step={0.01} onChange={(v) => onChange({ focusY: v })} format={pct} />
              <RangeField label="Blur" value={bg.blur} min={0} max={60} onChange={(v) => onChange({ blur: v })} format={(v) => `${v} px`} />
            </>
          )}
        </>
      )}
      <RangeField label="Darken overlay" value={bg.darken} min={0} max={0.85} step={0.05} onChange={(v) => onChange({ darken: v })} format={pct} hint="Improves text contrast over busy photos." />
    </div>
  );
}
