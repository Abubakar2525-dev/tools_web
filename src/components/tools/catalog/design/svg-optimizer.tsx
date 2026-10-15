"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PluginConfig, PresetDefaultOverrides } from "svgo/browser";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, OutputBlock, PrivacyNote, ResetBtn, StatGrid, TextArea, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, downloadBlob, formatBytes, useObjectUrl, withExt } from "@/components/tools/engines/files";
import { Slider, checker } from "./shared";

const DEFAULT_PLUGINS: { id: string; label: string }[] = [
  { id: "removeComments", label: "Remove comments" },
  { id: "removeMetadata", label: "Remove <metadata>" },
  { id: "removeEditorsNSData", label: "Remove editor data (Inkscape, Illustrator, Sketch)" },
  { id: "removeDesc", label: "Remove empty or editor <desc>" },
  { id: "cleanupIds", label: "Shorten and remove unused IDs" },
  { id: "convertColors", label: "Shorten colors" },
  { id: "convertPathData", label: "Optimize path data" },
  { id: "convertShapeToPath", label: "Convert simple shapes to paths" },
  { id: "convertTransform", label: "Simplify transforms" },
  { id: "mergePaths", label: "Merge adjacent paths" },
  { id: "collapseGroups", label: "Collapse useless groups" },
  { id: "inlineStyles", label: "Inline <style> rules" },
  { id: "minifyStyles", label: "Minify styles" },
  { id: "removeUnknownsAndDefaults", label: "Remove unknown elements and default values" },
  { id: "removeHiddenElems", label: "Remove hidden elements" },
  { id: "removeUselessDefs", label: "Remove unused <defs>" },
  { id: "sortAttrs", label: "Sort attributes (better gzip)" },
];

const EXTRA_PLUGINS: { id: string; label: string; hint?: string }[] = [
  { id: "removeDimensions", label: "Remove width and height", hint: "Keeps viewBox, so the SVG scales to its container." },
  { id: "removeTitle", label: "Remove <title>", hint: "Titles provide accessible names; keep them for meaningful images." },
  { id: "removeScripts", label: "Remove scripts and event handlers" },
  { id: "removeXMLNS", label: "Remove xmlns", hint: "Only for SVG pasted inline into HTML. Breaks standalone files." },
  { id: "removeRasterImages", label: "Remove embedded bitmaps" },
  { id: "removeStyleElement", label: "Remove <style> elements" },
  { id: "prefixIds", label: "Prefix IDs and classes", hint: "Avoids clashes when several inline SVGs share a page." },
];

type Opts = { multipass: boolean; precision: number; pretty: boolean; off: string[]; extras: string[] };
const START: Opts = { multipass: true, precision: 3, pretty: false, off: [], extras: ["removeScripts"] };

type Result = { data: string; ms: number; gzIn: number; gzOut: number; source: string };

