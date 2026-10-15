"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { limitLength } from "./lib/lines";

const modes = [
  { value: "chars", label: "Characters" },
  { value: "words", label: "Words" },
];

const options: TextOption[] = [
  { id: "max", label: "Maximum length", type: "number", default: "160" },
  { id: "ellipsis", label: "Ending when cut", type: "text", default: "…", mono: true, hint: "Counted inside the character limit. Leave empty for none." },
  { id: "boundary", label: "Cut at a word boundary", type: "checkbox", default: true, hint: "Characters mode only." },
  { id: "perLine", label: "Limit each line separately", type: "checkbox", default: false },
];

const transform = (input: string, o: TextOptions) => {
  const max = Number(String(o.max).trim());
  if (!Number.isInteger(max) || max < 1) return { output: "", error: "Maximum length must be a whole number of at least 1." };
  const r = limitLength(input, {
    unit: o.mode === "words" ? "words" : "chars",
    max,
    ellipsis: String(o.ellipsis),
    wordBoundary: o.boundary === true,
    perLine: o.perLine === true,
  });
  return {
    output: r.output,
    summary: r.truncated ? `Shortened ${r.truncated.toLocaleString()} ${o.perLine ? "lines" : "text"} · ${r.output.length.toLocaleString()} characters` : "Already within the limit",
  };
};

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      modes={modes}
      options={options}
      sample={
        "Meta descriptions, tweets and SMS messages all have practical length limits, so it helps to trim copy cleanly at a word boundary instead of cutting a word in half in the middle."
      }
      downloadName="limited.txt"
    />
  );
}
