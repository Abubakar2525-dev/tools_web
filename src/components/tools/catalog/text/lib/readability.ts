/**
 * English readability formulas with a rule-based syllable estimate.
 * Self-contained for direct Node testing.
 */

/** Words whose syllable count the vowel-group rule gets wrong often enough to list. */
const SYLLABLE_EXCEPTIONS: Record<string, number> = {
  the: 1, every: 3, different: 3, business: 2, people: 2, area: 3, idea: 3, real: 1, being: 2, create: 2,
  created: 3, science: 2, quiet: 2, poem: 2, lion: 2, violin: 3, diet: 2, fire: 1, hour: 1, our: 1,
  family: 3, evening: 2, interesting: 3, chocolate: 3, comfortable: 4, vegetable: 4, naturally: 4,
  something: 2, sometimes: 2, somewhere: 2, someone: 2, whole: 1, while: 1, are: 1, were: 1, there: 1,
  where: 1, here: 1, more: 1, before: 2, maybe: 2, simile: 3, recipe: 3, apostrophe: 4, epitome: 4,
  cafe: 2, naive: 2, video: 3, radio: 3, studio: 3, ratio: 3, reality: 4, usually: 4, actually: 4,
  readability: 5, ability: 4, society: 4, variety: 4, anxiety: 4, piano: 3, iodine: 3, onion: 2,
};

/**
 * Estimates syllables in an English word:
 * 1. Use the exception list when present.
 * 2. Drop a silent final "e" (but keep consonant + "le", as in "table"),
 *    and the "es"/"ed" endings that don't add a syllable ("jumped", "makes").
 * 3. Count groups of consecutive vowels (a, e, i, o, u, y), treating a leading y as a consonant.
 * 4. Add one for common vowel splits ("io" in "-tion" excluded, "ia", "eo", "ua", "uo").
 * Always returns at least 1.
 */
export function countSyllables(raw: string): number {
  const word = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (SYLLABLE_EXCEPTIONS[word] !== undefined) return SYLLABLE_EXCEPTIONS[word];
  if (word.length <= 3) return 1;
  let w = word;
  if (/[^aeiouy]le$/.test(w)) {
    // "table" → "tab" + "le" syllable
    return Math.max(1, vowelGroups(w.slice(0, -2)) + 1);
  }
  if (/(?:[sxzcg]|ch|sh)es$/.test(w)) {
    // "boxes", "places", "pages": the -es is its own syllable; keep it.
  } else if (/[^aeiouy]es$/.test(w)) w = w.slice(0, -2);
  else if (/[^td]ed$/.test(w)) w = w.slice(0, -2);
  else if (/[^aeiouy]e$/.test(w) && vowelGroups(w.slice(0, -1)) > 0) w = w.slice(0, -1);
  w = w.replace(/^y/, "");
  let n = vowelGroups(w);
  // Vowel pairs that are usually split across two syllables.
  const splits = w.match(/[aeiou]?(ia|eo|ua|uo|iu|ii|ea(?=ble|t)|io(?!n))/g);
  if (splits) n += splits.length;
  if (/[^aeiouy]ism$/.test(w)) n += 1;
  return Math.max(1, n);
}

function vowelGroups(w: string): number {
  return (w.match(/[aeiouy]+/g) ?? []).length;
}

export function splitSentences(text: string): string[] {
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    // Common abbreviations should not end a sentence.
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|approx|No|Fig|Inc|Ltd|Co)\./gi, (m) => m.replace(/\./g, "․"));
  const parts = cleaned
    .split(/(?<=[.!?…]["'”’)\]]*)\s+(?=["'“‘(\[]?[\p{Lu}\p{N}])|\n\s*\n|\n(?=\s*[-*•]\s)/u)
    .map((s) => s.replace(/․/g, ".").replace(/\s+/g, " ").trim())
    .filter((s) => /\p{L}|\p{N}/u.test(s));
  return parts;
}

export function wordsOf(sentence: string): string[] {
  return sentence.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu) ?? [];
}

export type SentenceInfo = { text: string; words: number; complexWords: number; syllables: number };

export type ReadabilityResult = {
  sentences: number;
  words: number;
  syllables: number;
  letters: number;
  complexWords: number;
  polysyllables: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  gunningFog: number;
  smog: number;
  colemanLiau: number;
  ari: number;
  sentenceList: SentenceInfo[];
};

const COMMON_SUFFIX = /(es|ed|ing)$/;

/**
 * Computes all scores. "Complex" words (Gunning fog) have 3+ syllables, not
 * counting capitalized words mid-sentence (likely proper nouns), hyphenated
 * compounds, or words that only reach 3 syllables through -es/-ed/-ing.
 */
export function analyzeReadability(text: string): ReadabilityResult | null {
  const sentences = splitSentences(text);
  let words = 0;
  let syllables = 0;
  let letters = 0;
  let complexWords = 0;
  let polysyllables = 0;
  const sentenceList: SentenceInfo[] = [];
  for (const s of sentences) {
    const ws = wordsOf(s);
    if (!ws.length) continue;
    let sSyl = 0;
    let sComplex = 0;
    ws.forEach((w, i) => {
      const syl = countSyllables(w);
      sSyl += syl;
      letters += (w.match(/[\p{L}\p{N}]/gu) ?? []).length;
      if (syl >= 3) {
        polysyllables++;
        const proper = i > 0 && /^\p{Lu}/u.test(w);
        const compound = w.includes("-");
        const suffixOnly = COMMON_SUFFIX.test(w.toLowerCase()) && countSyllables(w.toLowerCase().replace(COMMON_SUFFIX, "")) < 3;
        if (!proper && !compound && !suffixOnly) sComplex++;
      }
    });
    words += ws.length;
    syllables += sSyl;
    complexWords += sComplex;
    sentenceList.push({ text: s, words: ws.length, complexWords: sComplex, syllables: sSyl });
  }
  const sCount = sentenceList.length;
  if (!words || !sCount) return null;
  const wps = words / sCount;
  const spw = syllables / words;
  const L = (letters / words) * 100;
  const S = (sCount / words) * 100;
  return {
    sentences: sCount,
    words,
    syllables,
    letters,
    complexWords,
    polysyllables,
    avgWordsPerSentence: wps,
    avgSyllablesPerWord: spw,
    fleschReadingEase: 206.835 - 1.015 * wps - 84.6 * spw,
    fleschKincaidGrade: 0.39 * wps + 11.8 * spw - 15.59,
    gunningFog: 0.4 * (wps + 100 * (complexWords / words)),
    smog: 1.043 * Math.sqrt(polysyllables * (30 / sCount)) + 3.1291,
    colemanLiau: 0.0588 * L - 0.296 * S - 15.8,
    ari: 4.71 * (letters / words) + 0.5 * wps - 21.43,
    sentenceList,
  };
}

/** Plain-language band for a Flesch reading ease score. */
export function easeBand(score: number): string {
  if (score >= 90) return "Very easy";
  if (score >= 80) return "Easy";
  if (score >= 70) return "Fairly easy";
  if (score >= 60) return "Plain English";
  if (score >= 50) return "Fairly difficult";
  if (score >= 30) return "Difficult";
  return "Very difficult";
}
