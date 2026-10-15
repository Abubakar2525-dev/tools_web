"use client";

import { useState } from "react";
import { Segmented } from "@/components/tools/kit";
import { RangeField } from "./shared";
import { Workbench, type RunOpts } from "./workbench";
import { blur, blurSync, medianRows, rowsPerChunk, runChunked, type Img } from "./lib/filters";

type Mode = "median" | "speck" | "smooth";
type S = { mode: Mode; radius: number; threshold: number };
const DEFAULT: S = { mode: "median", radius: 1, threshold: 40 };

const thresholdOf = (s: S) => (s.mode === "speck" ? s.threshold : 0);

function preview(img: Img, _scale: number, s: S) {
  if (s.mode === "smooth") return { ...img, data: blurSync(img, s.radius) };
  const out = new Uint8ClampedArray(img.data.length);
  medianRows(img.data, out, img.width, img.height, s.radius, thresholdOf(s), 0, img.height);
  return { ...img, data: out };
}

async function full(img: Img, s: S, run: RunOpts) {
  if (s.mode === "smooth") return { ...img, data: await blur(img, s.radius, run) };
  const out = new Uint8ClampedArray(img.data.length);
  // Median cost grows with the window, so use smaller chunks for bigger radii.
  const chunk = Math.max(1, Math.floor(rowsPerChunk(img.width, 250_000) / s.radius));
  await runChunked(img.height, chunk, (y0, y1) => medianRows(img.data, out, img.width, img.height, s.radius, thresholdOf(s), y0, y1), run);
  return { ...img, data: out };
}

const HELP: Record<Mode, string> = {
  median: "Replaces each pixel with the middle value of its neighbors. Removes grain and salt-and-pepper noise while keeping edges fairly sharp.",
  speck: "Only replaces pixels that differ strongly from their neighbors, so dust and isolated dots on scans disappear while text and lines stay intact.",
  smooth: "Averages neighbors (close to a Gaussian blur). Softens fine grain evenly but also softens edges.",
};

export default function Tool() {
  const [s, setS] = useState<S>(DEFAULT);
  return (
    <Workbench
      title="Reduce image noise"
      settings={s}
      preview={preview}
      full={full}
      suffix="denoised"
      previewMode="crop"
      onReset={() => setS(DEFAULT)}
      controls={
        <div className="space-y-4">
          <Segmented
            label="Method"
            value={s.mode}
            onChange={(mode) => setS((p) => ({ ...p, mode, radius: mode === "smooth" ? Math.max(p.radius, 1) : Math.min(p.radius, 3) }))}
            options={[
              { value: "median", label: "Median" },
              { value: "speck", label: "Speck removal" },
              { value: "smooth", label: "Smooth" },
            ]}
          />
          <p className="text-sm text-ink-2">{HELP[s.mode]}</p>
          <RangeField
            label="Strength (radius)"
            value={s.radius}
            onChange={(v) => setS((p) => ({ ...p, radius: v }))}
            min={1}
            max={s.mode === "smooth" ? 6 : 3}
            format={(v) => `${v} px (${2 * v + 1}×${2 * v + 1} window)`}
          />
          {s.mode === "speck" && (
            <RangeField
              label="Sensitivity threshold"
              value={s.threshold}
              onChange={(v) => setS((p) => ({ ...p, threshold: v }))}
              min={5}
              max={150}
              hint="Lower values remove fainter specks but may touch fine detail."
            />
          )}
        </div>
      }
    />
  );
}
