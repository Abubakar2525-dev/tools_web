/**
 * Citation engine data model. Plain data (JSON-serializable) so sources can be
 * persisted in localStorage and round-tripped through BibTeX.
 */

export type SourceType = "book" | "chapter" | "journal" | "webpage" | "report" | "news" | "conference" | "thesis";

export const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "book", label: "Book (or edited book)" },
  { value: "chapter", label: "Chapter in an edited book" },
  { value: "journal", label: "Journal article" },
  { value: "webpage", label: "Website or webpage" },
  { value: "report", label: "Report" },
  { value: "news", label: "Newspaper or magazine article" },
  { value: "conference", label: "Conference paper" },
  { value: "thesis", label: "Thesis or dissertation" },
];

/** A contributor. For organizations, `org` is true and `family` holds the full name. */
export interface Name {
  given: string;
  family: string;
  org?: boolean;
}

/** Dates are kept as strings so form input round-trips exactly. Month is "1".."12" or "". */
export interface PartialDate {
  year: string;
  month: string;
  day: string;
}

export interface Source {
  id: string;
  type: SourceType;
  authors: Name[];
  editors: Name[];
  /** Article, chapter, page, report, paper or thesis title; the book title for books. */
  title: string;
  /** Journal, book (for chapters), website, newspaper/magazine or proceedings title. */
  container: string;
  /** Publisher, institution (reports) or university (theses). */
  publisher: string;
  place: string;
  edition: string;
  volume: string;
  issue: string;
  pages: string;
  /** Report number. */
  number: string;
  thesisType: "phd" | "masters";
  date: PartialDate;
  accessed: PartialDate;
  doi: string;
  url: string;
}

/** A run of text; italic runs render in <i>. */
export interface Seg {
  text: string;
  italic?: boolean;
}

export type StyleId = "apa" | "mla" | "chicago-notes" | "chicago-ad" | "harvard" | "ieee";

export const STYLES: { value: StyleId; label: string; short: string }[] = [
  { value: "apa", label: "APA 7th edition", short: "APA 7" },
  { value: "mla", label: "MLA 9th edition", short: "MLA 9" },
  { value: "chicago-notes", label: "Chicago 18th, notes and bibliography", short: "Chicago notes" },
  { value: "chicago-ad", label: "Chicago 18th, author-date", short: "Chicago author-date" },
  { value: "harvard", label: "Harvard (Cite Them Right)", short: "Harvard" },
  { value: "ieee", label: "IEEE", short: "IEEE" },
];

export interface FormatOptions {
  /** Year disambiguation letter for author-date styles ("a", "b"...). */
  yearSuffix?: string;
  /** Reference number for IEEE. */
  number?: number;
  /** Page or other locator for in-text citations and notes. */
  locator?: string;
}

export interface CitationBlock {
  id: string;
  label: string;
  segs: Seg[];
}

export const emptyDate = (): PartialDate => ({ year: "", month: "", day: "" });

export function emptySource(id: string, type: SourceType = "book"): Source {
  return {
    id,
    type,
    authors: [{ given: "", family: "" }],
    editors: [],
    title: "",
    container: "",
    publisher: "",
    place: "",
    edition: "",
    volume: "",
    issue: "",
    pages: "",
    number: "",
    thesisType: "phd",
    date: emptyDate(),
    accessed: emptyDate(),
    doi: "",
    url: "",
  };
}
