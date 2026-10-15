"use client";

/** Small UI helpers shared by the developer tools. */

import { useEffect, useRef, useState } from "react";
import { Btn, CopyBtn, Notice, OutputBlock, StatGrid, downloadFile, fmt } from "@/components/tools/kit";

const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
export const byteLen = (s: string) => (enc ? enc.encode(s).length : s.length);

export function sizeText(n: number) {
  if (n < 1024) return `${fmt(n, 0)} B`;
  if (n < 1024 * 1024) return `${fmt(n / 1024, 1)} KB`;
  return `${fmt(n / (1024 * 1024), 2)} MB`;
}

export function snippetAt(source: string, line: number, column: number): string | null {
  const raw = source.split(/\r?\n/)[line - 1];
  if (raw === undefined) return null;
  const start = Math.max(0, column - 60);
  const shown = raw.slice(start, start + 120).replace(/\t/g, " ");
  const gutter = `${line} | `;
  return `${gutter}${shown}\n${" ".repeat(gutter.length + Math.max(0, column - 1 - start))}^`;
}

export function ParseError({
  title,
  message,
  line,
  column,
  source,
}: {
  title: string;
  message: string;
  line?: number | null;
  column?: number | null;
  source?: string;
}) {
  const snip = line && source !== undefined ? snippetAt(source, line, column ?? 1) : null;
  return (
    <div className="space-y-3">
      <Notice tone="error" title={title}>
        <p>
          {line ? `Line ${line}${column ? `, column ${column}` : ""}: ` : ""}
          {message}
        </p>
      </Notice>
      {snip && (
        <OutputBlock label="Error location">
          <code>{snip}</code>
        </OutputBlock>
      )}
    </div>
  );
}

/** Output with copy and download actions. */
export function CodeResult({
  code,
  filename,
  mime = "text/plain",
  label = "Output",
  extra,
}: {
  code: string;
  filename: string;
  mime?: string;
  label?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <CopyBtn text={code} />
        <Btn variant="ghost" icon="download" onClick={() => downloadFile(filename, code, mime)}>
          Download {filename.slice(filename.lastIndexOf("."))}
        </Btn>
        {extra}
      </div>
      <OutputBlock label={label}>
        <code>{code}</code>
      </OutputBlock>
    </div>
  );
}

export function SizeStats({ before, after, extra = [] }: { before: number; after: number; extra?: { label: string; value: React.ReactNode }[] }) {
  const diff = before > 0 ? ((after - before) / before) * 100 : 0;
  return (
    <StatGrid
      items={[
        { label: "Before", value: sizeText(before) },
        { label: "After", value: sizeText(after) },
        { label: "Change", value: `${diff > 0 ? "+" : ""}${fmt(diff, 1)}%` },
        ...extra,
      ]}
    />
  );
}

/**
 * Guards async work: `start()` returns a token; `isCurrent(token)` is false
 * after a newer start() or after unmount, so stale results are ignored.
 */
export function useRunGuard() {
  const run = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return {
    start: () => ++run.current,
    isCurrent: (token: number) => alive.current && token === run.current,
  };
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Line/column of a JSON.parse error, from the engine's message when it reports one. */
export function jsonErrorLocation(msg: string, text: string): { line: number; column: number } | null {
  const lc = /line (\d+) column (\d+)/i.exec(msg);
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) };
  const p = /position (\d+)/i.exec(msg);
  let pos: number | null = p ? Number(p[1]) : null;
  if (pos === null && /unexpected end/i.test(msg)) pos = text.length;
  if (pos === null) return null;
  const lines = text.slice(0, pos).split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/** Parses JSON and returns either the value or a located error. */
export function parseJson<T = unknown>(text: string): { ok: true; value: T } | { ok: false; message: string; line: number | null; column: number | null } {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (e) {
    const message = errorMessage(e).replace(/^JSON\.parse:\s*/i, "");
    const loc = jsonErrorLocation(message, text);
    return { ok: false, message, line: loc?.line ?? null, column: loc?.column ?? null };
  }
}

/** Current time in ms, refreshed every `everyMs`. Null until mounted (keeps render pure and hydration-safe). */
export function useNow(everyMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, everyMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [everyMs]);
  return now;
}
