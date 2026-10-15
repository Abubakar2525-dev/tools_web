/** Filename rules for the batch renamer and filename cleaner. Pure functions. */

export function splitName(filename: string): { stem: string; ext: string } {
  const i = filename.lastIndexOf(".");
  if (i <= 0 || i === filename.length - 1) return { stem: filename, ext: "" };
  return { stem: filename.slice(0, i), ext: filename.slice(i + 1) };
}

export const joinName = (stem: string, ext: string) => (ext ? `${stem}.${ext}` : stem);

/* ------------------------------------------------------------------ */
/* Case helpers                                                        */
/* ------------------------------------------------------------------ */

export type CaseMode = "keep" | "lower" | "upper" | "title" | "sentence" | "kebab" | "snake" | "camel";

function words(s: string) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_\-.]+/)
    .filter(Boolean);
}

export function applyCase(s: string, mode: CaseMode): string {
  switch (mode) {
    case "keep":
      return s;
    case "lower":
      return s.toLowerCase();
    case "upper":
      return s.toUpperCase();
    case "title":
      return s.toLowerCase().replace(/(^|[\s_\-.(])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
    case "sentence": {
      const l = s.toLowerCase();
      return l.replace(/\p{L}/u, (c) => c.toUpperCase());
    }
    case "kebab":
      return words(s).join("-").toLowerCase();
    case "snake":
      return words(s).join("_").toLowerCase();
    case "camel":
      return words(s)
        .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join("");
  }
}

/* ------------------------------------------------------------------ */
/* Batch renamer                                                       */
/* ------------------------------------------------------------------ */

export interface RenameRules {
  find: string;
  replace: string;
  useRegex: boolean;
  matchCase: boolean;
  /** Template with {name} {ext} {n} {date} {orig}. Empty means "{name}". */
  pattern: string;
  start: number;
  step: number;
  pad: number;
  caseMode: CaseMode;
  extCase: "keep" | "lower" | "upper";
}

export interface RenameInput {
  name: string;
  lastModified: number;
}

export interface RenameRow {
  from: string;
  to: string;
  problems: string[];
}

function isoDate(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function compileFind(rules: Pick<RenameRules, "find" | "useRegex" | "matchCase">): RegExp | null {
  if (!rules.find) return null;
  const src = rules.useRegex ? rules.find : rules.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(src, rules.matchCase ? "gu" : "giu");
}

export function renameAll(files: RenameInput[], rules: RenameRules): RenameRow[] {
  const re = compileFind(rules);
  const rows = files.map((f, i) => {
    const { stem, ext } = splitName(f.name);
    let name = re ? stem.replace(re, rules.replace) : stem;
    const n = String(rules.start + i * rules.step).padStart(rules.pad, "0");
    const pattern = rules.pattern.trim() || "{name}";
    name = pattern
      .replace(/\{name\}/g, name)
      .replace(/\{orig\}/g, stem)
      .replace(/\{n\}/g, n)
      .replace(/\{date\}/g, isoDate(f.lastModified))
      .replace(/\{ext\}/g, ext);
    name = applyCase(name, rules.caseMode).trim();
    const e = rules.extCase === "lower" ? ext.toLowerCase() : rules.extCase === "upper" ? ext.toUpperCase() : ext;
    return { from: f.name, to: joinName(name, e), problems: [] as string[] };
  });
  return markProblems(rows);
}

const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/;

/** Adds empty/illegal/duplicate warnings. Duplicates are compared case-insensitively (Windows/macOS). */
export function markProblems(rows: RenameRow[]): RenameRow[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.to.toLowerCase(), (counts.get(r.to.toLowerCase()) ?? 0) + 1);
  return rows.map((r) => {
    const problems: string[] = [];
    if (!splitName(r.to).stem.trim()) problems.push("Empty name");
    if (ILLEGAL.test(r.to)) problems.push("Contains characters not allowed on Windows");
    if ((counts.get(r.to.toLowerCase()) ?? 0) > 1) problems.push("Duplicate name");
    if (new TextEncoder().encode(r.to).length > 255) problems.push("Longer than 255 bytes");
    return { ...r, problems };
  });
}

/* ------------------------------------------------------------------ */
/* Filename cleaner                                                    */
/* ------------------------------------------------------------------ */

export interface CleanOptions {
  transliterate: boolean;
  spaces: "dash" | "underscore" | "keep" | "remove";
  lowercase: boolean;
  /** Restrict to [A-Za-z0-9._-] (URL and shell safe). */
  strict: boolean;
  maxLength: number;
  collapse: boolean;
}

const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i;

const SPECIAL: Record<string, string> = {
  ß: "ss", ẞ: "SS", æ: "ae", Æ: "AE", œ: "oe", Œ: "OE", ø: "o", Ø: "O", đ: "d", Đ: "D", ð: "d", Ð: "D",
  þ: "th", Þ: "TH", ł: "l", Ł: "L", ı: "i", "&": "and", "@": "at", "€": "EUR", "£": "GBP", "–": "-", "—": "-",
  "‘": "", "’": "", "“": "", "”": "", "«": "", "»": "",
};

export function transliterate(s: string) {
  return s
    .replace(/[ßẞæÆœŒøØđĐðÐþÞłŁı&@€£–—‘’“”«»]/g, (c) => SPECIAL[c] ?? c)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

/** Truncates a string to at most `max` UTF-8 bytes without splitting a character. */
export function truncateBytes(s: string, max: number) {
  const enc = new TextEncoder();
  if (enc.encode(s).length <= max) return s;
  let out = "";
  let bytes = 0;
  for (const ch of s) {
    const b = enc.encode(ch).length;
    if (bytes + b > max) break;
    out += ch;
    bytes += b;
  }
  return out;
}

export function cleanFilename(name: string, o: CleanOptions): string {
  const { stem: rawStem, ext: rawExt } = splitName(name.trim());
  const fix = (part: string, isExt: boolean) => {
    let s = part.normalize("NFC");
    if (o.transliterate) s = transliterate(s);
    // Control characters and characters reserved on Windows (also "/" on Unix).
    s = s.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, isExt ? "" : " ");
    if (o.strict) s = s.replace(/[^A-Za-z0-9._\- ]/g, isExt ? "" : " ");
    const sp = o.spaces === "dash" ? "-" : o.spaces === "underscore" ? "_" : o.spaces === "remove" ? "" : " ";
    s = s.replace(/\s+/g, isExt ? "" : sp);
    if (o.collapse)
      s = s
        .replace(/([-_ ])[-_ ]+/g, "$1")
        .replace(/\.{2,}/g, ".")
        .replace(/[-_ ]+\./g, ".")
        .replace(/\.[-_ ]+/g, ".");
    if (o.lowercase) s = s.toLowerCase();
    return s;
  };
  let stem = fix(rawStem, false);
  let ext = fix(rawExt, true).replace(/\./g, "");
  // No leading dots/dashes (hidden files, command flags) and no trailing dots/spaces (Windows).
  stem = stem.replace(/^[.\-\s_]+/, "").replace(/[.\s_-]+$/, "");
  if (!stem) stem = "file";
  if (ext.length > 16) ext = ext.slice(0, 16);
  const max = Math.max(16, Math.min(255, o.maxLength));
  const extBytes = ext ? new TextEncoder().encode(ext).length + 1 : 0;
  stem = truncateBytes(stem, max - extBytes).replace(/[.\s_-]+$/, "") || "file";
  // Windows reserves device names even with an extension (CON.txt).
  if (RESERVED.test(stem) || RESERVED.test(stem.split(".")[0])) stem = `${stem}_`;
  return joinName(stem, ext);
}

/** Makes names unique by appending -2, -3 … (case-insensitive). */
export function dedupe(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((n) => {
    let candidate = n;
    let i = 2;
    const { stem, ext } = splitName(n);
    while (used.has(candidate.toLowerCase())) candidate = joinName(`${stem}-${i++}`, ext);
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** CSV with RFC 4180 quoting. */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");
}

/* ------------------------------------------------------------------ */
/* Rename scripts (browsers cannot rename files on disk)               */
/* ------------------------------------------------------------------ */

const shQuote = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** A bash script that renames files in the current folder (skips existing targets). */
export function bashScript(pairs: { from: string; to: string }[]): string {
  const lines = pairs.filter((p) => p.from !== p.to).map((p) => `mv -n -- ${shQuote(p.from)} ${shQuote(p.to)}`);
  return ["#!/usr/bin/env bash", "# Run inside the folder that holds the files.", "set -e", ...lines, ""].join("\n");
}

/** A PowerShell script that renames files in the current folder. */
export function powershellScript(pairs: { from: string; to: string }[]): string {
  const lines = pairs
    .filter((p) => p.from !== p.to)
    .map((p) => `Rename-Item -LiteralPath ${psQuote(p.from)} -NewName ${psQuote(p.to)}`);
  return ["# Run inside the folder that holds the files.", "$ErrorActionPreference = 'Stop'", ...lines, ""].join("\r\n");
}
