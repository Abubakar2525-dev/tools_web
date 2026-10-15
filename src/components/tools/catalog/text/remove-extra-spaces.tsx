"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { removeExtraSpaces } from "./lib/lines";

const options: TextOption[] = [
  { id: "collapse", label: "Collapse repeated spaces to one", type: "checkbox", default: true },
  { id: "trimLines", label: "Trim spaces at line start and end", type: "checkbox", default: true },
  { id: "nbsp", label: "Treat non-breaking spaces as normal spaces", type: "checkbox", default: true },
  { id: "tabs", label: "Convert tabs to spaces", type: "checkbox", default: false },
  { id: "tabSize", label: "Tab width", type: "number", default: "4", hint: "Tabs expand to the next tab stop." },
  { id: "removeAll", label: "Remove all spaces", type: "checkbox", default: false, hint: "Line breaks are kept." },
];

const transform = (input: string, o: TextOptions) => {
  const tabSize = Number.parseInt(String(o.tabSize), 10);
  if (o.tabs === true && !(tabSize >= 1 && tabSize <= 16)) return { output: "", error: "Tab width must be a whole number from 1 to 16." };
  const output = removeExtraSpaces(input, {
    collapse: o.collapse === true,
    trimLines: o.trimLines === true,
    nbsp: o.nbsp === true,
    tabsToSpaces: o.tabs === true,
    tabSize,
    removeAll: o.removeAll === true,
  });
  const diff = input.length - output.length;
  return {
    output,
    summary: `${diff >= 0 ? "Removed" : "Added"} ${Math.abs(diff).toLocaleString()} characters · ${output.length.toLocaleString()} total`,
  };
};

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      options={options}
      sample={"   This    sentence  has   too many spaces.   \nSo\tdoes\t\tthis   one.  "}
      downloadName="trimmed.txt"
      mono
    />
  );
}
