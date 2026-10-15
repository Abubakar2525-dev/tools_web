/**
 * BibTeX generation and parsing. Generation targets classic BibTeX entry types
 * with biblatex-friendly extras (date, urldate, entrysubtype). Parsing handles
 * braces, quoted values, numbers, @string macros, # concatenation, @comment and
 * @preamble blocks, and converts common LaTeX accents to Unicode.
 */
import type { Name, PartialDate, Source, SourceType } from "./types";
import { emptyDate } from "./types";
import { clean, dateBits, dateISO, normalizeDoi, normalizeUrl, pageRange, validNames } from "./util";

/* ------------------------------------------------------------------ */
/* Escaping                                                            */
/* ------------------------------------------------------------------ */

/** Escapes LaTeX special characters in a field value. Unicode letters are kept (fine for biber/XeLaTeX/modern pdfLaTeX). */
export function escapeLatex(s: string): string {
  return s.replace(/[\\{}&%$#_~^]/g, (c) => {
    switch (c) {
      case "\\":
        return "\\textbackslash{}";
      case "~":
        return "\\textasciitilde{}";
      case "^":
        return "\\textasciicircum{}";
      default:
        return `\\${c}`;
    }
  });
}

/** Folds accents for citation keys: "Łukasz Müller" → "lukaszmuller". */
export function asciiFold(s: string): string {
  const special: Record<string, string> = { ß: "ss", æ: "ae", Æ: "ae", œ: "oe", Œ: "oe", ø: "o", Ø: "o", ł: "l", Ł: "l", đ: "d", Đ: "d", þ: "th", Þ: "th", ı: "i" };
  return s
    .replace(/[ßæÆœŒøØłŁđĐþÞı]/g, (c) => special[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const KEY_STOP = new Set("a an the on of in for to and with from at by is are as its into".split(" "));

/** Citation key: first author's family name + year + first significant title word, e.g. "lecun2015deep". */
export function citationKey(s: Source): string {
  const names = validNames(s.authors.length ? s.authors : s.editors);
  const first = names[0];
  const who = first ? (first.org ? first.family.split(/\s+/)[0] : first.family) : "";
  const year = /^\d{4}$/.test(clean(s.date.year)) ? clean(s.date.year) : "";
  const word = asciiFold(clean(s.title))
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .find((w) => w && !KEY_STOP.has(w));
  const key = `${asciiFold(who).toLowerCase().replace(/[^a-z0-9]/g, "")}${year}${word ?? ""}`;
  return key || "ref";
}

/** Keys for a list, made unique with a/b/c suffixes. */
export function uniqueKeys(sources: Source[]): string[] {
  const base = sources.map(citationKey);
  const count = new Map<string, number>();
  base.forEach((k) => count.set(k, (count.get(k) ?? 0) + 1));
  const used = new Map<string, number>();
  return base.map((k) => {
    if ((count.get(k) ?? 0) < 2) return k;
    const n = used.get(k) ?? 0;
    used.set(k, n + 1);
    return k + String.fromCharCode(97 + (n % 26)) + (n >= 26 ? String(Math.floor(n / 26)) : "");
  });
}

const MONTH_MACROS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function bibName(n: Name): string {
  if (n.org) return `{${escapeLatex(n.family)}}`;
  return n.given ? `${escapeLatex(n.family)}, ${escapeLatex(n.given)}` : escapeLatex(n.family);
}

const ENTRY_TYPE: Record<SourceType, string> = {
  book: "book",
  chapter: "incollection",
  journal: "article",
  webpage: "misc",
  report: "techreport",
  news: "article",
  conference: "inproceedings",
  thesis: "phdthesis",
};

/** Generates one BibTeX entry. */
export function toBibtex(s: Source, key = citationKey(s)): string {
  const fields: [string, string][] = [];
  const add = (name: string, value: string, raw = false) => {
    const v = clean(value);
    if (v) fields.push([name, raw ? v : escapeLatex(v)]);
  };
  const authors = validNames(s.authors);
  const editors = validNames(s.editors);
  if (authors.length) fields.push(["author", authors.map(bibName).join(" and ")]);
  if (editors.length) fields.push(["editor", editors.map(bibName).join(" and ")]);
  // Double braces keep capitalization exactly as typed.
  if (clean(s.title)) fields.push(["title", `{${escapeLatex(clean(s.title))}}`]);
  const container = clean(s.container);
  switch (s.type) {
    case "journal":
    case "news":
      add("journal", container);
      if (s.type === "news") add("entrysubtype", "newspaper");
      break;
    case "chapter":
    case "conference":
      add("booktitle", container);
      break;
    case "webpage":
      add("organization", container);
      break;
  }
  add("edition", s.edition);
  add("volume", s.volume);
  add("number", s.type === "report" ? s.number : s.issue);
  if (s.pages) add("pages", pageRange(s.pages, "--"), true);
  if (s.type === "report") add("institution", s.publisher);
  else if (s.type === "thesis") add("school", s.publisher);
  else add("publisher", s.publisher);
  add("address", s.place);
  if (s.type === "thesis" && s.thesisType === "masters") add("type", "Master's thesis");
  const d = dateBits(s.date);
  add("year", d.year);
  const monthMacro = d.month ? MONTH_MACROS[d.month - 1] : "";
  if (d.month && d.day) add("date", dateISO(d), true);
  const doi = normalizeDoi(s.doi);
  if (doi) add("doi", doi, true);
  const url = normalizeUrl(s.url);
  if (url) add("url", url, true);
  const acc = dateBits(s.accessed);
  if (acc.year) {
    add("urldate", dateISO(acc), true);
    if (s.type === "webpage") add("note", `Accessed ${dateISO(acc)}`, true);
  }
  if (s.type === "webpage" && url) add("howpublished", `\\url{${url}}`, true);

  const type = s.type === "thesis" && s.thesisType === "masters" ? "mastersthesis" : ENTRY_TYPE[s.type];
  const width = Math.max(...fields.map(([n]) => n.length), 4);
  const lines = fields.map(([n, v]) => `  ${n.padEnd(width)} = {${v}}`);
  if (monthMacro) {
    const yearIdx = fields.findIndex(([n]) => n === "year");
    lines.splice(yearIdx >= 0 ? yearIdx + 1 : lines.length, 0, `  ${"month".padEnd(width)} = ${monthMacro}`);
  }
  // Drop the redundant `type` line for masters theses (entry type already says it).
  const body = lines.filter((l) => !/^\s+type\s+=/.test(l)).join(",\n");
  return `@${type}{${key},\n${body}\n}`;
}

export function toBibtexList(sources: Source[]): string {
  const keys = uniqueKeys(sources);
  return sources.map((s, i) => toBibtex(s, keys[i])).join("\n\n") + (sources.length ? "\n" : "");
}

/* ------------------------------------------------------------------ */
/* LaTeX → Unicode                                                     */
/* ------------------------------------------------------------------ */

const ACCENTS: Record<string, string> = {
  "'": "́",
  "`": "̀",
  "^": "̂",
  '"': "̈",
  "~": "̃",
  "=": "̄",
  ".": "̇",
  u: "̆",
  v: "̌",
  H: "̋",
  c: "̧",
  k: "̨",
  r: "̊",
  d: "̣",
  b: "̱",
};

const SYMBOLS: Record<string, string> = {
  ss: "ß", o: "ø", O: "Ø", ae: "æ", AE: "Æ", oe: "œ", OE: "Œ", aa: "å", AA: "Å", l: "ł", L: "Ł", i: "ı", j: "ȷ",
  textendash: "–", textemdash: "—", textquoteright: "’", textquoteleft: "‘", textquotedblleft: "“", textquotedblright: "”",
  textasciitilde: "~", textasciicircum: "^", textbackslash: "\\", textregistered: "®", texttrademark: "™", textcopyright: "©",
  dag: "†", S: "§", P: "¶", pounds: "£", euro: "€", ldots: "…", dots: "…", textellipsis: "…",
};

export function latexToUnicode(input: string): string {
  // Protect escaped braces so the final brace-stripping pass keeps them.
  let s = input.replace(/\\\{/g, OPEN_MARK).replace(/\\\}/g, CLOSE_MARK);
  // Formatting commands with one argument: keep the content.
  for (let i = 0; i < 5; i++) {
    s = s.replace(/\\(?:emph|textit|textbf|textsc|textrm|textsf|texttt|textup|mbox|text|url|href\{[^{}]*\})\s*\{([^{}]*)\}/g, "$1");
  }
  // Accents: \'e, \'{e}, {\'e}, \c{c}, \"{\i}
  s = s.replace(/\\(['`^"~=.]|[uvHckrdb](?=[\s{]))\s*(?:\{\s*(\\[ij]|[A-Za-z])\s*\}|(\\[ij](?![A-Za-z])\s?|[A-Za-z]))/g, (_m, acc: string, a?: string, b?: string) => {
    let letter = (a ?? b ?? "").trim();
    if (letter === "\\i") letter = "i";
    if (letter === "\\j") letter = "j";
    return (letter + (ACCENTS[acc] ?? "")).normalize("NFC");
  });
  s = s.replace(/\\([A-Za-z]+)(?:\{\}|\s+|(?![A-Za-z]))/g, (m, name: string) => SYMBOLS[name] ?? m);
  s = s.replace(/\\([&%$#_{}])/g, "$1");
  s = s.replace(/---/g, "—").replace(/--/g, "–");
  s = s.replace(/``|''/g, (q) => (q === "``" ? "“" : "”"));
  s = s.replace(/(?<!\\)~/g, " ");
  s = s.replace(/\\\\/g, " ");
  // Remaining grouping braces.
  s = s.replace(/(?<!\\)[{}]/g, "");
  return clean(s.split(OPEN_MARK).join("{").split(CLOSE_MARK).join("}"));
}

const OPEN_MARK = "\u{E000}";
const CLOSE_MARK = "\u{E001}";

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

export interface BibEntry {
  type: string;
  key: string;
  fields: Record<string, string>;
  line: number;
}

export interface BibParseResult {
  entries: BibEntry[];
  errors: string[];
  warnings: string[];
}

const DEFAULT_MACROS: Record<string, string> = Object.fromEntries(
  MONTH_MACROS.map((m, i) => [m, ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][i]]),
);

export function parseBibtex(text: string): BibParseResult {
  const entries: BibEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const macros: Record<string, string> = { ...DEFAULT_MACROS };
  let i = 0;
  const n = text.length;
  const lineAt = (pos: number) => text.slice(0, pos).split("\n").length;
  const ws = () => {
    while (i < n && /\s/.test(text[i])) i++;
  };

  /** Reads a balanced {...} starting at text[i] === "{"; returns inner text. */
  const readBraced = (): string | null => {
    let depth = 0;
    const start = i + 1;
    for (; i < n; i++) {
      const c = text[i];
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          i++;
          return text.slice(start, i - 1);
        }
      }
    }
    return null;
  };

  const readQuoted = (): string | null => {
    let depth = 0;
    const start = ++i;
    for (; i < n; i++) {
      const c = text[i];
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === '"' && depth === 0) {
        i++;
        return text.slice(start, i - 1);
      }
    }
    return null;
  };

  const readValue = (entryLine: number): string | null => {
    const parts: string[] = [];
    for (;;) {
      ws();
      const c = text[i];
      let part: string | null;
      if (c === "{") part = readBraced();
      else if (c === '"') part = readQuoted();
      else {
        const m = /^[A-Za-z0-9_.:+\-/']+/.exec(text.slice(i, i + 200));
        if (!m) return null;
        i += m[0].length;
        const word = m[0];
        if (/^\d+$/.test(word)) part = word;
        else {
          const k = word.toLowerCase();
          if (k in macros) part = macros[k];
          else {
            warnings.push(`Line ${entryLine}: unknown macro “${word}” kept as text.`);
            part = word;
          }
        }
      }
      if (part === null) return null;
      parts.push(part);
      ws();
      if (text[i] === "#") {
        i++;
        continue;
      }
      return parts.join("");
    }
  };

  while (i < n) {
    const at = text.indexOf("@", i);
    if (at < 0) break;
    i = at + 1;
    const typeMatch = /^[A-Za-z]+/.exec(text.slice(i, i + 40));
    if (!typeMatch) continue;
    const type = typeMatch[0].toLowerCase();
    i += typeMatch[0].length;
    ws();
    const open = text[i];
    if (open !== "{" && open !== "(") {
      if (type !== "comment") errors.push(`Line ${lineAt(at)}: expected “{” after @${type}.`);
      continue;
    }
    const close = open === "{" ? "}" : ")";
    const entryLine = lineAt(at);
    if (type === "comment" || type === "preamble") {
      if (open === "{") {
        if (readBraced() === null) {
          errors.push(`Line ${entryLine}: unterminated @${type}.`);
          break;
        }
      } else {
        const end = text.indexOf(")", i);
        i = end < 0 ? n : end + 1;
      }
      continue;
    }
    i++;
    if (type === "string") {
      ws();
      const m = /^[A-Za-z][\w-]*/.exec(text.slice(i, i + 100));
      if (!m) {
        errors.push(`Line ${entryLine}: malformed @string.`);
        continue;
      }
      i += m[0].length;
      ws();
      if (text[i] !== "=") {
        errors.push(`Line ${entryLine}: @string ${m[0]} is missing “=”.`);
        continue;
      }
      i++;
      const v = readValue(entryLine);
      if (v === null) {
        errors.push(`Line ${entryLine}: could not read the value of @string ${m[0]}.`);
        continue;
      }
      macros[m[0].toLowerCase()] = v;
      ws();
      if (text[i] === close) i++;
      continue;
    }
    ws();
    const keyEnd = text.slice(i).search(/[,\s}]/);
    const key = keyEnd < 0 ? "" : text.slice(i, i + keyEnd).trim();
    i += Math.max(0, keyEnd);
    ws();
    if (text[i] === ",") i++;
    const fields: Record<string, string> = {};
    let ok = true;
    for (;;) {
      ws();
      if (i >= n) {
        errors.push(`Line ${entryLine}: entry “${key || type}” is not closed.`);
        ok = false;
        break;
      }
      if (text[i] === close) {
        i++;
        break;
      }
      const fm = /^[A-Za-z][\w:.+-]*/.exec(text.slice(i, i + 100));
      if (!fm) {
        errors.push(`Line ${lineAt(i)}: unexpected “${text[i]}” in entry “${key || type}”.`);
        ok = false;
        // Skip to the next entry.
        const next = text.indexOf("@", i);
        i = next < 0 ? n : next;
        break;
      }
      i += fm[0].length;
      ws();
      if (text[i] !== "=") {
        errors.push(`Line ${lineAt(i)}: field “${fm[0]}” in “${key || type}” is missing “=”.`);
        ok = false;
        const next = text.indexOf("@", i);
        i = next < 0 ? n : next;
        break;
      }
      i++;
      const v = readValue(entryLine);
      if (v === null) {
        errors.push(`Line ${lineAt(i)}: could not read field “${fm[0]}” in “${key || type}” (unbalanced braces or quotes?).`);
        ok = false;
        const next = text.indexOf("@", i);
        i = next < 0 ? n : next;
        break;
      }
      fields[fm[0].toLowerCase()] = v;
      ws();
      if (text[i] === ",") i++;
    }
    if (ok) {
      if (!key) warnings.push(`Line ${entryLine}: @${type} entry has no citation key.`);
      entries.push({ type, key, fields, line: entryLine });
    }
  }
  return { entries, errors, warnings };
}

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

/** Splits on a separator at brace depth 0. */
function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (depth === 0) {
      sep.lastIndex = i;
      const m = sep.exec(s);
      if (m && m.index === i) {
        out.push(s.slice(last, i));
        i += m[0].length - 1;
        last = i + 1;
      }
    }
  }
  out.push(s.slice(last));
  return out.map((x) => x.trim()).filter(Boolean);
}

function matchingBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

/** Parses one BibTeX name in "First von Last", "von Last, First" or "von Last, Jr, First" form. */
export function parseBibName(raw: string): Name {
  const t = raw.trim();
  if (t.startsWith("{") && matchingBrace(t, 0) === t.length - 1) {
    return { given: "", family: latexToUnicode(t), org: true };
  }
  const parts = splitTop(t, /,/y);
  if (parts.length >= 2) {
    const family = latexToUnicode(parts[0]);
    const given = latexToUnicode(parts.length === 3 ? parts[2] : parts[1]);
    const jr = parts.length === 3 ? latexToUnicode(parts[1]) : "";
    return { given, family: jr ? `${family}, ${jr}` : family };
  }
  const words = splitTop(t, /\s+/y);
  if (words.length === 1) return { given: "", family: latexToUnicode(words[0]) };
  let vonStart = -1;
  for (let k = 1; k < words.length - 1; k++) {
    if (/^[a-z]/.test(words[k])) {
      vonStart = k;
      break;
    }
  }
  const split = vonStart > 0 ? vonStart : words.length - 1;
  return { given: latexToUnicode(words.slice(0, split).join(" ")), family: latexToUnicode(words.slice(split).join(" ")) };
}

export function parseBibNames(value: string): Name[] {
  return splitTop(value, /\s+and\s+/iy)
    .filter((x) => x.toLowerCase() !== "others")
    .map(parseBibName);
}

/* ------------------------------------------------------------------ */
/* Entry → Source                                                      */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function parseMonth(v: string): string {
  const s = v.trim().toLowerCase().replace(/\.$/, "");
  if (/^\d{1,2}$/.test(s) && Number(s) >= 1 && Number(s) <= 12) return String(Number(s));
  const idx = MONTH_NAMES.findIndex((m) => m === s || m.slice(0, 3) === s.slice(0, 3));
  return idx >= 0 && s.length >= 3 ? String(idx + 1) : "";
}

function parseIsoDate(v: string): PartialDate {
  const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(v.trim());
  if (!m) return { ...emptyDate(), year: v.trim() };
  return { year: m[1], month: m[2] ? String(Number(m[2])) : "", day: m[3] ? String(Number(m[3])) : "" };
}

export function entryToSource(e: BibEntry, id: string): Source {
  const f = (k: string) => (e.fields[k] !== undefined ? latexToUnicode(e.fields[k]) : "");
  let type: SourceType;
  switch (e.type) {
    case "article":
      type = /newspaper|magazine/i.test(e.fields.entrysubtype ?? "") ? "news" : "journal";
      break;
    case "book":
    case "booklet":
    case "proceedings":
    case "collection":
    case "mvbook":
      type = "book";
      break;
    case "incollection":
    case "inbook":
    case "bookinbook":
      type = "chapter";
      break;
    case "inproceedings":
    case "conference":
      type = "conference";
      break;
    case "techreport":
    case "report":
    case "manual":
    case "unpublished":
      type = "report";
      break;
    case "phdthesis":
    case "mastersthesis":
    case "thesis":
      type = "thesis";
      break;
    case "online":
    case "electronic":
    case "www":
    case "webpage":
      type = "webpage";
      break;
    default:
      type = e.fields.journal || e.fields.journaltitle ? "journal" : e.fields.url || /\\url/.test(e.fields.howpublished ?? "") ? "webpage" : "book";
  }
  const date: PartialDate = e.fields.date ? parseIsoDate(f("date")) : { year: f("year"), month: parseMonth(f("month")), day: f("day") };
  if (!date.year && e.fields.year) date.year = f("year");
  if (!date.month && e.fields.month) date.month = parseMonth(f("month"));
  let url = e.fields.url ? e.fields.url.trim() : "";
  if (!url && e.fields.howpublished) {
    const m = /\\url\{([^}]*)\}/.exec(e.fields.howpublished);
    if (m) url = m[1];
  }
  const thesisType: "phd" | "masters" =
    e.type === "mastersthesis" || /master|m\.?a\.?|m\.?s\.?c?/i.test(e.fields.type ?? "") ? "masters" : "phd";
  const container =
    type === "journal" || type === "news"
      ? f("journal") || f("journaltitle")
      : type === "chapter" || type === "conference"
        ? f("booktitle") || f("maintitle")
        : type === "webpage"
          ? f("organization") || f("publisher") || (e.fields.howpublished && !/\\url/.test(e.fields.howpublished) ? f("howpublished") : "")
          : "";
  const publisher =
    type === "report"
      ? f("institution") || f("publisher") || f("organization")
      : type === "thesis"
        ? f("school") || f("institution")
        : type === "webpage"
          ? ""
          : f("publisher") || f("organization");
  return {
    id,
    type,
    authors: e.fields.author ? parseBibNames(e.fields.author) : [],
    editors: e.fields.editor ? parseBibNames(e.fields.editor) : [],
    title: f("title"),
    container,
    publisher,
    place: f("address") || f("location"),
    edition: f("edition"),
    volume: f("volume"),
    issue: type === "report" ? "" : f("number") || f("issue"),
    pages: f("pages"),
    number: type === "report" ? f("number") : "",
    thesisType,
    date,
    accessed: e.fields.urldate ? parseIsoDate(f("urldate")) : emptyDate(),
    doi: e.fields.doi ? normalizeDoi(e.fields.doi) || e.fields.doi.trim() : "",
    url,
  };
}
