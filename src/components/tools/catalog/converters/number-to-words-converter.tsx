"use client";

import { useDeferredValue, useState } from "react";
import { CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, SelectField, TextArea, TextField, ToolPanel } from "@/components/tools/kit";
import {
  CURRENCIES,
  capitalize,
  chequeWords,
  currencyWords,
  intToWords,
  numberToWords,
  ordinalSuffix,
  ordinalize,
  parseNumberString,
  wordsToNumber,
  type WordStyle,
} from "./lib/words";

type Mode = "words" | "number";
type Format = "cardinal" | "ordinal" | "currency" | "cheque";
type Case = "lower" | "sentence" | "title" | "upper";

const FORMAT_OPTIONS = [
  { value: "cardinal", label: "Cardinal (one hundred five)" },
  { value: "ordinal", label: "Ordinal (one hundred fifth)" },
  { value: "currency", label: "Currency (five dollars and ten cents)" },
  { value: "cheque", label: "Cheque (Five and 10/100 dollars)" },
];
const CASE_OPTIONS = [
  { value: "lower", label: "lowercase" },
  { value: "sentence", label: "Sentence case" },
  { value: "title", label: "Title Case" },
  { value: "upper", label: "UPPERCASE" },
];

function applyCase(s: string, c: Case) {
  if (c === "upper") return s.toUpperCase();
  if (c === "sentence") return capitalize(s);
  if (c === "title") return s.replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(And)\b/g, "and");
  return s;
}

const groupInt = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function Tool() {
  const [mode, setMode] = useState<Mode>("words");
  const [input, setInput] = useState("1234.56");
  const [style, setStyle] = useState<WordStyle>("us");
  const [format, setFormat] = useState<Format>("cardinal");
  const [cur, setCur] = useState("USD");
  const [casing, setCasing] = useState<Case>("sentence");
  const [words, setWords] = useState("two hundred and forty-five thousand six hundred and seven");
  const inp = useDeferredValue(input);
  const wds = useDeferredValue(words);

  let out = "";
  let error: string | null = null;
  let extra: string | null = null;
  if (mode === "words" && inp.trim()) {
    const p = parseNumberString(inp);
    if (typeof p === "string") error = p;
    else {
      const currency = CURRENCIES.find((c) => c.id === cur)!;
      try {
        if (format === "ordinal") {
          if (p.frac.replace(/0+$/, "") || p.negative) error = "Ordinals need a positive whole number, such as 21 or 100.";
          else {
            out = ordinalize(intToWords(p.int, style));
            extra = `${groupInt(p.int.toString())}${ordinalSuffix(p.int)}`;
          }
        } else if (format === "currency" || format === "cheque") {
          if (p.negative) error = "Currency and cheque styles need an amount of 0 or more.";
          else out = format === "cheque" ? chequeWords(inp, currency, style) : currencyWords(inp, currency, style);
          if (format === "cheque") extra = "Amounts are rounded to the nearest cent.";
        } else out = numberToWords(inp, style);
      } catch (e) {
        error = e instanceof Error ? e.message : "Could not convert this number.";
      }
    }
  }
  if (out && format !== "cheque") out = applyCase(out, casing);
  if (out && format === "cheque" && casing === "upper") out = out.toUpperCase();

  const parsed = mode === "number" && wds.trim() ? wordsToNumber(wds) : null;
  const numberOut = parsed?.ok ? parsed.value : "";
  const numberPretty = parsed?.ok
    ? (() => {
        const [i, f] = parsed.value.split(".");
        const neg = i.startsWith("-");
        const body = groupInt(neg ? i.slice(1) : i);
        return `${neg ? "-" : ""}${body}${f ? `.${f}` : ""}${parsed.ordinal ? ordinalSuffix(BigInt(i)) : ""}`;
      })()
    : "";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Convert"
        actions={
          <>
            <CopyBtn text={mode === "words" ? out : numberOut} label="Copy result" />
            <ResetBtn
              onClick={() => {
                setInput("1234.56");
                setStyle("us");
                setFormat("cardinal");
                setCur("USD");
                setCasing("sentence");
                setWords("two hundred and forty-five thousand six hundred and seven");
              }}
            />
          </>
        }
      >
        <div className="mb-5">
          <Segmented
            label="Direction"
            value={mode}
            onChange={setMode}
            options={[
              { value: "words", label: "Number to words" },
              { value: "number", label: "Words to number" },
            ]}
          />
        </div>

        {mode === "words" ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Number"
                hint="Up to 36 digits before the point. Commas are ignored."
                inputMode="decimal"
                autoComplete="off"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                error={error}
                className="sm:col-span-2"
              />
              <SelectField label="Format" value={format} onChange={(e) => setFormat(e.target.value as Format)} options={FORMAT_OPTIONS} />
              {format === "currency" || format === "cheque" ? (
                <SelectField
                  label="Currency"
                  value={cur}
                  onChange={(e) => setCur(e.target.value)}
                  options={CURRENCIES.map((c) => ({ value: c.id, label: `${c.id} (${c.major[1]})` }))}
                />
              ) : (
                <SelectField label="Letter case" value={casing} onChange={(e) => setCasing(e.target.value as Case)} options={CASE_OPTIONS} />
              )}
            </div>
            <div className="mt-5">
              <Segmented
                label="English style"
                value={style}
                onChange={setStyle}
                options={[
                  { value: "us", label: "US (one hundred five)" },
                  { value: "uk", label: "UK (one hundred and five)" },
                ]}
              />
            </div>
            <div className="mt-6" aria-live="polite">
              {!inp.trim() ? (
                <EmptyState icon="text" title="Type a number to spell it out" />
              ) : out ? (
                <div className="rounded-xl bg-accent-soft p-5">
                  <p className="text-[1.25rem] font-medium leading-relaxed text-ink">{out}</p>
                  {extra && <p className="mt-2 text-sm text-ink-2">{extra}</p>}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <TextArea
              label="Number in words"
              hint='Examples: "three thousand and twelve", "minus four point two five", "twenty-first", "a million".'
              value={words}
              onChange={(e) => setWords(e.target.value)}
              error={parsed && !parsed.ok ? parsed.error : null}
            />
            <div className="mt-6" aria-live="polite">
              {!wds.trim() ? (
                <EmptyState icon="hash" title="Type a number in English words" />
              ) : parsed?.ok ? (
                <div className="rounded-xl bg-accent-soft p-5">
                  <p className="text-sm text-ink-2">{parsed.ordinal ? "Ordinal number" : "Number"}</p>
                  <p className="mt-1 break-all font-display text-[2rem] font-semibold leading-tight tabular-nums text-ink">{numberPretty}</p>
                </div>
              ) : null}
            </div>
          </>
        )}
      </ToolPanel>
      {mode === "words" && format === "cheque" && (
        <Notice>
          Cheque style writes the whole amount in words and the cents as a fraction of 100, which makes the amount harder to alter. Check your bank&apos;s own rules
          for how to fill in the remaining space.
        </Notice>
      )}
      <PrivacyNote />
    </div>
  );
}
