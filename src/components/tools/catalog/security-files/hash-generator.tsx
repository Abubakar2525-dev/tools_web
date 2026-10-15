"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { Checkbox, CopyBtn, EmptyState, Notice, PrivacyNote, Segmented, TextArea, TextField, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, formatBytes } from "@/components/tools/engines/files";
import { constantTimeEqual, fromHex, normalizeHash, toBase64, toHex, utf8 } from "./lib/encoding";
import { HASH_ALGOS, type HashAlgo, hashBlob, hmac } from "./lib/hash";
import { errorText, useAbortable } from "./shared";

type Source = "text" | "file";
type Out = "hex" | "HEX" | "base64";
type Digests = Record<HashAlgo, Uint8Array>;

const SUBTLE: Partial<Record<HashAlgo, string>> = { "SHA-1": "SHA-1", "SHA-256": "SHA-256", "SHA-384": "SHA-384", "SHA-512": "SHA-512" };
const WEAK: Partial<Record<HashAlgo, string>> = { MD5: "Not secure: collisions are trivial", "SHA-1": "Not collision resistant" };

async function digestAll(data: Uint8Array<ArrayBuffer>, key: Uint8Array<ArrayBuffer> | null): Promise<Digests> {
  const out = {} as Digests;
  for (const a of HASH_ALGOS) {
    const name = SUBTLE[a];
    if (!name) {
      out[a] = key ? hmac(a, key, data) : (await hashBlob(new Blob([data]), [a]))[a];
      continue;
    }
    if (key) {
      // An empty HMAC key is valid per RFC 2104, but WebCrypto rejects it; use our implementation then.
      if (key.length === 0) out[a] = hmac(a, key, data);
      else {
        const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: name }, false, ["sign"]);
        out[a] = new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
      }
    } else out[a] = new Uint8Array(await crypto.subtle.digest(name, data));
  }
  return out;
}

function encode(b: Uint8Array, o: Out) {
  if (o === "base64") return toBase64(b);
  const h = toHex(b);
  return o === "HEX" ? h.toUpperCase() : h;
}

export default function Tool() {
  const [source, setSource] = useState<Source>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [out, setOut] = useState<Out>("hex");
  const [useHmac, setUseHmac] = useState(false);
  const [key, setKey] = useState("");
  const [keyHex, setKeyHex] = useState(false);
  const [expected, setExpected] = useState("");
  const [state, setState] = useState<{ id: string; digests: Digests } | { id: string; error: string } | null>(null);
  const { start } = useAbortable();

  const dText = useDeferredValue(text);
  const dKey = useDeferredValue(key);

  let keyBytes: Uint8Array<ArrayBuffer> | null = null;
  let keyError: string | null = null;
  if (useHmac) {
    try {
      keyBytes = keyHex ? (fromHex(dKey) as Uint8Array<ArrayBuffer>) : utf8(dKey);
    } catch (e) {
      keyError = errorText(e);
    }
  }

  const hasInput = source === "text" ? dText.length > 0 : !!file;
  const id = `${source}|${source === "text" ? dText : file ? `${file.name}:${file.size}:${file.lastModified}` : ""}|${useHmac ? `${keyHex}:${dKey}` : "-"}`;

  useEffect(() => {
    if (!hasInput || keyError) return;
    const ctl = start();
    const run = async () => {
      const data = source === "text" ? utf8(dText) : new Uint8Array(await (file as File).arrayBuffer());
      if (ctl.signal.aborted) return;
      const digests = await digestAll(data, keyBytes);
      if (!ctl.signal.aborted) setState({ id, digests });
    };
    run().catch((e) => !ctl.signal.aborted && setState({ id, error: errorText(e, "Hashing failed.") }));
    // keyBytes is derived from dKey/keyHex, which are part of id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hasInput, keyError, start]);

  const current = state && state.id === id ? state : null;
  const want = normalizeHash(expected);
  let match: HashAlgo | null = null;
  if (current && "digests" in current && want) {
    for (const a of HASH_ALGOS) {
      const d = current.digests[a];
      if (constantTimeEqual(toHex(d), want) || constantTimeEqual(toBase64(d), expected.trim())) match = a;
    }
  }

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Hash generator"
        actions={
          <Segmented
            label="Input"
            value={source}
            onChange={setSource}
            options={[
              { value: "text", label: "Text" },
              { value: "file", label: "File" },
            ]}
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="min-w-0 space-y-5">
            {source === "text" ? (
              <TextArea label="Text" hint="Hashed as UTF-8 bytes, exactly as typed (including spaces and line breaks)." mono rows={8} value={text} onChange={(e) => setText(e.target.value)} />
            ) : file ? (
              <FileChip file={file} onRemove={() => setFile(null)} />
            ) : (
              <FileDrop onFiles={(f) => setFile(f[0])} maxSizeMB={512} hint="Any file up to 512 MB. For bigger files use the checksum tool." />
            )}
            <Checkbox label="HMAC (keyed hash)" checked={useHmac} onChange={setUseHmac} hint="Proves the data came from someone who knows the key." />
            {useHmac && (
              <div className="space-y-3">
                <TextField label="Secret key" value={key} onChange={(e) => setKey(e.target.value)} error={keyError} autoComplete="off" spellCheck={false} />
                <Checkbox label="Key is hexadecimal" checked={keyHex} onChange={setKeyHex} />
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Output format</p>
              <Segmented
                label="Output format"
                value={out}
                onChange={setOut}
                options={[
                  { value: "hex", label: "hex" },
                  { value: "HEX", label: "HEX" },
                  { value: "base64", label: "Base64" },
                ]}
              />
            </div>
            <TextField
              label="Compare with an expected hash"
              optional
              hint="Paste a hex or Base64 digest. Case and surrounding spaces are ignored."
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="min-w-0 space-y-4" aria-live="polite">
            {!hasInput ? (
              <EmptyState icon="hash" title="Nothing to hash yet">
                {source === "text" ? "Type or paste text. Digests update as you type." : "Choose a file to compute all digests at once."}
              </EmptyState>
            ) : keyError ? (
              <Notice tone="error">{keyError}</Notice>
            ) : !current ? (
              <Spinner label={file && source === "file" ? `Hashing ${formatBytes(file.size)}` : "Hashing"} />
            ) : "error" in current ? (
              <Notice tone="error">{current.error}</Notice>
            ) : (
              <>
                {want && (
                  <Notice tone={match ? "success" : "error"} title={match ? `Match: ${match}${useHmac ? " HMAC" : ""}` : "No match"}>
                    {match ? "The expected value equals this digest." : "The expected value does not equal any digest below. Check the algorithm, the exact input and the HMAC key."}
                  </Notice>
                )}
                <ul className="space-y-3">
                  {HASH_ALGOS.map((a) => {
                    const v = encode(current.digests[a], out);
                    return (
                      <li key={a} className={`rounded-xl p-4 ${match === a ? "bg-accent-soft" : "bg-sunken"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-ink">
                            {useHmac ? `HMAC-${a}` : a}
                            {match === a && <span className="ml-2 text-accent-strong">(matches)</span>}
                            {WEAK[a] && <span className="ml-2 font-normal text-muted">{WEAK[a]}</span>}
                          </p>
                          <CopyBtn text={v} />
                        </div>
                        <code className="mt-2 block break-all font-mono text-[0.85rem] text-ink">{v}</code>
                      </li>
                    );
                  })}
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
