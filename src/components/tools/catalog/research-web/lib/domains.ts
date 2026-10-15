/**
 * Brandable domain name ideas from keywords. Generation only: availability is
 * never checked (that needs a registry or WHOIS/RDAP lookup over the network).
 */
import { transliterate } from "./slug";

export type DomainStyle = "plain" | "prefix" | "suffix" | "combo" | "blend" | "short";

export const DEFAULT_PREFIXES = ["get", "try", "use", "go", "my", "the", "hey", "join", "meet", "hello"];
export const DEFAULT_SUFFIXES = ["hq", "app", "lab", "labs", "hub", "ly", "ify", "io", "base", "kit", "works", "spot", "now", "flow"];
export const COMMON_TLDS = [".com", ".net", ".org", ".io", ".co", ".app", ".dev", ".ai", ".xyz", ".tech", ".studio", ".shop", ".me", ".info"];

export interface DomainIdea {
  label: string;
  style: DomainStyle;
}

export function cleanLabel(s: string): string {
  return transliterate(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** RFC 1035 label rules (after punycode is out of scope): 1-63 chars, letters/digits/hyphen, no leading/trailing hyphen. */
export function validLabel(label: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}

const VOWELS = /[aeiou]/;

/** Joins two words sharing an overlap ("data" + "atlas" → "datatlas"), or a truncated first word. */
export function blend(a: string, b: string): string | null {
  for (let k = Math.min(a.length, b.length) - 1; k >= 2; k--) {
    if (a.slice(-k) === b.slice(0, k)) return a + b.slice(k);
  }
  if (a.length >= 5) {
    const cut = Math.ceil(a.length * 0.6);
    // End the cut after a vowel when possible so it stays pronounceable.
    let end = cut;
    while (end < a.length - 1 && !VOWELS.test(a[end - 1])) end++;
    return a.slice(0, end) + b;
  }
  return null;
}

/** Drops the vowel in a final "er"/"or" ("builder" → "buildr"). */
export function shorten(w: string): string | null {
  if (w.length >= 5 && /[^aeiou](er|or)$/.test(w)) return w.slice(0, -2) + "r";
  return null;
}

export function generateIdeas(
  keywords: string[],
  o: { prefixes: string[]; suffixes: string[]; styles: Set<DomainStyle>; hyphen: boolean; maxLength: number },
): DomainIdea[] {
  const kws = [...new Set(keywords.map(cleanLabel).filter((k) => k.length >= 2))];
  const pre = [...new Set(o.prefixes.map(cleanLabel).filter(Boolean))];
  const suf = [...new Set(o.suffixes.map(cleanLabel).filter(Boolean))];
  const seen = new Set<string>();
  const out: DomainIdea[] = [];
  const add = (parts: string[], style: DomainStyle) => {
    const label = parts.join(o.hyphen && parts.length > 1 ? "-" : "");
    if (!validLabel(label) || label.length > o.maxLength || seen.has(label)) return;
    seen.add(label);
    out.push({ label, style });
  };
  for (const k of kws) {
    if (o.styles.has("plain")) add([k], "plain");
    if (o.styles.has("prefix")) pre.forEach((p) => add([p, k], "prefix"));
    if (o.styles.has("suffix")) suf.forEach((s) => add([k, s], "suffix"));
    if (o.styles.has("short")) {
      const s = shorten(k);
      if (s) add([s], "short");
    }
  }
  for (const a of kws) {
    for (const b of kws) {
      if (a === b) continue;
      if (o.styles.has("combo")) add([a, b], "combo");
      if (o.styles.has("blend")) {
        const bl = blend(a, b);
        if (bl && bl !== a + b) add([bl], "blend");
      }
    }
  }
  return out;
}

/** Deterministic shuffle (mulberry32) so a "shuffle" click is reproducible per seed. */
export function shuffle<T>(arr: T[], seed: number): T[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
