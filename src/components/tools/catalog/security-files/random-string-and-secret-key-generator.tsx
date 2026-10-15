"use client";

import { useState } from "react";
import { Btn, CopyBtn, EmptyState, NumberField, PrivacyNote, SelectField, TextField, ToolPanel, downloadFile, fmt, parseNum } from "@/components/tools/kit";
import { toBase64, toBase64Url, toHex } from "./lib/encoding";
import { ALNUM, randomBytes, randomFromAlphabet } from "./lib/random";
import { MonoValue } from "./shared";

type Format = "hex" | "base64" | "base64url" | "alnum" | "custom";

const FORMATS: { value: Format; label: string }[] = [
  { value: "hex", label: "Hex (from random bytes)" },
  { value: "base64", label: "Base64 (from random bytes)" },
  { value: "base64url", label: "Base64url, no padding (from random bytes)" },
  { value: "alnum", label: "Alphanumeric (A-Z, a-z, 0-9)" },
  { value: "custom", label: "Custom character set" },
];

const PRESETS: { label: string; format: Format; size: number }[] = [
  { label: "256-bit key (hex)", format: "hex", size: 32 },
  { label: "API token (base64url)", format: "base64url", size: 32 },
  { label: "Session secret (base64)", format: "base64", size: 64 },
  { label: "32-char ID", format: "alnum", size: 32 },
];

const byteFormat = (f: Format) => f === "hex" || f === "base64" || f === "base64url";

export default function Tool() {
  const [format, setFormat] = useState<Format>("hex");
  const [sizeRaw, setSizeRaw] = useState("32");
  const [custom, setCustom] = useState("abcdef0123456789");
  const [countRaw, setCountRaw] = useState("1");
  const [list, setList] = useState<string[]>([]);

  const size = parseNum(sizeRaw);
  const count = parseNum(countRaw);
  const isBytes = byteFormat(format);
  const maxSize = isBytes ? 1024 : 4096;
  const sizeError = size === null || !Number.isInteger(size) || size < 1 || size > maxSize ? `Enter a whole number from 1 to ${maxSize}.` : null;
  const countError = count === null || !Number.isInteger(count) || count < 1 || count > 100 ? "Enter a whole number from 1 to 100." : null;
  const uniqueCustom = new Set(custom).size;
  const customError = format === "custom" && uniqueCustom < 2 ? "Enter at least two different characters." : null;

  const bits =
    size === null || sizeError ? 0 : isBytes ? size * 8 : size * Math.log2(format === "alnum" ? ALNUM.length : Math.max(uniqueCustom, 1));

  const make = (f: Format, n: number) => {
    if (f === "hex") return toHex(randomBytes(n));
    if (f === "base64") return toBase64(randomBytes(n));
    if (f === "base64url") return toBase64Url(randomBytes(n));
    return randomFromAlphabet(f === "alnum" ? ALNUM : custom, n);
  };

  const generate = (f = format, n = size) => {
    if (n === null || count === null || sizeError || countError || customError) return;
    setList(Array.from({ length: count }, () => make(f, n)));
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Random string and secret key generator">
        <div className="mb-5 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Btn
              key={p.label}
              variant="ghost"
              onClick={() => {
                setFormat(p.format);
                setSizeRaw(String(p.size));
                if (count !== null && !countError) setList(Array.from({ length: count }, () => make(p.format, p.size)));
              }}
            >
              {p.label}
            </Btn>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="space-y-5">
            <SelectField label="Format" options={FORMATS} value={format} onChange={(e) => setFormat(e.target.value as Format)} />
            {format === "custom" && (
              <TextField
                label="Characters to use"
                hint={`${uniqueCustom} unique characters. Duplicates are ignored.`}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                error={customError}
                spellCheck={false}
              />
            )}
            <NumberField
              label={isBytes ? "Random bytes" : "Length in characters"}
              hint={isBytes ? "32 bytes = 256 bits, enough for any symmetric key or token." : undefined}
              value={sizeRaw}
              onChange={(e) => setSizeRaw(e.target.value)}
              error={sizeError}
            />
            <NumberField label="How many" value={countRaw} onChange={(e) => setCountRaw(e.target.value)} error={countError} />
            <p className="text-sm text-ink-2">
              Entropy per value: <strong className="tabular-nums text-ink">{fmt(bits, 1)} bits</strong>
            </p>
            <Btn icon="reset" onClick={() => generate()} disabled={!!sizeError || !!countError || !!customError}>
              Generate
            </Btn>
          </div>
          <div className="min-w-0 space-y-3">
            {list.length === 0 ? (
              <EmptyState icon="token" title="Nothing generated yet">
                Pick a preset or set the format and size, then press Generate.
              </EmptyState>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <CopyBtn text={list.join("\n")} label={list.length > 1 ? "Copy all" : "Copy"} />
                  <Btn variant="ghost" icon="download" onClick={() => downloadFile("secrets.txt", list.join("\n"))}>
                    Download .txt
                  </Btn>
                </div>
                <ul className="max-h-[480px] space-y-2 overflow-auto" aria-live="polite">
                  {list.map((s, i) => (
                    <li key={`${i}-${s.slice(0, 16)}`} className="flex items-center gap-2">
                      <MonoValue>{s}</MonoValue>
                      <CopyBtn text={s} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
