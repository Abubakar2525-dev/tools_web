"use client";

import { useDeferredValue, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, ResultCard, StatGrid, TextArea, ToolPanel } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { IBAN_REGISTRY, describeFormat, printFormat, validateIban } from "./lib/iban";

const SAMPLE = "GB82 WEST 1234 5698 7654 32";

export default function Tool() {
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text);
  const lines = deferred
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 200);
  const results = lines.map(validateIban);
  const single = results.length === 1 ? results[0] : null;
  const validCount = results.filter((r) => r.valid).length;
  const formattedAll = results.map((r) => (r.valid ? printFormat(r.iban) : `${r.input}  (invalid)`)).join("\n");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel
        title="IBAN"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => setText(`${SAMPLE}\nDE89 3704 0044 0532 0130 00\nFR14 2004 1010 0505 0001 3M02 606`)}>
              Load examples
            </Btn>
            <ResetBtn onClick={() => setText("")} />
          </>
        }
      >
        <TextArea
          label="IBAN or list of IBANs"
          hint="One per line. Spaces, dashes and an IBAN prefix are ignored."
          mono
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={SAMPLE}
          spellCheck={false}
          autoCapitalize="characters"
        />
        {lines.length >= 200 && <p className="mt-2 text-sm text-muted">Only the first 200 lines are checked.</p>}
        <p className="mt-4 text-[0.8125rem] text-muted">
          A valid checksum proves the IBAN is well formed, not that the account exists or is open. Covers {Object.keys(IBAN_REGISTRY).length} countries from the SWIFT IBAN registry.
        </p>
      </ToolPanel>

      <ToolPanel title="Result" actions={results.length > 1 ? <CopyBtn text={formattedAll} label="Copy formatted" /> : undefined}>
        {results.length === 0 ? (
          <EmptyState icon="info" title="Paste an IBAN to check it">
            Results update as you type.
          </EmptyState>
        ) : single ? (
          <div className="space-y-5">
            <ResultCard
              tone={single.valid ? "accent" : "neutral"}
              label={single.valid ? "Valid IBAN" : "Not a valid IBAN"}
              value={<span className="break-all font-mono text-[1.25rem] sm:text-[1.5rem]">{printFormat(single.iban) || "?"}</span>}
              detail={single.countryName ? `${single.countryName} · ${single.iban.length} characters` : undefined}
            />
            {single.valid && (
              <div className="flex flex-wrap gap-2">
                <CopyBtn text={printFormat(single.iban)} label="Copy print format" />
                <CopyBtn text={single.iban} label="Copy electronic format" />
              </div>
            )}
            <ul className="space-y-2">
              {single.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 text-sm">
                  <Icon name={c.ok ? "check" : "alert"} size={18} className={`mt-px shrink-0 ${c.ok ? "text-accent-strong" : "text-danger"}`} />
                  <span>
                    <span className="font-medium text-ink">{c.label}: </span>
                    <span className="sr-only">{c.ok ? "passed. " : "failed. "}</span>
                    <span className="text-ink-2">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {single.suggestedCheckDigits && (
              <Notice tone="warning">
                The structure is right but the check digits do not match. For this account number the check digits would be <strong>{single.suggestedCheckDigits}</strong>. A typo elsewhere in the number is more likely, so confirm with the account holder rather than editing it.
              </Notice>
            )}
            {single.country && IBAN_REGISTRY[single.country] && (
              <StatGrid
                items={[
                  { label: "Country", value: single.country },
                  { label: "Check digits", value: single.iban.slice(2, 4) || "?" },
                  ...(single.bank ? [{ label: "Bank code", value: single.bank }] : []),
                  ...(single.branch ? [{ label: IBAN_REGISTRY[single.country].bank ? "Branch / sort code" : "Bank and branch", value: single.branch }] : []),
                  ...(single.account ? [{ label: "Account part", value: <span className="break-all">{single.account}</span> }] : []),
                  { label: "BBAN", value: <span className="break-all">{single.bban || "?"}</span> },
                ]}
              />
            )}
            {single.country && IBAN_REGISTRY[single.country] && (
              <p className="text-[0.8125rem] text-muted">
                {IBAN_REGISTRY[single.country].name} format: {IBAN_REGISTRY[single.country].length} characters; BBAN is {describeFormat(IBAN_REGISTRY[single.country].bban)}.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <ResultCard label="Valid IBANs" value={`${validCount} of ${results.length}`} />
            <ul className="space-y-2">
              {results.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-lg bg-sunken px-3 py-2.5 text-sm">
                  <Icon name={r.valid ? "check" : "alert"} size={18} className={`mt-px shrink-0 ${r.valid ? "text-accent-strong" : "text-danger"}`} />
                  <div className="min-w-0">
                    <p className="break-all font-mono text-ink">{r.valid ? printFormat(r.iban) : r.input}</p>
                    <p className="text-[0.8125rem] text-ink-2">
                      {r.valid ? `Valid · ${r.countryName}` : `Invalid: ${r.checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase()).join(", ")}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}
