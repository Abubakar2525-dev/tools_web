"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { applyOp, groupBits, mask, parseInBase, signedRange, toBase, twosComplement, type BitOp } from "./lib/numberbase";
import { BigDigits } from "./ui";

const BASES = Array.from({ length: 35 }, (_, i) => {
  const b = i + 2;
  const name: Record<number, string> = { 2: "binary", 8: "octal", 10: "decimal", 16: "hexadecimal" };
  return { value: String(b), label: `Base ${b}${name[b] ? ` (${name[b]})` : ""}` };
});

const OPS: { value: "none" | BitOp; label: string }[] = [
  { value: "none", label: "Convert only" },
  { value: "add", label: "+ add" },
  { value: "sub", label: "− subtract" },
  { value: "mul", label: "× multiply" },
  { value: "div", label: "÷ divide (integer)" },
  { value: "mod", label: "mod (remainder)" },
  { value: "and", label: "AND" },
  { value: "or", label: "OR" },
  { value: "xor", label: "XOR" },
  { value: "not", label: "NOT (A only)" },
  { value: "shl", label: "<< shift left by B" },
  { value: "shr", label: ">> arithmetic shift right by B" },
  { value: "ushr", label: ">>> logical shift right by B" },
];

const SYM: Record<string, string> = { add: "+", sub: "−", mul: "×", div: "÷", mod: "mod", and: "AND", or: "OR", xor: "XOR", shl: "<<", shr: ">>", ushr: ">>>" };

const spec: FormulaSpec = {
  fields: [
    { id: "a", label: "Number A", type: "text", mono: true, placeholder: "FF or -1011", hint: "Negative numbers start with −. Prefixes 0x, 0b, 0o are accepted." },
    { id: "abase", label: "Base of A", type: "select", options: BASES },
    { id: "op", label: "Operation", type: "select", options: OPS },
    { id: "b", label: "Number B", type: "text", mono: true, optional: true, placeholder: "1010" },
    { id: "bbase", label: "Base of B", type: "select", options: BASES },
    { id: "out", label: "Show result in", type: "select", options: BASES },
    {
      id: "bits",
      label: "Bit width",
      type: "select",
      options: [
        { value: "none", label: "Unlimited (exact)" },
        { value: "8", label: "8-bit" },
        { value: "16", label: "16-bit" },
        { value: "32", label: "32-bit" },
        { value: "64", label: "64-bit" },
      ],
      hint: "With a width, results wrap like a fixed-size signed integer and two's complement is shown.",
    },
  ],
  defaults: { abase: "16", bbase: "2", op: "none", out: "10", bits: "none" },
  example: { a: "FF", abase: "16", op: "xor", b: "10101010", bbase: "2", out: "2", bits: "8" },
  compute: (v) => {
    const abase = Number(v.str("abase"));
    const bbase = Number(v.str("bbase"));
    const out = Number(v.str("out"));
    const bits = v.str("bits") === "none" ? null : Number(v.str("bits"));
    const op = v.str("op") as "none" | BitOp;
    let a: bigint;
    try {
      a = parseInBase(v.str("a"), abase);
    } catch (e) {
      return `A: ${e instanceof Error ? e.message : "invalid"}`;
    }
    let b = BigInt(0);
    const needsB = op !== "none" && op !== "not";
    if (needsB) {
      if (!v.str("b").trim()) return null;
      try {
        b = parseInBase(v.str("b"), bbase);
      } catch (e) {
        return `B: ${e instanceof Error ? e.message : "invalid"}`;
      }
    }
    if (bits !== null) {
      const [lo] = signedRange(bits);
      for (const [name, x] of [["A", a], ["B", b]] as const) {
        if (x < lo || x > mask(bits)) return `${name} does not fit in ${bits} bits (range ${lo} to ${mask(bits)}).`;
      }
    }
    let value = a;
    let note: string | undefined;
    const steps: string[] = [`A = ${v.str("a").trim()} (base ${abase}) = ${a} in decimal`];
    if (needsB) steps.push(`B = ${v.str("b").trim()} (base ${bbase}) = ${b} in decimal`);
    if (op !== "none") {
      try {
        const r = applyOp(op, a, b, bits);
        value = r.value;
        note = r.note;
      } catch (e) {
        return e instanceof Error ? e.message : "Could not compute.";
      }
      steps.push(op === "not" ? `NOT A = ${value}` : `${a} ${SYM[op]} ${b} = ${value}`);
      if (op === "div") steps.push("Integer division truncates toward zero.");
      if (note) steps.push(note);
    }
    const outText = toBase(value, out);
    steps.push(`Convert to base ${out} by repeated division: ${outText}`);
    let twos: string | null = null;
    if (bits !== null) {
      twos = twosComplement(value, bits);
      steps.push(`${bits}-bit two's complement pattern: ${twos}${value < BigInt(0) ? " (invert the bits of |x| and add 1)" : ""}`);
    }
    const binary = value < BigInt(0) ? `−${groupBits((-value).toString(2))}` : groupBits(value.toString(2));
    const long = outText.length > 40;
    return {
      outputs: [
        { label: `Result (base ${out})`, value: long ? `${outText.slice(0, 32)}…` : outText, primary: true, note: note ?? (long ? "Full value below." : undefined) },
        { label: "Decimal", value: value.toString().length > 30 ? `${value.toString().slice(0, 28)}…` : value.toString() },
        { label: "Hexadecimal", value: toBase(value, 16).length > 30 ? `${toBase(value, 16).slice(0, 28)}…` : toBase(value, 16) },
        { label: "Octal", value: toBase(value, 8).length > 30 ? `${toBase(value, 8).slice(0, 28)}…` : toBase(value, 8) },
        ...(twos ? [{ label: `${bits}-bit two's complement`, value: twos }, { label: "Hex pattern", value: (value & mask(bits as number)).toString(16).toUpperCase().padStart((bits as number) / 4, "0") }] : []),
      ],
      visual: <BigDigits label="Binary (sign and magnitude)" value={binary} note={long ? `Base ${out}: ${outText}` : undefined} />,
      steps,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
