"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  SplitGrid,
  StatGrid,
  TextArea,
  ToolPanel,
  fmt,
  parseNum,
  usePersistentState,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Text analysis                                                       */
/* ------------------------------------------------------------------ */

const STOP_WORDS = new Set(
  (
    "a about above after again against all am an and any are aren't as at be because been before being below between both but by " +
    "can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has " +
    "hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in " +
    "into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours " +
    "ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them " +
    "themselves then there there's these they they'd they'll they're they've this those through to too under until up very was " +
    "wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's will " +
    "with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves also just may might must shall us"
  ).split(" "),
);

const LETTER_OR_DIGIT = new RegExp("[\\p{L}\\p{N}]", "u");
const WORD_FALLBACK = new RegExp("[\\p{L}\\p{N}\\p{M}]+(?:['\\u2019\\-.][\\p{L}\\p{N}\\p{M}]+)*", "gu");

type Segmenter = InstanceType<typeof Intl.Segmenter>;
function makeSegmenter(granularity: "word" | "sentence" | "grapheme"): Segmenter | null {
  try {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) return new Intl.Segmenter(undefined, { granularity });
  } catch {
    /* unsupported */
  }
  return null;
}

let segCache: { word: Segmenter | null; sentence: Segmenter | null; grapheme: Segmenter | null } | null = null;
function segmenters() {
  if (!segCache) {
    segCache = { word: makeSegmenter("word"), sentence: makeSegmenter("sentence"), grapheme: makeSegmenter("grapheme") };
  }
  return segCache;
}

function getWords(text: string): string[] {
  const seg = segmenters().word;
  if (seg) {
    const out: string[] = [];
    for (const s of seg.segment(text)) if (s.isWordLike) out.push(s.segment);
    return out;
  }
  return text.match(WORD_FALLBACK) ?? [];
}

function graphemes(text: string): string[] {
  const seg = segmenters().grapheme;
  if (seg) return Array.from(seg.segment(text), (s) => s.segment);
  return Array.from(text);
}

