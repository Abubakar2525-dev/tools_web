"use client";

import { FormulaTool, num, type FormulaSpec, type UnitOption } from "@/components/tools/engines/FormulaTool";
import { COMPARISON, bitrateFrom, durationFrom, formatDuration, formatSize, pcmBitrate, sizeBytes } from "./lib/bitrate";

const bitrateUnits: UnitOption[] = [
  { value: "kbps", label: "kbps", factor: 1000 },
  { value: "Mbps", label: "Mbps", factor: 1e6 },
  { value: "bps", label: "bit/s", factor: 1 },
];
const durationUnits: UnitOption[] = [
  { value: "min", label: "minutes", factor: 60 },
  { value: "s", label: "seconds", factor: 1 },
  { value: "h", label: "hours", factor: 3600 },
];
const sizeUnits: UnitOption[] = [
  { value: "MB", label: "MB", factor: 1e6 },
  { value: "GB", label: "GB", factor: 1e9 },
  { value: "KB", label: "KB", factor: 1e3 },
  { value: "MiB", label: "MiB", factor: 1048576 },
];

function comparison(seconds: number) {
  return {
    caption: `Approximate size of ${formatDuration(seconds)} of audio (decimal units)`,
    columns: ["Format", "Bitrate", "Size"],
    rows: COMPARISON.map((c) =>
      Array.isArray(c.kbps)
        ? [c.label, `${c.kbps[0]}-${c.kbps[1]} kbps`, `${formatSize(sizeBytes(c.kbps[0] * 1000, seconds))} to ${formatSize(sizeBytes(c.kbps[1] * 1000, seconds))}`]
        : [c.label, `${num(c.kbps)} kbps`, formatSize(sizeBytes(c.kbps * 1000, seconds))],
    ),
  };
}

const spec: FormulaSpec = {
  modes: [
    { id: "size", label: "File size", fields: ["bitrate", "duration"] },
    { id: "bitrate", label: "Bitrate", fields: ["size", "duration"] },
    { id: "duration", label: "Duration", fields: ["size", "bitrate"] },
    { id: "pcm", label: "Uncompressed (PCM)", fields: ["rate", "depth", "channels", "duration"] },
  ],
  fields: [
    { id: "bitrate", label: "Bitrate", type: "number", units: bitrateUnits, gt: 0 },
    { id: "duration", label: "Duration", type: "number", units: durationUnits, gt: 0 },
    { id: "size", label: "File size", type: "number", units: sizeUnits, gt: 0 },
    {
      id: "rate",
      label: "Sample rate",
      type: "select",
      options: ["44100", "48000", "96000", "192000", "22050", "16000", "8000"].map((v) => ({ value: v, label: `${Number(v) / 1000} kHz` })),
    },
    {
      id: "depth",
      label: "Bit depth",
      type: "select",
      options: [
        { value: "16", label: "16-bit" },
        { value: "24", label: "24-bit" },
        { value: "32", label: "32-bit (float)" },
        { value: "8", label: "8-bit" },
      ],
    },
    {
      id: "channels",
      label: "Channels",
      type: "select",
      options: [
        { value: "2", label: "Stereo (2)" },
        { value: "1", label: "Mono (1)" },
        { value: "6", label: "5.1 surround (6)" },
      ],
    },
  ],
  defaults: { bitrate: "192", duration: "4", size: "10", "duration:unit": "min" },
  example: { bitrate: "320", duration: "60", size: "100" },
  lead: (
    <>
      File size = bitrate × duration ÷ 8. Results ignore container overhead and tags (cover art can add a few hundred KB).
    </>
  ),
  compute: (v) => {
    if (v.mode === "pcm") {
      const sr = Number(v.str("rate"));
      const bd = Number(v.str("depth"));
      const ch = Number(v.str("channels"));
      const t = v.num("duration");
      if (t === null) return null;
      const bps = pcmBitrate(sr, bd, ch);
      const bytes = sizeBytes(bps, t);
      return {
        outputs: [
          { label: "File size", value: formatSize(bytes), primary: true, note: `${num(bytes, 12)} bytes of audio data (WAV adds a 44-byte header)` },
          { label: "Bitrate", value: `${num(bps / 1000)} kbps` },
          { label: "Per minute", value: formatSize(sizeBytes(bps, 60)) },
        ],
        steps: [`Bitrate = ${sr} Hz × ${bd} bit × ${ch} ch = ${num(bps)} bit/s`, `Size = ${num(bps)} × ${num(t)} s ÷ 8 = ${num(bytes, 12)} bytes`],
        table: comparison(t),
      };
    }
    if (v.mode === "size") {
      const b = v.num("bitrate");
      const t = v.num("duration");
      if (b === null || t === null) return null;
      const bytes = sizeBytes(b, t);
      return {
        outputs: [
          { label: "File size", value: formatSize(bytes), primary: true, note: `${num(bytes / 1048576, 4)} MiB` },
          { label: "Bytes", value: num(Math.round(bytes), 15) },
          { label: "Per minute", value: formatSize(sizeBytes(b, 60)) },
        ],
        steps: [`Size = ${num(b)} bit/s × ${num(t)} s ÷ 8 = ${num(bytes, 12)} bytes`],
        table: comparison(t),
      };
    }
    if (v.mode === "bitrate") {
      const s = v.num("size");
      const t = v.num("duration");
      if (s === null || t === null) return null;
      const bps = bitrateFrom(s, t);
      return {
        outputs: [
          { label: "Average bitrate", value: `${num(bps / 1000, 5)} kbps`, primary: true },
          { label: "Bytes per second", value: num(bps / 8, 6) },
        ],
        steps: [`Bitrate = ${num(s, 12)} bytes × 8 ÷ ${num(t)} s = ${num(bps, 8)} bit/s`],
        notes: bps > 2304000 * 2 ? ["That is higher than typical stereo audio. Check the units, or the file may contain video."] : undefined,
        table: comparison(t),
      };
    }
    const s = v.num("size");
    const b = v.num("bitrate");
    if (s === null || b === null) return null;
    const t = durationFrom(s, b);
    return {
      outputs: [
        { label: "Duration", value: formatDuration(t), primary: true },
        { label: "Seconds", value: num(t, 6) },
        { label: "Minutes", value: num(t / 60, 6) },
      ],
      steps: [`Duration = ${num(s, 12)} bytes × 8 ÷ ${num(b)} bit/s = ${num(t, 8)} s`],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
