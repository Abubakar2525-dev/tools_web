"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Notice, PrivacyNote, Segmented, SelectField, ToolPanel } from "@/components/tools/kit";
import { baseName, canvasToBlob, downloadBlob } from "@/components/tools/engines/files";
import { durationOf, formatTime, mixToMono, type Pcm } from "./lib/pcm";
import { colorLut, dbToIndex, formatHz, frameSpectrumDb, freqTicks, freqToY, hannWindow, yToFreq, type ColorMapName } from "./lib/fft";
import { AudioFileInput, useAudioFile } from "./shared/useAudioFile";
import { JobProgress, useJob } from "./shared/Export";

type Scale = "linear" | "log";
const GUTTER = 56;
const BOTTOM = 22;
const PLOT_H = 360;
const MIN_HZ = 20;

const MAPS: { value: ColorMapName; label: string }[] = [
  { value: "magma", label: "Magma" },
  { value: "viridis", label: "Viridis" },
  { value: "inferno", label: "Inferno" },
  { value: "heat", label: "Heat" },
  { value: "grayscale", label: "Grayscale" },
];

function drawFreqAxis(g: CanvasRenderingContext2D, scale: Scale, maxHz: number) {
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, GUTTER, PLOT_H + BOTTOM);
  g.fillStyle = "#333";
  g.font = "11px ui-sans-serif, system-ui, sans-serif";
  g.textAlign = "right";
  g.textBaseline = "middle";
  for (const f of freqTicks(scale, maxHz)) {
    const y = PLOT_H - freqToY(f, scale, maxHz, MIN_HZ) * PLOT_H;
    if (y < 6 || y > PLOT_H - 2) continue;
    g.fillRect(GUTTER - 5, Math.round(y), 5, 1);
    g.fillText(formatHz(f), GUTTER - 7, y);
  }
}

/** Row → frequency-bin lookup for the current axis. */
function rowBins(rows: number, scale: Scale, maxHz: number, binHz: number, bins: number) {
  const lo = new Int32Array(rows);
  const hi = new Int32Array(rows);
  for (let r = 0; r < rows; r++) {
    const yTop = 1 - r / rows;
    const yBot = 1 - (r + 1) / rows;
    const f1 = yToFreq(yBot, scale, maxHz, MIN_HZ);
    const f2 = yToFreq(yTop, scale, maxHz, MIN_HZ);
    const b1 = Math.max(0, Math.min(bins - 1, Math.floor(f1 / binHz)));
    const b2 = Math.max(b1, Math.min(bins - 1, Math.ceil(f2 / binHz)));
    lo[r] = b1;
    hi[r] = b2;
  }
  return { lo, hi };
}

async function renderFile(
  canvas: HTMLCanvasElement,
  pcm: Pcm,
  opts: { size: number; map: ColorMapName; scale: Scale; floor: number },
  signal: AbortSignal,
  onProgress: (p: number) => void,
) {
  const mono = mixToMono(pcm);
  const dur = durationOf(pcm);
  const cols = Math.max(200, Math.min(1600, Math.round(dur * 100)));
  const width = GUTTER + cols;
  canvas.width = width;
  canvas.height = PLOT_H + BOTTOM;
  const g = canvas.getContext("2d");
  if (!g) return;
  const lut = colorLut(opts.map);
  const win = hannWindow(opts.size);
  const maxHz = pcm.sampleRate / 2;
  const bins = opts.size / 2 + 1;
  const { lo, hi } = rowBins(PLOT_H, opts.scale, maxHz, pcm.sampleRate / opts.size, bins);
  const img = g.createImageData(cols, PLOT_H);
  const spec = new Float32Array(bins);
  const hop = mono.length / cols;
  for (let x = 0; x < cols; x++) {
    if (x % 64 === 0) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      onProgress(x / cols);
      await new Promise((r) => setTimeout(r, 0));
    }
    const centre = Math.round(x * hop + hop / 2);
    frameSpectrumDb(mono, centre - opts.size / 2, opts.size, win, spec);
    for (let r = 0; r < PLOT_H; r++) {
      let m = -240;
      for (let b = lo[r]; b <= hi[r]; b++) if (spec[b] > m) m = spec[b];
      const ci = dbToIndex(m, opts.floor) * 3;
      const p = (r * cols + x) * 4;
      img.data[p] = lut[ci];
      img.data[p + 1] = lut[ci + 1];
      img.data[p + 2] = lut[ci + 2];
      img.data[p + 3] = 255;
    }
  }
  g.putImageData(img, GUTTER, 0);
  drawFreqAxis(g, opts.scale, maxHz);
  // Time axis
  g.fillStyle = "#ffffff";
  g.fillRect(GUTTER, PLOT_H, cols, BOTTOM);
  g.fillStyle = "#333";
  g.textAlign = "left";
  g.textBaseline = "top";
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
  const step = steps.find((s) => (s / dur) * cols >= 80) ?? 3600;
  for (let t = 0; t <= dur; t += step) {
    const x = GUTTER + (t / dur) * cols;
    g.fillRect(Math.round(x), PLOT_H, 1, 4);
    if (x < width - 40) g.fillText(formatTime(t, step < 1 ? 1 : 0), x + 2, PLOT_H + 5);
  }
  onProgress(1);
}

