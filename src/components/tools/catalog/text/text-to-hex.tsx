"use client";

import { TextTransformTool, type TextOption, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { hexToText, textToHex } from "./lib/encode";

const modes = [
  { value: "encode", label: "Text to hex" },
  { value: "decode", label: "Hex to text" },
];

const options: TextOption[] = [
  {
    id: "sep",
    label: "Separator",
    type: "select",
    default: " ",
    options: [
      { value: " ", label: "Space" },
      { value: "", label: "None" },
      { value: ":", label: "Colon" },
      { value: ",", label: "Comma" },
    ],
  },
  {
    id: "prefix",
    label: "Byte prefix",
    type: "select",
    default: "",
    options: [
      { value: "", label: "None" },
      { value: "0x", label: "0x" },
      { value: "\\x", label: "\\x" },
      { value: "%", label: "% (URL style)" },
    ],
  },
  { id: "upper", label: "Uppercase letters (A-F)", type: "checkbox", default: true },
];

const transform = (input: string, o: TextOptions) => {
  if (o.mode === "decode") return hexToText(input);
  const output = textToHex(input, { sep: String(o.sep), prefix: String(o.prefix), upper: o.upper === true });
  return { output, summary: `${new TextEncoder().encode(input).length.toLocaleString()} UTF-8 bytes` };
};

export default function Tool() {
  return <TextTransformTool transform={transform} modes={modes} options={options} sample="Nuvella Promo Code €5" downloadName="hex.txt" mono allowSwap />;
}
