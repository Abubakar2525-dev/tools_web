"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Btn,
  CellSelect,
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  Segmented,
  StatGrid,
  TextArea,
  ToolPanel,
  downloadFile,
  fmt,
} from "@/components/tools/kit";
import { FileDrop } from "@/components/tools/engines/files";
import { parseCsv, toCsv } from "./lib/csv";
import {
  COLUMNS,
  FIELD_OPTIONS,
  SAMPLE_VCF,
  TYPED_FIELDS,
  TYPE_OPTIONS,
  contactsToTable,
  detectColumns,
  parseVcards,
  rowToContact,
  serializeContacts,
  type ColumnId,
  type ColumnMapping,
  type Contact,
  type FieldId,
  type MultiMode,
} from "./lib/vcard";

type Direction = "toCsv" | "toVcf";

const PREVIEW_ROWS = 25;
const MAX_MB = 10;

const SAMPLE_CSV = [
  "First Name,Last Name,Organization Name,Organization Title,E-mail 1 - Type,E-mail 1 - Value,Phone 1 - Type,Phone 1 - Value,Phone 2 - Type,Phone 2 - Value,Address 1 - Street,Address 1 - City,Address 1 - Postal Code,Address 1 - Country,Birthday,Notes",
  'Amara,Diallo,"Baobab Freight, Ltd.",Operations manager,Work,amara@baobab.example,Mobile,+221 77 555 0101,Work,+221 33 555 0102,12 Rue Carnot,Dakar,10200,Senegal,1988-07-21,"Prefers WhatsApp; call after 9am"',
  "Tomás,Ibarra,Sierra Labs,CTO,* Work ::: Home,tomas@sierra.example ::: tomas.i@mail.example,Work,+52 55 5555 0199,,,Av. Reforma 222,Ciudad de México,06600,Mexico,,",
].join("\r\n");

const ALL_DEFAULT: ColumnId[] = COLUMNS.filter((c) => c.default).map((c) => c.id);

async function readText(f: File) {
  return f.text();
}

