"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, SelectField, StatGrid, TextArea, ToolPanel, downloadFile, fmt } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import type { CountryCode } from "libphonenumber-js";

type Lib = typeof import("libphonenumber-js/max");
type OutFormat = "E.164" | "INTERNATIONAL" | "NATIONAL" | "RFC3966";

const SAMPLE = "+1 650 253 0000\n(415) 555-2671\n020 7946 0958\n+44 20 7946 0958\n+91 98765 43210\n12345";

const TYPE_LABEL: Record<string, string> = {
  MOBILE: "Mobile",
  FIXED_LINE: "Landline",
  FIXED_LINE_OR_MOBILE: "Landline or mobile",
  TOLL_FREE: "Toll-free",
  PREMIUM_RATE: "Premium rate",
  SHARED_COST: "Shared cost",
  VOIP: "VoIP",
  PERSONAL_NUMBER: "Personal number",
  PAGER: "Pager",
  UAN: "UAN",
  VOICEMAIL: "Voicemail",
};

type Row = { input: string; ok: boolean; formatted: string; e164: string; country: string; type: string; note: string };

export default function Tool() {
  const [lib, setLib] = useState<Lib | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [country, setCountry] = useState<string>("US");
  const [out, setOut] = useState<OutFormat>("INTERNATIONAL");
  const deferred = useDeferredValue(input);

  useEffect(() => {
    let alive = true;
    import("libphonenumber-js/max")
      .then((m) => alive && setLib(m))
      .catch(() => alive && setLoadError("Phone metadata could not be loaded. Check your connection and reload the page."));
    return () => {
      alive = false;
    };
  }, []);

  const countries = useMemo(() => {
    if (!lib) return [];
    const names = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
    return lib
      .getCountries()
      .map((c) => ({ value: c, label: `${names?.of(c) ?? c} (+${lib.getCountryCallingCode(c)})` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [lib]);

  const rows = useMemo<Row[]>(() => {
    if (!lib) return [];
    const names = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
    return deferred
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 1000)
      .map((line) => {
        const p = lib.parsePhoneNumberFromString(line, { defaultCountry: country as CountryCode });
        if (!p) return { input: line, ok: false, formatted: "", e164: "", country: "", type: "", note: "Not recognized as a phone number" };
        const ok = p.isValid();
        const possible = p.isPossible();
        const t = p.getType();
        return {
          input: line,
          ok,
          formatted: p.format(out),
          e164: p.number,
          country: p.country ? (names?.of(p.country) ?? p.country) : `+${p.countryCallingCode}`,
          type: t ? (TYPE_LABEL[t] ?? t) : "",
          note: ok ? "" : possible ? "Right length, but not a valid number for this country" : "Wrong length for this country",
        };
      });
  }, [lib, deferred, country, out]);

  const valid = rows.filter((r) => r.ok).length;
  const outputText = rows.map((r) => (r.ok ? r.formatted : `# invalid: ${r.input}`)).join("\n");
  const csv = [
    "input,valid,formatted,e164,country,type",
    ...rows.map((r) => [r.input, r.ok ? "yes" : "no", r.formatted, r.e164, r.country, r.type].map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")),
  ].join("\r\n");

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Phone numbers"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => setInput(SAMPLE)}>
              Load sample
            </Btn>
            <ResetBtn onClick={() => setInput("")} />
          </>
        }
      >
        {loadError ? (
          <Notice tone="error">{loadError}</Notice>
        ) : !lib ? (
          <Spinner label="Loading phone metadata" />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Default country" hint="Used for numbers written without a + country code." value={country} onChange={(e) => setCountry(e.target.value)} options={countries} />
              <SelectField
                label="Output format"
                value={out}
                onChange={(e) => setOut(e.target.value as OutFormat)}
                options={[
                  { value: "INTERNATIONAL", label: "International (+1 650 253 0000)" },
                  { value: "E.164", label: "E.164 (+16502530000)" },
                  { value: "NATIONAL", label: "National ((650) 253-0000)" },
                  { value: "RFC3966", label: "RFC 3966 link (tel:+1-650-253-0000)" },
                ]}
              />
            </div>
            <TextArea label="Numbers, one per line" mono value={input} onChange={(e) => setInput(e.target.value)} rows={8} hint="Up to 1,000 lines. Spaces, dashes, dots and brackets are fine." />
          </div>
        )}
      </ToolPanel>

      <ToolPanel
        title="Results"
        actions={
          <>
            <Btn variant="ghost" icon="download" disabled={!rows.length} onClick={() => downloadFile("phone-numbers.csv", csv, "text/csv")}>
              CSV
            </Btn>
            <CopyBtn text={rows.length ? outputText : ""} label="Copy formatted" />
          </>
        }
      >
        {!rows.length ? (
          <EmptyState icon="list" title="No numbers yet">
            Paste one or more phone numbers above.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <StatGrid
              items={[
                { label: "Numbers", value: fmt(rows.length, 0) },
                { label: "Valid", value: fmt(valid, 0) },
                { label: "Invalid", value: fmt(rows.length - valid, 0) },
              ]}
            />
            <div className="max-h-[520px] overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Parsed phone numbers</caption>
                <thead className="sticky top-0 bg-sunken text-ink-2">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Input</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium">Formatted</th>
                    <th scope="col" className="px-3 py-2 font-medium">Country</th>
                    <th scope="col" className="px-3 py-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="px-3 py-2 font-mono">{r.input}</td>
                      <td className="px-3 py-2">
                        {r.ok ? <span className="text-accent-strong">✓ Valid</span> : <span className="text-danger">✕ Invalid</span>}
                        {r.note && <span className="block text-[0.8125rem] text-muted">{r.note}</span>}
                      </td>
                      <td className="px-3 py-2 font-mono">{r.formatted}</td>
                      <td className="px-3 py-2">{r.country}</td>
                      <td className="px-3 py-2">{r.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[0.8125rem] text-muted">Valid means the number matches the numbering plan for its country. It does not confirm the line is in service.</p>
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