export default function Tool() {
  const [source, setSource] = useState<"file" | "mic">("file");
  const [size, setSize] = useState("2048");
  const [map, setMap] = useState<ColorMapName>("magma");
  const [scale, setScale] = useState<Scale>("log");
  const [floor, setFloor] = useState("-100");
  const src = useAudioFile();
  const audio = src.audio;
  const job = useJob<{ label: string }>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState<"off" | "starting" | "on" | "paused" | "stopped">("off");
  const [micError, setMicError] = useState<string | null>(null);
  const liveRef = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number | null } | null>(null);
  const pausedRef = useRef(false);

  const stopLive = () => {
    const l = liveRef.current;
    liveRef.current = null;
    if (l) {
      if (l.raf !== null) cancelAnimationFrame(l.raf);
      l.stream.getTracks().forEach((t) => t.stop());
      l.ctx.close().catch(() => undefined);
    }
  };
  useEffect(() => stopLive, []);

  const opts = { size: Number(size), map, scale, floor: Number(floor) };

  const renderNow = () => {
    if (!audio || !canvas.current) return;
    const c = canvas.current;
    const o = opts;
    job.run(async ({ signal, onProgress }) => {
      await renderFile(c, audio.pcm, o, signal, onProgress);
      return { label: `Spectrogram of ${audio.file.name}, ${formatTime(durationOf(audio.pcm), 1)} long, ${o.scale} frequency axis up to ${formatHz(audio.pcm.sampleRate / 2)}, FFT size ${o.size}, ${o.map} color map` };
    });
  };

  const startLive = async () => {
    setMicError(null);
    stopLive();
    setLive("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = opts.size;
      an.smoothingTimeConstant = 0;
      an.minDecibels = opts.floor;
      an.maxDecibels = 0;
      ctx.createMediaStreamSource(stream).connect(an);
      const c = canvas.current;
      if (!c) throw new Error("Canvas not ready");
      const cols = Math.max(300, Math.min(1200, (c.parentElement?.clientWidth ?? 800) - GUTTER));
      c.width = GUTTER + cols;
      c.height = PLOT_H + BOTTOM;
      const g = c.getContext("2d");
      if (!g) throw new Error("Canvas not available");
      g.fillStyle = "#000";
      g.fillRect(GUTTER, 0, cols, PLOT_H);
      g.fillStyle = "#ffffff";
      g.fillRect(0, PLOT_H, c.width, BOTTOM);
      g.fillStyle = "#333";
      g.font = "11px ui-sans-serif, system-ui, sans-serif";
      g.textBaseline = "top";
      g.fillText("Live input, newest on the right", GUTTER + 4, PLOT_H + 5);
      const maxHz = ctx.sampleRate / 2;
      drawFreqAxis(g, opts.scale, maxHz);
      const bins = an.frequencyBinCount;
      const { lo, hi } = rowBins(PLOT_H, opts.scale, maxHz, ctx.sampleRate / opts.size, bins);
      const data = new Float32Array(bins);
      const lut = colorLut(opts.map);
      const col = g.createImageData(1, PLOT_H);
      const state = { stream, ctx, raf: null as number | null };
      liveRef.current = state;
      pausedRef.current = false;
      const tick = () => {
        if (liveRef.current !== state) return;
        if (!pausedRef.current) {
          an.getFloatFrequencyData(data);
          g.drawImage(c, GUTTER + 1, 0, cols - 1, PLOT_H, GUTTER, 0, cols - 1, PLOT_H);
          for (let r = 0; r < PLOT_H; r++) {
            let m = -240;
            for (let b = lo[r]; b <= hi[r]; b++) if (data[b] > m) m = data[b];
            const ci = dbToIndex(m, opts.floor) * 3;
            col.data[r * 4] = lut[ci];
            col.data[r * 4 + 1] = lut[ci + 1];
            col.data[r * 4 + 2] = lut[ci + 2];
            col.data[r * 4 + 3] = 255;
          }
          g.putImageData(col, GUTTER + cols - 1, 0);
        }
        state.raf = requestAnimationFrame(tick);
      };
      state.raf = requestAnimationFrame(tick);
      setLive("on");
    } catch (e) {
      stopLive();
      setLive("off");
      const n = e instanceof DOMException ? e.name : "";
      setMicError(
        n === "NotAllowedError" || n === "SecurityError"
          ? "Microphone access was blocked. Allow it in your browser's site settings and try again."
          : n === "NotFoundError"
            ? "No microphone was found."
            : "Could not start the microphone.",
      );
    }
  };

  const exportPng = async () => {
    if (!canvas.current) return;
    const b = await canvasToBlob(canvas.current, "image/png");
    downloadBlob(b, `${source === "file" && audio ? baseName(audio.file.name) : "live"}-spectrogram.png`);
  };

  const hasImage = source === "file" ? !!job.result : live !== "off" && live !== "starting";

  return (
    <div className="space-y-5">
      <ToolPanel title="Audio spectrogram">
        <div className="space-y-5">
          <Segmented
            label="Source"
            value={source}
            onChange={(v) => {
              stopLive();
              setLive("off");
              job.reset();
              setSource(v);
            }}
            options={[
              { value: "file", label: "Audio file" },
              { value: "mic", label: "Live microphone" },
            ]}
          />
          {source === "file" && <AudioFileInput state={src.state} onFile={(f) => (job.reset(), src.load(f))} onClear={() => (job.reset(), src.clear())} />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label="FFT size"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              options={["512", "1024", "2048", "4096", "8192"].map((v) => ({ value: v, label: `${v} samples` }))}
              hint="Larger: finer frequency, blurrier time."
            />
            <SelectField label="Color map" value={map} onChange={(e) => setMap(e.target.value as ColorMapName)} options={MAPS} />
            <SelectField
              label="Frequency axis"
              value={scale}
              onChange={(e) => setScale(e.target.value as Scale)}
              options={[
                { value: "log", label: "Logarithmic" },
                { value: "linear", label: "Linear" },
              ]}
            />
            <SelectField
              label="Floor"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              options={["-60", "-80", "-100", "-120"].map((v) => ({ value: v, label: `${v} dBFS` }))}
              hint="Anything quieter is drawn as the darkest color."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {source === "file" ? (
              job.progress !== null ? null : (
                <Btn icon="eye" onClick={renderNow} disabled={!audio}>
                  {job.result ? "Render again" : "Render spectrogram"}
                </Btn>
              )
            ) : live === "off" || live === "starting" || live === "stopped" ? (
              <Btn icon="mic" onClick={startLive} disabled={live === "starting"}>
                Start microphone
              </Btn>
            ) : (
              <>
                <Btn
                  variant="ghost"
                  icon={live === "paused" ? "play" : "pause"}
                  onClick={() => {
                    pausedRef.current = live === "on";
                    setLive(live === "on" ? "paused" : "on");
                  }}
                >
                  {live === "paused" ? "Resume" : "Freeze"}
                </Btn>
                <Btn
                  variant="danger"
                  onClick={() => {
                    stopLive();
                    setLive("stopped");
                  }}
                >
                  Stop microphone
                </Btn>
              </>
            )}
            {hasImage && (
              <Btn variant="ghost" icon="download" onClick={exportPng}>
                Download PNG
              </Btn>
            )}
          </div>
          {source === "mic" && <p className="text-[0.8125rem] text-muted">Settings apply when the microphone starts. Stop and start again after changing them.</p>}
          {job.progress !== null && <JobProgress value={job.progress} label="Computing spectrogram" onCancel={job.cancel} />}
          {job.error && <Notice tone="error">{job.error}</Notice>}
          {micError && <Notice tone="error">{micError}</Notice>}
          <div className={`overflow-x-auto rounded-lg bg-surface shadow-[0_0_0_1px_var(--line)] ${hasImage || job.progress !== null || live === "starting" ? "" : "hidden"}`}>
            <canvas
              ref={canvas}
              role="img"
              aria-label={source === "file" ? (job.result?.label ?? "Spectrogram") : "Live microphone spectrogram, time runs left to right and frequency bottom to top"}
              className="block max-w-none"
            />
          </div>
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}
