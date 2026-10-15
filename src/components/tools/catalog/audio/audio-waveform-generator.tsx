"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Btn, Checkbox, Notice, NumberField, PrivacyNote, SelectField, ToolPanel, downloadFile, parseNum } from "@/components/tools/kit";
import { baseName, canvasToBlob, downloadBlob } from "@/components/tools/engines/files";
import { waveShape, waveSvg, type WaveShape, type WaveStyle } from "./lib/waveform";
import { AudioFileInput, useAudioFile } from "./shared/useAudioFile";

function drawShape(canvas: HTMLCanvasElement, shape: WaveShape, s: WaveStyle) {
  canvas.width = s.width;
  canvas.height = s.height;
  const g = canvas.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, s.width, s.height);
  if (s.background) {
    g.fillStyle = s.background;
    g.fillRect(0, 0, s.width, s.height);
  }
  g.fillStyle = s.color;
  g.strokeStyle = s.color;
  if (shape.kind === "bars") {
    for (const b of shape.bars) {
      const r = Math.min(s.barRadius, b.w / 2, b.h / 2);
      g.beginPath();
      if (r > 0 && typeof g.roundRect === "function") g.roundRect(b.x, b.y, b.w, b.h, r);
      else g.rect(b.x, b.y, b.w, b.h);
      g.fill();
    }
  } else {
    const p = new Path2D(shape.d);
    if (shape.fill) g.fill(p);
    else {
      g.lineWidth = 1.5;
      g.lineJoin = "round";
      g.stroke(p);
    }
  }
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-3">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg bg-surface p-1 shadow-[inset_0_0_0_1px_var(--line-strong)]" />
        <span className="font-mono text-sm text-ink-2">{value}</span>
      </div>
    </div>
  );
}

export default function Tool() {
  const src = useAudioFile();
  const audio = src.audio;
  const [style, setStyle] = useState<WaveStyle["style"]>("bars");
  const [w, setW] = useState("1200");
  const [h, setH] = useState("240");
  const [bw, setBw] = useState("4");
  const [gap, setGap] = useState("2");
  const [radius, setRadius] = useState("2");
  const [color, setColor] = useState("#1f8a74");
  const [bg, setBg] = useState("#ffffff");
  const [transparent, setTransparent] = useState(true);
  const [normalize, setNormalize] = useState(true);
  const [measure, setMeasure] = useState<WaveStyle["measure"]>("peak");
  const [err, setErr] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const wN = parseNum(w);
  const hN = parseNum(h);
  const bwN = parseNum(bw);
  const gapN = parseNum(gap);
  const rN = parseNum(radius);
  const wErr = wN === null || !Number.isInteger(wN) || wN < 50 || wN > 6000 ? "50 to 6000 px." : null;
  const hErr = hN === null || !Number.isInteger(hN) || hN < 20 || hN > 3000 ? "20 to 3000 px." : null;
  const bwErr = bwN === null || bwN < 1 || bwN > 100 ? "1 to 100 px." : null;
  const gapErr = gapN === null || gapN < 0 || gapN > 100 ? "0 to 100 px." : null;
  const rErr = rN === null || rN < 0 || rN > 50 ? "0 to 50 px." : null;
  const valid = !wErr && !hErr && (style !== "bars" || (!bwErr && !gapErr && !rErr));

  const settings = useMemo<WaveStyle | null>(
    () =>
      valid
        ? {
            width: wN as number,
            height: hN as number,
            style,
            barWidth: bwN ?? 4,
            barGap: gapN ?? 2,
            barRadius: rN ?? 0,
            color,
            background: transparent ? null : bg,
            normalize,
            measure,
          }
        : null,
    [valid, wN, hN, style, bwN, gapN, rN, color, transparent, bg, normalize, measure],
  );
  const shape = useMemo(() => (audio && settings ? waveShape(audio.pcm.channels, settings) : null), [audio, settings]);

  useEffect(() => {
    if (canvas.current && shape && settings) drawShape(canvas.current, shape, settings);
  }, [shape, settings]);

  const name = audio ? baseName(audio.file.name) : "waveform";
  const title = audio ? `Waveform of ${audio.file.name}` : "Waveform";

  const png = async () => {
    setErr(null);
    if (!canvas.current) return;
    try {
      downloadBlob(await canvasToBlob(canvas.current, "image/png"), `${name}-waveform.png`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not export PNG.");
    }
  };
  const svg = () => {
    if (shape && settings) downloadFile(`${name}-waveform.svg`, waveSvg(shape, settings, title), "image/svg+xml");
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Audio waveform generator">
        <AudioFileInput state={src.state} onFile={src.load} onClear={src.clear} />
        {audio && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="Style"
              value={style}
              onChange={(e) => setStyle(e.target.value as WaveStyle["style"])}
              options={[
                { value: "bars", label: "Bars" },
                { value: "mirror-line", label: "Filled envelope" },
                { value: "line", label: "Line" },
              ]}
            />
            <NumberField label="Width (px)" value={w} onChange={(e) => setW(e.target.value)} error={wErr} />
            <NumberField label="Height (px)" value={h} onChange={(e) => setH(e.target.value)} error={hErr} />
            {style === "bars" && (
              <>
                <NumberField label="Bar width (px)" value={bw} onChange={(e) => setBw(e.target.value)} error={bwErr} />
                <NumberField label="Bar gap (px)" value={gap} onChange={(e) => setGap(e.target.value)} error={gapErr} />
                <NumberField label="Corner radius (px)" value={radius} onChange={(e) => setRadius(e.target.value)} error={rErr} />
                <SelectField
                  label="Bar height from"
                  value={measure}
                  onChange={(e) => setMeasure(e.target.value as WaveStyle["measure"])}
                  options={[
                    { value: "peak", label: "Peak level" },
                    { value: "rms", label: "RMS (smoother)" },
                  ]}
                />
              </>
            )}
            <ColorField label="Wave color" value={color} onChange={setColor} />
            <div className="space-y-3">
              <Checkbox label="Transparent background" checked={transparent} onChange={setTransparent} />
              {!transparent && <ColorField label="Background color" value={bg} onChange={setBg} />}
            </div>
            <Checkbox label="Normalize height" hint="Scale so the loudest part fills the image." checked={normalize} onChange={setNormalize} />
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
      {audio && shape && settings && (
        <ToolPanel title="Preview">
          <div className="overflow-auto rounded-lg bg-[repeating-conic-gradient(var(--bg-sunken)_0%_25%,var(--surface)_0%_50%)] bg-[length:16px_16px] p-2">
            <canvas ref={canvas} role="img" aria-label={`${title}, ${settings.style} style, ${settings.width} by ${settings.height} pixels`} className="block h-auto max-w-full" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn icon="download" onClick={png}>
              Download PNG
            </Btn>
            <Btn variant="ghost" icon="download" onClick={svg}>
              Download SVG
            </Btn>
          </div>
          {err && (
            <div className="mt-3">
              <Notice tone="error">{err}</Notice>
            </div>
          )}
        </ToolPanel>
      )}
    </div>
  );
}
