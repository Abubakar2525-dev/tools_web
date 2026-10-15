"use client";

import { useMemo, useRef, useState } from "react";
import { all, create, type BigNumber } from "mathjs";
import { Btn, CopyBtn, EmptyState, PrivacyNote, Segmented, ToolPanel } from "@/components/tools/kit";

/** 64-digit decimal arithmetic; results are displayed to 15 significant digits. */
const math = create(all, { number: "BigNumber", precision: 64 });
const PI = math.bignumber(math.pi as unknown as BigNumber);
const TINY = math.bignumber("1e-40");
const ZERO = math.bignumber(0);
const D180 = math.bignumber(180);

type Angle = "deg" | "rad";
type Entry = { expr: string; result: string };

function asBig(x: unknown, fn: string): BigNumber {
  if (math.isBigNumber(x)) return x as BigNumber;
  if (typeof x === "number") return math.bignumber(x);
  throw new Error(`${fn} needs a real number here.`);
}

/** Values within 1e-40 of zero are rounding noise from π (e.g. sin 180°), so show 0. */
const snap = (x: BigNumber) => (x.abs().lt(TINY) ? ZERO : x);

function buildScope(angle: Angle, ans: BigNumber | null) {
  const toRad = (x: BigNumber) => (angle === "deg" ? x.times(PI).div(D180) : x);
  const fromRad = (x: BigNumber) => (angle === "deg" ? x.times(D180).div(PI) : x);
  const inverse = (name: "asin" | "acos") => (x: unknown) => {
    const v = asBig(x, name);
    if (v.abs().gt(1)) throw new Error(`${name} needs a value between −1 and 1.`);
    return fromRad(math[name](v) as BigNumber);
  };
  return new Map<string, unknown>([
    ["sin", (x: unknown) => snap(math.sin(toRad(asBig(x, "sin"))) as BigNumber)],
    ["cos", (x: unknown) => snap(math.cos(toRad(asBig(x, "cos"))) as BigNumber)],
    [
      "tan",
      (x: unknown) => {
        const r = toRad(asBig(x, "tan"));
        const c = snap(math.cos(r) as BigNumber);
        if (c.isZero()) throw new Error("tan is undefined at this angle.");
        return snap((math.sin(r) as BigNumber).div(c));
      },
    ],
    ["asin", inverse("asin")],
    ["acos", inverse("acos")],
    ["atan", (x: unknown) => fromRad(math.atan(asBig(x, "atan")) as BigNumber)],
    ["ln", (x: unknown) => math.log(asBig(x, "ln"))],
    ["log", (x: unknown, b?: unknown) => (b === undefined ? math.log10(asBig(x, "log")) : math.log(asBig(x, "log"), asBig(b, "log")))],
    ["Ans", ans ?? ZERO],
  ]);
}

const toMath = (s: string) =>
  s
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt");
const toDisplay = (s: string) => s.replace(/\*/g, "×").replace(/\//g, "÷");

type Outcome = { ok: true; text: string; big: BigNumber | null } | { ok: false; error: string };

function evaluate(display: string, angle: Angle, ans: BigNumber | null): Outcome {
  const src = toMath(display).trim();
  if (!src) return { ok: false, error: "" };
  let r: unknown;
  try {
    r = math.evaluate(src, buildScope(angle, ans));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/undefined at this angle|between −1 and 1|real number/.test(msg)) return { ok: false, error: msg };
    if (/Undefined symbol|Undefined function/.test(msg)) return { ok: false, error: msg.replace(/^Undefined (symbol|function)/, "Unknown name") + "." };
    return { ok: false, error: "Incomplete or invalid expression." };
  }
  if (math.isBigNumber(r)) {
    const b = r as BigNumber;
    if (b.isNaN()) return { ok: false, error: "The result is not a real number." };
    if (!b.isFinite()) return { ok: false, error: "The result is infinite (for example, division by zero)." };
    const text = math.format(b, { precision: 15, lowerExp: -9, upperExp: 15 });
    return { ok: true, text: text === "-0" ? "0" : text, big: b };
  }
  if (math.isComplex(r) || typeof r === "number") return { ok: true, text: math.format(r, { precision: 12 }), big: null };
  if (typeof r === "boolean") return { ok: true, text: String(r), big: null };
  return { ok: false, error: "This calculator returns single numbers. Try a simpler expression." };
}

type Key = { label: string; insert?: string; action?: "clear" | "back" | "equals" | "mc" | "mr" | "mplus" | "mminus"; aria: string; kind?: "op" | "fn" | "eq" | "mem" };

