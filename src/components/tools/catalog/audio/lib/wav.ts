/**
 * RIFF/WAVE encoder (and a small decoder used for tests and fallbacks).
 * 16-bit and 24-bit integer PCM (format 1) or 32-bit IEEE float (format 3).
 */
import type { Pcm } from "./pcm";

export type WavDepth = 16 | 24 | 32;

export function encodeWav(a: Pcm, depth: WavDepth = 16): Uint8Array<ArrayBuffer> {
  const chs = a.channels.length;
  const n = a.channels[0]?.length ?? 0;
  const bytesPer = depth / 8;
  const isFloat = depth === 32;
  const dataSize = n * chs * bytesPer;
  // 32-bit float uses WAVE_FORMAT_IEEE_FLOAT with an 18-byte fmt chunk and a fact chunk.
  const fmtSize = isFloat ? 18 : 16;
  const factSize = isFloat ? 12 : 0;
  const header = 12 + 8 + fmtSize + factSize + 8;
  const buf = new ArrayBuffer(header + dataSize + (dataSize % 2));
  const v = new DataView(buf);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, buf.byteLength - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, fmtSize, true);
  v.setUint16(20, isFloat ? 3 : 1, true);
  v.setUint16(22, chs, true);
  v.setUint32(24, a.sampleRate, true);
  v.setUint32(28, a.sampleRate * chs * bytesPer, true);
  v.setUint16(32, chs * bytesPer, true);
  v.setUint16(34, depth, true);
  let off = 36;
  if (isFloat) {
    v.setUint16(36, 0, true); // cbSize
    off = 38;
    ascii(off, "fact");
    v.setUint32(off + 4, 4, true);
    v.setUint32(off + 8, n, true);
    off += 12;
  }
  ascii(off, "data");
  v.setUint32(off + 4, dataSize, true);
  off += 8;
  const c = a.channels;
  if (depth === 16) {
    for (let i = 0; i < n; i++)
      for (let ch = 0; ch < chs; ch++) {
        const s = Math.max(-1, Math.min(1, c[ch][i]));
        v.setInt16(off, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
        off += 2;
      }
  } else if (depth === 24) {
    for (let i = 0; i < n; i++)
      for (let ch = 0; ch < chs; ch++) {
        const s = Math.max(-1, Math.min(1, c[ch][i]));
        let x = s < 0 ? Math.round(s * 8388608) : Math.round(s * 8388607);
        if (x < 0) x += 0x1000000;
        v.setUint8(off, x & 0xff);
        v.setUint8(off + 1, (x >> 8) & 0xff);
        v.setUint8(off + 2, (x >> 16) & 0xff);
        off += 3;
      }
  } else {
    for (let i = 0; i < n; i++)
      for (let ch = 0; ch < chs; ch++) {
        v.setFloat32(off, c[ch][i], true);
        off += 4;
      }
  }
  return new Uint8Array(buf);
}

/** Minimal WAV reader (PCM 8/16/24/32 and float 32/64). Returns null if unsupported. */
export function decodeWav(bytes: Uint8Array): Pcm | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (bytes.length < 12 || str(0) !== "RIFF" || str(8) !== "WAVE") return null;
  let off = 12;
  let fmt = 0,
    chs = 0,
    sr = 0,
    bits = 0;
  while (off + 8 <= bytes.length) {
    const id = str(off);
    const size = v.getUint32(off + 4, true);
    const body = off + 8;
    if (id === "fmt ") {
      fmt = v.getUint16(body, true);
      chs = v.getUint16(body + 2, true);
      sr = v.getUint32(body + 4, true);
      bits = v.getUint16(body + 14, true);
      if (fmt === 0xfffe && size >= 26) fmt = v.getUint16(body + 24, true);
    } else if (id === "data") {
      if (!chs || !bits) return null;
      const bps = bits / 8;
      const end = Math.min(bytes.length, body + size);
      const n = Math.floor((end - body) / (bps * chs));
      const out = Array.from({ length: chs }, () => new Float32Array(n));
      let p = body;
      for (let i = 0; i < n; i++)
        for (let c = 0; c < chs; c++) {
          let s: number;
          if (fmt === 3 && bits === 32) s = v.getFloat32(p, true);
          else if (fmt === 3 && bits === 64) s = v.getFloat64(p, true);
          else if (bits === 8) s = (v.getUint8(p) - 128) / 128;
          else if (bits === 16) s = v.getInt16(p, true) / 32768;
          else if (bits === 24) {
            let x = v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getUint8(p + 2) << 16);
            if (x & 0x800000) x -= 0x1000000;
            s = x / 8388608;
          } else if (bits === 32) s = v.getInt32(p, true) / 2147483648;
          else return null;
          out[c][i] = s;
          p += bps;
        }
      return { sampleRate: sr, channels: out };
    }
    off = body + size + (size % 2);
  }
  return null;
}
