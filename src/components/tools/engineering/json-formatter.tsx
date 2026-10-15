"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Btn,
  CopyBtn,
  EmptyState,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SplitGrid,
  StatGrid,
  TextArea,
  ToolPanel,
  downloadFile,
  fmt,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Indent = "2" | "4" | "tab";
type Action = "format" | "minify" | "sort" | "validate";

type Stats = { bytes: number; keys: number; depth: number; root: string; nodes: number };

type Result =
  | { kind: "ok"; action: Action; output: string; stats: Stats; source: string }
  | { kind: "error"; message: string; line: number | null; column: number | null; snippet: string | null; source: string };

const SAMPLE = `{"project":"Nuvella Promo Code","version":3,"active":true,"owners":[{"name":"Ada","role":"lead"},{"name":"Lin","role":"eng"}],"limits":{"rpm":600,"burst":null},"tags":["ai","tools"],"meta":{"created":"2026-01-04","nested":{"level":{"deep":[1,2,{"ok":true}]}}}}`;

const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
const byteLength = (s: string) => (encoder ? encoder.encode(s).length : s.length);

function formatBytes(n: number) {
  if (n < 1024) return `${fmt(n, 0)} B`;
  if (n < 1024 * 1024) return `${fmt(n / 1024, 1)} KB`;
  return `${fmt(n / (1024 * 1024), 2)} MB`;
}

function typeOf(v: Json): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/** Iterative walk so very deep documents cannot overflow the call stack. */
function analyze(root: Json): Omit<Stats, "bytes"> {
  let keys = 0;
  let depth = 0;
  let nodes = 0;
  const stack: [Json, number][] = [[root, 1]];
  while (stack.length) {
    const [v, d] = stack.pop() as [Json, number];
    nodes += 1;
    if (v !== null && typeof v === "object") {
      if (d > depth) depth = d;
      if (Array.isArray(v)) {
        for (const item of v) stack.push([item, d + 1]);
      } else {
        const ks = Object.keys(v);
        keys += ks.length;
        for (const k of ks) stack.push([v[k], d + 1]);
      }
    }
  }
  return { keys, depth, nodes, root: typeOf(root) };
}

function sortKeys(v: Json): Json {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === "object") {
    const out: { [key: string]: Json } = {};
    for (const k of Object.keys(v).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}

function lineColFromPos(text: string, pos: number) {
  const p = Math.max(0, Math.min(pos, text.length));
  let line = 1;
  let lastNl = -1;
  for (let i = 0; i < p; i++) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      lastNl = i;
    }
  }
  return { line, column: p - lastNl };
}

/** Reads a position out of the error message. Browsers word this differently. */
function locateError(text: string, message: string): { line: number; column: number } | null {
  const lc = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) };
  const pos = /position\s+(\d+)/i.exec(message);
  if (pos) return lineColFromPos(text, Number(pos[1]));
  if (/unexpected end/i.test(message) || /end of (json )?(input|data)/i.test(message)) {
    return lineColFromPos(text, text.length);
  }
  return null;
}

function snippetFor(text: string, line: number, column: number) {
  const lines = text.split("\n");
  const raw = lines[line - 1];
  if (raw === undefined) return null;
  const start = Math.max(0, column - 60);
  const shown = raw.slice(start, start + 120).replace(/\t/g, " ");
  const caret = " ".repeat(Math.max(0, column - 1 - start)) + "^";
  const gutter = `${line} | `;
  return `${gutter}${shown}\n${" ".repeat(gutter.length)}${caret}`;
}

function cleanMessage(message: string) {
  return message.replace(/^JSON\.parse:\s*/i, "").replace(/^JSON Parse error:\s*/i, "");
}

function run(text: string, action: Action, indent: Indent): Result {
  let parsed: Json;
  try {
    parsed = JSON.parse(text) as Json;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const loc = locateError(text, message);
    return {
      kind: "error",
      message: cleanMessage(message),
      line: loc?.line ?? null,
      column: loc?.column ?? null,
      snippet: loc ? snippetFor(text, loc.line, loc.column) : null,
      source: text,
    };
  }
  const space = indent === "tab" ? "\t" : Number(indent);
  let output: string;
  if (action === "minify") output = JSON.stringify(parsed);
  else if (action === "sort") output = JSON.stringify(sortKeys(parsed), null, space);
  else output = JSON.stringify(parsed, null, space);
  return {
    kind: "ok",
    action,
    output,
    source: text,
    stats: { ...analyze(parsed), bytes: byteLength(output) },
  };
}

