"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { joinLines, splitText } from "./lib/lines";

const modes = [
  { value: "split", label: "Split into lines" },
  { value: "join", label: "Join lines" },
];

const options: TextOption[] = [
  {
    id: "delim",
    label: "Delimiter",
    type: "select",
    default: ",",
    options: [
      { value: ",", label: "Comma" },
      { value: ", ", label: "Comma and space (join)" },
      { value: ";", label: "Semicolon" },
      { value: "\\t", label: "Tab" },
      { value: "|", label: "Pipe" },
      { value: " ", label: "Space" },
      { value: "custom", label: "Custom text" },
      { value: "regex", label: "Regular expression (split)" },
    ],
  },
  { id: "custom", label: "Custom delimiter or pattern", type: "text", default: "", mono: true, placeholder: "e.g. \\s*[,;]\\s*", hint: "Used for Custom text or Regular expression." },
  {
    id: "quote",
    label: "Quote items (join)",
    type: "select",
    default: "none",
    options: [
      { value: "none", label: "No quotes" },
      { value: "double", label: 'Double quotes "a"' },
      { value: "single", label: "Single quotes 'a'" },
    ],
  },
  { id: "trim", label: "Trim spaces around items", type: "checkbox", default: true },
  { id: "removeEmpty", label: "Remove empty items", type: "checkbox", default: true },
];

const transform = (input: string, o: TextOptions) => {
  const choice = String(o.delim);
  const isRegex = choice === "regex";
  const delimiter = choice === "custom" || isRegex ? String(o.custom) : choice;
  if (!delimiter) return { output: "", error: "Enter a custom delimiter or pattern." };
  if (o.mode === "join") {
    if (isRegex) return { output: "", error: "Joining needs plain text, not a regular expression. Choose Custom text instead." };
    const output = joinLines(input, {
      delimiter,
      quote: String(o.quote) as "none" | "double" | "single",
      trim: o.trim === true,
      skipEmpty: o.removeEmpty === true,
    });
    return { output, summary: `Joined into ${output.length.toLocaleString()} characters` };
  }
  const parts = splitText(input, { delimiter, regex: isRegex, trim: o.trim === true, removeEmpty: o.removeEmpty === true });
  return { output: parts.join("\n"), summary: `${parts.length.toLocaleString()} item${parts.length === 1 ? "" : "s"}` };
};

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      modes={modes}
      options={options}
      sample={"red, green, blue,  yellow,,purple"}
      downloadName="items.txt"
      mono
      allowSwap
    />
  );
}
