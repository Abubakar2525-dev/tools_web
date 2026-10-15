/**
 * Browser-only audio helpers: decoding with the Web Audio API, MP3 encoding
 * with wasm-media-encoders (loaded on demand) and AudioBuffer conversion.
 */
import { frames, resample, toChannelCount, type Pcm, type ProgressOpts } from "../lib/pcm";
import { decodeWav, encodeWav, type WavDepth } from "../lib/wav";

export const AUDIO_ACCEPT =
  "audio/*,.mp3,.wav,.wave,.ogg,.oga,.opus,.flac,.m4a,.aac,.mp4,.webm,.weba,.aif,.aiff,.caf";

/** Above this, decoding may exhaust memory on phones and some laptops. */
export const LARGE_FILE_MB = 200;

export type DecodedInfo = {
  sampleRate: number;
  channels: number;
  duration: number;
  /** True when the browser decoder converted the sample rate. */
  resampled: boolean;
};

let sharedCtx: AudioContext | null = null;

/** One AudioContext for playback across a tool (browsers limit how many can exist). */
export function getAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new AudioContext();
  return sharedCtx;
}

/** Best-effort native sample rate from the container headers (music-metadata reads headers only). */
async function sniffSampleRate(file: Blob): Promise<number | null> {
  try {
    const { parseBlob } = await import("music-metadata");
    const meta = await parseBlob(file, { duration: false, skipCovers: true, skipPostHeaders: true });
    const sr = meta.format.sampleRate;
    return sr && sr >= 3000 && sr <= 384000 ? sr : null;
  } catch {
    return null;
  }
}

export class DecodeError extends Error {}

/**
 * Decodes an audio file into planar float PCM at its native sample rate when
 * it can be detected. WAV files are parsed directly; everything else goes
 * through the browser's decoder, so supported codecs depend on the browser.
 */
export async function decodeFile(file: Blob, signal?: AbortSignal): Promise<{ pcm: Pcm; info: DecodedInfo }> {
  const buf = await file.arrayBuffer();
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const head = new Uint8Array(buf, 0, Math.min(12, buf.byteLength));
  const isWav = head.length >= 12 && String.fromCharCode(...head.slice(0, 4)) === "RIFF" && String.fromCharCode(...head.slice(8, 12)) === "WAVE";
  if (isWav) {
    const pcm = decodeWav(new Uint8Array(buf));
    if (pcm && frames(pcm) > 0) return { pcm, info: { sampleRate: pcm.sampleRate, channels: pcm.channels.length, duration: frames(pcm) / pcm.sampleRate, resampled: false } };
  }
  const native = await sniffSampleRate(file);
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const rate = native ?? getAudioContext().sampleRate;
  let ab: AudioBuffer;
  try {
    const ctx = new OfflineAudioContext(1, 1, rate);
    ab = await ctx.decodeAudioData(buf);
  } catch {
    try {
      ab = await getAudioContext().decodeAudioData(await file.arrayBuffer());
    } catch {
      throw new DecodeError(
        "Your browser could not decode this file. The codec may not be supported here (for example some AIFF, ALAC or WMA files). Try converting it to WAV, MP3 or FLAC first, or use a different browser.",
      );
    }
  }
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const pcm = audioBufferToPcm(ab);
  if (frames(pcm) === 0) throw new DecodeError("The file decoded to zero samples. It may be empty or damaged.");
  return {
    pcm,
    info: { sampleRate: ab.sampleRate, channels: ab.numberOfChannels, duration: ab.duration, resampled: native === null },
  };
}

export function audioBufferToPcm(ab: AudioBuffer): Pcm {
  const channels: Float32Array[] = [];
  for (let c = 0; c < ab.numberOfChannels; c++) channels.push(ab.getChannelData(c).slice());
  return { sampleRate: ab.sampleRate, channels };
}

const bufferCache = new WeakMap<Pcm, AudioBuffer>();

export function pcmToAudioBuffer(pcm: Pcm): AudioBuffer {
  const hit = bufferCache.get(pcm);
  if (hit) return hit;
  const n = Math.max(1, frames(pcm));
  const ab = new AudioBuffer({ length: n, numberOfChannels: pcm.channels.length, sampleRate: pcm.sampleRate });
  pcm.channels.forEach((c, i) => ab.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  bufferCache.set(pcm, ab);
  return ab;
}

/* ------------------------------------------------------------------ */
/* Encoding                                                            */
/* ------------------------------------------------------------------ */

export type ExportFormat = "wav16" | "wav24" | "wav32" | "mp3";
export const MP3_BITRATES = [96, 128, 160, 192, 256, 320] as const;
export type Mp3Bitrate = (typeof MP3_BITRATES)[number];

const MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000] as const;
type Mp3Rate = (typeof MP3_RATES)[number];

const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0));

/** Encodes to MP3 (CBR). Converts to mono/stereo and a supported sample rate first. */
export async function encodeMp3(pcm: Pcm, bitrate: Mp3Bitrate, opts: ProgressOpts = {}): Promise<Blob> {
  let src = pcm.channels.length > 2 ? toChannelCount(pcm, 2) : pcm;
  if (!(MP3_RATES as readonly number[]).includes(src.sampleRate)) {
    const target = src.sampleRate > 48000 ? (src.sampleRate % 11025 === 0 ? 44100 : 48000) : MP3_RATES.find((r) => r >= src.sampleRate) ?? 48000;
    src = await resample(src, target, { signal: opts.signal, onProgress: (p) => opts.onProgress?.(p * 0.3) });
  }
  const base = src === pcm || src.sampleRate === pcm.sampleRate ? 0 : 0.3;
  const { createMp3Encoder } = await import("wasm-media-encoders");
  const enc = await createMp3Encoder();
  enc.configure({ channels: src.channels.length as 1 | 2, sampleRate: src.sampleRate as Mp3Rate, bitrate });
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const n = frames(src);
  const CH = 1152 * 32;
  for (let i = 0; i < n; i += CH) {
    if (opts.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const chunk = src.channels.map((c) => c.subarray(i, Math.min(n, i + CH)));
    const out = enc.encode(chunk);
    // The returned view points into WebAssembly memory and is reused: copy it.
    if (out.length) parts.push(out.slice());
    if ((i / CH) % 8 === 0) {
      opts.onProgress?.(base + (1 - base) * (i / n));
      await yieldNow();
    }
  }
  const tail = enc.finalize();
  if (tail.length) parts.push(tail.slice());
  opts.onProgress?.(1);
  return new Blob(parts, { type: "audio/mpeg" });
}

export async function encodeAudio(
  pcm: Pcm,
  format: ExportFormat,
  bitrate: Mp3Bitrate = 192,
  opts: ProgressOpts = {},
): Promise<{ blob: Blob; ext: string }> {
  if (format === "mp3") return { blob: await encodeMp3(pcm, bitrate, opts), ext: "mp3" };
  const depth: WavDepth = format === "wav24" ? 24 : format === "wav32" ? 32 : 16;
  return { blob: new Blob([encodeWav(pcm, depth)], { type: "audio/wav" }), ext: "wav" };
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

export function errorText(e: unknown, fallback = "Something went wrong while processing the audio.") {
  if (e instanceof DecodeError) return e.message;
  if (e instanceof RangeError || (e instanceof Error && /memory|allocation/i.test(e.message)))
    return "The browser ran out of memory. Try a shorter or smaller file, or close other tabs.";
  return e instanceof Error && e.message ? `${fallback} (${e.message})` : fallback;
}
