"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, TextField, ToolPanel } from "@/components/tools/kit";
import { FLAG_INFO, RegexSyntaxError, explainRegex, explanationToText, parseLiteral, type ExplainNode } from "./lib/regexExplain";

const EXAMPLES: { label: string; pattern: string; flags: string }[] = [
  { label: "Email (simple)", pattern: "^[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+$", flags: "i" },
  { label: "ISO date", pattern: "(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>\\d{2})", flags: "" },
  { label: "Price after $", pattern: "(?<=\\$)\\d+(?:\\.\\d{2})?", flags: "g" },
  { label: "Repeated word", pattern: "\\b(\\w+)\\s+\\1\\b", flags: "gi" },
  { label: "Hex color", pattern: "^#(?:[0-9a-f]{3}){1,2}$", flags: "i" },
  { label: "Letters in any script", pattern: "^\\p{L}+(?:[ '-]\\p{L}+)*$", flags: "u" },
];

function Tree({ nodes, depth = 0 }: { nodes: ExplainNode[]; depth?: number }) {
  return (
    <ul className={depth === 0 ? "space-y-2" : "mt-2 space-y-2 border-l border-line-strong pl-4"}>
      {nodes.map((n, i) => (
        <li key={`${n.start}-${i}`}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {n.src && <code className="max-w-full break-all rounded-md bg-night px-2 py-0.5 font-mono text-[0.85rem] text-night-ink">{n.src}</code>}
            <span className="text-[0.95rem] text-ink">{n.text}</span>
          </div>
          {n.children && n.children.length > 0 && <Tree nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export default function Tool() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("");
  const dPattern = useDeferredValue(pattern);
  const dFlags = useDeferredValue(flags);

  const result = useMemo(() => {
    if (!dPattern) return null;
    let p = dPattern;
    let f = dFlags.trim();
    const lit = parseLiteral(dPattern);
    if (lit) {
      p = lit.pattern;
      f = lit.flags || f;
    }
    let engineError: string | null = null;
    try {
      new RegExp(p, f);
    } catch (e) {
      engineError = e instanceof Error ? e.message : String(e);
    }
    try {
      const ex = explainRegex(p, f);
      return { ok: true as const, pattern: p, flags: f, ex, engineError, fromLiteral: !!lit };
    } catch (e) {
      const pos = e instanceof RegexSyntaxError ? e.pos : -1;
      return { ok: false as const, pattern: p, message: e instanceof Error ? e.message : String(e), pos, engineError };
    }
  }, [dPattern, dFlags]);

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Regular expression"
        actions={
          <ResetBtn
            onClick={() => {
              setPattern("");
              setFlags("");
            }}
          />
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <TextField
              label="Pattern"
              hint="Paste the pattern alone, or a full literal like /ab+c/gi."
              placeholder="^\d{3}-\d{4}$"
              spellCheck={false}
              autoComplete="off"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}
            />
            <TextField label="Flags" optional placeholder="gi" spellCheck={false} autoComplete="off" value={flags} onChange={(e) => setFlags(e.target.value)} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Examples</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((x) => (
                <Btn
                  key={x.label}
                  variant="ghost"
                  onClick={() => {
                    setPattern(x.pattern);
                    setFlags(x.flags);
                  }}
                >
                  {x.label}
                </Btn>
              ))}
            </div>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Explanation" actions={result?.ok ? <CopyBtn text={explanationToText(result.ex.nodes)} label="Copy as text" /> : undefined}>
        {!result ? (
          <EmptyState icon="regex" title="Nothing to explain yet">
            Type a pattern or pick an example. The explanation updates as you type.
          </EmptyState>
        ) : !result.ok ? (
          <div className="space-y-3">
            <Notice tone="error" title="Syntax error">
              {result.message}
              {result.engineError && result.engineError !== result.message ? <span className="mt-1 block text-ink-2">Your browser reports: {result.engineError}</span> : null}
            </Notice>
            {result.pos >= 0 && (
              <pre className="overflow-x-auto rounded-lg bg-night p-3 font-mono text-[0.85rem] text-night-ink" aria-label="Error position">
                {result.pattern}
                {"\n"}
                {" ".repeat(result.pos)}^
              </pre>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {result.engineError && (
              <Notice tone="warning" title="Your browser rejects this pattern">
                {result.engineError}. The explanation below may describe syntax this browser does not support yet.
              </Notice>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
              <span>
                Pattern: <code className="font-mono text-ink">/{result.pattern}/{result.flags}</code>
              </span>
              <span>Capture groups: {result.ex.groups}</span>
              {result.ex.names.length > 0 && <span>Named: {result.ex.names.join(", ")}</span>}
            </div>
            {result.flags && (
              <div>
                <p className="mb-1 text-sm font-medium text-ink">Flags</p>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                  {[...result.flags].map((f) => (
                    <li key={f}>{FLAG_INFO[f]}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.ex.nodes.length === 0 ? <p className="text-sm text-ink-2">An empty pattern matches the empty string at every position.</p> : <Tree nodes={result.ex.nodes} />}
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
