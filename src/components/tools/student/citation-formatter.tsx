"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Btn,
  CellInput,
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SelectField,
  SplitGrid,
  TextArea,
  TextField,
  ToolPanel,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Style = "apa" | "mla";
type SourceType = "book" | "journal" | "website" | "chapter";
type Person = { id: string; given: string; family: string };
type Seg = { t: string; i?: boolean };

type Form = {
  orgAuthor: boolean;
  org: string;
  authors: Person[];
  editors: Person[];
  year: string;
  month: string;
  day: string;
  title: string;
  container: string;
  volume: string;
  issue: string;
  pages: string;
  publisher: string;
  edition: string;
  doi: string;
  url: string;
  accessed: string;
};

type Saved = { id: string; style: Style; plain: string; segs: Seg[] };

const EMPTY_FORM: Form = {
  orgAuthor: false,
  org: "",
  authors: [{ id: "a0", given: "", family: "" }],
  editors: [{ id: "e0", given: "", family: "" }],
  year: "",
  month: "",
  day: "",
  title: "",
  container: "",
  volume: "",
  issue: "",
  pages: "",
  publisher: "",
  edition: "",
  doi: "",
  url: "",
  accessed: "",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MLA_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

const TYPE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "book", label: "Book" },
  { value: "journal", label: "Journal article" },
  { value: "website", label: "Web page" },
  { value: "chapter", label: "Chapter in an edited book" },
];

const CONTAINER_LABEL: Record<SourceType, string> = {
  book: "",
  journal: "Journal name",
  website: "Website name",
  chapter: "Book title",
};

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

const clean = (s: string) => s.trim().replace(/\s+/g, " ");
const endsTerminal = (s: string) => /[.?!]["'”’]*$/.test(s.trimEnd());

function initials(given: string) {
  return clean(given)
    .split(" ")
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .map((p) => {
          const ch = Array.from(p.replace(/\./g, ""))[0];
          return ch ? `${ch.toLocaleUpperCase()}.` : "";
        })
        .filter(Boolean)
        .join("-"),
    )
    .filter(Boolean)
    .join(" ");
}

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function editionText(raw: string) {
  const e = clean(raw);
  if (!e) return "";
  if (/^\d+$/.test(e)) return Number(e) <= 1 ? "" : `${ordinal(Number(e))} ed.`;
  if (/^\d+(st|nd|rd|th)$/i.test(e)) return `${e.toLowerCase()} ed.`;
  return /\bed\.?$/i.test(e) ? e.replace(/\bed$/i, "ed.") : `${e} ed.`;
}

const pagesText = (raw: string) => clean(raw).replace(/\s*[-‐-—]+\s*/g, "–");
const isRange = (p: string) => /[–,]/.test(p);

function normalizeDoi(raw: string) {
  return clean(raw)
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
}

const isHttpUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

const SMALL_WORDS = new Set(
  "a an the and but or nor for so yet as at by from in into like near of off on onto out over past per than to up upon via with vs".split(
    " ",
  ),
);

const hasInnerCaps = (w: string) => /\p{Lu}/u.test(Array.from(w).slice(1).join(""));

function capFirst(w: string) {
  return w.replace(/\p{L}/u, (c) => c.toLocaleUpperCase());
}

