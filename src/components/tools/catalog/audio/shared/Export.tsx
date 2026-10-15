"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Notice, SelectField, StatGrid } from "@/components/tools/kit";
import { ProgressBar, downloadBlob, useObjectUrl } from "@/components/tools/engines/files";
import { durationOf, gainToDb, peakOf, formatTime, type Pcm } from "../lib/pcm";
import { encodeWav } from "../lib/wav";
import { MP3_BITRATES, encodeAudio, errorText, isAbort, type ExportFormat, type Mp3Bitrate } from "./browser";

export const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "wav16", label: "WAV, 16-bit PCM" },
  { value: "wav24", label: "WAV, 24-bit PCM" },
  { value: "wav32", label: "WAV, 32-bit float" },
  { value: "mp3", label: "MP3" },
];

/** Format + bitrate pickers. Controlled so multi-file tools can reuse the choice. */
export function FormatPicker({
  format,
  bitrate,
  onFormat,
  onBitrate,
}: {
  format: ExportFormat;
  bitrate: Mp3Bitrate;
  onFormat: (f: ExportFormat) => void;
  onBitrate: (b: Mp3Bitrate) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Output format" value={format} onChange={(e) => onFormat(e.target.value as ExportFormat)} options={FORMAT_OPTIONS} />
      {format === "mp3" ? (
        <SelectField
          label="MP3 bitrate"
          value={String(bitrate)}
          onChange={(e) => onBitrate(Number(e.target.value) as Mp3Bitrate)}
          options={MP3_BITRATES.map((b) => ({ value: String(b), label: `${b} kbps${b === 192 ? " (good default)" : b === 320 ? " (highest)" : ""}` }))}
        />
      ) : (
        <p className="self-end text-[0.8125rem] text-muted">
          {format === "wav32"
            ? "Float WAV keeps levels above 0 dBFS without clipping; not every player supports it."
            : "Lossless and widely compatible. Larger than MP3."}
        </p>
      )}
    </div>
  );
}

/** Encodes and downloads one result, with progress and cancel. */
export function useEncoder() {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const run = async (pcm: Pcm, format: ExportFormat, bitrate: Mp3Bitrate, name: string) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setError(null);
    setBusy(0);
    try {
      const { blob, ext } = await encodeAudio(pcm, format, bitrate, { signal: c.signal, onProgress: (p) => setBusy(p) });
      if (!c.signal.aborted) downloadBlob(blob, `${name}.${ext}`);
    } catch (e) {
      if (!isAbort(e)) setError(errorText(e, "Encoding failed."));
    } finally {
      if (ctrl.current === c) {
        ctrl.current = null;
        setBusy(null);
      }
    }
  };
  const cancel = () => {
    ctrl.current?.abort();
    ctrl.current = null;
    setBusy(null);
  };
  return { run, cancel, busy, error };
}

/**
 * Result panel: listen to the processed audio (temporary 16-bit WAV),
 * see its stats, and download in the chosen format.
 */
export function AudioResult({
  pcm,
  fileName,
  title = "Result",
  extraStats = [],
}: {
  pcm: Pcm;
  /** Download name without extension. */
  fileName: string;
  title?: string;
  extraStats?: { label: string; value: React.ReactNode }[];
}) {
  const [format, setFormat] = useState<ExportFormat>("wav16");
  const [bitrate, setBitrate] = useState<Mp3Bitrate>(192);
  const enc = useEncoder();
  const previewBlob = useMemo(() => new Blob([encodeWav(pcm, 16)], { type: "audio/wav" }), [pcm]);
  const url = useObjectUrl(previewBlob);
  const peak = peakOf(pcm);
  return (
    <div className="space-y-4">
      <h3 className="text-[0.95rem] font-semibold text-ink">{title}</h3>
      {url && <audio controls src={url} className="w-full" aria-label={`${title} preview`} />}
      <StatGrid
        items={[
          { label: "Duration", value: formatTime(durationOf(pcm), 2) },
          { label: "Peak", value: peak > 0 ? `${gainToDb(peak).toFixed(1)} dBFS` : "silent" },
          { label: "Format", value: `${pcm.sampleRate / 1000} kHz, ${pcm.channels.length === 1 ? "mono" : pcm.channels.length === 2 ? "stereo" : `${pcm.channels.length} ch`}` },
          ...extraStats,
        ]}
      />
      {peak > 1 && format !== "wav32" && (
        <Notice tone="warning">The peak is above 0 dBFS, so this format will clip. Lower the level, use a limiter, or pick 32-bit float WAV.</Notice>
      )}
      <FormatPicker format={format} bitrate={bitrate} onFormat={setFormat} onBitrate={setBitrate} />
      {enc.busy !== null ? (
        <div className="space-y-2">
          <ProgressBar value={enc.busy} label={format === "mp3" ? "Encoding MP3" : "Writing WAV"} />
          <Btn variant="ghost" onClick={enc.cancel}>
            Cancel
          </Btn>
        </div>
      ) : (
        <Btn icon="download" onClick={() => enc.run(pcm, format, bitrate, fileName)}>
          Download {format === "mp3" ? "MP3" : "WAV"}
        </Btn>
      )}
      {enc.error && <Notice tone="error">{enc.error}</Notice>}
    </div>
  );
}

/** Progress + cancel row for long processing jobs. */
export function JobProgress({ value, label, onCancel }: { value: number; label: string; onCancel: () => void }) {
  return (
    <div className="space-y-2">
      <ProgressBar value={value} label={label} />
      <Btn variant="ghost" onClick={onCancel}>
        Cancel
      </Btn>
    </div>
  );
}

/** Runs an async job with progress, cancellation and error capture. */
export function useJob<T>() {
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const run = async (fn: (opts: { signal: AbortSignal; onProgress: (p: number) => void }) => Promise<T>) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setError(null);
    setResult(null);
    setProgress(0);
    // Let the progress bar paint before heavy synchronous work starts.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const r = await fn({ signal: c.signal, onProgress: (p) => !c.signal.aborted && setProgress(p) });
      if (!c.signal.aborted) setResult(r);
    } catch (e) {
      if (!isAbort(e) && !c.signal.aborted) setError(errorText(e));
    } finally {
      if (ctrl.current === c) {
        ctrl.current = null;
        setProgress(null);
      }
    }
  };
  const cancel = () => {
    ctrl.current?.abort();
    ctrl.current = null;
    setProgress(null);
  };
  const reset = () => {
    cancel();
    setResult(null);
    setError(null);
  };
  return { run, cancel, reset, progress, result, error, setResult };
}
