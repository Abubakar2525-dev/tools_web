import type { Name, PartialDate, Seg, Source } from "./types";

/* ------------------------------------------------------------------ */
/* Rich segments                                                       */
/* ------------------------------------------------------------------ */

export type Part = string | Seg | null | undefined | false | Part[];

export const it = (text: string): Seg => ({ text, italic: true });

function flatten(parts: Part[], out: Seg[]) {
  for (const p of parts) {
    if (p === null || p === undefined || p === false || p === "") continue;
    if (Array.isArray(p)) flatten(p, out);
    else if (typeof p === "string") out.push({ text: p });
    else if (p.text) out.push(p.italic ? { text: p.text, italic: true } : { text: p.text });
  }
}

/**
 * Joins parts into normalized segments: drops doubled punctuation at
 * boundaries ("Inc.." → "Inc.", "Why?." → "Why?"), collapses double spaces and
 * merges neighbouring runs with the same style.
 */
export function build(...parts: Part[]): Seg[] {
  const flat: Seg[] = [];
  flatten(parts, flat);
  const out: Seg[] = [];
  let prevChar = "";
  for (const seg of flat) {
    let text = seg.text;
    if (/[.?!]/.test(prevChar) && text.startsWith(".")) text = text.slice(1);
    if (/[?!]/.test(prevChar) && text.startsWith(",")) text = text.slice(1);
    if (prevChar === " " && text.startsWith(" ")) text = text.replace(/^ +/, "");
    if (prevChar === "" ) text = text.replace(/^ +/, "");
    text = text.replace(/ {2,}/g, " ");
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && !!last.italic === !!seg.italic) last.text += text;
    else out.push(seg.italic ? { text, italic: true } : { text });
    prevChar = text[text.length - 1];
  }
  if (out.length) out[out.length - 1].text = out[out.length - 1].text.replace(/ +$/, "");
  return out;
}

export const plainText = (segs: Seg[]) => segs.map((s) => s.text).join("");

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const segsToHtml = (segs: Seg[]) => segs.map((s) => (s.italic ? `<i>${escapeHtml(s.text)}</i>` : escapeHtml(s.text))).join("");

/** Appends `p` unless the text already ends with terminal punctuation. */
export function endP(s: string, p = "."): string {
  const t = s.trim();
  if (!t) return t;
  return /[.?!]$/.test(t) ? t : t + p;
}

/** Quoted title with punctuation inside the quotes (US style); skips the comma/period after ? or !. */
export function quoteUS(title: string, punct: "," | "." | ""): string {
  const t = title.trim();
  if (/[?!]$/.test(t) || !punct) return `“${t}”`;
  return `“${t.replace(/[.,]$/, "")}${punct}”`;
}

/* ------------------------------------------------------------------ */
/* Strings                                                             */
/* ------------------------------------------------------------------ */

export const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12,
};

/**
 * Edition label without the "ed." suffix: "2" → "2nd", "second" → "2nd",
 * "Rev." stays "Rev.". Returns "" for first editions, which are not cited.
 */
export function editionLabel(raw: string): string {
  let e = clean(raw).replace(/\b(edition|edn\.?|ed\.?)$/i, "").trim();
  if (!e) return "";
  const num = /^(\d+)(st|nd|rd|th)?$/i.exec(e);
  if (num) {
    const n = Number(num[1]);
    return n <= 1 ? "" : ordinal(n);
  }
  const w = ORDINAL_WORDS[e.toLowerCase()];
  if (w) return w <= 1 ? "" : ordinal(w);
  e = e.replace(/\.$/, "");
  return /^[a-z]{1,5}$/i.test(e) ? `${e}.` : e;
}

/** Page range with an en dash between numbers. */
export function pageRange(p: string, dash = "–"): string {
  return clean(p).replace(/\s*(?:--|[-–—])\s*/g, dash);
}

export const isPageRange = (p: string) => /[-–—,&]/.test(p);

/** Formats a pinpoint locator: digits get "p."/"pp." when `prefix` is set; anything else is kept as typed. */
export function locatorText(loc: string | undefined, prefix: boolean): string {
  const l = clean(loc);
  if (!l) return "";
  if (/^[\dxivlcdm]+(\s*(--|[-–—,])\s*[\dxivlcdm]+)*$/i.test(l)) {
    const r = pageRange(l);
    return prefix ? `${isPageRange(r) ? "pp." : "p."} ${r}` : r;
  }
  return l;
}

const MINOR = new Set(
  "a an the and but or nor for so yet as at by in of off on per to up via vs vs. from into onto with over than".split(" "),
);

/**
 * Title case for MLA/Chicago: capitalizes principal words and lowercases minor
 * words that were typed with a simple initial capital. Words with internal
 * capitals (iPhone, NASA, eBay) are left alone.
 */
