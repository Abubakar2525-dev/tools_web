"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { sortLines, type SortMode } from "./lib/lines";

const modes = [
  { value: "alpha", label: "Alphabetical" },
  { value: "natural", label: "Natural (numbers by value)" },
  { value: "length", label: "By length" },
];

const options: TextOption[] = [
  { id: "reverse", label: "Reverse order (Z to A, longest first)", type: "checkbox", default: false },
  { id: "caseInsensitive", label: "Ignore case", type: "checkbox", default: true },
  { id: "unique", label: "Remove duplicates", type: "checkbox", default: false },
  { id: "ignoreEmpty", label: "Drop empty lines", type: "checkbox", default: true },
  {
    id: "locale",
    label: "Sorting language",
    type: "select",
    default: "",
    hint: "Controls how accents and special letters sort.",
    options: [
      { value: "", label: "Browser default" },
      { value: "en", label: "English" },
      { value: "de", label: "German" },
      { value: "es", label: "Spanish" },
      { value: "fr", label: "French" },
      { value: "sv", label: "Swedish" },
      { value: "pl", label: "Polish" },
      { value: "tr", label: "Turkish" },
    ],
  },
];

const transform = (input: string, o: TextOptions) => {
  const output = sortLines(input, {
    mode: String(o.mode) as SortMode,
    reverse: o.reverse === true,
    caseInsensitive: o.caseInsensitive === true,
    unique: o.unique === true,
    ignoreEmpty: o.ignoreEmpty === true,
    locale: String(o.locale),
  });
  return { output, summary: `${output ? output.split(/\r\n|\n/).length.toLocaleString() : 0} lines sorted` };
};

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      modes={modes}
      options={options}
      sample={"file10.txt\nfile2.txt\nbanana\nApple\nfile1.txt\ncherry\nÉclair"}
      downloadName="sorted.txt"
      mono
    />
  );
}
