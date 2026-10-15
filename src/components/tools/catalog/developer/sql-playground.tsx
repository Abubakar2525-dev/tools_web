"use client";

import { useEffect, useRef, useState } from "react";
import type { Database, SqlJsStatic } from "sql.js";
import { Btn, EmptyState, Notice, PrivacyNote, TextArea, ToolPanel, downloadFile } from "@/components/tools/kit";
import { FileDrop, Spinner, downloadBlob } from "@/components/tools/engines/files";
import { VENDOR } from "@/components/tools/engines/pdf";
import { EXAMPLE_QUERIES, SAMPLE_DB_SQL } from "./lib/sampleDb";
import { errorMessage } from "./shared";

type Cell = number | string | Uint8Array | null;
interface ResultSet {
  columns: string[];
  values: Cell[][];
}
interface TableInfo {
  name: string;
  columns: { name: string; type: string; pk: boolean }[];
  rows: number;
}
type RunOut = { kind: "ok"; sets: ResultSet[]; changes: number; ms: number } | { kind: "error"; message: string };

const MAX_ROWS_SHOWN = 1000;
let sqlPromise: Promise<SqlJsStatic> | null = null;

function loadSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = import("sql.js")
      .then((m) => m.default({ locateFile: () => VENDOR.sqlWasm }))
      .catch((e: unknown) => {
        sqlPromise = null;
        throw e;
      });
  }
  return sqlPromise;
}

