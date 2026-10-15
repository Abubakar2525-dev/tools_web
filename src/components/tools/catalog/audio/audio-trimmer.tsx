"use client";

import { useState } from "react";
import { Btn, Checkbox, Notice, PrivacyNote, Segmented, ToolPanel } from "@/components/tools/kit";
import { baseName } from "@/components/tools/engines/files";
import { applyFades, cutSeconds, durationOf, formatTime, sliceSeconds, type Pcm } from "./lib/pcm";
import { AudioFileInput, useAudioFile } from "./shared/useAudioFile";
import { TimeInput, Waveform, type Selection } from "./shared/Waveform";
import { usePlayer } from "./shared/usePlayer";
import { AudioResult } from "./shared/Export";
import { useKeyed } from "./shared/useKeyed";

type Mode = "keep" | "remove";

export default function Tool() {
  const src = useAudioFile();
  const audio = src.audio;
  const dur = audio ? durationOf(audio.pcm) : 0;
  const [sel, setSel] = useKeyed<Selection>(audio, () => ({ start: 0, end: dur }));
  const [cursor, setCursor] = useKeyed<number | null>(audio, () => null);
  const [result, setResult] = useKeyed<Pcm | null>(audio, () => null);
  const [mode, setMode] = useState<Mode>("keep");
  const [fades, setFades] = useState(true);
  const player = usePlayer();

  const changeSel = (s: Selection) => {
    setSel(s);
    setResult(null);
  };

  const apply = () => {
    if (!audio) return;
    if (mode === "keep") {
      let out = sliceSeconds(audio.pcm, sel.start, sel.end);
      if (fades) out = applyFades(out, { fadeIn: 0.01, fadeOut: 0.01, inShape: "s-curve", outShape: "s-curve" });
      setResult(out);
    } else {
      setResult(cutSeconds(audio.pcm, sel.start, sel.end, fades ? 10 : 0));
    }
  };

  const len = sel.end - sel.start;
  const outLen = mode === "keep" ? len : dur - len;

  return (
    <div className="space-y-5">
      <ToolPanel title="Audio trimmer">
        <AudioFileInput state={src.state} onFile={src.load} onClear={src.clear} />
        {audio && (
          <div className="mt-6 space-y-5">
            <Waveform
              pcm={audio.pcm}
              label={`Waveform of ${audio.file.name}`}
              selection={sel}
              onSelectionChange={changeSel}
              playhead={player.position}
              cursor={cursor}
              onCursor={setCursor}
            />
            <p className="text-[0.8125rem] text-muted">
              Drag the dark handles or drag across the waveform to select. Handles also move with arrow keys (Shift for 1 s steps, Alt for 10 ms).
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <TimeInput label="Start" value={sel.start} max={sel.end} onCommit={(v) => changeSel({ start: v, end: sel.end })} />
              <TimeInput label="End" value={sel.end} min={sel.start} max={dur} onCommit={(v) => changeSel({ start: sel.start, end: v })} />
              <div>
                <p className="text-sm font-medium text-ink">Selection length</p>
                <p className="mt-2 flex h-11 items-center tabular-nums text-ink-2">{formatTime(len)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {player.playing ? (
                <Btn variant="ghost" icon="pause" onClick={player.stop}>
                  Stop
                </Btn>
              ) : (
                <>
                  <Btn variant="ghost" icon="play" onClick={() => player.play(audio.pcm, sel.start, sel.end)}>
                    Play selection
                  </Btn>
                  {mode === "remove" && (
                    <Btn variant="ghost" icon="play" onClick={() => player.play(audio.pcm, Math.max(0, sel.start - 2), sel.start)}>
                      Play 2 s before cut
                    </Btn>
                  )}
                  {cursor !== null && (
                    <Btn variant="subtle" icon="play" onClick={() => player.play(audio.pcm, cursor)}>
                      Play from {formatTime(cursor, 1)}
                    </Btn>
                  )}
                </>
              )}
            </div>
            <div className="space-y-3">
              <Segmented
                label="What to do with the selection"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setResult(null);
                }}
                options={[
                  { value: "keep", label: "Keep selection" },
                  { value: "remove", label: "Remove selection" },
                ]}
              />
              <Checkbox
                label="Smooth the cut points"
                hint="Adds 10 ms fades at the edges so the cut does not click."
                checked={fades}
                onChange={(v) => {
                  setFades(v);
                  setResult(null);
                }}
              />
            </div>
            {outLen < 0.01 ? (
              <Notice tone="error">That would leave no audio. Adjust the selection.</Notice>
            ) : (
              <Btn icon="scissors" onClick={apply}>
                {mode === "keep" ? "Trim to selection" : "Cut out selection"} ({formatTime(outLen, 1)})
              </Btn>
            )}
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
      {audio && result && (
        <ToolPanel>
          <AudioResult pcm={result} fileName={`${baseName(audio.file.name)}-trimmed`} title="Trimmed audio" />
        </ToolPanel>
      )}
    </div>
  );
}
