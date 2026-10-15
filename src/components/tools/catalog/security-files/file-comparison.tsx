"use client";

import { useEffect, useState } from "react";
import { Btn, EmptyState, Notice, PrivacyNote, StatGrid, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, ProgressBar, formatBytes } from "@/components/tools/engines/files";
import { type CompareState, compareChunk, hex2, hexOffset, newCompareState, printable } from "./lib/compare";
import { errorText, isAbort, nextFrame, useAbortable } from "./shared";

type Result = { key: string; state: CompareState; sizeA: number; sizeB: number };
type Window = { offset: number; a: Uint8Array; b: Uint8Array; key: string };

const CHUNK = 2 * 1024 * 1024;
const ROW = 16;
const ROWS = 12;
const fileKey = (a: File | null, b: File | null) => (a && b ? `${a.name}:${a.size}:${a.lastModified}|${b.name}:${b.size}:${b.lastModified}` : "");

function HexSide({ bytes, other, offset, label }: { bytes: Uint8Array; other: Uint8Array; offset: number; label: string }) {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const start = r * ROW;
    if (start >= bytes.length && start >= other.length) break;
    const cells = [];
    let ascii = "";
    let diffs = 0;
    for (let i = start; i < start + ROW; i++) {
      if (i >= bytes.length) {
        cells.push(<span key={i} className="text-muted">{"  "} </span>);
        continue;
      }
      const diff = i >= other.length || bytes[i] !== other[i];
      if (diff) diffs++;
      cells.push(
        <span key={i} className={diff ? "rounded-sm bg-[color-mix(in_oklch,var(--danger)_28%,transparent)] font-bold underline" : ""}>
          {hex2(bytes[i])}
          {i < start + ROW - 1 ? " " : ""}
        </span>,
      );
      ascii += printable(bytes[i]);
    }
    rows.push(
      <div key={r} className="whitespace-pre">
        <span className="text-night-ink/60">{hexOffset(offset + start)} </span>
        {cells}
        <span className="text-night-ink/60"> {ascii.padEnd(ROW, " ")}</span>
        <span className="sr-only">{diffs ? `, ${diffs} differing bytes in this row` : ", same"}</span>
        <span aria-hidden="true">{diffs ? ` ≠${diffs}` : ""}</span>
      </div>,
    );
  }
  return (
    <div className="min-w-0">
      <p className="mb-1 text-sm font-medium text-ink">{label}</p>
      <div tabIndex={0} role="region" aria-label={`${label} hex dump`} className="overflow-x-auto rounded-lg bg-night p-3 font-mono text-[0.78rem] leading-relaxed text-night-ink">
        {rows}
      </div>
    </div>
  );
}