function PreviewTable({ headers, rows, caption }: { headers: string[]; rows: string[][]; caption: string }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-max min-w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-sunken">
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-ink">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className="max-w-[260px] truncate px-3 py-2 text-ink-2" title={c}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* vCard → CSV                                                         */
/* ------------------------------------------------------------------ */

function VcfToCsv() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnId[]>(ALL_DEFAULT);
  const [mode, setMode] = useState<MultiMode>("numbered");
  const [readError, setReadError] = useState<string | null>(null);
  const input = useDeferredValue(text);

  const parsed = useMemo(() => (input.trim() ? parseVcards(input) : null), [input]);
  const table = useMemo(() => (parsed ? contactsToTable(parsed.contacts, columns, mode) : null), [parsed, columns, mode]);
  const csv = useMemo(() => (table && table.rows.length ? toCsv([table.headers, ...table.rows]) : ""), [table]);
  const stats = useMemo(() => {
    const cs: Contact[] = parsed?.contacts ?? [];
    return {
      phones: cs.reduce((n, c) => n + c.phones.length, 0),
      emails: cs.reduce((n, c) => n + c.emails.length, 0),
      versions: parsed ? Object.entries(parsed.versions).map(([v, n]) => `${v} (${n})`).join(", ") : "",
    };
  }, [parsed]);

  const toggle = (id: ColumnId, on: boolean) => setColumns((cur) => (on ? COLUMNS.map((c) => c.id).filter((x) => x === id || cur.includes(x)) : cur.filter((x) => x !== id)));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <FileDrop
          compact
          accept=".vcf,.vcard,text/vcard,text/x-vcard,text/directory"
          maxSizeMB={MAX_MB}
          label="Choose a .vcf file or drop it here"
          onFiles={async (files) => {
            try {
              setText(await readText(files[0]));
              setFileName(files[0].name);
              setReadError(null);
            } catch {
              setReadError("The file could not be read.");
            }
          }}
        />
        {readError && <Notice tone="error">{readError}</Notice>}
        <SampleLoader
          onLoad={() => {
            setText(SAMPLE_VCF);
            setFileName(null);
          }}
          onClear={() => {
            setText("");
            setFileName(null);
          }}
        />
        <TextArea
          label="vCard text"
          mono
          hint={fileName ? `Loaded from ${fileName}. You can edit it here.` : "Or paste one or more cards (BEGIN:VCARD … END:VCARD)."}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFileName(null);
          }}
          rows={12}
        />
        <fieldset>
          <legend className="text-sm font-medium text-ink">Columns to include</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {COLUMNS.map((c) => (
              <Checkbox key={c.id} label={c.label} checked={columns.includes(c.id)} onChange={(v) => toggle(c.id, v)} />
            ))}
          </div>
        </fieldset>
        <div>
          <p className="mb-2 text-sm font-medium text-ink" aria-hidden="true">
            Multiple phones, emails and addresses
          </p>
          <Segmented<MultiMode>
            label="Multiple phones, emails and addresses"
            value={mode}
            onChange={setMode}
            options={[
              { value: "numbered", label: "Numbered columns" },
              { value: "typed", label: "Column per type" },
              { value: "joined", label: "One cell each" },
            ]}
          />
          <p className="mt-2 text-[0.8125rem] text-muted">
            {mode === "numbered"
              ? "Phone 1, Phone 1 type, Phone 2… The most flexible for re-importing."
              : mode === "typed"
                ? "Phone (work), Phone (cell), Email (home)… Easy to read in a spreadsheet."
                : "All phones in one cell separated by semicolons, with the type in brackets."}
          </p>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        {!parsed ? (
          <EmptyState icon="table" title="No cards yet">
            Upload a .vcf file, paste vCard text or load the sample. Versions 2.1, 3.0 and 4.0 are supported.
          </EmptyState>
        ) : parsed.contacts.length === 0 ? (
          <Notice tone="error" title="No contacts found">
            The text doesn&apos;t contain a BEGIN:VCARD line. Check that this is a vCard (.vcf) file.
          </Notice>
        ) : (
          <>
            <StatGrid
              items={[
                { label: "Contacts", value: fmt(parsed.contacts.length, 0) },
                { label: "Phone numbers", value: fmt(stats.phones, 0) },
                { label: "Email addresses", value: fmt(stats.emails, 0) },
              ]}
            />
            <p className="text-sm text-ink-2">vCard versions found: {stats.versions}</p>
            {parsed.warnings.map((w) => (
              <Notice key={w} tone="warning">
                {w}
              </Notice>
            ))}
            {table && table.headers.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Btn icon="download" onClick={() => downloadFile("contacts.csv", `﻿${csv}`, "text/csv")}>
                    Download .csv
                  </Btn>
                  <CopyBtn text={csv} label="Copy CSV" />
                </div>
                <PreviewTable
                  caption={`Preview of ${Math.min(PREVIEW_ROWS, table.rows.length)} of ${table.rows.length} contacts`}
                  headers={table.headers}
                  rows={table.rows.slice(0, PREVIEW_ROWS)}
                />
                {table.rows.length > PREVIEW_ROWS && (
                  <p className="text-[0.8125rem] text-muted">
                    Showing the first {PREVIEW_ROWS} rows. The download includes all {fmt(table.rows.length, 0)}.
                  </p>
                )}
              </>
            ) : (
              <Notice tone="warning">Choose at least one column, or the selected columns are empty for every contact.</Notice>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SampleLoader({ onLoad, onClear }: { onLoad: () => void; onClear: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Btn variant="ghost" icon="file" onClick={onLoad}>
        Load sample
      </Btn>
      <ResetBtn label="Clear" onClick={onClear} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CSV → vCard                                                         */
/* ------------------------------------------------------------------ */

function CsvToVcf() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Partial<ColumnMapping>>>({});
  const [readError, setReadError] = useState<string | null>(null);
  const input = useDeferredValue(text);

  const rows = useMemo(() => (input.trim() ? parseCsv(input) : []), [input]);
  const headers = useMemo(() => (rows[0] ?? []).map((h) => h.trim()), [rows]);
  const detected = useMemo(() => detectColumns(headers), [headers]);
  const keyOf = (i: number) => `${i}:${headers[i]}`;
  const mapping = useMemo<ColumnMapping[]>(
    () => detected.map((m, i) => ({ ...m, ...overrides[`${i}:${headers[i]}`] })),
    [detected, overrides, headers],
  );
  const result = useMemo(() => {
    const contacts: Contact[] = [];
    let skipped = 0;
    for (const r of rows.slice(1)) {
      const c = rowToContact(r, mapping);
      if (c) contacts.push(c);
      else skipped++;
    }
    return { contacts, skipped, vcf: serializeContacts(contacts) };
  }, [rows, mapping]);
  const mappedCount = mapping.filter((m) => m.field !== "ignore").length;

  const setMap = (i: number, patch: Partial<ColumnMapping>) => setOverrides((o) => ({ ...o, [keyOf(i)]: { ...o[keyOf(i)], ...patch } }));

  const sample = (i: number) => rows.slice(1).map((r) => (r[i] ?? "").trim()).find(Boolean) ?? "";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <FileDrop
            compact
            accept=".csv,.txt,text/csv,text/plain"
            maxSizeMB={MAX_MB}
            label="Choose a .csv file or drop it here"
            onFiles={async (files) => {
              try {
                setText(await readText(files[0]));
                setFileName(files[0].name);
                setOverrides({});
                setReadError(null);
              } catch {
                setReadError("The file could not be read.");
              }
            }}
          />
          {readError && <Notice tone="error">{readError}</Notice>}
          <TextArea
            label="CSV text"
            mono
            hint={fileName ? `Loaded from ${fileName}.` : "The first row must contain column names. Comma, semicolon and tab delimiters are detected."}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFileName(null);
            }}
            rows={10}
          />
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="ghost"
              icon="file"
              onClick={() => {
                setText(SAMPLE_CSV);
                setFileName(null);
                setOverrides({});
              }}
            >
              Load sample
            </Btn>
            <ResetBtn
              label="Clear"
              onClick={() => {
                setText("");
                setFileName(null);
                setOverrides({});
              }}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {rows.length < 2 ? (
            <EmptyState icon="table" title="No rows yet">
              Paste or upload a CSV with a header row and at least one contact. Google and Outlook exports are recognized.
            </EmptyState>
          ) : (
            <>
              <StatGrid
                items={[
                  { label: "Rows", value: fmt(rows.length - 1, 0) },
                  { label: "vCards created", value: fmt(result.contacts.length, 0) },
                  { label: "Mapped columns", value: `${mappedCount} of ${headers.length}` },
                ]}
              />
              {result.skipped > 0 && (
                <Notice tone="warning">
                  {result.skipped === 1 ? "1 row was" : `${fmt(result.skipped, 0)} rows were`} skipped because no name, company, email or phone
                  was mapped for it.
                </Notice>
              )}
              {mappedCount === 0 && <Notice tone="warning">No column is mapped yet. Choose a field for each column below.</Notice>}
              <div className="flex flex-wrap gap-2">
                <Btn
                  icon="download"
                  disabled={!result.contacts.length}
                  onClick={() => downloadFile(result.contacts.length === 1 ? "contact.vcf" : "contacts.vcf", result.vcf, "text/vcard")}
                >
                  Download .vcf
                </Btn>
                <CopyBtn text={result.vcf} label="Copy vCard" />
              </div>
              <OutputBlock label="vCard 3.0 output">
                <code>{result.vcf.length > 60000 ? `${result.vcf.slice(0, 60000)}\n… (preview truncated, the download is complete)` : result.vcf}</code>
              </OutputBlock>
            </>
          )}
        </div>
      </div>

      {rows.length >= 1 && headers.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-ink">Column mapping</h3>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Detected automatically from the header names. Columns with the same number or type (for example Phone 1 and Phone 1 type)
            are combined into one entry.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg shadow-[0_0_0_1px_var(--line)]" role="region" aria-label="Column mapping" tabIndex={0}>
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-sunken">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium text-ink">
                    CSV column
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium text-ink">
                    First value
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium text-ink">
                    vCard field
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium text-ink">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, i) => {
                  const m = mapping[i];
                  return (
                    <tr key={keyOf(i)} className="border-t border-line">
                      <th scope="row" className="max-w-[200px] truncate px-3 py-2 font-normal text-ink" title={h}>
                        {h || `Column ${i + 1}`}
                      </th>
                      <td className="max-w-[200px] truncate px-3 py-2 text-ink-2" title={sample(i)}>
                        {sample(i)}
                      </td>
                      <td className="px-3 py-2">
                        <CellSelect
                          label={`vCard field for ${h || `column ${i + 1}`}`}
                          value={m.field}
                          onChange={(e) => setMap(i, { field: e.target.value as FieldId })}
                          options={FIELD_OPTIONS}
                          className="min-w-[180px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {TYPED_FIELDS.includes(m.field) ? (
                          <CellSelect
                            label={`Type for ${h || `column ${i + 1}`}`}
                            value={TYPE_OPTIONS.some((t) => t.value === m.type) ? m.type : ""}
                            onChange={(e) => setMap(i, { type: e.target.value })}
                            options={TYPE_OPTIONS}
                            className="min-w-[130px]"
                          />
                        ) : (
                          <span className="text-muted">Not used</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [dir, setDir] = useState<Direction>("toCsv");
  return (
    <div className="space-y-5">
      <ToolPanel
        title="vCard and CSV converter"
        actions={
          <Segmented<Direction>
            label="Conversion direction"
            value={dir}
            onChange={setDir}
            options={[
              { value: "toCsv", label: "vCard to CSV" },
              { value: "toVcf", label: "CSV to vCard" },
            ]}
          />
        }
      >
        {dir === "toCsv" ? <VcfToCsv /> : <CsvToVcf />}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
