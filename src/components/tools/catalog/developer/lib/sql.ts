/**
 * SQL generation helpers: identifier/string quoting per dialect, column type
 * inference from JSON rows, CREATE TABLE and batched INSERT statements.
 */

export type Dialect = "postgres" | "mysql" | "sqlite" | "mssql";

export const DIALECTS: { value: Dialect; label: string }[] = [
  { value: "postgres", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "mssql", label: "SQL Server" },
];

export function quoteIdent(name: string, d: Dialect): string {
  if (d === "mysql") return "`" + name.replace(/`/g, "``") + "`";
  if (d === "mssql") return "[" + name.replace(/]/g, "]]") + "]";
  return '"' + name.replace(/"/g, '""') + '"';
}

/** String literal. MySQL treats backslash as an escape by default, so it is doubled there. */
export function quoteString(s: string, d: Dialect): string {
  if (d === "mysql") {
    return (
      "'" +
      s
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "''")
        .replace(/\0/g, "\\0")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\x1a/g, "\\Z") +
      "'"
    );
  }
  const body = s.replace(/'/g, "''");
  return d === "mssql" ? `N'${body}'` : `'${body}'`;
}

export function boolLiteral(b: boolean, d: Dialect) {
  if (d === "postgres" || d === "mysql") return b ? "TRUE" : "FALSE";
  return b ? "1" : "0";
}

/* ------------------------------------------------------------------ */
/* Inference                                                           */
/* ------------------------------------------------------------------ */

type JsonV = null | boolean | number | string | JsonV[] | { [k: string]: JsonV };

export type ColKind = "bool" | "int" | "bigint" | "float" | "date" | "datetime" | "datetimetz" | "text" | "json" | "null";

export interface Column {
  name: string;
  kind: ColKind;
  maxLen: number;
  nullable: boolean;
  unique: boolean;
}

const RE_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const RE_DT = /^(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))[T ]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,9})?)?(Z|[+-]([01]\d|2[0-3]):?[0-5]\d)?$/i;

function valueKind(v: JsonV, detectDates: boolean): ColKind {
  if (v === null) return "null";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") {
    if (!Number.isInteger(v)) return "float";
    return v > 2147483647 || v < -2147483648 ? "bigint" : "int";
  }
  if (typeof v === "string") {
    if (detectDates) {
      if (RE_DATE.test(v)) return "date";
      const m = RE_DT.exec(v);
      if (m && !Number.isNaN(Date.parse(v))) return m[7] ? "datetimetz" : "datetime";
    }
    return "text";
  }
  return "json";
}

function mergeKind(a: ColKind, b: ColKind): ColKind {
  if (a === b) return a;
  if (a === "null") return b;
  if (b === "null") return a;
  const num: ColKind[] = ["int", "bigint", "float"];
  if (num.includes(a) && num.includes(b)) return a === "float" || b === "float" ? "float" : "bigint";
  const dt: ColKind[] = ["datetime", "datetimetz"];
  if (dt.includes(a) && dt.includes(b)) return "datetimetz";
  if (a === "json" || b === "json") return "json";
  return "text";
}

/** Flattens nested objects into `parent_child` keys. Arrays stay as values. */
export function flattenRow(obj: { [k: string]: JsonV }, sep = "_", prefix = "", out: { [k: string]: JsonV } = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}${sep}${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0) flattenRow(v, sep, key, out);
    else out[key] = v;
  }
  return out;
}

export function inferColumns(rows: { [k: string]: JsonV }[], detectDates: boolean): Column[] {
  const cols = new Map<string, Column & { seen: Set<string>; present: number }>();
  rows.forEach((r) => {
    for (const [k, v] of Object.entries(r)) {
      let c = cols.get(k);
      if (!c) {
        c = { name: k, kind: "null", maxLen: 0, nullable: false, unique: true, seen: new Set(), present: 0 };
        cols.set(k, c);
      }
      c.present++;
      const kind = valueKind(v, detectDates);
      c.kind = mergeKind(c.kind, kind);
      if (v === null) c.nullable = true;
      const s = typeof v === "string" ? v : v !== null && typeof v === "object" ? JSON.stringify(v) : String(v);
      c.maxLen = Math.max(c.maxLen, s.length);
      if (c.unique) {
        if (v === null || c.seen.has(s)) c.unique = false;
        else c.seen.add(s);
      }
    }
  });
  return [...cols.values()].map((c) => ({
    name: c.name,
    kind: c.kind,
    maxLen: c.maxLen,
    nullable: c.nullable || c.present < rows.length,
    unique: c.unique && c.present === rows.length,
  }));
}

