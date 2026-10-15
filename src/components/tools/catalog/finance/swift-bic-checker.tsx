"use client";

import { useDeferredValue, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, ResultCard, TextField, ToolPanel } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { checkBic } from "./lib/bic";

const EXAMPLES = ["DEUTDEFF", "NWBKGB2L", "BOFAUS3NXXX", "DEUTDEFF500"];

export default function Tool() {
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text);
  const r = deferred.trim() ? checkBic(deferred) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel title="SWIFT / BIC code" actions={<ResetBtn onClick={() => setText("")} />}>
        <TextField
          label="Code"
          hint="8 or 11 characters. Spaces are ignored."
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="DEUTDEFF500"
          maxLength={20}
          autoCapitalize="characters"
          spellCheck={false}
        />
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">Try an example</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((x) => (
              <Btn key={x} variant="subtle" onClick={() => setText(x)}>
                <span className="font-mono">{x}</span>
              </Btn>
            ))}
          </div>
        </div>
        <p className="mt-5 text-[0.8125rem] text-muted">
          This checks the structure and country code only. It cannot confirm that a bank or branch with this code exists; only the SWIFT directory or your bank can.
        </p>
      </ToolPanel>

      <ToolPanel title="Result" actions={r?.valid && r.bic11 ? <CopyBtn text={r.bic} /> : undefined}>
        {!r ? (
          <EmptyState icon="info" title="Enter a SWIFT or BIC code" />
        ) : (
          <div className="space-y-5">
            <ResultCard
              tone={r.valid ? "accent" : "neutral"}
              label={r.valid ? "Valid format" : "Not a valid BIC"}
              value={<span className="break-all font-mono text-[1.5rem] sm:text-[1.75rem]">{r.bic || "?"}</span>}
              detail={r.valid ? (r.primaryOffice ? "Primary office" : "Specific branch") + (r.test ? " · test and training code" : "") : undefined}
            />
            {r.errors.length > 0 && (
              <Notice tone="error">
                <ul className="list-disc space-y-1 pl-4">
                  {r.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Notice>
            )}
            {r.warnings.map((w) => (
              <Notice key={w} tone="warning">
                {w}
              </Notice>
            ))}
            <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">BIC breakdown</caption>
                <thead>
                  <tr className="border-b border-line">
                    {["Part", "Characters", "Value", "Meaning"].map((c) => (
                      <th key={c} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.fields.map((f) => (
                    <tr key={f.part} className="border-b border-line align-top last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 text-ink">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name={f.ok ? "check" : "alert"} size={16} className={f.ok ? "text-accent-strong" : "text-danger"} />
                          <span className="sr-only">{f.ok ? "OK: " : "Problem: "}</span>
                          {f.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-2">{f.part}</td>
                      <td className="px-3 py-2 font-mono text-ink">{f.value || "?"}</td>
                      <td className="min-w-[180px] px-3 py-2 text-ink-2">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.valid && r.bic11 && r.bic.length === 8 && (
              <p className="text-sm text-ink-2">
                11-character form: <code className="font-mono text-ink">{r.bic11}</code>
              </p>
            )}
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}
