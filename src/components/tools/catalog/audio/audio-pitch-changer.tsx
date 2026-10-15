"use client";

import { useState } from "react";
import { Btn, Notice, NumberField, PrivacyNote, ToolPanel, parseNum } from "@/components/tools/kit";
import { baseName } from "@/components/tools/engines/files";
import type { Pcm } from "./lib/pcm";
import { pitchRatio, pitchShift } from "./lib/stretch";
import { AudioFileInput, useAudioFile } from "./shared/useAudioFile";
import { AudioResult, JobProgress, useJob } from "./shared/Export";

export default function Tool() {
  const src = useAudioFile();
  const audio = src.audio;
  const [semi, setSemi] = useState("2");
  const [cents, setCents] = useState("0");
  const job = useJob<{ pcm: Pcm; label: string }>();

  const st = parseNum(semi);
  const ct = parseNum(cents);
  const stErr = st === null || !Number.isInteger(st) || st < -12 || st > 12 ? "Enter a whole number from -12 to 12." : null;
  const ctErr = ct === null || ct < -100 || ct > 100 ? "Enter -100 to 100 cents." : null;
  const ratio = !stErr && !ctErr ? pitchRatio(st as number, ct as number) : null;
  const label = !stErr && !ctErr ? `${(st as number) >= 0 ? "+" : ""}${st} st${ct ? ` ${(ct as number) > 0 ? "+" : ""}${ct} c` : ""}` : "";

  const apply = () => {
    if (!audio || ratio === null) return;
    const l = label;
    job.run(async ({ signal, onProgress }) => ({ pcm: await pitchShift(audio.pcm, ratio, { signal, onProgress }), label: l }));
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Audio pitch changer">
        <AudioFileInput state={src.state} onFile={(f) => (job.reset(), src.load(f))} onClear={() => (job.reset(), src.clear())} />
        {audio && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Semitones" value={semi} onChange={(e) => (setSemi(e.target.value), job.reset())} error={stErr} hint="12 semitones is one octave. Negative lowers the pitch." />
              <NumberField label="Cents (fine tune)" value={cents} onChange={(e) => (setCents(e.target.value), job.reset())} error={ctErr} hint="100 cents = 1 semitone." />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick shifts">
              {[-12, -5, -2, -1, 1, 2, 5, 12].map((v) => (
                <Btn
                  key={v}
                  variant="ghost"
                  onClick={() => {
                    setSemi(String(v));
                    setCents("0");
                    job.reset();
                  }}
                >
                  {v > 0 ? `+${v}` : v}
                </Btn>
              ))}
            </div>
            {ratio !== null && (
              <p className="text-sm text-ink-2">
                Frequency ratio <strong className="tabular-nums text-ink">{ratio.toFixed(4)}</strong>: a 440 Hz A becomes {(440 * ratio).toFixed(1)} Hz. Duration stays the same.
              </p>
            )}
            {ratio !== null && (st as number) !== 0 && Math.abs(st as number) >= 7 && (
              <Notice tone="info">Large shifts change the character of voices (formants move with the pitch) and can add a slight phasey sound.</Notice>
            )}
            {job.progress !== null ? (
              <JobProgress value={job.progress} label="Shifting pitch" onCancel={job.cancel} />
            ) : (
              <Btn icon="wave" onClick={apply} disabled={ratio === null || ratio === 1}>
                Shift pitch
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
          <AudioResult pcm={job.result.pcm} fileName={`${baseName(audio.file.name)}-pitch${job.result.label.replace(/\s+/g, "")}`} title={`Pitch shifted ${job.result.label}`} />
        </ToolPanel>
      )}
    </div>
  );
}
