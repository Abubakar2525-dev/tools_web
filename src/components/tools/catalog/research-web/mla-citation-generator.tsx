"use client";

import { CitationStyleTool, type StyleGuide } from "./shared/CitationStyleTool";

const STYLES = [{ value: "mla" as const, label: "MLA 9" }];

const GUIDE: StyleGuide = {
  edition: "Follows the MLA Handbook, 9th edition (2021): core elements in order, grouped into containers.",
  points: [
    "One author: Family, Given. Two: the second name is not inverted. Three or more: first author followed by “et al.”",
    "Titles are converted to title case. Part titles (articles, chapters, pages) go in quotation marks; whole works (books, reports) are italicized.",
    "Academic publishers are shortened: “University” becomes “U” and “Press” becomes “P” (Oxford UP). Business words like Inc. are dropped.",
    "Page ranges use MLA’s short form (pp. 436–44). URLs are shown without https://; DOIs keep https://doi.org/.",
    "An access date is added for webpages, or for any source without a publication date.",
    "In-text citations use the author’s family name and page with no comma: (Kahneman 45).",
  ],
};

export default function Tool() {
  return <CitationStyleTool styles={STYLES} title="MLA 9 citation" guide={GUIDE} titleHint="Any capitalization works. MLA titles are converted to title case automatically." />;
}
