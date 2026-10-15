"use client";

import { useState } from "react";
import type { Faker } from "@faker-js/faker";
import { Btn, CellInput, CellSelect, CopyBtn, EmptyState, Notice, NumberField, OutputBlock, PrivacyNote, ResetBtn, Segmented, SelectField, TextField, ToolPanel, downloadFile, parseNum, uid, usePersistentState } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { FIELD_TYPES, LOCALES, generateRows, type FieldSpec } from "./lib/mockFields";
import { DIALECTS, jsonToSql, type Dialect } from "./lib/sql";
import { errorMessage, useRunGuard } from "./shared";

type Format = "json" | "csv" | "sql";
const MAX_ROWS = 10000;
const PREVIEW_CHARS = 60000;

const LOADERS: Record<string, () => Promise<{ faker: Faker }>> = {
  en: () => import("@faker-js/faker/locale/en"),
  en_GB: () => import("@faker-js/faker/locale/en_GB"),
  de: () => import("@faker-js/faker/locale/de"),
  fr: () => import("@faker-js/faker/locale/fr"),
  es: () => import("@faker-js/faker/locale/es"),
  it: () => import("@faker-js/faker/locale/it"),
  pt_BR: () => import("@faker-js/faker/locale/pt_BR"),
  nl: () => import("@faker-js/faker/locale/nl"),
  pl: () => import("@faker-js/faker/locale/pl"),
  ja: () => import("@faker-js/faker/locale/ja"),
  zh_CN: () => import("@faker-js/faker/locale/zh_CN"),
};

const DEFAULT_FIELDS: FieldSpec[] = [
  { id: "f1", name: "id", type: "seq", nullPct: 0 },
  { id: "f2", name: "name", type: "fullName", nullPct: 0 },
  { id: "f3", name: "email", type: "email", nullPct: 0 },
  { id: "f4", name: "city", type: "city", nullPct: 0 },
  { id: "f5", name: "signed_up", type: "pastDate", nullPct: 0 },
  { id: "f6", name: "plan", type: "status", nullPct: 0 },
];

const TYPE_OPTIONS = FIELD_TYPES.map((t) => ({ value: t.id, label: `${t.group}: ${t.label}` }));

