"use client";

import { TextTransformTool, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { reverseText, type ReverseMode } from "./lib/lines";

const modes = [
  { value: "chars", label: "Characters" },
  { value: "chars-per-line", label: "Characters per line" },
  { value: "words", label: "Word order" },
  { value: "lines", label: "Line order" },
];

const transform = (input: string, o: TextOptions) => reverseText(input, String(o.mode) as ReverseMode);

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      modes={modes}
      sample={"Hello, world! 👋🏽\nSecond line café"}
      downloadName="reversed.txt"
      allowSwap
    />
  );
}
