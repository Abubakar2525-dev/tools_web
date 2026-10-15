"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { htmlNodeToText, type NodeLike } from "./lib/html";

const options: TextOption[] = [
  {
    id: "links",
    label: "Links",
    type: "select",
    default: "text-url",
    options: [
      { value: "text", label: "Link text only" },
      { value: "text-url", label: "Text (URL)" },
      { value: "url", label: "URL only" },
    ],
  },
  {
    id: "tables",
    label: "Tables",
    type: "select",
    default: "tsv",
    options: [
      { value: "tsv", label: "Tab-separated rows" },
      { value: "pipe", label: "Pipe-separated rows" },
    ],
  },
  { id: "bullet", label: "Bullet for list items", type: "text", default: "• ", mono: true },
  { id: "upper", label: "Uppercase headings", type: "checkbox", default: false },
  { id: "images", label: "Keep image alt text as [alt]", type: "checkbox", default: false },
];

/**
 * DOMParser builds an inert document: scripts do not run, and nothing is
 * inserted into the live page.
 */
const transform = (input: string, o: TextOptions) => {
  const doc = new DOMParser().parseFromString(input, "text/html");
  const output = htmlNodeToText(doc.body as unknown as NodeLike, {
    links: String(o.links) as "text" | "text-url" | "url",
    tables: o.tables === "pipe" ? "pipe" : "tsv",
    bullets: String(o.bullet),
    headingsUpper: o.upper === true,
    images: o.images === true,
  });
  return output;
};

const sample = `<h2>Release notes</h2>
<p>Version 2.4 is out. Read the <a href="https://example.com/changelog">full changelog</a>.</p>
<ul><li>Faster search</li><li>New export formats<ol><li>CSV</li><li>JSON</li></ol></li></ul>
<table><tr><th>Plan</th><th>Price</th></tr><tr><td>Basic</td><td>$9</td></tr></table>
<script>console.log("ignored")</script>`;

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      options={options}
      sample={sample}
      inputLabel="HTML"
      outputLabel="Plain text"
      inputPlaceholder="Paste HTML here"
      downloadName="text.txt"
      mono
    />
  );
}
