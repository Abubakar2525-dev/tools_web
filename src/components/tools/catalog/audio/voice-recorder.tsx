"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Btn, Checkbox, Notice, PrivacyNote, ToolPanel } from "@/components/tools/kit";
import { ProgressBar, downloadBlob, formatBytes, useObjectUrl } from "@/components/tools/engines/files";
import { formatTime } from "./lib/pcm";
import { FormatPicker } from "./shared/Export";
import { decodeFile, encodeAudio, errorText, type ExportFormat, type Mp3Bitrate } from "./shared/browser";

type Status = "idle" | "requesting" | "recording" | "paused" | "done";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm", "audio/ogg"];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function extFor(mime: string) {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("aac")) return "m4a";
  return "webm";
}

const noopSubscribe = () => () => undefined;

function micError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access was blocked. Allow the microphone for this site in your browser's address bar or site settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found. Connect one and try again.";
  if (name === "NotReadableError") return "The microphone is in use by another app or could not be started. Close other apps using it and retry.";
  return errorText(e, "Could not start recording.");
}

export default function Tool() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(-90);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [echo, setEcho] = useState(true);
  const [noise, setNoise] = useState(true);
  const [format, setFormat] = useState<ExportFormat>("mp3");
  const [bitrate, setBitrate] = useState<Mp3Bitrate>(128);
  const [converting, setConverting] = useState<number | null>(null);
  const url = useObjectUrl(blob);

  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const clock = useRef({ base: 0, startedAt: 0 });
  const mimeRef = useRef("");

  const teardown = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    ctx.current?.close().catch(() => undefined);
    ctx.current = null;
  };

  useEffect(
    () => () => {
      if (rec.current && rec.current.state !== "inactive") {
        rec.current.ondataavailable = null;
        rec.current.onstop = null;
        rec.current.stop();
      }
      teardown();
    },
    [],
  );

  const supported = useSyncExternalStore(
    noopSubscribe,
    () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    () => true,
  );

  const start = async () => {
    setError(null);
    if (!window.isSecureContext) {
      setError("Recording needs a secure (https) page.");
      return;
    }
    setStatus("requesting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: echo, noiseSuppression: noise, autoGainControl: noise } });
      stream.current = s;
      const mime = pickMime();
      const r = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
      mimeRef.current = r.mimeType || mime || "audio/webm";
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        setBlob(new Blob(chunks, { type: mimeRef.current }));
        setStatus("done");
        teardown();
      };
      rec.current = r;

      const ac = new AudioContext();
      ctx.current = ac;
      const an = ac.createAnalyser();
      an.fftSize = 2048;
      ac.createMediaStreamSource(s).connect(an);
      const buf = new Float32Array(an.fftSize);
      let last = 0;
      const tick = (t: number) => {
        if (t - last > 50) {
          last = t;
          an.getFloatTimeDomainData(buf);
          let p = 0;
          for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]));
          setLevel(p > 0 ? Math.max(-90, 20 * Math.log10(p)) : -90);
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);

      r.start(1000);
      setBlob(null);
      clock.current = { base: 0, startedAt: performance.now() };
      setElapsed(0);
      timer.current = window.setInterval(() => {
        if (rec.current?.state === "recording") setElapsed(clock.current.base + (performance.now() - clock.current.startedAt) / 1000);
      }, 200);
      setStatus("recording");
    } catch (e) {
      teardown();
      setStatus("idle");
      setError(micError(e));
    }
  };

  const pause = () => {
    const r = rec.current;
    if (!r || r.state !== "recording") return;
    r.pause();
    clock.current.base += (performance.now() - clock.current.startedAt) / 1000;
    setElapsed(clock.current.base);
    setStatus("paused");
  };
  const resume = () => {
    const r = rec.current;
    if (!r || r.state !== "paused") return;
    r.resume();
    clock.current.startedAt = performance.now();
    setStatus("recording");
  };
  const stop = () => {
    const r = rec.current;
    if (!r || r.state === "inactive") return;
    if (r.state === "recording") clock.current.base += (performance.now() - clock.current.startedAt) / 1000;
    setElapsed(clock.current.base);
    r.stop();
  };
  const discard = () => {
    setBlob(null);
    setStatus("idle");
    setElapsed(0);
  };

  const stamp = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `recording-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  };

  const convert = async () => {
    if (!blob) return;
    setError(null);
    setConverting(0);
    try {
      const { pcm } = await decodeFile(blob);
      setConverting(0.2);
      const out = await encodeAudio(pcm, format, bitrate, { onProgress: (p) => setConverting(0.2 + p * 0.8) });
      downloadBlob(out.blob, `${stamp()}.${out.ext}`);
    } catch (e) {
      setError(errorText(e, "Could not convert the recording."));
    } finally {
      setConverting(null);
    }
  };

  const active = status === "recording" || status === "paused";
  const meterPct = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));

  return (
    <ToolPanel title="Voice recorder">
      {!supported ? (
        <Notice tone="error">This browser cannot record audio (MediaRecorder is not available). Try a current version of Chrome, Edge, Firefox or Safari.</Notice>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-4 rounded-xl bg-sunken px-4 py-8 text-center">
            <p className="font-display text-[3rem] font-semibold leading-none tabular-nums text-ink" aria-live="off">
              {formatTime(elapsed, 1)}
            </p>
            <p className="text-sm text-ink-2" role="status">
              {status === "idle" && "Ready to record"}
              {status === "requesting" && "Waiting for microphone permission…"}
              {status === "recording" && "Recording"}
              {status === "paused" && "Paused"}
              {status === "done" && "Recording finished"}
            </p>
            {active && (
              <div className="w-full max-w-sm">
                <div
                  role="meter"
                  aria-label="Input level"
                  aria-valuemin={-60}
                  aria-valuemax={0}
                  aria-valuenow={Math.round(level)}
                  aria-valuetext={`${Math.round(level)} dBFS${level > -1 ? ", clipping" : ""}`}
                  className="h-3 overflow-hidden rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--line)]"
                >
                  <div className={`h-full ${level > -3 ? "bg-danger" : "bg-accent"}`} style={{ width: `${meterPct}%` }} />
                </div>
                <p className="mt-1 text-[0.8125rem] tabular-nums text-muted">
                  Level {Math.round(level)} dBFS{level > -3 ? " (too hot, move back from the mic)" : ""}
                </p>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {(status === "idle" || status === "done") && (
                <Btn icon="mic" onClick={start}>
                  {status === "done" ? "Record again" : "Start recording"}
                </Btn>
              )}
              {status === "recording" && (
                <Btn variant="ghost" icon="pause" onClick={pause}>
                  Pause
                </Btn>
              )}
              {status === "paused" && (
                <Btn variant="ghost" icon="play" onClick={resume}>
                  Resume
                </Btn>
              )}
              {active && (
                <Btn variant="danger" icon="check" onClick={stop}>
                  Stop
                </Btn>
              )}
            </div>
          </div>
          {status === "idle" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Checkbox label="Echo cancellation" checked={echo} onChange={setEcho} />
              <Checkbox label="Noise suppression and auto gain" hint="Turn off for music or to capture the raw signal." checked={noise} onChange={setNoise} />
            </div>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {status === "done" && blob && url && (
            <div className="space-y-4">
              <audio controls src={url} className="w-full" aria-label="Recording playback" />
              <p className="text-sm text-ink-2">
                {formatTime(elapsed, 1)} · {formatBytes(blob.size)} · {blob.type.split(";")[0]}
              </p>
              <div className="flex flex-wrap gap-2">
                <Btn icon="download" variant="ghost" onClick={() => downloadBlob(blob, `${stamp()}.${extFor(blob.type)}`)}>
                  Download original (.{extFor(blob.type)})
                </Btn>
                <Btn variant="subtle" icon="trash" onClick={discard}>
                  Discard
                </Btn>
              </div>
              <div className="space-y-3 rounded-xl bg-sunken p-4">
                <p className="text-sm font-medium text-ink">Convert and download</p>
                <FormatPicker format={format} bitrate={bitrate} onFormat={setFormat} onBitrate={setBitrate} />
                {converting !== null ? (
                  <ProgressBar value={converting} label="Converting" />
                ) : (
                  <Btn icon="download" onClick={convert}>
                    Download {format === "mp3" ? "MP3" : "WAV"}
                  </Btn>
                )}
              </div>
            </div>
          )}
          <p className="text-[0.8125rem] text-muted">The recording stays in this tab until you download it. Closing or reloading the page discards it.</p>
          <PrivacyNote />
        </div>
      )}
    </ToolPanel>
  );
}
