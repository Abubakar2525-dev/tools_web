"use client";

import { TextTransformTool, type TextOption, type TextOptions, type TransformResult } from "@/components/tools/engines/TextTransformTool";
import { baseStats, cleanSequence, complement, reverse, reverseComplement, reverseTranscribe, transcribe, wrap } from "./lib/genetics";

const modes = [
  { value: "revcomp", label: "Reverse complement" },
  { value: "comp", label: "Complement" },
  { value: "rev", label: "Reverse" },
  { value: "mrna", label: "mRNA from coding strand" },
  { value: "mrnaT", label: "mRNA from template strand" },
  { value: "dna", label: "RNA to DNA" },
];

const options: TextOption[] = [
  {
    id: "width",
    label: "Line width",
    type: "select",
    default: "0",
    options: [
      { value: "0", label: "One line per sequence" },
      { value: "60", label: "60 bases (FASTA)" },
      { value: "70", label: "70 bases" },
      { value: "80", label: "80 bases" },
    ],
  },
  {
    id: "case",
    label: "Letter case",
    type: "select",
    default: "keep",
    options: [
      { value: "keep", label: "Keep input case" },
      { value: "upper", label: "UPPERCASE" },
      { value: "lower", label: "lowercase" },
    ],
  },
  { id: "headers", label: "Keep FASTA headers in the output", type: "checkbox", default: true },
];

const SAMPLE = `>demo_gene partial coding sequence
ATGGCTAGCAAAGGAGAAGAACTTTTCACTGGAGTTGTCCCAATTCTTGTTGAATTAGATGGTGATGTTAATGGGCACAAATTTTCTGTC
AGTGGAGAGGGTGAAGGTGATGCAACATACGGAAAACTTACCCTTAAATTTATTTGCACTACTGGAAAACTACCTGTTCCATGGCCAACA`;

function transform(input: string, o: TextOptions): TransformResult {
  const cleaned = cleanSequence(input);
  if (cleaned.invalid.length) {
    const first = cleaned.invalid.slice(0, 5).map((x) => `"${x.char}" at base ${x.position}${cleaned.records.length > 1 ? ` of sequence ${x.record}` : ""}`);
    return {
      output: "",
      error: `Found ${cleaned.invalid.length} character${cleaned.invalid.length === 1 ? "" : "s"} that ${cleaned.invalid.length === 1 ? "is" : "are"} not IUPAC nucleotide codes: ${first.join(", ")}${cleaned.invalid.length > 5 ? ", ..." : ""}. Allowed: A C G T U R Y S W K M B D H V N and gaps (- or .).`,
    };
  }
  const mode = String(o.mode);
  const width = Number(o.width);
  const lines: string[] = [];
  let all = "";
  for (const r of cleaned.records) {
    let s = r.seq;
    const isRna = /[Uu]/.test(s) && !/[Tt]/.test(s);
    switch (mode) {
      case "comp":
        s = complement(s, isRna);
        break;
      case "revcomp":
        s = reverseComplement(s, isRna);
        break;
      case "rev":
        s = reverse(s);
        break;
      case "mrna":
        s = transcribe(s);
        break;
      case "mrnaT":
        s = transcribe(reverseComplement(s));
        break;
      case "dna":
        s = reverseTranscribe(s);
        break;
    }
    if (o.case === "upper") s = s.toUpperCase();
    if (o.case === "lower") s = s.toLowerCase();
    all += r.seq;
    if (o.headers && r.header !== null) lines.push(`>${r.header}${mode === "revcomp" || mode === "comp" || mode === "rev" ? ` (${modes.find((m) => m.value === mode)?.label.toLowerCase()})` : ""}`);
    lines.push(wrap(s, width));
  }
  const st = baseStats(all);
  const warnings: string[] = [];
  if (cleaned.hasU && cleaned.hasT) warnings.push("The input mixes T and U, so it is neither clean DNA nor clean RNA.");
  if ((mode === "mrna" || mode === "mrnaT") && cleaned.hasU && !cleaned.hasT) warnings.push("The input already looks like RNA (it has U and no T).");
  if (mode === "dna" && cleaned.hasT && !cleaned.hasU) warnings.push("The input already looks like DNA (it has T and no U).");
  const parts = [
    `${st.length.toLocaleString("en-US")} bases`,
    st.gcPercent !== null ? `GC ${st.gcPercent.toFixed(2)}%` : "GC n/a",
    `A ${st.counts.A ?? 0} · C ${st.counts.C ?? 0} · G ${st.counts.G ?? 0} · ${cleaned.hasU && !cleaned.hasT ? `U ${st.counts.U ?? 0}` : `T ${st.counts.T ?? 0}`}`,
  ];
  if (st.ambiguous) parts.push(`${st.ambiguous} ambiguous`);
  if (cleaned.records.length > 1) parts.push(`${cleaned.records.length} sequences`);
  return { output: lines.join("\n"), summary: parts.join(" · "), warning: warnings.join(" ") || undefined };
}

export default function Tool() {
  return (
    <TextTransformTool
      transform={transform}
      modes={modes}
      options={options}
      sample={SAMPLE}
      mono
      allowSwap
      inputLabel="Sequence (plain or FASTA)"
      outputLabel="Result"
      inputPlaceholder="Paste a DNA or RNA sequence, with or without FASTA headers"
      downloadName="sequence.fasta"
    />
  );
}
