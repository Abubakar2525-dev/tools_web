"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, SelectField, SplitGrid, TextArea, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { CodeResult, ParseError, errorMessage, useRunGuard } from "./shared";
import { yamlErrorInfo } from "./lib/yamlError";

type Engine = "prettier" | "normalize";

const SAMPLE = `# CI pipeline
name:   build
on: {push: {branches: [main]}, pull_request: {}}
jobs:
    test:
      runs-on: ubuntu-latest   # pinned runner
      steps:
      - uses: actions/checkout@v4
      - name: Install
        run:    npm ci
      - name: Test
        run: |
          npm test
          npm run lint
`;

type Out = { kind: "ok"; text: string; docs: number; validateOnly: boolean } | { kind: "error"; message: string; line: number | null; column: number | null; source: string };

export default function Tool() {
  const [input, setInput] = useState("");
  const [engine, setEngine] = useState<Engine>("prettier");
  const [indent, setIndent] = useState("2");
  const [quote, setQuote] = useState<"double" | "single">("double");
  const [expandFlow, setExpandFlow] = useState(true);
  const [out, setOut] = useState<Out | null>(null);
  const [busy, setBusy] = useState(false);
  const [emptyErr, setEmptyErr] = useState(false);
  const guard = useRunGuard();

  const run = async (validateOnly: boolean, text = input) => {
    if (!text.trim()) {
      setEmptyErr(true);
      return;
    }
    setEmptyErr(false);
    const token = guard.start();
    setBusy(true);
    try {
      const yaml = await import("js-yaml");
      if (!guard.isCurrent(token)) return;
      let docs: unknown[];
      try {
        docs = yaml.loadAll(text);
      } catch (e) {
        setOut({ kind: "error", ...yamlErrorInfo(e), source: text });
        return;
      }
      if (validateOnly) {
        setOut({ kind: "ok", text: "", docs: docs.length, validateOnly: true });
        return;
      }
      let formatted: string;
      if (engine === "prettier") {
        const [prettier, plugin] = await Promise.all([import("prettier/standalone"), import("prettier/plugins/yaml")]);
        if (!guard.isCurrent(token)) return;
        formatted = await prettier.format(text, { parser: "yaml", plugins: [plugin], tabWidth: Number(indent), singleQuote: quote === "single" });
      } else {
        const events = yaml.parseEvents(text, {});
        const ast = yaml.eventsToAst(events, { source: text, schema: yaml.CORE_SCHEMA });
          yaml.visit(ast, (node) => {
            // let the presenter pick quotes again, except for words YAML 1.1 parsers read as booleans
            if (
              node.kind === "scalar" &&
              (node.style === yaml.SCALAR_STYLE.SINGLE_QUOTED || node.style === yaml.SCALAR_STYLE.DOUBLE_QUOTED) &&
              !/^(y|n|yes|no|on|off)$/i.test(node.value)
            ) {
              node.style = yaml.SCALAR_STYLE.PLAIN;
            }
            if (expandFlow && (node.kind === "mapping" || node.kind === "sequence")) {
              if (node.items.length > 0) node.style = yaml.COLLECTION_STYLE.BLOCK;
            }
          });
        formatted = yaml.present(ast, { schema: yaml.CORE_SCHEMA, indent: Number(indent), quoteStyle: quote, lineWidth: -1 });
      }
      if (!guard.isCurrent(token)) return;
      setOut({ kind: "ok", text: formatted, docs: docs.length, validateOnly: false });
    } catch (e) {
      if (!guard.isCurrent(token)) return;
      const loc = (e as { loc?: { start?: { line?: number; column?: number } } }).loc?.start;
      setOut({ kind: "error", message: errorMessage(e).split("\n")[0], line: loc?.line ?? null, column: loc?.column ?? null, source: text });
    } finally {
      if (guard.isCurrent(token)) setBusy(false);
    }
  };

  const hasComments = /(^|\s)#/m.test(input);

  return (
    <div className="space-y-5">
      <ToolPanel title="Formatting engine">
        <div className="space-y-4">
          <Segmented
            label="Formatting engine"
            value={engine}
            onChange={setEngine}
            options={[
              { value: "prettier", label: "Prettier (keeps comments)" },
              { value: "normalize", label: "Normalize (js-yaml)" },
            ]}
          />
          <p className="text-sm text-ink-2">
            {engine === "prettier"
              ? "Reformats spacing and indentation while keeping comments, anchors, quotes and flow collections as written."
              : "Rebuilds the document from the parsed tree: consistent quoting and block style. Comments and blank lines are not preserved."}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Indent" value={indent} onChange={(e) => setIndent(e.target.value)} options={[{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }]} />
            <SelectField
              label="Preferred quotes"
              value={quote}
              onChange={(e) => setQuote(e.target.value as "double" | "single")}
              options={[
                { value: "double", label: 'Double "…"' },
                { value: "single", label: "Single '…'" },
              ]}
            />
            {engine === "normalize" && (
              <div className="pt-7">
                <Checkbox label="Expand {…} and […] to block style" checked={expandFlow} onChange={setExpandFlow} />
              </div>
            )}
          </div>
          {engine === "normalize" && hasComments && <Notice tone="warning">Your input contains comments. Normalize mode removes them; switch to Prettier to keep them.</Notice>}
        </div>
      </ToolPanel>
      <SplitGrid>
        <ToolPanel
          title="YAML input"
          actions={
            <>
              <Btn
                variant="ghost"
                icon="code"
                onClick={() => {
                  setInput(SAMPLE);
                  void run(false, SAMPLE);
                }}
              >
                Load sample
              </Btn>
              <ResetBtn
                onClick={() => {
                  setInput("");
                  setOut(null);
                  setEmptyErr(false);
                }}
              />
            </>
          }
        >
          <div className="space-y-4">
            <TextArea
              label="YAML"
              mono
              rows={16}
              value={input}
              error={emptyErr ? "Paste some YAML first." : null}
              hint="Multiple documents separated by --- are supported. Ctrl or Cmd + Enter formats."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void run(false);
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Btn icon="code" onClick={() => void run(false)} disabled={busy}>
                Format
              </Btn>
              <Btn variant="ghost" icon="check" onClick={() => void run(true)} disabled={busy}>
                Validate
              </Btn>
              {busy && <Spinner label="Working" />}
            </div>
          </div>
        </ToolPanel>
        <ToolPanel title="Result">
          {!out ? (
            <EmptyState icon="code" title="No result yet">
              Paste YAML and choose Format or Validate.
            </EmptyState>
          ) : out.kind === "error" ? (
            <ParseError title="Invalid YAML" message={out.message} line={out.line} column={out.column} source={out.source} />
          ) : (
            <div className="space-y-4">
              <Notice tone="success">
                Valid YAML: {out.docs} document{out.docs === 1 ? "" : "s"} (YAML 1.2 core schema).
              </Notice>
              {!out.validateOnly && <CodeResult code={out.text} filename="formatted.yaml" mime="application/yaml" label="Formatted YAML" />}
            </div>
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
