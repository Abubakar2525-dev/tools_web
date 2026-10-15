"use client";

import { CopyBtn, OutputBlock } from "@/components/tools/kit";
import { OG_SIZES } from "./lib/platforms";
import { CanvasEditor, type EditorConfig } from "./shared/CanvasEditor";
import { defaultBackground, textLayer, type Background, type Scene, type TextLayer } from "./shared/scene";

type Template = "classic" | "centered" | "light" | "split";

function textOf(scene: Scene | undefined, name: string, fallback: string) {
  const L = scene?.layers.find((l): l is TextLayer => l.kind === "text" && l.name === name);
  return L ? L.text : fallback;
}

const BG: Record<Template, Partial<Background>> = {
  classic: { mode: "gradient", color: "#0b1020", color2: "#1d4ed8", angle: 135 },
  centered: { mode: "gradient", color: "#111827", color2: "#7c3aed", angle: 160 },
  light: { mode: "color", color: "#f8fafc", color2: "#e2e8f0", angle: 90 },
  split: { mode: "gradient", color: "#052e16", color2: "#0f766e", angle: 90 },
};

function build(size: { w: number; h: number }, t: Template, current?: Scene): Scene {
  const k = size.w / 1200;
  const dark = t !== "light";
  const ink = dark ? "#ffffff" : "#0f172a";
  const sub = dark ? "#cbd5e1" : "#475569";
  const centered = t === "centered";
  const x = centered ? 0.5 : 0.075;
  const align = centered ? "center" : "left";
  const maxWidth = t === "split" ? 0.55 : centered ? 0.84 : 0.8;
  const images = current?.layers.filter((l) => l.kind === "image") ?? [];
  const bg = current?.bg.mode === "image" ? current.bg : defaultBackground(BG[t]);
  return {
    bg,
    layers: [
      ...images,
      textLayer({
        name: "Site",
        text: textOf(current, "Site", "example.com"),
        x,
        y: centered ? 0.2 : 0.14,
        align,
        font: "sans",
        size: Math.round(28 * k),
        weight: 600,
        color: dark ? "#93c5fd" : "#2563eb",
        maxWidth,
      }),
      textLayer({
        name: "Title",
        text: textOf(current, "Title", "How we cut page load time in half"),
        x,
        y: centered ? 0.47 : 0.45,
        align,
        font: "display",
        size: Math.round(64 * k),
        weight: 800,
        color: ink,
        lineHeight: 1.08,
        maxWidth,
      }),
      textLayer({
        name: "Subtitle",
        text: textOf(current, "Subtitle", "A practical guide to caching, images and fonts"),
        x,
        y: centered ? 0.74 : 0.78,
        align,
        font: "sans",
        size: Math.round(30 * k),
        weight: 400,
        color: sub,
        lineHeight: 1.3,
        maxWidth,
      }),
    ],
  };
}

const config: EditorConfig = {
  slug: "og-image",
  title: "Open Graph image editor",
  sizes: OG_SIZES,
  initial: (size) => build(size, "classic"),
  templates: [
    { id: "classic", label: "Classic", apply: (s, c) => build(s, "classic", c) },
    { id: "centered", label: "Centered", apply: (s, c) => build(s, "centered", c) },
    { id: "light", label: "Light", apply: (s, c) => build(s, "light", c) },
    { id: "split", label: "Room for a logo", apply: (s, c) => build(s, "split", c) },
  ],
  formats: ["png", "jpeg"],
  defaultFormat: "png",
  extra: ({ w, h }) => {
    const snippet = `<meta property="og:image" content="https://example.com/og-image.png" />
<meta property="og:image:width" content="${w}" />
<meta property="og:image:height" content="${h}" />
<meta property="og:image:alt" content="Describe the image" />
<meta name="twitter:card" content="summary_large_image" />`;
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Meta tags for your page</p>
        <p className="text-[0.8125rem] text-muted">Upload the image, then replace the URL with its absolute https address.</p>
        <OutputBlock label="Open Graph meta tags">
          <code>{snippet}</code>
        </OutputBlock>
        <CopyBtn text={snippet} label="Copy tags" />
      </div>
    );
  },
  sizeNote: "Most platforms read og:image at 1200×630 and show it cropped or scaled; keep text away from the edges.",
};

export default function Tool() {
  return <CanvasEditor config={config} />;
}
