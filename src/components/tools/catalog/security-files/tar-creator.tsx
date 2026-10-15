"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, SelectField, TextField, ToolPanel, uid } from "@/components/tools/kit";
import { FileDrop, ProgressBar, downloadBlob, formatBytes } from "@/components/tools/engines/files";
import { Icon } from "@/components/ui/Icon";
import { buildTar } from "./lib/tar";
import { errorText, isAbort, nextFrame, useAbortable } from "./shared";

type Item = { id: string; file: File; path: string };

/** Wall-clock time for folder entries (called from event handlers only). */
const currentTime = () => Date.now();

const LEVELS = [
  { value: "1", label: "1 (fastest)" },
  { value: "6", label: "6 (default)" },
  { value: "9", label: "9 (smallest)" },
];

const cleanPath = (p: string) =>
  p
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s && s !== "." && s !== "..")
    .join("/");

/** Gzips a list of blob parts in 1 MB pieces with progress. */
async function gzipParts(parts: (Uint8Array | Blob)[], level: number, mtime: number, signal: AbortSignal, onProgress: (p: number) => void) {
  const { Gzip } = await import("fflate");
  const total = parts.reduce((s, p) => s + (p instanceof Blob ? p.size : p.length), 0);
  const out: Uint8Array[] = [];
  const gz = new Gzip({ level: level as 1 | 6 | 9, mtime }, (chunk) => out.push(chunk));
  let done = 0;
  const CH = 1024 * 1024;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const last = i === parts.length - 1;
    if (p instanceof Blob) {
      for (let off = 0; off < p.size; off += CH) {
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const piece = new Uint8Array(await p.slice(off, Math.min(p.size, off + CH)).arrayBuffer());
        gz.push(piece, last && off + CH >= p.size);
        done += piece.length;
        onProgress(total ? done / total : 1);
      }
      if (p.size === 0 && last) gz.push(new Uint8Array(0), true);
    } else {
      gz.push(p, last);
      done += p.length;
    }
    if (i % 64 === 0) await nextFrame();
  }
  return new Blob(out as BlobPart[], { type: "application/gzip" });
}

export default function Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("archive");
  const [gzip, setGzip] = useState(true);
  const [level, setLevel] = useState("6");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string; input: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { start, cancel } = useAbortable();

  const add = (files: File[]) => {
    setResult(null);
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.path));
      const next = [...prev];
      for (const f of files) {
        let path = cleanPath(f.webkitRelativePath || f.name) || "file";
        let n = 2;
        const base = path;
        while (seen.has(path)) path = base.replace(/(\.[^./]+)?$/, (ext) => ` (${n++})${ext}`);
        seen.add(path);
        next.push({ id: uid(), file: f, path });
      }
      return next;
    });
  };

  const total = items.reduce((s, i) => s + i.file.size, 0);
  const nameError = !name.trim() ? "Enter a file name." : null;

  const create = async () => {
    if (!items.length || nameError) return;
    const ctl = start();
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      // Add directory entries so empty-looking folders keep their structure and modes.
      const dirs = new Set<string>();
      for (const it of items) {
        const segs = it.path.split("/");
        for (let i = 1; i < segs.length; i++) dirs.add(`${segs.slice(0, i).join("/")}/`);
      }
      const now = currentTime();
      const entries = [
        ...[...dirs].sort().map((d) => ({ path: d, directory: true, mtime: now })),
        ...items.map((it) => ({ path: it.path, data: it.file, mtime: it.file.lastModified })),
      ];
      const parts = buildTar(entries);
      const base = name.trim().replace(/\.(tar\.gz|tgz|tar)$/i, "").replace(/[\\/:*?"<>|]/g, "-");
      let blob: Blob;
      if (gzip) blob = await gzipParts(parts, Number(level), now, ctl.signal, setProgress);
      else blob = new Blob(parts as BlobPart[], { type: "application/x-tar" });
      setResult({ blob, name: `${base}.${gzip ? "tar.gz" : "tar"}`, input: total });
    } catch (e) {
      if (!isAbort(e)) setError(errorText(e, "The archive could not be created."));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="TAR creator">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <FileDrop onFiles={add} multiple allowFolders maxFiles={5000} maxSizeMB={4096} hint="Files or a whole folder. Paths are kept in the archive." compact={items.length > 0} />
            {items.length === 0 ? (
              <EmptyState icon="folder" title="No files added">
                Add files or a folder to pack them into a .tar or .tar.gz archive.
              </EmptyState>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
                  <span>
                    {items.length} {items.length === 1 ? "file" : "files"}, {formatBytes(total)}
                  </span>
                  <Btn variant="subtle" icon="trash" onClick={() => { setItems([]); setResult(null); }}>
                    Clear all
                  </Btn>
                </div>
                <ul className="max-h-[360px] space-y-1.5 overflow-auto pr-1">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 rounded-lg bg-sunken px-3 py-2 text-sm">
                      <Icon name="file" size={16} className="shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[0.85rem]" title={it.path}>
                        {it.path}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">{formatBytes(it.file.size)}</span>
                      <button
                        type="button"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink"
                        onClick={() => { setItems((s) => s.filter((x) => x.id !== it.id)); setResult(null); }}
                      >
                        <Icon name="close" size={16} />
                        <span className="sr-only">Remove {it.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            <TextField label="Archive name" value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
            <Checkbox label="Compress with gzip (.tar.gz)" checked={gzip} onChange={setGzip} hint="Plain .tar is instant; gzip makes text and code much smaller." />
            {gzip && <SelectField label="Gzip level" options={LEVELS} value={level} onChange={(e) => setLevel(e.target.value)} />}
            <Btn icon="download" onClick={() => void create()} disabled={!items.length || progress !== null || !!nameError}>
              Create archive
            </Btn>
            <div aria-live="polite" className="space-y-3">
              {progress !== null && (
                <>
                  <ProgressBar value={progress} label={gzip ? "Packing and compressing" : "Packing"} />
                  <Btn variant="ghost" icon="close" onClick={cancel}>
                    Cancel
                  </Btn>
                </>
              )}
              {error && <Notice tone="error">{error}</Notice>}
              {result && (
                <>
                  <Notice tone="success" title="Archive ready">
                    {formatBytes(result.input)} of files, archive is {formatBytes(result.blob.size)}.
                  </Notice>
                  <Btn icon="download" onClick={() => downloadBlob(result.blob, result.name)}>
                    Download {result.name}
                  </Btn>
                </>
              )}
            </div>
            <p className="text-[0.8125rem] text-muted">
              POSIX ustar format with pax headers for long or non-ASCII names. Files get mode 644 and folders 755, owned by uid 0.
            </p>
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
