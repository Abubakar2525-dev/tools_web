"use client";

import { CitationStyleTool, type StyleGuide } from "./shared/CitationStyleTool";

const STYLES = [
  { value: "chicago-notes" as const, label: "Notes and bibliography" },
  { value: "chicago-ad" as const, label: "Author-date" },
];

const GUIDE: StyleGuide = {
  edition: "Follows The Chicago Manual of Style, 18th edition (2024): notes and bibliography (chapter 14) and author-date (chapter 13).",
  points: [
    "Notes name up to two authors; three or more become “First Author et al.” In the bibliography, up to six authors are listed; seven or more show the first three and “et al.”",
    "The full note is used the first time you cite a source; later notes use the short form (family name, short title, page). Chicago 18 prefers short notes over “ibid.”",
    "The place of publication is optional in Chicago 18. It is included only if you enter it.",
    "Titles are converted to headline-style capitalization. Page ranges are given in full.",
    "Author-date in-text citations have no comma between name and year: (Kahneman 2011, 45).",
    "Webpages without a date get an access date; DOIs are preferred over URLs.",
  ],
};

export default function Tool() {
  return (
    <CitationStyleTool
      styles={STYLES}
      title="Chicago citation"
      guide={GUIDE}
      titleHint="Any capitalization works. Chicago titles are converted to headline style automatically."
      locatorHint="Page cited in the note or in-text citation, e.g. 45."
    />
  );
}
