"use client";

import { useState } from "react";
import { Checkbox } from "@/components/tools/kit";
import { RangeField } from "./shared";
import { Workbench, type RunOpts } from "./workbench";
import { blur, blurSync, pixelateRows, pointEffectRows, rowsPerChunk, runChunked, unsharpRows, type Img } from "./lib/filters";

type Fx = { blur: number; sharpen: number; pixelate: number; grayscale: number; sepia: number; invert: boolean; vignette: number; vignetteSize: number };
const NONE: Fx = { blur: 0, sharpen: 0, pixelate: 1, grayscale: 0, sepia: 0, invert: false, vignette: 0, vignetteSize: 50 };

const point = (s: Fx) => ({ grayscale: s.grayscale / 100, sepia: s.sepia / 100, invert: s.invert, vignette: s.vignette / 100, vignetteSize: s.vignetteSize / 100 });
const hasPoint = (s: Fx) => s.grayscale > 0 || s.sepia > 0 || s.invert || s.vignette > 0;

function preview(img: Img, scale: number, s: Fx) {
  let data = img.data;
  if (s.blur > 0) data = blurSync({ ...img, data }, Math.max(1, Math.round(s.blur * scale)));
  if (s.sharpen > 0) {
    const soft = blurSync({ ...img, data }, 1, 1);
    const out = new Uint8ClampedArray(data.length);
    unsharpRows(data, soft, out, img.width, s.sharpen, 0, img.height);
    data = out;
  }
  const res: Img = { ...img, data };
  if (s.pixelate > 1) {
    const n = Math.max(1, Math.round(s.pixelate * scale));
    pixelateRows(res, 0, Math.ceil(img.height / n), n);
  }
  if (hasPoint(s)) pointEffectRows(res, 0, img.height, point(s));
  return res;
}

async function full(img: Img, s: Fx, run: RunOpts) {
  // Split progress across the stages that are switched on.
  const stages = [s.blur > 0, s.sharpen > 0, s.pixelate > 1, hasPoint(s)].filter(Boolean).length || 1;
  let stage = 0;
  const prog = (p: number) => run.onProgress((stage + p) / stages);
  let data = img.data;
  const chunk = rowsPerChunk(img.width);
  if (s.blur > 0) {
    data = await blur({ ...img, data }, s.blur, { signal: run.signal, onProgress: prog });
    stage++;
  }
  if (s.sharpen > 0) {
    const soft = await blur({ ...img, data }, 1, { signal: run.signal }, 1);
    const out = new Uint8ClampedArray(data.length);
    const src = data;
    await runChunked(img.height, chunk, (y0, y1) => unsharpRows(src, soft, out, img.width, s.sharpen, y0, y1), { signal: run.signal, onProgress: prog });
    data = out;
    stage++;
  }
  const res: Img = { ...img, data };
  if (s.pixelate > 1) {
    const n = Math.round(s.pixelate);
    const blockRows = Math.ceil(img.height / n);
    await runChunked(blockRows, Math.max(1, Math.floor(chunk / n)), (a, b) => pixelateRows(res, a, b, n), { signal: run.signal, onProgress: prog });
    stage++;
  }
  if (hasPoint(s)) {
    const pe = point(s);
    await runChunked(img.height, chunk, (y0, y1) => pointEffectRows(res, y0, y1, pe), { signal: run.signal, onProgress: prog });
  }
  return res;
}

export default function Tool() {
  const [s, setS] = useState<Fx>(NONE);
  const set = (k: keyof Fx) => (v: number) => setS((p) => ({ ...p, [k]: v }));
  return (
    <Workbench
      title="Photo effects"
      settings={s}
      preview={preview}
      full={full}
      suffix="effects"
      onReset={() => setS(NONE)}
      controls={
        <div className="space-y-3">
          <RangeField label="Blur" value={s.blur} onChange={set("blur")} min={0} max={30} unit=" px" />
          <RangeField label="Sharpen" value={s.sharpen} onChange={set("sharpen")} min={0} max={3} step={0.1} format={(v) => (v ? `${v.toFixed(1)}×` : "Off")} />
          <RangeField label="Pixelate" value={s.pixelate} onChange={set("pixelate")} min={1} max={64} format={(v) => (v > 1 ? `${v} px blocks` : "Off")} />
          <RangeField label="Grayscale" value={s.grayscale} onChange={set("grayscale")} min={0} max={100} unit="%" />
          <RangeField label="Sepia" value={s.sepia} onChange={set("sepia")} min={0} max={100} unit="%" />
          <RangeField label="Vignette" value={s.vignette} onChange={set("vignette")} min={0} max={100} unit="%" />
          {s.vignette > 0 && <RangeField label="Vignette clear area" value={s.vignetteSize} onChange={set("vignetteSize")} min={0} max={90} unit="%" />}
          <Checkbox label="Negative (invert colors)" checked={s.invert} onChange={(v) => setS((p) => ({ ...p, invert: v }))} />
          <p className="text-[0.8125rem] text-muted">Effects apply in this order: blur, sharpen, pixelate, then color effects and vignette.</p>
        </div>
      }
    />
  );
}
