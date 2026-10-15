"use client";

import { TextTransformTool, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { EMOJI, translateEmoji } from "./lib/emoji";

const modes = [
  { value: "after", label: "Add emoji after words" },
  { value: "replace", label: "Replace words with emoji" },
];

const transform = (input: string, o: TextOptions) => {
  const r = translateEmoji(input, o.mode === "replace" ? "replace" : "after");
  return {
    output: r.output,
    summary: `${r.matched.toLocaleString()} word${r.matched === 1 ? "" : "s"} matched from a ${EMOJI.size.toLocaleString()}-word dictionary`,
  };
};

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      modes={modes}
      sample={"Happy birthday! Let's grab pizza and coffee, then walk the dog on the beach before the rain."}
      downloadName="emoji.txt"
    />
  );
}
