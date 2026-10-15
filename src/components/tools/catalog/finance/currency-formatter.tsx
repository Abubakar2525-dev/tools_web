"use client";

import { useMemo, useState } from "react";
import { CopyBtn, Notice, NumberField, PrivacyNote, ResetBtn, ResultCard, SelectField, ToolPanel, parseNum } from "@/components/tools/kit";
import { CURRENCIES, CURRENCY_OPTIONS } from "./lib/money";

const LOCALES = [
  ["en-US", "English (United States)"],
  ["en-GB", "English (United Kingdom)"],
  ["en-IN", "English (India)"],
  ["en-CA", "English (Canada)"],
  ["fr-CA", "French (Canada)"],
  ["de-DE", "German (Germany)"],
  ["de-CH", "German (Switzerland)"],
  ["fr-FR", "French (France)"],
  ["es-ES", "Spanish (Spain)"],
  ["es-MX", "Spanish (Mexico)"],
  ["pt-BR", "Portuguese (Brazil)"],
  ["it-IT", "Italian (Italy)"],
  ["nl-NL", "Dutch (Netherlands)"],
  ["sv-SE", "Swedish (Sweden)"],
  ["pl-PL", "Polish (Poland)"],
  ["tr-TR", "Turkish (Turkey)"],
  ["ar-EG", "Arabic (Egypt)"],
  ["ar-SA", "Arabic (Saudi Arabia)"],
  ["ur-PK", "Urdu (Pakistan)"],
  ["hi-IN", "Hindi (India)"],
  ["ja-JP", "Japanese (Japan)"],
  ["zh-CN", "Chinese (China)"],
  ["ko-KR", "Korean (South Korea)"],
].map(([value, label]) => ({ value, label: `${label} · ${value}` }));

type Display = "symbol" | "narrowSymbol" | "code" | "name";
type Sign = "auto" | "accounting" | "always" | "exceptZero";
type Notation = "standard" | "compact";

function make(locale: string, currency: string, o: { display: Display; sign: Sign; notation: Notation; digits: string }) {
  const opts: Intl.NumberFormatOptions = { style: "currency", currency, currencyDisplay: o.display, currencySign: o.sign === "accounting" ? "accounting" : "standard", notation: o.notation };
  if (o.sign === "always" || o.sign === "exceptZero") opts.signDisplay = o.sign;
  if (o.digits !== "auto") {
    opts.minimumFractionDigits = Number(o.digits);
    opts.maximumFractionDigits = Number(o.digits);
  }
  return new Intl.NumberFormat(locale, opts);
}

const DEFAULTS = { amount: "-1234567.891", locale: "en-US", currency: "USD", display: "symbol" as Display, sign: "auto" as Sign, notation: "standard" as Notation, digits: "auto" };

