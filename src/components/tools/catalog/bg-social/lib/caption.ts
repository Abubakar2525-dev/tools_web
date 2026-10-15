/**
 * Caption cleanup for social posts (pure functions).
 *
 * Some apps drop empty lines or trailing spaces in captions. A line that
 * contains only an invisible "spacer" character survives, so paragraphs stay
 * apart. The default spacer is U+2800 (Braille pattern blank), which renders
 * as an empty cell in every major app.
 */

export const SPACERS = {
  braille: { char: "⠀", label: "Braille blank (U+2800)" },
  hangul: { char: "ㅤ", label: "Hangul filler (U+3164)" },
  dot: { char: ".", label: "Visible dot" },
  none: { char: "", label: "No spacer (keep empty lines)" },
} as const;

export type SpacerKey = keyof typeof SPACERS;

export const BULLETS = {
  keep: "",
  dot: "• ",
  arrow: "→ ",
  check: "✓ ",
  dash: "– ",
  numbered: "#",
} as const;

export type BulletKey = keyof typeof BULLETS;

export interface CaptionOptions {
  spacer: SpacerKey;
  /** Collapse runs of blank lines into one. */
  collapseBlank: boolean;
  bullets: BulletKey;
  /** Remove hashtags from the body and append them as one block at the end. */
  moveHashtags: boolean;
  dedupeHashtags: boolean;
  /** Drop tags made only of digits (platforms do not link them). */
  dropNumericTags: boolean;
  lowercaseTags: boolean;
  /** Keep at most this many hashtags (null = no cap). */
  maxHashtags: number | null;
  /** Insert this many spacer lines between the body and the hashtag block. */
  hashtagGap: number;
  trimLines: boolean;
}

export const DEFAULT_CAPTION_OPTIONS: CaptionOptions = {
  spacer: "braille",
  collapseBlank: true,
  bullets: "keep",
  moveHashtags: true,
  dedupeHashtags: true,
  dropNumericTags: true,
  lowercaseTags: false,
  maxHashtags: null,
  hashtagGap: 1,
  trimLines: true,
};

export interface CaptionResult {
  text: string;
  hashtags: string[];
  removedTags: string[];
  blankLinesFilled: number;
}

const TAG_RE = new RegExp("(^|[^\\p{L}\\p{N}_&#])#([\\p{L}\\p{M}\\p{N}_]+)", "gu");
const LIST_RE = /^(\s*)(?:[-*+•▪◦‣→✓–]|\d{1,3}[.)])\s+(.*)$/;

/** Returns hashtags (without "#") in order of appearance. */
export function extractHashtags(text: string): string[] {
  return Array.from(text.matchAll(TAG_RE), (m) => m[2]);
}

function isSpacerOnly(line: string) {
  const bare = line.replace(/[\s⠀ㅤ​ ]/g, "");
  return bare === "" || bare === ".";
}

export function formatCaption(input: string, opts: CaptionOptions): CaptionResult {
  const spacer = SPACERS[opts.spacer].char;
  let text = input.replace(/\r\n?/g, "\n");

  // 1. Hashtags: collect, optionally strip from the body.
  const allTags = extractHashtags(text);
  if (opts.moveHashtags) {
    text = text.replace(TAG_RE, (_m, pre: string) => pre);
    // tidy the gaps the removal left behind
    text = text
      .split("\n")
      .map((l) => l.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, ""))
      .join("\n");
  }

  const seen = new Set<string>();
  const kept: string[] = [];
  const removed: string[] = [];
  for (const raw of allTags) {
    const tag = opts.lowercaseTags ? raw.toLowerCase() : raw;
    const key = tag.toLowerCase();
    if (opts.dropNumericTags && /^\d+$/.test(tag)) {
      removed.push(tag);
      continue;
    }
    if (opts.dedupeHashtags && seen.has(key)) {
      removed.push(tag);
      continue;
    }
    seen.add(key);
    kept.push(tag);
  }
  let finalTags = kept;
  if (opts.maxHashtags !== null && kept.length > opts.maxHashtags) {
    finalTags = kept.slice(0, Math.max(0, opts.maxHashtags));
    removed.push(...kept.slice(finalTags.length));
  }

  // 2. Lines: trim, bullets, blank lines.
  let lines = text.split("\n");
  if (opts.trimLines) lines = lines.map((l) => l.replace(/[ \t ]+$/g, "").replace(/^[ \t]+/g, ""));
  if (opts.bullets !== "keep") {
    let n = 0;
    lines = lines.map((l) => {
      const m = LIST_RE.exec(l);
      if (!m) {
        if (l.trim() === "") n = 0;
        return l;
      }
      n += 1;
      const mark = opts.bullets === "numbered" ? `${n}. ` : BULLETS[opts.bullets];
      return `${m[1]}${mark}${m[2]}`;
    });
  }
  // remove leading/trailing blank lines
  while (lines.length && isSpacerOnly(lines[0])) lines.shift();
  while (lines.length && isSpacerOnly(lines[lines.length - 1])) lines.pop();

  const outLines: string[] = [];
  let filled = 0;
  for (const l of lines) {
    const blank = isSpacerOnly(l);
    if (blank) {
      const prevBlank = outLines.length > 0 && outLines[outLines.length - 1] === spacer;
      if (opts.collapseBlank && prevBlank) continue;
      outLines.push(spacer);
      filled++;
    } else outLines.push(l);
  }

  // 3. Hashtag block.
  if (opts.moveHashtags && finalTags.length) {
    if (outLines.length) for (let i = 0; i < Math.max(0, opts.hashtagGap); i++) outLines.push(spacer);
    outLines.push(finalTags.map((t) => `#${t}`).join(" "));
  } else if (!opts.moveHashtags && removed.length) {
    // remove dropped/duplicate tags in place, from the end so earlier ones stay
    const drop = new Map<string, number>();
    for (const t of removed) drop.set(t.toLowerCase(), (drop.get(t.toLowerCase()) ?? 0) + 1);
    const joined = outLines.join("\n");
    const matches = Array.from(joined.matchAll(TAG_RE));
    let result = joined;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const key = (opts.lowercaseTags ? m[2].toLowerCase() : m[2]).toLowerCase();
      const left = drop.get(key) ?? 0;
      if (left > 0) {
        drop.set(key, left - 1);
        const start = (m.index ?? 0) + m[1].length;
        result = result.slice(0, start) + result.slice(start + m[2].length + 1);
      }
    }
    const tidy = result.split("\n").map((l) => l.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, ""));
    outLines.length = 0;
    outLines.push(...tidy);
  }

  let out = outLines.join("\n");
  if (opts.lowercaseTags && !opts.moveHashtags) {
    out = out.replace(TAG_RE, (_m, pre: string, tag: string) => `${pre}#${tag.toLowerCase()}`);
  }
  // with no spacer, blank lines are kept as truly empty lines
  return { text: out, hashtags: finalTags, removedTags: removed, blankLinesFilled: spacer ? filled : 0 };
}
