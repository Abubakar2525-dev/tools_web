"use client";

import { useMemo, useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, NumberField, PrivacyNote, TextField, ToolPanel, fmt, parseNum } from "@/components/tools/kit";
import { type PinIssue, generatePin, pinAcceptedShare, pinIssues } from "./lib/random";
import { MonoValue } from "./shared";

const ISSUE_TEXT: Record<PinIssue, string> = {
  repeated: "repeats one digit three times or more",
  sequential: "contains a run like 123 or 987",
  common: "is on lists of the most chosen PINs",
  "few-digits": "uses very few different digits",
  year: "looks like a year",
};

export default function Tool() {
  const [length, setLength] = useState(6);
  const [avoid, setAvoid] = useState(true);
  const [countRaw, setCountRaw] = useState("5");
  const [pins, setPins] = useState<string[]>([]);
  const [check, setCheck] = useState("");

  const share = useMemo(() => pinAcceptedShare(length), [length]);
  const space = 10 ** length * (avoid ? share : 1);
  const bits = Math.log2(space);
  const count = parseNum(countRaw);
  const countError = count === null || !Number.isInteger(count) || count < 1 || count > 50 ? "Enter a whole number from 1 to 50." : null;

  const generate = (len = length, av = avoid) => {
    if (countError || count === null) return;
    setPins(Array.from({ length: count }, () => generatePin(len, av)));
  };

  const checkDigits = check.replace(/\s/g, "");
  const checkError = checkDigits && !/^\d{4,12}$/.test(checkDigits) ? "Enter 4 to 12 digits." : null;
  const checkIssues = checkDigits && !checkError ? pinIssues(checkDigits) : [];

  return (
    <div className="space-y-5">
      <ToolPanel title="PIN generator">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <label htmlFor="pin-len" className="text-sm font-medium text-ink">
                PIN length: {length} digits
              </label>
              <input
                id="pin-len"
                type="range"
                min={4}
                max={12}
                value={length}
                onChange={(e) => {
                  setLength(Number(e.target.value));
                  if (pins.length) generate(Number(e.target.value));
                }}
                className="mt-3 h-10 w-full accent-[var(--accent)]"
              />
            </div>
            <Checkbox
              label="Avoid predictable patterns"
              checked={avoid}
              onChange={(v) => {
                setAvoid(v);
                if (pins.length) generate(length, v);
              }}
              hint="Skips repeats (777), runs (1234, 987), common PINs, years and PINs with very few distinct digits."
            />
            <NumberField label="How many PINs" value={countRaw} onChange={(e) => setCountRaw(e.target.value)} error={countError} />
            <Btn icon="reset" onClick={() => generate()} disabled={!!countError}>
              {pins.length ? "Generate again" : "Generate PINs"}
            </Btn>
            <p className="text-[0.8125rem] text-muted">
              {avoid
                ? `The filters keep about ${fmt(share * 100, 1)}% of all ${length}-digit PINs, leaving ${fmt(bits, 1)} bits of entropy.`
                : `All ${(10 ** length).toLocaleString("en-US")} PINs are possible: ${fmt(bits, 1)} bits of entropy.`}{" "}
              Lockouts after a few wrong tries are what keep short PINs safe.
            </p>
          </div>
          <div className="min-w-0 space-y-5">
            {pins.length === 0 ? (
              <EmptyState icon="hash" title="No PINs yet">
                Pick a length and press Generate.
              </EmptyState>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2" aria-live="polite">
                {pins.map((p, i) => (
                  <li key={`${i}-${p}`} className="flex items-center gap-2">
                    <MonoValue>{p}</MonoValue>
                    <CopyBtn text={p} />
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line pt-5">
              <TextField
                label="Check an existing PIN"
                optional
                hint="Checked on this page only."
                inputMode="numeric"
                autoComplete="off"
                value={check}
                onChange={(e) => setCheck(e.target.value)}
                error={checkError}
              />
              {checkDigits && !checkError && (
                <div className="mt-3">
                  {checkIssues.length === 0 ? (
                    <Notice tone="success">No obvious pattern found. That does not make a short PIN strong, only less guessable.</Notice>
                  ) : (
                    <Notice tone="warning" title="Predictable PIN">
                      This PIN {checkIssues.map((i) => ISSUE_TEXT[i]).join(", and ")}.
                    </Notice>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
