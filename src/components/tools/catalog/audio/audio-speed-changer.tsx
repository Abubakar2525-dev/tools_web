"use client";

import { useState } from "react";
import { Btn, Notice, NumberField, PrivacyNote, Segmented, ToolPanel, parseNum } from "@/components/tools/kit";
import { baseName } from "@/components/tools/engines/files";
import { changeSpeedTape, durationOf, formatTime, type Pcm } from "./lib/pcm";
import { timeStretch } from "./lib/stretch";
import { AudioFileInput, useAudioFile } from "./shared/useAudioFile";
import { AudioResult, JobProgress, useJob } from "./shared/Export";

type Mode = "keep" | "tape";
const PRESETS = [0.5, 0.75, 0.9, 1.1, 1.25, 1.5, 2];

export default function Tool() {
  const src = useAudioFile();
  const audio = src.audio;
  const [speed, setSpeed] = useState("1.25");
  const [mode, setMode] = useState<Mode>("keep");
  const job = useJob<{ pcm: Pcm; speed: number; mode: Mode }>();

  const s = parseNum(speed);
  const err = s === null || s < 0.25 || s > 4 ? "Enter a speed from 0.25 to 4." : null;
  const dur = audio ? durationOf(audio.pcm) : 0;

  const set = (v: string) => {
    setSpeed(v);
    job.reset();
  };

  const apply = () => {
    if (!audio || err) return;
    const sp = s as number;
    const m = mode;
    job.run(async ({ signal, onProgress }) => ({
      pcm: m === "keep" ? await timeStretch(audio.pcm, sp, { signal, onProgress }) : await changeSpeedTape(audio.pcm, sp, { signal, onProgress }),
      speed: sp,
      mode: m,
    }));
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Audio speed changer">
        <AudioFileInput state={src.state} onFile={(f) => (job.reset(), src.load(f))} onClear={() => (job.reset(), src.clear())} />
        {audio && (
          <div className="mt-6 space-y-5">
            <Segmented
              label="Pitch handling"
              value={mode}
              onChange={(m) => {
                setMode(m);
                job.reset();
              }}
              options={[
                { value: "keep", label: "Keep pitch (time-stretch)" },
                { value: "tape", label: "Tape style (pitch follows speed)" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Speed (x)" value={speed} onChange={(e) => set(e.target.value)} error={err} hint="1 is the original speed. 2 is twice as fast." />
              <div>
                <label htmlFor="speed-range" className="text-sm font-medium text-ink">
                  Speed slider
                </label>
                <input
                  id="speed-range"
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.05}
                  value={s !== null && !err ? s : 1}
                  onChange={(e) => set(e.target.value)}
                  className="mt-2 h-11 w-full accent-[var(--accent)]"
                  aria-valuetext={`${s ?? 1} times`}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Speed presets">
              {PRESETS.map((p) => (
                <Btn key={p} variant={s === p ? "primary" : "ghost"} onClick={() => set(String(p))} aria-pressed={s === p}>
                  {p}x
                </Btn>
              ))}
            </div>
            {!err && (
              <p className="text-sm text-ink-2">
                New length: <strong className="tabular-nums text-ink">{formatTime(dur / (s as number), 2)}</strong> (was {formatTime(dur, 2)})
                {mode === "tape" && <> · pitch shifts by {(12 * Math.log2(s as number)).toFixed(2)} semitones</>}
              </p>
            )}
            {mode === "keep" && !err && ((s as number) > 2.5 || (s as number) < 0.5) && (
              <Notice tone="info">Extreme stretch factors can sound phasey or stuttery with any time-stretch method, especially on music with sharp transients.</Notice>
            )}
            {job.progress !== null ? (
              <JobProgress value={job.progress} label={mode === "keep" ? "Time-stretching" : "Resampling"} onCancel={job.cancel} />
            ) : (
              <Btn icon="bolt" onClick={apply} disabled={!!err}>
                Change speed
              </Btn>
            )}
            {job.error && <Notice tone="error">{job.error}</Notice>}
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
      {audio && job.result && (
        <ToolPanel>
          <AudioResult pcm={job.result.pcm} fileName={`${baseName(audio.file.name)}-${job.result.speed}x`} title={`${job.result.speed}x speed (${job.result.mode === "keep" ? "pitch kept" : "tape style"})`} />
        </ToolPanel>
      )}
    </div>
  );
}
