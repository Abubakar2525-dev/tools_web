"use client";

import { useState } from "react";
import { RangeField } from "./shared";
import { Workbench, type RunOpts } from "./workbench";
import { NEUTRAL_ADJUSTMENTS, adjustRows, prepareAdjustments, rowsPerChunk, runChunked, type Adjustments, type Img } from "./lib/filters";

function preview(img: Img, _scale: number, s: Adjustments) {
  adjustRows(img, 0, img.height, prepareAdjustments(s));
  return img;
}

async function full(img: Img, s: Adjustments, run: RunOpts) {
  const pa = prepareAdjustments(s);
  await runChunked(img.height, rowsPerChunk(img.width), (y0, y1) => adjustRows(img, y0, y1, pa), run);
  return img;
}

const signed = (v: number) => (v > 0 ? `+${v}` : String(v));

export default function Tool() {
  const [s, setS] = useState<Adjustments>(NEUTRAL_ADJUSTMENTS);
  const set = (k: keyof Adjustments) => (v: number) => setS((p) => ({ ...p, [k]: v }));
  return (
    <Workbench
      title="Adjust a photo"
      settings={s}
      preview={preview}
      full={full}
      suffix="adjusted"
      onReset={() => setS(NEUTRAL_ADJUSTMENTS)}
      controls={
        <div className="space-y-3">
          <RangeField label="Exposure" value={s.exposure} onChange={set("exposure")} min={-2} max={2} step={0.05} format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)} EV`} />
          <RangeField label="Brightness" value={s.brightness} onChange={set("brightness")} min={-100} max={100} format={signed} />
          <RangeField label="Contrast" value={s.contrast} onChange={set("contrast")} min={-100} max={100} format={signed} />
          <RangeField label="Saturation" value={s.saturation} onChange={set("saturation")} min={-100} max={100} format={signed} />
          <RangeField label="Hue" value={s.hue} onChange={set("hue")} min={-180} max={180} format={(v) => `${signed(v)}°`} />
          <RangeField label="Temperature" value={s.temperature} onChange={set("temperature")} min={-100} max={100} format={(v) => (v === 0 ? "0" : v > 0 ? `+${v} warmer` : `${v} cooler`)} />
          <RangeField label="Tint" value={s.tint} onChange={set("tint")} min={-100} max={100} format={(v) => (v === 0 ? "0" : v > 0 ? `+${v} magenta` : `${v} green`)} />
        </div>
      }
    />
  );
}
