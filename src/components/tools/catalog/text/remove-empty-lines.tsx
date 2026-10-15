"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { removeEmptyLines } from "./lib/lines";

const modes = [
  { value: "all", label: "Remove all blank lines" },
  { value: "collapse", label: "Collapse runs to one" },
];

const options: TextOption[] = [{ id: "ws", label: "Lines with only spaces or tabs count as empty", type: "checkbox", default: true }];

const transform = (input: string, o: TextOptions) => {
  const r = removeEmptyLines(input, { mode: o.mode === "collapse" ? "collapse" : "all", whitespaceIsEmpty: o.ws === true });
  return { output: r.output, summary: `Removed ${r.removed.toLocaleString()} empty line${r.removed === 1 ? "" : "s"}` };
};

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      modes={modes}
      options={options}
      sample={"First paragraph line.\n\n\n\nSecond paragraph.\n   \nThird line.\n\n"}
      downloadName="no-empty-lines.txt"
    />
  );
}
