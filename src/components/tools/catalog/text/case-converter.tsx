"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { convertCase, type CaseMode } from "./lib/case";

const options: TextOption[] = [
  {
    id: "mode",
    label: "Convert to",
    type: "select",
    default: "title",
    options: [
      { value: "upper", label: "UPPERCASE" },
      { value: "lower", label: "lowercase" },
      { value: "title", label: "Title Case" },
      { value: "sentence", label: "Sentence case" },
      { value: "camel", label: "camelCase" },
      { value: "pascal", label: "PascalCase" },
      { value: "snake", label: "snake_case" },
      { value: "kebab", label: "kebab-case" },
      { value: "constant", label: "CONSTANT_CASE" },
      { value: "dot", label: "dot.case" },
      { value: "alternating", label: "aLtErNaTiNg" },
      { value: "inverse", label: "iNVERSE cASE" },
    ],
    hint: "Programming cases convert each line separately.",
  },
  {
    id: "smart",
    label: "Keep minor words lowercase in titles",
    type: "checkbox",
    default: true,
    hint: "a, an, the, and, of, to and similar, except the first and last word.",
  },
];

const transform = (input: string, o: TextOptions) => convertCase(input, String(o.mode) as CaseMode, { smartTitle: o.smart === true });

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      options={options}
      sample={"the quick brown fox jumps over the lazy dog\nuser account id\nparseHTTPResponse"}
      downloadName="converted.txt"
      allowSwap
    />
  );
}
