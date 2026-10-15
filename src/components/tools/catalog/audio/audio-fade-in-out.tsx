"use client";

import { useMemo, useState } from "react";
import { Btn, Notice, NumberField, PrivacyNote, SelectField, ToolPanel, parseNum } from "@/components/tools/kit";
import { baseName } from "@/components/tools/engines/files";
import { applyFades, durationOf, fadeCurve, formatTime, type FadeShape, type Pcm } from "./lib/pcm";
import { AudioFileInput, useAudioFile } from "./shared/useAudioFile";
import { Waveform } from "./shared/Waveform";
import { usePlayer } from "./shared/usePlayer";
import { AudioResult } from "./shared/Export";
import { useKeyed } from "./shared/useKeyed";

const SHAPES: { value: FadeShape; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "exponential", label: "Exponential (slow start)" },
  { value: "logarithmic", label: "Logarithmic (fast start)" },
  { value: "s-curve", label: "S-curve" },
];

function CurvePreview({ inShape, outShape, fi, fo, dur }: { inShape: FadeShape; outShape: FadeShape; fi: number; fo: number; dur: number }) {
  const W = 320;
  const H = 80;
  const pts: string[] = [];
  const N = 160;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * dur;
    let g = 1;
    if (fi > 0 && t < fi) g *= fadeCurve(inShape, t / fi);
    if (fo > 0 && t > dur - fo) g *= fadeCurve(outShape, (dur - t) / fo);
    pts.push(`${((i / N) * W).toFixed(1)},${(H - 4 - g * (H - 8)).toFixed(1)}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full rounded-lg bg-sunken" role="img" aria-label={`Gain envelope: ${fi}s ${inShape} fade in, ${fo}s ${outShape} fade out over ${formatTime(dur, 1)}`} preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Tool() {
  const src = useAudioFile();
  const audio = src.audio;
  const dur = audio ? durationOf(audio.pcm) : 0;
  const [fadeIn, setFadeIn] = useState("2");
  const [fadeOut, setFadeOut] = useState("3");
  const [inShape, setInShape] = useState<FadeShape>("s-curve");
  const [outShape, setOutShape] = useState<FadeShape>("s-curve");
  const [result, setResult] = useKeyed<Pcm | null>(audio, () => null);
  const player = usePlayer();

  const fi = parseNum(fadeIn);
  const fo = parseNum(fadeOut);
  const fiErr = fi === null || fi < 0 ? "Enter 0 or more seconds." : audio && fi > dur ? "Longer than the audio." : null;
  const foErr = fo === null || fo < 0 ? "Enter 0 or more seconds." : audio && fo > dur ? "Longer than the audio." : null;
  const overlap = !fiErr && !foErr && audio && (fi as number) + (fo as number) > dur;

  const faded = useMemo(() => {
    if (!audio || fiErr || foErr) return null;
    return applyFades(audio.pcm, { fadeIn: fi as number, fadeOut: fo as number, inShape, outShape });
  }, [audio, fi, fo, inShape, outShape, fiErr, foErr]);

  const changed = (fn: () => void) => () => {
    fn();
    setResult(null);
    player.stop();
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Fade in and fade out">
        <AudioFileInput state={src.state} onFile={src.load} onClear={src.clear} />
        {audio && (
          <div className="mt-6 space-y-5">
            <Waveform pcm={faded ?? audio.pcm} label={`Waveform of ${audio.file.name} with fades applied`} playhead={player.position} height={120} />
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Fade in (seconds)" value={fadeIn} onChange={(e) => changed(() => setFadeIn(e.target.value))()} error={fiErr} />
              <SelectField label="Fade-in shape" value={inShape} onChange={(e) => changed(() => setInShape(e.target.value as FadeShape))()} options={SHAPES} />
              <NumberField label="Fade out (seconds)" value={fadeOut} onChange={(e) => changed(() => setFadeOut(e.target.value))()} error={foErr} />
              <SelectField label="Fade-out shape" value={outShape} onChange={(e) => changed(() => setOutShape(e.target.value as FadeShape))()} options={SHAPES} />
            </div>
            {!fiErr && !foErr && <CurvePreview inShape={inShape} outShape={outShape} fi={fi as number} fo={fo as number} dur={dur} />}
            {overlap && <Notice tone="info">The fades overlap, so the middle never reaches full volume.</Notice>}
            {faded && (
              <div className="flex flex-wrap gap-2">
                {player.playing ? (
                  <Btn variant="ghost" icon="pause" onClick={player.stop}>
                    Stop
                  </Btn>
                ) : (
                  <>
                    <Btn variant="ghost" icon="play" onClick={() => player.play(faded, 0, Math.min(dur, (fi as number) + 2))}>
                      Preview fade in
                    </Btn>
                    <Btn variant="ghost" icon="play" onClick={() => player.play(faded, Math.max(0, dur - (fo as number) - 2))}>
                      Preview fade out
                    </Btn>
                  </>
                )}
                <Btn icon="check" onClick={() => setResult(faded)}>
                  Use these fades
                </Btn>
              </div>
            )}
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
      {audio && result && (
        <ToolPanel>
          <AudioResult pcm={result} fileName={`${baseName(audio.file.name)}-faded`} title="Faded audio" />
        </ToolPanel>
      )}
    </div>
  );
}
