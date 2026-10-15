"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Notice } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, formatBytes } from "@/components/tools/engines/files";
import type { Pcm } from "../lib/pcm";
import { formatTime } from "../lib/pcm";
import { AUDIO_ACCEPT, LARGE_FILE_MB, decodeFile, errorText, isAbort, type DecodedInfo } from "./browser";

export type LoadedAudio = { file: File; pcm: Pcm; info: DecodedInfo };

export type AudioFileState =
  | { status: "empty" }
  | { status: "decoding"; file: File }
  | { status: "ready"; audio: LoadedAudio }
  | { status: "error"; file: File; message: string };

/** Picks one audio file and decodes it, with cancellation on replace/unmount. */
export function useAudioFile() {
  const [state, setState] = useState<AudioFileState>({ status: "empty" });
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const load = useCallback(async (file: File) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState({ status: "decoding", file });
    try {
      const { pcm, info } = await decodeFile(file, c.signal);
      if (!c.signal.aborted) setState({ status: "ready", audio: { file, pcm, info } });
    } catch (e) {
      if (isAbort(e) || c.signal.aborted) return;
      setState({ status: "error", file, message: errorText(e, "This file could not be decoded.") });
    }
  }, []);

  const clear = useCallback(() => {
    ctrl.current?.abort();
    setState({ status: "empty" });
  }, []);

  return { state, load, clear, audio: state.status === "ready" ? state.audio : null };
}

/** File picker + decode status + summary chip. */
export function AudioFileInput({
  state,
  onFile,
  onClear,
  maxSizeMB = 1024,
  label = "Choose an audio file or drop it here",
}: {
  state: AudioFileState;
  onFile: (f: File) => void;
  onClear: () => void;
  maxSizeMB?: number;
  label?: string;
}) {
  if (state.status === "empty")
    return (
      <FileDrop
        accept={AUDIO_ACCEPT}
        maxSizeMB={maxSizeMB}
        label={label}
        hint={`MP3, WAV, FLAC, OGG, M4A and more (whatever your browser can decode). Up to ${maxSizeMB >= 1024 ? `${maxSizeMB / 1024} GB` : `${maxSizeMB} MB`}.`}
        onFiles={(f) => f[0] && onFile(f[0])}
      />
    );
  const file = state.status === "ready" ? state.audio.file : state.file;
  const large = file.size > LARGE_FILE_MB * 1024 * 1024;
  return (
    <div className="space-y-3">
      <FileChip
        file={file}
        onRemove={onClear}
        extra={
          state.status === "ready" ? (
            <span className="hidden shrink-0 tabular-nums text-muted sm:inline">
              {formatTime(state.audio.info.duration, 1)} · {state.audio.info.sampleRate / 1000} kHz ·{" "}
              {state.audio.info.channels === 1 ? "mono" : state.audio.info.channels === 2 ? "stereo" : `${state.audio.info.channels} ch`}
            </span>
          ) : undefined
        }
      />
      {large && state.status !== "error" && (
        <Notice tone="warning">
          This file is {formatBytes(file.size)}. Decoded audio takes several times more memory than the compressed file, so the tab may slow down or run out of memory.
        </Notice>
      )}
      {state.status === "decoding" && <Spinner label="Decoding audio" />}
      {state.status === "error" && (
        <Notice tone="error" title="Could not open this file">
          {state.message}
        </Notice>
      )}
    </div>
  );
}
