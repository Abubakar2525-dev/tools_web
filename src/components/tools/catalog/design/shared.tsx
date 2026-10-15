"use client";

/** Shared UI pieces for the design batch. */

import { useId, useState } from "react";
import { Btn, CopyBtn, OutputBlock, downloadFile, inputCls } from "@/components/tools/kit";
import { FORMATS, formatHex, parseColor, readableOn, type Color, type FormatId } from "./lib/color";
import { FONT, type Scene, type SceneItem } from "./lib/scene";

/* ------------------------------------------------------------------ */
/* Color input: native picker + free text                              */
/* ------------------------------------------------------------------ */

export function ColorInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  const parsed = parseColor(text);
  const invalid = draft !== null && !parsed;
  const hex = formatHex({ ...(parseColor(value) ?? { r: 0, g: 0, b: 0, alpha: 1 }), alpha: 1 });
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[0.8125rem] text-muted">
          {hint}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <input
          type="color"
          aria-label={`${label}: color picker`}
          value={hex}
          onChange={(e) => {
            setDraft(null);
            onChange(e.target.value);
          }}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border-0 bg-surface p-1 shadow-[inset_0_0_0_1px_var(--line-strong)]"
        />
        <input
          id={id}
          value={text}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={[hint ? `${id}-hint` : "", invalid ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            if (parseColor(v)) onChange(v.trim());
          }}
          onBlur={() => {
            if (draft !== null && parseColor(draft)) setDraft(null);
          }}
          className={`${inputCls} h-11 min-w-0 font-mono text-[0.9rem]`}
        />
      </div>
      {invalid && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-danger">
          Not a color we recognize. Try #1e90ff, rgb(30 144 255) or oklch(65% 0.18 250).
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider with number box                                              */
/* ------------------------------------------------------------------ */

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
  className = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  className?: string;
}) {
  const id = useId();
  const clampV = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            aria-label={`${label} value${unit ? ` in ${unit}` : ""}`}
            value={Number.isFinite(value) ? value : 0}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (e.target.value !== "" && Number.isFinite(v)) onChange(clampV(v));
            }}
            className={`${inputCls} h-10 w-[5.5rem] px-2 text-right text-sm tabular-nums`}
          />
          {unit && <span className="w-6 text-xs text-muted">{unit}</span>}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-10 w-full cursor-pointer accent-[var(--accent)]"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Code output                                                         */
/* ------------------------------------------------------------------ */

export function CodeOutput({
  code,
  label = "Code",
  filename,
  mime = "text/css",
}: {
  code: string;
  label?: string;
  filename?: string;
  mime?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{label}</p>
        <div className="flex flex-wrap gap-2">
          <CopyBtn text={code} label="Copy code" />
          {filename && (
            <Btn variant="ghost" icon="download" onClick={() => downloadFile(filename, code, mime)}>
              Download
            </Btn>
          )}
        </div>
      </div>
      <OutputBlock label={label}>
        <code>{code}</code>
      </OutputBlock>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Every format, each with a copy button                               */
/* ------------------------------------------------------------------ */

export function FormatTable({ color, only }: { color: Color; only?: FormatId[] }) {
  const rows = only ? FORMATS.filter((f) => only.includes(f.id)) : FORMATS;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
      {rows.map((f) => {
        const v = f.fn(color);
        return (
          <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-3 py-2">
            <span className="w-28 shrink-0 text-[0.8125rem] text-muted">{f.label}</span>
            <code className="min-w-0 flex-1 break-all font-mono text-[0.875rem] text-ink">{v}</code>
            <CopyBtn text={v} label="Copy" />
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Swatch                                                              */
/* ------------------------------------------------------------------ */

export function textOn(c: Color) {
  return formatHex(readableOn(c));
}

/** Checkerboard background for previews of translucent colors. */
export const checker =
  "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 16px 16px";

/* ------------------------------------------------------------------ */
/* Scene renderer                                                      */
/* ------------------------------------------------------------------ */

export function SceneItemView({ it }: { it: SceneItem }) {
  switch (it.kind) {
    case "rect":
      return <rect x={it.x} y={it.y} width={it.w} height={it.h} rx={it.rx} fill={it.fill} stroke={it.stroke} strokeWidth={it.strokeWidth} strokeDasharray={it.dash} />;
    case "circle":
      return <circle cx={it.cx} cy={it.cy} r={it.r} fill={it.fill} stroke={it.stroke} strokeWidth={it.strokeWidth} />;
    case "line":
      return <line x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke={it.stroke} strokeWidth={it.strokeWidth} strokeDasharray={it.dash} strokeLinecap="round" />;
    case "path":
      return <path d={it.d} fill={it.fill} stroke={it.stroke} strokeWidth={it.strokeWidth} strokeDasharray={it.dash} strokeLinecap="round" strokeLinejoin="round" />;
    case "polygon":
      return <polygon points={it.points.map((p) => p.join(",")).join(" ")} fill={it.fill} stroke={it.stroke} strokeWidth={it.strokeWidth} strokeLinejoin="round" />;
    case "text": {
      const lh = it.lineHeight ?? it.size * 1.3;
      return (
        <text fontFamily={FONT} fontSize={it.size} fontWeight={it.weight} fontStyle={it.italic ? "italic" : undefined} fill={it.fill} textAnchor={it.anchor ?? "start"}>
          {it.lines.map((l, i) => (
            <tspan key={i} x={it.x} y={it.y + i * lh}>
              {l}
            </tspan>
          ))}
        </text>
      );
    }
  }
}

/** Renders a scene at natural size inside a scrollable box. Children render on top (interaction layer). */
export function SceneSvg({
  scene,
  children,
  svgRef,
  onPointerMove,
  onPointerUp,
  onPointerDown,
  maxHeight = 640,
  fit = false,
  draggable = false,
}: {
  scene: Scene;
  children?: React.ReactNode;
  svgRef?: React.Ref<SVGSVGElement>;
  onPointerMove?: React.PointerEventHandler<SVGSVGElement>;
  onPointerUp?: React.PointerEventHandler<SVGSVGElement>;
  onPointerDown?: React.PointerEventHandler<SVGSVGElement>;
  maxHeight?: number;
  fit?: boolean;
  /** Disables touch scrolling over the drawing so pointer drags work on touch screens. */
  draggable?: boolean;
}) {
  const titleId = useId();
  const descId = useId();
  return (
    <div className="overflow-auto rounded-xl bg-sunken shadow-[0_0_0_1px_var(--line)]" style={{ maxHeight }}>
      <svg
        ref={svgRef}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        width={fit ? "100%" : scene.width}
        height={fit ? undefined : scene.height}
        viewBox={`0 0 ${scene.width} ${scene.height}`}
        style={fit ? { maxWidth: scene.width, display: "block", margin: "0 auto" } : { display: "block", touchAction: draggable ? "none" : undefined }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerCancel={onPointerUp}
      >
        <title id={titleId}>{scene.title}</title>
        <desc id={descId}>{scene.desc}</desc>
        <rect width={scene.width} height={scene.height} fill={scene.background} />
        {scene.items.map((it, i) => (
          <SceneItemView key={i} it={it} />
        ))}
        {children}
      </svg>
    </div>
  );
}

/** Slug-safe file base name. */
export function fileBase(s: string, fallback: string) {
  const v = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return v || fallback;
}
