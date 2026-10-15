"use client";

import { useMemo, useState } from "react";
import { Btn, Checkbox, Notice, NumberField, PrivacyNote, Segmented, SelectField, StatGrid, ToolPanel, parseNum } from "@/components/tools/kit";
import { baseName } from "@/components/tools/engines/files";
import { applyGain, dbToGain, gainToDb, peakOf, rmsOf, type Pcm } from "./lib/pcm";
import { integratedLoudness, limit, truePeak } from "./lib/loudness";
import { AudioFileInput, useAudioFile } from "./shared/useAudioFile";
import { AudioResult, JobProgress, useJob } from "./shared/Export";

type Mode = "gain" | "peak" | "lufs";
type Out = { pcm: Pcm; appliedDb: number; reductionDb: number; lufs: number; tp: number };

const fmtDb = (v: number, unit: string) => (Number.isFinite(v) ? `${v.toFixed(1)} ${unit}` : "silent");

const PRESETS = [
  { value: "-14", label: "-14 LUFS (common streaming target)" },
  { value: "-16", label: "-16 LUFS (podcasts, spoken word)" },
  { value: "-23", label: "-23 LUFS (EBU R 128 broadcast)" },
  { value: "-24", label: "-24 LUFS (ATSC A/85 broadcast)" },
  { value: "custom", label: "Custom" },
];

