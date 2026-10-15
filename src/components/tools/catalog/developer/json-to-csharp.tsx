"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, EmptyState, PrivacyNote, ResetBtn, SelectField, SplitGrid, TextArea, TextField, ToolPanel } from "@/components/tools/kit";
import { jsonToCSharp, type CSharpOptions, type Json } from "./lib/jsonTypes";
import { CodeResult, ParseError, errorMessage, parseJson } from "./shared";

const SAMPLE = `{
  "order_id": 1042,
  "customer": { "id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301", "fullName": "Ada Lovelace", "email": "ada@example.com" },
  "placedAt": "2026-03-14T09:30:00Z",
  "total": 149.9,
  "paid": true,
  "lines": [
    { "sku": "KB-01", "qty": 1, "price": 99.9 },
    { "sku": "MS-02", "qty": 2, "price": 25, "note": "gift wrap" }
  ],
  "coupon": null
}`;

const DEFAULTS: CSharpOptions = {
  rootName: "Root",
  namespace: "MyApp.Models",
  style: "class",
  nullableRefs: true,
  collection: "List",
  attributes: "when-needed",
  detectFormats: true,
};

export default function Tool() {
  const [input, setInput] = useState("");
  const [o, setO] = useState<CSharpOptions>(DEFAULTS);
  const dInput = useDeferredValue(input);
  const set = <K extends keyof CSharpOptions>(k: K, v: CSharpOptions[K]) => setO((p) => ({ ...p, [k]: v }));

  const result = useMemo(() => {
    if (!dInput.trim()) return null;
    const p = parseJson<Json>(dInput);
    if (!p.ok) return { kind: "parse" as const, msg: p.message, loc: p.line ? { line: p.line, column: p.column } : null };
    try {
      return { kind: "ok" as const, code: jsonToCSharp(p.value, o) };
    } catch (e) {
      return { kind: "gen" as const, msg: errorMessage(e) };
    }
  }, [dInput, o]);

  const nsError = o.namespace && !/^[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)*$/.test(o.namespace) ? "Use dotted identifiers, for example MyApp.Models." : null;

  return (
    <div className="space-y-5">
      <ToolPanel title="Options">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Root type name" value={o.rootName} onChange={(e) => set("rootName", e.target.value)} />
          <TextField label="Namespace" optional value={o.namespace} error={nsError} onChange={(e) => set("namespace", e.target.value)} />
          <SelectField
            label="Type kind"
            value={o.style}
            onChange={(e) => set("style", e.target.value as CSharpOptions["style"])}
            options={[
              { value: "class", label: "class with get; set;" },
              { value: "record", label: "record with get; init;" },
            ]}
          />
          <SelectField
            label="Collection type"
            value={o.collection}
            onChange={(e) => set("collection", e.target.value as CSharpOptions["collection"])}
            options={[
              { value: "List", label: "List<T>" },
              { value: "IReadOnlyList", label: "IReadOnlyList<T>" },
              { value: "array", label: "T[]" },
            ]}
          />
          <SelectField
            label="[JsonPropertyName] attributes"
            value={o.attributes}
            onChange={(e) => set("attributes", e.target.value as CSharpOptions["attributes"])}
            hint="System.Text.Json attributes."
            options={[
              { value: "when-needed", label: "Only when the name differs from camelCase" },
              { value: "always", label: "On every property" },
              { value: "never", label: "Never" },
            ]}
          />
          <div className="space-y-3 pt-1">
            <Checkbox label="Nullable reference types (string?)" checked={o.nullableRefs} onChange={(v) => set("nullableRefs", v)} />
            <Checkbox label="Detect dates and GUIDs" hint="DateTime, DateTimeOffset, DateOnly, Guid" checked={o.detectFormats} onChange={(v) => set("detectFormats", v)} />
          </div>
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
        <ToolPanel title="C# output">
          {!result ? (
            <EmptyState icon="code" title="No classes yet">
              Paste a JSON object or an array of objects. Classes update as you type.
            </EmptyState>
          ) : result.kind === "parse" ? (
            <ParseError title="Invalid JSON" message={result.msg} line={result.loc?.line} column={result.loc?.column} source={dInput} />
          ) : result.kind === "gen" ? (
            <ParseError title="Cannot generate classes" message={result.msg} />
          ) : (
            <CodeResult code={result.code} filename={`${o.rootName || "Root"}.cs`} label="Generated C#" />
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
