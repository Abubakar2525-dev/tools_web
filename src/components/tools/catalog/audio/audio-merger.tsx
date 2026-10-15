"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Notice, NumberField, PrivacyNote, Segmented, SelectField, ToolPanel, parseNum, uid } from "@/components/tools/kit";
import { FileDrop, Spinner, formatBytes } from "@/components/tools/engines/files";
import { Icon } from "@/components/ui/Icon";
import { concat, durationOf, formatTime, resample, toChannelCount, type Pcm } from "./lib/pcm";
import { AUDIO_ACCEPT, decodeFile, errorText, isAbort } from "./shared/browser";
import { AudioResult, JobProgress, useJob } from "./shared/Export";

type Item = { id: string; file: File; pcm?: Pcm; error?: string };
type Join = "none" | "gap" | "crossfade";

export default function Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const [join, setJoin] = useState<Join>("none");
  const [seconds, setSeconds] = useState("1");
  const [rateMode, setRateMode] = useState("auto");
  const [chMode, setChMode] = useState("auto");
  const job = useJob<Pcm>();
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const add = (files: File[]) => {
    const fresh = files.map((file) => ({ id: uid(), file }));
    setItems((prev) => [...prev, ...fresh]);
    job.reset();
    // Decode one at a time to keep memory use predictable.
    for (const it of fresh) {
      queue.current = queue.current.then(async () => {
        if (!alive.current) return;
        try {
          const { pcm } = await decodeFile(it.file);
          if (alive.current) setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, pcm } : p)));
        } catch (e) {
          if (alive.current && !isAbort(e)) setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, error: errorText(e, "Could not decode.") } : p)));
        }
      });
    }
  };

  const move = (i: number, d: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    job.reset();
  };
  const remove = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    job.reset();
  };

  const ready = items.filter((i) => i.pcm) as (Item & { pcm: Pcm })[];
  const pending = items.some((i) => !i.pcm && !i.error);
  const maxRate = ready.reduce((m, i) => Math.max(m, i.pcm.sampleRate), 0);
  const anyStereo = ready.some((i) => i.pcm.channels.length > 1);
  const targetRate = rateMode === "auto" ? maxRate : Number(rateMode);
  const targetCh = chMode === "auto" ? (anyStereo ? 2 : 1) : Number(chMode);
  const sec = parseNum(seconds);
  const secError = join !== "none" && (sec === null || sec < 0 || sec > 30) ? "Enter 0 to 30 seconds." : null;
  const total =
    ready.reduce((s, i) => s + durationOf(i.pcm), 0) +
    (join === "gap" && sec ? sec * Math.max(0, ready.length - 1) : 0) -
    (join === "crossfade" && sec ? sec * Math.max(0, ready.length - 1) : 0);

  const merge = () =>
    job.run(async ({ signal, onProgress }) => {
      const prepared: Pcm[] = [];
      for (let k = 0; k < ready.length; k++) {
        const p = toChannelCount(ready[k].pcm, targetCh);
        prepared.push(
          await resample(p, targetRate, { signal, onProgress: (x) => onProgress((k + x) / (ready.length + 0.2)) }),
        );
      }
      const out = concat(prepared, { gap: join === "gap" ? (sec ?? 0) : 0, crossfade: join === "crossfade" ? (sec ?? 0) : 0 });
      onProgress(1);
      return out;
    });

  return (
    <div className="space-y-5">
      <ToolPanel title="Audio merger">
        <FileDrop accept={AUDIO_ACCEPT} multiple maxFiles={50} maxSizeMB={500} onFiles={add} label="Choose audio files or drop them here" compact={items.length > 0} />
        {items.length > 0 && (
          <ol className="mt-5 space-y-2" aria-label="Files in merge order">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-center gap-2 rounded-lg bg-sunken px-3 py-2 text-sm">
                <span className="w-6 shrink-0 text-center tabular-nums text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink" title={it.file.name}>
                    {it.file.name}
                  </span>
                  <span className="block text-[0.8125rem] text-muted">
                    {formatBytes(it.file.size)}
                    {it.pcm && ` · ${formatTime(durationOf(it.pcm), 1)} · ${it.pcm.sampleRate / 1000} kHz · ${it.pcm.channels.length === 1 ? "mono" : "stereo"}`}
                    {!it.pcm && !it.error && " · decoding…"}
                  </span>
                  {it.error && <span className="block text-[0.8125rem] text-danger">{it.error}</span>}
                </span>
                <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:opacity-40" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${it.file.name} up`}>
                  <Icon name="chevron" size={16} className="rotate-180" />
                </button>
                <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:opacity-40" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${it.file.name} down`}>
                  <Icon name="chevron" size={16} />
                </button>
                <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink" onClick={() => remove(it.id)} aria-label={`Remove ${it.file.name}`}>
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ol>
        )}
        {items.length > 0 && (
          <div className="mt-6 space-y-5">
            <Segmented
              label="How to join the files"
              value={join}
              onChange={(v) => {
                setJoin(v);
                job.reset();
              }}
              options={[
                { value: "none", label: "Back to back" },
                { value: "gap", label: "Silence gap" },
                { value: "crossfade", label: "Crossfade" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              {join !== "none" && (
                <NumberField
                  label={join === "gap" ? "Gap (seconds)" : "Crossfade (seconds)"}
                  value={seconds}
                  onChange={(e) => {
                    setSeconds(e.target.value);
                    job.reset();
                  }}
                  error={secError}
                  hint={join === "crossfade" ? "Limited by the shorter clip at each join." : undefined}
                />
              )}
              <SelectField
                label="Output sample rate"
                value={rateMode}
                onChange={(e) => {
                  setRateMode(e.target.value);
                  job.reset();
                }}
                options={[
                  { value: "auto", label: maxRate ? `Highest input (${maxRate / 1000} kHz)` : "Highest input" },
                  { value: "44100", label: "44.1 kHz" },
                  { value: "48000", label: "48 kHz" },
                ]}
              />
              <SelectField
                label="Channels"
                value={chMode}
                onChange={(e) => {
                  setChMode(e.target.value);
                  job.reset();
                }}
                options={[
                  { value: "auto", label: anyStereo ? "Auto (stereo)" : "Auto (mono)" },
                  { value: "1", label: "Mono" },
                  { value: "2", label: "Stereo" },
                ]}
              />
            </div>
            {pending && <Spinner label="Decoding files" />}
            {job.progress !== null ? (
              <JobProgress value={job.progress} label="Merging" onCancel={job.cancel} />
            ) : (
              <Btn icon="plus" onClick={merge} disabled={ready.length < 2 || pending || !!secError}>
                Merge {ready.length} files{ready.length >= 2 ? ` (${formatTime(Math.max(0, total), 1)})` : ""}
              </Btn>
            )}
            {ready.length < 2 && !pending && <p className="text-sm text-muted">Add at least two files that decode correctly.</p>}
            {job.error && <Notice tone="error">{job.error}</Notice>}
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
      {job.result && (
        <ToolPanel>
          <AudioResult pcm={job.result} fileName="merged-audio" title="Merged audio" />
        </ToolPanel>
      )}
    </div>
  );
}
