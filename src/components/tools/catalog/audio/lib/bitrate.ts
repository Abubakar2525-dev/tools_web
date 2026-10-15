/**
 * Audio bitrate / size / duration relationships.
 * size (bytes) = bitrate (bits per second) × duration (s) / 8
 * PCM bitrate = sample rate × bit depth × channels
 */

export const sizeBytes = (bps: number, seconds: number) => (bps * seconds) / 8;
export const bitrateFrom = (bytes: number, seconds: number) => (bytes * 8) / seconds;
export const durationFrom = (bytes: number, bps: number) => (bytes * 8) / bps;
export const pcmBitrate = (sampleRate: number, bitDepth: number, channels: number) => sampleRate * bitDepth * channels;

/** Constant or nominal bitrates for comparison. FLAC is a content-dependent range. */
export const COMPARISON: { label: string; kbps: number | [number, number]; note: string }[] = [
  { label: "Opus 96 kbps", kbps: 96, note: "Lossy, efficient" },
  { label: "AAC 128 kbps", kbps: 128, note: "Lossy" },
  { label: "MP3 128 kbps", kbps: 128, note: "Lossy" },
  { label: "MP3 192 kbps", kbps: 192, note: "Lossy" },
  { label: "AAC 256 kbps", kbps: 256, note: "Lossy" },
  { label: "MP3 320 kbps", kbps: 320, note: "Lossy, MP3 maximum" },
  { label: "FLAC (16-bit, 44.1 kHz stereo)", kbps: [600, 1000], note: "Lossless; varies with the music" },
  { label: "WAV 16-bit, 44.1 kHz stereo", kbps: 1411.2, note: "Uncompressed (CD quality)" },
  { label: "WAV 24-bit, 48 kHz stereo", kbps: 2304, note: "Uncompressed" },
];

/** Human-readable size using decimal (MB = 1,000,000 bytes) units. */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return "∞";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec)) return "∞";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h} h ${m} min ${r} s` : m ? `${m} min ${r} s` : `${r} s`;
}
