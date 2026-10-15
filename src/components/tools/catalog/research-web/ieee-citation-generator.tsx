"use client";

import { CitationStyleTool, type StyleGuide } from "./shared/CitationStyleTool";

const STYLES = [{ value: "ieee" as const, label: "IEEE" }];

const GUIDE: StyleGuide = {
  edition: "Follows the IEEE Reference Style Guide for Authors (2023 update).",
  points: [
    "References are numbered in the order they are first cited, and cited in text as [1] or [1, p. 5].",
    "Names use initials before the family name (J. K. Author). Up to six authors are listed; seven or more use the first author and “et al.”",
    "Months are abbreviated (Jan., Feb., Mar., … Sep., Oct., Nov., Dec.).",
    "Journal articles end with “doi: 10.xxxx”. Online sources without a DOI end with “[Online]. Available: URL”.",
    "IEEE expects abbreviated journal names (for example IEEE Trans. Inf. Theory). Type the abbreviation you need; it is not looked up.",
    "This tool numbers a single reference as [1]. Use the reference list generator to number a whole list.",
  ],
};

export default function Tool() {
  return <CitationStyleTool styles={STYLES} title="IEEE reference" guide={GUIDE} titleHint="Article titles keep your capitalization (IEEE uses sentence case); book titles are usually in title case." />;
}
