"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, PrivacyNote, TextField, ToolPanel, downloadFile } from "@/components/tools/kit";
import { FileChip, FileDrop, ProgressBar, formatBytes } from "@/components/tools/engines/files";
import { constantTimeEqual, normalizeHash, toHex } from "./lib/encoding";
import { HASH_ALGOS, HASH_HEX_LENGTH, type HashAlgo, hashBlob } from "./lib/hash";
import { errorText, isAbort, useAbortable } from "./shared";

type Result = { key: string; digests: Partial<Record<HashAlgo, string>>; ms: number };

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
const SUM_EXT: Record<HashAlgo, string> = { MD5: "md5", "SHA-1": "sha1", "SHA-256": "sha256", "SHA-384": "sha384", "SHA-512": "sha512" };

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [algos, setAlgos] = useState<HashAlgo[]>(["SHA-256"]);
  const [expected, setExpected] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { start, cancel } = useAbortable();

  const want = normalizeHash(expected);
  const wantHex = /^[0-9a-f]+$/.test(want);
  const guessed = wantHex ? HASH_ALGOS.find((a) => HASH_HEX_LENGTH[a] === want.length) : undefined;
  const expectedError =
    expected.trim() && !wantHex ? "Expected a hexadecimal hash." : expected.trim() && !guessed ? `A ${want.length}-character hash does not match MD5, SHA-1, SHA-256, SHA-384 or SHA-512.` : null;

  const run = async (f: File, list: HashAlgo[]) => {
    const ctl = start();
    setError(null);
    setResult(null);
    setProgress(0);
    const t0 = performance.now();
    try {
      const digests = await hashBlob(f, list, { signal: ctl.signal, onProgress: (d, t) => setProgress(t ? d / t : 1) });
      const hex: Partial<Record<HashAlgo, string>> = {};
      for (const a of list) hex[a] = toHex(digests[a]);
      setResult({ key: fileKey(f), digests: hex, ms: performance.now() - t0 });
    } catch (e) {
      if (!isAbort(e)) setError(errorText(e, "The file could not be read."));
    } finally {
      if (!ctl.signal.aborted) setProgress(null);
    }
  };

  const toRun = guessed && !algos.includes(guessed) ? [...algos, guessed] : algos;
  const current = result && file && result.key === fileKey(file) ? result : null;
  const missing = current ? toRun.filter((a) => !current.digests[a]) : [];
  const verdict = current && guessed && current.digests[guessed] ? constantTimeEqual(current.digests[guessed] as string, want) : null;

  return (
    <div className="space-y-5">
      <ToolPanel title="File checksum calculator and verifier">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="min-w-0 space-y-5">
            {file ? (
              <FileChip
                file={file}
                onRemove={() => {
                  cancel();
                  setFile(null);
                  setResult(null);
                  setProgress(null);
                }}
              />
            ) : (
              <FileDrop
                onFiles={(f) => {
                  setFile(f[0]);
                  void run(f[0], toRun);
                }}
                maxSizeMB={16384}
                hint="Any file type. Large files are read in 4 MB pieces, so size is limited only by time."
              />
            )}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ink">Algorithms</legend>
              {HASH_ALGOS.map((a) => (
                <Checkbox
                  key={a}
                  label={a === "MD5" ? "MD5 (integrity only, not secure)" : a === "SHA-1" ? "SHA-1 (legacy)" : a}
                  checked={algos.includes(a)}
                  onChange={(v) => setAlgos((s) => (v ? HASH_ALGOS.filter((x) => x === a || s.includes(x)) : s.filter((x) => x !== a)))}
                />
              ))}
            </fieldset>
            <TextField
              label="Expected checksum"
              optional
              hint="From the download page or a .sha256 file. The algorithm is detected from its length; case and spaces are ignored."
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              error={expectedError}
              spellCheck={false}
            />
            {file && progress === null && (missing.length > 0 || !current) && toRun.length > 0 && (
              <Btn icon="hash" onClick={() => void run(file, toRun)}>
                Calculate
              </Btn>
            )}
          </div>
          <div className="min-w-0 space-y-4" aria-live="polite">
            {progress !== null ? (
              <div className="space-y-3">
                <ProgressBar value={progress} label={`Hashing ${file ? formatBytes(file.size) : ""}`} />
                <Btn variant="ghost" icon="close" onClick={() => {
                  cancel();
                  setProgress(null);
                }}>
                  Cancel
                </Btn>
              </div>
            ) : error ? (
              <Notice tone="error">{error}</Notice>
            ) : !current ? (
              <EmptyState icon="hash" title="No checksum yet">
                Choose a file. Hashing starts right away and you can cancel at any time.
              </EmptyState>
            ) : (
              <>
                {verdict !== null && (
                  <Notice tone={verdict ? "success" : "error"} title={verdict ? `Verified: ${guessed} matches` : `Mismatch: ${guessed} differs`}>
                    {verdict
                      ? "The file is identical to the one the checksum was made from."
                      : "The file is different from the one the checksum describes. Download it again, or check that you copied the right checksum."}
                  </Notice>
                )}
                {missing.length > 0 && <Notice tone="info">Press Calculate to add {missing.join(", ")}.</Notice>}
                <ul className="space-y-3">
                  {HASH_ALGOS.filter((a) => current.digests[a]).map((a) => {
                    const v = current.digests[a] as string;
                    return (
                      <li key={a} className="rounded-xl bg-sunken p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-ink">{a}</p>
                          <div className="flex gap-2">
                            <CopyBtn text={v} />
                            <Btn
                              variant="ghost"
                              icon="download"
                              onClick={() => file && downloadFile(`${file.name}.${SUM_EXT[a]}`, `${v}  ${file.name}\n`)}
                            >
                              .{SUM_EXT[a]}
                            </Btn>
                          </div>
                        </div>
                        <code className="mt-2 block break-all font-mono text-[0.85rem] text-ink">{v}</code>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[0.8125rem] text-muted">
                  Read {file ? formatBytes(file.size) : ""} in {(current.ms / 1000).toFixed(1)} s. Downloaded checksum files use the
                  <code> sha256sum</code> format and work with <code>sha256sum -c</code>.
                </p>
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
