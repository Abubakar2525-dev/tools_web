"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  CopyBtn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  SplitGrid,
  StatGrid,
  TextArea,
  ToolPanel,
  fmt,
  parseNum,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type TextStats = {
  chars: number;
  charsNoSpaces: number;
  words: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  bytes: number;
  tokensByChars: number;
  tokensByWords: number;
  min: number;
  max: number;
};

const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

function analyze(text: string): TextStats {
  const chars = Array.from(text).length;
  const charsNoSpaces = Array.from(text.replace(/\s+/g, "")).length;
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const lines = text ? text.split(/\r\n|\r|\n/).length : 0;
  const sentences = trimmed ? trimmed.split(/[.!?。！？]+(?=\s|$)/).filter((s) => s.trim()).length : 0;
  const paragraphs = trimmed ? trimmed.split(/(?:\r?\n)\s*(?:\r?\n)/).filter((p) => p.trim()).length : 0;
  const bytes = encoder ? encoder.encode(text).length : text.length;
  const tokensByChars = Math.ceil(chars / 4);
  const tokensByWords = Math.ceil(words * 1.33);
  return {
    chars,
    charsNoSpaces,
    words,
    lines,
    sentences,
    paragraphs,
    bytes,
    tokensByChars,
    tokensByWords,
    min: Math.min(tokensByChars, tokensByWords),
    max: Math.max(tokensByChars, tokensByWords),
  };
}

const n0 = (n: number) => fmt(n, 0);

function money(n: number) {
  if (n === 0) return "0";
  if (n < 0.01) return fmt(n, 6);
  return fmt(n, 4);
}

function rangeText(min: number, max: number) {
  return min === max ? n0(min) : `${n0(min)} to ${n0(max)}`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [text, setText] = useState("");
  const [contextRaw, setContextRaw] = useState("128,000");
  const [priceRaw, setPriceRaw] = useState("");

  const deferred = useDeferredValue(text);
  const s = useMemo(() => analyze(deferred), [deferred]);

  const contextSize = parseNum(contextRaw);
  const contextError =
    contextRaw.trim() === ""
      ? null
      : contextSize === null || contextSize <= 0 || !Number.isInteger(contextSize)
        ? "Enter a whole number of tokens greater than 0."
        : null;
  const price = parseNum(priceRaw);
  const priceError = priceRaw.trim() !== "" && (price === null || price < 0) ? "Enter a price of 0 or more." : null;

  const fitPct = contextSize && !contextError ? (s.max / contextSize) * 100 : null;
  const fits = fitPct !== null && fitPct <= 100;
  const costMin = price !== null && !priceError ? (s.min / 1_000_000) * price : null;
  const costMax = price !== null && !priceError ? (s.max / 1_000_000) * price : null;

  const summary = useMemo(
    () =>
      [
        `Estimated tokens: ${rangeText(s.min, s.max)} (estimate)`,
        `  Characters / 4: ${n0(s.tokensByChars)}`,
        `  Words x 1.33: ${n0(s.tokensByWords)}`,
        `Characters: ${n0(s.chars)}`,
        `Characters without spaces: ${n0(s.charsNoSpaces)}`,
        `Words: ${n0(s.words)}`,
        `Lines: ${n0(s.lines)}`,
        `Sentences: ${n0(s.sentences)}`,
        `Paragraphs: ${n0(s.paragraphs)}`,
        `Bytes (UTF-8): ${n0(s.bytes)}`,
      ].join("\n"),
    [s],
  );

  const reset = () => {
    setText("");
    setContextRaw("128,000");
    setPriceRaw("");
  };

  const hasText = deferred.length > 0;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Text and token estimator"
        actions={
          <>
            <CopyBtn text={hasText ? summary : ""} label="Copy stats" />
            <ResetBtn onClick={reset} />
          </>
        }
      >
        <SplitGrid>
          <div className="min-w-0 space-y-5">
            <TextArea
              label="Text"
              hint="Paste a prompt, document or code. Counts update as you type."
              placeholder="Paste or type your text here."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Context window"
                optional
                hint="In tokens. Check your model's documentation."
                value={contextRaw}
                onChange={(e) => setContextRaw(e.target.value)}
                error={contextError}
              />
              <NumberField
                label="Price per 1M tokens"
                optional
                hint="Your provider's rate, in any currency."
                placeholder="e.g. 3"
                value={priceRaw}
                onChange={(e) => setPriceRaw(e.target.value)}
                error={priceError}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            {!hasText ? (
              <EmptyState icon="token" title="Paste text to estimate tokens">
                You will see counts for characters, words, lines and an approximate token range.
              </EmptyState>
            ) : (
              <>
                <ResultCard
                  label="Tokens (estimate)"
                  value={`≈ ${s.min === s.max ? n0(s.min) : `${n0(s.min)}–${n0(s.max)}`}`}
                  detail={
                    <>
                      Characters / 4: {n0(s.tokensByChars)}. Words × 1.33: {n0(s.tokensByWords)}.
                    </>
                  }
                />
                <StatGrid
                  items={[
                    { label: "Characters", value: n0(s.chars) },
                    { label: "Without spaces", value: n0(s.charsNoSpaces) },
                    { label: "Words", value: n0(s.words) },
                    { label: "Lines", value: n0(s.lines) },
                    { label: "Sentences", value: n0(s.sentences) },
                    { label: "Paragraphs", value: n0(s.paragraphs) },
                    { label: "Bytes (UTF-8)", value: n0(s.bytes) },
                  ]}
                />

                {fitPct !== null && contextSize !== null && (
                  <div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <p className="font-medium text-ink">Context window fit</p>
                      <p className="text-ink-2 tabular-nums">
                        {fits ? "Fits" : "Exceeds"}: {fmt(fitPct, 1)}% of {n0(contextSize)}
                      </p>
                    </div>
                    <div
                      className="mt-2 h-2.5 overflow-hidden rounded-full bg-sunken"
                      role="meter"
                      aria-label="Share of context window used, based on the upper estimate"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, Math.round(fitPct))}
                      aria-valuetext={`${fmt(fitPct, 1)}%, ${fits ? "fits" : "exceeds the window"}`}
                    >
                      <div
                        className={`h-full rounded-full ${fits ? "bg-accent" : "bg-danger"}`}
                        style={{ width: `${Math.min(100, Math.max(fitPct, fitPct > 0 ? 1 : 0))}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[0.8125rem] text-muted">
                      {fits
                        ? `About ${n0(Math.max(0, contextSize - s.max))} tokens left for instructions and the response.`
                        : `About ${n0(s.max - contextSize)} tokens over the limit. Trim or split the text.`}
                    </p>
                  </div>
                )}

                {costMin !== null && costMax !== null && (
                  <StatGrid
                    items={[
                      {
                        label: "Estimated cost",
                        value: costMin === costMax ? money(costMin) : `${money(costMin)} to ${money(costMax)}`,
                      },
                    ]}
                  />
                )}
                {costMin !== null && (
                  <p className="-mt-3 text-[0.8125rem] text-muted">
                    Same currency as the price you entered. Covers this text as input only, not the response.
                  </p>
                )}
              </>
            )}

            <Notice tone="info" title="These are estimates">
              Exact token counts depend on each model&apos;s tokenizer. Non-English text, code, numbers and unusual
              symbols usually use more tokens than these rules of thumb suggest. Use your provider&apos;s tokenizer
              when you need an exact count.
            </Notice>
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
