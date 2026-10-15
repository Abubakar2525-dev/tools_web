"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { removeDuplicateLines } from "./lib/lines";

const options: TextOption[] = [
  { id: "caseInsensitive", label: "Ignore case", type: "checkbox", default: false, hint: "Treat Apple and apple as the same line." },
  { id: "trim", label: "Ignore leading and trailing spaces", type: "checkbox", default: true },
  { id: "keepEmpty", label: "Keep blank lines", type: "checkbox", default: false, hint: "Otherwise repeated blank lines count as duplicates." },
];

const transform = (input: string, o: TextOptions) => {
  const r = removeDuplicateLines(input, { caseInsensitive: o.caseInsensitive === true, trim: o.trim === true, keepEmpty: o.keepEmpty === true });
  return {
    output: r.output,
    summary: `Removed ${r.removed.toLocaleString()} duplicate line${r.removed === 1 ? "" : "s"} · ${r.kept.toLocaleString()} kept`,
  };
};

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      options={options}
      sample={"apple\nbanana\nApple\ncherry\nbanana\n  cherry\ndate"}
      downloadName="unique-lines.txt"
      mono
    />
  );
}
