"use client";

import { useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, NumberField, PrivacyNote, SelectField, TextField, ToolPanel, downloadFile, parseNum } from "@/components/tools/kit";
import { cryptoInt, generateUsernames, type NumberStyle, type UsernameStyle } from "./lib/generators";

export default function Tool() {
  const [style, setStyle] = useState<UsernameStyle>("pascal");
  const [numbers, setNumbers] = useState<NumberStyle>("2");
  const [minLen, setMinLen] = useState("6");
  const [maxLen, setMaxLen] = useState("16");
  const [count, setCount] = useState("12");
  const [keyword, setKeyword] = useState("");
  const [position, setPosition] = useState<"start" | "end">("start");
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const min = parseNum(minLen);
  const max = parseNum(maxLen);
  const n = parseNum(count);
  const minErr = min === null || !Number.isInteger(min) || min < 3 || min > 40 ? "3 to 40" : null;
  const maxErr = max === null || !Number.isInteger(max) || max < 3 || max > 40 ? "3 to 40" : min !== null && max < min ? "At least the minimum" : null;
  const nErr = n === null || !Number.isInteger(n) || n < 1 || n > 100 ? "1 to 100" : null;
  const kwErr = keyword && !/^[a-zA-Z0-9]{1,20}$/.test(keyword) ? "Letters and digits only, up to 20." : null;
  const invalid = !!(minErr || maxErr || nErr || kwErr);

  const generate = () => {
    if (invalid) return;
    const r = generateUsernames(n as number, { style, numbers, minLength: min as number, maxLength: max as number, keyword, keywordPosition: position }, cryptoInt);
    setNames(r.names);
    setError(r.error ?? null);
  };

  const list = names.join("\n");

  return (
    <div className="space-y-5">
      <ToolPanel title="Username options">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="Style"
              value={style}
              onChange={(e) => setStyle(e.target.value as UsernameStyle)}
              options={[
                { value: "pascal", label: "PascalCase (SwiftOtter)" },
                { value: "camel", label: "camelCase (swiftOtter)" },
                { value: "lower", label: "lowercase (swiftotter)" },
                { value: "snake", label: "Underscore (swift_otter)" },
                { value: "dot", label: "Dot (swift.otter)" },
                { value: "dash", label: "Dash (swift-otter)" },
              ]}
            />
            <SelectField
              label="Numbers"
              value={numbers}
              onChange={(e) => setNumbers(e.target.value as NumberStyle)}
              options={[
                { value: "none", label: "No numbers" },
                { value: "2", label: "2 digits" },
                { value: "3", label: "3 digits" },
                { value: "4", label: "4 digits" },
              ]}
            />
            <NumberField label="How many" value={count} onChange={(e) => setCount(e.target.value)} error={nErr} />
            <NumberField label="Minimum length" value={minLen} onChange={(e) => setMinLen(e.target.value)} error={minErr} />
            <NumberField label="Maximum length" value={maxLen} onChange={(e) => setMaxLen(e.target.value)} error={maxErr} />
            <TextField label="Include a word" optional placeholder="e.g. maya" value={keyword} onChange={(e) => setKeyword(e.target.value.trim())} error={kwErr} />
            {keyword && (
              <SelectField
                label="Word position"
                value={position}
                onChange={(e) => setPosition(e.target.value as "start" | "end")}
                options={[
                  { value: "start", label: "Start (maya + noun)" },
                  { value: "end", label: "End (adjective + maya)" },
                ]}
              />
            )}
          </div>
          <Btn icon="spark" onClick={generate} disabled={invalid}>
            {names.length ? "Generate again" : "Generate usernames"}
          </Btn>
        </div>
      </ToolPanel>
      <ToolPanel
        title="Usernames"
        actions={
          <>
            <Btn variant="ghost" icon="download" disabled={!list} onClick={() => downloadFile("usernames.txt", list)}>
              Download
            </Btn>
            <CopyBtn text={list} label="Copy all" />
          </>
        }
      >
        {error && (
          <div className="mb-4">
            <Notice tone="warning">{error}</Notice>
          </div>
        )}
        {!names.length ? (
          <EmptyState icon="pen" title="No usernames yet">
            Choose a style and press Generate.
          </EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
            {names.map((u) => (
              <li key={u} className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-sunken px-3 py-1.5">
                <span className="break-all font-mono text-[0.95rem]">{u}</span>
                <CopyBtn text={u} label="Copy" />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[0.8125rem] text-muted">
          Generated with your browser&apos;s cryptographic random source and filtered against a list of offensive words. Check availability on the site you plan to use.
        </p>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
