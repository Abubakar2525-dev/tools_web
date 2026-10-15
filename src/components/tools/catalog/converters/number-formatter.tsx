"use client";

import { useDeferredValue, useState } from "react";
import { Checkbox, CopyBtn, Notice, OutputBlock, PrivacyNote, ResetBtn, SelectField, TextField, ToolPanel, parseNum } from "@/components/tools/kit";

const LOCALES = [
  ["en-US", "English (United States)"],
  ["en-GB", "English (United Kingdom)"],
  ["en-IN", "English (India)"],
  ["de-DE", "German (Germany)"],
  ["de-CH", "German (Switzerland)"],
  ["fr-FR", "French (France)"],
  ["es-ES", "Spanish (Spain)"],
  ["es-MX", "Spanish (Mexico)"],
  ["it-IT", "Italian (Italy)"],
  ["pt-BR", "Portuguese (Brazil)"],
  ["nl-NL", "Dutch (Netherlands)"],
  ["sv-SE", "Swedish (Sweden)"],
  ["pl-PL", "Polish (Poland)"],
  ["ru-RU", "Russian (Russia)"],
  ["tr-TR", "Turkish (Turkey)"],
  ["ar-EG", "Arabic (Egypt)"],
  ["hi-IN", "Hindi (India)"],
  ["ur-PK", "Urdu (Pakistan)"],
  ["ja-JP", "Japanese (Japan)"],
  ["zh-CN", "Chinese (China)"],
  ["ko-KR", "Korean (South Korea)"],
] as const;
const LOCALE_OPTIONS = [...LOCALES.map(([v, l]) => ({ value: v, label: `${l}, ${v}` })), { value: "custom", label: "Other (type a tag)" }];

type Style = "decimal" | "percent" | "currency" | "unit" | "compact-short" | "compact-long" | "scientific" | "engineering";
const STYLE_OPTIONS: { value: Style; label: string }[] = [
  { value: "decimal", label: "Decimal" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent (0.25 → 25%)" },
  { value: "unit", label: "Unit" },
  { value: "compact-short", label: "Compact short (1.2K)" },
  { value: "compact-long", label: "Compact long (1.2 thousand)" },
  { value: "scientific", label: "Scientific" },
  { value: "engineering", label: "Engineering" },
];
const CURRENCY_CODES = ["USD", "EUR", "GBP", "JPY", "CNY", "INR", "PKR", "CAD", "AUD", "CHF", "BRL", "MXN", "KRW", "SEK", "AED", "SAR", "ZAR"];
const UNITS = [
  "kilometer", "meter", "centimeter", "mile", "foot", "inch", "kilogram", "gram", "pound", "liter", "milliliter", "gallon",
  "celsius", "fahrenheit", "kilometer-per-hour", "mile-per-hour", "second", "minute", "hour", "day", "byte", "kilobyte", "megabyte", "gigabyte", "percent",
];
const SIGN_OPTIONS = [
  { value: "auto", label: "Auto (negatives only)" },
  { value: "always", label: "Always" },
  { value: "exceptZero", label: "Except zero" },
  { value: "never", label: "Never" },
];

type Opts = Intl.NumberFormatOptions & { [k: string]: unknown };

function buildOptions(s: {
  style: Style;
  currency: string;
  currencyDisplay: string;
  unit: string;
  unitDisplay: string;
  minFrac: string;
  maxFrac: string;
  grouping: boolean;
  sign: string;
}): Opts {
  const o: Opts = {};
  if (s.style === "currency") Object.assign(o, { style: "currency", currency: s.currency, currencyDisplay: s.currencyDisplay });
  else if (s.style === "percent") o.style = "percent";
  else if (s.style === "unit") Object.assign(o, { style: "unit", unit: s.unit, unitDisplay: s.unitDisplay });
  else if (s.style === "compact-short") Object.assign(o, { notation: "compact", compactDisplay: "short" });
  else if (s.style === "compact-long") Object.assign(o, { notation: "compact", compactDisplay: "long" });
  else if (s.style === "scientific") o.notation = "scientific";
  else if (s.style === "engineering") o.notation = "engineering";
  const min = parseNum(s.minFrac);
  const max = parseNum(s.maxFrac);
  if (min !== null) o.minimumFractionDigits = min;
  if (max !== null) o.maximumFractionDigits = max;
  if (!s.grouping) o.useGrouping = false;
  if (s.sign !== "auto") o.signDisplay = s.sign as Intl.NumberFormatOptions["signDisplay"];
  return o;
}

function safeFormat(locale: string, opts: Opts, value: number | bigint): { ok: true; text: string; resolved: string } | { ok: false; error: string } {
  try {
    const f = new Intl.NumberFormat(locale, opts);
    return { ok: true, text: f.format(value), resolved: f.resolvedOptions().locale };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "These options are not supported." };
  }
}

const INITIAL = {
  value: "1234567.891",
  locale: "de-DE",
  custom: "fr-CA",
  style: "currency" as Style,
  currency: "EUR",
  currencyDisplay: "symbol",
  unit: "kilometer-per-hour",
  unitDisplay: "short",
  minFrac: "",
  maxFrac: "",
  grouping: true,
  sign: "auto",
};

