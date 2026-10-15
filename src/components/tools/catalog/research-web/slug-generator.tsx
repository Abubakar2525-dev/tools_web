"use client";

import { TextTransformTool, type TextOption, type TextOptions, type TransformResult } from "@/components/tools/engines/TextTransformTool";
import { slugify } from "./lib/slug";

const OPTIONS: TextOption[] = [
  {
    id: "sep",
    label: "Separator",
    type: "select",
    default: "-",
    options: [
      { value: "-", label: "Hyphen (recommended for URLs)" },
      { value: "_", label: "Underscore" },
      { value: ".", label: "Dot" },
    ],
  },
  { id: "max", label: "Maximum length", type: "number", default: "60", hint: "Cut at a word boundary. 0 for no limit." },
  { id: "lower", label: "Lowercase", type: "checkbox", default: true },
  { id: "stop", label: "Remove common stop words", type: "checkbox", default: false, hint: "a, the, and, of, to… (English)." },
  { id: "german", label: "German umlauts as ae, oe, ue", type: "checkbox", default: false, hint: "Otherwise ä becomes a." },
  { id: "numbers", label: "Keep numbers", type: "checkbox", default: true },
];

function transform(input: string, o: TextOptions): TransformResult {
  const max = Number(o.max);
  if (String(o.max).trim() !== "" && (!Number.isInteger(max) || max < 0)) return { output: "", error: "Maximum length must be a whole number, 0 or more." };
  const lines = input.split(/\r?\n/);
  const slugs = lines.map((l) =>
    l.trim()
      ? slugify(l, {
          separator: (String(o.sep) as "-" | "_" | ".") || "-",
          lowercase: o.lower === true,
          removeStopWords: o.stop === true,
          maxLength: max || 0,
          german: o.german === true,
          keepNumbers: o.numbers === true,
        })
      : "",
  );
  const count = slugs.filter(Boolean).length;
  const empty = lines.filter((l, i) => l.trim() && !slugs[i]).length;
  return {
    output: slugs.join("\n"),
    summary: `${count} ${count === 1 ? "slug" : "slugs"}${count === 1 ? ` · ${slugs.find(Boolean)?.length ?? 0} characters` : ""}`,
    warning: empty ? `${empty} line(s) had no letters or digits left after cleanup.` : undefined,
  };
}

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      options={OPTIONS}
      mono
      sample={"Crème Brûlée: 10 Easy Recipes for Beginners\nŁódź & Kraków travel guide (2026)\nGrüße aus Köln, Ölçek ve Şehir"}
      inputLabel="Titles (one per line)"
      outputLabel="Slugs"
      inputPlaceholder="Type or paste a title, one per line"
      downloadName="slugs.txt"
    />
  );
}
