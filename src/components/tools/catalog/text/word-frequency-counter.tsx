"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Btn,
  Checkbox,
  EmptyState,
  NumberField,
  PrivacyNote,
  ResetBtn,
  Segmented,
  StatGrid,
  TextArea,
  ToolPanel,
  downloadFile,
  fmt,
} from "@/components/tools/kit";
import { frequency, frequencyCsv } from "./lib/frequency";

const SAMPLE = `Good writing is clear writing. Clear writing starts with clear thinking, and clear thinking takes practice.
When you edit, look for repeated words. Repeated words are not always bad, but a word frequency list shows which words you lean on.
Key phrases such as "clear writing" often reveal the real topic of a page.`;

type N = "1" | "2" | "3";

export default function Tool() {
  const [text, setText] = useState("");
  const [n, setN] = useState<N>("1");
  const [stop, setStop] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [numbers, setNumbers] = useState(true);
  const [minLen, setMinLen] = useState("1");
  const [limit, setLimit] = useState("50");
  const deferred = useDeferredValue(text);

  const minLenNum = /^\d{1,2}$/.test(minLen.trim()) ? Number(minLen) : null;
  const limitNum = /^\d{1,5}$/.test(limit.trim()) && Number(limit) > 0 ? Number(limit) : null;

  const res = useMemo(
    () =>
      deferred.trim()
        ? frequency(deferred, {
            n: Number(n) as 1 | 2 | 3,
            excludeStopWords: stop,
            caseSensitive,
            includeNumbers: numbers,
            minLength: minLenNum ?? 1,
          })
        : null,
    [deferred, n, stop, caseSensitive, numbers, minLenNum],
  );
  const shown = res ? res.rows.slice(0, limitNum ?? 50) : [];
  const max = shown[0]?.count ?? 1;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Text"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => setText(SAMPLE)}>
              Load sample
            </Btn>
            <ResetBtn onClick={() => setText("")} />
          </>
        }
      >
        <div className="space-y-5">
          <TextArea label="Text to analyze" value={text} onChange={(e) => setText(e.target.value)} rows={8} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium" aria-hidden="true">
              Count
            </span>
            <Segmented
              label="Count single words or phrases"
              value={n}
              onChange={setN}
              options={[
                { value: "1", label: "Words" },
                { value: "2", label: "2-word phrases" },
                { value: "3", label: "3-word phrases" },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Checkbox label="Exclude common English stop words" hint="the, and, of, to and about 220 more. Phrases starting or ending with one are skipped." checked={stop} onChange={setStop} />
            <Checkbox label="Case sensitive" hint="Count Apple and apple separately." checked={caseSensitive} onChange={setCaseSensitive} />
            <Checkbox label="Include numbers" checked={numbers} onChange={setNumbers} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Min word length" value={minLen} onChange={(e) => setMinLen(e.target.value)} error={minLenNum === null ? "0 to 99" : null} />
              <NumberField label="Rows to show" value={limit} onChange={(e) => setLimit(e.target.value)} error={limitNum === null ? "1 or more" : null} />
            </div>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Frequency"
        actions={
          <Btn
            variant="ghost"
            icon="download"
            disabled={!res?.rows.length}
            onClick={() => res && downloadFile(`frequency-${n}gram.csv`, frequencyCsv(res.rows), "text/csv")}
          >
            Download CSV (all rows)
          </Btn>
        }
      >
        {!res || !res.rows.length ? (
          <EmptyState icon="list" title="Nothing counted yet">
            {res ? "No terms left after filtering. Try turning off the stop-word filter." : "Paste text above to count words and phrases."}
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <StatGrid
              items={[
                { label: "Total words", value: fmt(res.totalWords, 0) },
                { label: n === "1" ? "Counted words" : "Counted phrases", value: fmt(res.totalTokens, 0) },
                { label: "Unique", value: fmt(res.unique, 0) },
              ]}
            />
            <div className="max-h-[520px] overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
              <table className="w-full min-w-[360px] text-left text-sm">
                <caption className="sr-only">Most frequent terms</caption>
                <thead className="sticky top-0 bg-sunken text-ink-2">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">#</th>
                    <th scope="col" className="px-3 py-2 font-medium">{n === "1" ? "Word" : "Phrase"}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Count</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={r.term} className="border-t border-line">
                      <td className="px-3 py-2 tabular-nums text-muted">{i + 1}</td>
                      <th scope="row" className="px-3 py-2 font-normal">
                        <span className="break-all">{r.term}</span>
                        <span aria-hidden="true" className="mt-1 block h-1 rounded-full bg-accent/60" style={{ width: `${(r.count / max) * 100}%` }} />
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums">{r.count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(r.percent, 1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {res.rows.length > shown.length && (
              <p className="text-[0.8125rem] text-muted">
                Showing {shown.length} of {res.rows.length.toLocaleString()}. The CSV includes every row.
              </p>
            )}
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
