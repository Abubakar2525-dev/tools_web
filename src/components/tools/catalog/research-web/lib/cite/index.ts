/**
 * Citation engine entry point: one Source model, six output styles, BibTeX in
 * and out. Pure TypeScript (no React) so it can be unit-tested in Node.
 */
import { apaInText, apaReference } from "./apa";
import { chicagoAuthorDate, chicagoAuthorDateInText, chicagoBibliography, chicagoNote, chicagoShortNote } from "./chicago";
import { harvardInText, harvardReference } from "./harvard";
import { ieeeInText, ieeeReference } from "./ieee";
import { mlaInText, mlaReference } from "./mla";
import type { CitationBlock, FormatOptions, Seg, Source, StyleId } from "./types";
import { asciiFold } from "./bibtex";
import { clean, plainText, validNames } from "./util";

export * from "./types";
export { plainText, segsToHtml, sourceWarnings, normalizeDoi, titleCase } from "./util";
export { toBibtex, toBibtexList, parseBibtex, entryToSource, citationKey, uniqueKeys, latexToUnicode, escapeLatex } from "./bibtex";

/** The reference-list / bibliography entry for a style. */
export function formatReference(style: StyleId, s: Source, o: FormatOptions = {}): Seg[] {
  switch (style) {
    case "apa":
      return apaReference(s, o);
    case "mla":
      return mlaReference(s, o);
    case "chicago-notes":
      return chicagoBibliography(s);
    case "chicago-ad":
      return chicagoAuthorDate(s, o);
    case "harvard":
      return harvardReference(s, o);
    case "ieee":
      return ieeeReference(s, o);
  }
}

/** Every output a single-source style tool shows (reference, in-text forms, notes). */
export function formatBlocks(style: StyleId, s: Source, o: FormatOptions = {}): CitationBlock[] {
  switch (style) {
    case "apa": {
      const t = apaInText(s, o);
      return [
        { id: "ref", label: "Reference list entry", segs: apaReference(s, o) },
        { id: "paren", label: "Parenthetical in-text citation", segs: t.parenthetical },
        { id: "narr", label: "Narrative in-text citation", segs: t.narrative },
      ];
    }
    case "mla": {
      const t = mlaInText(s, o);
      return [
        { id: "ref", label: "Works Cited entry", segs: mlaReference(s, o) },
        { id: "paren", label: "Parenthetical in-text citation", segs: t.parenthetical },
        { id: "narr", label: "Narrative in-text citation", segs: t.narrative },
      ];
    }
    case "chicago-notes":
      return [
        { id: "note", label: "Full note (first citation)", segs: chicagoNote(s, o) },
        { id: "short", label: "Short note (later citations)", segs: chicagoShortNote(s, o) },
        { id: "ref", label: "Bibliography entry", segs: chicagoBibliography(s) },
      ];
    case "chicago-ad": {
      const t = chicagoAuthorDateInText(s, o);
      return [
        { id: "ref", label: "Reference list entry", segs: chicagoAuthorDate(s, o) },
        { id: "paren", label: "Parenthetical in-text citation", segs: t.parenthetical },
        { id: "narr", label: "Narrative in-text citation", segs: t.narrative },
      ];
    }
    case "harvard": {
      const t = harvardInText(s, o);
      return [
        { id: "ref", label: "Reference list entry", segs: harvardReference(s, o) },
        { id: "paren", label: "Parenthetical in-text citation", segs: t.parenthetical },
        { id: "narr", label: "Narrative in-text citation", segs: t.narrative },
      ];
    }
    case "ieee":
      return [
        { id: "ref", label: "Reference list entry", segs: ieeeReference(s, { ...o, number: o.number ?? 1 }) },
        { id: "paren", label: "In-text citation", segs: ieeeInText({ ...o, number: o.number ?? 1 }) },
      ];
  }
}

/* ------------------------------------------------------------------ */
/* Reference lists                                                     */
/* ------------------------------------------------------------------ */

const sortKey = (s: string) => asciiFold(clean(s)).toLowerCase().replace(/^(the|a|an)\s+/, "");

function authorKey(s: Source): string {
  const names = validNames(s.authors.length ? s.authors : s.type === "book" ? s.editors : []);
  if (!names.length) return sortKey(s.title);
  return names.map((n) => `${sortKey(n.family)} ${sortKey(n.given)}`).join(" ; ");
}

const yearNum = (s: Source) => {
  const y = clean(s.date.year);
  return /^\d+$/.test(y) ? Number(y) : y ? 99999 : -1;
};

/** Alphabetical by author (or title), then year, then title. IEEE keeps citation order. */
export function sortSources(style: StyleId, sources: Source[]): Source[] {
  if (style === "ieee") return [...sources];
  return [...sources].sort((a, b) => {
    const k = authorKey(a).localeCompare(authorKey(b));
    if (k) return k;
    if (style !== "mla") {
      const y = yearNum(a) - yearNum(b);
      if (y) return y;
    }
    return sortKey(a.title).localeCompare(sortKey(b.title));
  });
}

/** Year suffixes ("2020a", "2020b") for same author(s) and year in author-date styles. */
export function yearSuffixes(style: StyleId, sorted: Source[]): Map<string, string> {
  const out = new Map<string, string>();
  if (style !== "apa" && style !== "harvard" && style !== "chicago-ad") return out;
  const groups = new Map<string, Source[]>();
  for (const s of sorted) {
    if (!validNames(s.authors).length && !(s.type === "book" && validNames(s.editors).length)) continue;
    const g = `${authorKey(s)}|${clean(s.date.year)}`;
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.forEach((s, i) => out.set(s.id, String.fromCharCode(97 + (i % 26))));
  }
  return out;
}

export interface ListItem {
  source: Source;
  segs: Seg[];
  suffix?: string;
  number?: number;
}

export function referenceList(style: StyleId, sources: Source[]): ListItem[] {
  const sorted = sortSources(style, sources);
  const suffixes = yearSuffixes(style, sorted);
  return sorted.map((s, i) => {
    const o: FormatOptions = { yearSuffix: suffixes.get(s.id), number: style === "ieee" ? i + 1 : undefined };
    return { source: s, segs: formatReference(style, s, o), suffix: o.yearSuffix, number: o.number };
  });
}

export const listPlain = (items: ListItem[]) => items.map((it) => plainText(it.segs)).join("\n");
