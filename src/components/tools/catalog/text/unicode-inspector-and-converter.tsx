"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Btn,
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SelectField,
  StatGrid,
  TextArea,
  ToolPanel,
  fmt,
} from "@/components/tools/kit";
import { escapeText, inspect, mixedScriptWords, unescapeText, type EscapeStyle } from "./lib/unicode";
import { INVISIBLE_RE } from "./lib/clean";

const SAMPLE = "Café 👩🏽‍💻 pаypal​.com ‮txt.exe";

type Mode = "escape" | "unescape" | "normalize";

const STYLES: { value: EscapeStyle; label: string }[] = [
  { value: "js", label: "JavaScript / JSON \\uXXXX" },
  { value: "es6", label: "JavaScript \\u{…}" },
  { value: "python", label: "Python \\u / \\U" },
  { value: "html-hex", label: "HTML hex &#x…;" },
  { value: "html-dec", label: "HTML decimal &#…;" },
  { value: "css", label: "CSS \\HEX" },
  { value: "codepoints", label: "Code points U+XXXX" },
];

const FLAG_LABEL: Record<string, string> = {
  invisible: "Invisible",
  bidi: "Bidi control",
  space: "Special space",
  control: "Control",
  confusable: "Look-alike",
  fullwidth: "Fullwidth",
};

