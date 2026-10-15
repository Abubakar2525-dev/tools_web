/** Text cleaning helpers. Self-contained for direct Node testing. */

/** Zero-width, soft hyphen, BOM, word joiner and bidirectional control characters. */
export const INVISIBLE_RE = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁦-⁯﻿ㅤﾠ]/g;

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®", trade: "™",
  hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•",
  middot: "·", deg: "°", euro: "€", pound: "£", yen: "¥", cent: "¢", sect: "§", para: "¶", times: "×", divide: "÷",
};

/** Decodes numeric and common named HTML entities. Unknown names are left as typed. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const cp = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED[body.toLowerCase()] ?? m;
  });
}

/** Rough tag stripper for pasted snippets: drops script/style blocks and comments, keeps text. */
export function stripTags(s: string): string {
  return decodeEntities(
    s
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre|section|article)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

export type CleanOptions = {
  invisible?: boolean;
  nbsp?: boolean;
  html?: boolean;
  smartQuotes?: boolean;
  dashes?: boolean;
  ellipsis?: boolean;
  collapseSpaces?: boolean;
  trimLines?: boolean;
  rejoin?: boolean;
  collapseBlank?: boolean;
};

/** Joins hard-wrapped lines inside paragraphs; blank lines and list items keep their breaks. */
export function rejoinLines(text: string): string {
  const paras = text.split(/\n[ \t]*\n/);
  return paras
    .map((p) => {
      const lines = p.split("\n");
      let out = "";
      for (const raw of lines) {
        const line = raw.trim();
        const isListItem = /^([-*•]|\d+[.)])\s/.test(line);
        if (!out) out = line;
        else if (isListItem) out += "\n" + line;
        else if (/\p{L}-$/u.test(out) && /^\p{Ll}/u.test(line)) out = out.slice(0, -1) + line;
        else out += " " + line;
      }
      return out;
    })
    .join("\n\n");
}

export function cleanText(input: string, o: CleanOptions): { output: string; changes: Record<string, number> } {
  const changes: Record<string, number> = {};
  const count = (key: string, re: RegExp, s: string) => {
    const n = s.match(re)?.length ?? 0;
    if (n) changes[key] = (changes[key] ?? 0) + n;
  };
  let t = input.replace(/\r\n?/g, "\n");
  if (o.html) {
    count("HTML tags", /<[^>]+>/g, t);
    t = stripTags(t);
  }
  if (o.invisible) {
    count("Invisible characters", INVISIBLE_RE, t);
    t = t.replace(INVISIBLE_RE, "");
  }
  if (o.nbsp) {
    count("Non-breaking spaces", /[   ]/g, t);
    t = t.replace(/[   ]/g, " ");
  }
  if (o.smartQuotes) {
    count("Smart quotes", /[‘’‚‛′“”„‟″«»]/g, t);
    t = t.replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″«»]/g, '"');
  }
  if (o.dashes) {
    count("Dashes", /[‐‑‒–—―]/g, t);
    t = t.replace(/[‐‑‒–]/g, "-").replace(/[—―]/g, "--");
  }
  if (o.ellipsis) {
    count("Ellipsis characters", /…/g, t);
    t = t.replace(/…/g, "...");
  }
  if (o.trimLines) t = t.replace(/^[ \t]+|[ \t]+$/gm, "");
  if (o.rejoin) t = rejoinLines(t);
  if (o.collapseSpaces) {
    count("Extra spaces", /[ \t]{2,}/g, t);
    t = t.replace(/[ \t]{2,}/g, " ");
  }
  if (o.collapseBlank) {
    count("Extra blank lines", /\n{3,}/g, t);
    t = t.replace(/\n[ \t]*(\n[ \t]*)+\n/g, "\n\n");
  }
  return { output: t, changes };
}
