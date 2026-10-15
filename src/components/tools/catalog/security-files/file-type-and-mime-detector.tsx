"use client";

import { useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ToolPanel, uid } from "@/components/tools/kit";
import { FileDrop, Spinner, formatBytes } from "@/components/tools/engines/files";
import { hex2 } from "./lib/compare";
import { type FileKind, HEAD_BYTES, detect, extensionMatches } from "./lib/magic";
import { errorText } from "./shared";

type Row = { id: string; file: File; kind: FileKind | null; head: string; error?: string };

async function analyze(file: File): Promise<Row> {
  try {
    const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
    const tail = file.size > HEAD_BYTES ? new Uint8Array(await file.slice(Math.max(0, file.size - HEAD_BYTES)).arrayBuffer()) : head;
    return { id: uid(), file, kind: detect(head, tail), head: Array.from(head.subarray(0, 16), hex2).join(" ") };
  } catch (e) {
    return { id: uid(), file, kind: null, head: "", error: errorText(e, "Could not read this file.") };
  }
}

const extOf = (n: string) => /\.([^./\\]+)$/.exec(n)?.[1].toLowerCase() ?? "";

export default function Tool() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const add = async (files: File[]) => {
    setBusy(true);
    const res: Row[] = [];
    for (const f of files) res.push(await analyze(f));
    setRows((r) => [...res, ...r]);
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="File type and MIME detector">
        <div className="space-y-5">
          <FileDrop onFiles={(f) => void add(f)} multiple maxFiles={200} maxSizeMB={16384} hint="Any files. Only the first and last 64 KB of each are read." compact={rows.length > 0} />
          {busy && <Spinner label="Reading signatures" />}
          {rows.length === 0 && !busy ? (
            <EmptyState icon="search" title="No files checked yet">
              The type is identified from the bytes inside the file, not from its name, so renamed or extension-less files are still recognized.
            </EmptyState>
          ) : (
            <>
              {rows.length > 0 && (
                <div className="flex justify-end">
                  <Btn variant="subtle" icon="trash" onClick={() => setRows([])}>
                    Clear results
                  </Btn>
                </div>
              )}
              <ul className="space-y-3" aria-live="polite">
                {rows.map((r) => {
                  const mismatch = r.kind && !extensionMatches(r.file.name, r.kind);
                  return (
                    <li key={r.id} className="rounded-xl bg-sunken p-4 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="min-w-0 break-all font-medium text-ink">{r.file.name}</p>
                        <span className="tabular-nums text-muted">{formatBytes(r.file.size)}</span>
                      </div>
                      {r.error ? (
                        <div className="mt-2">
                          <Notice tone="error">{r.error}</Notice>
                        </div>
                      ) : !r.kind ? (
                        <p className="mt-2 text-ink-2">Empty file: there are no bytes to identify.</p>
                      ) : (
                        <>
                          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                            <div>
                              <dt className="text-muted">Detected type</dt>
                              <dd className="text-ink">{r.kind.name}</dd>
                            </div>
                            <div>
                              <dt className="text-muted">MIME type</dt>
                              <dd className="flex flex-wrap items-center gap-2">
                                <code className="break-all font-mono text-ink">{r.kind.mime}</code>
                                <CopyBtn text={r.kind.mime} />
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted">Usual extensions</dt>
                              <dd className="text-ink">{r.kind.exts.filter(Boolean).map((e) => `.${e}`).join(", ") || "none"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted">Browser-reported type</dt>
                              <dd className="text-ink">{r.file.type || "none (guessed from the name)"}</dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-muted">First 16 bytes</dt>
                              <dd className="break-all font-mono text-ink">{r.head || "(empty)"}</dd>
                            </div>
                          </dl>
                          {r.kind.note && <p className="mt-2 text-[0.8125rem] text-muted">{r.kind.note}</p>}
                          {mismatch && (
                            <div className="mt-3">
                              <Notice tone="warning" title="Extension mismatch">
                                The name ends in {extOf(r.file.name) ? `.${extOf(r.file.name)}` : "no extension"}, but the content looks like {r.kind.name}. Be careful
                                opening files whose name hides their real type.
                              </Notice>
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