function getSentences(text: string): string[] {
  const seg = segmenters().sentence;
  let parts: string[];
  if (seg) parts = Array.from(seg.segment(text), (s) => s.segment);
  else
    parts = text
      .replace(/([.!?…。！？]+["'”’)\]]*)\s+/g, "$1\n\n")
      .split(/\n\s*\n/);
  return parts.map((s) => s.trim()).filter((s) => LETTER_OR_DIGIT.test(s));
}

type Stats = {
  words: number;
  chars: number;
  charsNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  avgWordLen: number;
  avgSentenceLen: number;
  longest: { words: number; text: string } | null;
  longSentences: number;
  wordList: string[];
};

function analyze(text: string): Stats {
  const words = getWords(text);
  const g = graphemes(text);
  const charsNoSpaces = g.filter((c) => !/^\s+$/.test(c)).length;
  const sentences = getSentences(text);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
  const letters = words.reduce((n, w) => n + graphemes(w).length, 0);

  let longest: Stats["longest"] = null;
  let longSentences = 0;
  for (const s of sentences) {
    const n = getWords(s).length;
    if (n > 35) longSentences++;
    if (!longest || n > longest.words) longest = { words: n, text: s };
  }

  return {
    words: words.length,
    chars: g.length,
    charsNoSpaces,
    sentences: sentences.length,
    paragraphs,
    lines,
    avgWordLen: words.length ? letters / words.length : 0,
    avgSentenceLen: sentences.length ? words.length / sentences.length : 0,
    longest,
    longSentences,
    wordList: words,
  };
}

function duration(words: number, wpm: number) {
  if (words === 0) return "0 sec";
  const totalSec = Math.round((words / wpm) * 60);
  if (totalSec < 60) return `${Math.max(1, totalSec)} sec`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h} hr ${m % 60} min`;
  }
  return s ? `${m} min ${s} sec` : `${m} min`;
}

function topWords(words: string[], excludeStop: boolean) {
  const counts = new Map<string, number>();
  for (const w of words) {
    const k = w.toLocaleLowerCase().replace(/’/g, "'");
    if (excludeStop && STOP_WORDS.has(k)) continue;
    if (/^\d+$/.test(k)) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

type LimitMode = "none" | "words" | "chars";
type Draft = { save: boolean; text: string };

export default function Tool() {
  const [draft, setDraft, clearDraft] = usePersistentState<Draft>("word-counter-draft", { save: false, text: "" });
  const [localText, setLocalText] = useState("");
  const saving = draft?.save === true;
  const text = saving ? (typeof draft.text === "string" ? draft.text : "") : localText;

  const [limitMode, setLimitMode] = useState<LimitMode>("none");
  const [limitRaw, setLimitRaw] = useState("");
  const [excludeStop, setExcludeStop] = useState(true);

  const deferred = useDeferredValue(text);
  const stats = useMemo(() => analyze(deferred), [deferred]);
  const top = useMemo(() => topWords(stats.wordList, excludeStop), [stats.wordList, excludeStop]);

  const onText = (v: string) => {
    if (saving) setDraft({ save: true, text: v });
    else setLocalText(v);
  };

  const onSaveToggle = (on: boolean) => {
    if (on) {
      setDraft({ save: true, text });
    } else {
      setLocalText(text);
      clearDraft();
    }
  };

  const limitNum = parseNum(limitRaw);
  const limitError =
    limitMode !== "none" && limitRaw.trim() && (limitNum === null || !Number.isInteger(limitNum) || limitNum < 1)
      ? "Enter a whole number greater than 0."
      : null;
  const limit = limitMode !== "none" && !limitError && limitNum ? limitNum : null;
  const used = limitMode === "words" ? stats.words : stats.chars;
  const unit = limitMode === "words" ? "word" : "character";
  const over = limit !== null ? used - limit : 0;

  const empty = deferred.trim().length === 0;

  const summary = [
    `Words: ${stats.words}`,
    `Characters: ${stats.chars}`,
    `Characters (no spaces): ${stats.charsNoSpaces}`,
    `Sentences: ${stats.sentences}`,
    `Paragraphs: ${stats.paragraphs}`,
    `Lines: ${stats.lines}`,
    `Average word length: ${fmt(stats.avgWordLen, 1)} characters`,
    `Average sentence length: ${fmt(stats.avgSentenceLen, 1)} words`,
    `Reading time (230 wpm): ${duration(stats.words, 230)}`,
    `Speaking time (130 wpm): ${duration(stats.words, 130)}`,
    ...(limit !== null ? [`Limit: ${used} of ${limit} ${unit}s`] : []),
  ].join("\n");

  return (
    <div className="space-y-5">
      <SplitGrid>
        <ToolPanel
          title="Your text"
          actions={
            <ResetBtn
              label="Clear text"
              onClick={() => {
                onText("");
              }}
            />
          }
        >
          <div className="space-y-4">
            <TextArea
              label="Text to count"
              hint="Paste or type. Counts update as you go."
              value={text}
              onChange={(e) => onText(e.target.value)}
              placeholder="Paste your essay, abstract or answer here"
              rows={12}
              className="[&_textarea]:min-h-[260px]"
            />
            <Checkbox
              label="Save draft in this browser"
              hint={
                saving
                  ? "Your text is saved in this browser's local storage. Untick to delete the saved copy."
                  : "Off by default. Your text stays in this tab only and disappears when you close it."
              }
              checked={saving}
              onChange={onSaveToggle}
            />
            <div className="space-y-3 rounded-xl bg-sunken p-4">
              <p className="text-sm font-medium text-ink">Length limit</p>
              <Segmented
                label="Length limit"
                value={limitMode}
                onChange={setLimitMode}
                options={[
                  { value: "none", label: "No limit" },
                  { value: "words", label: "Words" },
                  { value: "chars", label: "Characters" },
                ]}
              />
              {limitMode !== "none" && (
                <NumberField
                  label={limitMode === "words" ? "Maximum words" : "Maximum characters"}
                  inputMode="numeric"
                  value={limitRaw}
                  onChange={(e) => setLimitRaw(e.target.value)}
                  placeholder={limitMode === "words" ? "e.g. 500" : "e.g. 2000"}
                  error={limitError}
                />
              )}
              {limit !== null && (
                <div>
                  <div
                    role="progressbar"
                    aria-label={`${unit}s used`}
                    aria-valuemin={0}
                    aria-valuemax={limit}
                    aria-valuenow={Math.min(used, limit)}
                    aria-valuetext={`${used} of ${limit} ${unit}s`}
                    className="h-2.5 overflow-hidden rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--line)]"
                  >
                    <div
                      className={`h-full rounded-full ${over > 0 ? "bg-danger" : "bg-accent"}`}
                      style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
                    />
                  </div>
                  <p className={`mt-2 text-sm ${over > 0 ? "font-medium text-danger" : "text-ink-2"}`} aria-live="polite">
                    {over > 0
                      ? `Over by ${over.toLocaleString("en-US")} ${unit}${over === 1 ? "" : "s"} (${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")}).`
                      : `${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} ${unit}s used, ${(limit - used).toLocaleString("en-US")} left.`}
                  </p>
                </div>
              )}
            </div>
            <PrivacyNote stored={saving} />
          </div>
        </ToolPanel>

        <ToolPanel title="Counts" actions={<CopyBtn text={empty ? "" : summary} label="Copy stats" />}>
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultCard label="Words" value={stats.words.toLocaleString("en-US")} />
              <ResultCard
                label="Characters"
                tone="neutral"
                value={stats.chars.toLocaleString("en-US")}
                detail={`${stats.charsNoSpaces.toLocaleString("en-US")} without spaces`}
              />
            </div>
            <StatGrid
              items={[
                { label: "Sentences", value: stats.sentences.toLocaleString("en-US") },
                { label: "Paragraphs", value: stats.paragraphs.toLocaleString("en-US") },
                { label: "Lines", value: stats.lines.toLocaleString("en-US") },
                { label: "Avg word length", value: `${fmt(stats.avgWordLen, 1)} ch` },
                { label: "Avg sentence", value: `${fmt(stats.avgSentenceLen, 1)} words` },
                { label: "Reading time", value: duration(stats.words, 230) },
                { label: "Speaking time", value: duration(stats.words, 130) },
              ]}
            />
            <p className="text-[0.8125rem] text-muted">
              Reading time assumes 230 words per minute; speaking time assumes 130.
            </p>

            {!empty && stats.longest && stats.longest.words > 35 && (
              <Notice tone="warning" title={`Long sentence: ${stats.longest.words} words`}>
                <p>
                  {stats.longSentences === 1
                    ? "One sentence runs past 35 words."
                    : `${stats.longSentences} sentences run past 35 words.`}{" "}
                  Consider splitting it for readability. The longest starts with:
                </p>
                <p className="mt-1 break-words italic text-ink-2">
                  &ldquo;{stats.longest.text.length > 140 ? `${stats.longest.text.slice(0, 140)}...` : stats.longest.text}&rdquo;
                </p>
              </Notice>
            )}

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-sans text-[0.95rem] font-semibold tracking-normal text-ink">Most frequent words</h3>
              </div>
              <Checkbox label="Leave out common English words (the, and, of...)" checked={excludeStop} onChange={setExcludeStop} />
              <div className="mt-3">
                {empty ? (
                  <EmptyState icon="text" title="No text yet">
                    Paste or type something to see your counts.
                  </EmptyState>
                ) : top.length === 0 ? (
                  <p className="text-sm text-muted">No words left after removing common words.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {top.map(([word, count], i) => (
                      <li key={word} className="flex items-center gap-3 text-sm">
                        <span className="w-5 shrink-0 text-right tabular-nums text-muted">{i + 1}.</span>
                        <span className="min-w-0 flex-1 truncate font-medium text-ink">
                          {word}
                        </span>
                        <span className="relative h-2 w-20 shrink-0 overflow-hidden rounded-full bg-sunken sm:w-28" aria-hidden="true">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-accent"
                            style={{ width: `${(count / top[0][1]) * 100}%` }}
                          />
                        </span>
                        <span className="w-14 shrink-0 text-right tabular-nums text-ink-2">
                          {count}
                          <span className="sr-only"> times</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </ToolPanel>
      </SplitGrid>
    </div>
  );
}
