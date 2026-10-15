"use client";

import { TextTransformTool, type TextOption, type TextOptions, type TransformResult } from "@/components/tools/engines/TextTransformTool";
import { decodeText, encodeText } from "./lib/web-url";

const MODES = [
  { value: "component", label: "Encode component" },
  { value: "uri", label: "Encode full URL" },
  { value: "decode", label: "Decode" },
];

const OPTIONS: TextOption[] = [
  { id: "plus", label: "Use + for spaces", type: "checkbox", default: false, hint: "Form encoding (application/x-www-form-urlencoded). When decoding, + becomes a space." },
  { id: "lines", label: "Process each line separately", type: "checkbox", default: false, hint: "Keeps line breaks, handy for lists of values." },
];

function transform(input: string, o: TextOptions): TransformResult {
  const mode = String(o.mode);
  const plus = o.plus === true;
  const run = (s: string) => (mode === "decode" ? decodeText(s, plus) : encodeText(s, mode === "uri" ? "uri" : "component", plus));
  try {
    const output = o.lines === true ? input.split(/\r?\n/).map(run).join("\n") : run(input);
    const summary =
      mode === "decode"
        ? `Decoded ${input.length.toLocaleString()} → ${output.length.toLocaleString()} characters`
        : `Encoded ${input.length.toLocaleString()} → ${output.length.toLocaleString()} characters (UTF-8)`;
    return { output, summary };
  } catch (e) {
    if (e instanceof URIError) return { output: "", error: "This text contains an unpaired surrogate character, which cannot be encoded as UTF-8." };
    return { output: "", error: e instanceof Error ? e.message : "Could not process this text." };
  }
}

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      modes={MODES}
      options={OPTIONS}
      mono
      allowSwap
      sample={"https://example.com/search?q=café & crème&lang=fr"}
      inputLabel="Text or URL"
      outputLabel="Result"
      downloadName="url-encoded.txt"
    />
  );
}