const ACTION_LABEL: Record<Action, string> = {
  format: "Formatted",
  minify: "Minified",
  sort: "Keys sorted",
  validate: "Valid JSON",
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<Indent>("2");
  const [result, setResult] = useState<Result | null>(null);
  const [emptyError, setEmptyError] = useState(false);

  const act = (action: Action, nextIndent: Indent = indent) => {
    if (!input.trim()) {
      setEmptyError(true);
      setResult(null);
      return;
    }
    setEmptyError(false);
    setResult(run(input, action, nextIndent));
  };

  const reset = () => {
    setInput("");
    setResult(null);
    setEmptyError(false);
  };

  const stale = result !== null && result.source !== input;
  const deferredInput = useDeferredValue(input);
  const inputBytes = useMemo(() => byteLength(deferredInput), [deferredInput]);

  return (
    <div className="space-y-5">
      <ToolPanel
        title="JSON formatter and validator"
        actions={
          <>
            <Btn
              variant="ghost"
              icon="braces"
              onClick={() => {
                setInput(SAMPLE);
                setResult(run(SAMPLE, "format", indent));
                setEmptyError(false);
              }}
            >
              Load sample
            </Btn>
            <ResetBtn onClick={reset} />
          </>
        }
      >
        <SplitGrid>
          <div className="min-w-0 space-y-4">
            <TextArea
              label="JSON input"
              mono
              hint="Paste JSON, then choose an action. Press Ctrl or Cmd + Enter to format."
              placeholder='{"name": "value"}'
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (emptyError) setEmptyError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  act("format");
                }
              }}
              error={emptyError ? "Paste some JSON first." : null}
              rows={14}
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-ink" aria-hidden="true">
                Indent
              </span>
              <Segmented
                label="Indent"
                value={indent}
                onChange={(v) => {
                  setIndent(v);
                  if (result?.kind === "ok" && (result.action === "format" || result.action === "sort") && !stale) {
                    act(result.action, v);
                  }
                }}
                options={[
                  { value: "2", label: "2 spaces" },
                  { value: "4", label: "4 spaces" },
                  { value: "tab", label: "Tab" },
                ]}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn icon="braces" onClick={() => act("format")}>
                Format
              </Btn>
              <Btn variant="ghost" onClick={() => act("minify")}>
                Minify
              </Btn>
              <Btn variant="ghost" onClick={() => act("sort")}>
                Sort keys
              </Btn>
              <Btn variant="ghost" icon="check" onClick={() => act("validate")}>
                Validate
              </Btn>
            </div>
            <p className="text-[0.8125rem] text-muted">Input size: {formatBytes(inputBytes)}</p>
          </div>

          <div className="min-w-0 space-y-4">
            {result === null ? (
              <EmptyState icon="braces" title="No output yet">
                Paste JSON and choose Format, Minify, Sort keys or Validate. Large files are processed only when you
                press a button.
              </EmptyState>
            ) : result.kind === "error" ? (
              <>
                <Notice tone="error" title="Invalid JSON">
                  <p>
                    {result.line !== null && result.column !== null
                      ? `Line ${result.line}, column ${result.column}: `
                      : "Position not reported by this browser: "}
                    {result.message}
                  </p>
                </Notice>
                {result.snippet && (
                  <OutputBlock label="Error location">
                    <code>{result.snippet}</code>
                  </OutputBlock>
                )}
                <p className="text-[0.8125rem] text-muted">
                  Common causes: trailing commas, single quotes instead of double quotes, unquoted keys or comments.
                </p>
              </>
            ) : (
              <>
                <Notice tone="success">
                  {ACTION_LABEL[result.action]}.
                  {result.action === "validate" ? " The input parses as JSON." : ""}
                </Notice>
                {stale && (
                  <Notice tone="warning">The input changed since this result. Run an action again to refresh.</Notice>
                )}
                <StatGrid
                  items={[
                    { label: "Root type", value: result.stats.root },
                    { label: "Size", value: formatBytes(result.stats.bytes) },
                    { label: "Keys", value: fmt(result.stats.keys, 0) },
                    { label: "Max depth", value: fmt(result.stats.depth, 0) },
                    { label: "Values", value: fmt(result.stats.nodes, 0) },
                    { label: "Lines", value: fmt(result.output.split("\n").length, 0) },
                  ]}
                />
                {result.action !== "validate" && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <CopyBtn text={result.output} />
                      <Btn
                        variant="ghost"
                        icon="download"
                        onClick={() => downloadFile("formatted.json", result.output, "application/json")}
                      >
                        Download .json
                      </Btn>
                    </div>
                    <OutputBlock label="Formatted JSON">
                      <code>{result.output}</code>
                    </OutputBlock>
                  </>
                )}
              </>
            )}
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
