"use client";

import { useState } from "react";
import { Btn, EmptyState, Notice, PrivacyNote, Segmented, SelectField, StatGrid, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, ProgressBar, downloadBlob, formatBytes } from "@/components/tools/engines/files";
import { gunzipName, isGzip, parseGzipHeader } from "./lib/gzip";
import { errorText, isAbort, nextFrame, useAbortable } from "./shared";

type Mode = "compress" | "decompress";
type Result = { blob: Blob; name: string; inSize: number; outSize: number; mode: Mode };

const LEVELS = [
  { value: "1", label: "1 (fastest)" },
  { value: "3", label: "3" },
  { value: "6", label: "6 (default)" },
  { value: "9", label: "9 (smallest)" },
];

const CHUNK = 1024 * 1024;

async function stream(
  file: File,
  mode: Mode,
  level: number,
  signal: AbortSignal,
  onProgress: (p: number) => void,
): Promise<Uint8Array[]> {
  const { Gzip, Gunzip } = await import("fflate");
  const out: Uint8Array[] = [];
  const sink = (chunk: Uint8Array) => {
    out.push(chunk);
  };
  const z =
    mode === "compress"
      ? new Gzip({ level: level as 1 | 3 | 6 | 9, mtime: file.lastModified, filename: file.name }, sink)
      : new Gunzip(sink);
  if (file.size === 0) z.push(new Uint8Array(0), true);
  for (let off = 0; off < file.size; off += CHUNK) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const piece = new Uint8Array(await file.slice(off, Math.min(file.size, off + CHUNK)).arrayBuffer());
    z.push(piece, off + CHUNK >= file.size);
    onProgress(Math.min(1, (off + CHUNK) / file.size));
    await nextFrame();
  }
  return out;
}

export default function Tool() {
  const [mode, setMode] = useState<Mode>("compress");
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState("6");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const { start, cancel } = useAbortable();

  const pick = async (f: File | null) => {
    setFile(f);
    setResult(null);
    setError(null);
    setHint(null);
    if (!f) return;
    const head = new Uint8Array(await f.slice(0, 1024).arrayBuffer());
    if (isGzip(head)) {
      setMode("decompress");
      const h = parseGzipHeader(head);
      setHint(`This is gzip data${h.name ? ` (original name: ${h.name})` : ""}. Switched to Decompress.`);
    } else if (/\.(gz|tgz)$/i.test(f.name)) {
      setMode("compress");
      setHint("The name ends in .gz but the file does not start with the gzip signature 1F 8B 08, so it is not gzip data.");
    } else setMode("compress");
  };

  const run = async () => {
    if (!file) return;
    const ctl = start();
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      let name: string;
      if (mode === "decompress") {
        const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
        if (!isGzip(head)) throw new Error("Not gzip data: the file does not start with the gzip signature 1F 8B 08.");
        name = gunzipName(file.name, parseGzipHeader(head));
      } else name = `${file.name}.gz`;
      const parts = await stream(file, mode, Number(level), ctl.signal, setProgress);
      const blob = new Blob(parts as BlobPart[], { type: mode === "compress" ? "application/gzip" : "application/octet-stream" });
      setResult({ blob, name, inSize: file.size, outSize: blob.size, mode });
    } catch (e) {
      if (!isAbort(e)) setError(/invalid|unexpected|header/i.test(errorText(e)) ? `The gzip data is damaged or incomplete (${errorText(e)}).` : errorText(e));
    } finally {
      setProgress(null);
    }
  };

  const saving = result ? (result.mode === "compress" ? 1 - result.outSize / Math.max(1, result.inSize) : 1 - result.inSize / Math.max(1, result.outSize)) : 0;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="GZIP compressor"
        actions={
          <Segmented
            label="Mode"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setResult(null);
            }}
            options={[
              { value: "compress", label: "Compress" },
              { value: "decompress", label: "Decompress" },
            ]}
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            {file ? (
              <FileChip file={file} onRemove={() => { cancel(); void pick(null); }} />
            ) : (
              <FileDrop onFiles={(f) => void pick(f[0])} maxSizeMB={1024} hint="Any file to compress, or a .gz file to decompress. Up to 1 GB." />
            )}
            {hint && <Notice tone="info">{hint}</Notice>}
            {mode === "compress" && <SelectField label="Compression level" options={LEVELS} value={level} onChange={(e) => setLevel(e.target.value)} />}
            <Btn icon={mode === "compress" ? "layers" : "folder"} onClick={() => void run()} disabled={!file || progress !== null}>
              {mode === "compress" ? "Compress to .gz" : "Decompress"}
            </Btn>
          </div>
          <div className="min-w-0 space-y-4" aria-live="polite">
            {progress !== null ? (
              <>
                <ProgressBar value={progress} label={mode === "compress" ? "Compressing" : "Decompressing"} />
                <Btn variant="ghost" icon="close" onClick={cancel}>
                  Cancel
                </Btn>
              </>
            ) : error ? (
              <Notice tone="error">{error}</Notice>
            ) : result ? (
              <>
                <StatGrid
                  items={[
                    { label: result.mode === "compress" ? "Original" : "Compressed", value: formatBytes(result.inSize) },
                    { label: result.mode === "compress" ? "Compressed" : "Decompressed", value: formatBytes(result.outSize) },
                    { label: "Size saving", value: saving > 0 ? `${(saving * 100).toFixed(1)}%` : "None" },
                  ]}
                />
                {result.mode === "compress" && saving <= 0.02 && (
                  <Notice tone="info">Little or no saving: this file is probably already compressed (JPEG, MP4, ZIP, PDF and similar).</Notice>
                )}
                <Btn icon="download" onClick={() => downloadBlob(result.blob, result.name)}>
                  Download {result.name}
                </Btn>
              </>
            ) : (
              <EmptyState icon="layers" title="Nothing processed yet">
                Choose a file. Gzip files are detected by their first bytes and switch the tool to Decompress.
              </EmptyState>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
