"use client";

import { useState } from "react";
import { Btn, EmptyState, Notice, PrivacyNote, SelectField, TextField, ToolPanel, uid } from "@/components/tools/kit";
import { FileDrop, ProgressBar, downloadBlob, formatBytes } from "@/components/tools/engines/files";
import { Icon } from "@/components/ui/Icon";
import { errorText, isAbort, useAbortable } from "./shared";

type Item = { id: string; file: File; path: string };

const LEVELS = [
  { value: "0", label: "Store only (no compression)" },
  { value: "1", label: "Fastest" },
  { value: "5", label: "Balanced" },
  { value: "9", label: "Smallest" },
];
const ENCRYPTION = [
  { value: "aes", label: "AES-256 (strong; needs 7-Zip, WinRAR, Keka or macOS Archive Utility)" },
  { value: "zipcrypto", label: "ZipCrypto (weak; opens in Windows Explorer)" },
];

const cleanPath = (p: string) =>
  p
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s && s !== "." && s !== "..")
    .join("/");

export default function Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const [level, setLevel] = useState("5");
  const [name, setName] = useState("archive");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [enc, setEnc] = useState("aes");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string; input: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { start, cancel } = useAbortable();

  const add = (files: File[]) => {
    setResult(null);
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.path.toLowerCase()));
      const next = [...prev];
      for (const f of files) {
        let path = cleanPath(f.webkitRelativePath || f.name) || "file";
        let n = 2;
        const base = path;
        while (seen.has(path.toLowerCase())) path = base.replace(/(\.[^./]+)?$/, (ext) => ` (${n++})${ext}`);
        seen.add(path.toLowerCase());
        next.push({ id: uid(), file: f, path });
      }
      return next;
    });
  };

  const total = items.reduce((s, i) => s + i.file.size, 0);
  const confirmError = password && confirm !== password ? "The passwords do not match." : null;
  const nameError = !name.trim() ? "Enter a file name." : null;

  const create = async () => {
    if (!items.length || confirmError || nameError) return;
    const ctl = start();
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const { ZipWriter, BlobWriter, BlobReader } = await import("@zip.js/zip.js");
      const writer = new ZipWriter(new BlobWriter("application/zip"), {
        level: Number(level),
        password: password || undefined,
        encryptionStrength: password && enc === "aes" ? 3 : undefined,
        zipCrypto: password && enc === "zipcrypto" ? true : undefined,
        signal: ctl.signal,
      });
      const perFileProgress = new Array<number>(items.length).fill(0);
      let reportedBytes = 0;
      let cursor = 0;
      let lastUiUpdate = 0;
      const hardwareConcurrency = navigator.hardwareConcurrency || 4;
      const concurrency = Math.min(items.length, total > 1024 * 1024 * 1024 ? 2 : Math.min(4, hardwareConcurrency));
      const report = (index: number, bytes: number, force = false) => {
        reportedBytes += bytes - perFileProgress[index];
        perFileProgress[index] = bytes;
        const now = performance.now();
        if (force || now - lastUiUpdate >= 50) {
          lastUiUpdate = now;
          setProgress(total ? Math.min(1, reportedBytes / total) : 1);
        }
      };

      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          while (cursor < items.length) {
            const index = cursor++;
            const it = items[index];
            if (ctl.signal.aborted) throw new DOMException("Cancelled", "AbortError");
            await writer.add(it.path, new BlobReader(it.file), {
              lastModDate: new Date(it.file.lastModified),
              onprogress: (processed) => report(index, processed),
            });
            report(index, it.file.size, true);
          }
        }),
      );
      const blob = await writer.close();
      const fname = `${name.trim().replace(/\.zip$/i, "").replace(/[\\/:*?"<>|]/g, "-")}.zip`;
      setResult({ blob, name: fname, input: total });
    } catch (e) {
      if (!isAbort(e)) setError(errorText(e, "The ZIP could not be created."));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="ZIP creator">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <FileDrop onFiles={add} multiple allowFolders maxFiles={2000} maxSizeMB={2048} hint="Files or a whole folder. Folder structure is kept inside the ZIP." compact={items.length > 0} />
            {items.length === 0 ? (
              <EmptyState icon="folder" title="No files added">
                Add files or choose a folder. Everything is compressed on your device.
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
                  {items.slice(0, 200).map((it) => (
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
                {items.length > 200 && <p className="text-sm text-muted">Showing the first 200 files. All {items.length} files will be included.</p>}
              </>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            <TextField label="ZIP file name" value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
            <SelectField label="Compression" options={LEVELS} value={level} onChange={(e) => setLevel(e.target.value)} hint="Photos, videos and existing archives barely shrink; Store only is fastest for them." />
            <TextField label="Password" optional type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint="Encrypts file contents. File names stay visible." />
            {password && (
              <>
                <TextField label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={confirmError} autoComplete="new-password" />
                <SelectField label="Encryption" options={ENCRYPTION} value={enc} onChange={(e) => setEnc(e.target.value)} />
              </>
            )}
            <Btn icon="download" onClick={() => void create()} disabled={!items.length || progress !== null || !!confirmError || !!nameError}>
              Create ZIP
            </Btn>
            <div aria-live="polite" className="space-y-3">
              {progress !== null && (
                <>
                  <ProgressBar value={progress} label="Compressing" />
                  <Btn variant="ghost" icon="close" onClick={cancel}>
                    Cancel
                  </Btn>
                </>
              )}
              {error && <Notice tone="error">{error}</Notice>}
              {result && (
                <>
                  <Notice tone="success" title="ZIP ready">
                    {formatBytes(result.input)} in, {formatBytes(result.blob.size)} out
                    {result.input > 0 && result.blob.size < result.input
                      ? ` (${Math.round((1 - result.blob.size / result.input) * 100)}% smaller)`
                      : " (no size saving; the content was already compressed or very small)"}
                    .
                  </Notice>
                  <Btn icon="download" onClick={() => downloadBlob(result.blob, result.name)}>
                    Download {result.name}
                  </Btn>
                </>
              )}
            </div>
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