async function runSvgo(src: string, o: Opts): Promise<Result> {
  const [{ optimize }, { gzipSync, strToU8 }] = await Promise.all([import("svgo/browser"), import("fflate")]);
  const overrides = Object.fromEntries(o.off.map((p) => [p, false])) as PresetDefaultOverrides;
  const plugins: PluginConfig[] = [{ name: "preset-default", params: { overrides } }, ...(o.extras as PluginConfig[])];
  const t0 = performance.now();
  const out = optimize(src, { multipass: o.multipass, floatPrecision: o.precision, plugins, js2svg: { pretty: o.pretty, indent: 2 } });
  const ms = performance.now() - t0;
  const gz = (s: string) => gzipSync(strToU8(s), { level: 9 }).length;
  return { data: out.data, ms, gzIn: gz(src), gzOut: gz(out.data), source: src };
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [opts, setOpts] = useState<Opts>(START);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef(0);
  useEffect(() => () => {
    run.current++;
  }, []);

  const inBlob = useMemo(() => (result ? new Blob([result.source], { type: "image/svg+xml" }) : null), [result]);
  const outBlob = useMemo(() => (result ? new Blob([result.data], { type: "image/svg+xml" }) : null), [result]);
  const inUrl = useObjectUrl(inBlob);
  const outUrl = useObjectUrl(outBlob);
  const bytes = (s: string) => new TextEncoder().encode(s).length;

  const optimize = async (src: string, o: Opts) => {
    if (!src.trim()) return;
    if (!/<svg[\s>]/i.test(src)) {
      setError("This does not look like SVG markup: no <svg> element was found.");
      setResult(null);
      return;
    }
    const id = ++run.current;
    setBusy(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 0));
      if (id !== run.current) return;
      const res = await runSvgo(src, o);
      if (id !== run.current) return;
      setResult(res);
    } catch (e) {
      if (id !== run.current) return;
      setResult(null);
      setError(`SVGO could not parse this file: ${e instanceof Error ? e.message.split("\n")[0] : "unknown error"}`);
    } finally {
      if (id === run.current) setBusy(false);
    }
  };

  const change = (o: Opts) => {
    setOpts(o);
    if (result) optimize(text, o);
  };
  const toggle = (list: "off" | "extras", id: string, on: boolean) => {
    const cur = opts[list];
    change({ ...opts, [list]: on ? [...cur, id] : cur.filter((x) => x !== id) });
  };

  const before = result ? bytes(result.source) : 0;
  const after = result ? bytes(result.data) : 0;
  const stale = result !== null && result.source !== text;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="SVG input"
        actions={
          (file || text) && (
            <ResetBtn
              onClick={() => {
                run.current++;
                setFile(null);
                setText("");
                setResult(null);
                setError(null);
                setBusy(false);
              }}
              label="Clear"
            />
          )
        }
      >
        {file ? (
          <FileChip
            file={file}
            onRemove={() => {
              setFile(null);
              setText("");
              setResult(null);
            }}
          />
        ) : (
          <FileDrop
            accept="image/svg+xml,.svg"
            maxSizeMB={5}
            label="Choose an SVG file or drop it here"
            hint="Up to 5 MB, or paste markup below."
            compact
            onFiles={async ([f]) => {
              const t = await f.text();
              setFile(f);
              setText(t);
              optimize(t, opts);
            }}
          />
        )}
        <div className="mt-4">
          <TextArea
            label="SVG markup"
            mono
            rows={8}
            value={text}
            placeholder={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">…</svg>'}
            onChange={(e) => {
              setText(e.target.value);
              setFile(null);
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn icon="bolt" onClick={() => optimize(text, opts)} disabled={!text.trim() || busy}>
            Optimize
          </Btn>
        </div>
      </ToolPanel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <ToolPanel title="Options" actions={<ResetBtn onClick={() => change(START)} />}>
          <div className="space-y-4">
            <Checkbox label="Multipass" hint="Repeat until nothing more can be removed." checked={opts.multipass} onChange={(v) => change({ ...opts, multipass: v })} />
            <Checkbox label="Pretty print output" checked={opts.pretty} onChange={(v) => change({ ...opts, pretty: v })} />
            <Slider label="Number precision" value={opts.precision} onChange={(v) => change({ ...opts, precision: v })} min={0} max={8} unit="dp" />
            <fieldset>
              <legend className="text-sm font-semibold text-ink">Default preset</legend>
              <div className="mt-2 space-y-2">
                {DEFAULT_PLUGINS.map((p) => (
                  <Checkbox key={p.id} label={p.label} checked={!opts.off.includes(p.id)} onChange={(v) => toggle("off", p.id, !v)} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-ink">Extra plugins</legend>
              <div className="mt-2 space-y-2">
                {EXTRA_PLUGINS.map((p) => (
                  <Checkbox key={p.id} label={p.label} hint={p.hint} checked={opts.extras.includes(p.id)} onChange={(v) => toggle("extras", p.id, v)} />
                ))}
              </div>
            </fieldset>
          </div>
        </ToolPanel>

        <ToolPanel title="Result">
          {busy && <Spinner label="Optimizing" />}
          {error && <Notice tone="error">{error}</Notice>}
          {!result && !busy && !error && (
            <EmptyState icon="image" title="Nothing optimized yet">
              Add an SVG and press Optimize. Changing options re-runs automatically.
            </EmptyState>
          )}
          {result && (
            <div className="space-y-5">
              {stale && <Notice tone="warning">The markup changed since this result. Press Optimize to refresh.</Notice>}
              <StatGrid
                items={[
                  { label: "Original", value: formatBytes(before) },
                  { label: "Optimized", value: formatBytes(after) },
                  { label: "Saved", value: before ? `${Math.max(0, ((before - after) / before) * 100).toFixed(1)}%` : "0%" },
                  { label: "Gzip before", value: formatBytes(result.gzIn) },
                  { label: "Gzip after", value: formatBytes(result.gzOut) },
                  { label: "Time", value: `${result.ms.toFixed(0)} ms` },
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { url: inUrl, label: "Before" },
                  { url: outUrl, label: "After" },
                ].map((p) => (
                  <figure key={p.label} className="overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
                    <div className="grid h-48 place-items-center p-3" style={{ background: checker }}>
                      {p.url && (
                        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, rendered as an image so scripts cannot run
                        <img src={p.url} alt={`${p.label} optimization preview`} className="max-h-full max-w-full object-contain" />
                      )}
                    </div>
                    <figcaption className="bg-surface px-3 py-2 text-sm text-ink-2">{p.label}</figcaption>
                  </figure>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn icon="download" onClick={() => downloadBlob(new Blob([result.data], { type: "image/svg+xml" }), file ? withExt(file.name.replace(/\.svg$/i, "") + ".min", "svg") : "optimized.svg")}>
                  Download SVG
                </Btn>
                <CopyBtn text={result.data} label="Copy markup" />
              </div>
              <OutputBlock label="Optimized SVG">
                <code>{result.data.length > 200000 ? result.data.slice(0, 200000) + "\n… (truncated in view; download or copy for the full file)" : result.data}</code>
              </OutputBlock>
              <p className="text-[0.8125rem] text-muted">
                Compare the previews before using the result. Previews render as images, so scripts inside the file never run here.
              </p>
            </div>
          )}
        </ToolPanel>
      </div>
      <PrivacyNote />
    </div>
  );
}