export default function Tool() {
  const [s, setS] = useState(INITIAL);
  const set = <K extends keyof typeof INITIAL>(k: K, v: (typeof INITIAL)[K]) => setS((p) => ({ ...p, [k]: v }));
  const d = useDeferredValue(s);

  const raw = d.value.trim().replace(/,/g, "").replace(/_/g, "");
  const isBigInt = /^-?\d{16,}$/.test(raw);
  const n = parseNum(d.value);
  const valueErr = d.value.trim() === "" ? "Enter a number." : n === null ? "Enter a number such as 1234.5 or -0.25." : null;
  const value: number | bigint | null = valueErr ? null : isBigInt ? BigInt(raw) : n;

  const fracErr = (x: string) => {
    if (!x.trim()) return null;
    const v = parseNum(x);
    return v === null || !Number.isInteger(v) || v < 0 || v > 100 ? "Use 0 to 100." : null;
  };
  const minErr = fracErr(d.minFrac);
  const maxErr = fracErr(d.maxFrac);
  const locale = d.locale === "custom" ? d.custom.trim() : d.locale;
  const opts = buildOptions(d);
  const result = value !== null && !minErr && !maxErr && locale ? safeFormat(locale, opts, value) : null;

  const valueLiteral = isBigInt ? `${raw}n` : String(n ?? 0);
  const code = `new Intl.NumberFormat(${JSON.stringify(locale)}, ${JSON.stringify(opts, null, 2)}).format(${valueLiteral});`;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Format a number"
        actions={
          <>
            <CopyBtn text={result?.ok ? result.text : ""} label="Copy result" />
            <ResetBtn onClick={() => setS(INITIAL)} />
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Number"
            hint="Very long whole numbers are formatted exactly; decimals use standard double precision."
            inputMode="decimal"
            autoComplete="off"
            value={s.value}
            onChange={(e) => set("value", e.target.value)}
            error={s.value.trim() ? valueErr : null}
          />
          <SelectField label="Locale" value={s.locale} onChange={(e) => set("locale", e.target.value)} options={LOCALE_OPTIONS} />
          {s.locale === "custom" && (
            <TextField
              label="Locale tag (BCP 47)"
              hint="For example fr-CA, en-AU, th-TH-u-nu-thai or ar-SA-u-nu-latn."
              autoComplete="off"
              spellCheck={false}
              value={s.custom}
              onChange={(e) => set("custom", e.target.value)}
            />
          )}
          <SelectField label="Style" value={s.style} onChange={(e) => set("style", e.target.value as Style)} options={STYLE_OPTIONS} />
          {s.style === "currency" && (
            <>
              <SelectField label="Currency" value={s.currency} onChange={(e) => set("currency", e.target.value)} options={CURRENCY_CODES} />
              <SelectField
                label="Currency display"
                value={s.currencyDisplay}
                onChange={(e) => set("currencyDisplay", e.target.value)}
                options={[
                  { value: "symbol", label: "Symbol (€)" },
                  { value: "narrowSymbol", label: "Narrow symbol" },
                  { value: "code", label: "Code (EUR)" },
                  { value: "name", label: "Name (euros)" },
                ]}
              />
            </>
          )}
          {s.style === "unit" && (
            <>
              <SelectField label="Unit" value={s.unit} onChange={(e) => set("unit", e.target.value)} options={UNITS} />
              <SelectField
                label="Unit display"
                value={s.unitDisplay}
                onChange={(e) => set("unitDisplay", e.target.value)}
                options={[
                  { value: "short", label: "Short (km/h)" },
                  { value: "long", label: "Long (kilometers per hour)" },
                  { value: "narrow", label: "Narrow" },
                ]}
              />
            </>
          )}
          <TextField label="Minimum fraction digits" optional inputMode="numeric" value={s.minFrac} onChange={(e) => set("minFrac", e.target.value)} error={minErr} />
          <TextField label="Maximum fraction digits" optional inputMode="numeric" value={s.maxFrac} onChange={(e) => set("maxFrac", e.target.value)} error={maxErr} />
          <SelectField label="Sign display" value={s.sign} onChange={(e) => set("sign", e.target.value)} options={SIGN_OPTIONS} />
          <div className="flex items-end pb-2">
            <Checkbox label="Use thousands grouping" checked={s.grouping} onChange={(v) => set("grouping", v)} />
          </div>
        </div>

        <div className="mt-6" aria-live="polite">
          {result?.ok ? (
            <div className="rounded-xl bg-accent-soft p-5">
              <p className="text-sm text-ink-2">Formatted for {result.resolved}</p>
              <p className="mt-1 break-all font-display text-[2rem] font-semibold leading-tight text-ink" dir="auto">
                {result.text}
              </p>
            </div>
          ) : result && !result.ok ? (
            <Notice tone="error" title="Your browser rejected these options">
              {result.error}
            </Notice>
          ) : !locale ? (
            <Notice tone="error">Type a locale tag such as fr-CA.</Notice>
          ) : null}
        </div>
      </ToolPanel>

      {value !== null && !minErr && !maxErr && (
        <ToolPanel title="Same options in other locales">
          <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label="Formatted examples by locale">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-2.5 font-medium text-ink">
                    Locale
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-ink">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {LOCALES.map(([tag, name]) => {
                  const r = safeFormat(tag, opts, value);
                  return (
                    <tr key={tag} className={`border-b border-line last:border-0 ${tag === locale ? "bg-accent-soft" : ""}`}>
                      <th scope="row" className="whitespace-nowrap px-4 py-2 font-normal text-ink-2">
                        {name} <span className="text-muted">{tag}</span>
                      </th>
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink" dir="auto">
                        {r.ok ? r.text : "not supported"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ToolPanel>
      )}

      <ToolPanel title="JavaScript" actions={<CopyBtn text={code} label="Copy code" />}>
        <OutputBlock label="Equivalent JavaScript code">{code}</OutputBlock>
        <p className="mt-3 text-[0.8125rem] text-muted">
          Output comes from your browser&apos;s built-in Intl data, so results can differ slightly between browsers and versions (spacing characters especially).
        </p>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
