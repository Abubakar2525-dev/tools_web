"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Btn, Notice, PrivacyNote, ResetBtn, SplitGrid, TextField, ToolPanel } from "@/components/tools/kit";
import { FileDrop, loadImage } from "@/components/tools/engines/files";
import { formatHex, formatRgb, fromHsv, nearestNamed, parseColor, toGamut, toHsv, type Color } from "./lib/color";
import { FormatTable, checker, textOn } from "./shared";

type Hsv = { h: number; s: number; v: number; a: number };
type EyeDropperResult = { sRGBHex: string };
type EyeDropperCtor = new () => { open: (o?: { signal?: AbortSignal }) => Promise<EyeDropperResult> };

const START: Hsv = { h: 210, s: 0.75, v: 0.9, a: 1 };

const noop = () => () => {};
function useEyeDropperSupport() {
  return useSyncExternalStore(
    noop,
    () => typeof window !== "undefined" && "EyeDropper" in window,
    () => false,
  );
}

function hsvFromColor(c: Color): Hsv {
  const [h, s, v] = toHsv(toGamut(c));
  return { h, s, v, a: c.alpha };
}

export default function Tool() {
  const [hsv, setHsv] = useState<Hsv>(START);
  const [text, setText] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [dropError, setDropError] = useState<string | null>(null);
  const supported = useEyeDropperSupport();

  const color: Color = { ...fromHsv([hsv.h, hsv.s, hsv.v]), alpha: hsv.a };
  const hex = formatHex(color);
  const named = nearestNamed(color);

  const setFromColor = (c: Color, remember = false) => {
    setHsv(hsvFromColor(c));
    setText(null);
    if (remember) {
      const h = formatHex(c);
      setHistory((old) => [h, ...old.filter((x) => x !== h)].slice(0, 12));
    }
  };

  const eyedrop = async () => {
    setDropError(null);
    try {
      const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
      const res = await new Ctor().open();
      const c = parseColor(res.sRGBHex);
      if (c) setFromColor(c, true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setDropError("The eyedropper could not read a color. Your browser may have blocked it.");
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Pick a color"
        actions={
          <>
            {supported && (
              <Btn icon="eye" onClick={eyedrop}>
                Pick from screen
              </Btn>
            )}
            <ResetBtn
              onClick={() => {
                setHsv(START);
                setText(null);
              }}
            />
          </>
        }
      >
        <SplitGrid>
          <div className="min-w-0 space-y-5">
            <SvSquare hsv={hsv} onChange={(s, v) => setHsv((o) => ({ ...o, s, v }))} />
            <div>
              <label htmlFor="cp-hue" className="text-sm font-medium text-ink">
                Hue <span className="font-normal text-muted tabular-nums">{Math.round(hsv.h)}°</span>
              </label>
              <input
                id="cp-hue"
                type="range"
                min={0}
                max={359}
                value={Math.round(hsv.h)}
                onChange={(e) => setHsv((o) => ({ ...o, h: Number(e.target.value) }))}
                className="mt-2 h-10 w-full cursor-pointer appearance-none rounded-lg"
                style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
              />
            </div>
            <div>
              <label htmlFor="cp-alpha" className="text-sm font-medium text-ink">
                Opacity <span className="font-normal text-muted tabular-nums">{Math.round(hsv.a * 100)}%</span>
              </label>
              <div className="mt-2 rounded-lg" style={{ background: checker }}>
                <input
                  id="cp-alpha"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(hsv.a * 100)}
                  onChange={(e) => setHsv((o) => ({ ...o, a: Number(e.target.value) / 100 }))}
                  className="h-10 w-full cursor-pointer appearance-none rounded-lg"
                  style={{ background: `linear-gradient(to right, transparent, ${formatHex({ ...color, alpha: 1 })})` }}
                />
              </div>
            </div>
            <TextField
              label="Type or paste a color"
              value={text ?? hex}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => {
                setText(e.target.value);
                const c = parseColor(e.target.value);
                if (c) setHsv(hsvFromColor(c));
              }}
              onBlur={() => setText(null)}
              error={text !== null && text.trim() !== "" && !parseColor(text) ? "Not a recognized color format." : null}
            />
            {!supported && (
              <Notice tone="info">
                Your browser does not offer the EyeDropper API (currently Chromium-based desktop browsers only), so picking from anywhere on screen
                is not available. Take a screenshot and pick from it below instead.
              </Notice>
            )}
            {dropError && <Notice tone="error">{dropError}</Notice>}
          </div>
          <div className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]" style={{ background: checker }}>
              <div className="flex h-28 flex-col items-center justify-center gap-1 font-mono text-sm" style={{ background: formatRgb(color), color: textOn(color) }}>
                <span className="text-lg font-semibold">{hex}</span>
                <span className="font-sans text-xs">Closest named color: {named.name}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn variant="ghost" icon="plus" onClick={() => setHistory((old) => [hex, ...old.filter((x) => x !== hex)].slice(0, 12))}>
                Save to recent
              </Btn>
            </div>
            <FormatTable color={color} only={["hex", "rgb", "hsl", "hsv", "hwb", "cmyk", "lab", "lch", "oklab", "oklch"]} />
            {history.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink">Recent colors</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {history.map((h) => (
                    <li key={h}>
                      <button
                        type="button"
                        onClick={() => setFromColor(parseColor(h) as Color)}
                        className="h-10 w-10 rounded-lg shadow-[inset_0_0_0_1px_var(--line-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        style={{ background: h }}
                        title={h}
                      >
                        <span className="sr-only">Use {h}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SplitGrid>
      </ToolPanel>

      <ImagePicker onPick={(c) => setFromColor(c, true)} />
      <PrivacyNote />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Saturation / value square                                           */
/* ------------------------------------------------------------------ */

function SvSquare({ hsv, onChange }: { hsv: Hsv; onChange: (s: number, v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const update = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    onChange(s, v);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    let { s, v } = hsv;
    if (e.key === "ArrowRight") s += step;
    else if (e.key === "ArrowLeft") s -= step;
    else if (e.key === "ArrowUp") v += step;
    else if (e.key === "ArrowDown") v -= step;
    else if (e.key === "Home") s = 0;
    else if (e.key === "End") s = 1;
    else if (e.key === "PageUp") v = 1;
    else if (e.key === "PageDown") v = 0;
    else return;
    e.preventDefault();
    onChange(Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, v)));
  };
  return (
    <div>
      <p id="cp-sv-label" className="text-sm font-medium text-ink">
        Saturation and brightness
      </p>
      <p id="cp-sv-hint" className="mt-1 text-[0.8125rem] text-muted">
        Drag, or focus and use arrow keys (Shift for bigger steps).
      </p>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-labelledby="cp-sv-label"
        aria-describedby="cp-sv-hint"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => dragging.current && update(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        className="relative mt-2 aspect-[4/3] w-full cursor-crosshair touch-none rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h} 100% 50%)`,
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pick from an image                                                  */
/* ------------------------------------------------------------------ */

function ImagePicker({ onPick }: { onPick: (c: Color) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [cross, setCross] = useState<{ x: number; y: number; hex: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const MAX = 1600;
  const dims = bitmap
    ? (() => {
        const s = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
        return { w: Math.max(1, Math.round(bitmap.width * s)), h: Math.max(1, Math.round(bitmap.height * s)) };
      })()
    : null;

  const dw = dims?.w ?? 0;
  const dh = dims?.h ?? 0;
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !bitmap || !dw) return;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    try {
      ctx?.drawImage(bitmap, 0, 0, dw, dh);
    } catch {
      /* bitmap already released */
    }
  }, [bitmap, dw, dh]);

  const sample = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, alpha: d[3] / 255 };
  };
  const moveTo = (x: number, y: number, pick = false) => {
    if (!dims) return;
    const cx = Math.min(dims.w - 1, Math.max(0, Math.round(x)));
    const cy = Math.min(dims.h - 1, Math.max(0, Math.round(y)));
    const c = sample(cx, cy);
    if (!c) return;
    setCross({ x: cx, y: cy, hex: formatHex(c) });
    if (pick) onPick(c);
  };
  const fromEvent = (e: React.MouseEvent<HTMLCanvasElement>, pick: boolean) => {
    if (!dims) return;
    const r = e.currentTarget.getBoundingClientRect();
    moveTo(((e.clientX - r.left) / r.width) * dims.w, ((e.clientY - r.top) / r.height) * dims.h, pick);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!dims) return;
    const p = cross ?? { x: Math.floor(dims.w / 2), y: Math.floor(dims.h / 2) };
    const step = e.shiftKey ? 20 : 2;
    if (e.key === "ArrowLeft") moveTo(p.x - step, p.y);
    else if (e.key === "ArrowRight") moveTo(p.x + step, p.y);
    else if (e.key === "ArrowUp") moveTo(p.x, p.y - step);
    else if (e.key === "ArrowDown") moveTo(p.x, p.y + step);
    else if (e.key === "Enter" || e.key === " ") moveTo(p.x, p.y, true);
    else return;
    e.preventDefault();
  };

  return (
    <ToolPanel
      title="Pick from an image"
      actions={
        bitmap ? (
          <Btn
            variant="subtle"
            icon="trash"
            onClick={() => {
              bitmap.close();
              setBitmap(null);
              setCross(null);
            }}
          >
            Remove image
          </Btn>
        ) : undefined
      }
    >
      {!bitmap ? (
        <FileDrop
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.avif,.bmp"
          maxSizeMB={30}
          allowPaste
          label={busy ? "Loading image…" : "Choose an image or screenshot, or drop it here"}
          hint="PNG, JPG, WebP, GIF or AVIF up to 30 MB. Nothing is uploaded."
          onFiles={async ([f]) => {
            setError(null);
            setBusy(true);
            try {
              const bm = await loadImage(f);
              setBitmap(bm);
              setCross(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not open this image.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <div className="space-y-3">
          <p id="cp-img-hint" className="text-sm text-ink-2">
            Click the image to pick a color. With the keyboard: focus the image, move the crosshair with arrow keys (Shift moves faster) and press
            Enter to pick.
          </p>
          <div className="flex justify-center overflow-hidden rounded-xl bg-sunken shadow-[0_0_0_1px_var(--line)]">
            <div className="relative inline-block max-w-full">
              <canvas
                ref={canvasRef}
                width={dims?.w}
                height={dims?.h}
                tabIndex={0}
                role="application"
                aria-label={`Image color picker${cross ? `. Crosshair color ${cross.hex}` : ""}`}
                aria-describedby="cp-img-hint"
                onKeyDown={onKey}
                onPointerMove={(e) => fromEvent(e, false)}
                onClick={(e) => fromEvent(e, true)}
                className="block h-auto max-h-[520px] w-auto max-w-full cursor-crosshair focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              />
              {cross && dims && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
                  style={{ left: `${((cross.x + 0.5) / dims.w) * 100}%`, top: `${((cross.y + 0.5) / dims.h) * 100}%` }}
                />
              )}
            </div>
          </div>
          {cross && (
            <p className="flex items-center gap-2 text-sm text-ink-2" aria-live="polite">
              <span className="inline-block h-6 w-6 rounded-md shadow-[inset_0_0_0_1px_var(--line-strong)]" style={{ background: cross.hex }} />
              Under the crosshair ({cross.x}, {cross.y}): <code className="font-mono">{cross.hex}</code>
            </p>
          )}
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <p className="mt-3 text-[0.8125rem] text-muted">Large images are scaled to 1600 px on the longest side for picking, which can blend fine details slightly.</p>
    </ToolPanel>
  );
}
