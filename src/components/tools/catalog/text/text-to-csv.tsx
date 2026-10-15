"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Btn,
  Checkbox,
  CopyBtn,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SelectField,
  SplitGrid,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
} from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { splitOnWhitespaceRuns, toAligned, toMarkdownTable, toTsv } from "./lib/table";

type Papa = typeof import("papaparse");
type Dir = "to-csv" | "from-csv";
type Out = "aligned" | "markdown" | "tsv";

const TEXT_SAMPLE = "name\tcity\tnote\nAda Lovelace\tLondon\tFirst program, 1843\nGrace Hopper\tNew York\tSaid \"it's easier to ask forgiveness\"";
const CSV_SAMPLE = 'product,price,notes\n"Desk, oak",249,"Ships in 2 parts"\nLamp,39,\nChair,"129","Comes in ""sand"" and black"';

export default function Tool() {
  const [dir, setDir] = useState<Dir>("to-csv");
  const [input, setInput] = useState("");
  const [inDelim, setInDelim] = useState("auto");
  const [custom, setCustom] = useState("");
  const [outDelim, setOutDelim] = useState(",");
  const [quoteAll, setQuoteAll] = useState(false);
  const [out, setOut] = useState<Out>("aligned");
  const [header, setHeader] = useState(true);
  const [papa, setPapa] = useState<Papa | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const deferred = useDeferredValue(input);

  useEffect(() => {
    let alive = true;
    import("papaparse")
      .then((m) => alive && setPapa((m.default ?? m) as Papa))
      .catch(() => alive && setLoadError("The CSV parser could not be loaded. Check your connection and reload the page."));
    return () => {
      alive = false;
    };
  }, []);

  const result = useMemo(() => {
    if (!papa || !deferred.trim()) return null;
    if (dir === "to-csv") {
      let rows: string[][];
      if (inDelim === "spaces" || inDelim === "space") rows = splitOnWhitespaceRuns(deferred, inDelim === "space");
      else {
        const delimiter = inDelim === "auto" ? "" : inDelim === "custom" ? custom : inDelim === "tab" ? "\t" : inDelim;
        if (inDelim === "custom" && !custom) return { error: "Enter a custom delimiter." };
        const parsed = papa.parse<string[]>(deferred.trim(), { delimiter, skipEmptyLines: true, quoteChar: '"' });
        rows = parsed.data;
        if (parsed.errors.length && !rows.length) return { error: parsed.errors[0].message };
      }
      const text = papa.unparse(rows, { delimiter: outDelim === "tab" ? "\t" : outDelim, quotes: quoteAll, newline: "\r\n" });
      return { text, rows: rows.length, cols: Math.max(0, ...rows.map((r) => r.length)), warn: null as string | null };
    }
    const parsed = papa.parse<string[]>(deferred.trim(), { skipEmptyLines: true });
    const rows = parsed.data;
    const warn = parsed.errors.length ? `Row ${(parsed.errors[0].row ?? 0) + 1}: ${parsed.errors[0].message}` : null;
    const text = out === "markdown" ? toMarkdownTable(rows, header) : out === "tsv" ? toTsv(rows) : toAligned(rows);
    return { text, rows: rows.length, cols: Math.max(0, ...rows.map((r) => r.length)), warn };
  }, [papa, deferred, dir, inDelim, custom, outDelim, quoteAll, out, header]);

  const text = result && "text" in result ? (result.text ?? "") : "";
  const fileName = dir === "to-csv" ? (outDelim === "tab" ? "data.tsv" : "data.csv") : out === "markdown" ? "table.md" : out === "tsv" ? "data.tsv" : "table.txt";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Options"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => setInput(dir === "to-csv" ? TEXT_SAMPLE : CSV_SAMPLE)}>
              Load sample
            </Btn>
            <ResetBtn onClick={() => setInput("")} />
          </>
        }
      >
        <div className="space-y-5">
          <Segmented
            label="Direction"
            value={dir}
            onChange={(d) => {
              setDir(d);
              setInput("");
            }}
            options={[
              { value: "to-csv", label: "Delimited text to CSV" },
              { value: "from-csv", label: "CSV to table text" },
            ]}
          />
          {dir === "to-csv" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label="Input separator"
                value={inDelim}
                onChange={(e) => setInDelim(e.target.value)}
                options={[
                  { value: "auto", label: "Detect automatically" },
                  { value: "tab", label: "Tab" },
                  { value: ",", label: "Comma" },
                  { value: ";", label: "Semicolon" },
                  { value: "|", label: "Pipe" },
                  { value: "spaces", label: "2+ spaces (aligned columns)" },
                  { value: "space", label: "Any whitespace" },
                  { value: "custom", label: "Custom" },
                ]}
              />
              {inDelim === "custom" && <TextField label="Custom separator" value={custom} onChange={(e) => setCustom(e.target.value)} />}
              <SelectField
                label="Output separator"
                value={outDelim}
                onChange={(e) => setOutDelim(e.target.value)}
                options={[
                  { value: ",", label: "Comma (CSV)" },
                  { value: ";", label: "Semicolon" },
                  { value: "tab", label: "Tab (TSV)" },
                ]}
              />
              <div className="self-end pb-2">
                <Checkbox label="Quote every field" checked={quoteAll} onChange={setQuoteAll} />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Segmented
                label="Output format"
                value={out}
                onChange={setOut}
                options={[
                  { value: "aligned", label: "Aligned columns" },
                  { value: "markdown", label: "Markdown table" },
                  { value: "tsv", label: "TSV" },
                ]}
              />
              {out === "markdown" && <Checkbox label="First row is a header" checked={header} onChange={setHeader} />}
            </div>
          )}
        </div>
      </ToolPanel>
      <SplitGrid>
        <ToolPanel title={dir === "to-csv" ? "Delimited text" : "CSV"}>
          <TextArea label={dir === "to-csv" ? "Text input" : "CSV input"} mono value={input} onChange={(e) => setInput(e.target.value)} rows={14} />
        </ToolPanel>
        <ToolPanel
          title="Result"
          actions={
            <>
              <Btn variant="ghost" icon="download" disabled={!text} onClick={() => downloadFile(fileName, text, dir === "to-csv" ? "text/csv" : "text/plain")}>
                Download
              </Btn>
              <CopyBtn text={text} />
            </>
          }
        >
          {loadError ? (
            <Notice tone="error">{loadError}</Notice>
          ) : !papa ? (
            <Spinner label="Loading CSV parser" />
          ) : result && "error" in result ? (
            <Notice tone="error">{result.error}</Notice>
          ) : (
            <div className="space-y-3">
              {result?.warn && <Notice tone="warning">{result.warn}. The output may be incomplete.</Notice>}
              <OutputBlock label="Converted table">
                <code>{text || "The result appears here as you type."}</code>
              </OutputBlock>
              {result && "rows" in result && (
                <p className="text-[0.8125rem] text-muted" aria-live="polite">
                  {result.rows.toLocaleString()} rows · {result.cols} columns
                </p>
              )}
            </div>
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
