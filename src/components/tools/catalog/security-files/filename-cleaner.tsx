"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, NumberField, PrivacyNote, Segmented, SelectField, TextArea, ToolPanel, downloadFile, parseNum, uid } from "@/components/tools/kit";
import { FileDrop, ProgressBar, downloadBlob, zipFiles } from "@/components/tools/engines/files";
import { type CleanOptions, bashScript, cleanFilename, dedupe, powershellScript, toCsv } from "./lib/names";
import { TableWrap, errorText, tdCls, thCls } from "./shared";

type Source = "files" | "list";
type Item = { id: string; file: File };

const SPACES = [
  { value: "dash", label: "Hyphen (my-file.txt)" },
  { value: "underscore", label: "Underscore (my_file.txt)" },
  { value: "keep", label: "Keep spaces" },
  { value: "remove", label: "Remove (myfile.txt)" },
];

const PRESETS: { label: string; opts: CleanOptions }[] = [
  { label: "Web and URLs", opts: { transliterate: true, spaces: "dash", lowercase: true, strict: true, maxLength: 100, collapse: true } },
  { label: "All operating systems", opts: { transliterate: false, spaces: "keep", lowercase: false, strict: false, maxLength: 255, collapse: true } },
  { label: "Plain ASCII", opts: { transliterate: true, spaces: "underscore", lowercase: false, strict: true, maxLength: 255, collapse: true } },
];

export default function Tool() {
  const [source, setSource] = useState<Source>("files");
  const [items, setItems] = useState<Item[]>([]);
  const [list, setList] = useState("");
  const [opts, setOpts] = useState<CleanOptions>(PRESETS[0].opts);
  const [maxRaw, setMaxRaw] = useState(String(PRESETS[0].opts.maxLength));
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxN = parseNum(maxRaw);
  const maxErr = maxN === null || !Number.isInteger(maxN) || maxN < 16 || maxN > 255 ? "Whole number from 16 to 255." : null;
  const effective = { ...opts, maxLength: maxErr ? 255 : (maxN as number) };

  const originals = source === "files" ? items.map((i) => i.file.name) : list.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const cleaned = dedupe(originals.map((n) => cleanFilename(n, effective)));
  const pairs = originals.map((from, i) => ({ from, to: cleaned[i] }));
  const changed = pairs.filter((p) => p.from !== p.to).length;
  const set = (patch: Partial<CleanOptions>) => setOpts((o) => ({ ...o, ...patch }));

  const downloadZip = async () => {
    setError(null);
    setProgress(0.2);
    try {
      const blob = await zipFiles(items.map((it, i) => ({ name: cleaned[i], data: it.file as Blob })), 0);
      setProgress(1);
      downloadBlob(blob, "cleaned-files.zip");
    } catch (e) {
      setError(errorText(e, "The ZIP could not be created."));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Filename cleaner"
        actions={
          <Segmented
            label="Input"
            value={source}
            onChange={setSource}
            options={[
              { value: "files", label: "Files" },
              { value: "list", label: "List of names" },
            ]}
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="min-w-0 space-y-5">
            {source === "files" ? (
              <FileDrop
                onFiles={(fs) => setItems((s) => [...s, ...fs.map((file) => ({ id: uid(), file }))])}
                multiple
                maxFiles={1000}
                maxSizeMB={1024}
                hint="Only the names are cleaned. Contents are untouched."
                compact={items.length > 0}
              />
            ) : (
              <TextArea label="File names" hint="One name per line." mono rows={8} value={list} onChange={(e) => setList(e.target.value)} />
            )}
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Presets</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Btn
                    key={p.label}
                    variant="ghost"
                    onClick={() => {
                      setOpts(p.opts);
                      setMaxRaw(String(p.opts.maxLength));
                    }}
                  >
                    {p.label}
                  </Btn>
                ))}
              </div>
            </div>
            <SelectField label="Spaces" options={SPACES} value={opts.spaces} onChange={(e) => set({ spaces: e.target.value as CleanOptions["spaces"] })} />
            <div className="space-y-3">
              <Checkbox label="Replace accents and special letters (é to e, ß to ss)" checked={opts.transliterate} onChange={(v) => set({ transliterate: v })} />
              <Checkbox label="Only letters, digits, hyphen, underscore and period" checked={opts.strict} onChange={(v) => set({ strict: v })} hint="Safest for URLs, scripts and old systems. Non-Latin names become 'file'." />
              <Checkbox label="Lowercase" checked={opts.lowercase} onChange={(v) => set({ lowercase: v })} hint="Avoids clashes on case-insensitive disks (Windows, macOS)." />
              <Checkbox label="Collapse repeated separators" checked={opts.collapse} onChange={(v) => set({ collapse: v })} />
            </div>
            <NumberField label="Maximum length (bytes)" hint="255 is the limit on most file systems." value={maxRaw} onChange={(e) => setMaxRaw(e.target.value)} error={maxErr} />
            <p className="text-[0.8125rem] text-muted">
              Always applied: removes characters Windows forbids (&lt; &gt; : &quot; / \ | ? *) and control characters, leading dots and dashes,
              trailing dots and spaces, and suffixes reserved device names such as CON or LPT1.
            </p>
          </div>
          <div className="min-w-0 space-y-4">
            {originals.length === 0 ? (
              <EmptyState icon="pen" title="Nothing to clean yet">
                {source === "files" ? "Add files to preview their cleaned names." : "Paste file names, one per line."}
              </EmptyState>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2" aria-live="polite">
                  <span>
                    {originals.length} names, {changed} changed
                  </span>
                  {source === "files" && (
                    <Btn variant="subtle" icon="trash" onClick={() => setItems([])}>
                      Clear
                    </Btn>
                  )}
                </div>
                <TableWrap label="Cleaned names preview">
                  <thead>
                    <tr>
                      <th className={thCls}>Original</th>
                      <th className={thCls}>Cleaned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.map((p, i) => (
                      <tr key={`${i}-${p.from}`}>
                        <td className={`${tdCls} break-all text-ink-2`}>{p.from}</td>
                        <td className={`${tdCls} break-all ${p.from !== p.to ? "font-medium text-ink" : "text-muted"}`}>
                          {p.to}
                          {p.from === p.to && <span className="sr-only"> (unchanged)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
                <div className="flex flex-wrap gap-2">
                  {source === "files" && (
                    <Btn icon="download" onClick={() => void downloadZip()} disabled={progress !== null}>
                      Download cleaned copies (ZIP)
                    </Btn>
                  )}
                  <CopyBtn text={cleaned.join("\n")} label="Copy cleaned list" />
                  <Btn variant="ghost" icon="table" onClick={() => downloadFile("filename-map.csv", toCsv([["original", "cleaned"], ...pairs.map((p) => [p.from, p.to])]), "text/csv")}>
                    Mapping CSV
                  </Btn>
                  <Btn variant="ghost" icon="code" onClick={() => downloadFile("rename.sh", bashScript(pairs), "text/x-shellscript")}>
                    Bash script
                  </Btn>
                  <Btn variant="ghost" icon="code" onClick={() => downloadFile("rename.ps1", powershellScript(pairs))}>
                    PowerShell script
                  </Btn>
                </div>
                <p className="text-[0.8125rem] text-muted">
                  Browsers cannot rename files on disk. Download cleaned copies, or run the script inside the folder to rename the originals.
                </p>
                {progress !== null && <ProgressBar value={progress} label="Building ZIP" />}
                {error && <Notice tone="error">{error}</Notice>}
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
