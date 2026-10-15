/**
 * IEEE reference style (IEEE Reference Style Guide for Authors, 2023 update):
 * numbered references, initials before surnames, abbreviated months.
 */
import type { FormatOptions, Name, Seg, Source } from "./types";
import { MONTHS_IEEE, build, dateUS, endP, initials, isPageRange, it, joinUS, locatorText, prepare, type Part, type Prepared } from "./util";

const person = (n: Name) => (n.org ? n.family : `${initials(n.given, true)} ${n.family}`.trim());

/** 1-6 names listed ("A, B, and C"); seven or more → first author et al. */
export function ieeeNames(names: Name[]): string {
  if (!names.length) return "";
  if (names.length > 6) return `${person(names[0])} et al.`;
  const f = names.map(person);
  if (f.length === 1) return f[0];
  if (f.length === 2) return `${f[0]} and ${f[1]}`;
  return `${f.slice(0, -1).join(", ")}, and ${f[f.length - 1]}`;
}

const pagesEl = (pages: string) => (pages ? (/^\d/.test(pages) ? `${isPageRange(pages) ? "pp." : "p."} ${pages}` : pages) : "");

function monthYear(p: Prepared) {
  return p.date.month ? `${MONTHS_IEEE[p.date.month - 1]} ${p.date.year}` : p.date.year;
}

export function ieeeReference(src: Source, o: FormatOptions = {}): Seg[] {
  const p = prepare(src);
  const num = o.number ? `[${o.number}] ` : "";
  const editorsOnly = !p.authors.length && src.type === "book" && p.editors.length > 0;
  const who = editorsOnly ? `${ieeeNames(p.editors)}, ${p.editors.length > 1 ? "Eds." : "Ed."}` : ieeeNames(p.authors);
  const year = p.date.year || "n.d.";
  const facts = p.place && p.publisher ? `${p.place}: ${p.publisher}` : p.publisher || p.place;
  const quoted = `“${p.title}”`;
  const accessed = p.accessed.year ? `Accessed: ${dateUS(p.accessed, MONTHS_IEEE)}. ` : "";
  const online: Part = !p.doi && p.url ? [" ", accessed, `[Online]. Available: ${p.url}`] : "";
  const doi = p.doi ? `doi: ${p.doi}` : "";

  let body: Seg[];
  switch (src.type) {
    case "book": {
      const head = joinUS([who, [it(p.title), p.edition ? `, ${p.edition} ed` : ""]], ", ", ".");
      body = build(head, " ", joinUS([facts, year, doi], ", ", "."), online);
      break;
    }
    case "chapter": {
      const eds = p.editors.length ? `${ieeeNames(p.editors)}, ${p.editors.length > 1 ? "Eds" : "Ed"}` : "";
      const head = joinUS([who, quoted, [p.container ? ["in ", it(p.container)] : ""], p.edition && `${p.edition} ed.`, eds], ", ", ".");
      body = build(head, " ", joinUS([facts, year, pagesEl(p.pages), doi], ", ", "."), online);
      break;
    }
    case "conference":
      body = build(joinUS([who, quoted, p.container ? ["in ", it(p.container)] : "", p.place, year, pagesEl(p.pages), doi], ", ", "."), online);
      break;
    case "journal":
      body = build(
        joinUS(
          [who, quoted, p.container && it(p.container), p.volume && `vol. ${p.volume}`, p.issue && `no. ${p.issue}`, pagesEl(p.pages), monthYear(p) || "n.d.", doi],
          ", ",
          ".",
        ),
        online,
      );
      break;
    case "news":
      body = build(joinUS([who, quoted, p.container && it(p.container), dateUS(p.date, MONTHS_IEEE) || "n.d.", pagesEl(p.pages)], ", ", "."), online);
      break;
    case "report": {
      const rep = p.number ? (/^[a-z]/i.test(p.number) ? p.number : `Tech. Rep. ${p.number}`) : "";
      body = build(joinUS([who, quoted, p.publisher, p.place, rep, monthYear(p) || "n.d.", doi], ", ", "."), online);
      break;
    }
    case "thesis":
      body = build(
        joinUS([who, quoted, src.thesisType === "phd" ? "Ph.D. dissertation" : "M.S. thesis", p.publisher, p.place, year, doi], ", ", "."),
        online,
      );
      break;
    case "webpage": {
      const date = p.accessed.year ? ` (accessed ${dateUS(p.accessed, MONTHS_IEEE)}).` : "";
      body = build(who ? `${endP(who)} ` : "", `“${endP(p.title)}”`, " ", p.container ? `${endP(p.container)} ` : "", p.url, date);
      break;
    }
  }
  return build(num, body);
}

export function ieeeInText(o: FormatOptions = {}): Seg[] {
  const loc = locatorText(o.locator, true);
  return build(`[${o.number ?? 1}${loc ? `, ${loc}` : ""}]`);
}