const KEYS: Key[] = [
  { label: "MC", action: "mc", aria: "Memory clear", kind: "mem" },
  { label: "MR", action: "mr", aria: "Memory recall", kind: "mem" },
  { label: "M+", action: "mplus", aria: "Add result to memory", kind: "mem" },
  { label: "M−", action: "mminus", aria: "Subtract result from memory", kind: "mem" },
  { label: "|x|", insert: "abs(", aria: "Absolute value", kind: "fn" },
  { label: "sin", insert: "sin(", aria: "Sine", kind: "fn" },
  { label: "cos", insert: "cos(", aria: "Cosine", kind: "fn" },
  { label: "tan", insert: "tan(", aria: "Tangent", kind: "fn" },
  { label: "ln", insert: "ln(", aria: "Natural logarithm", kind: "fn" },
  { label: "log", insert: "log(", aria: "Base 10 logarithm", kind: "fn" },
  { label: "sin⁻¹", insert: "asin(", aria: "Inverse sine", kind: "fn" },
  { label: "cos⁻¹", insert: "acos(", aria: "Inverse cosine", kind: "fn" },
  { label: "tan⁻¹", insert: "atan(", aria: "Inverse tangent", kind: "fn" },
  { label: "eˣ", insert: "e^(", aria: "e to the power", kind: "fn" },
  { label: "10ˣ", insert: "10^(", aria: "10 to the power", kind: "fn" },
  { label: "x²", insert: "^2", aria: "Square", kind: "fn" },
  { label: "xʸ", insert: "^", aria: "Power", kind: "fn" },
  { label: "√", insert: "sqrt(", aria: "Square root", kind: "fn" },
  { label: "∛", insert: "cbrt(", aria: "Cube root", kind: "fn" },
  { label: "1/x", insert: "^(-1)", aria: "Reciprocal", kind: "fn" },
  { label: "(", insert: "(", aria: "Open bracket", kind: "fn" },
  { label: ")", insert: ")", aria: "Close bracket", kind: "fn" },
  { label: "n!", insert: "!", aria: "Factorial", kind: "fn" },
  { label: "π", insert: "pi", aria: "Pi", kind: "fn" },
  { label: "e", insert: "e", aria: "Euler's number e", kind: "fn" },
  { label: "7", insert: "7", aria: "7" },
  { label: "8", insert: "8", aria: "8" },
  { label: "9", insert: "9", aria: "9" },
  { label: "÷", insert: "÷", aria: "Divide", kind: "op" },
  { label: "AC", action: "clear", aria: "All clear", kind: "fn" },
  { label: "4", insert: "4", aria: "4" },
  { label: "5", insert: "5", aria: "5" },
  { label: "6", insert: "6", aria: "6" },
  { label: "×", insert: "×", aria: "Multiply", kind: "op" },
  { label: "⌫", action: "back", aria: "Backspace", kind: "fn" },
  { label: "1", insert: "1", aria: "1" },
  { label: "2", insert: "2", aria: "2" },
  { label: "3", insert: "3", aria: "3" },
  { label: "−", insert: "-", aria: "Subtract", kind: "op" },
  { label: "Ans", insert: "Ans", aria: "Previous answer", kind: "fn" },
  { label: "0", insert: "0", aria: "0" },
  { label: ".", insert: ".", aria: "Decimal point" },
  { label: "×10ˣ", insert: "×10^(", aria: "Times 10 to the power", kind: "fn" },
  { label: "+", insert: "+", aria: "Add", kind: "op" },
  { label: "=", action: "equals", aria: "Equals", kind: "eq" },
];

