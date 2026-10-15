/**
 * APA Style, 7th edition (Publication Manual of the American Psychological
 * Association, 2020), chapters 8-10.
 */
import type { FormatOptions, Name, Seg, Source } from "./types";
import {
  MONTHS,
  authorIsPublisher,
  build,
  dateUS,
  doiUrl,
  endP,
  initials,
  isPageRange,
  it,
  joinList,
  locatorText,
  prepare,
  quoteUS,
  sameText,
  titleCase,
  type Part,
  type Prepared,
} from "./util";

const ITALIC_TITLE = new Set(["book", "webpage", "report", "thesis"]);

const apaPerson = (n: Name) => {
  if (n.org) return n.family;
  const ini = initials(n.given, true);
  return ini ? `${n.family}, ${ini}` : n.family;
};

/** Reference-list author element: up to 20 names; 21+ shows 19, an ellipsis, then the last. */
export function apaAuthorList(names: Name[]): string {
  const f = names.map(apaPerson);
  if (f.length > 20) return `${f.slice(0, 19).join(", ")}, . . . ${f[f.length - 1]}`;
  if (f.length === 1) return f[0];
  return `${f.slice(0, -1).join(", ")}, & ${f[f.length - 1]}`;
}

/** Editors inside a chapter reference: initials first, "&" before the last. */
function apaEditorsInline(names: Name[]): string {
  const f = names.map((n) => (n.org ? n.family : `${initials(n.given, true)} ${n.family}`.trim()));
  return joinList(f, { two: " & ", sep: ", ", last: ", & " });
}

function yearText(p: Prepared, suffix = "") {
  return p.date.year ? `${p.date.year}${suffix}` : `n.d.${suffix ? `-${suffix}` : ""}`;
}

function apaDate(p: Prepared, suffix: string | undefined): string {
  let s = yearText(p, suffix);
  const full = p.s.type === "webpage" || p.s.type === "news";
  if (full && p.date.year && p.date.month) s += `, ${MONTHS[p.date.month - 1]}${p.date.day ? ` ${p.date.day}` : ""}`;
  return `(${s})`;
}

function titleElement(p: Prepared): Part {
  const t = p.title;
  switch (p.s.type) {
    case "book":
      return [it(t), p.edition ? ` (${p.edition} ed.)` : "", "."];
    case "report": {
      const n = p.number ? (/^[a-z]/i.test(p.number) ? p.number : `Report No. ${p.number}`) : "";
      return [it(t), n ? ` (${n})` : "", "."];
    }
    case "thesis": {
      const label = p.s.thesisType === "phd" ? "Doctoral dissertation" : "Master’s thesis";
      const published = !!(p.doi || p.url);
      const bracket = published
        ? `[${label}${p.publisher ? `, ${p.publisher}` : ""}]`
        : `[Unpublished ${label.charAt(0).toLowerCase()}${label.slice(1)}]`;
      return [it(t), " ", bracket, "."];
    }
    case "webpage":
      return [it(t), "."];
    default:
      return endP(t);
  }
}

function sourceElement(p: Prepared): Part {
  const { s } = p;
  switch (s.type) {
    case "book":
    case "report":
      return p.publisher && !authorIsPublisher(p.authors, p.publisher) ? endP(p.publisher) : "";
    case "chapter":
    case "conference": {
      const inner = [p.edition && `${p.edition} ed.`, p.pages && `${isPageRange(p.pages) ? "pp." : "p."} ${p.pages}`]
        .filter(Boolean)
        .join(", ");
      const eds = p.editors.length ? `${apaEditorsInline(p.editors)} (${p.editors.length > 1 ? "Eds." : "Ed."}), ` : "";
      return [
        p.container ? ["In ", eds, it(p.container), inner ? ` (${inner})` : "", ". "] : inner ? `(${inner}). ` : "",
        p.publisher ? endP(p.publisher) : "",
      ];
    }
    case "journal":
    case "news": {
      if (!p.container) return p.pages ? endP(p.pages) : "";
      if (s.type === "news" && !p.volume) return [it(p.container), p.pages ? `, ${p.pages}` : "", "."];
      return [
        it(p.container + (p.volume ? `, ${p.volume}` : "")),
        p.issue ? (p.volume ? `(${p.issue})` : `, (${p.issue})`) : "",
        p.pages ? `, ${p.pages}` : "",
        ".",
      ];
    }
    case "webpage": {
      const author = p.authors.length === 1 ? p.authors[0].family : "";
      return p.container && !sameText(p.container, author) ? endP(p.container) : "";
    }
    case "thesis":
      return p.doi || p.url ? "" : p.publisher ? endP(p.publisher) : "";
  }
}

function linkElement(p: Prepared): string {
  if (p.doi) return doiUrl(p.doi);
  if (!p.url) return "";
  if (!p.date.year && p.accessed.year) return `Retrieved ${dateUS(p.accessed)}, from ${p.url}`;
  return p.url;
}

export function apaReference(src: Source, o: FormatOptions = {}): Seg[] {
  const p = prepare(src);
  const date = apaDate(p, o.yearSuffix);
  let head: Part;
  if (p.authors.length) head = [endP(apaAuthorList(p.authors)), " ", date, ". ", titleElement(p)];
  else if (src.type === "book" && p.editors.length)
    head = [apaAuthorList(p.editors), p.editors.length > 1 ? " (Eds.)." : " (Ed.).", " ", date, ". ", titleElement(p)];
  else head = [titleElement(p), " ", date, "."];
  return build(head, " ", sourceElement(p), " ", linkElement(p));
}

/** Names as they appear in APA in-text citations. */
function citedNames(p: Prepared, narrative: boolean): string | null {
  const names = p.authors.length ? p.authors : p.s.type === "book" ? p.editors : [];
  if (!names.length) return null;
  const fam = names.map((n) => n.family);
  if (fam.length === 1) return fam[0];
  if (fam.length === 2) return `${fam[0]} ${narrative ? "and" : "&"} ${fam[1]}`;
  return `${fam[0]} et al.`;
}

export function apaInText(src: Source, o: FormatOptions = {}): { parenthetical: Seg[]; narrative: Seg[] } {
  const p = prepare(src);
  const year = yearText(p, o.yearSuffix);
  const loc = locatorText(o.locator, true);
  const tail = `${year}${loc ? `, ${loc}` : ""}`;
  const names = citedNames(p, false);
  const narr = citedNames(p, true);
  if (names && narr) {
    return {
      parenthetical: build(`(${names}, ${tail})`),
      narrative: build(`${narr} (${year})`, loc ? ` … (${loc})` : ""),
    };
  }
  const tc = titleCase(p.title || "Untitled");
  if (ITALIC_TITLE.has(src.type)) {
    return {
      parenthetical: build("(", it(tc), `, ${tail})`),
      narrative: build(it(tc), ` (${year})`, loc ? ` … (${loc})` : ""),
    };
  }
  return {
    parenthetical: build(`(${quoteUS(tc, ",")} ${tail})`),
    narrative: build(`“${tc}” (${year})`, loc ? ` … (${loc})` : ""),
  };
}
