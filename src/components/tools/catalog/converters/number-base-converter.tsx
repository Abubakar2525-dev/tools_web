"use client";

import { useDeferredValue, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, SelectField, TextField, ToolPanel } from "@/components/tools/kit";
import { convertBase, parseInBase, rationalToBase, gcd } from "./lib/numbers";

const NAMES: Record<number, string> = { 2: "binary", 8: "octal", 10: "decimal", 16: "hexadecimal", 36: "base 36" };
const BASE_OPTIONS = Array.from({ length: 35 }, (_, i) => {
  const b = i + 2;
  return { value: String(b), label: NAMES[b] ? `${b} (${NAMES[b]})` : String(b) };
});
const COMMON = [2, 8, 10, 16];
const MAX_FRAC = 64;

export default function Tool() {
  const [value, setValue] = useState("255.75");
  const [from, setFrom] = useState("10");
  const [to, setTo] = useState("16");
  const [upper, setUpper] = useState(true);
  const v = useDeferredValue(value);

  const fb = Number(from);
  const tb = Number(to);
  const trimmed = v.trim();
  const res = trimmed ? convertBase(trimmed, fb, tb, MAX_FRAC) : null;
  const parsed = trimmed ? parseInBase(trimmed, fb) : null;
  const show = (s: string) => (upper ? s.toUpperCase() : s);

  const common =
    parsed && typeof parsed !== "string"
      ? COMMON.map((b) => {
          const g = gcd(parsed.num, parsed.den) || BigInt(1);
          const r = rationalToBase(parsed.num / g, parsed.den / g, b, parsed.negative, MAX_FRAC);
          return { b, text: r.ok ? show(r.text) : "n/a" };
        })
      : [];

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Convert"
        actions={
          <>
            {res?.ok && <CopyBtn text={show(res.text)} label="Copy result" />}
            <ResetBtn
              onClick={() => {
                setValue("255.75");
                setFrom("10");
                setTo("16");
              }}
            />
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Number"
            hint="Digits 0-9 then a-z. A point separates the fraction. Prefixes 0x, 0b and 0o are accepted for their base."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="sm:col-span-2 [&_input]:font-mono"
            error={res && !res.ok ? res.error : null}
          />
          <SelectField label="From base" value={from} onChange={(e) => setFrom(e.target.value)} options={BASE_OPTIONS} />
          <SelectField label="To base" value={to} onChange={(e) => setTo(e.target.value)} options={BASE_OPTIONS} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn
            variant="ghost"
            icon="swap"
            onClick={() => {
              if (res?.ok) setValue(res.text);
              setFrom(to);
              setTo(from);
            }}
          >
            Swap bases
          </Btn>
          <Btn variant="subtle" onClick={() => setUpper((u) => !u)} aria-pressed={upper}>
            Letters: {upper ? "A-Z" : "a-z"}
          </Btn>
        </div>

        <div className="mt-6" aria-live="polite">
          {!res ? (
            <EmptyState icon="binary" title="Type a number to convert" />
          ) : !res.ok ? null : (
            <div className="space-y-3">
              <div className="rounded-xl bg-accent-soft p-5">
                <p className="text-sm text-ink-2">
                  In base {tb}
                  {NAMES[tb] ? ` (${NAMES[tb]})` : ""}
                </p>
                <p className="mt-1 break-all font-mono text-[1.5rem] font-semibold leading-snug text-ink">{show(res.text)}</p>
              </div>
              {res.repeating && (
                <Notice>Digits in parentheses repeat forever. For example 0.0(0011) means 0.0001100110011… in that base.</Notice>
              )}
              {res.truncated && (
                <Notice tone="warning">
                  The fraction did not end or repeat within {MAX_FRAC} digits, so it is cut off (shown with …). The repeating cycle is longer than that.
                </Notice>
              )}
            </div>
          )}
        </div>
      </ToolPanel>

      {common.length > 0 && res?.ok && (
        <ToolPanel title="Same value in common bases">
          <dl className="divide-y divide-line rounded-xl shadow-[0_0_0_1px_var(--line)]">
            {common.map((c) => (
              <div key={c.b} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
                <dt className="text-sm text-muted">
                  Base {c.b} ({NAMES[c.b]})
                </dt>
                <dd className="break-all font-mono text-[0.95rem] text-ink">{c.text}</dd>
              </div>
            ))}
          </dl>
        </ToolPanel>
      )}
      <PrivacyNote />
    </div>
  );
}
