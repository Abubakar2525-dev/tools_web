"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, EmptyState, NumberField, PrivacyNote, ResetBtn, Segmented, SelectField, SplitGrid, StatGrid, TextArea, TextField, ToolPanel, parseNum } from "@/components/tools/kit";
import { DIALECTS, jsonToSql, sqlType, type Dialect, type SqlOptions } from "./lib/sql";
import { CodeResult, ParseError, errorMessage, parseJson } from "./shared";

const SAMPLE = `[
  { "id": 1, "name": "Ada O'Neil", "email": "ada@example.com", "active": true, "balance": 120.5, "signup": "2026-02-01T10:15:00Z", "prefs": { "theme": "dark" } },
  { "id": 2, "name": "Lin Chen", "email": "lin@example.com", "active": false, "balance": 0, "signup": "2026-03-09T08:00:00Z", "prefs": { "theme": "light", "beta": true } },
  { "id": 3, "name": "Sam Ruiz", "email": null, "active": true, "balance": 42, "signup": "2026-04-22T17:45:00Z", "prefs": {} }
]`;

const DEFAULTS = {
  dialect: "postgres" as Dialect,
  table: "users",
  createTable: true,
  dropIfExists: false,
  batch: "100",
  nested: "json" as SqlOptions["nested"],
  detectDates: true,
  primaryKey: true,
};

export default function Tool() {
  const [input, setInput] = useState("");
  const [s, setS] = useState(DEFAULTS);
  const dInput = useDeferredValue(input);
  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) => setS((p) => ({ ...p, [k]: v }));
  const batchNum = parseNum(s.batch);
  const batchErr = batchNum === null || batchNum < 1 || !Number.isInteger(batchNum) ? "Enter a whole number of 1 or more." : null;
  const tableErr = s.table.trim() ? null : "Enter a table name.";

  const result = useMemo(() => {
    if (!dInput.trim()) return null;
    const p = parseJson(dInput);
    if (!p.ok) return { kind: "parse" as const, ...p };
    try {
      const r = jsonToSql(p.value as Parameters<typeof jsonToSql>[0], {
        dialect: s.dialect,
        table: s.table,
        createTable: s.createTable,
        dropIfExists: s.dropIfExists,
        batchSize: batchNum ?? 100,
        nested: s.nested,
        detectDates: s.detectDates,
        primaryKey: s.primaryKey,
      });
      return { kind: "ok" as const, ...r };
    } catch (e) {
      return { kind: "gen" as const, message: errorMessage(e) };
    }
  }, [dInput, s, batchNum]);

  return (
    <div className="space-y-5">
      <ToolPanel title="Options">
        <div className="space-y-5">
          <Segmented label="SQL dialect" value={s.dialect} onChange={(v) => set("dialect", v)} options={DIALECTS} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField label="Table name" value={s.table} error={tableErr} onChange={(e) => set("table", e.target.value)} />
            <NumberField label="Rows per INSERT" hint={s.dialect === "mssql" ? "SQL Server allows at most 1,000." : "Batches keep statements a manageable size."} value={s.batch} error={batchErr} onChange={(e) => set("batch", e.target.value)} />
            <SelectField
              label="Nested objects"
              value={s.nested}
              onChange={(e) => set("nested", e.target.value as SqlOptions["nested"])}
              options={[
                { value: "json", label: "Store as a JSON column" },
                { value: "flatten", label: "Flatten into parent_child columns" },
              ]}
            />
            <Checkbox label="Include CREATE TABLE" checked={s.createTable} onChange={(v) => set("createTable", v)} />
            <Checkbox label="Add DROP TABLE IF EXISTS" checked={s.dropIfExists} onChange={(v) => set("dropIfExists", v)} />
            <Checkbox label="Detect dates and timestamps" checked={s.detectDates} onChange={(v) => set("detectDates", v)} />
            <Checkbox label="Make a unique id column the primary key" checked={s.primaryKey} onChange={(v) => set("primaryKey", v)} />
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
                  setS(DEFAULTS);
                }}
              />
            </>
          }
        >
          <TextArea label="JSON array of objects" mono rows={18} placeholder='[{"id": 1, "name": "Ada"}]' value={input} onChange={(e) => setInput(e.target.value)} />
        </ToolPanel>
        <ToolPanel title="SQL output">
          {!result ? (
            <EmptyState icon="table" title="No SQL yet">
              Paste an array of objects. Each object becomes a row and each key a column.
            </EmptyState>
          ) : result.kind === "parse" ? (
            <ParseError title="Invalid JSON" message={result.message} line={result.line} column={result.column} source={dInput} />
          ) : result.kind === "gen" ? (
            <ParseError title="Cannot build SQL" message={result.message} />
          ) : (
            <div className="space-y-4">
              <StatGrid
                items={[
                  { label: "Rows", value: result.rows.toLocaleString() },
                  { label: "Columns", value: result.columns.length },
                  { label: "Statements", value: (result.sql.match(/^(INSERT|CREATE|DROP) /gm) ?? []).length },
                ]}
              />
              <details className="rounded-lg bg-sunken px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium text-ink">Inferred column types</summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-[0.85rem]">
                    <thead>
                      <tr className="text-muted">
                        <th className="py-1 pr-4 font-medium">Column</th>
                        <th className="py-1 pr-4 font-medium">Type</th>
                        <th className="py-1 font-medium">Nulls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.columns.map((c) => (
                        <tr key={c.name} className="border-t border-line">
                          <td className="py-1 pr-4 font-mono">{c.name}</td>
                          <td className="py-1 pr-4 font-mono">{sqlType(c, s.dialect)}</td>
                          <td className="py-1">{c.nullable ? "allowed" : "none seen"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <CodeResult code={result.sql} filename={`${s.table.trim() || "data"}.sql`} mime="application/sql" label="Generated SQL" />
            </div>
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
