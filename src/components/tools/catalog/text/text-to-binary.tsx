"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { binaryToText, textToBinary } from "./lib/encode";

const modes = [
  { value: "encode", label: "Text to binary" },
  { value: "decode", label: "Binary to text" },
];

const options: TextOption[] = [
  {
    id: "sep",
    label: "Separator between bytes",
    type: "select",
    default: " ",
    hint: "Used when encoding. Decoding accepts any of these.",
    options: [
      { value: " ", label: "Space" },
      { value: "", label: "None" },
      { value: ",", label: "Comma" },
      { value: "\n", label: "New line" },
    ],
  },
];

const transform = (input: string, o: TextOptions) => {
  if (o.mode === "decode") {
    const output = binaryToText(input);
    return { output, summary: `${Array.from(output).length.toLocaleString()} characters decoded` };
  }
  const output = textToBinary(input, String(o.sep));
  const bytes = new TextEncoder().encode(input).length;
  return { output, summary: `${bytes.toLocaleString()} UTF-8 bytes · ${(bytes * 8).toLocaleString()} bits` };
};

export default function Tool() {
  return <TextTransformTool transform={transform} modes={modes} options={options} sample="Hi! ✓" downloadName="binary.txt" mono allowSwap />;
}
