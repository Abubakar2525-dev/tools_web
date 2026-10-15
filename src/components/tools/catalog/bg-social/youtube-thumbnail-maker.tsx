"use client";

import { YT_THUMB_MAX_BYTES, YT_THUMB_SIZES } from "./lib/platforms";
import { CanvasEditor, type EditorConfig } from "./shared/CanvasEditor";
import { defaultBackground, textLayer, type Scene, type TextLayer } from "./shared/scene";

type Layout = "left" | "center" | "right";

function textOf(scene: Scene | undefined, name: string, fallback: string) {
  const L = scene?.layers.find((l): l is TextLayer => l.kind === "text" && l.name === name);
  return L ? L.text : fallback;
}

function build(size: { w: number; h: number }, layout: Layout, current?: Scene): Scene {
  const k = size.h / 720;
  const x = layout === "left" ? 0.05 : layout === "right" ? 0.95 : 0.5;
  const align = layout === "center" ? "center" : layout;
  const others = current?.layers.filter((l) => l.kind === "image" || (l.name !== "Headline" && l.name !== "Badge")) ?? [];
  return {
    bg: current?.bg ?? defaultBackground({ color: "#1e1b4b", color2: "#be123c", angle: 120 }),
    layers: [
      ...others,
      textLayer({
        name: "Headline",
        text: textOf(current, "Headline", "I tried it for 30 days"),
        x,
        y: layout === "center" ? 0.55 : 0.62,
        align,
        font: "condensed",
        size: Math.round(118 * k),
        weight: 900,
        upper: true,
        lineHeight: 1.02,
        maxWidth: layout === "center" ? 0.86 : 0.58,
        outline: Math.round(9 * k),
        outlineColor: "#000000",
        shadow: Math.round(22 * k),
        shadowColor: "#000000",
      }),
      textLayer({
        name: "Badge",
        text: textOf(current, "Badge", "New"),
        x: layout === "right" ? 0.95 : layout === "center" ? 0.5 : 0.05,
        y: 0.14,
        align,
        font: "sans",
        size: Math.round(46 * k),
        weight: 800,
        upper: true,
        badge: true,
        badgeColor: "#facc15",
        color: "#111827",
        badgePad: Math.round(22 * k),
        badgeRadius: Math.round(12 * k),
        maxWidth: 0.5,
      }),
    ],
  };
}

const config: EditorConfig = {
  slug: "youtube-thumbnail",
  title: "Thumbnail editor",
  sizes: YT_THUMB_SIZES,
  initial: (size) => build(size, "left"),
  templates: [
    { id: "left", label: "Text left", apply: (s, c) => build(s, "left", c) },
    { id: "right", label: "Text right", apply: (s, c) => build(s, "right", c) },
    { id: "center", label: "Centered", apply: (s, c) => build(s, "center", c) },
  ],
  quickAdds: [
    {
      label: "Add badge",
      icon: "spark",
      make: ({ h }) =>
        textLayer({
          name: "Badge",
          text: "Part 2",
          x: 0.8,
          y: 0.2,
          font: "sans",
          size: Math.round(h * 0.065),
          weight: 800,
          upper: true,
          badge: true,
          badgeColor: "#ef4444",
          badgePad: Math.round(h * 0.03),
          badgeRadius: Math.round(h * 0.017),
          maxWidth: 0.4,
        }),
    },
  ],
  formats: ["jpeg", "png"],
  defaultFormat: "jpeg",
  maxBytes: YT_THUMB_MAX_BYTES,
  maxBytesLabel: "2 MB",
  sizeNote: "YouTube accepts JPG, PNG or GIF. Keep the file under 2 MB for uploads from the mobile app.",
};

export default function Tool() {
  return <CanvasEditor config={config} />;
}