export default function Tool() {
  const [s, setS] = useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) => setS((p) => ({ ...p, [k]: v }));
  const amount = parseNum(s.amount);
  const amountErr = s.amount.trim() !== "" && amount === null ? "Enter a valid number." : null;

  const out = useMemo(() => {
    if (amount === null) return null;
    try {
      const f = make(s.locale, s.currency, s);
      const parts = f.formatToParts(amount);
      return { text: f.format(amount), parts, digits: f.resolvedOptions().maximumFractionDigits };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "This combination is not supported by your browser." };
    }
  }, [amount, s]);

  const symbols = useMemo(
    () =>
      CURRENCIES.map((c) => {
        const sym = (d: Display) => {
          try {
            return new Intl.NumberFormat(s.locale, { style: "currency", currency: c.code, currencyDisplay: d }).formatToParts(1).find((p) => p.type === "currency")?.value ?? "";
          } catch {
            return "";
          }
        };
        let digits = 2;
        try {
          digits = new Intl.NumberFormat(s.locale, { style: "currency", currency: c.code }).resolvedOptions().maximumFractionDigits ?? 2;
        } catch {
          /* keep 2 */
        }
        let sample = "";
        try {
          sample = new Intl.NumberFormat(s.locale, { style: "currency", currency: c.code }).format(1234.5);
        } catch {
          /* ignore */
        }
        return { code: c.code, symbol: sym("symbol"), narrow: sym("narrowSymbol"), name: sym("name"), digits, sample };
      }),
    [s.locale],
  );

  const snippet = `new Intl.NumberFormat("${s.locale}", { style: "currency", currency: "${s.currency}"${s.display !== "symbol" ? `, currencyDisplay: "${s.display}"` : ""}${s.sign === "accounting" ? ', currencySign: "accounting"' : ""}${s.sign === "always" || s.sign === "exceptZero" ? `, signDisplay: "${s.sign}"` : ""}${s.notation === "compact" ? ', notation: "compact"' : ""}${s.digits !== "auto" ? `, minimumFractionDigits: ${s.digits}, maximumFractionDigits: ${s.digits}` : ""} }).format(${amount ?? 0})`;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title="Format" actions={<ResetBtn onClick={() => setS(DEFAULTS)} />}>
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField label="Amount" value={s.amount} error={amountErr} onChange={(e) => set("amount", e.target.value)} className="sm:col-span-2" />
            <SelectField label="Locale" value={s.locale} onChange={(e) => set("locale", e.target.value)} options={LOCALES} />
            <SelectField label="Currency" value={s.currency} onChange={(e) => set("currency", e.target.value)} options={CURRENCY_OPTIONS} />
            <SelectField
              label="Show currency as"
              value={s.display}
              onChange={(e) => set("display", e.target.value as Display)}
              options={[
                { value: "symbol", label: "Symbol (US$, €)" },
                { value: "narrowSymbol", label: "Narrow symbol ($)" },
                { value: "code", label: "ISO code (USD)" },
                { value: "name", label: "Name (US dollars)" },
              ]}
            />
            <SelectField
              label="Negative and sign style"
              value={s.sign}
              onChange={(e) => set("sign", e.target.value as Sign)}
              options={[
                { value: "auto", label: "Standard (−1.00)" },
                { value: "accounting", label: "Accounting (parentheses)" },
                { value: "always", label: "Always show sign" },
                { value: "exceptZero", label: "Sign except for zero" },
              ]}
            />
            <SelectField
              label="Notation"
              value={s.notation}
              onChange={(e) => set("notation", e.target.value as Notation)}
              options={[
                { value: "standard", label: "Standard" },
                { value: "compact", label: "Compact (1.2M)" },
              ]}
            />
            <SelectField
              label="Decimal places"
              value={s.digits}
              onChange={(e) => set("digits", e.target.value)}
              options={[{ value: "auto", label: "Currency default" }, ...["0", "1", "2", "3", "4"].map((d) => ({ value: d, label: d }))]}
            />
          </div>
        </ToolPanel>
        <ToolPanel title="Result" actions={out && "text" in out && out.text ? <CopyBtn text={out.text} /> : undefined}>
          {!out ? (
            <Notice>Enter an amount to format.</Notice>
          ) : "error" in out ? (
            <Notice tone="error">{out.error}</Notice>
          ) : (
            <div className="space-y-5">
              <ResultCard label={`${s.currency} in ${s.locale}`} value={<span className="break-all text-[1.75rem] sm:text-[2.25rem]">{out.text}</span>} detail={`Default decimals for ${s.currency}: ${out.digits}`} />
              <div>
                <p className="text-sm font-medium text-ink">Parts</p>
                <ul className="mt-2 flex flex-wrap gap-1.5 text-[0.8125rem]">
                  {out.parts.map((p, i) => (
                    <li key={i} className="rounded-md bg-sunken px-2 py-1">
                      <span className="text-muted">{p.type}</span> <code className="font-mono text-ink">{JSON.stringify(p.value)}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">JavaScript</p>
                  <CopyBtn text={snippet} label="Copy code" />
                </div>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-night p-3 font-mono text-[0.8125rem] text-night-ink">{snippet}</pre>
              </div>
            </div>
          )}
          <div className="mt-6">
            <PrivacyNote />
          </div>
        </ToolPanel>
      </div>
      <ToolPanel title={`Currency symbols in ${s.locale}`}>
        <div className="max-h-[420px] overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label="Currency symbols table">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="shadow-[inset_0_-1px_0_var(--line)]">
                {["Code", "Symbol", "Narrow", "Name", "Decimals", "1234.5 formatted"].map((c) => (
                  <th key={c} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symbols.map((r) => (
                <tr key={r.code} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-mono text-ink">{r.code}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-2">{r.symbol}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-2">{r.narrow}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-2">{r.name}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-2">{r.digits}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-2">{r.sample}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[0.8125rem] text-muted">Formatting comes from your browser&apos;s built-in Intl data, so output can differ slightly between browsers and versions.</p>
      </ToolPanel>
    </div>
  );
}
