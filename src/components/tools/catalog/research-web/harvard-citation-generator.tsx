"use client";

import { CitationStyleTool, type StyleGuide } from "./shared/CitationStyleTool";

const STYLES = [{ value: "harvard" as const, label: "Harvard" }];

const GUIDE: StyleGuide = {
  edition: "Follows the Cite Them Right version of Harvard (Pears and Shields). Harvard has no single official manual, so check your institution’s guide for small differences.",
  points: [
    "Initials have no spaces (Smith, J.R.). Names are joined with “and”, without a comma before the last one.",
    "In-text: up to three authors are named; four or more use “et al.” The year follows a comma: (Smith, 2020, p. 12).",
    "Part titles go in single quotation marks; books, reports, webpages and theses are italicized. Your capitalization is kept.",
    "Online sources end with “Available at: URL (Accessed: date).” Add the accessed date for webpages.",
    "Editions are written as “2nd edn.” and the place of publication comes before the publisher.",
    "No date: “(no date)”. Several works by the same author in one year get 2020a, 2020b in the reference list generator.",
  ],
};

export default function Tool() {
  return <CitationStyleTool styles={STYLES} title="Harvard citation" guide={GUIDE} titleHint="Your capitalization is kept. Cite Them Right examples capitalize the first word and proper nouns." />;
}