export default function Tool() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("escape");
  const [style, setStyle] = useState<EscapeStyle>("js");
  const [onlyNonAscii, setOnlyNonAscii] = useState(true);
  const [form, setForm] = useState<"NFC" | "NFD" | "NFKC" | "NFKD">("NFC");
  const deferred = useDeferredValue(text);

  const info = useMemo(() => (deferred ? inspect(deferred, 3000) : null), [deferred]);
  const mixed = useMemo(() => (deferred ? mixedScriptWords(deferred) : []), [deferred]);
  const flagged = info ? info.graphemes.flatMap((g) => g.codePoints.filter((c) => c.flag && c.flag.kind !== "space" && !(c.cp === 10 || c.cp === 13 || c.cp === 9))) : [];

  const converted = useMemo(() => {
    if (!deferred) return "";
    if (mode === "escape") return escapeText(deferred, style, onlyNonAscii);
    if (mode === "unescape") return unescapeText(deferred);
    return deferred.normalize(form);
  }, [deferred, mode, style, onlyNonAscii, form]);

  const utf8Len = deferred ? new TextEncoder().encode(deferred).length : 0;

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
        <TextArea label="Text to inspect" mono value={text} onChange={(e) => setText(e.target.value)} rows={5} hint="Paste text that looks odd, a suspicious link, or escapes to decode." />
      </ToolPanel>

      <ToolPanel title="Inspector">
        {!info ? (
          <EmptyState icon="search" title="Nothing to inspect">
            Each character, its code point, category and bytes appear here.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <StatGrid
              items={[
                { label: "Graphemes (visible characters)", value: fmt(info.graphemes.length, 0) + (info.truncated ? "+" : "") },
                { label: "Code points", value: fmt(info.totalCodePoints, 0) },
                { label: "UTF-16 units (JS length)", value: fmt(deferred.length, 0) },
                { label: "UTF-8 bytes", value: fmt(utf8Len, 0) },
                { label: "Invisible or bidi", value: fmt((deferred.match(INVISIBLE_RE) ?? []).length, 0) },
                { label: "Flagged characters", value: fmt(flagged.length, 0) },
              ]}
            />
            {flagged.length > 0 && (
              <Notice tone="warning" title="Suspicious characters found">
                {flagged.slice(0, 8).map((c, i) => (
                  <span key={i} className="mr-3 inline-block">
                    <span className="font-mono">{c.hex}</span> {c.flag?.note}
                  </span>
                ))}
                {flagged.length > 8 && <span>and {flagged.length - 8} more.</span>}
              </Notice>
            )}
            {mixed.length > 0 && (
              <Notice tone="warning" title="Mixed scripts">
                These words mix Latin with Cyrillic or Greek letters, a common spoofing trick: <span className="font-mono">{mixed.slice(0, 10).join(", ")}</span>
              </Notice>
            )}
            {info.truncated && <Notice>Showing the first 3,000 code points.</Notice>}
            <div className="max-h-[520px] overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} aria-label="Character table">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">Characters and code points</caption>
                <thead className="sticky top-0 bg-sunken text-ink-2">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">#</th>
                    <th scope="col" className="px-3 py-2 font-medium">Char</th>
                    <th scope="col" className="px-3 py-2 font-medium">Code point</th>
                    <th scope="col" className="px-3 py-2 font-medium">Category</th>
                    <th scope="col" className="px-3 py-2 font-medium">UTF-8</th>
                    <th scope="col" className="px-3 py-2 font-medium">UTF-16</th>
                    <th scope="col" className="px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {info.graphemes.flatMap((g) =>
                    g.codePoints.map((c, j) => (
                      <tr key={`${g.index}-${j}`} className={`border-t border-line ${c.flag && c.flag.kind !== "space" ? "bg-[color-mix(in_oklch,oklch(0.75_0.15_75)_14%,transparent)]" : ""}`}>
                        <td className="px-3 py-1.5 tabular-nums text-muted">{j === 0 ? g.index + 1 : ""}</td>
                        <td className="px-3 py-1.5 font-mono text-base">
                          {j === 0 && g.codePoints.length > 1 ? (
                            <span title="Full grapheme">{g.text}</span>
                          ) : c.flag && ["invisible", "bidi", "control", "space"].includes(c.flag.kind) ? (
                            <span className="text-muted" aria-label="not visible">
                              ⍰
                            </span>
                          ) : j === 0 ? (
                            c.char
                          ) : (
                            <span className="text-muted">↳</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono">{c.hex}</td>
                        <td className="px-3 py-1.5">
                          <span className="font-mono">{c.category.code}</span> {c.category.name}
                          {c.script && <span className="text-muted"> · {c.script}</span>}
                        </td>
                        <td className="px-3 py-1.5 font-mono">{c.utf8}</td>
                        <td className="px-3 py-1.5 font-mono">{c.utf16}</td>
                        <td className="px-3 py-1.5">
                          {c.flag ? (
                            <span>
                              <span className="font-medium">⚠ {FLAG_LABEL[c.flag.kind]}:</span> {c.flag.note}
                            </span>
                          ) : (
                            ""
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ToolPanel>

      <ToolPanel title="Convert" actions={<CopyBtn text={converted} />}>
        <div className="space-y-4">
          <Segmented
            label="Conversion"
            value={mode}
            onChange={setMode}
            options={[
              { value: "escape", label: "Text to escapes" },
              { value: "unescape", label: "Escapes to text" },
              { value: "normalize", label: "Normalize" },
            ]}
          />
          {mode === "escape" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Escape style" value={style} onChange={(e) => setStyle(e.target.value as EscapeStyle)} options={STYLES} />
              <div className="self-end pb-2">
                <Checkbox label="Only escape non-ASCII and control characters" checked={onlyNonAscii} onChange={setOnlyNonAscii} />
              </div>
            </div>
          )}
          {mode === "unescape" && <p className="text-[0.8125rem] text-muted">Decodes \uXXXX (with surrogate pairs), \u{'{…}'}, \UXXXXXXXX, \xHH, U+XXXX, CSS escapes and HTML entities.</p>}
          {mode === "normalize" && (
            <SelectField
              label="Normalization form"
              value={form}
              onChange={(e) => setForm(e.target.value as typeof form)}
              hint="NFC composes (é as one code point), NFD decomposes, the K forms also fold compatibility characters like ﬁ to fi."
              options={["NFC", "NFD", "NFKC", "NFKD"]}
            />
          )}
          <OutputBlock label="Converted text">
            <code>{converted || "Enter text above."}</code>
          </OutputBlock>
          {mode === "normalize" && deferred && (
            <p className="text-[0.8125rem] text-muted">
              {converted === deferred ? "Already in this form." : `Changed: ${Array.from(deferred).length} → ${Array.from(converted).length} code points.`}
            </p>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
