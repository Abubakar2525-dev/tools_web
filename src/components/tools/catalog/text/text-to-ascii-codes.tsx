"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { codesToText, textToCodes, type CodeMode } from "./lib/encode";

const modes = [
  { value: "encode", label: "Text to codes" },
  { value: "decode", label: "Codes to text" },
];

const options: TextOption[] = [
  {
    id: "codes",
    label: "Number type",
    type: "select",
    default: "codepoint",
    hint: "Plain ASCII gives the same numbers either way.",
    options: [
      { value: "codepoint", label: "Unicode code points (é = 233)" },
      { value: "utf8", label: "UTF-8 bytes (é = 195 169)" },
    ],
  },
  {
    id: "sep",
    label: "Separator",
    type: "select",
    default: " ",
    options: [
      { value: " ", label: "Space" },
      { value: ", ", label: "Comma" },
      { value: "\n", label: "New line" },
    ],
  },
];

const transform = (input: string, o: TextOptions) => {
  const mode = String(o.codes) as CodeMode;
  if (o.mode === "decode") return codesToText(input, mode);
  const output = textToCodes(input, mode, String(o.sep));
  const nonAscii = Array.from(input).some((c) => (c.codePointAt(0) ?? 0) > 127);
  return { output, warning: nonAscii ? "Some characters are outside ASCII (above 127), so they are shown as Unicode values." : undefined };
};

export default function Tool() {
  return <TextTransformTool transform={transform} modes={modes} options={options} sample="ASCII art: <3" downloadName="codes.txt" mono allowSwap />;
}
