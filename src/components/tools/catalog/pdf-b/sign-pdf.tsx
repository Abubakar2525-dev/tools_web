"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Checkbox, Notice, Segmented, SelectField, TextField, uid } from "@/components/tools/kit";
import { ItemEditor } from "./editor";
import { ColorInput, NumInput, OVERLAY_FONT, RangeInput } from "./shared";
import { canvasToStoredImage } from "./images";
import { viewSize } from "./lib/geometry";
import { isoDate } from "./lib/text";
import type { ImageItem, Item, StoredImage, TextItem } from "./lib/write";

const PAD_W = 1000;
const PAD_H = 340;

const SCRIPT_FONTS = [
  { value: "script", label: "Handwriting (system script font)" },
  { value: "italic", label: "Italic (Noto Sans)" },
];

const DATE_FORMATS = [
  { value: "iso", label: "2026-03-14" },
  { value: "us", label: "03/14/2026" },
  { value: "eu", label: "14/03/2026" },
  { value: "long", label: "March 14, 2026" },
];

function formatDate(d: Date, f: string) {
  const p = (n: number) => String(n).padStart(2, "0");
  if (f === "us") return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
  if (f === "eu") return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (f === "long") return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return isoDate(d);
}

/** Copies the non-transparent area of a canvas (plus a small margin) to a new canvas. */
function trimCanvas(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = src.getContext("2d");
  if (!ctx) return null;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const m = 6;
  x0 = Math.max(0, x0 - m);
  y0 = Math.max(0, y0 - m);
  x1 = Math.min(width - 1, x1 + m);
  y1 = Math.min(height - 1, y1 + m);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")?.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

type Stroke = { x: number; y: number }[];

function SignaturePad({ color, thickness, onChange }: { color: string; thickness: number; onChange: (empty: boolean) => void; }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const active = useRef<number | null>(null);

  const redraw = () => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) {
      if (!s.length) continue;
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      if (s.length === 1) ctx.lineTo(s[0].x + 0.1, s[0].y);
      for (let i = 1; i < s.length - 1; i++) {
        const mx = (s[i].x + s[i + 1].x) / 2;
        const my = (s[i].y + s[i + 1].y) / 2;
        ctx.quadraticCurveTo(s[i].x, s[i].y, mx, my);
      }
      if (s.length > 1) ctx.lineTo(s[s.length - 1].x, s[s.length - 1].y);
      ctx.stroke();
    }
  };

  useEffect(redraw);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PAD_W, y: ((e.clientY - r.top) / r.height) * PAD_H };
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        id="pdfb-signature-pad"
        width={PAD_W}
        height={PAD_H}
        role="img"
        aria-label="Signature drawing area. Draw with a mouse, pen or finger. To sign with the keyboard, switch to Type."
        className="block w-full cursor-crosshair touch-none rounded-lg bg-white shadow-[inset_0_0_0_1px_var(--line-strong)]"
        style={{ aspectRatio: `${PAD_W} / ${PAD_H}` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          active.current = e.pointerId;
          strokes.current.push([pos(e)]);
          redraw();
          onChange(false);
        }}
        onPointerMove={(e) => {
          if (active.current !== e.pointerId) return;
          strokes.current[strokes.current.length - 1].push(pos(e));
          redraw();
        }}
        onPointerUp={() => {
          active.current = null;
        }}
        onPointerCancel={() => {
          active.current = null;
        }}
      />
      <div className="flex gap-2">
        <Btn
          variant="ghost"
          icon="reset"
          onClick={() => {
            strokes.current.pop();
            redraw();
            onChange(strokes.current.length === 0);
          }}
        >
          Undo stroke
        </Btn>
        <Btn
          variant="subtle"
          icon="trash"
          onClick={() => {
            strokes.current = [];
            redraw();
            onChange(true);
          }}
        >
          Clear
        </Btn>
      </div>
    </div>
  );
}

function renderTyped(name: string, style: string, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 300;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const family =
    style === "script"
      ? `"Segoe Script", "Brush Script MT", "Snell Roundhand", "Lucida Handwriting", "Apple Chancery", cursive`
      : `${OVERLAY_FONT}, sans-serif`;
  let size = 150;
  ctx.font = `italic ${size}px ${family}`;
  while (ctx.measureText(name).width > c.width - 60 && size > 30) {
    size -= 6;
    ctx.font = `italic ${size}px ${family}`;
  }
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(name, 30, c.height / 2);
  return c;
}