export default function Tool() {
  const [fields, setFields] = usePersistentState<FieldSpec[]>("mock-data-generator", DEFAULT_FIELDS);
  const [count, setCount] = useState("25");
  const [locale, setLocale] = useState("en");
  const [seed, setSeed] = useState("");
  const [format, setFormat] = useState<Format>("json");
  const [dialect, setDialect] = useState<Dialect>("postgres");
  const [table, setTable] = useState("mock_data");
  const [out, setOut] = useState<{ text: string; rows: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const guard = useRunGuard();

  const n = parseNum(count);
  const countErr = n === null || !Number.isInteger(n) || n < 1 || n > MAX_ROWS ? `Enter a whole number from 1 to ${MAX_ROWS.toLocaleString()}.` : null;
  const seedNum = seed.trim() ? parseNum(seed) : null;
  const seedErr = seed.trim() && (seedNum === null || !Number.isInteger(seedNum)) ? "Use a whole number, or leave empty for random data." : null;
  const names = fields.map((f) => f.name.trim());
  const fieldErr = (f: FieldSpec, i: number) => (!f.name.trim() ? "Name required" : names.indexOf(f.name.trim()) !== i ? "Duplicate name" : null);
  const anyFieldErr = fields.some((f, i) => fieldErr(f, i));

  const update = (id: string, patch: Partial<FieldSpec>) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const copy = [...fs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const generate = async () => {
    if (countErr || seedErr || anyFieldErr || n === null || fields.length === 0) return;
    const t = guard.start();
    setBusy(true);
    setError(null);
    try {
      const { faker } = await (LOADERS[locale] ?? LOADERS.en)();
      if (!guard.isCurrent(t)) return;
      if (seedNum !== null) {
        faker.seed(seedNum);
        faker.setDefaultRefDate("2026-01-01T00:00:00Z");
      } else {
        faker.seed();
        faker.setDefaultRefDate();
      }
      const rows = generateRows(faker, fields, n);
      let text: string;
      if (format === "json") text = JSON.stringify(rows, null, 2);
      else if (format === "csv") {
        const Papa = (await import("papaparse")).default;
        text = Papa.unparse({ fields: names, data: rows.map((r) => names.map((k) => r[k] ?? "")) }, { newline: "\r\n" });
      } else {
        text = jsonToSql(rows, { dialect, table: table.trim() || "mock_data", createTable: true, dropIfExists: false, batchSize: 500, nested: "json", detectDates: true, primaryKey: true }).sql;
      }
      if (guard.isCurrent(t)) setOut({ text, rows: rows.length });
    } catch (e) {
      if (guard.isCurrent(t)) setError(errorMessage(e));
    } finally {
      if (guard.isCurrent(t)) setBusy(false);
    }
  };

  const ext = format === "json" ? "json" : format === "csv" ? "csv" : "sql";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Fields"
        actions={
          <>
            <Btn variant="ghost" icon="plus" onClick={() => setFields((fs) => [...fs, { id: uid(), name: `field_${fs.length + 1}`, type: "word", nullPct: 0 }])}>
              Add field
            </Btn>
            <ResetBtn onClick={() => setFields(DEFAULT_FIELDS)} label="Default fields" />
          </>
        }
      >
        {fields.length === 0 ? (
          <EmptyState icon="list" title="No fields">
            Add at least one field.
          </EmptyState>
        ) : (
          <ol className="space-y-3">
            {fields.map((f, i) => {
              const err = fieldErr(f, i);
              return (
                <li key={f.id} className="grid gap-2 rounded-lg bg-sunken p-3 sm:grid-cols-[1fr_1.4fr_7rem_auto] sm:items-start">
                  <div>
                    <CellInput label={`Field ${i + 1} name`} value={f.name} invalid={!!err} onChange={(e) => update(f.id, { name: e.target.value })} />
                    {err && <p className="mt-1 text-[0.8125rem] text-danger">{err}</p>}
                  </div>
                  <CellSelect label={`Field ${i + 1} type`} value={f.type} onChange={(e) => update(f.id, { type: e.target.value })} options={TYPE_OPTIONS} />
                  <CellSelect
                    label={`Field ${i + 1} empty values`}
                    value={String(f.nullPct)}
                    onChange={(e) => update(f.id, { nullPct: Number(e.target.value) })}
                    options={[
                      { value: "0", label: "No nulls" },
                      { value: "10", label: "10% null" },
                      { value: "25", label: "25% null" },
                      { value: "50", label: "50% null" },
                    ]}
                  />
                  <div className="flex gap-1">
                    <Btn variant="subtle" aria-label={`Move field ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className="!px-2.5">
                      ↑
                    </Btn>
                    <Btn variant="subtle" aria-label={`Move field ${i + 1} down`} disabled={i === fields.length - 1} onClick={() => move(i, 1)} className="!px-2.5">
                      ↓
                    </Btn>
                    <Btn variant="danger" icon="trash" aria-label={`Remove field ${i + 1}`} onClick={() => setFields((fs) => fs.filter((x) => x.id !== f.id))} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </ToolPanel>

      <ToolPanel title="Output">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="Rows" value={count} error={countErr} hint={`Up to ${MAX_ROWS.toLocaleString()}.`} onChange={(e) => setCount(e.target.value)} />
            <SelectField label="Locale" value={locale} onChange={(e) => setLocale(e.target.value)} options={LOCALES} />
            <NumberField label="Seed" optional value={seed} error={seedErr} hint="Same seed, same data." onChange={(e) => setSeed(e.target.value)} />
            <div className="pt-7">
              <Segmented
                label="Format"
                value={format}
                onChange={setFormat}
                options={[
                  { value: "json", label: "JSON" },
                  { value: "csv", label: "CSV" },
                  { value: "sql", label: "SQL" },
                ]}
              />
            </div>
          </div>
          {format === "sql" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="SQL dialect" value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)} options={DIALECTS} />
              <TextField label="Table name" value={table} onChange={(e) => setTable(e.target.value)} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Btn icon="spark" onClick={() => void generate()} disabled={busy || !!countErr || !!seedErr || anyFieldErr || fields.length === 0}>
              Generate data
            </Btn>
            {busy && <Spinner label="Generating" />}
            {out && (
              <>
                <CopyBtn text={out.text} />
                <Btn variant="ghost" icon="download" onClick={() => downloadFile(`mock-data.${ext}`, out.text, format === "json" ? "application/json" : format === "csv" ? "text/csv" : "application/sql")}>
                  Download .{ext}
                </Btn>
              </>
            )}
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {out ? (
            <>
              <p className="text-sm text-ink-2">
                {out.rows.toLocaleString()} rows generated{seedNum !== null ? ` with seed ${seedNum} (dates are relative to 1 January 2026 so the output repeats exactly)` : ""}.
              </p>
              <OutputBlock label="Generated data">
                <code>{out.text.length > PREVIEW_CHARS ? `${out.text.slice(0, PREVIEW_CHARS)}\n… preview truncated. Copy or download for the full output.` : out.text}</code>
              </OutputBlock>
            </>
          ) : (
            <EmptyState icon="table" title="No data yet">
              Define fields, choose a format and press Generate data. All values are fictional.
            </EmptyState>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}
