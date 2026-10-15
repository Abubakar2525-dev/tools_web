"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, SelectField, SplitGrid, TextArea, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { CodeResult, ParseError, errorMessage, parseJson, useRunGuard } from "./shared";
import { yamlErrorInfo } from "./lib/yamlError";

type Mode = "json2yaml" | "yaml2json";

const JSON_SAMPLE = `{
  "service": "billing-api",
  "version": "1.10",
  "replicas": 3,
  "debug": false,
  "country": "NO",
  "enabled": "yes",
  "ports": [8080, 9090],
  "env": { "LOG_LEVEL": "info", "EMPTY": null },
  "motd": "Line one\\nLine two"
}`;

const YAML_SAMPLE = `# deployment settings
service: billing-api
version: "1.10"
replicas: 3
debug: false
country: NO        # a string under YAML 1.2, false under YAML 1.1
ports:
  - 8080
  - 9090
env:
  LOG_LEVEL: info
  EMPTY: ~
motd: |
  Line one
  Line two
`;

type Out = { kind: "ok"; text: string; note?: string } | { kind: "error"; title: string; message: string; line?: number | null; column?: number | null; source?: string };

export default function Tool() {
  const [mode, setMode] = useState<Mode>("json2yaml");
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState("2");
  const [quoteStyle, setQuoteStyle] = useState<"single" | "double">("double");
  const [forceQuotes, setForceQuotes] = useState(false);
  const [sortKeys, setSortKeys] = useState(false);
  const [flow, setFlow] = useState("-1");
  const [schema, setSchema] = useState<"core" | "yaml11">("core");
  const [multi, setMulti] = useState(false);
  const [jsonIndent, setJsonIndent] = useState("2");
  const [out, setOut] = useState<Out | null>(null);
  const [busy, setBusy] = useState(false);
  const guard = useRunGuard();

  const convert = async () => {
    if (!input.trim()) {
      setOut({ kind: "error", title: "Nothing to convert", message: `Paste some ${mode === "json2yaml" ? "JSON" : "YAML"} first.` });
      return;
    }
    const token = guard.start();
    setBusy(true);
    try {
      const yaml = await import("js-yaml");
      if (!guard.isCurrent(token)) return;
      if (mode === "json2yaml") {
        const p = parseJson(input);
        if (!p.ok) {
          setOut({ kind: "error", title: "Invalid JSON", message: p.message, line: p.line, column: p.column, source: input });
          return;
        }
        const text = yaml.dump(p.value, {
          indent: Number(indent),
          quoteStyle,
          forceQuotes,
          sortKeys,
          flowLevel: Number(flow),
          lineWidth: -1,
          noRefs: true,
        });
        setOut({ kind: "ok", text });
      } else {
        const opts = { schema: schema === "core" ? yaml.CORE_SCHEMA : yaml.YAML11_SCHEMA };
        let value: unknown;
        try {
          value = multi ? yaml.loadAll(input, opts) : yaml.load(input, opts);
        } catch (e) {
          const info = yamlErrorInfo(e);
          const multiHint = !multi && /document/i.test(info.message) ? " If the file has several documents separated by ---, turn on multiple documents." : "";
          setOut({ kind: "error", title: "Invalid YAML", message: info.message + multiHint, line: info.line, column: info.column, source: input });
          return;
        }
        const text = JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), jsonIndent === "tab" ? "\t" : Number(jsonIndent));
        setOut({ kind: "ok", text: (text ?? "null") + "\n", note: /^\s*#|\s#/m.test(input) ? "YAML comments have no JSON equivalent, so they are not in the output." : undefined });
      }
    } catch (e) {
      if (guard.isCurrent(token)) setOut({ kind: "error", title: "Conversion failed", message: errorMessage(e) });
    } finally {
      if (guard.isCurrent(token)) setBusy(false);
    }
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
              { value: "json2yaml", label: "JSON to YAML" },
              { value: "yaml2json", label: "YAML to JSON" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mode === "json2yaml" ? (
              <>
                <SelectField label="Indent" value={indent} onChange={(e) => setIndent(e.target.value)} options={[{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }]} />
                <SelectField
                  label="Quote style when quoting is needed"
                  value={quoteStyle}
                  onChange={(e) => setQuoteStyle(e.target.value as "single" | "double")}
                  options={[
                    { value: "double", label: 'Double quotes "…"' },
                    { value: "single", label: "Single quotes '…'" },
                  ]}
                />
                <SelectField
                  label="Collection style"
                  value={flow}
                  onChange={(e) => setFlow(e.target.value)}
                  options={[
                    { value: "-1", label: "Block (one item per line)" },
                    { value: "1", label: "Flow from level 2 ({a: 1})" },
                    { value: "0", label: "Flow everywhere (JSON-like)" },
                  ]}
                />
                <Checkbox label="Quote every string" checked={forceQuotes} onChange={setForceQuotes} />
                <Checkbox label="Sort keys alphabetically" checked={sortKeys} onChange={setSortKeys} />
              </>
            ) : (
              <>
                <SelectField
                  label="YAML version rules"
                  value={schema}
                  hint="YAML 1.1 reads yes, no, on, off as booleans and 2024-01-01 as a date."
                  onChange={(e) => setSchema(e.target.value as "core" | "yaml11")}
                  options={[
                    { value: "core", label: "YAML 1.2 core schema" },
                    { value: "yaml11", label: "YAML 1.1 (older parsers)" },
                  ]}
                />
                <SelectField label="JSON indent" value={jsonIndent} onChange={(e) => setJsonIndent(e.target.value)} options={[{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }, { value: "tab", label: "Tab" }, { value: "0", label: "Minified" }]} />
                <Checkbox label="Multiple documents (---)" hint="Outputs a JSON array with one entry per document." checked={multi} onChange={setMulti} />
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <SplitGrid>
        <ToolPanel
          title={mode === "json2yaml" ? "JSON input" : "YAML input"}
          actions={
            <>
              <Btn variant="ghost" icon="braces" onClick={() => setInput(mode === "json2yaml" ? JSON_SAMPLE : YAML_SAMPLE)}>
                Load sample
              </Btn>
              <ResetBtn
                onClick={() => {
                  setInput("");
                  setOut(null);
                }}
              />
            </>
          }
        >
          <div className="space-y-4">
            <TextArea
              label={mode === "json2yaml" ? "JSON" : "YAML"}
              mono
              rows={16}
              value={input}
              hint="Press Ctrl or Cmd + Enter to convert."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void convert();
                }
              }}
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
            <EmptyState icon="code" title="No result yet">
              Paste {mode === "json2yaml" ? "JSON" : "YAML"} and press Convert.
            </EmptyState>
          ) : out.kind === "error" ? (
            <ParseError title={out.title} message={out.message} line={out.line} column={out.column} source={out.source} />
          ) : (
            <div className="space-y-4">
              {out.note && <Notice>{out.note}</Notice>}
              <CodeResult
                code={out.text}
                filename={mode === "json2yaml" ? "data.yaml" : "data.json"}
                mime={mode === "json2yaml" ? "application/yaml" : "application/json"}
                extra={
                  <Btn
                    variant="subtle"
                    icon="swap"
                    onClick={() => {
                      setMode(mode === "json2yaml" ? "yaml2json" : "json2yaml");
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