/** APA-style sentence case. Keeps acronyms and words with inner capitals (DNA, iPhone). */
function toSentenceCase(s: string) {
  let capNext = true;
  return s
    .split(/(\s+)/)
    .map((tok) => {
      if (!tok.trim()) return tok;
      let out: string;
      if (hasInnerCaps(tok)) out = capNext ? capFirst(tok) : tok;
      else out = capNext ? capFirst(tok.toLocaleLowerCase()) : tok.toLocaleLowerCase();
      capNext = /[:?!.]["'”’)]*$/.test(tok);
      return out;
    })
    .join("");
}

/** MLA title case: capitalize principal words; lowercase articles, prepositions and conjunctions mid-title. */
function toTitleCase(s: string) {
  const tokens = s.split(/(\s+)/);
  const wordIdx = tokens.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
  const first = wordIdx[0];
  const last = wordIdx[wordIdx.length - 1];
  let afterColon = false;
  return tokens
    .map((tok, i) => {
      if (!tok.trim()) return tok;
      const bare = tok.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      const forceCap = i === first || i === last || afterColon;
      afterColon = /[:?!.]["'”’)]*$/.test(tok);
      if (hasInnerCaps(tok)) return tok;
      if (!forceCap && SMALL_WORDS.has(bare)) return tok.toLocaleLowerCase();
      return tok
        .toLocaleLowerCase()
        .split("-")
        .map((p) => capFirst(p))
        .join("-");
    })
    .join("");
}

/* ------------------------------------------------------------------ */
/* Citation builder                                                    */
/* ------------------------------------------------------------------ */

class Out {
  segs: Seg[] = [];
  add(t: string, i = false) {
    if (t) this.segs.push(i ? { t, i: true } : { t });
    return this;
  }
  text() {
    return this.segs.map((s) => s.t).join("");
  }
  /** Ends the current element with a period (unless it already ends with . ? !) and a space. */
  stop() {
    const t = this.text().trimEnd();
    if (t && !endsTerminal(t)) this.add(".");
    return this.add(" ");
  }
}

const people = (list: Person[]) =>
  list.map((p) => ({ given: clean(p.given), family: clean(p.family) })).filter((p) => p.family);

function apaAuthorList(f: Form) {
  if (f.orgAuthor) return clean(f.org);
  const names = people(f.authors).map((p) => {
    const ini = initials(p.given);
    return ini ? `${p.family}, ${ini}` : p.family;
  });
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  if (names.length <= 20) return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  return `${names.slice(0, 19).join(", ")}, . . . ${names[names.length - 1]}`;
}

function apaEditors(list: Person[]) {
  const names = people(list).map((p) => {
    const ini = initials(p.given);
    return ini ? `${ini} ${p.family}` : p.family;
  });
  if (names.length === 0) return { text: "", count: 0 };
  if (names.length === 1) return { text: names[0], count: 1 };
  if (names.length === 2) return { text: `${names[0]} & ${names[1]}`, count: 2 };
  return { text: `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`, count: names.length };
}

function mlaAuthorList(f: Form) {
  if (f.orgAuthor) return clean(f.org);
  const list = people(f.authors);
  if (list.length === 0) return "";
  const inverted = list[0].given ? `${list[0].family}, ${list[0].given}` : list[0].family;
  if (list.length === 1) return inverted;
  if (list.length === 2) {
    const second = [list[1].given, list[1].family].filter(Boolean).join(" ");
    return `${inverted}, and ${second}`;
  }
  return `${inverted}, et al.`;
}

function mlaEditors(list: Person[]) {
  const names = people(list).map((p) => [p.given, p.family].filter(Boolean).join(" "));
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} et al.`;
}

function buildApa(type: SourceType, f: Form): Seg[] {
  const o = new Out();
  const author = apaAuthorList(f);
  const title = clean(f.title);
  const container = clean(f.container);
  const year = clean(f.year);
  const month = f.month ? MONTHS[Number(f.month) - 1] : "";
  const day = clean(f.day);
  let date = year || "n.d.";
  if (type === "website" && year && month) date = `${year}, ${month}${day ? ` ${day}` : ""}`;
  const ed = editionText(f.edition);
  const pages = pagesText(f.pages);
  const doi = normalizeDoi(f.doi);
  const link = doi ? `https://doi.org/${doi}` : clean(f.url);
  const italicTitle = type === "book" || type === "website";

  const titlePart = () => {
    if (italicTitle) {
      o.add(title, true);
      if (type === "book" && ed) o.add(` (${ed})`);
    } else o.add(title);
  };

  if (author) {
    o.add(author).stop();
    o.add(`(${date})`).stop();
    titlePart();
    o.stop();
  } else {
    // No author: the title moves to the author position.
    titlePart();
    o.stop();
    o.add(`(${date})`).stop();
  }

  if (type === "book") {
    if (clean(f.publisher)) o.add(clean(f.publisher)).stop();
  } else if (type === "journal") {
    if (container) {
      o.add(container, true);
      const vol = clean(f.volume);
      const iss = clean(f.issue);
      if (vol) {
        o.add(", ").add(vol, true);
        if (iss) o.add(`(${iss})`);
      } else if (iss) o.add(`, (${iss})`);
      if (pages) o.add(`, ${pages}`);
      o.stop();
    }
  } else if (type === "website") {
    if (container && container.toLocaleLowerCase() !== author.toLocaleLowerCase()) o.add(container).stop();
  } else if (type === "chapter") {
    const eds = apaEditors(f.editors);
    o.add("In ");
    if (eds.count) o.add(`${eds.text} (${eds.count === 1 ? "Ed." : "Eds."}), `);
    if (container) o.add(container, true);
    const paren = [ed, pages ? `${isRange(pages) ? "pp." : "p."} ${pages}` : ""].filter(Boolean).join(", ");
    if (paren) o.add(` (${paren})`);
    o.stop();
    if (clean(f.publisher)) o.add(clean(f.publisher)).stop();
  }

  if (link) o.add(link);
  return trimSegs(o.segs);
}

function mlaDate(f: Form, style: "full" | "monthYear") {
  const year = clean(f.year);
  if (!year) return "";
  const m = f.month ? MLA_MONTHS[Number(f.month) - 1] : "";
  const d = clean(f.day);
  if (style === "full" && m && d) return `${Number(d)} ${m} ${year}`;
  if (m) return `${m} ${year}`;
  return year;
}

function buildMla(type: SourceType, f: Form): Seg[] {
  const o = new Out();
  const author = mlaAuthorList(f);
  const title = clean(f.title);
  const container = clean(f.container);
  const ed = editionText(f.edition);
  const pages = pagesText(f.pages);
  const pagePart = pages ? `${isRange(pages) ? "pp." : "p."} ${pages}` : "";
  const doi = normalizeDoi(f.doi);
  const url = clean(f.url).replace(/^https?:\/\//i, "");
  const location = doi ? `https://doi.org/${doi}` : url;
  const publisher = clean(f.publisher);

  if (author) o.add(author).stop();

  if (title) {
    if (type === "book") {
      o.add(title, true).stop();
    } else {
      o.add(`“${endsTerminal(title) ? title : `${title}.`}” `);
    }
  }

  // Container elements, separated by commas, ending with a period.
  const parts: Seg[][] = [];
  const push = (t: string, i = false) => {
    if (t) parts.push([i ? { t, i: true } : { t }]);
  };

  if (type === "book") {
    push(ed);
    push(publisher);
    push(mlaDate(f, "monthYear"));
  } else if (type === "journal") {
    push(container, true);
    if (clean(f.volume)) push(`vol. ${clean(f.volume)}`);
    if (clean(f.issue)) push(`no. ${clean(f.issue)}`);
    push(mlaDate(f, "monthYear"));
    push(pagePart);
  } else if (type === "website") {
    push(container, true);
    if (publisher && publisher.toLocaleLowerCase() !== container.toLocaleLowerCase()) push(publisher);
    push(mlaDate(f, "full"));
  } else if (type === "chapter") {
    push(container, true);
    const eds = mlaEditors(f.editors);
    if (eds) push(`edited by ${eds}`);
    push(ed);
    push(publisher);
    push(mlaDate(f, "monthYear"));
    push(pagePart);
  }
  if (location) push(location);

  parts.forEach((p, idx) => {
    if (idx > 0) o.add(", ");
    p.forEach((s) => o.add(s.t, s.i));
  });
  if (parts.length) o.stop();

  if (type === "website") {
    const acc = parseIsoDate(f.accessed);
    if (acc) o.add(`Accessed ${acc.getDate()} ${MLA_MONTHS[acc.getMonth()]} ${acc.getFullYear()}.`);
  }
  return trimSegs(o.segs);
}

function trimSegs(segs: Seg[]): Seg[] {
  const out = segs.map((s) => ({ ...s }));
  while (out.length && !out[out.length - 1].t.trim()) out.pop();
  if (out.length) out[out.length - 1].t = out[out.length - 1].t.trimEnd();
  // merge adjacent segments with the same styling
  const merged: Seg[] = [];
  for (const s of out) {
    const prev = merged[merged.length - 1];
    if (prev && !!prev.i === !!s.i) prev.t += s.t;
    else merged.push(s);
  }
  return merged;
}

/** Maps the user's edited text back onto the generated segments so italics survive small edits. */
function mapEdited(text: string, segs: Seg[]): Seg[] {
  const marks: [number, number][] = [];
  let cursor = 0;
  for (const s of segs) {
    const needle = s.t.trim();
    if (!needle || (!s.i && needle.length < 4)) continue;
    const idx = text.indexOf(needle, cursor);
    if (idx < 0) continue;
    if (s.i) marks.push([idx, idx + needle.length]);
    cursor = idx + needle.length;
  }
  const out: Seg[] = [];
  let pos = 0;
  for (const [a, b] of marks) {
    if (a > pos) out.push({ t: text.slice(pos, a) });
    out.push({ t: text.slice(a, b), i: true });
    pos = b;
  }
  if (pos < text.length) out.push({ t: text.slice(pos) });
  return out;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const segsToHtml = (segs: Seg[]) => segs.map((s) => (s.i ? `<i>${escapeHtml(s.t)}</i>` : escapeHtml(s.t))).join("");

function Formatted({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) => (s.i ? <i key={i}>{s.t}</i> : <span key={i}>{s.t}</span>))}
    </>
  );
}

