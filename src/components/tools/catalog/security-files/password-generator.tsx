"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, NumberField, PrivacyNote, TextField, ToolPanel, downloadFile, fmt, parseNum } from "@/components/tools/kit";
import { CHARSETS, type CharsetKey, type PasswordOptions, generatePassword, passwordEntropyBits, passwordError, strengthLabel } from "./lib/random";
import { MonoValue, StrengthMeter } from "./shared";

const SET_LABELS: Record<CharsetKey, string> = {
  lower: "Lowercase (a-z)",
  upper: "Uppercase (A-Z)",
  digits: "Digits (0-9)",
  symbols: `Symbols (${CHARSETS.symbols})`,
};

const DEFAULTS: PasswordOptions = { length: 20, sets: ["lower", "upper", "digits", "symbols"], excludeAmbiguous: false, exclude: "", requireEach: true };

export default function Tool() {
  const [opts, setOpts] = useState<PasswordOptions>(DEFAULTS);
  const [lengthRaw, setLengthRaw] = useState("20");
  const [countRaw, setCountRaw] = useState("1");
  const [list, setList] = useState<string[]>([]);

  const count = parseNum(countRaw);
  const countError = count === null || !Number.isInteger(count) || count < 1 || count > 50 ? "Enter a whole number from 1 to 50." : null;
  const error = passwordError(opts);
  const bits = error ? 0 : passwordEntropyBits(opts);
  const strength = strengthLabel(bits);

  const generate = (o: PasswordOptions = opts, n = count) => {
    if (passwordError(o) || n === null || !Number.isInteger(n) || n < 1 || n > 50) return;
    setList(Array.from({ length: n }, () => generatePassword(o)));
  };

  const update = (patch: Partial<PasswordOptions>) => {
    const next = { ...opts, ...patch };
    setOpts(next);
    if (list.length) generate(next);
  };

  const toggleSet = (k: CharsetKey, on: boolean) => {
    const sets = (Object.keys(CHARSETS) as CharsetKey[]).filter((s) => (s === k ? on : opts.sets.includes(s)));
    update({ sets });
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Password generator">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-5">
            <div>
              <label htmlFor="pw-len-range" className="text-sm font-medium text-ink">
                Length: {opts.length} characters
              </label>
              <input
                id="pw-len-range"
                type="range"
                min={4}
                max={128}
                value={Math.min(128, opts.length)}
                onChange={(e) => {
                  setLengthRaw(e.target.value);
                  update({ length: Number(e.target.value) });
                }}
                className="mt-3 h-10 w-full accent-[var(--accent)]"
              />
            </div>
            <NumberField
              label="Exact length"
              hint="4 to 256 characters."
              value={lengthRaw}
              onChange={(e) => {
                setLengthRaw(e.target.value);
                const n = parseNum(e.target.value);
                if (n !== null) update({ length: n });
              }}
              error={parseNum(lengthRaw) === null ? "Enter a number." : null}
            />
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ink">Character sets</legend>
              {(Object.keys(CHARSETS) as CharsetKey[]).map((k) => (
                <Checkbox key={k} label={SET_LABELS[k]} checked={opts.sets.includes(k)} onChange={(v) => toggleSet(k, v)} />
              ))}
            </fieldset>
            <div className="space-y-3">
              <Checkbox
                label="Include at least one of each chosen set"
                checked={opts.requireEach}
                onChange={(v) => update({ requireEach: v })}
                hint="Satisfies sites that demand a digit or symbol. Costs a fraction of a bit."
              />
              <Checkbox
                label="Exclude look-alike characters"
                checked={opts.excludeAmbiguous}
                onChange={(v) => update({ excludeAmbiguous: v })}
                hint="Removes I l 1 O 0 o and confusing punctuation for passwords you will type by hand."
              />
            </div>
            <TextField
              label="Never use these characters"
              optional
              hint="For sites that reject certain symbols."
              value={opts.exclude ?? ""}
              onChange={(e) => update({ exclude: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
            <NumberField label="How many passwords" value={countRaw} onChange={(e) => setCountRaw(e.target.value)} error={countError} />
          </div>

          <div className="min-w-0 space-y-5">
            {error ? (
              <Notice tone="error">{error}</Notice>
            ) : (
              <StrengthMeter level={strength.level} label={strength.label} detail={`${fmt(bits, 1)} bits of entropy`} />
            )}
            <div className="flex flex-wrap gap-2">
              <Btn icon="reset" onClick={() => generate()} disabled={!!error || !!countError}>
                {list.length ? "Generate again" : "Generate password"}
              </Btn>
              {list.length > 1 && <CopyBtn text={list.join("\n")} label="Copy all" />}
              {list.length > 1 && (
                <Btn variant="ghost" icon="download" onClick={() => downloadFile("passwords.txt", list.join("\n"))}>
                  Download .txt
                </Btn>
              )}
            </div>
            {list.length === 0 ? (
              <EmptyState icon="lock" title="No password yet">
                Set your options, then press Generate. Changing an option afterwards creates fresh passwords.
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
              Entropy assumes an attacker knows your settings and tries every combination. Each character is drawn with{" "}
              <code>crypto.getRandomValues</code> and rejection sampling, so no character is more likely than another.
            </p>
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
