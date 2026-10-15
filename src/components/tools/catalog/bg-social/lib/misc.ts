/** Small pure helpers: quality search, feed truncation, mask levels. */

/* ------------------------------------------------------------------ */
/* Quality search                                                      */
/* ------------------------------------------------------------------ */

export interface QualityResult<T> {
  quality: number;
  result: T;
  size: number;
  /** False when even the lowest quality is over the limit. */
  fits: boolean;
  tries: number;
}

/**
 * Binary-searches the highest encoder quality whose output is at most
 * `maxBytes`. `encode(q)` must return the encoded result and its size.
 * Assumes size grows with quality (true for JPEG/WebP encoders in practice).
 */
export async function searchQuality<T>(
  encode: (q: number) => Promise<{ result: T; size: number }>,
  maxBytes: number,
  { min = 0.3, max = 0.95, steps = 7 }: { min?: number; max?: number; steps?: number } = {},
): Promise<QualityResult<T>> {
  let tries = 1;
  const top = await encode(max);
  if (top.size <= maxBytes) return { quality: max, result: top.result, size: top.size, fits: true, tries };
  let lo = min;
  let hi = max;
  let best: { q: number; result: T; size: number } | null = null;
  const bottom = await encode(min);
  tries++;
  if (bottom.size > maxBytes) return { quality: min, result: bottom.result, size: bottom.size, fits: false, tries };
  best = { q: min, ...bottom };
  for (let i = 0; i < steps; i++) {
    const mid = Math.round(((lo + hi) / 2) * 100) / 100;
    if (mid <= lo || mid >= hi) break;
    const r = await encode(mid);
    tries++;
    if (r.size <= maxBytes) {
      best = { q: mid, ...r };
      lo = mid;
    } else hi = mid;
  }
  return { quality: best.q, result: best.result, size: best.size, fits: true, tries };
}

/* ------------------------------------------------------------------ */
/* Feed truncation                                                     */
/* ------------------------------------------------------------------ */

export interface Fold {
  visible: string;
  truncated: boolean;
}

/**
 * Cuts text the way feeds do: after `maxLines` lines or `maxChars` characters
 * (whichever comes first), backing up to a word boundary when one is close.
 * Characters are counted as Unicode code points.
 */
export function foldText(text: string, maxChars: number, maxLines: number): Fold {
  const t = text.replace(/\s+$/, "");
  const lines = t.split("\n");
  let cut = t;
  let truncated = false;
  if (lines.length > maxLines) {
    cut = lines.slice(0, maxLines).join("\n");
    truncated = true;
  }
  const cps = Array.from(cut);
  if (cps.length > maxChars) {
    let s = cps.slice(0, maxChars).join("");
    const space = s.search(/\s\S*$/);
    if (space > maxChars * 0.6) s = s.slice(0, space);
    cut = s;
    truncated = true;
  }
  return { visible: truncated ? cut.replace(/[\s.,;:]+$/, "") : cut, truncated };
}

/* ------------------------------------------------------------------ */
/* Mask helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Remaps alpha values so `lo` and below become 0 and `hi` and above become
 * 255, with a smoothstep in between. Cleans faint halos and solidifies the
 * subject without hard aliasing.
 */
export function levelsAlpha(alpha: Uint8ClampedArray | Uint8Array, lo: number, hi: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha.length);
  const a = Math.max(0, Math.min(254, lo));
  const b = Math.max(a + 1, Math.min(255, hi));
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    lut[v] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  for (let i = 0; i < alpha.length; i++) out[i] = lut[alpha[i]];
  return out;
}

/** Share of pixels that are mostly opaque (useful to warn "nothing detected"). */
export function opaqueShare(alpha: Uint8ClampedArray | Uint8Array, threshold = 128) {
  if (!alpha.length) return 0;
  let n = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] >= threshold) n++;
  return n / alpha.length;
}

/**
 * Repairs transparent islands fully enclosed by a portrait mask. Lightweight
 * matting models can occasionally punch holes through bright skin, shirts or
 * hair; border-connected transparency is preserved as the real background.
 */
export function repairPortraitAlpha(
  alpha: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  threshold = 24,
  maxHoleFraction = 0.18,
) {
  if (width < 1 || height < 1 || alpha.length !== width * height)
    return new Uint8ClampedArray(alpha);

  const out = new Uint8ClampedArray(alpha);
  const seen = new Uint8Array(alpha.length);
  const queue = new Int32Array(alpha.length);
  const maxHole = Math.max(16, Math.floor(alpha.length * maxHoleFraction));

  for (let start = 0; start < alpha.length; start++) {
    if (seen[start] || alpha[start] >= threshold) continue;
    let head = 0;
    let tail = 0;
    let touchesBorder = false;
    queue[tail++] = start;
    seen[start] = 1;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1)
        touchesBorder = true;

      let next: number;
      if (x > 0) {
        next = index - 1;
        if (!seen[next] && alpha[next] < threshold) {
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
      if (x + 1 < width) {
        next = index + 1;
        if (!seen[next] && alpha[next] < threshold) {
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
      if (y > 0) {
        next = index - width;
        if (!seen[next] && alpha[next] < threshold) {
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
      if (y + 1 < height) {
        next = index + width;
        if (!seen[next] && alpha[next] < threshold) {
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
    }

    if (!touchesBorder && tail <= maxHole)
      for (let i = 0; i < tail; i++) out[queue[i]] = 255;
  }
  return out;
}

/** Hex color "#rrggbb" or "#rgb" validator/normalizer. Returns null when invalid. */
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(s)) return `#${s.split("").map((c) => c + c).join("")}`.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s}`.toLowerCase();
  return null;
}
