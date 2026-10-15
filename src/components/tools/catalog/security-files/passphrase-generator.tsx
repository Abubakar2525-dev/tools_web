"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, NumberField, PrivacyNote, SelectField, TextField, ToolPanel, fmt, parseNum } from "@/components/tools/kit";
import { EFF_WORDS } from "./lib/eff-wordlist";
import { type Capitalization, type PassphraseOptions, generatePassphrase, passphraseEntropyBits, strengthLabel } from "./lib/random";
import { MonoValue, StrengthMeter } from "./shared";

const SEPARATORS = [
  { value: "-", label: "Hyphen ( - )" },
  { value: " ", label: "Space" },
  { value: ".", label: "Period ( . )" },
  { value: "_", label: "Underscore ( _ )" },
  { value: "", label: "None" },
  { value: "custom", label: "Custom" },
];

const CAPS: { value: Capitalization; label: string }[] = [
  { value: "lower", label: "all lowercase" },
  { value: "title", label: "Capitalize Each Word" },
  { value: "one", label: "One random word in CAPITALS" },
  { value: "upper", label: "ALL UPPERCASE" },
];

export default function Tool() {
  const [words, setWords] = useState(6);
  const [sepChoice, setSepChoice] = useState("-");
  const [customSep, setCustomSep] = useState("~");
  const [caps, setCaps] = useState<Capitalization>("lower");
  const [addNumber, setAddNumber] = useState(false);
  const [addSymbol, setAddSymbol] = useState(false);
  const [countRaw, setCountRaw] = useState("3");
  const [list, setList] = useState<string[]>([]);

  const separator = sepChoice === "custom" ? customSep : sepChoice;
  const opts: PassphraseOptions = { words, separator, capitalization: caps, addNumber, addSymbol };
  const bits = passphraseEntropyBits(EFF_WORDS.length, opts);
  const strength = strengthLabel(bits);
  const count = parseNum(countRaw);
  const countError = count === null || !Number.isInteger(count) || count < 1 || count > 20 ? "Enter a whole number from 1 to 20." : null;
  const sepError = sepChoice === "custom" && customSep.length > 3 ? "Use up to 3 characters." : null;

  const generate = (o: PassphraseOptions = opts) => {
    if (countError || sepError || count === null) return;
    setList(Array.from({ length: count }, () => generatePassphrase(EFF_WORDS, o)));
  };
  const regen = (patch: Partial<PassphraseOptions>) => {
    if (list.length) generate({ ...opts, ...patch });
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Passphrase generator">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-5">
            <div>
              <label htmlFor="pp-words" className="text-sm font-medium text-ink">
                Words: {words}
              </label>
              <input
                id="pp-words"
                type="range"
                min={3}
                max={12}
                value={words}
                onChange={(e) => {
                  setWords(Number(e.target.value));
                  regen({ words: Number(e.target.value) });
                }}
                className="mt-3 h-10 w-full accent-[var(--accent)]"
              />
            </div>
            <SelectField
              label="Separator"
              options={SEPARATORS}
              value={sepChoice}
              onChange={(e) => {
                setSepChoice(e.target.value);
                regen({ separator: e.target.value === "custom" ? customSep : e.target.value });
              }}
            />
            {sepChoice === "custom" && (
              <TextField
                label="Custom separator"
                value={customSep}
                onChange={(e) => {
                  setCustomSep(e.target.value);
                  if (e.target.value.length <= 3) regen({ separator: e.target.value });
                }}
                error={sepError}
              />
            )}
            <SelectField
              label="Capitalization"
              options={CAPS}
              value={caps}
              onChange={(e) => {
                setCaps(e.target.value as Capitalization);
                regen({ capitalization: e.target.value as Capitalization });
              }}
            />
            <Checkbox
              label="Add a digit to one word"
              checked={addNumber}
              onChange={(v) => {
                setAddNumber(v);
                regen({ addNumber: v });
              }}
            />
            <Checkbox
              label="Add a symbol to one word"
              checked={addSymbol}
              onChange={(v) => {
                setAddSymbol(v);
                regen({ addSymbol: v });
              }}
              hint="Only for sites that insist. Adding a word is a better upgrade."
            />
            <NumberField label="How many passphrases" value={countRaw} onChange={(e) => setCountRaw(e.target.value)} error={countError} />
          </div>
          <div className="min-w-0 space-y-5">
            <StrengthMeter level={strength.level} label={strength.label} detail={`${fmt(bits, 1)} bits of entropy`} />
            <p className="text-[0.8125rem] text-muted">
              Each word adds {fmt(Math.log2(EFF_WORDS.length), 2)} bits (one of {EFF_WORDS.length.toLocaleString("en-US")} words). The number assumes an attacker knows this list and your settings.
            </p>
            <Btn icon="reset" onClick={() => generate()} disabled={!!countError || !!sepError}>
              {list.length ? "Generate again" : "Generate passphrases"}
            </Btn>
            {list.length === 0 ? (
              <EmptyState icon="lock" title="No passphrase yet">
                Choose the number of words, then generate. Six words is a sensible default for most accounts.
              </EmptyState>
            ) : (
              <ul className="space-y-2" aria-live="polite">
                {list.map((p, i) => (
                  <li key={`${i}-${p}`} className="flex items-center gap-2">
                    <MonoValue>{p}</MonoValue>
                    <CopyBtn text={p} />
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[0.8125rem] text-muted">
              Word list: the EFF large wordlist by the Electronic Frontier Foundation (eff.org/dice), used under CC BY 3.0 US. It is bundled with this page, so no word list is downloaded while you use it.
            </p>
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
