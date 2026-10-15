"use client";

import { useState } from "react";
import { format, type KeywordCase, type SqlLanguage } from "sql-formatter";
import {
  Btn,
  CopyBtn,
  EmptyState,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  SelectField,
  SplitGrid,
  TextArea,
  ToolPanel,
  downloadFile,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

const DIALECTS: { value: SqlLanguage; label: string }[] = [
  { value: "sql", label: "Standard SQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "tsql", label: "SQL Server (T-SQL)" },
  { value: "sqlite", label: "SQLite" },
  { value: "bigquery", label: "BigQuery" },
  { value: "snowflake", label: "Snowflake" },
];

const CASES: { value: KeywordCase; label: string }[] = [
  { value: "upper", label: "UPPERCASE" },
  { value: "lower", label: "lowercase" },
  { value: "preserve", label: "Preserve original" },
];

const INDENTS = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
];

const GAPS = [
  { value: "1", label: "1 blank line" },
  { value: "2", label: "2 blank lines" },
  { value: "0", label: "No blank line" },
];

type Options = { language: SqlLanguage; keywordCase: KeywordCase; tabWidth: number; linesBetweenQueries: number };

const DEFAULTS: Options = { language: "sql", keywordCase: "upper", tabWidth: 2, linesBetweenQueries: 1 };

const SAMPLE = `select o.id, o.created_at, c.name as customer, sum(li.quantity * li.unit_price) as total from orders o join customers c on c.id = o.customer_id left join line_items li on li.order_id = o.id where o.status in ('paid','shipped') and o.created_at >= '2026-01-01' group by o.id, o.created_at, c.name having sum(li.quantity * li.unit_price) > 100 order by total desc limit 20;
update customers set tier = 'gold' where id in (select customer_id from orders group by customer_id having count(*) > 10);`;

type Result = { kind: "ok"; output: string; lines: number } | { kind: "error"; message: string };

function runFormat(sql: string, o: Options): Result {
  try {
    const output = format(sql, {
      language: o.language,
      keywordCase: o.keywordCase,
      tabWidth: o.tabWidth,
      linesBetweenQueries: o.linesBetweenQueries,
    });
    return { kind: "ok", output, lines: output.split("\n").length };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return { kind: "error", message: raw.split("\n").slice(0, 4).join(" ").trim() || "The SQL could not be parsed." };
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [sql, setSql] = useState("");
  const [opts, setOpts] = useState<Options>(DEFAULTS);
  const [result, setResult] = useState<Result | null>(null);
  const [emptyError, setEmptyError] = useState(false);

  const run = (text: string = sql, o: Options = opts) => {
    if (!text.trim()) {
      setEmptyError(true);
      setResult(null);
      return;
    }
    setEmptyError(false);
    setResult(runFormat(text, o));
  };

  /** Updates an option and re-formats when there is already output to keep it in sync. */
  const setOpt = <K extends keyof Options>(key: K, value: Options[K]) => {
    const next = { ...opts, [key]: value };
    setOpts(next);
    if (result && sql.trim()) setResult(runFormat(sql, next));
  };

  const reset = () => {
    setSql("");
    setOpts(DEFAULTS);
    setResult(null);
    setEmptyError(false);
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="SQL formatter"
        actions={
          <>
            <Btn
              variant="ghost"
              icon="table"
              onClick={() => {
                setSql(SAMPLE);
                run(SAMPLE);
              }}
            >
              Load sample
            </Btn>
            <ResetBtn onClick={reset} />
          </>
        }
      >
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Dialect"
            options={DIALECTS}
            value={opts.language}
            onChange={(e) => setOpt("language", e.target.value as SqlLanguage)}
          />
          <SelectField
            label="Keyword case"
            options={CASES}
            value={opts.keywordCase}
            onChange={(e) => setOpt("keywordCase", e.target.value as KeywordCase)}
          />
          <SelectField
            label="Indent"
            options={INDENTS}
            value={String(opts.tabWidth)}
            onChange={(e) => setOpt("tabWidth", Number(e.target.value))}
          />
          <SelectField
            label="Between queries"
            options={GAPS}
            value={String(opts.linesBetweenQueries)}
            onChange={(e) => setOpt("linesBetweenQueries", Number(e.target.value))}
          />
        </div>

        <SplitGrid>
          <div className="min-w-0 space-y-4">
            <TextArea
              label="SQL input"
              mono
              hint="Press Ctrl or Cmd + Enter to format."
              placeholder="select * from users where id = 1;"
              value={sql}
              onChange={(e) => {
                setSql(e.target.value);
                if (emptyError) setEmptyError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  run();
                }
              }}
              error={emptyError ? "Paste a SQL query first." : null}
              rows={14}
            />
            <Btn icon="code" onClick={() => run()}>
              Format SQL
            </Btn>
          </div>

          <div className="min-w-0 space-y-4">
            {result === null ? (
              <EmptyState icon="table" title="Formatted SQL will appear here">
                Paste a query, pick your dialect and press Format SQL.
              </EmptyState>
            ) : result.kind === "error" ? (
              <>
                <Notice tone="error" title="Could not format this SQL">
                  {result.message}
                </Notice>
                <p className="text-[0.8125rem] text-muted">
                  Check that the dialect matches your database and that quotes and parentheses are balanced.
                </p>
              </>
            ) : (
              <>
                <Notice tone="success">
                  SQL formatted into {result.lines} {result.lines === 1 ? "line" : "lines"}.
                </Notice>
                <div className="flex flex-wrap gap-2">
                  <CopyBtn text={result.output} />
                  <Btn
                    variant="ghost"
                    icon="download"
                    onClick={() => downloadFile("formatted.sql", result.output, "application/sql")}
                  >
                    Download .sql
                  </Btn>
                </div>
                <OutputBlock label="Formatted SQL">
                  <code>{result.output}</code>
                </OutputBlock>
              </>
            )}
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
