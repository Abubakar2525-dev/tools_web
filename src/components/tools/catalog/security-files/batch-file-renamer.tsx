"use client";

import { useMemo, useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, NumberField, PrivacyNote, SelectField, TextField, ToolPanel, downloadFile, parseNum, uid } from "@/components/tools/kit";
import { FileDrop, ProgressBar, downloadBlob, formatBytes, zipFiles } from "@/components/tools/engines/files";
import { type CaseMode, type RenameRules, bashScript, compileFind, powershellScript, renameAll, toCsv } from "./lib/names";
import { TableWrap, errorText, tdCls, thCls } from "./shared";

type Item = { id: string; file: File };
type Sort = "added" | "name" | "date" | "size";

const CASES: { value: CaseMode; label: string }[] = [
  { value: "keep", label: "Keep as is" },
  { value: "lower", label: "lowercase" },
  { value: "upper", label: "UPPERCASE" },
  { value: "title", label: "Title Case" },
  { value: "sentence", label: "Sentence case" },
  { value: "kebab", label: "kebab-case" },
  { value: "snake", label: "snake_case" },
  { value: "camel", label: "camelCase" },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: "added", label: "Order added" },
  { value: "name", label: "Name (A to Z)" },
  { value: "date", label: "Date modified (oldest first)" },
  { value: "size", label: "Size (smallest first)" },
];

const MAX_ZIP_BYTES = 1024 * 1024 * 1024;

