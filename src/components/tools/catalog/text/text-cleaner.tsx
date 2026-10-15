"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { cleanText } from "./lib/clean";

const options: TextOption[] = [
  { id: "invisible", label: "Remove zero-width and invisible characters", type: "checkbox", default: true },
  { id: "nbsp", label: "Non-breaking spaces to normal spaces", type: "checkbox", default: true },
  { id: "collapseSpaces", label: "Collapse repeated spaces and tabs", type: "checkbox", default: true },
  { id: "trimLines", label: "Trim spaces at line start and end", type: "checkbox", default: true },
  { id: "collapseBlank", label: "Collapse multiple blank lines", type: "checkbox", default: true },
  { id: "smartQuotes", label: "Smart quotes to straight quotes", type: "checkbox", default: true },
  { id: "dashes", label: "En and em dashes to hyphens", type: "checkbox", default: false },
  { id: "ellipsis", label: "Ellipsis character to three dots", type: "checkbox", default: false },
  { id: "html", label: "Strip HTML tags and decode entities", type: "checkbox", default: false },
  {
    id: "rejoin",
    label: "Rejoin hard-wrapped lines into paragraphs",
    type: "checkbox",
    default: false,
    hint: "Blank lines and list items keep their breaks.",
  },
];

const transform = (input: string, o: TextOptions) => {
  const { output, changes } = cleanText(input, {
    invisible: o.invisible === true,
    nbsp: o.nbsp === true,
    collapseSpaces: o.collapseSpaces === true,
    trimLines: o.trimLines === true,
    collapseBlank: o.collapseBlank === true,
    smartQuotes: o.smartQuotes === true,
    dashes: o.dashes === true,
    ellipsis: o.ellipsis === true,
    html: o.html === true,
    rejoin: o.rejoin === true,
  });
  const parts = Object.entries(changes).map(([k, v]) => `${k}: ${v.toLocaleString()}`);
  return { output, summary: parts.length ? `Fixed ${parts.join(" · ")}` : "Nothing else to clean with these options." };
};

const sample =
  "  Copied   from a PDF​, this text has “curly quotes”…\nand lines that were\nwrapped by hand.\n\n\n\nA second   paragraph.  ";

export default function Tool() {
  return <TextTransformTool transform={transform} options={options} sample={sample} downloadName="cleaned.txt" allowSwap />;
}