export default function Tool() {
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [win, setWin] = useState<Window | null>(null);
  const { start, cancel } = useAbortable();

  const key = fileKey(a, b);
  const current = result && result.key === key ? result : null;

  const compare = async () => {
    if (!a || !b) return;
    const ctl = start();
    setError(null);
    setResult(null);
    setSelected(null);
    setProgress(0);
    try {
      const s = newCompareState();
      const common = Math.min(a.size, b.size);
      for (let off = 0; off < common; off += CHUNK) {
        if (ctl.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const end = Math.min(common, off + CHUNK);
        const [ca, cb] = await Promise.all([a.slice(off, end).arrayBuffer(), b.slice(off, end).arrayBuffer()]);
        compareChunk(new Uint8Array(ca), new Uint8Array(cb), off, s);
        setProgress(common ? end / common : 1);
        await nextFrame();
      }
      setResult({ key, state: s, sizeA: a.size, sizeB: b.size });
      const first = s.firstDiff ?? (a.size !== b.size ? common : null);
      setSelected(first);
    } catch (e) {
      if (!isAbort(e)) setError(errorText(e, "A file could not be read."));
    } finally {
      setProgress(null);
    }
  };

  const winOffset = selected === null ? null : Math.max(0, Math.floor(selected / ROW) * ROW - ROW * 3);
  const winKey = `${key}|${winOffset}`;
  useEffect(() => {
    if (winOffset === null || !a || !b) return;
    let alive = true;
    const len = ROW * ROWS;
    Promise.all([a.slice(winOffset, winOffset + len).arrayBuffer(), b.slice(winOffset, winOffset + len).arrayBuffer()])
      .then(([x, y]) => alive && setWin({ offset: winOffset, a: new Uint8Array(x), b: new Uint8Array(y), key: winKey }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [winOffset, winKey, a, b]);
  const view = win && win.key === winKey ? win : null;

  const identical = current && current.state.diffCount === 0 && current.sizeA === current.sizeB;
  const sizeDiff = current ? current.sizeA - current.sizeB : 0;

  const drop = (which: "a" | "b") => {
    const f = which === "a" ? a : b;
    const set = which === "a" ? setA : setB;
    const label = which === "a" ? "File A" : "File B";
    return f ? (
      <FileChip file={f} onRemove={() => { cancel(); set(null); }} />
    ) : (
      <FileDrop onFiles={(fs) => set(fs[0])} maxSizeMB={8192} label={`Choose ${label} or drop it here`} hint="Any file type, any size up to 8 GB." compact />
    );
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="File comparison">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">File A</p>
              {drop("a")}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">File B</p>
              {drop("b")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn icon="swap" onClick={() => void compare()} disabled={!a || !b || progress !== null}>
              Compare byte by byte
            </Btn>
            {progress !== null && (
              <Btn variant="ghost" icon="close" onClick={cancel}>
                Cancel
              </Btn>
            )}
          </div>
          <div aria-live="polite" className="space-y-4">
            {progress !== null && <ProgressBar value={progress} label="Comparing" />}
            {error && <Notice tone="error">{error}</Notice>}
            {!current && progress === null && !error && (
              <EmptyState icon="swap" title="Choose two files">
                The files are read in 2 MB pieces side by side, so even very large files compare without loading them whole.
              </EmptyState>
            )}
            {current && (
              <>
                {identical ? (
                  <Notice tone="success" title="Identical">
                    Both files contain exactly the same {current.sizeA.toLocaleString("en-US")} bytes.
                  </Notice>
                ) : (
                  <Notice tone="warning" title="The files differ">
                    {current.state.firstDiff !== null
                      ? `First difference at byte ${current.state.firstDiff.toLocaleString("en-US")} (0x${current.state.firstDiff.toString(16).toUpperCase()}).`
                      : "The shared part is identical, but one file is longer."}
                  </Notice>
                )}
                <StatGrid
                  items={[
                    { label: "Size of A", value: formatBytes(current.sizeA) },
                    { label: "Size of B", value: formatBytes(current.sizeB) },
                    { label: "Size difference", value: sizeDiff === 0 ? "None" : `${Math.abs(sizeDiff).toLocaleString("en-US")} B (${sizeDiff > 0 ? "A" : "B"} longer)` },
                    { label: "Differing bytes", value: current.state.diffCount.toLocaleString("en-US") },
                    { label: "Difference regions", value: current.state.regionCount.toLocaleString("en-US") },
                    {
                      label: "Shared part that matches",
                      value: `${(Math.min(current.sizeA, current.sizeB) ? (1 - current.state.diffCount / Math.min(current.sizeA, current.sizeB)) * 100 : 100).toFixed(2)}%`,
                    },
                  ]}
                />
                {current.state.regions.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-ink">
                      Difference regions{current.state.regionCount > current.state.regions.length ? ` (first ${current.state.regions.length} shown)` : ""}
                    </p>
                    <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
                      {current.state.regions.map((r) => (
                        <button
                          key={r.start}
                          type="button"
                          onClick={() => setSelected(r.start)}
                          aria-pressed={selected === r.start}
                          className={`h-10 rounded-lg px-3 font-mono text-[0.8rem] ${selected === r.start ? "bg-accent-soft text-ink shadow-[inset_0_0_0_1.5px_var(--accent)]" : "bg-sunken text-ink-2 hover:text-ink"}`}
                        >
                          0x{r.start.toString(16).toUpperCase()} ({(r.end - r.start).toLocaleString("en-US")} B)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {view && (
                  <div>
                    <p className="mb-2 text-sm text-ink-2">
                      Hex view from offset 0x{view.offset.toString(16).toUpperCase()}. Differing bytes are bold and underlined; rows with differences end with ≠ and a count.
                    </p>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <HexSide bytes={view.a} other={view.b} offset={view.offset} label="File A" />
                      <HexSide bytes={view.b} other={view.a} offset={view.offset} label="File B" />
                    </div>
                  </div>
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