export function titleCase(title: string): string {
  const words = clean(title).split(" ");
  let capNext = true;
  return words
    .map((w, i) => {
      const isLast = i === words.length - 1;
      const m = /^([^\p{L}\p{N}]*)([\p{L}\p{N}][\p{L}\p{N}'’.-]*)(.*)$/u.exec(w);
      let out = w;
      if (m) {
        const [, lead, core, tail] = m;
        const lower = core.toLowerCase();
        const simple = core === lower || core === lower.charAt(0).toUpperCase() + lower.slice(1);
        if (!capNext && !isLast && MINOR.has(lower) && simple && !lead) out = lead + lower + tail;
        else if (simple) {
          const capped = core
            .split("-")
            .map((part, j) => (j > 0 && MINOR.has(part.toLowerCase()) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
            .join("-");
          out = lead + capped + tail;
        }
      }
      capNext = /[:—?!]$/.test(w) || w === "—" || w === "-";
      return out;
    })
    .join(" ");
}

const WEAK_END = new Set([...MINOR, "is", "are", "was", "were", "be", "you", "your", "it", "its", "this", "that", "new", "all"]);

/**
 * Title up to the first colon. Titles of five words or fewer stay whole;
 * longer ones keep their first four words minus trailing function words
 * (Chicago short notes, MLA in-text).
 */
export function shortTitle(title: string, max = 4): string {
  const main = clean(title).split(/[:?!]/)[0].trim().replace(/[.,;]$/, "");
  const words = main.split(" ");
  if (words.length <= max + 1) return main;
  const cut = words.slice(0, max);
  while (cut.length > 1 && WEAK_END.has(cut[cut.length - 1].toLowerCase())) cut.pop();
  return cut.join(" ").replace(/[.,;]$/, "");
}

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

export const hasName = (n: Name) => clean(n.family) !== "" || (!n.org && clean(n.given) !== "");

/** Cleans names; a person with only one name part is treated as a family name. */
export const validNames = (names: Name[]): Name[] =>
  names
    .filter(hasName)
    .map((n) =>
      n.org
        ? { given: "", family: clean(n.family), org: true }
        : clean(n.family)
          ? { given: clean(n.given), family: clean(n.family) }
          : { given: "", family: clean(n.given) },
    );

/** "Jean-Paul Kofi" → "J.-P. K." (spaced) or "J.-P.K." (unspaced). */
export function initials(given: string, spaced = true): string {
  const tokens = clean(given)
    .split(/[\s.]+/)
    .filter(Boolean);
  const out = tokens.map((t) =>
    t
      .split("-")
      .filter(Boolean)
      .map((p) => `${Array.from(p)[0].toUpperCase()}.`)
      .join("-"),
  );
  return out.join(spaced ? " " : "");
}

/** Joins a list: "A", "A and B", "A, B, and C" with configurable separators. */
export function joinList(items: string[], o: { two: string; sep: string; last: string }): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return items[0] + o.two + items[1];
  return items.slice(0, -1).join(o.sep) + o.last + items[items.length - 1];
}

/** "Given Family" or the organization name. */
export const fullName = (n: Name) => (n.org ? n.family : clean(`${n.given} ${n.family}`));

/** "Family, Given" or the organization name. */
export const invertedName = (n: Name) => (n.org || !n.given ? n.family : `${n.family}, ${n.given}`);

export const sameText = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase() && clean(a) !== "";

/** True if the only author is an organization with the same name as the publisher/site. */
export function authorIsPublisher(authors: Name[], publisher: string): boolean {
  return authors.length === 1 && !!authors[0].org && sameText(authors[0].family, publisher);
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
];
export const MONTHS_MLA = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
export const MONTHS_IEEE = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];

export interface DateBits {
  /** Year as text ("2020" or "in press"); "" if unknown. */
  year: string;
  month: number | null;
  day: number | null;
}

export function dateBits(d: PartialDate | undefined): DateBits {
  const year = clean(d?.year);
  const m = Number(clean(d?.month));
  const month = Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
  const dd = Number(clean(d?.day));
  const day = month && Number.isInteger(dd) && dd >= 1 && dd <= 31 ? dd : null;
  return { year, month, day };
}

export const hasDate = (d: PartialDate | undefined) => dateBits(d).year !== "";

/** "March 5, 2020" / "March 2020" / "2020". */
export function dateUS(d: DateBits, months = MONTHS): string {
  if (!d.year) return "";
  if (d.month && d.day) return `${months[d.month - 1]} ${d.day}, ${d.year}`;
  if (d.month) return `${months[d.month - 1]} ${d.year}`;
  return d.year;
}

/** "5 Mar. 2020" (MLA) / "5 March 2020" (Harvard). */
export function dateDMY(d: DateBits, months = MONTHS): string {
  if (!d.year) return "";
  if (d.month && d.day) return `${d.day} ${months[d.month - 1]} ${d.year}`;
  if (d.month) return `${months[d.month - 1]} ${d.year}`;
  return d.year;
}

/** ISO-like "2020-03-05" / "2020-03" / "2020" for BibTeX. */
export function dateISO(d: DateBits): string {
  if (!/^\d{4}$/.test(d.year)) return d.year;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d.month && d.day) return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
  if (d.month) return `${d.year}-${pad(d.month)}`;
  return d.year;
}

/* ------------------------------------------------------------------ */
/* DOI and URL                                                         */
/* ------------------------------------------------------------------ */

/** Returns the bare DOI ("10.1000/xyz") or "" if the input is not a DOI. */
export function normalizeDoi(raw: string): string {
  let s = clean(raw);
  if (!s) return "";
  s = s.replace(/^doi:\s*/i, "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  try {
    if (/%[0-9a-f]{2}/i.test(s)) s = decodeURIComponent(s);
  } catch {
    /* keep as typed */
  }
  return /^10\.\d{4,9}\/\S+$/.test(s) ? s : "";
}

export const doiUrl = (doi: string) => (doi ? `https://doi.org/${doi}` : "");

export function normalizeUrl(raw: string): string {
  const s = clean(raw);
  if (!s) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return `https://${s}`;
  return s;
}

export const stripProtocol = (url: string) => url.replace(/^https?:\/\//i, "");

/** DOI link if a valid DOI exists, otherwise the URL. */
export function link(s: Source): { doi: string; url: string } {
  const doi = normalizeDoi(s.doi);
  return { doi, url: normalizeUrl(s.url) };
}

/* ------------------------------------------------------------------ */
/* Source helpers                                                      */
/* ------------------------------------------------------------------ */

export interface Prepared {
  s: Source;
  authors: Name[];
  editors: Name[];
  title: string;
  container: string;
  publisher: string;
  place: string;
  edition: string;
  volume: string;
  issue: string;
  pages: string;
  number: string;
  date: DateBits;
  accessed: DateBits;
  doi: string;
  url: string;
}

/** Trims every field once so formatters work with clean values. */
export function prepare(s: Source): Prepared {
  const { doi, url } = link(s);
  return {
    s,
    authors: validNames(s.authors),
    editors: validNames(s.editors),
    title: clean(s.title),
    container: clean(s.container),
    publisher: clean(s.publisher),
    place: clean(s.place),
    edition: editionLabel(s.edition),
    volume: clean(s.volume),
    issue: clean(s.issue),
    pages: pageRange(s.pages),
    number: clean(s.number),
    date: dateBits(s.date),
    accessed: dateBits(s.accessed),
    doi,
    url,
  };
}

/** Problems worth flagging next to the form. Not fatal: formatters still run. */
export function sourceWarnings(s: Source): string[] {
  const w: string[] = [];
  const p = prepare(s);
  if (!p.title) w.push("Add a title. Every style needs one.");
  if (p.authors.length === 0 && !(s.type === "book" && p.editors.length))
    w.push("No author: the title moves to the author position, which is correct for anonymous works.");
  if (!p.date.year) w.push("No year: styles use “n.d.” (no date). Add one if the source shows it.");
  if (clean(s.doi) && !p.doi) w.push("The DOI does not look valid. DOIs start with “10.” followed by a prefix and a slash.");
  if ((s.type === "journal" || s.type === "chapter" || s.type === "news" || s.type === "conference") && !p.container)
    w.push(
      s.type === "journal"
        ? "Add the journal name."
        : s.type === "chapter"
          ? "Add the title of the book that contains the chapter."
          : s.type === "news"
            ? "Add the newspaper or magazine name."
            : "Add the proceedings or conference name.",
    );
  if (s.type === "webpage" && !p.url) w.push("Add the page URL.");
  if (s.type === "chapter" && p.editors.length === 0) w.push("Chapters in edited books usually list the book's editors.");
  if (p.date.year && /^\d+$/.test(p.date.year) && (Number(p.date.year) < 1000 || Number(p.date.year) > 2100))
    w.push("Check the year.");
  return w;
}

/**
 * Joins elements with `sep`, applying US quotation rules: when an element ends
 * in a closing quote, the separator's punctuation moves inside the quotes
 * (“Title,” / “Title.”) unless the title already ends in ? or !. `end` is
 * added after the last element the same way.
 */
export function joinUS(elements: Part[], sep = ", ", end = "."): Seg[] {
  const els = elements.map((e) => build(e)).filter((e) => e.length > 0);
  const out: Part[] = [];
  const punct = (p: string) => p.trim().charAt(0);
  els.forEach((e, i) => {
    const isLast = i === els.length - 1;
    const mark = isLast ? end : punct(sep);
    const last = e[e.length - 1];
    if (mark && !last.italic && last.text.endsWith("”")) {
      const inner = last.text.slice(0, -1);
      const add = /[?!.,]$/.test(inner) ? "" : mark;
      out.push(e.slice(0, -1), { text: `${inner}${add}”` }, isLast ? "" : " ");
    } else {
      out.push(e, isLast ? end : sep);
    }
  });
  return build(out);
}
