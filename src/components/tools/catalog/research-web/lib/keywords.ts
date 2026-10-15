/**
 * Keyword density. Density = occurrences ÷ total words × 100, for single
 * words and for phrases alike (a phrase occurrence counts once).
 */

export const EN_STOP = new Set(
  (
    "a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves " +
    "also may might must shall can't don't it's i'm you're we're they're isn't aren't wasn't weren't won't let's one two us get got"
  ).split(/\s+/),
);

/** Lowercased word tokens; keeps internal apostrophes and hyphens ("don't", "e-mail"). */
export function tokenize(text: string): string[] {
  const m = text.toLowerCase().replace(/’/g, "'").match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu);
  return m ?? [];
}

export interface Ngram {
  phrase: string;
  count: number;
  density: number;
}

export function ngrams(words: string[], n: number, opts: { stop: boolean; minLength: number; limit: number }): Ngram[] {
  const total = words.length;
  if (!total) return [];
  const counts = new Map<string, number>();
  for (let i = 0; i + n <= words.length; i++) {
    const g = words.slice(i, i + n);
    if (opts.stop) {
      // Skip grams that start or end with a stop word, or are all stop words.
      if (EN_STOP.has(g[0]) || EN_STOP.has(g[n - 1])) continue;
    }
    if (n === 1 && g[0].length < opts.minLength) continue;
    if (n === 1 && /^\d+$/.test(g[0])) continue;
    const key = g.join(" ");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => n === 1 || c > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, opts.limit)
    .map(([phrase, count]) => ({ phrase, count, density: (count / total) * 100 }));
}

/** Occurrences of a target phrase as whole words. */
export function countPhrase(words: string[], phrase: string): number {
  const target = tokenize(phrase);
  if (!target.length) return 0;
  let c = 0;
  outer: for (let i = 0; i + target.length <= words.length; i++) {
    for (let j = 0; j < target.length; j++) if (words[i + j] !== target[j]) continue outer;
    c++;
  }
  return c;
}

export const containsPhrase = (text: string, phrase: string) => countPhrase(tokenize(text), phrase) > 0;

export interface PageParts {
  text: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  headings: number;
  imagesWithoutAlt: number;
}
