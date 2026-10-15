/**
 * Character counting for social posts.
 *
 * `countX` follows the weighted rules of the open-source twitter-text library
 * (configuration v3): text is NFC-normalized, every URL counts as 23,
 * each emoji (including ZWJ sequences, flags and keycaps) counts as 2, code
 * points inside the light ranges count as 1, and everything else counts as 2.
 * The limit is 280 weighted characters.
 *
 * URL detection is a close approximation of twitter-text: links with a
 * scheme always count; bare domains count when they end in a known TLD, and a
 * bare "name.cc" (single label + country code, no path) is not a link.
 */

export const X_CONFIG = {
  maxWeightedLength: 280,
  scale: 100,
  defaultWeight: 200,
  transformedURLLength: 23,
  ranges: [
    { start: 0, end: 4351, weight: 100 },
    { start: 8192, end: 8205, weight: 100 },
    { start: 8208, end: 8223, weight: 100 },
    { start: 8242, end: 8247, weight: 100 },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* TLDs                                                                */
/* ------------------------------------------------------------------ */

const CC_TLDS = new Set(
  (
    "ac ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bm bn bo br bs bt bw by bz " +
    "ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg er es et eu fi fj fk fm " +
    "fo fr ga gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it " +
    "je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn " +
    "mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps " +
    "pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sk sl sm sn so sr ss st su sv sx sy sz tc td tf tg th tj " +
    "tk tl tm tn to tr tt tv tw tz ua ug uk us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw"
  ).split(" "),
);

/** Common generic TLDs (a subset of the ~1,500 that exist). */
const G_TLDS = new Set(
  (
    "com net org edu gov mil int info biz name pro aero coop museum mobi asia tel travel jobs cat app dev page " +
    "blog shop store online site tech xyz club design news live cloud media agency studio digital email link " +
    "space website world today life art company solutions services network systems software academy " +
    "community center team tools work works zone fun games guru expert global group health help host icu " +
    "ltd market marketing money one photo photography pics plus press run social tips top video vip wiki " +
    "google amazon apple microsoft new ninja rocks blue red green pink black land how chat bot inc llc"
  ).split(" "),
);

export function isKnownTld(tld: string) {
  const t = tld.toLowerCase();
  return CC_TLDS.has(t) || G_TLDS.has(t);
}

/* ------------------------------------------------------------------ */
/* URL extraction                                                      */
/* ------------------------------------------------------------------ */

export interface UrlMatch {
  start: number;
  end: number;
  url: string;
}

const TRAILING_CHARS = ".,;:!?'\")]}>";

/** Drops trailing punctuation, keeping a ")" that closes a "(" inside the URL. */
function trimTrailing(url: string) {
  let u = url;
  while (u.length) {
    const last = u[u.length - 1];
    if (!TRAILING_CHARS.includes(last)) break;
    if (last === ")") {
      const open = (u.match(/\(/g) ?? []).length;
      const close = (u.match(/\)/g) ?? []).length;
      if (open >= close) break;
    }
    u = u.slice(0, -1);
  }
  return u;
}

// Built with RegExp() so the TS target (ES2017) doesn't reject lookbehind syntax.
const SCHEME_RE = new RegExp("https?:\\/\\/[^\\s<>\"'\\u3000]+", "giu");
const BARE_RE = new RegExp(
  "(?<![\\w@.\\/\\-#$])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+([a-z]{2,24}))(:\\d{1,5})?(\\/[^\\s<>\"']*)?",
  "giu",
);

/** Finds URLs in `text` (indices are UTF-16 offsets). */
export function findUrls(text: string): UrlMatch[] {
  const out: UrlMatch[] = [];
  const taken = (s: number, e: number) => out.some((u) => s < u.end && e > u.start);

  SCHEME_RE.lastIndex = 0;
  for (let m = SCHEME_RE.exec(text); m; m = SCHEME_RE.exec(text)) {
    const url = trimTrailing(m[0]);
    // need at least one character after "://"
    if (/^https?:\/\/[^/]+/i.test(url)) out.push({ start: m.index, end: m.index + url.length, url });
  }

  BARE_RE.lastIndex = 0;
  for (let m = BARE_RE.exec(text); m; m = BARE_RE.exec(text)) {
    const domain = m[1];
    const tld = m[2];
    const path = m[4] ?? "";
    if (!isKnownTld(tld)) continue;
    const labels = domain.split(".");
    // twitter-text: a single label + ccTLD without a path is not a link ("bit.ly", "readme.md")
    if (!path && labels.length === 2 && CC_TLDS.has(tld.toLowerCase()) && !G_TLDS.has(tld.toLowerCase())) continue;
    const raw = m[0];
    const url = path ? trimTrailing(raw) : raw;
    const start = m.index;
    const end = start + url.length;
    if (taken(start, end)) continue;
    out.push({ start, end, url });
  }
  return out.sort((a, b) => a.start - b.start);
}

/* ------------------------------------------------------------------ */
/* Graphemes and emoji                                                 */
/* ------------------------------------------------------------------ */

const PICTO_RE = new RegExp("\\p{Extended_Pictographic}", "u");
const RI_RE = new RegExp("\\p{Regional_Indicator}", "u");

type SegmenterLike = { segment(s: string): Iterable<{ segment: string; index: number }> };

function getSegmenter(): SegmenterLike | null {
  const I = (globalThis as { Intl?: { Segmenter?: new (l?: string, o?: { granularity: string }) => SegmenterLike } }).Intl;
  return I?.Segmenter ? new I.Segmenter(undefined, { granularity: "grapheme" }) : null;
}

/** Splits into user-perceived characters (falls back to code points). */
export function graphemes(text: string): { segment: string; index: number }[] {
  const seg = getSegmenter();
  if (seg) return Array.from(seg.segment(text), (s) => ({ segment: s.segment, index: s.index }));
  const out: { segment: string; index: number }[] = [];
  let i = 0;
  for (const ch of text) {
    out.push({ segment: ch, index: i });
    i += ch.length;
  }
  return out;
}

/** True when a grapheme cluster renders as an emoji (twemoji-style rules). */
export function isEmoji(g: string): boolean {
  if (g.includes("⃣")) return true; // keycap sequences like 1️⃣
  if (RI_RE.test(g)) return true; // flags
  const hasVs16 = g.includes("️");
  for (const ch of g) {
    if (!PICTO_RE.test(ch)) continue;
    const cp = ch.codePointAt(0) ?? 0;
    // ©, ® and ™ stay text unless followed by the emoji variation selector
    if ((cp === 0xa9 || cp === 0xae || cp === 0x2122) && !hasVs16) continue;
    return true;
  }
  return false;
}

export function countCodePoints(text: string) {
  return Array.from(text).length;
}

/* ------------------------------------------------------------------ */
/* X weighted count                                                    */
/* ------------------------------------------------------------------ */

export function charWeight(cp: number) {
  for (const r of X_CONFIG.ranges) if (cp >= r.start && cp <= r.end) return r.weight;
  return X_CONFIG.defaultWeight;
}

export interface XCount {
  /** Weighted length (what X compares against 280). */
  weighted: number;
  limit: number;
  remaining: number;
  valid: boolean;
  urls: number;
  emoji: number;
  /** Characters that count as 2 (excluding emoji). */
  heavy: number;
  /** UTF-16 index in the normalized text where the limit is exceeded, or -1. */
  overflowAt: number;
  invalidChars: boolean;
  normalized: string;
}

const INVALID_CHARS = /[￾﻿￿]/;

export function countX(text: string, limit: number = X_CONFIG.maxWeightedLength): XCount {
  const normalized = text.normalize("NFC");
  const urls = findUrls(normalized);
  const max = limit * X_CONFIG.scale;
  let weighted = 0;
  let emoji = 0;
  let heavy = 0;
  let overflowAt = -1;

  const add = (w: number, at: number) => {
    weighted += w;
    if (overflowAt < 0 && weighted > max) overflowAt = at;
  };

  let cursor = 0;
  const scan = (from: number, to: number) => {
    const part = normalized.slice(from, to);
    for (const g of graphemes(part)) {
      const at = from + g.index;
      if (isEmoji(g.segment)) {
        emoji++;
        add(X_CONFIG.defaultWeight, at);
        continue;
      }
      let off = 0;
      for (const ch of g.segment) {
        const w = charWeight(ch.codePointAt(0) ?? 0);
        if (w > 100) heavy++;
        add(w, at + off);
        off += ch.length;
      }
    }
  };

  for (const u of urls) {
    scan(cursor, u.start);
    add(X_CONFIG.transformedURLLength * X_CONFIG.scale, u.start);
    cursor = u.end;
  }
  scan(cursor, normalized.length);

  const length = weighted / X_CONFIG.scale;
  const invalidChars = INVALID_CHARS.test(normalized);
  return {
    weighted: length,
    limit,
    remaining: limit - length,
    valid: length <= limit && !invalidChars && normalized.trim().length > 0,
    urls: urls.length,
    emoji,
    heavy,
    overflowAt,
    invalidChars,
    normalized,
  };
}

/* ------------------------------------------------------------------ */
/* Other platforms                                                     */
/* ------------------------------------------------------------------ */

/** Mastodon: every http(s) link counts as 23 characters, whatever its real length. */
export function countMastodon(text: string) {
  let n = 0;
  let cursor = 0;
  const re = new RegExp("https?:\\/\\/[^\\s]+", "gu");
  for (let m = re.exec(text); m; m = re.exec(text)) {
    n += countCodePoints(text.slice(cursor, m.index)) + 23;
    cursor = m.index + m[0].length;
  }
  return n + countCodePoints(text.slice(cursor));
}

export interface TextStats {
  codePoints: number;
  graphemes: number;
  utf16: number;
  bytes: number;
  words: number;
  lines: number;
  hashtags: number;
  mentions: number;
  urls: number;
  emoji: number;
}

const HASHTAG_RE = new RegExp("(?:^|[^\\p{L}\\p{N}_&])#([\\p{L}\\p{M}\\p{N}_]+)", "gu");
const MENTION_RE = new RegExp("(?:^|[^\\p{L}\\p{N}_])@([A-Za-z0-9_.]{1,30})", "gu");

export function textStats(text: string): TextStats {
  const gs = graphemes(text);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return {
    codePoints: countCodePoints(text),
    graphemes: gs.length,
    utf16: text.length,
    bytes: new TextEncoder().encode(text).length,
    words,
    lines: text ? text.split("\n").length : 0,
    hashtags: Array.from(text.matchAll(HASHTAG_RE)).filter((m) => !/^\d+$/.test(m[1])).length,
    mentions: Array.from(text.matchAll(MENTION_RE)).length,
    urls: findUrls(text).length,
    emoji: gs.filter((g) => isEmoji(g.segment)).length,
  };
}

export type CountMethod = "x" | "graphemes" | "codepoints" | "mastodon";

export function countBy(method: CountMethod, text: string, limit?: number): number {
  switch (method) {
    case "x":
      return countX(text, limit).weighted;
    case "graphemes":
      return graphemes(text).length;
    case "mastodon":
      return countMastodon(text);
    default:
      return countCodePoints(text);
  }
}