export default function Tool() {
  const src = useAudioFile();
  const audio = src.audio;
  const [mode, setMode] = useState<Mode>("lufs");
  const [gain, setGain] = useState("3");
  const [peakTarget, setPeakTarget] = useState("-1");
  const [preset, setPreset] = useState("-14");
  const [custom, setCustom] = useState("-18");
  const [ceiling, setCeiling] = useState("-1");
  const [useLimiter, setUseLimiter] = useState(true);
  const job = useJob<Out>();

  const analysis = useMemo(() => {
    if (!audio) return null;
    return { peak: gainToDb(peakOf(audio.pcm)), rms: gainToDb(rmsOf(audio.pcm)), lufs: integratedLoudness(audio.pcm).integrated };
  }, [audio]);

  const gainN = parseNum(gain);
  const gainErr = gainN === null || Math.abs(gainN) > 60 ? "Enter -60 to 60 dB." : null;
  const peakN = parseNum(peakTarget);
  const peakErr = peakN === null || peakN > 0 || peakN < -60 ? "Enter -60 to 0 dBFS." : null;
  const lufsN = parseNum(preset === "custom" ? custom : preset);
  const lufsErr = lufsN === null || lufsN > -5 || lufsN < -50 ? "Enter -50 to -5 LUFS." : null;
  const ceilN = parseNum(ceiling);
  const ceilErr = ceilN === null || ceilN > 0 || ceilN < -20 ? "Enter -20 to 0 dB." : null;
  const invalid = (mode === "gain" && !!gainErr) || (mode === "peak" && !!peakErr) || (mode === "lufs" && !!lufsErr) || (mode !== "peak" && useLimiter && !!ceilErr);

  let plannedDb: number | null = null;
  if (analysis && !invalid) {
    if (mode === "gain") plannedDb = gainN;
    else if (mode === "peak") plannedDb = Number.isFinite(analysis.peak) ? (peakN as number) - analysis.peak : null;
    else plannedDb = Number.isFinite(analysis.lufs) ? (lufsN as number) - analysis.lufs : null;
  }
  const willExceed = analysis && plannedDb !== null && mode !== "peak" && analysis.peak + plannedDb > (useLimiter ? (ceilN ?? 0) : 0);

  const apply = () => {
    if (!audio || plannedDb === null) return;
    const db = plannedDb;
    job.run(async ({ onProgress }) => {
      let pcm = applyGain(audio.pcm, dbToGain(db));
      onProgress(0.3);
      await new Promise((r) => setTimeout(r, 0));
      let reductionDb = 0;
      if (mode !== "peak" && useLimiter && peakOf(pcm) > dbToGain(ceilN as number) * 0.98) {
        const r = limit(pcm, dbToGain(ceilN as number), { truePeakMode: mode === "lufs", lookaheadMs: 5, releaseMs: 80 });
        pcm = r.audio;
        reductionDb = r.maxReductionDb;
      }
      onProgress(0.7);
      await new Promise((r) => setTimeout(r, 0));
      const out: Out = { pcm, appliedDb: db, reductionDb, lufs: integratedLoudness(pcm).integrated, tp: gainToDb(truePeak(pcm)) };
      onProgress(1);
      return out;
    });
  };

  const resetOut = () => job.reset();

  return (
    <div className="space-y-5">
      <ToolPanel title="Volume changer and normalizer">
        <AudioFileInput state={src.state} onFile={(f) => (resetOut(), src.load(f))} onClear={() => (resetOut(), src.clear())} />
        {audio && analysis && (
          <div className="mt-6 space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Input levels</h3>
              <StatGrid
                items={[
                  { label: "Sample peak", value: fmtDb(analysis.peak, "dBFS") },
                  { label: "RMS", value: fmtDb(analysis.rms, "dBFS") },
                  { label: "Integrated loudness", value: fmtDb(analysis.lufs, "LUFS") },
                ]}
              />
            </div>
            <Segmented
              label="Adjustment mode"
              value={mode}
              onChange={(m) => {
                setMode(m);
                resetOut();
              }}
              options={[
                { value: "lufs", label: "Loudness (LUFS)" },
                { value: "peak", label: "Peak normalize" },
                { value: "gain", label: "Gain (dB)" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {mode === "gain" && <NumberField label="Gain (dB)" value={gain} onChange={(e) => (setGain(e.target.value), resetOut())} error={gainErr} hint="Positive is louder. +6 dB roughly doubles the amplitude." />}
              {mode === "peak" && <NumberField label="Target peak (dBFS)" value={peakTarget} onChange={(e) => (setPeakTarget(e.target.value), resetOut())} error={peakErr} hint="The loudest sample lands exactly here." />}
              {mode === "lufs" && (
                <>
                  <SelectField label="Loudness target" value={preset} onChange={(e) => (setPreset(e.target.value), resetOut())} options={PRESETS} />
                  {preset === "custom" && <NumberField label="Custom target (LUFS)" value={custom} onChange={(e) => (setCustom(e.target.value), resetOut())} error={lufsErr} />}
                </>
              )}
            </div>
            {mode !== "peak" && (
              <div className="space-y-3">
                <Checkbox
                  label={mode === "lufs" ? "Limit true peaks" : "Limit peaks"}
                  hint="A look-ahead limiter keeps the result below the ceiling instead of clipping."
                  checked={useLimiter}
                  onChange={(v) => (setUseLimiter(v), resetOut())}
                />
                {useLimiter && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField label={mode === "lufs" ? "Ceiling (dBTP)" : "Ceiling (dBFS)"} value={ceiling} onChange={(e) => (setCeiling(e.target.value), resetOut())} error={ceilErr} />
                  </div>
                )}
              </div>
            )}
            {plannedDb !== null && (
              <p className="text-sm text-ink-2">
                Gain to apply: <strong className="tabular-nums text-ink">{plannedDb >= 0 ? "+" : ""}{plannedDb.toFixed(2)} dB</strong>
                {mode !== "peak" && analysis && Number.isFinite(analysis.peak) && <> · peaks would reach {(analysis.peak + plannedDb).toFixed(1)} dBFS before limiting</>}
              </p>
            )}
            {willExceed && !useLimiter && <Notice tone="warning">Peaks will go above 0 dBFS. Turn on the limiter, lower the target, or export as 32-bit float WAV.</Notice>}
            {willExceed && useLimiter && <Notice tone="info">The limiter will reduce peaks above the ceiling. Large reductions can sound squashed.</Notice>}
            {analysis && !Number.isFinite(analysis.peak) && <Notice tone="error">This file is completely silent, so there is nothing to normalize.</Notice>}
            {mode === "lufs" && analysis && Number.isFinite(analysis.peak) && !Number.isFinite(analysis.lufs) && (
              <Notice tone="error">The audio is quieter than the -70 LUFS gate throughout, so integrated loudness is undefined. Use gain or peak mode.</Notice>
            )}
            {job.progress !== null ? (
              <JobProgress value={job.progress} label="Processing" onCancel={job.cancel} />
            ) : (
              <Btn icon="gauge" onClick={apply} disabled={plannedDb === null}>
                Apply
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
          <AudioResult
            pcm={job.result.pcm}
            fileName={`${baseName(audio.file.name)}-${mode === "lufs" ? `${lufsN}LUFS` : mode === "peak" ? "normalized" : "gain"}`}
            title="Adjusted audio"
            extraStats={[
              { label: "Gain applied", value: `${job.result.appliedDb >= 0 ? "+" : ""}${job.result.appliedDb.toFixed(2)} dB` },
              { label: "Loudness", value: fmtDb(job.result.lufs, "LUFS") },
              { label: "True peak", value: fmtDb(job.result.tp, "dBTP") },
              ...(job.result.reductionDb > 0 ? [{ label: "Max limiting", value: `${job.result.reductionDb.toFixed(1)} dB` }] : []),
            ]}
          />
        </ToolPanel>
      )}
    </div>
  );
}
