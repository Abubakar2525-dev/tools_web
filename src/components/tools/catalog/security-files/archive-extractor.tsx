"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, EmptyState, Notice, PrivacyNote, TextField, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, ProgressBar, Spinner, downloadBlob, formatBytes, zipFiles } from "@/components/tools/engines/files";
import { VENDOR } from "@/components/tools/engines/pdf";
import { gunzipName, isGzip, parseGzipHeader } from "./lib/gzip";
import { readTar } from "./lib/tar";
import { TableWrap, errorText, tdCls, thCls } from "./shared";

type Backend = "zip" | "memory" | "libarchive";

type Row = {
  path: string;
  size: number;
  date: number | null;
  encrypted: boolean;
  /** Returns the file's contents. */
  get: (password: string) => Promise<Blob>;
};

type Loaded = {
  backend: Backend;
  rows: Row[];
  encrypted: boolean | null;
  close: () => void;
  /** Optional bulk extraction step (libarchive extracts everything in one pass). */
  prepareAll?: (password: string) => Promise<void>;
};

type CompressedLike = { name: string; size: number; lastModified: number; extract: () => Promise<File> };
type LibArchiveReader = {
  hasEncryptedData(): Promise<boolean | null>;
  usePassword(p: string): Promise<void>;
  getFilesArray(): Promise<{ file: CompressedLike | File; path: string }[]>;
  extractFiles(): Promise<unknown>;
  close(): Promise<void>;
};

const MAX_MB = 2048;
const WARN_MB = 500;

const ZIP_MAGIC = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05) && (b[3] === 0x04 || b[3] === 0x06);
const TAR_MAGIC = (b: Uint8Array) => b.length > 262 && String.fromCharCode(...b.subarray(257, 262)) === "ustar";

function friendly(e: unknown) {
  const m = errorText(e, "This archive could not be read.");
  if (/password|passphrase|decrypt/i.test(m)) return "Wrong or missing password. Enter the archive password and try again.";
  if (/not recognized|unrecognized|format/i.test(m)) return "This file is not a supported archive, or it is damaged.";
  return m;
}

async function openZip(file: File): Promise<Loaded> {
  const { ZipReader, BlobReader, BlobWriter } = await import("@zip.js/zip.js");
  const reader = new ZipReader(new BlobReader(file));
  const entries = await reader.getEntries();
  const rows: Row[] = [];
  for (const e of entries) {
    if (e.directory) continue;
    rows.push({
      path: e.filename,
      size: e.uncompressedSize,
      date: e.lastModDate ? e.lastModDate.getTime() : null,
      encrypted: e.encrypted,
      get: (password) => e.getData(new BlobWriter(), { password: e.encrypted ? password : undefined }),
    });
  }
  return { backend: "zip", rows, encrypted: rows.some((r) => r.encrypted), close: () => void reader.close() };
}

async function openMemory(file: File, head: Uint8Array): Promise<Loaded> {
  let bytes = new Uint8Array(await file.arrayBuffer());
  let gzName: string | null = null;
  if (isGzip(head)) {
    const { gunzipSync } = await import("fflate");
    gzName = gunzipName(file.name, parseGzipHeader(head));
    bytes = gunzipSync(bytes);
  }
  if (TAR_MAGIC(bytes)) {
    const rows: Row[] = readTar(bytes)
      .filter((e) => e.type === "0" || e.type === "\0" || e.type === "7")
      .map((e) => ({ path: e.path, size: e.size, date: e.mtime || null, encrypted: false, get: async () => new Blob([e.data.slice()]) }));
    return { backend: "memory", rows, encrypted: false, close: () => undefined };
  }
  const data = bytes;
  return {
    backend: "memory",
    rows: [{ path: gzName ?? file.name, size: data.length, date: null, encrypted: false, get: async () => new Blob([data]) }],
    encrypted: false,
    close: () => undefined,
  };
}

