"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, SelectField, SplitGrid, StatGrid, TextArea, TextField, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { toRows, unflatten } from "./lib/flatten";
import { CodeResult, ParseError, errorMessage, parseJson, useRunGuard } from "./shared";

type Mode = "json2csv" | "csv2json";

const JSON_SAMPLE = `[
  { "id": 1, "name": "Ada", "address": { "city": "London", "zip": "N1 9GU" }, "skills": ["math", "code"] },
  { "id": 2, "name": "Grace, R.", "address": { "city": "New York" }, "skills": [] },
  { "id": 3, "name": "Lin \\"Kit\\" Chen", "address": null, "skills": ["ops"] }
]`;

const CSV_SAMPLE = `id,name,address.city,address.zip,active
1,Ada,London,N1 9GU,true
2,"Grace, R.",New York,,false
3,"Lin ""Kit"" Chen",,,true`;

const DELIMS = [
  { value: ",", label: "Comma (,)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe (|)" },
];

type Out =
  | { kind: "ok"; text: string; rows: number; cols: number; warnings: string[] }
  | { kind: "error"; title: string; message: string; line?: number | null; column?: number | null; source?: string };

export default function Tool() {
  const [mode, setMode] = useState<Mode>("json2csv");
  const [input, setInput] = useState("");
  const [delim, setDelim] = useState(",");
  const [sep, setSep] = useState(".");
  const [arrays, setArrays] = useState<"index" | "json">("json");
  const [header, setHeader] = useState(true);
  const [quoteAll, setQuoteAll] = useState(false);
  const [autoDelim, setAutoDelim] = useState(true);
  const [typed, setTyped] = useState(true);
  const [nest, setNest] = useState(true);
  const [out, setOut] = useState<Out | null>(null);
  const [busy, setBusy] = useState(false);
  const guard = useRunGuard();

  const convert = async () => {
    if (!input.trim()) {
      setOut({ kind: "error", title: "Nothing to convert", message: mode === "json2csv" ? "Paste some JSON first." : "Paste some CSV first." });
      return;
    }
    const token = guard.start();
    setBusy(true);
    try {
      const Papa = (await import("papaparse")).default;
      if (!guard.isCurrent(token)) return;
      if (mode === "json2csv") {
        const p = parseJson(input);
        if (!p.ok) {
          setOut({ kind: "error", title: "Invalid JSON", message: p.message, line: p.line, column: p.column, source: input });
          return;
        }
        const { rows, columns } = toRows(p.value as Parameters<typeof toRows>[0], { separator: sep || ".", arrays });
        const text = Papa.unparse({ fields: columns, data: rows.map((r) => columns.map((c) => (r[c] === null || r[c] === undefined ? "" : r[c]))) }, { delimiter: delim, quotes: quoteAll, header, newline: "\r\n" });
        setOut({ kind: "ok", text, rows: rows.length, cols: columns.length, warnings: [] });
      } else {
        const res = Papa.parse<Record<string, unknown> | unknown[]>(input.replace(/^﻿/, ""), {
          header,
          dynamicTyping: typed,
          skipEmptyLines: "greedy",
          delimiter: autoDelim ? "" : delim,
        });
        const fatal = res.errors.find((e) => e.type === "Quotes");
        if (fatal) {
          setOut({ kind: "error", title: "Could not parse CSV", message: `${fatal.message}${fatal.row !== undefined ? ` (data row ${fatal.row + 1})` : ""}.` });
          return;
        }
        const warnings = res.errors.slice(0, 5).map((e) => `Data row ${(e.row ?? 0) + 1}: ${e.message}`);
        if (res.errors.length > 5) warnings.push(`…and ${res.errors.length - 5} more.`);
        let data: unknown[] = res.data;
        if (header && nest && sep) data = (res.data as Record<string, unknown>[]).map((r) => unflatten(r, sep));
        const cols = header ? (res.meta.fields?.length ?? 0) : Math.max(0, ...(res.data as unknown[][]).map((r) => r.length));
        if (!autoDelim || res.meta.delimiter) warnings.unshift(`Delimiter used: ${res.meta.delimiter === "\t" ? "tab" : `"${res.meta.delimiter}"`}.`);
        setOut({ kind: "ok", text: JSON.stringify(data, null, 2), rows: data.length, cols, warnings });
      }
    } catch (e) {
      if (guard.isCurrent(token)) setOut({ kind: "error", title: "Conversion failed", message: errorMessage(e) });
    } finally {
      if (guard.isCurrent(token)) setBusy(false);
    }
  };

  const reset = () => {
    setInput("");
    setOut(null);
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Direction and options">
        <div className="space-y-5">
          <Segmented
            label="Direction"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setOut(null);
            }}
            options={[
              { value: "json2csv", label: "JSON to CSV" },
              { value: "csv2json", label: "CSV to JSON" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(mode === "json2csv" || !autoDelim) && <SelectField label="Delimiter" value={delim} onChange={(e) => setDelim(e.target.value)} options={DELIMS} />}
            <TextField label={mode === "json2csv" ? "Nested key separator" : "Split headers on"} hint={mode === "json2csv" ? 'address.city style column names.' : "Rebuild nested objects from headers like address.city."} value={sep} onChange={(e) => setSep(e.target.value)} />
            {mode === "json2csv" ? (
              <>
                <SelectField
                  label="Arrays"
                  value={arrays}
                  onChange={(e) => setArrays(e.target.value as "index" | "json")}
                  options={[
                    { value: "json", label: "Keep as JSON text in one cell" },
                    { value: "index", label: "Spread into numbered columns" },
                  ]}
                />
                <Checkbox label="Header row" checked={header} onChange={setHeader} />
                <Checkbox label="Quote every field" checked={quoteAll} onChange={setQuoteAll} />
              </>
            ) : (
              <>
                <Checkbox label="Detect delimiter automatically" checked={autoDelim} onChange={setAutoDelim} />
                <Checkbox label="First row is the header" hint="Off: each row becomes an array." checked={header} onChange={setHeader} />
                <Checkbox label="Convert numbers and booleans" checked={typed} onChange={setTyped} />
                <Checkbox label="Rebuild nested objects" checked={nest} onChange={setNest} />
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <SplitGrid>
        <ToolPanel
          title={mode === "json2csv" ? "JSON input" : "CSV input"}
          actions={
            <>
              <Btn variant="ghost" icon="braces" onClick={() => setInput(mode === "json2csv" ? JSON_SAMPLE : CSV_SAMPLE)}>
                Load sample
              </Btn>
              <ResetBtn onClick={reset} />
            </>
          }
        >
          <div className="space-y-4">
            <TextArea
              label={mode === "json2csv" ? "JSON (object or array of objects)" : "CSV text"}
              mono
              rows={16}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void convert();
                }
              }}
              hint="Press Ctrl or Cmd + Enter to convert."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Btn icon="swap" onClick={() => void convert()} disabled={busy}>
                Convert
              </Btn>
              {busy && <Spinner label="Converting" />}
            </div>
          </div>
        </ToolPanel>
        <ToolPanel title="Result">
          {!out ? (
            <EmptyState icon="table" title="No result yet">
              Choose a direction, paste your data and press Convert.
            </EmptyState>
          ) : out.kind === "error" ? (
            <ParseError title={out.title} message={out.message} line={out.line} column={out.column} source={out.source} />
          ) : (
            <div className="space-y-4">
              <StatGrid
                items={[
                  { label: "Rows", value: out.rows.toLocaleString() },
                  { label: "Columns", value: out.cols },
                ]}
              />
              {out.warnings.length > 0 && (
                <Notice tone={out.warnings.some((w) => w.startsWith("Data row")) ? "warning" : "info"}>
                  {out.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </Notice>
              )}
              <CodeResult
                code={out.text}
                filename={mode === "json2csv" ? (delim === "\t" ? "data.tsv" : "data.csv") : "data.json"}
                mime={mode === "json2csv" ? "text/csv" : "application/json"}
                extra={
                  <Btn
                    variant="subtle"
                    icon="swap"
                    onClick={() => {
                      setMode(mode === "json2csv" ? "csv2json" : "json2csv");
                      setInput(out.text);
                      setOut(null);
                    }}
                  >
                    Use as input
                  </Btn>
                }
              />
            </div>
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