export function sqlType(c: Column, d: Dialect): string {
  const longText = c.maxLen > 255;
  switch (c.kind) {
    case "bool":
      return { postgres: "BOOLEAN", mysql: "BOOLEAN", sqlite: "INTEGER", mssql: "BIT" }[d];
    case "int":
      return { postgres: "INTEGER", mysql: "INT", sqlite: "INTEGER", mssql: "INT" }[d];
    case "bigint":
      return { postgres: "BIGINT", mysql: "BIGINT", sqlite: "INTEGER", mssql: "BIGINT" }[d];
    case "float":
      return { postgres: "DOUBLE PRECISION", mysql: "DOUBLE", sqlite: "REAL", mssql: "FLOAT" }[d];
    case "date":
      return { postgres: "DATE", mysql: "DATE", sqlite: "TEXT", mssql: "DATE" }[d];
    case "datetime":
      return { postgres: "TIMESTAMP", mysql: "DATETIME(3)", sqlite: "TEXT", mssql: "DATETIME2" }[d];
    case "datetimetz":
      return { postgres: "TIMESTAMPTZ", mysql: "DATETIME(3)", sqlite: "TEXT", mssql: "DATETIMEOFFSET" }[d];
    case "json":
      return { postgres: "JSONB", mysql: "JSON", sqlite: "TEXT", mssql: "NVARCHAR(MAX)" }[d];
    case "null":
    case "text":
    default:
      if (d === "mysql") return longText ? "TEXT" : "VARCHAR(255)";
      if (d === "mssql") return longText ? "NVARCHAR(MAX)" : "NVARCHAR(255)";
      return "TEXT";
  }
}

/** MySQL DATETIME does not accept ISO 'T'/'Z' strings in strict mode: convert to UTC 'YYYY-MM-DD HH:MM:SS.fff'. */
function mysqlDateTime(s: string): string {
  const hasZone = /(Z|[+-]\d\d:?\d\d)$/i.test(s);
  if (!hasZone) return s.replace("T", " ").replace(/(\.\d{3})\d+$/, "$1");
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return s;
  return t.toISOString().replace("T", " ").replace("Z", "");
}

export function sqlValue(v: JsonV, c: Column, d: Dialect): string {
  if (v === null || v === undefined) return "NULL";
  if (c.kind === "json") return quoteString(JSON.stringify(v), d);
  if (c.kind === "text" || c.kind === "null") {
    return quoteString(typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v), d);
  }
  if (typeof v === "boolean") return boolLiteral(v, d);
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (d === "mysql" && (c.kind === "datetime" || c.kind === "datetimetz")) return quoteString(mysqlDateTime(v), d);
    return quoteString(v, d);
  }
  return quoteString(JSON.stringify(v), d);
}

export interface SqlOptions {
  dialect: Dialect;
  table: string;
  createTable: boolean;
  dropIfExists: boolean;
  batchSize: number;
  nested: "json" | "flatten";
  detectDates: boolean;
  primaryKey: boolean;
}

export function jsonToSql(input: JsonV, o: SqlOptions): { sql: string; columns: Column[]; rows: number } {
  let rows: { [k: string]: JsonV }[];
  if (Array.isArray(input)) {
    if (input.length === 0) throw new Error("The array is empty, so there are no rows to insert.");
    const bad = input.findIndex((r) => r === null || typeof r !== "object" || Array.isArray(r));
    if (bad >= 0) throw new Error(`Item ${bad + 1} is not an object. Use an array of objects, one per row.`);
    rows = input as { [k: string]: JsonV }[];
  } else if (input !== null && typeof input === "object") {
    rows = [input];
  } else {
    throw new Error("Use a JSON object or an array of objects.");
  }
  if (o.nested === "flatten") rows = rows.map((r) => flattenRow(r));
  const columns = inferColumns(rows, o.detectDates);
  if (columns.length === 0) throw new Error("The objects have no keys, so there are no columns.");
  const d = o.dialect;
  const table = quoteIdent(o.table.trim() || "data", d);
  const out: string[] = [];

  if (o.createTable) {
    if (o.dropIfExists) out.push(`DROP TABLE IF EXISTS ${table};`);
    const pk = o.primaryKey
      ? columns.find((c) => c.name.toLowerCase() === "id" && c.unique && (c.kind === "int" || c.kind === "bigint" || c.kind === "text"))
      : undefined;
    const defs = columns.map((c) => {
      let t = sqlType(c, d);
      if (pk === c && d === "mysql" && t === "TEXT") t = "VARCHAR(255)";
      if (pk === c && d === "mssql" && t === "NVARCHAR(MAX)") t = "NVARCHAR(450)";
      const parts = [`  ${quoteIdent(c.name, d)} ${t}`];
      if (pk === c) parts.push("PRIMARY KEY");
      else if (!c.nullable) parts.push("NOT NULL");
      if (c.kind === "json" && d === "mssql") parts.push(`CHECK (ISJSON(${quoteIdent(c.name, d)}) = 1)`);
      return parts.join(" ");
    });
    out.push(`CREATE TABLE ${table} (\n${defs.join(",\n")}\n);`, "");
  }

  const cap = d === "mssql" ? 1000 : 10000;
  const size = Math.max(1, Math.min(cap, Math.floor(o.batchSize) || 1));
  const colList = columns.map((c) => quoteIdent(c.name, d)).join(", ");
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const values = chunk.map((r) => `  (${columns.map((c) => sqlValue(r[c.name] ?? null, c, d)).join(", ")})`);
    out.push(`INSERT INTO ${table} (${colList}) VALUES\n${values.join(",\n")};`);
  }
  return { sql: out.join("\n") + "\n", columns, rows: rows.length };
}
