"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { findReplace } from "./lib/lines";

const options: TextOption[] = [
  { id: "find", label: "Find", type: "text", default: "", mono: true, placeholder: "Text or pattern to find" },
  { id: "replace", label: "Replace with", type: "text", default: "", mono: true, placeholder: "Leave empty to delete matches", hint: "In regex mode, $1 or $<name> inserts a captured group." },
  { id: "regex", label: "Regular expression", type: "checkbox", default: false },
  { id: "caseSensitive", label: "Match case", type: "checkbox", default: false },
  { id: "wholeWord", label: "Whole words only", type: "checkbox", default: false },
  { id: "firstOnly", label: "Replace first match only", type: "checkbox", default: false },
];

const transform = (input: string, o: TextOptions) => {
  const find = String(o.find);
  if (!find) return { output: input, summary: "Enter text to find." };
  const r = findReplace(input, {
    find,
    replace: String(o.replace),
    regex: o.regex === true,
    caseSensitive: o.caseSensitive === true,
    wholeWord: o.wholeWord === true,
    firstOnly: o.firstOnly === true,
  });
  return {
    output: r.output,
    summary: r.count ? `Replaced ${r.count.toLocaleString()} match${r.count === 1 ? "" : "es"}` : "No matches found",
  };
};

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      options={options}
      sample={"Order 1042 shipped on 2026-03-14.\nOrder 1043 shipped on 2026-03-15.\nThe order total for order 1044 is pending."}
      downloadName="replaced.txt"
      allowSwap
    />
  );
}
