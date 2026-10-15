"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { numberLines, unescapeDelimiter } from "./lib/lines";

const options: TextOption[] = [
  { id: "start", label: "Start at", type: "number", default: "1" },
  { id: "step", label: "Step", type: "number", default: "1" },
  { id: "sep", label: "Separator", type: "text", default: ". ", mono: true, hint: "Text between number and line. Use \\t for a tab." },
  {
    id: "pad",
    label: "Padding",
    type: "select",
    default: "none",
    options: [
      { value: "none", label: "None (1, 2 … 10)" },
      { value: "zero", label: "Leading zeros (01, 02 … 10)" },
      { value: "space", label: "Spaces (right-aligned)" },
    ],
  },
  { id: "skipEmpty", label: "Skip empty lines", type: "checkbox", default: false, hint: "Blank lines stay but are not numbered." },
];

const intOf = (v: string | boolean) => {
  const s = String(v).trim();
  return /^-?\d{1,9}$/.test(s) ? Number(s) : null;
};

const transform = (input: string, o: TextOptions) => {
  const start = intOf(o.start);
  const step = intOf(o.step);
  if (start === null) return { output: "", error: "Start must be a whole number." };
  if (step === null || step === 0) return { output: "", error: "Step must be a whole number other than 0." };
  return numberLines(input, {
    start,
    step,
    separator: unescapeDelimiter(String(o.sep)),
    pad: String(o.pad) as "none" | "zero" | "space",
    skipEmpty: o.skipEmpty === true,
  });
};

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      options={options}
      sample={"Preheat the oven\nMix the dry ingredients\n\nAdd eggs and milk\nBake for 25 minutes"}
      downloadName="numbered.txt"
      mono
    />
  );
}
