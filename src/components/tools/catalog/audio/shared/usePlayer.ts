"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Pcm } from "../lib/pcm";
import { getAudioContext, pcmToAudioBuffer } from "./browser";

/**
 * Plays a range of a Pcm through Web Audio and reports the playhead
 * position (seconds in the source) while playing.
 */
export function usePlayer() {
  const src = useRef<AudioBufferSourceNode | null>(null);
  const raf = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState<number | null>(null);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    const s = src.current;
    src.current = null;
    if (s) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
    setPlaying(false);
    setPosition(null);
  }, []);

  const play = useCallback(
    async (pcm: Pcm, from = 0, to?: number) => {
      stop();
      const ctx = getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      const buffer = pcmToAudioBuffer(pcm);
      const end = Math.min(buffer.duration, to ?? buffer.duration);
      const start = Math.max(0, Math.min(from, end));
      if (end - start <= 0) return;
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);
      const t0 = ctx.currentTime;
      node.start(0, start, end - start);
      src.current = node;
      setPlaying(true);
      setPosition(start);
      node.onended = () => {
        if (src.current === node) stop();
      };
      const tick = () => {
        if (src.current !== node) return;
        setPosition(Math.min(end, start + (ctx.currentTime - t0)));
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { play, stop, playing, position };
}
