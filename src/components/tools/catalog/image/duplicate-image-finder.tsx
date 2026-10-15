"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, EmptyState, Notice, PrivacyNote, ResetBtn, StatGrid, ToolPanel, downloadFile } from "@/components/tools/kit";
import { FileDrop, ProgressBar, canvasToBlob, formatBytes } from "@/components/tools/engines/files";
import { RangeField, errMsg, isCancel } from "./shared";
import { dHash, groupPairs, hamming, similarity, toHex } from "./lib/hash";
import { toGray } from "./lib/filters";
import { decodeImage, drawScaled } from "./lib/pipeline";

type Entry = { file: File; path: string; sha: string; hash: Uint8Array | null; width: number; height: number; thumb: string | null; error: string | null };

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return toHex(new Uint8Array(buf));
}

async function analyze(file: File): Promise<Entry> {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const sha = await sha256(file);
  try {
    const bmp = await decodeImage(file);
    try {
      // dHash: shrink to 9×8 grayscale, compare horizontal neighbors.
      const small = drawScaled(bmp, 9, 8);
      const g = toGray(small.getContext("2d")?.getImageData(0, 0, 9, 8).data ?? new Uint8ClampedArray(288));
      const k = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
      const t = drawScaled(bmp, Math.max(1, Math.round(bmp.width * k)), Math.max(1, Math.round(bmp.height * k)));
      const thumb = URL.createObjectURL(await canvasToBlob(t, "image/jpeg", 0.8).catch(() => canvasToBlob(t, "image/png")));
      return { file, path, sha, hash: dHash(g), width: bmp.width, height: bmp.height, thumb, error: null };
    } finally {
      bmp.close();
    }
  } catch (e) {
    return { file, path, sha, hash: null, width: 0, height: 0, thumb: null, error: errMsg(e) };
  }
}

