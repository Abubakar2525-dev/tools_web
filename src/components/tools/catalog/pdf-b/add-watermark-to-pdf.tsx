"use client";

import { useState } from "react";
import { Checkbox, SelectField, TextField } from "@/components/tools/kit";
import { embedUnicodeFonts, getPdfLib } from "@/components/tools/engines/pdf";
import { ProcessTool } from "./process";
import { ColorInput, NumInput, RangeInput, rangeOrError } from "./shared";
import { loadForEdit } from "./lib/write";
import { stampWatermark } from "./lib/stamp";

export default function Tool() {
  const [text, setText] = useState("CONFIDENTIAL");
  const [size, setSize] = useState(60);
  const [color, setColor] = useState("#c0392b");
  const [opacity, setOpacity] = useState(0.25);
  const [angleMode, setAngleMode] = useState<"diagonal" | "horizontal" | "custom">("diagonal");
  const [angle, setAngle] = useState(30);
  const [tile, setTile] = useState(false);
  const [bold, setBold] = useState(true);
  const [pages, setPages] = useState("");

  const key = JSON.stringify({ text, size, color, opacity, angleMode, angle, tile, bold, pages });

  return (
    <ProcessTool
      suffix="watermarked"
      actionLabel="Add watermark"
      doneMessage="Watermark added."
      settingsKey={key}
      validate={({ numPages }) => {
        if (!text.trim()) return "Type the watermark text.";
        const r = rangeOrError(pages, numPages);
        return r.error;
      }}
      process={async (source, { numPages }) => {
        const L = await getPdfLib();
        const doc = await loadForEdit(L, source.bytes);
        const fonts = await embedUnicodeFonts(doc);
        const r = rangeOrError(pages, numPages);
        if (!r.pages) throw new Error(r.error);
        stampWatermark(
          L,
          doc,
          r.pages.map((p) => p - 1),
          { text: text.trim(), size, color, opacity, angleMode, angle, tile, fit: true, font: bold ? fonts.bold : fonts.regular },
        );
        return doc.save();
      }}
      settings={() => (
        <section aria-label="Watermark settings" className="space-y-4">
          <TextField label="Watermark text" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <NumInput key={`s${size}`} label="Font size" suffix="pt" value={size} min={6} max={400} onCommit={setSize} />
            <ColorInput label="Color" value={color} onChange={setColor} />
          </div>
          <Checkbox label="Bold" checked={bold} onChange={setBold} />
          <RangeInput label="Opacity" min={0.05} max={1} step={0.05} value={opacity} onChange={setOpacity} format={(v) => `${Math.round(v * 100)}%`} />
          <SelectField
            label="Angle"
            value={angleMode}
            onChange={(e) => setAngleMode(e.target.value as typeof angleMode)}
            options={[
              { value: "diagonal", label: "Diagonal (corner to corner)" },
              { value: "horizontal", label: "Horizontal" },
              { value: "custom", label: "Custom angle" },
            ]}
          />
          {angleMode === "custom" && (
            <RangeInput label="Custom angle" min={-90} max={90} value={angle} onChange={setAngle} format={(v) => `${v}° counter-clockwise`} />
          )}
          <Checkbox label="Repeat across the page" checked={tile} onChange={setTile} hint="Tiles the text in a staggered grid instead of one centered line." />
          <TextField label="Pages" optional placeholder="All pages" hint="Examples: 1-3, 5, 8-" value={pages} onChange={(e) => setPages(e.target.value)} />
        </section>
      )}
    />
  );
}
