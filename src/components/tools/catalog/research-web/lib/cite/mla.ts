/**
 * MLA Handbook, 9th edition (Modern Language Association, 2021): core
 * elements and containers.
 */
import type { FormatOptions, Name, Seg, Source } from "./types";
import {
  MONTHS_MLA,
  authorIsPublisher,
  build,
  dateDMY,
  doiUrl,
  endP,
  fullName,
  invertedName,
  isPageRange,
  it,
  joinList,
  joinUS,
  locatorText,
  prepare,
  sameText,
  shortTitle,
  stripProtocol,
  titleCase,
  type Part,
  type Prepared,
} from "./util";

const WHOLE = new Set(["book", "report", "thesis"]);

export function mlaAuthorList(names: Name[]): string {
  if (!names.length) return "";
  const first = invertedName(names[0]);
  if (names.length === 1) return first;
  if (names.length === 2) return `${first}, and ${fullName(names[1])}`;
  return `${first}, et al.`;
}

/** MLA 9 inclusive page numbers: 100-04, 395-401, 1103-04. */
export function mlaPages(range: string): string {
  return range.replace(/(\d+)–(\d+)/g, (m, a: string, b: string) => {
    if (b.length !== a.length || b.length < 3 || Number(b) <= Number(a)) return m;
    const prefix = a.slice(0, -2);
    return b.startsWith(prefix) ? `${a}–${b.slice(-2)}` : m;
  });
}

/** Academic publishers: "University" → "U", "Press" → "P"; business words dropped. */
export function mlaPublisher(pub: string): string {
  let s = pub.replace(/^the\s+/i, "").replace(/,?\s*\b(Inc|Co|Corp|Ltd|LLC|Company|Corporation|Limited)\b\.?/gi, "").trim();
  if (/\bUniversity\b/.test(s)) {
    s = s.replace(/\bUniversity Press\b/g, "UP").replace(/\bUniversity\b/g, "U").replace(/\bPress\b/g, "P");
  }
  return s;
}

function editorsPhrase(names: Name[]): string {
  if (!names.length) return "";
  const list = names.length > 2 ? `${fullName(names[0])} et al.` : joinList(names.map(fullName), { two: " and ", sep: ", ", last: ", and " });
  return `edited by ${list}`;
}

function pagesEl(p: Prepared) {
  if (!p.pages) return "";
  const r = mlaPages(p.pages);
  return /^\d/.test(r) || /^[A-Z]\d/.test(r) ? `${isPageRange(r) ? "pp." : "p."} ${r}` : r;
}

export function mlaReference(src: Source, o: FormatOptions = {}): Seg[] {
  void o;
  const p = prepare(src);
  const date = dateDMY(p.date, MONTHS_MLA);
  const location = p.doi ? doiUrl(p.doi) : p.url ? stripProtocol(p.url) : "";
  const title = titleCase(p.title);
  const container = titleCase(p.container);
  const publisher = p.publisher && !authorIsPublisher(p.authors, p.publisher) ? mlaPublisher(p.publisher) : "";

  let author = mlaAuthorList(p.authors);
  if (!author && src.type === "book" && p.editors.length) author = `${mlaAuthorList(p.editors)}, ${p.editors.length > 1 ? "editors" : "editor"}`;

  const titlePart: Part = WHOLE.has(src.type) ? [it(title), "."] : `“${endP(title)}”`;
  let elements: Part[] = [];
  switch (src.type) {
    case "book":
      elements = [p.edition && `${p.edition} ed.`, publisher, date, location];
      break;
    case "report":
      elements = [p.edition && `${p.edition} ed.`, p.number && (/^[a-z]/i.test(p.number) ? p.number : `Report no. ${p.number}`), publisher, date, location];
      break;
    case "thesis":
      elements = [date];
      break;
    case "chapter":
    case "conference":
      elements = [container && it(container), editorsPhrase(p.editors), p.edition && `${p.edition} ed.`, publisher, date, pagesEl(p), location];
      break;
    case "journal":
      elements = [container && it(container), p.volume && `vol. ${p.volume}`, p.issue && `no. ${p.issue}`, date, pagesEl(p), location];
      break;
    case "news":
      elements = [container && it(container), p.volume && `vol. ${p.volume}`, p.issue && `no. ${p.issue}`, date, p.pages && !location ? pagesEl(p) : "", location];
      break;
    case "webpage": {
      const pub = publisher && !sameText(publisher, p.container) ? publisher : "";
      elements = [container && it(container), pub, date, location];
      break;
    }
  }
  const accessed = p.accessed.year && (src.type === "webpage" || !p.date.year) && location ? `Accessed ${dateDMY(p.accessed, MONTHS_MLA)}.` : "";
  const containerPart = joinUS(elements, ", ", ".");
  // Theses: the degree is an optional element after the container, then the location.
  const thesis =
    src.type === "thesis"
      ? [" ", endP([p.publisher, src.thesisType === "phd" ? "PhD dissertation" : "Master’s thesis"].filter(Boolean).join(", ")), location ? ` ${endP(location)}` : ""]
      : "";
  return build(author ? [endP(author), " "] : "", titlePart, " ", containerPart, thesis, " ", accessed);
}

export function mlaInText(src: Source, o: FormatOptions = {}): { parenthetical: Seg[]; narrative: Seg[] } {
  const p = prepare(src);
  const loc = locatorText(o.locator, false);
  const names = p.authors.length ? p.authors : src.type === "book" ? p.editors : [];
  let who: Part;
  let narr: Part;
  if (names.length) {
    const fam = names.map((n) => n.family);
    who = fam.length === 1 ? fam[0] : fam.length === 2 ? `${fam[0]} and ${fam[1]}` : `${fam[0]} et al.`;
    const full = names.map(fullName);
    narr = full.length === 1 ? full[0] : full.length === 2 ? `${full[0]} and ${full[1]}` : `${full[0]} and colleagues`;
  } else {
    const t = titleCase(shortTitle(p.title || "Untitled"));
    who = WHOLE.has(src.type) ? it(t) : `“${t}”`;
    narr = WHOLE.has(src.type) ? it(titleCase(p.title)) : `“${titleCase(p.title)}”`;
  }
  return {
    parenthetical: build("(", who, loc ? ` ${loc}` : "", ")"),
    narrative: build(narr, loc ? ` … (${loc})` : ""),
  };
}