function Thumb({ e, note }: { e: Entry; note?: string }) {
  return (
    <figure className="w-[140px] shrink-0">
      <div className="grid h-[110px] place-items-center overflow-hidden rounded-lg bg-sunken">
        {e.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.thumb} alt={`Thumbnail of ${e.path}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted">No preview</span>
        )}
      </div>
      <figcaption className="mt-1 text-xs text-ink-2">
        <span className="block truncate font-medium text-ink" title={e.path}>
          {e.path}
        </span>
        <span className="tabular-nums">
          {e.width ? `${e.width} × ${e.height}, ` : ""}
          {formatBytes(e.file.size)}
        </span>
        {note && <span className="block text-accent-strong">{note}</span>}
      </figcaption>
    </figure>
  );
}

export default function Tool() {
  const [files, setFiles] = useState<File[]>([]);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<{ cancelled: boolean } | null>(null);

  // Revoke thumbnail URLs when results are replaced or the tool unmounts.
  useEffect(() => {
    return () => entries?.forEach((e) => e.thumb && URL.revokeObjectURL(e.thumb));
  }, [entries]);
  useEffect(() => () => {
    if (ctrl.current) ctrl.current.cancelled = true;
  }, []);

  const scan = async () => {
    const token = { cancelled: false };
    ctrl.current = token;
    setError(null);
    setEntries(null);
    setProgress(0);
    const out: Entry[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        if (token.cancelled) throw new DOMException("Cancelled", "AbortError");
        out.push(await analyze(files[i]));
        setProgress((i + 1) / files.length);
      }
      if (!token.cancelled) setEntries(out);
    } catch (e) {
      out.forEach((x) => x.thumb && URL.revokeObjectURL(x.thumb));
      if (!isCancel(e)) setError(errMsg(e));
    } finally {
      if (ctrl.current === token) setProgress(null);
    }
  };

  const groups = useMemo(() => {
    if (!entries) return null;
    const exact = groupPairs(entries.length, (i, j) => entries[i].sha === entries[j].sha);
    const exactOf = new Map<number, number>();
    exact.forEach((g, gi) => g.forEach((i) => exactOf.set(i, gi)));
    const similar = groupPairs(entries.length, (i, j) => {
      const a = entries[i].hash;
      const b = entries[j].hash;
      return !!a && !!b && hamming(a, b) <= threshold;
    }).filter((g) => new Set(g.map((i) => (exactOf.has(i) ? `e${exactOf.get(i)}` : `s${i}`))).size > 1);
    return { exact, similar };
  }, [entries, threshold]);

  const report = () => {
    if (!entries || !groups) return;
    const rows = [["group", "kind", "file", "width", "height", "bytes", "sha256", "dhash"]];
    groups.exact.forEach((g, gi) => g.forEach((i) => rows.push([`E${gi + 1}`, "exact", entries[i].path, String(entries[i].width), String(entries[i].height), String(entries[i].file.size), entries[i].sha, entries[i].hash ? toHex(entries[i].hash as Uint8Array) : ""])));
    groups.similar.forEach((g, gi) => g.forEach((i) => rows.push([`S${gi + 1}`, "similar", entries[i].path, String(entries[i].width), String(entries[i].height), String(entries[i].file.size), entries[i].sha, entries[i].hash ? toHex(entries[i].hash as Uint8Array) : ""])));
    downloadFile("duplicate-images.csv", rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  };

  const largest = (g: number[]) => (entries ? g.reduce((best, i) => (entries[i].width * entries[i].height > entries[best].width * entries[best].height ? i : best), g[0]) : -1);
  const undecodable = entries?.filter((e) => e.error).length ?? 0;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Find duplicate images"
        actions={
          files.length ? (
            <ResetBtn
              onClick={() => {
                if (ctrl.current) ctrl.current.cancelled = true;
                setFiles([]);
                setEntries(null);
              }}
              label="Clear all"
            />
          ) : undefined
        }
      >
        <div className="space-y-5">
          <FileDrop
            onFiles={(f) => {
              setFiles((p) => [...p, ...f]);
              setEntries(null);
            }}
            accept="image/*,.heic,.heif"
            multiple
            maxSizeMB={60}
            maxFiles={500}
            allowFolders
            label="Choose images or a folder"
            hint="Up to 500 images. Nothing is uploaded."
          />
          {files.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-ink-2">
                {files.length} image{files.length === 1 ? "" : "s"} selected ({formatBytes(files.reduce((n, f) => n + f.size, 0))})
              </p>
              {progress === null ? (
                <Btn icon="search" disabled={files.length < 2} onClick={scan}>
                  Find duplicates
                </Btn>
              ) : (
                <Btn
                  variant="ghost"
                  onClick={() => {
                    if (ctrl.current) ctrl.current.cancelled = true;
                  }}
                >
                  Cancel
                </Btn>
              )}
            </div>
          )}
          {progress !== null && <ProgressBar value={progress} label="Hashing images" />}
          {error && <Notice tone="error">{error}</Notice>}
          <RangeField
            label="Similarity threshold"
            value={threshold}
            onChange={setThreshold}
            min={0}
            max={20}
            format={(v) => `${v} of 64 bits (${similarity(v)}%+ similar)`}
            hint="0 finds only near-identical images. 5 to 10 catches resized, recompressed or lightly edited copies. Higher values bring false matches."
          />
          {entries && groups && (
            <>
              <StatGrid
                items={[
                  { label: "Images scanned", value: entries.length },
                  { label: "Exact duplicate groups", value: groups.exact.length },
                  { label: "Similar groups", value: groups.similar.length },
                ]}
              />
              {undecodable > 0 && <Notice tone="warning">{undecodable} file(s) could not be decoded, so they were checked for exact matches only.</Notice>}
              <div className="flex flex-wrap gap-2">
                <Btn variant="ghost" icon="download" onClick={report} disabled={!groups.exact.length && !groups.similar.length}>
                  Download report (CSV)
                </Btn>
              </div>
              {!groups.exact.length && !groups.similar.length && (
                <Notice tone="success">No duplicates found at this threshold.</Notice>
              )}
              {groups.exact.map((g, gi) => (
                <section key={`e${gi}`} aria-label={`Exact duplicate group ${gi + 1}`} className="rounded-xl border border-line p-4">
                  <h3 className="text-sm font-semibold text-ink">
                    Exact duplicates {gi + 1}: {g.length} identical files
                  </h3>
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                    {g.map((i) => (
                      <Thumb key={i} e={entries[i]} />
                    ))}
                  </div>
                </section>
              ))}
              {groups.similar.map((g, gi) => {
                const keep = largest(g);
                const ref = entries[keep].hash;
                return (
                  <section key={`s${gi}`} aria-label={`Similar group ${gi + 1}`} className="rounded-xl border border-line p-4">
                    <h3 className="text-sm font-semibold text-ink">
                      Similar images {gi + 1}: {g.length} files
                    </h3>
                    <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                      {g.map((i) => {
                        const h = entries[i].hash;
                        return <Thumb key={i} e={entries[i]} note={i === keep ? "Largest resolution" : ref && h ? `${similarity(hamming(ref, h))}% similar` : undefined} />;
                      })}
                    </div>
                  </section>
                );
              })}
              <p className="text-[0.8125rem] text-muted">Browsers cannot delete files on your disk. Use the names above or the CSV report to remove copies yourself.</p>
            </>
          )}
          {!files.length && <EmptyState icon="search" title="No images yet">Add a batch or a folder to group exact copies and look-alike photos.</EmptyState>}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
