"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Btn, Checkbox, Notice, NumberField, PrivacyNote, Segmented, ToolPanel, parseNum } from "@/components/tools/kit";
import { ProgressBar, baseName, downloadBlob, zipFiles } from "@/components/tools/engines/files";
import { Icon } from "@/components/ui/Icon";
import { durationOf, formatTime, sliceSeconds } from "./lib/pcm";
import { detectSilence, equalSplitPoints, intervalSplitPoints, pointsToSegments, silenceSegments, type Region } from "./lib/silence";
import { AudioFileInput, useAudioFile } from "./shared/useAudioFile";
import { TimeInput, Waveform } from "./shared/Waveform";
import { usePlayer } from "./shared/usePlayer";
import { FormatPicker } from "./shared/Export";
import { encodeAudio, errorText, isAbort, type ExportFormat, type Mp3Bitrate } from "./shared/browser";
import { useKeyed } from "./shared/useKeyed";

type Mode = "markers" | "equal" | "interval" | "silence";
const MAX_PARTS = 500;

export default function Tool() {
  const src = useAudioFile();
  const audio = src.audio;
  const dur = audio ? durationOf(audio.pcm) : 0;
  const [mode, setMode] = useState<Mode>("markers");
  const [markers, setMarkers] = useKeyed<number[]>(audio, () => []);
  const [cursor, setCursor] = useKeyed<number | null>(audio, () => null);
  const [parts, setParts] = useState("3");
  const [interval, setIntervalStr] = useState("60");
  const [thr, setThr] = useState("-40");
  const [minSil, setMinSil] = useState("0.7");
  const [dropSil, setDropSil] = useState(true);
  const [format, setFormat] = useState<ExportFormat>("wav16");
  const [bitrate, setBitrate] = useState<Mp3Bitrate>(192);
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const player = usePlayer();

  const nParts = parseNum(parts);
  const partsErr = nParts === null || !Number.isInteger(nParts) || nParts < 2 || nParts > MAX_PARTS ? `Enter a whole number from 2 to ${MAX_PARTS}.` : null;
  const iv = parseNum(interval);
  const ivErr = iv === null || iv <= 0 ? "Enter a positive number of seconds." : dur && dur / iv > MAX_PARTS ? `That makes more than ${MAX_PARTS} parts.` : null;
  const thrN = parseNum(thr);
  const thrErr = thrN === null || thrN > 0 || thrN < -120 ? "Enter a level from -120 to 0 dBFS." : null;
  const minN = parseNum(minSil);
  const minErr = minN === null || minN < 0.05 || minN > 60 ? "Enter 0.05 to 60 seconds." : null;

  const silences = useMemo<Region[]>(() => {
    if (!audio || mode !== "silence" || thrErr || minErr) return [];
    return detectSilence(audio.pcm, thrN as number, minN as number);
  }, [audio, mode, thrN, minN, thrErr, minErr]);

  const segments = useMemo<Region[]>(() => {
    if (!audio) return [];
    if (mode === "markers") return pointsToSegments(markers, dur);
    if (mode === "equal") return partsErr ? [] : pointsToSegments(equalSplitPoints(dur, nParts as number), dur);
    if (mode === "interval") return ivErr ? [] : pointsToSegments(intervalSplitPoints(dur, iv as number), dur);
    return silenceSegments(dur, silences, dropSil).slice(0, MAX_PARTS);
  }, [audio, mode, markers, dur, partsErr, nParts, ivErr, iv, silences, dropSil]);

  const cutPoints = mode === "markers" ? markers : segments.slice(1).map((s) => s.start);
  const name = audio ? baseName(audio.file.name) : "audio";
  const pad = String(segments.length).length;
  const partName = (i: number) => `${name}-part${String(i + 1).padStart(Math.max(2, pad), "0")}`;

  const addMarker = (t: number) => {
    if (t <= 0 || t >= dur) return;
    setMarkers((m) => (m.some((x) => Math.abs(x - t) < 0.005) ? m : [...m, t].sort((a, b) => a - b)));
  };

  const downloadOne = async (i: number) => {
    if (!audio) return;
    setError(null);
    try {
      const seg = segments[i];
      const { blob, ext } = await encodeAudio(sliceSeconds(audio.pcm, seg.start, seg.end), format, bitrate);
      downloadBlob(blob, `${partName(i)}.${ext}`);
    } catch (e) {
      setError(errorText(e, "Encoding failed."));
    }
  };

  const downloadAll = async () => {
    if (!audio || !segments.length) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setError(null);
    setZipProgress(0);
    try {
      const entries: { name: string; data: Blob }[] = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const { blob, ext } = await encodeAudio(sliceSeconds(audio.pcm, seg.start, seg.end), format, bitrate, {
          signal: c.signal,
          onProgress: (p) => setZipProgress((i + p) / (segments.length + 0.5)),
        });
        entries.push({ name: `${partName(i)}.${ext}`, data: blob });
        await new Promise((r) => setTimeout(r, 0));
        if (c.signal.aborted) return;
      }
      const zip = await zipFiles(entries, 0);
      if (!c.signal.aborted) downloadBlob(zip, `${name}-parts.zip`);
    } catch (e) {
      if (!isAbort(e)) setError(errorText(e, "Could not build the ZIP."));
    } finally {
      if (ctrl.current === c) {
        ctrl.current = null;
        setZipProgress(null);
      }
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Audio splitter">
        <AudioFileInput state={src.state} onFile={src.load} onClear={src.clear} />
        {audio && (
          <div className="mt-6 space-y-5">
            <Segmented
              label="Split method"
              value={mode}
              onChange={setMode}
              options={[
                { value: "markers", label: "At markers" },
                { value: "equal", label: "Equal parts" },
                { value: "interval", label: "Every N seconds" },
                { value: "silence", label: "At silences" },
              ]}
            />
            <Waveform
              pcm={audio.pcm}
              label={`Waveform of ${audio.file.name} with split points`}
              markers={cutPoints}
              regions={mode === "silence" ? silences : undefined}
              playhead={player.position}
              cursor={cursor}
              onCursor={setCursor}
            />
            {mode === "markers" && (
              <div className="space-y-3">
                <p className="text-[0.8125rem] text-muted">Click the waveform to place the cursor, then add a marker there. You can also type a time.</p>
                <div className="flex flex-wrap gap-2">
                  <Btn icon="plus" onClick={() => cursor !== null && addMarker(cursor)} disabled={cursor === null || cursor <= 0 || cursor >= dur}>
                    Add marker at {cursor !== null ? formatTime(cursor, 2) : "cursor"}
                  </Btn>
                  {player.playing && player.position !== null && (
                    <Btn variant="ghost" icon="plus" onClick={() => player.position !== null && addMarker(player.position)}>
                      Add marker at playhead
                    </Btn>
                  )}
                  {cursor !== null && !player.playing && (
                    <Btn variant="ghost" icon="play" onClick={() => player.play(audio.pcm, cursor)}>
                      Play from cursor
                    </Btn>
                  )}
                  {player.playing && (
                    <Btn variant="ghost" icon="pause" onClick={player.stop}>
                      Stop
                    </Btn>
                  )}
                  {markers.length > 0 && (
                    <Btn variant="subtle" icon="trash" onClick={() => setMarkers([])}>
                      Clear markers
                    </Btn>
                  )}
                </div>
                {markers.length > 0 && (
                  <ul className="grid gap-3 sm:grid-cols-2" aria-label="Markers">
                    {markers.map((m, i) => (
                      <li key={`${i}-${m}`} className="flex items-end gap-2">
                        <div className="flex-1">
                          <TimeInput
                            label={`Marker ${i + 1}`}
                            value={m}
                            min={0.01}
                            max={dur - 0.01}
                            onCommit={(v) => setMarkers((arr) => arr.map((x, j) => (j === i ? v : x)).sort((a, b) => a - b))}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setMarkers((arr) => arr.filter((_, j) => j !== i))}
                          className="mb-0.5 grid h-10 w-10 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
                          aria-label={`Remove marker ${i + 1}`}
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {mode === "equal" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField label="Number of parts" value={parts} onChange={(e) => setParts(e.target.value)} error={partsErr} />
              </div>
            )}
            {mode === "interval" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField label="Part length (seconds)" value={interval} onChange={(e) => setIntervalStr(e.target.value)} error={ivErr} hint="The last part holds the remainder." />
              </div>
            )}
            {mode === "silence" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField label="Silence threshold (dBFS)" value={thr} onChange={(e) => setThr(e.target.value)} error={thrErr} hint="Quieter than this counts as silence." />
                  <NumberField label="Minimum silence (seconds)" value={minSil} onChange={(e) => setMinSil(e.target.value)} error={minErr} />
                </div>
                <Checkbox label="Leave the silent gaps out of the parts" hint="Otherwise each cut falls in the middle of the silence." checked={dropSil} onChange={setDropSil} />
                {!thrErr && !minErr && <p className="text-sm text-ink-2">{silences.length} silent regions found (shaded on the waveform).</p>}
              </div>
            )}
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>

      {audio && (
        <ToolPanel title={`Parts (${segments.length})`}>
          {segments.length < 2 ? (
            <Notice tone="info">
              {mode === "markers" ? "Add at least one marker to split the file." : mode === "silence" ? "No usable silences found. Try a higher threshold or a shorter minimum." : "Fix the settings above to see the parts."}
            </Notice>
          ) : (
            <div className="space-y-5">
              <div className="max-h-[420px] overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-line">
                      <th scope="col" className="px-3 py-2.5 font-medium">#</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Start</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">End</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Length</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map((s, i) => (
                      <tr key={`${s.start}-${s.end}`} className="border-b border-line last:border-0">
                        <td className="px-3 py-1.5 tabular-nums text-muted">{i + 1}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatTime(s.start, 2)}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatTime(s.end, 2)}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatTime(s.end - s.start, 2)}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right">
                          <button type="button" className="inline-grid h-10 w-10 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" onClick={() => player.play(audio.pcm, s.start, s.end)} aria-label={`Play part ${i + 1}`}>
                            <Icon name="play" size={16} />
                          </button>
                          <button type="button" className="inline-grid h-10 w-10 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" onClick={() => downloadOne(i)} aria-label={`Download part ${i + 1}`}>
                            <Icon name="download" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <FormatPicker format={format} bitrate={bitrate} onFormat={setFormat} onBitrate={setBitrate} />
              {zipProgress !== null ? (
                <div className="space-y-2">
                  <ProgressBar value={zipProgress} label="Encoding parts" />
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      ctrl.current?.abort();
                      ctrl.current = null;
                      setZipProgress(null);
                    }}
                  >
                    Cancel
                  </Btn>
                </div>
              ) : (
                <Btn icon="download" onClick={downloadAll}>
                  Download all {segments.length} parts (ZIP)
                </Btn>
              )}
              {error && <Notice tone="error">{error}</Notice>}
            </div>
          )}
        </ToolPanel>
      )}
    </div>
  );
}
