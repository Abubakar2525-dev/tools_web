"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { textToHtml } from "./lib/html";

const options: TextOption[] = [
  { id: "paragraphs", label: "Wrap paragraphs in <p>", type: "checkbox", default: true, hint: "A blank line starts a new paragraph." },
  { id: "lineBreaks", label: "Single line breaks to <br>", type: "checkbox", default: true },
  { id: "links", label: "Turn URLs into links", type: "checkbox", default: true },
  { id: "emails", label: "Turn email addresses into mailto links", type: "checkbox", default: false },
  { id: "newTab", label: "Open links in a new tab", type: "checkbox", default: false, hint: "Adds rel=\"noopener noreferrer\"." },
  { id: "indent", label: "Indent paragraph contents", type: "checkbox", default: false },
];

const transform = (input: string, o: TextOptions) =>
  textToHtml(input, {
    paragraphs: o.paragraphs === true,
    lineBreaks: o.lineBreaks === true,
    links: o.links === true,
    emails: o.emails === true,
    newTab: o.newTab === true,
    indent: o.indent === true,
  });

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      options={options}
      sample={"Opening hours\nMon to Fri: 9 to 5\n\nQuestions? Read https://example.com/faq or write to help@example.com.\n\nPrices include tax & shipping < 5 kg."}
      downloadName="text.html"
      outputLabel="HTML"
      mono
    />
  );
}
