"use client";

import { useMemo, useRef, useState } from "react";
import { all, create, type BigNumber } from "mathjs";
import { Btn, CopyBtn, EmptyState, PrivacyNote, ToolPanel } from "@/components/tools/kit";

/** Decimal arithmetic with 64 significant digits, so 0.1 + 0.2 is exactly 0.3. */
const math = create(all, { number: "BigNumber", precision: 64 });

type Entry = { expr: string; result: string };

const ALLOWED = /^[0-9+\-*/().%\s]*$/;

/** Display form → mathjs syntax. */
const toMath = (s: string) => s.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
/** Typed ASCII operators → display symbols (same length, so the caret stays put). */
const toDisplay = (s: string) => s.replace(/\*/g, "×").replace(/\//g, "÷");

function evaluate(display: string): { ok: true; value: string } | { ok: false; error: string } {
  const src = toMath(display).trim();
  if (!src) return { ok: false, error: "" };
  if (!ALLOWED.test(src)) return { ok: false, error: "Use digits, + − × ÷, %, brackets and the decimal point." };
  let r: unknown;
  try {
    r = math.evaluate(src);
  } catch {
    return { ok: false, error: "Incomplete or invalid expression." };
  }
  if (!math.isBigNumber(r)) return { ok: false, error: "Incomplete or invalid expression." };
  const b = r as BigNumber;
  if (!b.isFinite()) return { ok: false, error: "Cannot divide by zero." };
  // 15 significant digits for display; trailing zeros trimmed by mathjs.
  const text = math.format(b, { precision: 15, lowerExp: -9, upperExp: 15 });
  return { ok: true, value: text === "-0" ? "0" : text };
}

const KEYS: { label: string; insert?: string; action?: "clear" | "back" | "sign" | "equals"; aria: string; kind?: "op" | "fn" | "eq" }[] = [
  { label: "AC", action: "clear", aria: "All clear", kind: "fn" },
  { label: "⌫", action: "back", aria: "Backspace", kind: "fn" },
  { label: "%", insert: "%", aria: "Percent", kind: "fn" },
  { label: "÷", insert: "÷", aria: "Divide", kind: "op" },
  { label: "7", insert: "7", aria: "7" },
  { label: "8", insert: "8", aria: "8" },
  { label: "9", insert: "9", aria: "9" },
  { label: "×", insert: "×", aria: "Multiply", kind: "op" },
  { label: "4", insert: "4", aria: "4" },
  { label: "5", insert: "5", aria: "5" },
  { label: "6", insert: "6", aria: "6" },
  { label: "−", insert: "-", aria: "Subtract", kind: "op" },
  { label: "1", insert: "1", aria: "1" },
  { label: "2", insert: "2", aria: "2" },
  { label: "3", insert: "3", aria: "3" },
  { label: "+", insert: "+", aria: "Add", kind: "op" },
  { label: "(", insert: "(", aria: "Open bracket", kind: "fn" },
  { label: "0", insert: "0", aria: "0" },
  { label: ")", insert: ")", aria: "Close bracket", kind: "fn" },
  { label: ".", insert: ".", aria: "Decimal point" },
  { label: "±", action: "sign", aria: "Change sign of the last number", kind: "fn" },
  { label: "=", action: "equals", aria: "Equals", kind: "eq" },
];

/** Toggles the sign of the trailing number: "12+5" → "12+(-5)" → "12+5". */
function toggleSign(s: string): string {
  const wrapped = /\(-(\d*\.?\d+%?)\)$/.exec(s);
  if (wrapped) return s.slice(0, -wrapped[0].length) + wrapped[1];
  const m = /(\d*\.?\d+%?)$/.exec(s);
  if (!m) return s + "-";
  const before = s.slice(0, -m[0].length);
  if (before === "") return `-${m[1]}`;
  if (before === "-") return m[1];
  return `${before}(-${m[1]})`;
}

export default function Tool() {
  const [expr, setExpr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => evaluate(expr), [expr]);

  const insert = (text: string) => {
    const el = inputRef.current;
    let base = expr;
    // After "=", typing a digit starts fresh; an operator continues from the result.
    if (justEvaluated && /^[\d.(]/.test(text)) base = "";
    const start = el && !justEvaluated ? (el.selectionStart ?? base.length) : base.length;
    const end = el && !justEvaluated ? (el.selectionEnd ?? base.length) : base.length;
    const next = base.slice(0, start) + text + base.slice(end);
    setExpr(next);
    setError(null);
    setJustEvaluated(false);
    const caret = start + text.length;
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(caret, caret);
    });
  };

  const equals = () => {
    const r = evaluate(expr);
    if (!r.ok) {
      if (r.error) setError(r.error);
      return;
    }
    setHistory((h) => [{ expr, result: r.value }, ...h].slice(0, 30));
    setExpr(r.value);
    setError(null);
    setJustEvaluated(true);
  };

  const press = (k: (typeof KEYS)[number]) => {
    if (k.insert) return insert(k.insert);
    if (k.action === "clear") {
      setExpr("");
      setError(null);
      setJustEvaluated(false);
    } else if (k.action === "back") {
      setExpr((s) => s.slice(0, -1));
      setError(null);
      setJustEvaluated(false);
    } else if (k.action === "sign") {
      setExpr((s) => toggleSign(s));
      setJustEvaluated(false);
    } else if (k.action === "equals") equals();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <ToolPanel title="Calculator">
        <div className="rounded-xl bg-sunken p-4">
          <label htmlFor="basic-calc-expr" className="text-[0.8125rem] text-muted">
            Expression (type or use the keypad, Enter for =, Esc to clear)
          </label>
          <input
            id="basic-calc-expr"
            ref={inputRef}
            value={expr}
            onChange={(e) => {
              setExpr(toDisplay(e.target.value));
              setError(null);
              setJustEvaluated(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || (e.key === "=" && !e.ctrlKey)) {
                e.preventDefault();
                equals();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setExpr("");
                setError(null);
              }
            }}
            autoComplete="off"
            spellCheck={false}
            inputMode="none"
            aria-describedby="basic-calc-preview"
            aria-invalid={error ? true : undefined}
            className="mt-1 block w-full bg-transparent text-right font-mono text-[1.75rem] leading-tight text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          />
          <p id="basic-calc-preview" aria-live="polite" className="mt-2 min-h-[1.5rem] text-right text-lg tabular-nums text-ink-2">
            {error ? <span className="text-danger">{error}</span> : preview.ok && !justEvaluated ? `= ${preview.value}` : ""}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label="Keypad">
          {KEYS.map((k) => (
            <button
              key={k.aria}
              type="button"
              aria-label={k.aria}
              onClick={() => press(k)}
              className={`h-14 rounded-xl text-xl font-medium transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                k.kind === "eq"
                  ? "col-span-3 bg-ink text-surface hover:opacity-90"
                  : k.kind === "op"
                    ? "bg-accent-soft text-ink hover:bg-sunken"
                    : k.kind === "fn"
                      ? "bg-sunken text-ink-2 hover:text-ink"
                      : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-sunken"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[0.8125rem] text-muted">
          Percent works like a desk calculator: 200 + 10% = 220, 200 × 10% = 20, and 50% on its own is 0.5. Results show up to 15
          significant digits.
        </p>
      </ToolPanel>

      <ToolPanel
        title="History"
        actions={
          history.length > 0 ? (
            <>
              <CopyBtn text={history.map((h) => `${h.expr} = ${h.result}`).join("\n")} label="Copy all" />
              <Btn variant="subtle" icon="trash" onClick={() => setHistory([])}>
                Clear
              </Btn>
            </>
          ) : undefined
        }
      >
        {history.length === 0 ? (
          <EmptyState icon="calculator" title="No calculations yet">
            Press = to add a calculation here. Select one to reuse its result.
          </EmptyState>
        ) : (
          <ol className="space-y-1.5">
            {history.map((h, i) => (
              <li key={`${i}-${h.expr}`}>
                <button
                  type="button"
                  onClick={() => {
                    setExpr(h.result);
                    setJustEvaluated(true);
                    setError(null);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-right font-mono text-sm hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label={`Use result ${h.result} from ${h.expr}`}
                >
                  <span className="block break-all text-muted">{h.expr}</span>
                  <span className="block break-all text-base text-ink">= {h.result}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}