export default function Tool() {
  const [expr, setExpr] = useState("");
  const [angle, setAngle] = useState<Angle>("deg");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [ans, setAns] = useState<BigNumber | null>(null);
  const [memory, setMemory] = useState<BigNumber | null>(null);
  const [fresh, setFresh] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => evaluate(expr, angle, ans), [expr, angle, ans]);

  const placeCaret = (pos: number) =>
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(pos, pos);
    });

  const insert = (text: string) => {
    const el = inputRef.current;
    let base = expr;
    if (fresh && /^[\d.(a-zπ√]/.test(text) && text !== "e^(") base = "";
    if (fresh && (text === "e^(" || text === "10^(" || /^[a-z]+\($/.test(text))) base = "";
    const start = el && !fresh ? (el.selectionStart ?? base.length) : base.length;
    const end = el && !fresh ? (el.selectionEnd ?? base.length) : base.length;
    setExpr(base.slice(0, start) + text + base.slice(end));
    setError(null);
    setFresh(false);
    placeCaret(start + text.length);
  };

  const equals = () => {
    const r = evaluate(expr, angle, ans);
    if (!r.ok) {
      if (r.error) setError(r.error);
      return;
    }
    setHistory((h) => [{ expr: `${expr}${/sin|cos|tan/.test(expr) ? ` (${angle})` : ""}`, result: r.text }, ...h].slice(0, 30));
    if (r.big) setAns(r.big);
    setExpr(r.text);
    setError(null);
    setFresh(true);
  };

  const memValue = (): BigNumber | null => {
    const r = evaluate(expr, angle, ans);
    if (r.ok && r.big) return r.big;
    if (r.ok) setError("Memory stores real numbers only.");
    else if (r.error) setError(r.error);
    return null;
  };

  const press = (k: Key) => {
    if (k.insert) return insert(k.insert);
    switch (k.action) {
      case "clear":
        setExpr("");
        setError(null);
        setFresh(false);
        break;
      case "back":
        setExpr((s) => s.slice(0, -1));
        setError(null);
        setFresh(false);
        break;
      case "equals":
        equals();
        break;
      case "mc":
        setMemory(null);
        break;
      case "mr":
        if (memory) insert(math.format(memory, { precision: 15, lowerExp: -9, upperExp: 15 }));
        break;
      case "mplus": {
        const v = memValue();
        if (v) {
          setMemory((m) => (m ? m.plus(v) : v));
          setFresh(true);
        }
        break;
      }
      case "mminus": {
        const v = memValue();
        if (v) {
          setMemory((m) => (m ? m.minus(v) : v.neg()));
          setFresh(true);
        }
        break;
      }
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
      <ToolPanel
        title="Scientific calculator"
        actions={
          <Segmented
            label="Angle unit"
            value={angle}
            onChange={setAngle}
            options={[
              { value: "deg", label: "Degrees" },
              { value: "rad", label: "Radians" },
            ]}
          />
        }
      >
        <div className="rounded-xl bg-sunken p-4">
          <div className="flex items-center justify-between gap-2 text-[0.8125rem] text-muted">
            <label htmlFor="sci-calc-expr">Expression (Enter for =, Esc to clear)</label>
            <span aria-live="polite">
              {angle === "deg" ? "DEG" : "RAD"}
              {memory ? ` · M = ${math.format(memory, { precision: 10 })}` : ""}
            </span>
          </div>
          <input
            id="sci-calc-expr"
            ref={inputRef}
            value={expr}
            onChange={(e) => {
              setExpr(toDisplay(e.target.value));
              setError(null);
              setFresh(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                equals();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setExpr("");
                setError(null);
              }
            }}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby="sci-calc-preview sci-calc-help"
            aria-invalid={error ? true : undefined}
            className="mt-1 block w-full bg-transparent text-right font-mono text-[1.5rem] leading-tight text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          />
          <p id="sci-calc-preview" aria-live="polite" className="mt-2 min-h-[1.5rem] break-all text-right text-lg tabular-nums text-ink-2">
            {error ? <span className="text-danger">{error}</span> : preview.ok && !fresh ? `= ${preview.text}` : ""}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2" role="group" aria-label="Keypad">
          {KEYS.map((k) => (
            <button
              key={k.aria}
              type="button"
              aria-label={k.aria}
              onClick={() => press(k)}
              className={`h-12 rounded-lg px-1 text-[0.95rem] font-medium transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-[3.25rem] sm:text-base ${
                k.kind === "eq"
                  ? "bg-ink text-surface hover:opacity-90"
                  : k.kind === "op"
                    ? "bg-accent-soft text-ink hover:bg-sunken"
                    : k.kind === "fn"
                      ? "bg-sunken text-ink-2 hover:text-ink"
                      : k.kind === "mem"
                        ? "text-[0.85rem] text-muted shadow-[inset_0_0_0_1px_var(--line)] hover:text-ink"
                        : "bg-surface text-lg text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-sunken"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p id="sci-calc-help" className="mt-4 text-[0.8125rem] text-muted">
          Keyboard syntax: <code>sin(30)</code>, <code>2^10</code>, <code>sqrt(2)</code>, <code>cbrt(27)</code>, <code>5!</code>,{" "}
          <code>log(100)</code> (base 10), <code>ln(e)</code>, <code>log(8, 2)</code>, <code>pi</code>, <code>Ans</code>,{" "}
          <code>7 mod 3</code>. Implicit multiplication works: <code>2pi</code>.
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
            Results appear here after you press =. Select one to reuse it.
          </EmptyState>
        ) : (
          <ol className="space-y-1.5">
            {history.map((h, i) => (
              <li key={`${i}-${h.expr}`}>
                <button
                  type="button"
                  onClick={() => {
                    setExpr(h.result);
                    setFresh(true);
                    setError(null);
                  }}
                  aria-label={`Use result ${h.result} from ${h.expr}`}
                  className="w-full rounded-lg px-3 py-2 text-right font-mono text-sm hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent"
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
