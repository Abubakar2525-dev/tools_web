"use client";

import { useId, useMemo, useState } from "react";
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
  SplitGrid,
  StatGrid,
  TextArea,
  ToolPanel,
  fmt,
} from "@/components/tools/kit";

type Mode = "encode" | "decode" | "file";

const MODES: readonly { value: Mode; label: string }[] = [
  { value: "encode", label: "Encode text" },
  { value: "decode", label: "Decode Base64" },
  { value: "file", label: "File to data URI" },
];

const MAX_FILE = 5 * 1024 * 1024;
const PREVIEW_CHARS = 4000;

/* ------------------------------------------------------------------ */
/* Codec                                                               */
/* ------------------------------------------------------------------ */

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function encodeText(text: string, urlSafe: boolean, keepPadding: boolean) {
  let out = bytesToBase64(new TextEncoder().encode(text));
  if (urlSafe) out = out.replace(/\+/g, "-").replace(/\//g, "_");
  if (!keepPadding) out = out.replace(/=+$/, "");
  return out;
}

type DecodeResult =
  | { ok: true; text: string; bytes: number; binary: false; urlSafe: boolean }
  | { ok: true; text: string; bytes: number; binary: true; urlSafe: boolean }
  | { ok: false; error: string };

function describeChar(ch: string) {
  const code = ch.codePointAt(0) ?? 0;
  return /[\x21-\x7e]/.test(ch) ? `"${ch}"` : `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

function decodeBase64(input: string): DecodeResult {
  const clean = input.replace(/\s+/g, "");
  if (!clean) return { ok: false, error: "Nothing to decode." };

  const bad = /[^A-Za-z0-9+/=_-]/.exec(clean);
  if (bad) {
    return {
      ok: false,
      error: `Invalid character ${describeChar(bad[0])} at position ${bad.index + 1} (ignoring whitespace). Base64 only uses A to Z, a to z, 0 to 9, + / (or - _ for URL-safe) and = padding.`,
    };
  }
  if (/[+/]/.test(clean) && /[-_]/.test(clean)) {
    return { ok: false, error: "The input mixes standard (+ /) and URL-safe (- _) characters, so it can't be decoded reliably." };
  }
  const padAt = clean.indexOf("=");
  if (padAt !== -1 && !/^=+$/.test(clean.slice(padAt))) {
    return { ok: false, error: `Padding "=" can only appear at the end, but there is one at position ${padAt + 1}.` };
  }
  const body = clean.replace(/=+$/, "");
  const pad = clean.length - body.length;
  if (pad > 2) return { ok: false, error: "Too much padding. Base64 ends with at most two = characters." };
  if (body.length % 4 === 1) {
    return {
      ok: false,
      error: `Bad length: ${body.length} characters (without padding) can't be valid Base64. The input is probably cut off or has an extra character.`,
    };
  }
  if (pad > 0 && (body.length + pad) % 4 !== 0) {
    return { ok: false, error: "The padding doesn't match the length. Remove the = signs and try again." };
  }

  const urlSafe = /[-_]/.test(body);
  const std = body.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  let bin: string;
  try {
    bin = atob(padded);
  } catch {
    return { ok: false, error: "This isn't valid Base64." };
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, text, bytes: bytes.length, binary: false, urlSafe };
  } catch {
    const shown = bytes.subarray(0, 256);
    const hex = Array.from(shown, (b) => b.toString(16).padStart(2, "0"))
      .join(" ")
      .replace(/((?:\S+ ){16})/g, "$1\n")
      .trim();
    return { ok: true, text: hex, bytes: bytes.length, binary: true, urlSafe };
  }
}

