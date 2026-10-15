"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, CopyBtn, Notice, NumberField, PrivacyNote, Segmented, StatGrid, ToolPanel, downloadFile, parseNum } from "@/components/tools/kit";
import { baseName } from "@/components/tools/engines/files";
import { durationOf, formatTime, type Pcm } from "./lib/pcm";
import { detectSilence, shortenSilences } from "./lib/silence";
import { AudioFileInput, useAudioFile } from "./shared/useAudioFile";
import { Waveform } from "./shared/Waveform";
import { usePlayer } from "./shared/usePlayer";
import { AudioResult } from "./shared/Export";
import { useKeyed } from "./shared/useKeyed";

type Action = "remove" | "shorten";

export default function Tool() {
  const src = useAudioFile();
  const audio = src.audio;
  const [thr, setThr] = useState("-45");
  const [minDur, setMinDur] = useState("0.5");
  const [action, setAction] = useState<Action>("shorten");
  const [keepMs, setKeepMs] = useState("300");
  const [result, setResult] = useKeyed<Pcm | null>(audio, () => null);
  const player = usePlayer();

  const thrN = parseNum(thr);
  const thrErr = thrN === null || thrN > 0 || thrN < -120 ? "Enter -120 to 0 dBFS." : null;
  const minN = parseNum(minDur);
  const minErr = minN === null || minN < 0.02 || minN > 600 ? "Enter 0.02 to 600 seconds." : null;
  const keepN = parseNum(keepMs);
  const keepErr = keepN === null || keepN < 0 || keepN > 10000 ? "Enter 0 to 10000 ms." : null;

  const dThr = useDeferredValue(thrErr ? null : thrN);
  const dMin = useDeferredValue(minErr ? null : minN);
  const paramsOk = dThr !== null && dMin !== null;
  const regions = useMemo(() => {
    if (!audio || dThr === null || dMin === null) return [];
    return detectSilence(audio.pcm, dThr, dMin);
  }, [audio, dThr, dMin]);

  const dur = audio ? durationOf(audio.pcm) : 0;
  const silentTotal = regions.reduce((s, r) => s + (r.end - r.start), 0);
  const keepSec = action === "remove" ? 0 : (keepN ?? 0) / 1000;
  const removed = regions.reduce((s, r) => s + Math.max(0, r.end - r.start - keepSec), 0);

  const csv = ["index,start_seconds,end_seconds,duration_seconds", ...regions.map((r, i) => `${i + 1},${r.start.toFixed(3)},${r.end.toFixed(3)},${(r.end - r.start).toFixed(3)}`)].join("\n");

  const touch = () => setResult(null);

  return (
    <div className="space-y-5">
      <ToolPanel title="Silence remover and detector">
        <AudioFileInput state={src.state} onFile={src.load} onClear={src.clear} />
        {audio && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Silence threshold (dBFS)" value={thr} onChange={(e) => (setThr(e.target.value), touch())} error={thrErr} hint="Windows (10 ms) quieter than this on every channel count as silent." />
              <NumberField label="Minimum silence length (seconds)" value={minDur} onChange={(e) => (setMinDur(e.target.value), touch())} error={minErr} hint="Shorter pauses are left alone." />
            </div>
            <Waveform pcm={audio.pcm} label={`Waveform of ${audio.file.name} with silent regions shaded`} regions={regions} playhead={player.position} />
            <StatGrid
              items={[
                { label: "Silent regions", value: regions.length },
                { label: "Total silence", value: formatTime(silentTotal, 2) },
                { label: "Share of file", value: dur ? `${((silentTotal / dur) * 100).toFixed(1)}%` : "0%" },
              ]}
            />
            {regions.length > 0 && (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-ink">Detected silences</h3>
                  <div className="flex gap-2">
                    <CopyBtn text={csv} label="Copy CSV" />
                    <Btn variant="ghost" icon="download" onClick={() => downloadFile(`${baseName(audio.file.name)}-silences.csv`, csv, "text/csv")}>
                      CSV
                    </Btn>
                  </div>
                </div>
                <div className="max-h-[300px] overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-line">
                        <th scope="col" className="px-3 py-2 font-medium">#</th>
                        <th scope="col" className="px-3 py-2 font-medium">Start</th>
                        <th scope="col" className="px-3 py-2 font-medium">End</th>
                        <th scope="col" className="px-3 py-2 font-medium">Length</th>
                        <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Play</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {regions.slice(0, 1000).map((r, i) => (
                        <tr key={r.start} className="border-b border-line last:border-0">
                          <td className="px-3 py-1 tabular-nums text-muted">{i + 1}</td>
                          <td className="whitespace-nowrap px-3 py-1 tabular-nums">{formatTime(r.start, 2)}</td>
                          <td className="whitespace-nowrap px-3 py-1 tabular-nums">{formatTime(r.end, 2)}</td>
                          <td className="whitespace-nowrap px-3 py-1 tabular-nums">{(r.end - r.start).toFixed(2)} s</td>
                          <td className="px-3 py-1 text-right">
                            <Btn variant="subtle" icon="play" onClick={() => player.play(audio.pcm, Math.max(0, r.start - 1), Math.min(dur, r.end + 1))} aria-label={`Play around silence ${i + 1}`}>
                              <span className="sr-only">Play</span>
                            </Btn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {regions.length > 1000 && <p className="mt-2 text-[0.8125rem] text-muted">Showing the first 1000 of {regions.length}. The CSV has all of them.</p>}
              </div>
            )}
            <div className="space-y-4">
              <Segmented
                label="What to do with silences"
                value={action}
                onChange={(a) => (setAction(a), touch())}
                options={[
                  { value: "shorten", label: "Shorten each to" },
                  { value: "remove", label: "Remove completely" },
                ]}
              />
              {action === "shorten" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField label="Silence to keep (ms)" value={keepMs} onChange={(e) => (setKeepMs(e.target.value), touch())} error={keepErr} hint="Keeps natural pauses; split evenly around each cut." />
                </div>
              )}
              <p className="text-sm text-ink-2">
                Removes about <strong className="tabular-nums text-ink">{formatTime(removed, 2)}</strong>, leaving {formatTime(Math.max(0, dur - removed), 2)}.
              </p>
              {player.playing && (
                <Btn variant="ghost" icon="pause" onClick={player.stop}>
                  Stop
                </Btn>
              )}
              <Btn icon="scissors" disabled={!regions.length || (action === "shorten" && !!keepErr)} onClick={() => setResult(shortenSilences(audio.pcm, regions, keepSec))}>
                {action === "remove" ? "Remove silences" : "Shorten silences"}
              </Btn>
              {!regions.length && paramsOk && <Notice tone="info">No silence matches these settings. Raise the threshold (for example -35) or lower the minimum length.</Notice>}
            </div>
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
      {audio && result && (
        <ToolPanel>
          <AudioResult pcm={result} fileName={`${baseName(audio.file.name)}-nosilence`} title="Audio without long silences" />
        </ToolPanel>
      )}
    </div>
  );
}
