"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { addPrefixSuffix, unescapeDelimiter } from "./lib/lines";

const options: TextOption[] = [
  { id: "prefix", label: "Prefix", type: "text", default: "- ", mono: true, placeholder: "Text before each line" },
  { id: "suffix", label: "Suffix", type: "text", default: "", mono: true, placeholder: "Text after each line" },
  { id: "skipEmpty", label: "Skip empty lines", type: "checkbox", default: true },
  { id: "trim", label: "Trim each line first", type: "checkbox", default: false },
  { id: "escapes", label: "Interpret \\t and \\n", type: "checkbox", default: true, hint: "Lets you add tabs or extra line breaks." },
];

const transform = (input: string, o: TextOptions) => {
  const conv = (s: string) => (o.escapes === true ? unescapeDelimiter(s) : s);
  return addPrefixSuffix(input, {
    prefix: conv(String(o.prefix)),
    suffix: conv(String(o.suffix)),
    skipEmpty: o.skipEmpty === true,
    trim: o.trim === true,
  });
};

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      options={options}
      sample={"alpha\nbeta\n\ngamma"}
      downloadName="lines.txt"
      mono
    />
  );
}
