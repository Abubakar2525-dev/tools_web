/** Word and phrase frequency. Self-contained for direct Node testing. */

/**
 * Original English stop-word list: articles, pronouns, auxiliaries,
 * prepositions, conjunctions and very common adverbs.
 */
export const STOP_WORDS = new Set(
  `a about above after again against all almost also although always am among an and another any anyone anything are
around as at away back be because been before being below between both but by can cannot could did do does doing done
down during each either else enough even ever every few for from further get gets got had has have having he her here
hers herself him himself his how however i if in into is it its itself just least less let like many may me might mine
more most much must my myself near neither never no nobody none nor not nothing now of off often on once one only onto
or other others our ours ourselves out over own per perhaps quite rather really same she should since so some someone
something still such than that the their theirs them themselves then there these they this those though through thus
to too toward towards under until up upon us very via was we well were what whatever when where whether which while who
whom whose why will with within without would yet you your yours yourself yourselves it's i'm i've i'd i'll you're
you've you'll you'd he's she's we're we've we'll they're they've they'll that's there's what's let's isn't aren't
wasn't weren't don't doesn't didn't can't couldn't won't wouldn't shouldn't hasn't haven't hadn't`
    .split(/\s+/)
    .filter(Boolean),
);

export type FreqOptions = {
  n: 1 | 2 | 3;
  caseSensitive?: boolean;
  excludeStopWords?: boolean;
  minLength?: number;
  includeNumbers?: boolean;
};

export type FreqRow = { term: string; count: number; percent: number };

/** Splits into sentence-like chunks so phrases do not span sentence breaks. */
function chunks(text: string): string[] {
  return text.split(/[.!?;:()\[\]{}"“”\n]+|\s[-–—]\s/);
}

export function tokenize(chunk: string, includeNumbers = true): string[] {
  const words = chunk.replace(/’/g, "'").match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu) ?? [];
  return includeNumbers ? words : words.filter((w) => !/^[\p{N}.,-]+$/u.test(w));
}

export function frequency(text: string, o: FreqOptions): { rows: FreqRow[]; totalTokens: number; totalWords: number; unique: number } {
  const counts = new Map<string, number>();
  const display = new Map<string, string>();
  let totalTokens = 0;
  let totalWords = 0;
  const minLen = o.minLength ?? 1;
  for (const c of chunks(text)) {
    const words = tokenize(c, o.includeNumbers !== false);
    totalWords += words.length;
    for (let i = 0; i + o.n <= words.length; i++) {
      const gram = words.slice(i, i + o.n);
      const lower = gram.map((w) => w.toLocaleLowerCase());
      if (o.excludeStopWords) {
        if (o.n === 1 && STOP_WORDS.has(lower[0])) continue;
        if (o.n > 1 && (STOP_WORDS.has(lower[0]) || STOP_WORDS.has(lower[lower.length - 1]))) continue;
      }
      if (o.n === 1 && Array.from(gram[0]).length < minLen) continue;
      const key = o.caseSensitive ? gram.join(" ") : lower.join(" ");
      totalTokens++;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!display.has(key)) display.set(key, key);
    }
  }
  const rows = [...counts.entries()]
    .map(([term, count]) => ({ term: display.get(term) ?? term, count, percent: totalTokens ? (count / totalTokens) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  return { rows, totalTokens, totalWords, unique: rows.length };
}

/** RFC 4180 style CSV with a header row. */
export function frequencyCsv(rows: FreqRow[]): string {
  const q = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ["term,count,percent", ...rows.map((r) => `${q(r.term)},${r.count},${r.percent.toFixed(3)}`)].join("\r\n");
}
