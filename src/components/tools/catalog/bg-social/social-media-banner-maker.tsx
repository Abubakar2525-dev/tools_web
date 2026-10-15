"use client";

import { BANNER_PRESETS } from "./lib/platforms";
import { CanvasEditor, type EditorConfig } from "./shared/CanvasEditor";
import { defaultBackground, textLayer, type Scene } from "./shared/scene";

function headline(size: { w: number; h: number }, align: "left" | "center", current?: Scene): Scene {
  const titleSize = Math.round(Math.min(size.h * 0.13, size.w * 0.05));
  const subSize = Math.round(titleSize * 0.42);
  const x = align === "left" ? 0.36 : 0.5;
  const prevTitle = current?.layers.find((l) => l.kind === "text" && l.name === "Title");
  const prevSub = current?.layers.find((l) => l.kind === "text" && l.name === "Subtitle");
  const keep = current?.layers.filter((l) => l.kind === "image") ?? [];
  return {
    bg: current?.bg ?? defaultBackground({ color: "#0f172a", color2: "#0e7490", angle: 115 }),
    layers: [
      ...keep,
      textLayer({
        name: "Title",
        text: prevTitle?.kind === "text" ? prevTitle.text : "Your name or brand",
        x,
        y: 0.5 - (subSize * 0.9) / size.h,
        align,
        size: titleSize,
        weight: 800,
        maxWidth: align === "left" ? 0.58 : 0.6,
        shadow: Math.round(titleSize * 0.12),
        shadowColor: "#000000",
      }),
      textLayer({
        name: "Subtitle",
        text: prevSub?.kind === "text" ? prevSub.text : "What you do, in one line",
        x,
        y: 0.5 + (titleSize * 0.62) / size.h,
        align,
        font: "sans",
        size: subSize,
        weight: 500,
        color: "#e2e8f0",
        maxWidth: align === "left" ? 0.58 : 0.6,
      }),
    ],
  };
}

const config: EditorConfig = {
  slug: "banner",
  title: "Banner editor",
  sizes: BANNER_PRESETS,
  customSize: true,
  initial: (size) => headline(size, "center"),
  templates: [
    { id: "center", label: "Centered", apply: (size, cur) => headline(size, "center", cur) },
    { id: "left", label: "Right of photo", apply: (size, cur) => headline(size, "left", cur) },
  ],
  formats: ["png", "jpeg", "webp"],
  defaultFormat: "png",
};

export default function Tool() {
  return <CanvasEditor config={config} />;
}
