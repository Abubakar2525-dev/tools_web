"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Btn, CopyBtn, Notice, NumberField, PrivacyNote, ResetBtn, Segmented, SplitGrid, TextArea, ToolPanel, downloadFile, fmt, parseNum } from "@/components/tools/kit";
import { morseSchedule, morseToText, scheduleDuration, textToMorse } from "./lib/morse";

type Dir = "encode" | "decode";

export default function Tool() {
  const [dir, setDir] = useState<Dir>("encode");
  const [input, setInput] = useState("");
  const [wpm, setWpm] = useState("20");
  const [fwpm, setFwpm] = useState("");
  const [freq, setFreq] = useState("600");
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const deferred = useDeferredValue(input);

  const res = useMemo(() => {
    if (!deferred.trim()) return null;
    try {
      return dir === "encode" ? textToMorse(deferred) : morseToText(deferred);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not translate." };
    }
  }, [deferred, dir]);

  const output = res && "output" in res ? res.output : "";
  const morse = dir === "encode" ? output : deferred.trim();

  const w = parseNum(wpm);
  const wErr = w === null || w < 5 || w > 60 ? "5 to 60" : null;
  const fw = fwpm.trim() ? parseNum(fwpm) : null;
  const fwErr = fwpm.trim() && (fw === null || fw < 2 || (w !== null && fw > w)) ? "2 up to character speed" : null;
  const f = parseNum(freq);
  const fErr = f === null || f < 200 || f > 1500 ? "200 to 1500 Hz" : null;

  const schedule = useMemo(() => (!wErr && !fwErr && morse ? morseSchedule(morse.replace(/[^.\-/\s]/g, ""), w ?? 20, fw ?? undefined) : []), [morse, w, fw, wErr, fwErr]);
  const duration = scheduleDuration(schedule);

  const stop = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx) void ctx.close().catch(() => undefined);
    setPlaying(false);
  };

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    void ctxRef.current?.close().catch(() => undefined);
  }, []);

  const play = () => {
    stop();
    setAudioError(null);
    if (!schedule.length) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) {
      setAudioError("This browser does not support Web Audio playback.");
      return;
    }
    const ctx = new AC();
    ctxRef.current = ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f ?? 600;
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    let t = ctx.currentTime + 0.05;
    const ramp = 0.004; // short ramps avoid clicks
    for (const s of schedule) {
      if (s.on) {
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + ramp);
        gain.gain.setValueAtTime(0.4, t + s.seconds - ramp);
        gain.gain.linearRampToValueAtTime(0, t + s.seconds);
      }
      t += s.seconds;
    }
    osc.start();
    osc.stop(t + 0.05);
    setPlaying(true);
    timerRef.current = window.setTimeout(stop, (t - ctx.currentTime + 0.15) * 1000);
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Translate"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => setInput(dir === "encode" ? "SOS. Meet at 9 PM?" : "... --- ... / .... . .-.. .-.. ---")}>
              Load sample
            </Btn>
            <ResetBtn
              onClick={() => {
                stop();
                setInput("");
              }}
            />
          </>
        }
      >
        <div className="space-y-5">
          <Segmented
            label="Direction"
            value={dir}
            onChange={(d) => {
              stop();
              if (output) setInput(output);
              setDir(d);
            }}
            options={[
              { value: "encode", label: "Text to Morse" },
              { value: "decode", label: "Morse to text" },
            ]}
          />
          <SplitGrid>
            <TextArea
              label={dir === "encode" ? "Text" : "Morse code"}
              hint={dir === "encode" ? "Letters, digits and common punctuation." : "Use . and -, a space between letters and / between words."}
              mono={dir === "decode"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={8}
            />
            <div className="min-w-0">
              <TextArea label={dir === "encode" ? "Morse code" : "Text"} mono={dir === "encode"} readOnly value={output} rows={8} placeholder="The translation appears here." />
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyBtn text={output} />
                <Btn variant="ghost" icon="download" disabled={!output} onClick={() => downloadFile(dir === "encode" ? "morse.txt" : "decoded.txt", output)}>
                  Download
                </Btn>
              </div>
            </div>
          </SplitGrid>
          {res && "error" in res && <Notice tone="error">{res.error}</Notice>}
          {res && "unknown" in res && res.unknown.length > 0 && (
            <Notice tone="warning">
              {dir === "encode" ? "No Morse code for: " : "Unknown codes (shown as �): "}
              <span className="font-mono">{res.unknown.join("  ")}</span>
            </Notice>
          )}
        </div>
      </ToolPanel>

      <ToolPanel title="Listen">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="Character speed (WPM)" value={wpm} onChange={(e) => setWpm(e.target.value)} error={wErr} />
            <NumberField
              label="Farnsworth speed (WPM)"
              optional
              hint="Slower overall speed: letters stay fast, gaps get longer."
              value={fwpm}
              onChange={(e) => setFwpm(e.target.value)}
              error={fwErr}
            />
            <NumberField label="Tone (Hz)" value={freq} onChange={(e) => setFreq(e.target.value)} error={fErr} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Btn icon="play" onClick={play} disabled={!schedule.length || !!fErr || playing}>
              Play
            </Btn>
            <Btn variant="ghost" icon="pause" onClick={stop} disabled={!playing}>
              Stop
            </Btn>
            <span className="text-sm text-ink-2" aria-live="polite">
              {playing ? "Playing…" : schedule.length ? `Length: ${fmt(duration, 1)} s` : "Nothing to play yet."}
            </span>
          </div>
          {audioError && <Notice tone="error">{audioError}</Notice>}
          <p className="text-[0.8125rem] text-muted">Audio only, with no flashing light. Check your volume before pressing Play.</p>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
