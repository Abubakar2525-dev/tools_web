"use client";

import { CitationStyleTool, type StyleGuide } from "./shared/CitationStyleTool";

const STYLES = [{ value: "apa" as const, label: "APA 7" }];

const GUIDE: StyleGuide = {
  edition: "Follows the Publication Manual of the American Psychological Association, 7th edition (2020).",
  points: [
    "Up to 20 authors are listed in the reference; 21 or more show the first 19, an ellipsis, then the last author.",
    "In-text: one or two authors are always named (“&” in parentheses, “and” in running text); three or more use “et al.” from the first citation.",
    "Titles keep your capitalization. APA wants sentence case for article and book titles, so capitalize only the first word, the first word after a colon and proper nouns.",
    "DOIs are shown as https://doi.org/ links and replace the URL. No “Retrieved from” unless the page has no date and changes over time.",
    "No author: the title moves to the author position. No date: “n.d.”.",
    "The publisher is dropped when it is the same organization as the author.",
  ],
};

export default function Tool() {
  return <CitationStyleTool styles={STYLES} title="APA 7 citation" guide={GUIDE} titleHint="Type it in sentence case: only the first word, the first word after a colon and proper nouns capitalized." />;
}