async function openLibarchive(file: File): Promise<Loaded> {
  const { Archive } = await import("libarchive.js");
  Archive.init({ workerUrl: VENDOR.libarchiveWorker });
  const reader = (await Archive.open(file)) as unknown as LibArchiveReader;
  const encrypted = await reader.hasEncryptedData().catch(() => null);
  const list = await reader.getFilesArray();
  let all: Map<string, File> | null = null;
  let passwordSet: string | null = null;
  const setPw = async (pw: string) => {
    if (pw && pw !== passwordSet) {
      await reader.usePassword(pw);
      passwordSet = pw;
    }
  };
  const rows: Row[] = list.map(({ file: f, path }) => {
    const full = `${path}${f.name}`;
    return {
      path: full,
      size: f.size,
      date: f.lastModified ? f.lastModified : null,
      encrypted: !!encrypted,
      get: async (pw) => {
        if (all) {
          const hit = all.get(full);
          if (hit) return hit;
        }
        await setPw(pw);
        return (f as CompressedLike).extract();
      },
    };
  });
  return {
    backend: "libarchive",
    rows,
    encrypted,
    close: () => void reader.close(),
    prepareAll: async (pw: string) => {
      if (all) return;
      await setPw(pw);
      await reader.extractFiles();
      const done = await reader.getFilesArray();
      all = new Map(done.filter((d) => d.file instanceof File).map((d) => [`${d.path}${d.file.name}`, d.file as File]));
    },
  };
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const loadedRef = useRef<Loaded | null>(null);

  useEffect(() => () => loadedRef.current?.close(), []);

  const open = async (f: File) => {
    loadedRef.current?.close();
    loadedRef.current = null;
    setFile(f);
    setLoaded(null);
    setError(null);
    setOpening(true);
    try {
      const head = new Uint8Array(await f.slice(0, 1024).arrayBuffer());
      const l = ZIP_MAGIC(head) ? await openZip(f) : isGzip(head) || TAR_MAGIC(head) ? await openMemory(f, head) : await openLibarchive(f);
      loadedRef.current = l;
      setLoaded(l);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setOpening(false);
    }
  };

  const extractOne = async (r: Row) => {
    setBusy(r.path);
    setError(null);
    try {
      const blob = await r.get(password);
      downloadBlob(blob, r.path.split("/").pop() || "file");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(null);
    }
  };

  const extractAll = async () => {
    if (!loaded || !file) return;
    setBusy("*");
    setError(null);
    setProgress(0);
    try {
      const out: { name: string; data: Blob }[] = [];
      if (loaded.prepareAll) await loaded.prepareAll(password);
      for (let i = 0; i < loaded.rows.length; i++) {
        const r = loaded.rows[i];
        out.push({ name: r.path, data: await r.get(password) });
        setProgress((i + 1) / loaded.rows.length / 2);
      }
      const zip = await zipFiles(out, 0);
      setProgress(1);
      downloadBlob(zip, `${file.name.replace(/\.(zip|7z|rar|tar|tgz|gz|bz2|xz|tbz2|txz|tar\.\w+)$/i, "")}-extracted.zip`);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const totalSize = loaded?.rows.reduce((s, r) => s + r.size, 0) ?? 0;

  return (
    <div className="space-y-5">
      <ToolPanel title="Archive extractor">
        <div className="space-y-5">
          {file ? (
            <FileChip
              file={file}
              onRemove={() => {
                loadedRef.current?.close();
                loadedRef.current = null;
                setFile(null);
                setLoaded(null);
                setError(null);
              }}
            />
          ) : (
            <FileDrop
              onFiles={(f) => void open(f[0])}
              accept=".zip,.7z,.rar,.tar,.gz,.tgz,.bz2,.tbz2,.xz,.txz,.jar,.apk,.epub,.docx,.xlsx,.pptx,.odt,.cab,.iso,.cpio,.lzma,.zst,application/zip,application/x-7z-compressed,application/gzip"
              maxSizeMB={MAX_MB}
              hint="ZIP, 7z, RAR, TAR, GZ, BZ2, XZ and more. Up to 2 GB."
            />
          )}
          {file && file.size > WARN_MB * 1024 * 1024 && (
            <Notice tone="warning">Large archive. Extraction happens in memory, so a big file may be slow or fail on devices with little RAM.</Notice>
          )}
          {opening && <Spinner label="Reading the archive" />}
          {error && <Notice tone="error">{error}</Notice>}
          {!file && !opening && (
            <EmptyState icon="folder" title="No archive opened">
              The file list appears first. Then download single files or everything as one ZIP.
            </EmptyState>
          )}
          {loaded && (
            <>
              {(loaded.encrypted || loaded.encrypted === null) && (
                <div className="max-w-md">
                  <TextField
                    label="Archive password"
                    optional={!loaded.encrypted}
                    hint={loaded.encrypted ? "Some files are encrypted. Enter the password before extracting." : "Encryption could not be detected for this format. Enter a password only if extraction asks for one."}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              )}
              {totalSize > 2 * 1024 * 1024 * 1024 && (
                <Notice tone="warning">The archive expands to {formatBytes(totalSize)}. Extracting everything at once may run out of memory; download single files instead.</Notice>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Btn icon="download" onClick={() => void extractAll()} disabled={!!busy || loaded.rows.length === 0}>
                  Extract all as ZIP
                </Btn>
                <span className="text-sm text-ink-2">
                  {loaded.rows.length} {loaded.rows.length === 1 ? "file" : "files"}, {formatBytes(totalSize)} uncompressed
                </span>
              </div>
              {progress !== null && <ProgressBar value={progress} label="Extracting" />}
              {loaded.rows.length === 0 ? (
                <EmptyState icon="folder" title="This archive has no files" />
              ) : (
                <TableWrap label="Archive contents">
                  <thead>
                    <tr>
                      <th className={thCls}>Path</th>
                      <th className={`${thCls} text-right`}>Size</th>
                      <th className={thCls}>Modified</th>
                      <th className={thCls}>
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loaded.rows.map((r) => (
                      <tr key={r.path}>
                        <td className={`${tdCls} break-all font-mono text-[0.85rem]`}>
                          {r.path}
                          {r.encrypted && <span className="ml-2 font-sans text-[0.8125rem] text-muted">(encrypted)</span>}
                        </td>
                        <td className={`${tdCls} whitespace-nowrap text-right tabular-nums`}>{formatBytes(r.size)}</td>
                        <td className={`${tdCls} whitespace-nowrap text-ink-2`}>{r.date ? new Date(r.date).toLocaleDateString() : "-"}</td>
                        <td className={`${tdCls} text-right`}>
                          <Btn variant="ghost" icon="download" onClick={() => void extractOne(r)} disabled={!!busy} aria-label={`Download ${r.path}`}>
                            {busy === r.path ? "Working" : "Save"}
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