export default function Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [pattern, setPattern] = useState("{name}");
  const [startRaw, setStartRaw] = useState("1");
  const [stepRaw, setStepRaw] = useState("1");
  const [padRaw, setPadRaw] = useState("2");
  const [caseMode, setCaseMode] = useState<CaseMode>("keep");
  const [extCase, setExtCase] = useState<"keep" | "lower" | "upper">("lower");
  const [sort, setSort] = useState<Sort>("added");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startN = parseNum(startRaw);
  const stepN = parseNum(stepRaw);
  const padN = parseNum(padRaw);
  const numError = (n: number | null, min: number, max: number) => (n === null || !Number.isInteger(n) || n < min || n > max ? `Whole number from ${min} to ${max}.` : null);
  const startErr = numError(startN, 0, 1_000_000);
  const stepErr = numError(stepN, 1, 1000);
  const padErr = numError(padN, 1, 8);

  let regexError: string | null = null;
  try {
    compileFind({ find, useRegex, matchCase });
  } catch (e) {
    regexError = `Invalid regular expression: ${errorText(e)}`;
  }

  const sorted = useMemo(() => {
    const s = [...items];
    if (sort === "name") s.sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: "base" }));
    if (sort === "date") s.sort((a, b) => a.file.lastModified - b.file.lastModified);
    if (sort === "size") s.sort((a, b) => a.file.size - b.file.size);
    return s;
  }, [items, sort]);

  const rules: RenameRules = {
    find,
    replace,
    useRegex,
    matchCase,
    pattern,
    start: startErr ? 1 : (startN as number),
    step: stepErr ? 1 : (stepN as number),
    pad: padErr ? 1 : (padN as number),
    caseMode,
    extCase,
  };
  // Renaming a few thousand names is cheap, so the preview is recomputed on every change.
  const rows = regexError ? [] : renameAll(sorted.map((i) => ({ name: i.file.name, lastModified: i.file.lastModified })), rules);
  const problems = rows.filter((r) => r.problems.length).length;
  const changed = rows.filter((r) => r.from !== r.to).length;
  const totalBytes = items.reduce((s, i) => s + i.file.size, 0);

  const pairs = rows.map((r) => ({ from: r.from, to: r.to }));

  const downloadZip = async () => {
    if (problems) return;
    setError(null);
    setProgress(0);
    try {
      const entries = sorted.map((it, i) => ({ name: rows[i].to, data: it.file as Blob }));
      setProgress(0.3);
      const blob = await zipFiles(entries, 0);
      setProgress(1);
      downloadBlob(blob, "renamed-files.zip");
    } catch (e) {
      setError(errorText(e, "The ZIP could not be created."));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Batch file renamer">
        <div className="space-y-6">
          <Notice tone="info">
            Browsers cannot rename files on your disk. This tool gives you renamed copies in a ZIP, or a script you can run in the folder to
            rename the originals in place.
          </Notice>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="min-w-0 space-y-5">
              <FileDrop
                onFiles={(fs) => setItems((s) => [...s, ...fs.map((file) => ({ id: uid(), file }))])}
                multiple
                maxFiles={1000}
                maxSizeMB={1024}
                hint="Add the files to rename. Only names are read until you download a ZIP."
                compact={items.length > 0}
              />
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-ink">1. Find and replace (in the name, not the extension)</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Find" value={find} onChange={(e) => setFind(e.target.value)} error={regexError} spellCheck={false} />
                  <TextField label="Replace with" value={replace} onChange={(e) => setReplace(e.target.value)} hint={useRegex ? "Use $1, $2 for groups." : undefined} spellCheck={false} />
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <Checkbox label="Regular expression" checked={useRegex} onChange={setUseRegex} />
                  <Checkbox label="Match case" checked={matchCase} onChange={setMatchCase} />
                </div>
              </fieldset>
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-ink">2. New name pattern</legend>
                <TextField
                  label="Pattern"
                  hint="{name} = name after step 1, {orig} = original name, {n} = number, {date} = file date (YYYY-MM-DD), {ext} = extension."
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  spellCheck={false}
                />
                <div className="grid grid-cols-3 gap-3">
                  <NumberField label="Start at" value={startRaw} onChange={(e) => setStartRaw(e.target.value)} error={startErr} />
                  <NumberField label="Step" value={stepRaw} onChange={(e) => setStepRaw(e.target.value)} error={stepErr} />
                  <NumberField label="Digits" value={padRaw} onChange={(e) => setPadRaw(e.target.value)} error={padErr} />
                </div>
                <SelectField label="Number in this order" options={SORTS} value={sort} onChange={(e) => setSort(e.target.value as Sort)} />
              </fieldset>
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-3 text-sm font-medium text-ink">3. Letter case</legend>
                <SelectField label="Name" options={CASES} value={caseMode} onChange={(e) => setCaseMode(e.target.value as CaseMode)} />
                <SelectField
                  label="Extension"
                  options={[
                    { value: "keep", label: "Keep" },
                    { value: "lower", label: "lowercase" },
                    { value: "upper", label: "UPPERCASE" },
                  ]}
                  value={extCase}
                  onChange={(e) => setExtCase(e.target.value as "keep" | "lower" | "upper")}
                />
              </fieldset>
            </div>
            <div className="min-w-0 space-y-4">
              {items.length === 0 ? (
                <EmptyState icon="pen" title="No files yet">
                  Add files to see a live before and after preview.
                </EmptyState>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2" aria-live="polite">
                    <span>
                      {items.length} files, {changed} renamed{problems ? `, ${problems} with problems` : ""}
                    </span>
                    <Btn variant="subtle" icon="trash" onClick={() => setItems([])}>
                      Clear
                    </Btn>
                  </div>
                  {problems > 0 && <Notice tone="warning">Fix the rows marked with a problem before downloading. Duplicate names would overwrite each other.</Notice>}
                  <TableWrap label="Rename preview">
                    <thead>
                      <tr>
                        <th className={thCls}>Current name</th>
                        <th className={thCls}>New name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={sorted[i]?.id ?? i}>
                          <td className={`${tdCls} break-all text-ink-2`}>{r.from}</td>
                          <td className={`${tdCls} break-all`}>
                            <span className={r.from !== r.to ? "font-medium text-ink" : "text-muted"}>{r.to}</span>
                            {r.problems.length > 0 && <span className="mt-1 block text-[0.8125rem] text-danger">Problem: {r.problems.join(", ")}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                  <div className="flex flex-wrap gap-2">
                    <Btn icon="download" onClick={() => void downloadZip()} disabled={!!problems || progress !== null || totalBytes > MAX_ZIP_BYTES}>
                      Download renamed copies (ZIP)
                    </Btn>
                    <Btn variant="ghost" icon="table" onClick={() => downloadFile("rename-map.csv", toCsv([["original", "renamed"], ...pairs.map((p) => [p.from, p.to])]), "text/csv")}>
                      Mapping CSV
                    </Btn>
                    <Btn variant="ghost" icon="code" disabled={!!problems} onClick={() => downloadFile("rename.sh", bashScript(pairs), "text/x-shellscript")}>
                      Bash script
                    </Btn>
                    <Btn variant="ghost" icon="code" disabled={!!problems} onClick={() => downloadFile("rename.ps1", powershellScript(pairs))}>
                      PowerShell script
                    </Btn>
                  </div>
                  {totalBytes > MAX_ZIP_BYTES && <Notice tone="info">These files total {formatBytes(totalBytes)}. ZIP download is limited to 1 GB; use a script instead.</Notice>}
                  {progress !== null && <ProgressBar value={progress} label="Building ZIP" />}
                  {error && <Notice tone="error">{error}</Notice>}
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
