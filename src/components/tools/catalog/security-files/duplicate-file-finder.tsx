"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, StatGrid, ToolPanel, downloadFile, uid } from "@/components/tools/kit";
import { FileDrop, ProgressBar, formatBytes } from "@/components/tools/engines/files";
import { toHex } from "./lib/encoding";
import { hashBlob } from "./lib/hash";
import { toCsv } from "./lib/names";
import { errorText, isAbort, useAbortable } from "./shared";

type Item = { id: string; file: File; path: string };
type Group = { hash: string; size: number; files: Item[] };
type Report = { key: string; groups: Group[]; hashedBytes: number; scanned: number };

const SMALL = 64 * 1024 * 1024;

const keyOf = (items: Item[], ignoreEmpty: boolean) => `${ignoreEmpty}|${items.map((i) => i.id).join(",")}`;

export default function Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const [ignoreEmpty, setIgnoreEmpty] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { start, cancel } = useAbortable();

  const add = (files: File[]) => {
    setItems((prev) => {
      // Skip exact re-adds of the same file object (same path, size and date).
      const seen = new Set(prev.map((i) => `${i.path}|${i.file.size}|${i.file.lastModified}`));
      const next = [...prev];
      for (const f of files) {
        const path = f.webkitRelativePath || f.name;
        const k = `${path}|${f.size}|${f.lastModified}`;
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ id: uid(), file: f, path });
      }
      return next;
    });
  };

  const scan = async () => {
    const ctl = start();
    setError(null);
    setReport(null);
    setProgress(0);
    try {
      // Step 1: only files that share a size can be identical.
      const bySize = new Map<number, Item[]>();
      for (const it of items) {
        if (ignoreEmpty && it.file.size === 0) continue;
        const list = bySize.get(it.file.size) ?? [];
        list.push(it);
        bySize.set(it.file.size, list);
      }
      const candidates = [...bySize.values()].filter((l) => l.length > 1).flat();
      const total = candidates.reduce((s, i) => s + i.file.size, 0);
      // Step 2: SHA-256 of each candidate.
      const byHash = new Map<string, Item[]>();
      let done = 0;
      for (const it of candidates) {
        let digest: Uint8Array;
        if (it.file.size <= SMALL) {
          // Native WebCrypto is much faster for files that fit comfortably in memory.
          digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await it.file.arrayBuffer()));
          if (ctl.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        } else {
          const r = await hashBlob(it.file, ["SHA-256"], {
            signal: ctl.signal,
            onProgress: (d) => setProgress(total ? (done + d) / total : 1),
          });
          digest = r["SHA-256"];
        }
        done += it.file.size;
        setProgress(total ? done / total : 1);
        const h = `${it.file.size}:${toHex(digest)}`;
        const list = byHash.get(h) ?? [];
        list.push(it);
        byHash.set(h, list);
      }
      const groups = [...byHash.entries()]
        .filter(([, l]) => l.length > 1)
        .map(([h, l]) => ({ hash: h.split(":")[1], size: l[0].file.size, files: l }))
        .sort((a, b) => b.size * (b.files.length - 1) - a.size * (a.files.length - 1));
      setReport({ key: keyOf(items, ignoreEmpty), groups, hashedBytes: total, scanned: items.length });
    } catch (e) {
      if (!isAbort(e)) setError(errorText(e, "A file could not be read."));
    } finally {
      setProgress(null);
    }
  };

  const current = report && report.key === keyOf(items, ignoreEmpty) ? report : null;
  const wasted = current ? current.groups.reduce((s, g) => s + g.size * (g.files.length - 1), 0) : 0;
  const dupFiles = current ? current.groups.reduce((s, g) => s + g.files.length - 1, 0) : 0;

  const csv = () =>
    toCsv([
      ["group", "sha256", "size_bytes", "path", "last_modified"],
      ...(current?.groups ?? []).flatMap((g, gi) => g.files.map((f) => [String(gi + 1), g.hash, String(g.size), f.path, new Date(f.file.lastModified).toISOString()])),
    ]);

  return (
    <div className="space-y-5">
      <ToolPanel title="Duplicate file finder">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="min-w-0 space-y-4">
            <FileDrop onFiles={add} multiple allowFolders maxFiles={10000} maxSizeMB={4096} hint="Add files or whole folders. Nothing is uploaded." compact={items.length > 0} />
            {items.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
                <span>
                  {items.length.toLocaleString("en-US")} files, {formatBytes(items.reduce((s, i) => s + i.file.size, 0))}
                </span>
                <Btn variant="subtle" icon="trash" onClick={() => { cancel(); setItems([]); setReport(null); }}>
                  Clear
                </Btn>
              </div>
            )}
            <Checkbox label="Ignore empty files" checked={ignoreEmpty} onChange={setIgnoreEmpty} hint="Every empty file is identical to every other one." />
            <Btn icon="search" onClick={() => void scan()} disabled={items.length < 2 || progress !== null}>
              Find duplicates
            </Btn>
            <p className="text-[0.8125rem] text-muted">
              Files are grouped by size first; only same-size files are read and hashed with SHA-256. Matching hashes mean identical contents,
              whatever the names.
            </p>
          </div>
          <div className="min-w-0 space-y-4" aria-live="polite">
            {progress !== null ? (
              <>
                <ProgressBar value={progress} label="Hashing same-size files" />
                <Btn variant="ghost" icon="close" onClick={cancel}>
                  Cancel
                </Btn>
              </>
            ) : error ? (
              <Notice tone="error">{error}</Notice>
            ) : !current ? (
              <EmptyState icon="copy" title={items.length < 2 ? "Add at least two files" : "Ready to scan"}>
                The report lists each set of identical files and how much space the extra copies use.
              </EmptyState>
            ) : (
              <>
                <StatGrid
                  items={[
                    { label: "Files scanned", value: current.scanned.toLocaleString("en-US") },
                    { label: "Duplicate sets", value: current.groups.length.toLocaleString("en-US") },
                    { label: "Extra copies", value: dupFiles.toLocaleString("en-US") },
                    { label: "Wasted space", value: formatBytes(wasted) },
                    { label: "Data hashed", value: formatBytes(current.hashedBytes) },
                  ]}
                />
                {current.groups.length === 0 ? (
                  <Notice tone="success">No duplicates. Every file has unique contents.</Notice>
                ) : (
                  <>
                    <Btn variant="ghost" icon="download" onClick={() => downloadFile("duplicates.csv", csv(), "text/csv")}>
                      Download CSV report
                    </Btn>
                    <ol className="max-h-[560px] space-y-3 overflow-auto pr-1">
                      {current.groups.map((g, gi) => (
                        <li key={g.hash} className="rounded-xl bg-sunken p-4 text-sm">
                          <p className="font-medium text-ink">
                            Set {gi + 1}: {g.files.length} copies of {formatBytes(g.size)}
                            <span className="font-normal text-ink-2"> ({formatBytes(g.size * (g.files.length - 1))} reclaimable)</span>
                          </p>
                          <p className="mt-1 break-all font-mono text-[0.78rem] text-muted">SHA-256 {g.hash}</p>
                          <ul className="mt-2 space-y-1">
                            {g.files.map((f) => (
                              <li key={f.id} className="break-all font-mono text-[0.85rem] text-ink">
                                {f.path}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