export default function Tool() {
  const [method, setMethod] = useState<"draw" | "type">("draw");
  const [color, setColor] = useState("#1a2a6c");
  const [thickness, setThickness] = useState(6);
  const [padEmpty, setPadEmpty] = useState(true);
  const [name, setName] = useState("");
  const [style, setStyle] = useState("script");
  const [sig, setSig] = useState<{ id: string; data: StoredImage; url: string } | null>(null);
  const [sigWidth, setSigWidth] = useState(160);
  const [withDate, setWithDate] = useState(false);
  const [dateFormat, setDateFormat] = useState("iso");
  const [error, setError] = useState<string | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function capture() {
    setError(null);
    let src: HTMLCanvasElement | null = null;
    if (method === "draw") src = document.getElementById("pdfb-signature-pad") as HTMLCanvasElement | null;
    else if (name.trim()) src = renderTyped(name.trim(), style, color);
    const trimmed = src ? trimCanvas(src) : null;
    if (!trimmed) {
      setError(method === "draw" ? "Draw your signature first." : "Type your name first.");
      return;
    }
    const data = await canvasToStoredImage(trimmed);
    const url = URL.createObjectURL(data.blob);
    urls.current.push(url);
    setSig({ id: uid(), data: { bytes: data.bytes, type: "png", width: data.width, height: data.height }, url });
  }

  const images = new Map(sig ? [[sig.id, sig.data]] : []);
  const imageUrls = sig ? { [sig.id]: sig.url } : {};

  return (
    <ItemEditor
      suffix="signed"
      mode="point"
      addLabel="Place at page center"
      hint="Click where the signature should go. Drag it to adjust; resize with the corner handle or the size fields."
      blockedReason={sig ? null : "Create your signature in the panel on the right, then click the page to place it."}
      images={images}
      imageUrls={imageUrls}
      createItem={(g, geom) => {
        if (g.kind !== "point" || !sig) return null;
        const page = viewSize(geom);
        const w = Math.min(sigWidth, page.w * 0.8);
        const h = (w * sig.data.height) / sig.data.width;
        const img: ImageItem = { kind: "image", id: uid(), page: g.page, x: g.x - w / 2, y: g.y - h / 2, w, h, imageId: sig.id, label: "Signature" };
        if (!withDate) return img;
        const date: TextItem = {
          kind: "text",
          id: uid(),
          page: g.page,
          x: img.x,
          y: img.y + h + 2,
          text: formatDate(new Date(), dateFormat),
          size: 10,
          color: "#222222",
          bold: false,
        };
        return [img, date];
      }}
      settings={
        <section aria-label="Your signature" className="space-y-4">
          <Segmented
            label="Signature method"
            value={method}
            onChange={setMethod}
            options={[
              { value: "draw", label: "Draw" },
              { value: "type", label: "Type" },
            ]}
          />
          {method === "draw" ? (
            <>
              <SignaturePad color={color} thickness={thickness} onChange={setPadEmpty} />
              <RangeInput label="Pen thickness" min={2} max={16} value={thickness} onChange={setThickness} format={(v) => `${v} px`} />
            </>
          ) : (
            <>
              <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              <SelectField label="Style" value={style} onChange={(e) => setStyle(e.target.value)} options={SCRIPT_FONTS} hint="Uses a handwriting font already installed on your device; the look varies by system." />
            </>
          )}
          <ColorInput label="Ink color" value={color} onChange={setColor} />
          <Btn icon="check" onClick={capture} disabled={method === "draw" ? padEmpty : !name.trim()}>
            {sig ? "Update signature" : "Use this signature"}
          </Btn>
          {error && <Notice tone="error">{error}</Notice>}
          {sig && (
            <div className="rounded-lg bg-white p-2 shadow-[inset_0_0_0_1px_var(--line)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={sig.url} alt="Your current signature" className="mx-auto max-h-20" />
            </div>
          )}
          <RangeInput label="Signature width when placed" min={60} max={400} step={5} value={sigWidth} onChange={setSigWidth} format={(v) => `${v} pt`} />
          <Checkbox label="Add today's date under the signature" checked={withDate} onChange={setWithDate} />
          {withDate && <SelectField label="Date format" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} options={DATE_FORMATS} />}
        </section>
      }
      inspector={(it: Item, onChange) =>
        it.kind === "image" ? (
          <div className="grid grid-cols-2 gap-3">
            <NumInput key={`w${it.id}${it.w}`} label="Width" suffix="pt" value={it.w} min={10} max={2000} onCommit={(v) => onChange({ ...it, w: v, h: (v * it.h) / it.w })} />
            <NumInput key={`h${it.id}${it.h}`} label="Height" suffix="pt" value={it.h} min={4} max={2000} onCommit={(v) => onChange({ ...it, h: v, w: (v * it.w) / it.h })} />
          </div>
        ) : it.kind === "text" ? (
          <TextField label="Date text" value={it.text} onChange={(e) => onChange({ ...it, text: e.target.value })} />
        ) : null
      }
      doneMessage={() => "Your signature was added to the PDF."}
    />
  );
}
