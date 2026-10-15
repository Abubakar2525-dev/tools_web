/**
 * Waveform summaries (min/max per bucket) and SVG rendering for the
 * waveform image generator.
 */

export type Peaks = { min: Float32Array; max: Float32Array };

/** Min/max per bucket over a time range of a channel set (channels mixed by max/min across them). */
export function computePeaks(channels: Float32Array[], buckets: number, startFrame = 0, endFrame?: number): Peaks {
  const n = channels[0]?.length ?? 0;
  const s = Math.max(0, Math.min(n, Math.floor(startFrame)));
  const e = Math.max(s, Math.min(n, Math.ceil(endFrame ?? n)));
  const b = Math.max(1, Math.floor(buckets));
  const min = new Float32Array(b);
  const max = new Float32Array(b);
  const span = (e - s) / b;
  for (let i = 0; i < b; i++) {
    const a0 = s + Math.floor(i * span);
    const a1 = Math.max(a0 + 1, Math.min(e, s + Math.floor((i + 1) * span)));
    let lo = 0,
      hi = 0;
    if (a0 < e) {
      lo = Infinity;
      hi = -Infinity;
      // Stride through very long buckets to stay fast; still catches the envelope well.
      const stride = Math.max(1, Math.floor((a1 - a0) / 4096));
      for (const c of channels)
        for (let k = a0; k < a1; k += stride) {
          const v = c[k];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
    }
    min[i] = lo;
    max[i] = hi;
  }
  return { min, max };
}

/** RMS per bucket (mixed across channels), 0..1. */
export function computeRms(channels: Float32Array[], buckets: number): Float32Array {
  const n = channels[0]?.length ?? 0;
  const b = Math.max(1, Math.floor(buckets));
  const out = new Float32Array(b);
  const span = n / b;
  for (let i = 0; i < b; i++) {
    const a0 = Math.floor(i * span);
    const a1 = Math.max(a0 + 1, Math.min(n, Math.floor((i + 1) * span)));
    let ss = 0;
    let cnt = 0;
    for (const c of channels)
      for (let k = a0; k < a1 && k < n; k++) {
        ss += c[k] * c[k];
        cnt++;
      }
    out[i] = cnt ? Math.sqrt(ss / cnt) : 0;
  }
  return out;
}

export type WaveStyle = {
  width: number;
  height: number;
  style: "bars" | "line" | "mirror-line";
  /** Bars only. */
  barWidth: number;
  barGap: number;
  barRadius: number;
  color: string;
  background: string | null;
  /** Scale so the loudest point reaches the full height. */
  normalize: boolean;
  /** Use peak (max abs) or RMS for bar heights. */
  measure: "peak" | "rms";
};

export type WaveShape =
  | { kind: "bars"; bars: { x: number; y: number; w: number; h: number }[] }
  | { kind: "path"; d: string; fill: boolean };

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Geometry shared by the canvas preview and the SVG export. */
export function waveShape(channels: Float32Array[], s: WaveStyle): WaveShape {
  const mid = s.height / 2;
  if (s.style === "bars") {
    const step = Math.max(1, s.barWidth + s.barGap);
    const count = Math.max(1, Math.floor((s.width + s.barGap) / step));
    const values =
      s.measure === "rms"
        ? computeRms(channels, count)
        : (() => {
            const p = computePeaks(channels, count);
            const v = new Float32Array(count);
            for (let i = 0; i < count; i++) v[i] = Math.max(Math.abs(p.min[i]), Math.abs(p.max[i]));
            return v;
          })();
    let top = 0;
    for (const v of values) if (v > top) top = v;
    const k = s.normalize && top > 0 ? 1 / top : 1;
    const used = count * step - s.barGap;
    const x0 = (s.width - used) / 2;
    const bars = Array.from(values, (v, i) => {
      const h = Math.max(1, Math.min(s.height, v * k * s.height));
      return { x: r2(x0 + i * step), y: r2(mid - h / 2), w: s.barWidth, h: r2(h) };
    });
    return { kind: "bars", bars };
  }
  const cols = Math.max(2, Math.floor(s.width));
  const p = computePeaks(channels, cols);
  let top = 0;
  for (let i = 0; i < cols; i++) top = Math.max(top, Math.abs(p.min[i]), Math.abs(p.max[i]));
  const k = s.normalize && top > 0 ? 1 / top : 1;
  const amp = (s.height / 2) * 0.98;
  if (s.style === "mirror-line") {
    const upper: string[] = [];
    const lower: string[] = [];
    for (let i = 0; i < cols; i++) {
      const x = r2((i / (cols - 1)) * s.width);
      upper.push(`${x},${r2(mid - Math.max(0.5, p.max[i] * k * amp))}`);
      lower.push(`${x},${r2(mid - Math.min(-0.5, p.min[i] * k * amp))}`);
    }
    return { kind: "path", d: `M${upper.join("L")}L${lower.reverse().join("L")}Z`, fill: true };
  }
  // line: centre line through the bucket average of min/max envelope
  const pts: string[] = [];
  for (let i = 0; i < cols; i++) {
    const x = r2((i / (cols - 1)) * s.width);
    const v = Math.abs(p.max[i]) >= Math.abs(p.min[i]) ? p.max[i] : p.min[i];
    pts.push(`${x},${r2(mid - v * k * amp)}`);
  }
  return { kind: "path", d: `M${pts.join("L")}`, fill: false };
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string);

export function waveSvg(shape: WaveShape, s: WaveStyle, title: string): string {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s.width}" height="${s.height}" viewBox="0 0 ${s.width} ${s.height}" role="img" aria-label="${esc(title)}">`,
  );
  parts.push(`<title>${esc(title)}</title>`);
  if (s.background) parts.push(`<rect width="100%" height="100%" fill="${esc(s.background)}"/>`);
  if (shape.kind === "bars") {
    parts.push(`<g fill="${esc(s.color)}">`);
    for (const b of shape.bars) {
      const rx = Math.min(s.barRadius, b.w / 2, b.h / 2);
      parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"${rx > 0 ? ` rx="${r2(rx)}"` : ""}/>`);
    }
    parts.push(`</g>`);
  } else if (shape.fill) parts.push(`<path d="${shape.d}" fill="${esc(s.color)}"/>`);
  else parts.push(`<path d="${shape.d}" fill="none" stroke="${esc(s.color)}" stroke-width="1.5" stroke-linejoin="round"/>`);
  parts.push(`</svg>`);
  return parts.join("");
}