const sortKey = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "");

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

type Generated = { segs: Seg[]; plain: string; snapshot: string; style: Style };

export default function Tool() {
  const [style, setStyle] = useState<Style>("apa");
  const [type, setType] = useState<SourceType>("journal");
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [editText, setEditText] = useState("");
  const [caseUndo, setCaseUndo] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [htmlState, setHtmlState] = useState<"idle" | "done" | "fallback" | "error">("idle");
  const [confirmClear, setConfirmClear] = useState(false);
  const htmlTimer = useRef<number | null>(null);

  const [savedRaw, setSaved, clearSaved] = usePersistentState<Saved[]>("citations", []);
  const saved = useMemo(
    () =>
      (Array.isArray(savedRaw) ? savedRaw : []).slice().sort((a, b) =>
        sortKey(a.plain).localeCompare(sortKey(b.plain), "en", { sensitivity: "base" }),
      ),
    [savedRaw],
  );

  useEffect(
    () => () => {
      if (htmlTimer.current) window.clearTimeout(htmlTimer.current);
    },
    [],
  );

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const updatePerson = (key: "authors" | "editors", id: string, patch: Partial<Person>) =>
    setForm((f) => ({ ...f, [key]: f[key].map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const addPerson = (key: "authors" | "editors") =>
    setForm((f) => ({ ...f, [key]: [...f[key], { id: uid(), given: "", family: "" }] }));
  const removePerson = (key: "authors" | "editors", id: string) =>
    setForm((f) => {
      const next = f[key].filter((p) => p.id !== id);
      return { ...f, [key]: next.length ? next : [{ id: uid(), given: "", family: "" }] };
    });

  /* Which fields this source type uses */
  const show = {
    container: type !== "book",
    volume: type === "journal",
    issue: type === "journal",
    pages: type === "journal" || type === "chapter",
    publisher: type === "book" || type === "chapter" || (type === "website" && style === "mla"),
    edition: type === "book" || type === "chapter",
    editors: type === "chapter",
    monthDay: type === "website" || (type === "journal" && style === "mla"),
    day: type === "website",
    accessed: type === "website" && style === "mla",
  };

  /* Validation */
  const errors = {
    title: !clean(form.title) ? "Enter the title of the source." : null,
    org: form.orgAuthor && !clean(form.org) ? "Enter the organization name or untick the option." : null,
    year: clean(form.year) && !/^\d{4}[a-z]?$/.test(clean(form.year)) ? "Use a 4-digit year, like 2024." : null,
    day:
      show.day && clean(form.day)
        ? !/^\d{1,2}$/.test(clean(form.day)) || Number(form.day) < 1 || Number(form.day) > 31
          ? "Use a day from 1 to 31."
          : !form.month
            ? "Choose a month to go with the day."
            : null
        : null,
    url: clean(form.url) && !isHttpUrl(clean(form.url)) ? "Enter a full web address starting with http:// or https://." : null,
    doi:
      clean(form.doi) && !/^10\.\d{4,9}\/\S+$/.test(normalizeDoi(form.doi))
        ? "A DOI looks like 10.1234/abcd. You can paste the full https://doi.org/ link."
        : null,
    accessed: show.accessed && form.accessed && !parseIsoDate(form.accessed) ? "Choose a valid date." : null,
  };
  const personError = (p: Person) => (clean(p.given) && !clean(p.family) ? "Add a family name for this person." : null);
  const authorErrors = form.orgAuthor ? [] : form.authors.map(personError);
  const editorErrors = show.editors ? form.editors.map(personError) : [];
  const hasErrors =
    Object.values(errors).some(Boolean) || authorErrors.some(Boolean) || editorErrors.some(Boolean);

  const warnings: string[] = [];
  if (!form.orgAuthor && people(form.authors).length === 0) warnings.push("No author entered. The title will lead the citation.");
  if (show.container && !clean(form.container)) warnings.push(`${CONTAINER_LABEL[type]} is empty.`);
  if (type === "website" && !clean(form.url)) warnings.push("Web pages should include a URL.");
  if (!clean(form.year)) warnings.push(style === "apa" ? "No year entered, so APA uses (n.d.)." : "No year entered, so the date is left out.");

  const snapshot = JSON.stringify({ style, type, form });
  const stale = generated !== null && generated.snapshot !== snapshot;

  const generate = () => {
    setSubmitted(true);
    if (hasErrors) {
      setStatus("Fix the highlighted fields, then generate again.");
      return;
    }
    const segs = style === "apa" ? buildApa(type, form) : buildMla(type, form);
    const plain = segs.map((s) => s.t).join("");
    setGenerated({ segs, plain, snapshot, style });
    setEditText(plain);
    setStatus("Citation generated. You can edit it below before copying.");
  };

  const displaySegs = useMemo(
    () => (generated ? (editText === generated.plain ? generated.segs : mapEdited(editText, generated.segs)) : []),
    [generated, editText],
  );

  const copyHtml = async () => {
    const html = segsToHtml(displaySegs);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([editText], { type: "text/plain" }),
          }),
        ]);
        setHtmlState("done");
      } else {
        await navigator.clipboard.writeText(editText);
        setHtmlState("fallback");
      }
    } catch {
      setHtmlState("error");
    }
    if (htmlTimer.current) window.clearTimeout(htmlTimer.current);
    htmlTimer.current = window.setTimeout(() => setHtmlState("idle"), 2400);
  };

  const saveCurrent = () => {
    if (!generated || !editText.trim()) return;
    const plain = editText.trim();
    if (saved.some((s) => s.plain === plain)) {
      setStatus("That citation is already in your list.");
      return;
    }
    setSaved((prev) => [...(Array.isArray(prev) ? prev : []), { id: uid(), style: generated.style, plain, segs: displaySegs }]);
    setStatus("Citation saved to your list.");
  };

  const applyCase = () => {
    const before = form.title;
    const after = style === "apa" ? toSentenceCase(before) : toTitleCase(before);
    if (after === before) {
      setStatus("The title already matches that case.");
      return;
    }
    setCaseUndo(before);
    set("title", after);
    setStatus(`Applied ${style === "apa" ? "sentence" : "title"} case to the title. Check proper nouns.`);
  };

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      authors: [{ id: uid(), given: "", family: "" }],
      editors: [{ id: uid(), given: "", family: "" }],
    });
    setSubmitted(false);
    setGenerated(null);
    setEditText("");
    setCaseUndo(null);
    setStatus("Form cleared.");
  };

  const allPlain = saved.map((s) => s.plain).join("\n\n");

  const personRows = (key: "authors" | "editors", noun: "Author" | "Editor", errs: (string | null)[]) => (
    <div className="space-y-3">
      {form[key].map((p, i) => (
        <fieldset key={p.id} className="rounded-lg bg-sunken p-3">
          <legend className="sr-only">{`${noun} ${i + 1}`}</legend>
          <p aria-hidden="true" className="mb-2 text-[0.8125rem] font-medium text-ink-2">{`${noun} ${i + 1}`}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <CellInput
              label={`${noun} ${i + 1} given names`}
              placeholder="Given names, e.g. Ada M."
              value={p.given}
              onChange={(e) => updatePerson(key, p.id, { given: e.target.value })}
              autoComplete="off"
            />
            <CellInput
              label={`${noun} ${i + 1} family name`}
              placeholder="Family name, e.g. Lovelace"
              value={p.family}
              invalid={submitted && !!errs[i]}
              onChange={(e) => updatePerson(key, p.id, { family: e.target.value })}
              autoComplete="off"
            />
            <Btn
              variant="subtle"
              icon="trash"
              onClick={() => removePerson(key, p.id)}
              aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`}
              className="!px-3"
            >
              <span className="sm:sr-only">Remove</span>
            </Btn>
          </div>
          {submitted && errs[i] && (
            <p className="mt-2 text-sm text-danger" role="alert">
              {errs[i]}
            </p>
          )}
        </fieldset>
      ))}
      <Btn variant="ghost" icon="plus" onClick={() => addPerson(key)}>
        Add {noun.toLowerCase()}
      </Btn>
    </div>
  );

  return (
    <div className="space-y-5">
      <Notice tone="warning" title="Check before you submit">
        Always check against your institution&apos;s guide; this tool covers common cases only. It follows APA 7th
        edition and MLA 9th edition for the four source types listed.
      </Notice>

      <SplitGrid>
        <ToolPanel title="Source details" actions={<ResetBtn label="Clear form" onClick={resetForm} />}>
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Citation style</p>
              <Segmented
                label="Citation style"
                value={style}
                onChange={setStyle}
                options={[
                  { value: "apa", label: "APA 7th" },
                  { value: "mla", label: "MLA 9th" },
                ]}
              />
            </div>
            <SelectField
              label="Source type"
              value={type}
              onChange={(e) => setType(e.target.value as SourceType)}
              options={TYPE_OPTIONS}
            />

            <div className="space-y-3">
              <p className="text-sm font-medium text-ink">Authors</p>
              <Checkbox
                label="The author is an organization"
                hint="For example a government agency, company or association."
                checked={form.orgAuthor}
                onChange={(v) => set("orgAuthor", v)}
              />
              {form.orgAuthor ? (
                <TextField
                  label="Organization name"
                  value={form.org}
                  onChange={(e) => set("org", e.target.value)}
                  placeholder="e.g. World Health Organization"
                  error={submitted ? errors.org : null}
                />
              ) : (
                personRows("authors", "Author", authorErrors)
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="Year"
                inputMode="numeric"
                value={form.year}
                onChange={(e) => set("year", e.target.value)}
                placeholder="e.g. 2024"
                error={errors.year}
                optional
                className={show.monthDay ? "" : "sm:col-span-3"}
              />
              {show.monthDay && (
                <SelectField
                  label="Month"
                  optional
                  value={form.month}
                  onChange={(e) => set("month", e.target.value)}
                  options={[{ value: "", label: "None" }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))]}
                />
              )}
              {show.day && (
                <TextField
                  label="Day"
                  optional
                  inputMode="numeric"
                  value={form.day}
                  onChange={(e) => set("day", e.target.value)}
                  placeholder="e.g. 14"
                  error={submitted ? errors.day : null}
                />
              )}
            </div>

            <div>
              <TextField
                label={type === "chapter" ? "Chapter title" : type === "journal" ? "Article title" : type === "website" ? "Page title" : "Book title"}
                value={form.title}
                onChange={(e) => {
                  set("title", e.target.value);
                  setCaseUndo(null);
                }}
                error={submitted ? errors.title : null}
                hint={
                  style === "apa"
                    ? "APA uses sentence case for article, chapter, book and page titles: capitalize only the first word, the first word after a colon, and proper nouns."
                    : "MLA uses title case: capitalize the first, last and all major words."
                }
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Btn variant="ghost" onClick={applyCase} disabled={!form.title.trim()}>
                  {style === "apa" ? "Apply sentence case" : "Apply title case"}
                </Btn>
                {caseUndo !== null && (
                  <Btn
                    variant="subtle"
                    icon="reset"
                    onClick={() => {
                      set("title", caseUndo);
                      setCaseUndo(null);
                      setStatus("Title restored.");
                    }}
                  >
                    Undo case change
                  </Btn>
                )}
              </div>
              {caseUndo !== null && (
                <p className="mt-2 text-[0.8125rem] text-muted">
                  Automatic case changes can lowercase names and places. Check proper nouns.
                </p>
              )}
            </div>

            {show.container && (
              <TextField
                label={CONTAINER_LABEL[type]}
                value={form.container}
                onChange={(e) => set("container", e.target.value)}
                placeholder={type === "journal" ? "e.g. Journal of Computing Education" : type === "website" ? "e.g. BBC News" : "e.g. Handbook of Learning"}
                hint={type === "website" && style === "apa" ? "Left out automatically when it matches the organization author." : undefined}
              />
            )}

            {show.editors && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">
                  Editors <span className="font-normal text-muted">(optional)</span>
                </p>
                {personRows("editors", "Editor", editorErrors)}
              </div>
            )}

            {(show.volume || show.issue || show.pages) && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {show.volume && (
                  <TextField label="Volume" optional value={form.volume} onChange={(e) => set("volume", e.target.value)} placeholder="e.g. 12" />
                )}
                {show.issue && (
                  <TextField label="Issue" optional value={form.issue} onChange={(e) => set("issue", e.target.value)} placeholder="e.g. 3" />
                )}
                {show.pages && (
                  <TextField
                    label="Pages"
                    optional
                    value={form.pages}
                    onChange={(e) => set("pages", e.target.value)}
                    placeholder="e.g. 45-67"
                    className={show.volume ? "col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-3"}
                  />
                )}
              </div>
            )}

            {(show.edition || show.publisher) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {show.publisher && (
                  <TextField
                    label="Publisher"
                    optional
                    value={form.publisher}
                    onChange={(e) => set("publisher", e.target.value)}
                    placeholder="e.g. MIT Press"
                    className={show.edition ? "" : "sm:col-span-2"}
                  />
                )}
                {show.edition && (
                  <TextField
                    label="Edition"
                    optional
                    value={form.edition}
                    onChange={(e) => set("edition", e.target.value)}
                    placeholder="e.g. 2"
                    hint="Leave blank for a first edition."
                  />
                )}
              </div>
            )}

            {type !== "website" && (
              <TextField
                label="DOI"
                optional
                value={form.doi}
                onChange={(e) => set("doi", e.target.value)}
                placeholder="e.g. 10.1037/0000165-000"
                error={errors.doi}
                hint="If a DOI exists, it is used instead of the URL."
                autoComplete="off"
              />
            )}
            <TextField
              label="URL"
              optional={type !== "website"}
              type="url"
              inputMode="url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://"
              error={errors.url}
              autoComplete="off"
            />
            {show.accessed && (
              <TextField
                label="Date you accessed it"
                optional
                type="date"
                value={form.accessed}
                onChange={(e) => set("accessed", e.target.value)}
                error={errors.accessed}
                hint="MLA recommends this for web pages that may change."
              />
            )}

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Btn icon="quote" onClick={generate}>
                Generate citation
              </Btn>
            </div>
            {submitted && hasErrors && <Notice tone="error">Some fields need attention before the citation can be generated.</Notice>}
            <p className="sr-only" role="status" aria-live="polite">
              {status}
            </p>
          </div>
        </ToolPanel>

        <div className="space-y-5">
          <ToolPanel title="Citation">
            {!generated ? (
              <EmptyState icon="quote" title="No citation yet">
                Fill in the source details and select Generate citation.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                {stale && (
                  <Notice tone="info">The form has changed since this was generated. Generate again to update it.</Notice>
                )}
                <div className="rounded-xl bg-accent-soft p-4">
                  <p className="text-[0.8125rem] font-medium text-ink-2">
                    Preview ({generated.style === "apa" ? "APA 7th" : "MLA 9th"})
                  </p>
                  <p className="mt-1.5 break-words pl-6 -indent-6 leading-relaxed text-ink">
                    <Formatted segs={displaySegs} />
                  </p>
                </div>
                <TextArea
                  label="Edit before copying"
                  hint="Changes here update the preview. Italics are kept where the original wording is unchanged."
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                />
                {editText !== generated.plain && (
                  <Btn variant="subtle" icon="reset" onClick={() => setEditText(generated.plain)}>
                    Revert to generated text
                  </Btn>
                )}
                {warnings.length > 0 && !stale && (
                  <Notice tone="info" title="Worth a second look">
                    <ul className="list-disc space-y-0.5 pl-4">
                      {warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
                <div className="flex flex-wrap gap-2">
                  <CopyBtn text={editText} label="Copy plain text" />
                  <Btn variant="ghost" icon={htmlState === "done" ? "check" : "copy"} onClick={() => void copyHtml()} disabled={!editText.trim()}>
                    <span aria-live="polite">
                      {htmlState === "done"
                        ? "Copied with italics"
                        : htmlState === "fallback"
                          ? "Copied as plain text"
                          : htmlState === "error"
                            ? "Copy failed"
                            : "Copy with italics (HTML)"}
                    </span>
                  </Btn>
                  <Btn icon="plus" onClick={saveCurrent} disabled={!editText.trim()}>
                    Save to list
                  </Btn>
                </div>
                {htmlState === "fallback" && (
                  <p className="text-[0.8125rem] text-muted">
                    This browser cannot copy formatted text, so plain text was copied. Add italics in your document.
                  </p>
                )}
              </div>
            )}
          </ToolPanel>

          <ToolPanel
            title={`Saved citations${saved.length ? ` (${saved.length})` : ""}`}
            actions={saved.length > 0 ? <CopyBtn text={allPlain} label="Copy all" /> : undefined}
          >
            <div className="space-y-4">
              {saved.length === 0 ? (
                <EmptyState icon="book" title="Your list is empty">
                  Saved citations appear here in alphabetical order, ready for a reference list.
                </EmptyState>
              ) : (
                <ul className="space-y-2.5">
                  {saved.map((s) => (
                    <li key={s.id} className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
                      <p className="break-words pl-6 -indent-6 text-[0.95rem] leading-relaxed text-ink">
                        <Formatted segs={Array.isArray(s.segs) && s.segs.length ? s.segs : [{ t: s.plain }]} />
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="chip">{s.style === "apa" ? "APA 7th" : "MLA 9th"}</span>
                        <CopyBtn text={s.plain} />
                        <Btn
                          variant="danger"
                          icon="trash"
                          aria-label={`Remove citation: ${s.plain.slice(0, 60)}`}
                          onClick={() => {
                            setSaved((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== s.id));
                            setStatus("Citation removed.");
                          }}
                        >
                          Remove
                        </Btn>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {saved.length > 0 &&
                (confirmClear ? (
                  <Notice tone="warning" title="Remove all saved citations?">
                    <p>This cannot be undone.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn
                        variant="danger"
                        icon="trash"
                        onClick={() => {
                          clearSaved();
                          setConfirmClear(false);
                          setStatus("All saved citations removed.");
                        }}
                      >
                        Yes, remove all
                      </Btn>
                      <Btn variant="ghost" onClick={() => setConfirmClear(false)}>
                        Cancel
                      </Btn>
                    </div>
                  </Notice>
                ) : (
                  <Btn variant="danger" icon="trash" onClick={() => setConfirmClear(true)}>
                    Clear list
                  </Btn>
                ))}
              <p className="flex items-start gap-2 text-[0.8125rem] text-muted">
                <Icon name="info" size={16} className="mt-px shrink-0" />
                Copy all uses plain text with a blank line between entries.
              </p>
              <PrivacyNote stored />
            </div>
          </ToolPanel>
        </div>
      </SplitGrid>
    </div>
  );
}
