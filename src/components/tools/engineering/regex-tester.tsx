"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Btn,
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  SplitGrid,
  StatGrid,
  TextArea,
  TextField,
  ToolPanel,
  fmt,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const FLAGS = [
  { key: "g", name: "global", hint: "Find all matches, not just the first" },
  { key: "i", name: "ignore case", hint: "Letters match regardless of case" },
  { key: "m", name: "multiline", hint: "^ and $ match at each line" },
  { key: "s", name: "dot all", hint: "Dot also matches line breaks" },
  { key: "u", name: "unicode", hint: "Full Unicode and stricter syntax" },
  { key: "y", name: "sticky", hint: "Match only at the current position" },
] as const;

type FlagKey = (typeof FLAGS)[number]["key"];
type FlagState = Record<FlagKey, boolean>;

const MAX_MATCHES = 1000;
const TIME_BUDGET_MS = 250;
const DEBOUNCE_MS = 150;

type Match = {
  n: number;
  index: number;
  end: number;
  value: string;
  groups: { label: string; value: string | undefined }[];
};

type Evaluation =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      matches: Match[];
      capped: boolean;
      timedOut: boolean;
      replaced: string | null;
      replaceError: string | null;
    };

type Inputs = { pattern: string; flags: string; text: string; replacement: string; showReplace: boolean };

function flagString(f: FlagState) {
  return FLAGS.filter((x) => f[x.key]).map((x) => x.key).join("");
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function friendlyError(message: string) {
  const m = message.replace(/^Invalid regular expression:\s*/i, "");
  let tip = "";
  if (/unterminated group|missing \)|unmatched '\)'|unmatched \)/i.test(m)) tip = " Check that every ( has a matching ).";
  else if (/unterminated character class|missing \]/i.test(m)) tip = " Check that every [ has a matching ].";
  else if (/nothing to repeat/i.test(m)) tip = " A quantifier like *, + or ? needs something before it. Escape it with \\ to match it literally.";
  else if (/invalid escape|invalid unicode escape|invalid identity escape/i.test(m)) tip = " With the u flag, only defined escapes are allowed.";
  else if (/invalid group|invalid capture group name/i.test(m)) tip = " Named groups use the form (?<name>...).";
  return `${m}.${tip}`.replace(/\.\./g, ".");
}

function evaluate({ pattern, flags, text, replacement, showReplace }: Inputs): Evaluation {
  if (!pattern) return { kind: "empty" };
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch (err) {
    return { kind: "error", message: friendlyError(err instanceof Error ? err.message : String(err)) };
  }

  const global = flags.includes("g");
  const unicode = flags.includes("u");
  const matches: Match[] = [];
  let capped = false;
  let timedOut = false;
  const started = now();
  re.lastIndex = 0;

  while (true) {
    const m = re.exec(text);
    if (!m) break;
    const groups: Match["groups"] = [];
    for (let g = 1; g < m.length; g++) groups.push({ label: `$${g}`, value: m[g] });
    if (m.groups) {
      for (const [name, value] of Object.entries(m.groups)) groups.push({ label: name, value });
    }
    matches.push({ n: matches.length + 1, index: m.index, end: m.index + m[0].length, value: m[0], groups });

    if (!global) break;
    if (m[0] === "") {
      // Zero-length match: step past it so the loop always advances.
      const i = re.lastIndex;
      const code = text.charCodeAt(i);
      re.lastIndex = i + (unicode && code >= 0xd800 && code <= 0xdbff && i + 1 < text.length ? 2 : 1);
      if (re.lastIndex > text.length) break;
    }
    if (matches.length >= MAX_MATCHES) {
      capped = re.exec(text) !== null;
      break;
    }
    if (now() - started > TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }
  }

  let replaced: string | null = null;
  let replaceError: string | null = null;
  if (showReplace && !timedOut) {
    try {
      replaced = text.replace(new RegExp(pattern, flags), replacement);
    } catch (err) {
      replaceError = err instanceof Error ? err.message : String(err);
    }
  }
  return { kind: "ok", matches, capped, timedOut, replaced, replaceError };
}

/** Escapes forward slashes and line breaks so the pattern works inside /.../. */
function toLiteral(pattern: string, flags: string) {
  if (!pattern) return `/(?:)/${flags}`;
  let out = "";
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      out += c + (pattern[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    if (c === "/" && !inClass) out += "\\/";
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else out += c;
  }
  return `/${out}/${flags}`;
}

type Segment = { text: string; match: number | null };

function segments(text: string, matches: Match[]): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.end === m.index) continue;
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: null });
    out.push({ text: text.slice(m.index, m.end), match: m.n });
    pos = m.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: null });
  return out;
}

const SAMPLE_PATTERN = String.raw`(?<user>[\w.+-]+)@(?<domain>[\w-]+\.[\w.]+)`;
const SAMPLE_TEXT = `Contact the team at hello@stratum.dev or support@stratum.dev.
Old addresses like ops-team@legacy.example.co.uk still forward.
Not an email: @handle, name@, plain text.`;