function readSchema(db: Database): TableInfo[] {
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  if (!tables.length) return [];
  return tables[0].values.map(([n]) => {
    const name = String(n);
    const q = name.replace(/"/g, '""');
    const cols = db.exec(`PRAGMA table_info("${q}")`);
    const count = db.exec(`SELECT COUNT(*) FROM "${q}"`);
    return {
      name,
      columns: cols.length ? cols[0].values.map((r) => ({ name: String(r[1]), type: String(r[2] || ""), pk: Number(r[5]) > 0 })) : [],
      rows: count.length ? Number(count[0].values[0][0]) : 0,
    };
  });
}

function totalChanges(db: Database): number {
  const r = db.exec("SELECT total_changes()");
  return r.length ? Number(r[0].values[0][0]) : 0;
}

const cellText = (c: Cell) => (c === null ? "NULL" : c instanceof Uint8Array ? `<blob ${c.length} bytes>` : String(c));

function csvOf(set: ResultSet) {
  const esc = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [set.columns.map(esc).join(","), ...set.values.map((r) => r.map((c) => (c === null ? "" : esc(cellText(c)))).join(","))].join("\r\n");
}

export default function Tool() {
  const dbRef = useRef<Database | null>(null);
  const sqlRef = useRef<SqlJsStatic | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dbLabel, setDbLabel] = useState("Sample bookshop database");
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [query, setQuery] = useState(EXAMPLE_QUERIES[1].sql);
  const [out, setOut] = useState<RunOut | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadSql()
      .then((SQL) => {
        if (!alive) return;
        sqlRef.current = SQL;
        const db = new SQL.Database();
        db.run(SAMPLE_DB_SQL);
        dbRef.current = db;
        setSchema(readSchema(db));
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoadError(errorMessage(e));
        setStatus("error");
      });
    return () => {
      alive = false;
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, []);

  const replaceDb = (db: Database, label: string) => {
    dbRef.current?.close();
    dbRef.current = db;
    setDbLabel(label);
    setSchema(readSchema(db));
    setOut(null);
  };

  const run = (sql = query) => {
    const db = dbRef.current;
    if (!db || !sql.trim()) return;
    const before = totalChanges(db);
    const t0 = performance.now();
    try {
      const sets = db.exec(sql) as ResultSet[];
      const ms = performance.now() - t0;
      setOut({ kind: "ok", sets, changes: totalChanges(db) - before, ms });
    } catch (e) {
      setOut({ kind: "error", message: errorMessage(e) });
    }
    setSchema(readSchema(db));
  };

  const resetSample = () => {
    const SQL = sqlRef.current;
    if (!SQL) return;
    const db = new SQL.Database();
    db.run(SAMPLE_DB_SQL);
    replaceDb(db, "Sample bookshop database");
  };

  const importFile = async (f: File) => {
    const SQL = sqlRef.current;
    if (!SQL) return;
    setImportErr(null);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const magic = new TextDecoder().decode(bytes.slice(0, 15));
    if (magic !== "SQLite format 3") {
      setImportErr("That file is not an SQLite 3 database (the header is missing).");
      return;
    }
    try {
      const db = new SQL.Database(bytes);
      db.exec("SELECT name FROM sqlite_master LIMIT 1");
      replaceDb(db, f.name);
    } catch (e) {
      setImportErr(`Could not open the database: ${errorMessage(e)}`);
    }
  };

  if (status === "loading") {
    return (
      <div className="card grid min-h-[300px] place-items-center p-8">
        <Spinner label="Starting SQLite in your browser" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <Notice tone="error" title="SQLite could not start">
        {loadError} Reload the page to try again.
      </Notice>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
        <ToolPanel title="Database">
          <div className="space-y-4">
            <p className="text-sm text-ink-2">
              <span className="font-medium text-ink">{dbLabel}</span>
            </p>
            {schema.length === 0 ? (
              <p className="text-sm text-muted">No tables yet. Create one with CREATE TABLE.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {schema.map((t) => (
                  <li key={t.name}>
                    <button type="button" className="min-h-10 w-full rounded-md px-2 py-1 text-left font-mono font-medium text-ink hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent" onClick={() => setQuery(`SELECT * FROM "${t.name.replace(/"/g, '""')}" LIMIT 100;`)}>
                      {t.name} <span className="font-sans font-normal text-muted">({t.rows.toLocaleString()} rows)</span>
                    </button>
                    <ul className="ml-2 mt-1 space-y-0.5 border-l border-line pl-3 text-[0.8125rem] text-ink-2">
                      {t.columns.map((c) => (
                        <li key={c.name} className="font-mono">
                          {c.name} <span className="text-muted">{c.type}{c.pk ? " PK" : ""}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Btn variant="ghost" icon="download" onClick={() => dbRef.current && downloadBlob(new Blob([dbRef.current.export() as BlobPart], { type: "application/vnd.sqlite3" }), "database.sqlite")}>
                Export .sqlite
              </Btn>
              <Btn variant="subtle" icon="reset" onClick={resetSample}>
                Reload sample
              </Btn>
            </div>
            <FileDrop compact accept=".sqlite,.sqlite3,.db,application/vnd.sqlite3,application/x-sqlite3" maxSizeMB={100} label="Open an .sqlite file" hint="Up to 100 MB, opened in memory." onFiles={(fs) => void importFile(fs[0])} />
            {importErr && <Notice tone="error">{importErr}</Notice>}
          </div>
        </ToolPanel>

        <ToolPanel title="Query">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((q) => (
                <Btn key={q.label} variant="ghost" onClick={() => setQuery(q.sql)}>
                  {q.label}
                </Btn>
              ))}
            </div>
            <TextArea
              label="SQL"
              mono
              rows={10}
              value={query}
              hint="Run with Ctrl or Cmd + Enter. Separate several statements with semicolons."
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  run();
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Btn icon="play" onClick={() => run()}>
                Run
              </Btn>
            </div>
            {!out ? (
              <EmptyState icon="table" title="No results yet">
                Write a query or pick an example, then press Run.
              </EmptyState>
            ) : out.kind === "error" ? (
              <Notice tone="error" title="SQL error">
                {out.message}
              </Notice>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-ink-2" role="status">
                  Done in {out.ms < 1 ? "<1" : Math.round(out.ms)} ms. {out.sets.length} result set{out.sets.length === 1 ? "" : "s"}
                  {out.changes > 0 ? `, ${out.changes} row${out.changes === 1 ? "" : "s"} changed` : ""}.
                </p>
                {out.sets.map((set, si) => (
                  <div key={si} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink">
                        Result {si + 1}: {set.values.length.toLocaleString()} row{set.values.length === 1 ? "" : "s"}
                      </p>
                      <Btn variant="ghost" icon="download" onClick={() => downloadFile(`result-${si + 1}.csv`, csvOf(set), "text/csv")}>
                        CSV
                      </Btn>
                    </div>
                    <div className="max-h-[420px] overflow-auto rounded-lg shadow-[inset_0_0_0_1px_var(--line)]" tabIndex={0} aria-label={`Result ${si + 1}`}>
                      <table className="w-full text-left text-[0.875rem]">
                        <thead className="sticky top-0 bg-sunken">
                          <tr>
                            {set.columns.map((c, ci) => (
                              <th key={ci} scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-ink">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {set.values.slice(0, MAX_ROWS_SHOWN).map((r, ri) => (
                            <tr key={ri} className="border-t border-line">
                              {r.map((c, ci) => (
                                <td key={ci} className={`max-w-[320px] truncate px-3 py-1.5 ${c === null ? "italic text-muted" : typeof c === "number" ? "text-right tabular-nums" : ""}`}>
                                  {cellText(c)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {set.values.length > MAX_ROWS_SHOWN && <p className="text-[0.8125rem] text-muted">Showing the first {MAX_ROWS_SHOWN.toLocaleString()} rows. The CSV contains all of them.</p>}
                  </div>
                ))}
                {out.sets.length === 0 && <p className="text-sm text-ink-2">The statements ran without returning rows.</p>}
              </div>
            )}
          </div>
        </ToolPanel>
      </div>
      <p className="text-[0.8125rem] text-muted">The database lives in this tab&apos;s memory. Export it as .sqlite to keep your changes; reloading the page restores the sample.</p>
      <PrivacyNote />
    </div>
  );
}
