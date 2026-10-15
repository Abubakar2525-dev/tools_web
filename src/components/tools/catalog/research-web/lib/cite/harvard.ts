/**
 * Harvard referencing following Cite Them Right conventions (Pears & Shields,
 * 12th/13th editions). Institutions vary; this follows the common CTR form.
 */
import type { FormatOptions, Name, Seg, Source } from "./types";
import { MONTHS, authorIsPublisher, build, dateDMY, doiUrl, endP, initials, isPageRange, it, joinList, locatorText, prepare, type Part } from "./util";

const ITALIC = new Set(["book", "webpage", "report", "thesis"]);

const person = (n: Name) => {
  if (n.org) return n.family;
  const ini = initials(n.given, false);
  return ini ? `${n.family}, ${ini}` : n.family;
};

export function harvardNames(names: Name[]): string {
  return joinList(names.map(person), { two: " and ", sep: ", ", last: " and " });
}

function inTextNames(names: Name[]): string {
  const fam = names.map((n) => n.family);
  if (fam.length >= 4) return `${fam[0]} et al.`;
  return joinList(fam, { two: " and ", sep: ", ", last: " and " });
}

const quoted = (t: string) => `‘${t.replace(/[.,]$/, "")}’`;
const pp = (pages: string) => (pages ? `${isPageRange(pages) ? "pp." : "p."} ${pages}` : "");

export function harvardReference(src: Source, o: FormatOptions = {}): Seg[] {
  const p = prepare(src);
  const year = `(${p.date.year || "no date"}${o.yearSuffix ?? ""})`;
  const publisher = p.publisher && !authorIsPublisher(p.authors, p.publisher) ? p.publisher : "";
  const facts = p.place && publisher ? `${p.place}: ${publisher}` : publisher || p.place;
  const ed = p.edition ? `${p.edition} edn.` : "";
  const italic = ITALIC.has(src.type);
  const titleEl: Part = italic ? it(p.title) : quoted(p.title);

  let who = harvardNames(p.authors);
  if (!who && src.type === "book" && p.editors.length) who = `${harvardNames(p.editors)} (${p.editors.length > 1 ? "eds" : "ed."})`;

  const access = p.accessed.year ? ` (Accessed: ${dateDMY(p.accessed)})` : "";
  const avail = p.doi ? `Available at: ${doiUrl(p.doi)}${access}` : p.url ? `Available at: ${p.url}${access}` : "";
  const availPart: Part = avail ? [avail, access ? "." : ""] : "";

  let rest: Part;
  switch (src.type) {
    case "book":
      rest = [ed && `${ed} `, facts && endP(facts)];
      break;
    case "report":
      rest = [p.number && `${endP(/^[a-z]/i.test(p.number) ? p.number : `Report no. ${p.number}`)} `, facts && endP(facts)];
      break;
    case "thesis":
      rest = [`${src.thesisType === "phd" ? "PhD thesis" : "Master’s thesis"}. `, p.publisher && endP(p.publisher)];
      break;
    case "webpage":
      rest = "";
      break;
    case "chapter":
    case "conference": {
      const eds = p.editors.length ? `${harvardNames(p.editors)} (${p.editors.length > 1 ? "eds" : "ed."}) ` : "";
      const tail = [facts, pp(p.pages)].filter(Boolean).join(", ");
      rest = [p.container ? ["in ", eds, it(p.container), ". "] : "", ed && `${ed} `, tail && endP(tail)];
      break;
    }
    case "journal":
      rest = [
        p.container ? it(p.container) : "",
        p.volume ? `, ${p.volume}` : "",
        p.issue ? `(${p.issue})` : "",
        p.pages ? `, ${pp(p.pages)}` : "",
        ".",
      ];
      break;
    case "news": {
      const day = p.date.month ? `, ${p.date.day ? `${p.date.day} ` : ""}${MONTHS[p.date.month - 1]}` : "";
      rest = [p.container ? it(p.container) : "", day, p.pages ? `, ${pp(p.pages)}` : "", "."];
      break;
    }
  }

  // Connector between title and the rest: ". " after italic titles, ", " after quoted ones.
  const hasRest = build(rest).length > 0;
  if (who) {
    return build(who, " ", year, " ", titleEl, hasRest ? (italic ? ". " : ", ") : ".", rest, " ", availPart);
  }
  return build(titleEl, " ", year, hasRest ? " " : ".", rest, " ", availPart);
}

export function harvardInText(src: Source, o: FormatOptions = {}): { parenthetical: Seg[]; narrative: Seg[] } {
  const p = prepare(src);
  const year = `${p.date.year || "no date"}${o.yearSuffix ?? ""}`;
  const loc = locatorText(o.locator, true);
  const names = p.authors.length ? p.authors : src.type === "book" ? p.editors : [];
  const who: Part = names.length ? inTextNames(names) : ITALIC.has(src.type) ? it(p.title) : quoted(p.title);
  return {
    parenthetical: build("(", who, `, ${year}${loc ? `, ${loc}` : ""})`),
    narrative: build(who, ` (${year}${loc ? `, ${loc}` : ""})`),
  };
}
