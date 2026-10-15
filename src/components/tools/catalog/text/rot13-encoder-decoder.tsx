"use client";

import { TextTransformTool, type TextOptions } from "@/components/tools/engines/TextTransformTool";
import { rot, type RotMode } from "./lib/encode";

const modes = [
  { value: "rot13", label: "ROT13 (letters)" },
  { value: "rot5", label: "ROT5 (digits)" },
  { value: "rot18", label: "ROT18 (letters and digits)" },
  { value: "rot47", label: "ROT47 (all printable ASCII)" },
];

const transform = (input: string, o: TextOptions) => rot(input, String(o.mode) as RotMode);

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      modes={modes}
      sample={"Why did the chicken cross the road? Gb trg gb gur bgure fvqr. Call 555-0142."}
      downloadName="rot.txt"
      allowSwap
    />
  );
}
