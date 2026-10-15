/**
 * The Chicago Manual of Style, 18th edition (2024): notes and bibliography
 * (chapter 14) and author-date (chapter 13).
 */
import type { FormatOptions, Name, Seg, Source } from "./types";
import {
  authorIsPublisher,
  build,
  dateUS,
  doiUrl,
  fullName,
  invertedName,
  it,
  joinList,
  joinUS,
  locatorText,
  prepare,
  shortTitle,
  titleCase,
  type Part,
  type Prepared,
} from "./util";

const ITALIC = new Set(["book", "report"]);

/** Note names: "A", "A and B", "A et al." for three or more (CMOS 18, 14.76). */
function noteNames(names: Name[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return fullName(names[0]);
  if (names.length === 2) return `${fullName(names[0])} and ${fullName(names[1])}`;
  return `${fullName(names[0])} et al.`;
}

/** Bibliography names: first inverted; up to six listed, seven or more → first three + et al. */
export function chicagoBibNames(names: Name[]): string {
  if (!names.length) return "";
  const list = names.length > 6 ? names.slice(0, 3) : names;
  const f = list.map((n, i) => (i === 0 ? invertedName(n) : fullName(n)));
  if (names.length > 6) return `${f.join(", ")}, et al.`;
  if (f.length === 1) return f[0];
  return `${f.slice(0, -1).join(", ")}, and ${f[f.length - 1]}`;
}

function shortNames(names: Name[]): string {
  const fam = names.map((n) => n.family);
  if (fam.length === 1) return fam[0];
  if (fam.length === 2) return `${fam[0]} and ${fam[1]}`;
  return `${fam[0]} et al.`;
}

const edList = (names: Name[]) => joinList(names.map(fullName), { two: " and ", sep: ", ", last: ", and " });

function ctx(src: Source) {
  const p = prepare(src);
  const title = titleCase(p.title);
  const container = titleCase(p.container);
  const link = p.doi ? doiUrl(p.doi) : p.url;
  const pub = p.publisher && !(src.type === "report" && authorIsPublisher(p.authors, p.publisher)) ? p.publisher : "";
  const pubPlace = p.place && pub ? `${p.place}: ${pub}` : pub || p.place;
  const editorsOnly = !p.authors.length && src.type === "book" && p.editors.length > 0;
  const report = p.number ? (/^[a-z]/i.test(p.number) ? p.number : `Report No. ${p.number}`) : "";
  const thesis = src.thesisType === "phd" ? "PhD diss." : "Master’s thesis";
  return { p, title, container, link, pubPlace, editorsOnly, report, thesis };
}

const quoted = (t: string) => `“${t}”`;
const titlePart = (src: Source, t: string): Part => (ITALIC.has(src.type) ? it(t) : quoted(t));

/* ------------------------------ Notes ------------------------------ */

export function chicagoNote(src: Source, o: FormatOptions = {}): Seg[] {
  const { p, title, container, link, pubPlace, editorsOnly, report, thesis } = ctx(src);
  const loc = locatorText(o.locator, false);
  const who = editorsOnly ? `${noteNames(p.editors)}, ${p.editors.length > 1 ? "eds." : "ed."}` : noteNames(p.authors);
  const facts = [pubPlace, p.date.year || "n.d."].filter(Boolean).join(", ");
  const els: Part[] = [who];
  switch (src.type) {
    case "book":
      els.push(p.edition ? it(title) : [it(title), ` (${facts})`], p.edition ? `${p.edition} ed. (${facts})` : "", loc, link);
      break;
    case "report":
      els.push(report ? it(title) : [it(title), ` (${facts})`], report ? `${report} (${facts})` : "", loc, link);
      break;
    case "chapter":
    case "conference":
      els.push(
        quoted(title),
        [
          container ? ["in ", it(container)] : "",
          p.editors.length ? `, ed. ${edList(p.editors)}` : "",
          p.edition ? `, ${p.edition} ed.` : "",
          ` (${facts})`,
        ],
        loc || p.pages,
        link,
      );
      break;
    case "journal":
      els.push(quoted(title), journalPart(p, container, true, loc || p.pages), link);
      break;
    case "news":
      els.push(quoted(title), container && it(container), dateUS(p.date), loc, link);
      break;
    case "webpage":
      els.push(quoted(title), container, p.date.year ? dateUS(p.date) : p.accessed.year ? `accessed ${dateUS(p.accessed)}` : "", link);
      break;
    case "thesis":
      els.push([quoted(title), ` (${[thesis, p.publisher, p.date.year || "n.d."].filter(Boolean).join(", ")})`], loc, link);
      break;
  }
  return joinUS(els, ", ", ".");
}

function journalPart(p: Prepared, container: string, withDate: boolean, pages: string): Part {
  const month = p.date.month ? `${dateUS({ year: p.date.year, month: p.date.month, day: null })}` : p.date.year;
  return [
    container ? it(container) : "",
    p.volume ? ` ${p.volume}` : "",
    p.issue ? `${p.volume ? "," : ""} no. ${p.issue}` : "",
    withDate ? ` (${month || "n.d."})` : "",
    pages ? `: ${pages}` : "",
  ];
}

export function chicagoShortNote(src: Source, o: FormatOptions = {}): Seg[] {
  const { p, editorsOnly } = ctx(src);
  const loc = locatorText(o.locator, false);
  const names = editorsOnly ? p.editors : p.authors;
  const st = titleCase(shortTitle(p.title || "Untitled"));
  return joinUS([names.length ? shortNames(names) : "", titlePart(src, st), loc], ", ", ".");
}

export function chicagoBibliography(src: Source): Seg[] {
  const { p, title, container, link, pubPlace, editorsOnly, report, thesis } = ctx(src);
  const year = p.date.year || "n.d.";
  const who = editorsOnly ? `${chicagoBibNames(p.editors)}, ${p.editors.length > 1 ? "eds." : "ed."}` : chicagoBibNames(p.authors);
  const els: Part[] = [who];
  switch (src.type) {
    case "book":
      els.push(it(title), p.edition && `${p.edition} ed.`, [pubPlace, pubPlace ? ", " : "", year], link);
      break;
    case "report":
      els.push(it(title), report, [pubPlace, pubPlace ? ", " : "", year], link);
      break;
    case "chapter":
    case "conference":
      els.push(
        quoted(title),
        [
          container ? ["In ", it(container)] : "",
          p.editors.length ? `, edited by ${edList(p.editors)}` : "",
          p.edition ? `, ${p.edition} ed.` : "",
          p.pages ? `, ${p.pages}` : "",
        ],
        [pubPlace, pubPlace ? ", " : "", year],
        link,
      );
      break;
    case "journal":
      els.push(quoted(title), journalPart(p, container, true, p.pages), link);
      break;
    case "news":
      els.push(quoted(title), [container ? it(container) : "", container ? ", " : "", dateUS(p.date) || "n.d."], link);
      break;
    case "webpage":
      els.push(quoted(title), container, p.date.year ? dateUS(p.date) : p.accessed.year ? `Accessed ${dateUS(p.accessed)}` : "", link);
      break;
    case "thesis":
      els.push(quoted(title), [thesis, ", ", p.publisher, p.publisher ? ", " : "", year], link);
      break;
  }
  return joinUS(els, ". ", ".");
}

/* --------------------------- Author-date --------------------------- */

export function chicagoAuthorDate(src: Source, o: FormatOptions = {}): Seg[] {
  const { p, title, container, link, pubPlace, editorsOnly, report, thesis } = ctx(src);
  const year = `${p.date.year || "n.d."}${o.yearSuffix ? (p.date.year ? o.yearSuffix : `-${o.yearSuffix}`) : ""}`;
  const who = editorsOnly ? `${chicagoBibNames(p.editors)}, ${p.editors.length > 1 ? "eds." : "ed."}` : chicagoBibNames(p.authors);
  // Anonymous works: the title takes the author position, then the year.
  const els: Part[] = who ? [who, year, titlePart(src, title)] : [titlePart(src, title), year];
  switch (src.type) {
    case "book":
      els.push(p.edition && `${p.edition} ed.`, pubPlace, link);
      break;
    case "report":
      els.push(report, pubPlace, link);
      break;
    case "chapter":
    case "conference":
      els.push(
        [
          container ? ["In ", it(container)] : "",
          p.editors.length ? `, edited by ${edList(p.editors)}` : "",
          p.edition ? `, ${p.edition} ed.` : "",
          p.pages ? `, ${p.pages}` : "",
        ],
        pubPlace,
        link,
      );
      break;
    case "journal":
      els.push(journalPart(p, container, false, p.pages), link);
      break;
    case "news":
      els.push([container ? it(container) : "", container && p.date.month ? ", " : "", p.date.month ? dateUS(p.date) : ""], link);
      break;
    case "webpage":
      els.push(
        [container, container && p.date.month ? ", " : "", p.date.month ? dateUS(p.date) : ""],
        !p.date.year && p.accessed.year ? `Accessed ${dateUS(p.accessed)}` : "",
        link,
      );
      break;
    case "thesis":
      els.push([thesis, p.publisher ? `, ${p.publisher}` : ""], link);
      break;
  }
  return joinUS(els, ". ", ".");
}

export function chicagoAuthorDateInText(src: Source, o: FormatOptions = {}): { parenthetical: Seg[]; narrative: Seg[] } {
  const { p, editorsOnly } = ctx(src);
  const loc = locatorText(o.locator, false);
  const names = editorsOnly ? p.editors : p.authors;
  const year = p.date.year ? `${p.date.year}${o.yearSuffix ?? ""}` : `n.d.${o.yearSuffix ? `-${o.yearSuffix}` : ""}`;
  const who: Part = names.length ? shortNames(names) : titlePart(src, titleCase(shortTitle(p.title || "Untitled")));
  const sep = p.date.year ? " " : ", ";
  return {
    parenthetical: build("(", who, sep, year, loc ? `, ${loc}` : "", ")"),
    narrative: build(who, ` (${year}${loc ? `, ${loc}` : ""})`),
  };
}