const CHEATS: [string, string][] = [
  [".", "Any character except line breaks (unless s flag)"],
  [String.raw`\d  \w  \s`, "Digit, word character, whitespace"],
  [String.raw`\D  \W  \S`, "Not digit, not word, not whitespace"],
  ["[abc]  [^abc]  [a-z]", "Any of, none of, range"],
  ["^  $", "Start and end of input (or line with m flag)"],
  [String.raw`\b  \B`, "Word boundary, not a word boundary"],
  ["*  +  ?", "0 or more, 1 or more, 0 or 1"],
  ["{3}  {2,}  {2,5}", "Exactly 3, 2 or more, between 2 and 5"],
  ["*?  +?", "Lazy versions: match as few as possible"],
  ["(abc)", "Capture group, available as $1"],
  ["(?<name>abc)", "Named capture group, available as $<name>"],
  ["(?:abc)", "Group without capturing"],
  ["a|b", "Either a or b"],
  ["(?=abc)  (?!abc)", "Lookahead: followed by, not followed by"],
  ["(?<=abc)  (?<!abc)", "Lookbehind: preceded by, not preceded by"],
  [String.raw`\.  \*  \\`, "Escape special characters to match them literally"],
  ["$&  $1  $<name>", "In replace: whole match, group 1, named group"],
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_FLAGS: FlagState = { g: true, i: false, m: false, s: false, u: false, y: false };

export default function Tool() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState<FlagState>(DEFAULT_FLAGS);
  const [text, setText] = useState("");
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(false);

  const flagStr = flagString(flags);
  const [debounced, setDebounced] = useState<Inputs>({ pattern: "", flags: flagStr, text: "", replacement: "", showReplace: false });

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebounced({ pattern, flags: flagStr, text, replacement, showReplace }),
      DEBOUNCE_MS,
    );
    return () => window.clearTimeout(t);
  }, [pattern, flagStr, text, replacement, showReplace]);

  const result = useMemo(() => evaluate(debounced), [debounced]);
  const segs = useMemo(
    () => (result.kind === "ok" ? segments(debounced.text, result.matches) : []),
    [result, debounced.text],
  );

  const literal = toLiteral(pattern, flagStr);
  const reset = () => {
    setPattern("");
    setFlags(DEFAULT_FLAGS);
    setText("");
    setReplacement("");
    setShowReplace(false);
  };
  const loadSample = () => {
    setPattern(SAMPLE_PATTERN);
    setFlags(DEFAULT_FLAGS);
    setText(SAMPLE_TEXT);
    setReplacement("$<user> at $<domain>");
    setShowReplace(true);
  };

  const ok = result.kind === "ok" ? result : null;
  const zeroLength = ok ? ok.matches.filter((m) => m.end === m.index).length : 0;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Regex tester"
        actions={
          <>
            <Btn variant="ghost" icon="regex" onClick={loadSample}>
              Load sample
            </Btn>
            <ResetBtn onClick={reset} />
          </>
        }
      >
        <SplitGrid>
          <div className="min-w-0 space-y-5">
            <div>
              <TextField
                label="Pattern"
                hint="Write the pattern without the surrounding slashes."
                placeholder={String.raw`\b\w+@\w+\.\w+\b`}
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                error={result.kind === "error" && debounced.pattern === pattern ? result.message : null}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="[&_input]:font-mono"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="inline-code max-w-full break-all">{literal}</code>
                <CopyBtn text={pattern ? literal : ""} label="Copy as JS literal" />
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-ink">Flags</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {FLAGS.map((f) => (
                  <Checkbox
                    key={f.key}
                    checked={flags[f.key]}
                    onChange={(v) => setFlags((prev) => ({ ...prev, [f.key]: v }))}
                    label={
                      <>
                        <code className="inline-code">{f.key}</code> {f.name}
                      </>
                    }
                    hint={f.hint}
                  />
                ))}
              </div>
            </fieldset>

            <TextArea
              label="Test text"
              mono
              placeholder="Paste the text to search."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
            />

            <div className="space-y-3">
              <Checkbox
                label="Show replace preview"
                checked={showReplace}
                onChange={setShowReplace}
                hint="Use $1, $<name> or $& to insert captured text."
              />
              {showReplace && (
                <TextField
                  label="Replace with"
                  optional
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="[&_input]:font-mono"
                />
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            {result.kind === "empty" ? (
              <EmptyState icon="regex" title="Enter a pattern to start">
                Matches are highlighted as you type. Load the sample to see named groups in action.
              </EmptyState>
            ) : result.kind === "error" ? (
              <EmptyState icon="alert" title="Invalid pattern">
                Fix the pattern above to see matches. The error message is shown under the pattern field.
              </EmptyState>
            ) : (
              <>
                <StatGrid
                  items={[
                    { label: "Matches", value: `${fmt(result.matches.length, 0)}${result.capped ? "+" : ""}` },
                    { label: "Groups per match", value: result.matches[0]?.groups.length ?? 0 },
                    { label: "Flags", value: debounced.flags || "none" },
                  ]}
                />
                <p className="sr-only" aria-live="polite">
                  {result.matches.length === 0
                    ? "No matches"
                    : `${result.matches.length}${result.capped ? " or more" : ""} matches`}
                </p>
                {result.capped && (
                  <Notice tone="warning">
                    Showing the first {fmt(MAX_MATCHES, 0)} matches. More exist but are not listed to keep the page
                    responsive.
                  </Notice>
                )}
                {result.timedOut && (
                  <Notice tone="warning" title="Matching stopped early">
                    The pattern took longer than {TIME_BUDGET_MS} ms. It may cause catastrophic backtracking. Try
                    making nested quantifiers more specific.
                  </Notice>
                )}
                {!debounced.flags.includes("g") && result.matches.length > 0 && (
                  <Notice tone="info">Without the g flag, only the first match is found.</Notice>
                )}

                <div>
                  <h3 className="font-sans text-base font-semibold tracking-normal">Highlighted matches</h3>
                  {debounced.text ? (
                    <div
                      tabIndex={0}
                      aria-label="Test text with matches highlighted"
                      className="mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-sunken p-4 font-mono text-[0.85rem] leading-relaxed text-ink"
                    >
                      {segs.map((s, i) =>
                        s.match === null ? (
                          <span key={i}>{s.text}</span>
                        ) : (
                          <mark
                            key={i}
                            title={`Match ${s.match}`}
                            className={`rounded-sm px-px text-ink underline decoration-2 underline-offset-2 ${
                              s.match % 2 ? "bg-accent-soft decoration-accent" : "bg-[color-mix(in_oklch,var(--accent)_28%,transparent)] decoration-accent-strong"
                            }`}
                          >
                            {s.text}
                          </mark>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Add test text to see matches.</p>
                  )}
                  {zeroLength > 0 && (
                    <p className="mt-2 text-[0.8125rem] text-muted">
                      {zeroLength} zero-length match{zeroLength === 1 ? "" : "es"} listed below but not highlighted.
                    </p>
                  )}
                </div>

                {result.matches.length > 0 && (
                  <div>
                    <h3 className="font-sans text-base font-semibold tracking-normal">Match details</h3>
                    <div className="mt-2 max-h-[360px] overflow-auto rounded-lg shadow-[0_0_0_1px_var(--line)]">
                      <table className="w-full min-w-[420px] text-left text-sm">
                        <caption className="sr-only">Matches with index, value and capture groups</caption>
                        <thead className="sticky top-0 bg-sunken text-[0.8125rem] text-muted">
                          <tr>
                            <th scope="col" className="px-3 py-2 font-medium">#</th>
                            <th scope="col" className="px-3 py-2 font-medium">Index</th>
                            <th scope="col" className="px-3 py-2 font-medium">Value</th>
                            <th scope="col" className="px-3 py-2 font-medium">Groups</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.matches.map((m) => (
                            <tr key={m.n} className="border-t border-line align-top">
                              <td className="px-3 py-2 tabular-nums text-muted">{m.n}</td>
                              <td className="px-3 py-2 tabular-nums">{m.index}</td>
                              <td className="px-3 py-2 font-mono break-all">
                                {m.value === "" ? <span className="text-muted">(empty)</span> : m.value}
                              </td>
                              <td className="px-3 py-2">
                                {m.groups.length === 0 ? (
                                  <span className="text-muted">None</span>
                                ) : (
                                  <ul className="space-y-0.5">
                                    {m.groups.map((g) => (
                                      <li key={g.label} className="font-mono text-[0.8125rem] break-all">
                                        <span className="text-muted">{g.label}:</span>{" "}
                                        {g.value === undefined ? <span className="text-muted">(no match)</span> : `"${g.value}"`}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {debounced.showReplace && (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-sans text-base font-semibold tracking-normal">Replace preview</h3>
                      <CopyBtn text={result.replaced ?? ""} label="Copy result" />
                    </div>
                    <div className="mt-2">
                      {result.replaceError ? (
                        <Notice tone="error">{result.replaceError}</Notice>
                      ) : (
                        <OutputBlock label="Replaced text">
                          <span className="whitespace-pre-wrap break-words">{result.replaced ?? ""}</span>
                        </OutputBlock>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            <details className="faq rounded-lg bg-sunken px-4 py-3">
              <summary className="flex items-center justify-between gap-2 text-sm font-medium text-ink">
                Quick reference
                <span aria-hidden="true" className="faq-icon text-lg leading-none text-muted">+</span>
              </summary>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                {CHEATS.map(([token, desc]) => (
                  <div key={token} className="contents">
                    <dt>
                      <code className="inline-code whitespace-pre">{token}</code>
                    </dt>
                    <dd className="mb-1 text-ink-2 sm:mb-0">{desc}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