/** Heuristic: does plain-text input look like it's already Base64? */
function looksLikeBase64(input: string) {
  const clean = input.replace(/\s+/g, "");
  if (clean.length < 8 || clean.length % 4 === 1) return false;
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(clean)) return false;
  if (!/[0-9+/=_-]/.test(clean) && !/[A-Z].*[a-z]|[a-z].*[A-Z]/.test(clean)) return false;
  const r = decodeBase64(clean);
  return r.ok && !r.binary && /^[\p{L}\p{N}\p{P}\p{S}\s]*$/u.test(r.text);
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${fmt(n / 1024, 1)} KB`;
  return `${fmt(n / (1024 * 1024), 2)} MB`;
}

const utf8Len = (s: string) => new TextEncoder().encode(s).length;

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

type FileState = { name: string; size: number; type: string; dataUri: string };

export default function Tool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [keepPadding, setKeepPadding] = useState(true);
  const [file, setFile] = useState<FileState | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const fileId = useId();

  const encoded = useMemo(
    () => (mode === "encode" && input ? encodeText(input, urlSafe, keepPadding) : ""),
    [mode, input, urlSafe, keepPadding],
  );
  const decoded = useMemo(() => (mode === "decode" && input.trim() ? decodeBase64(input) : null), [mode, input]);
  const hint = useMemo(() => mode === "encode" && looksLikeBase64(input), [mode, input]);

  const output = mode === "encode" ? encoded : mode === "decode" ? (decoded?.ok && !decoded.binary ? decoded.text : "") : file?.dataUri ?? "";

  const inBytes = mode === "file" ? file?.size ?? 0 : mode === "encode" ? utf8Len(input) : input.replace(/\s+/g, "").length;
  const outBytes =
    mode === "file" ? file?.dataUri.length ?? 0 : mode === "encode" ? encoded.length : decoded?.ok ? decoded.bytes : 0;
  const hasOutput = outBytes > 0;

  const canSwap = (mode === "encode" && encoded !== "") || (mode === "decode" && decoded?.ok === true && !decoded.binary);

  const swap = () => {
    if (!canSwap) return;
    setInput(output);
    setMode(mode === "encode" ? "decode" : "encode");
  };

  const reset = () => {
    setInput("");
    setFile(null);
    setFileError(null);
    setUrlSafe(false);
    setKeepPadding(true);
  };

  const onFile = (f: File | undefined) => {
    setFileError(null);
    setFile(null);
    if (!f) return;
    if (f.size > MAX_FILE) {
      setFileError(`"${f.name}" is ${formatBytes(f.size)}. The limit is 5 MB, because larger data URIs are slow to handle in a browser.`);
      return;
    }
    const reader = new FileReader();
    setReading(true);
    reader.onload = () => {
      setReading(false);
      if (typeof reader.result === "string") {
        setFile({ name: f.name, size: f.size, type: f.type || "application/octet-stream", dataUri: reader.result });
      } else setFileError("Couldn't read that file.");
    };
    reader.onerror = () => {
      setReading(false);
      setFileError("Couldn't read that file. It may have been moved or blocked by the browser.");
    };
    reader.readAsDataURL(f);
  };

  const outputLabel = mode === "encode" ? "Base64 output" : mode === "decode" ? "Decoded text" : "Data URI";

  return (
    <ToolPanel
      title="Base64 encoder and decoder"
      actions={
        <>
          <Btn variant="ghost" icon="arrow" disabled={!canSwap} onClick={swap}>
            Swap input and output
          </Btn>
          <ResetBtn onClick={reset} />
        </>
      }
    >
      <div className="space-y-5">
        <Segmented
          label="Mode"
          value={mode}
          onChange={(m) => {
            setMode(m);
          }}
          options={MODES}
        />

        <SplitGrid>
          <div className="min-w-0 space-y-4">
            {mode === "file" ? (
              <div>
                <label htmlFor={fileId} className="text-sm font-medium text-ink">
                  File
                </label>
                <p id={`${fileId}-hint`} className="mt-1 text-[0.8125rem] text-muted">
                  Up to 5 MB. The file is read in your browser and never uploaded.
                </p>
                <input
                  id={fileId}
                  type="file"
                  aria-describedby={`${fileId}-hint`}
                  aria-invalid={fileError ? true : undefined}
                  onChange={(e) => onFile(e.target.files?.[0])}
                  className="mt-2 block w-full rounded-lg bg-surface p-2 text-sm text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-sunken file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
                />
                {reading && (
                  <p role="status" className="mt-2 text-sm text-muted">
                    Reading file...
                  </p>
                )}
                {fileError && (
                  <div className="mt-3">
                    <Notice tone="error">{fileError}</Notice>
                  </div>
                )}
                {file && (
                  <p className="mt-3 break-all text-sm text-ink-2">
                    {file.name} <span className="text-muted">({file.type}, {formatBytes(file.size)})</span>
                  </p>
                )}
              </div>
            ) : (
              <TextArea
                label={mode === "encode" ? "Text to encode" : "Base64 to decode"}
                hint={
                  mode === "encode"
                    ? "Any text, including emoji and accented letters. It is encoded as UTF-8."
                    : "Whitespace, line breaks and missing padding are fine. URL-safe input is detected."
                }
                mono
                value={input}
                placeholder={mode === "encode" ? "Hello, world" : "SGVsbG8sIHdvcmxk"}
                error={decoded && !decoded.ok ? decoded.error : null}
                onChange={(e) => setInput(e.target.value)}
              />
            )}

            {mode === "encode" && (
              <div className="space-y-3">
                <Checkbox
                  label="URL-safe alphabet"
                  hint="Uses - and _ instead of + and / so the result fits in URLs and file names."
                  checked={urlSafe}
                  onChange={setUrlSafe}
                />
                <Checkbox
                  label="Keep = padding"
                  hint="Many URL-safe formats, such as JWTs, drop the padding."
                  checked={keepPadding}
                  onChange={setKeepPadding}
                />
              </div>
            )}

            {hint && (
              <Notice tone="info" title="This looks like Base64">
                <p>It may already be encoded.</p>
                <Btn variant="ghost" className="mt-2" onClick={() => setMode("decode")}>
                  Decode it instead
                </Btn>
              </Notice>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">{outputLabel}</p>
              <CopyBtn text={output} label={mode === "file" ? "Copy data URI" : "Copy"} />
            </div>

            {mode === "decode" && decoded && !decoded.ok ? (
              <Notice tone="error" title="Couldn't decode">
                {decoded.error}
              </Notice>
            ) : !hasOutput ? (
              <EmptyState icon="binary" title={mode === "file" ? "Choose a file" : "Output appears here"}>
                {mode === "encode"
                  ? "Type or paste text on the left."
                  : mode === "decode"
                    ? "Paste a Base64 string on the left."
                    : "Pick a file up to 5 MB to turn it into a data URI."}
              </EmptyState>
            ) : (
              <>
                {mode === "decode" && decoded?.ok && decoded.binary && (
                  <Notice tone="warning" title="Decoded data isn't UTF-8 text">
                    It looks like binary data (an image, archive or encrypted value). Below is a hex view of the first{" "}
                    {Math.min(256, decoded.bytes)} bytes.
                  </Notice>
                )}
                {mode === "decode" && decoded?.ok && !decoded.binary && (
                  <Notice tone="success">
                    Decoded {formatBytes(decoded.bytes)}
                    {decoded.urlSafe ? " from URL-safe Base64." : "."}
                  </Notice>
                )}
                <OutputBlock label={outputLabel}>
                  <span className="whitespace-pre-wrap break-all">
                    {mode === "decode" && decoded?.ok
                      ? decoded.text
                      : output.length > PREVIEW_CHARS
                        ? `${output.slice(0, PREVIEW_CHARS)}...`
                        : output}
                  </span>
                </OutputBlock>
                {output.length > PREVIEW_CHARS && (
                  <p className="text-[0.8125rem] text-muted">
                    Showing the first {PREVIEW_CHARS.toLocaleString("en-US")} characters. Copy gets the full value.
                  </p>
                )}
              </>
            )}

            <StatGrid
              items={[
                { label: mode === "decode" ? "Input characters" : "Input bytes", value: mode === "decode" ? inBytes.toLocaleString("en-US") : formatBytes(inBytes) },
                { label: "Output bytes", value: formatBytes(outBytes) },
                { label: "Size ratio", value: inBytes > 0 && hasOutput ? `${fmt(outBytes / inBytes, 2)}x` : "-" },
              ]}
            />
          </div>
        </SplitGrid>

        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}
