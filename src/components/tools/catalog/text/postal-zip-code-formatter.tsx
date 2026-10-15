"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, SelectField, StatGrid, TextArea, ToolPanel, downloadFile, fmt } from "@/components/tools/kit";
import { POSTAL_RULES, checkPostal } from "./lib/postal";

const OPTIONS = POSTAL_RULES.map((r) => ({ value: r.code, label: `${r.country} (${r.term})` })).sort((a, b) => a.label.localeCompare(b.label));

export default function Tool() {
  const [code, setCode] = useState("US");
  const [input, setInput] = useState("");
  const deferred = useDeferredValue(input);
  const rule = POSTAL_RULES.find((r) => r.code === code) ?? POSTAL_RULES[0];

  const rows = useMemo(
    () =>
      deferred
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .slice(0, 5000)
        .map((l) => checkPostal(l, rule)),
    [deferred, rule],
  );
  const valid = rows.filter((r) => r.valid).length;
  const outText = rows.map((r) => (r.valid ? r.formatted : `# invalid: ${r.input.trim()}`)).join("\n");

  const sample = () => {
    const ex = rule.example;
    const messy = ex.toLowerCase().replace(/[\s-]/g, "");
    setInput([ex, messy, ` ${ex.replace(/[\s-]/g, " ")} `, "ABC-12"].join("\n"));
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Postal codes"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={sample}>
              Load sample
            </Btn>
            <ResetBtn onClick={() => setInput("")} />
          </>
        }
      >
        <div className="space-y-4">
          <SelectField label="Country" value={code} onChange={(e) => setCode(e.target.value)} options={OPTIONS} />
          <Notice>
            <span className="font-medium">{rule.term} format:</span> {rule.description} Example: <span className="font-mono">{rule.example}</span>
          </Notice>
          <TextArea label="Codes, one per line" mono value={input} onChange={(e) => setInput(e.target.value)} rows={8} hint="Case, spaces and hyphens are normalized automatically." />
        </div>
      </ToolPanel>
      <ToolPanel
        title="Results"
        actions={
          <>
            <Btn variant="ghost" icon="download" disabled={!rows.length} onClick={() => downloadFile("postal-codes.txt", outText)}>
              Download
            </Btn>
            <CopyBtn text={rows.length ? outText : ""} label="Copy formatted" />
          </>
        }
      >
        {!rows.length ? (
          <EmptyState icon="list" title="No codes yet">
            Paste postal codes above, one per line.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <StatGrid
              items={[
                { label: "Codes", value: fmt(rows.length, 0) },
                { label: "Valid format", value: fmt(valid, 0) },
                { label: "Invalid", value: fmt(rows.length - valid, 0) },
              ]}
            />
            <div className="max-h-[480px] overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
              <table className="w-full min-w-[420px] text-left text-sm">
                <caption className="sr-only">Postal code check results</caption>
                <thead className="sticky top-0 bg-sunken text-ink-2">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Input</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium">Formatted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="whitespace-pre px-3 py-2 font-mono">{r.input}</td>
                      <td className="px-3 py-2">
                        {r.valid ? <span className="text-accent-strong">✓ Valid format</span> : <span className="text-danger">✕ {r.reason}</span>}
                      </td>
                      <td className="px-3 py-2 font-mono">{r.formatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="mt-4 text-[0.8125rem] text-muted">A valid format does not prove that the code or address exists. Confirm deliverability with the national postal service.</p>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
