"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, EmptyState, PrivacyNote, ResetBtn, SelectField, SplitGrid, TextArea, TextField, ToolPanel } from "@/components/tools/kit";
import { jsonToTypeScript, type Json, type TsOptions } from "./lib/jsonTypes";
import { CodeResult, ParseError, errorMessage, parseJson } from "./shared";

const SAMPLE = `[
  { "id": 1, "title": "Write tests", "done": false, "assignee": { "name": "Lin", "email": "lin@example.com" }, "tags": ["qa"] },
  { "id": 2, "title": "Ship v2", "done": true, "assignee": null, "tags": [], "dueDate": "2026-11-01" }
]`;

const DEFAULTS: TsOptions = {
  rootName: "Root",
  declaration: "interface",
  readonly: false,
  exported: true,
  nullAsOptional: false,
  arrayStyle: "brackets",
};

export default function Tool() {
  const [input, setInput] = useState("");
  const [o, setO] = useState<TsOptions>(DEFAULTS);
  const dInput = useDeferredValue(input);
  const set = <K extends keyof TsOptions>(k: K, v: TsOptions[K]) => setO((p) => ({ ...p, [k]: v }));

  const result = useMemo(() => {
    if (!dInput.trim()) return null;
    const p = parseJson<Json>(dInput);
    if (!p.ok) return { kind: "parse" as const, ...p };
    try {
      return { kind: "ok" as const, code: jsonToTypeScript(p.value, o) };
    } catch (e) {
      return { kind: "gen" as const, message: errorMessage(e) };
    }
  }, [dInput, o]);

  return (
    <div className="space-y-5">
      <ToolPanel title="Options">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Root type name" value={o.rootName} onChange={(e) => set("rootName", e.target.value)} />
          <SelectField
            label="Declaration style"
            value={o.declaration}
            onChange={(e) => set("declaration", e.target.value as TsOptions["declaration"])}
            options={[
              { value: "interface", label: "interface" },
              { value: "type", label: "type alias" },
            ]}
          />
          <SelectField
            label="Array syntax"
            value={o.arrayStyle}
            onChange={(e) => set("arrayStyle", e.target.value as TsOptions["arrayStyle"])}
            options={[
              { value: "brackets", label: "T[]" },
              { value: "generic", label: "Array<T>" },
            ]}
          />
          <Checkbox label="Export declarations" checked={o.exported} onChange={(v) => set("exported", v)} />
          <Checkbox label="Readonly properties and arrays" checked={o.readonly} onChange={(v) => set("readonly", v)} />
          <Checkbox
            label="Treat null as optional (?)"
            hint="Off: null becomes | null. On: the property becomes optional instead."
            checked={o.nullAsOptional}
            onChange={(v) => set("nullAsOptional", v)}
          />
        </div>
      </ToolPanel>

      <SplitGrid>
        <ToolPanel
          title="JSON input"
          actions={
            <>
              <Btn variant="ghost" icon="braces" onClick={() => setInput(SAMPLE)}>
                Load sample
              </Btn>
              <ResetBtn
                onClick={() => {
                  setInput("");
                  setO(DEFAULTS);
                }}
              />
            </>
          }
        >
          <TextArea label="JSON" mono rows={18} placeholder='{"id": 1, "name": "Ada"}' value={input} onChange={(e) => setInput(e.target.value)} />
        </ToolPanel>
        <ToolPanel title="TypeScript output">
          {!result ? (
            <EmptyState icon="code" title="No types yet">
              Paste JSON. Keys missing from some array items become optional, and empty arrays become unknown[].
            </EmptyState>
          ) : result.kind === "parse" ? (
            <ParseError title="Invalid JSON" message={result.message} line={result.line} column={result.column} source={dInput} />
          ) : result.kind === "gen" ? (
            <ParseError title="Cannot generate types" message={result.message} />
          ) : (
            <CodeResult code={result.code} filename="types.ts" label="Generated TypeScript" />
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
