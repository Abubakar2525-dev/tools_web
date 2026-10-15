/**
 * Punnett squares (complete dominance, independent assortment) and DNA/RNA
 * sequence helpers with IUPAC nucleotide codes. Pure functions.
 */

/* ------------------------------------------------------------------ */
/* Punnett                                                             */
/* ------------------------------------------------------------------ */

export type Genotype = { genes: string[]; pairs: [string, string][] };

/** Parses "AaBb" or "Aa Bb" or "Aa/Bb" into allele pairs; 1-3 genes. */
export function parseGenotype(raw: string): Genotype | string {
  const s = raw.replace(/[\s/;,|]+/g, "");
  if (!s) return "Enter a genotype such as Aa or AaBb.";
  if (!/^[A-Za-z]+$/.test(s)) return "Use letters only, two per gene (for example AaBb).";
  if (s.length % 2 !== 0) return "Each gene needs exactly two alleles, so the genotype must have an even number of letters.";
  const pairs: [string, string][] = [];
  const genes: string[] = [];
  for (let i = 0; i < s.length; i += 2) {
    const a = s[i],
      b = s[i + 1];
    if (a.toLowerCase() !== b.toLowerCase()) return `"${a}${b}" mixes two genes. Write both alleles of a gene next to each other, like Aa.`;
    const g = a.toUpperCase();
    if (genes.includes(g)) return `Gene ${g} appears twice.`;
    genes.push(g);
    pairs.push(orderPair(a, b));
  }
  if (genes.length > 3) return "This calculator handles up to three genes (a trihybrid cross).";
  return { genes, pairs };
}

/** Dominant (uppercase) allele first. */
function orderPair(a: string, b: string): [string, string] {
  return a === a.toUpperCase() || b !== b.toUpperCase() ? [a, b] : [b, a];
}

/** All 2^n gametes in Punnett order (first gene varies slowest). */
export function gametes(g: Genotype): string[] {
  let out = [""];
  for (const [a, b] of g.pairs) out = out.flatMap((p) => [p + a, p + b]);
  return out;
}

export type PunnettResult = {
  genes: string[];
  rows: string[];
  cols: string[];
  grid: string[][];
  genotypes: { genotype: string; count: number }[];
  phenotypes: { phenotype: string; description: string; count: number }[];
  total: number;
};

export function punnett(p1: Genotype, p2: Genotype): PunnettResult | string {
  const a = p1.genes.join(""),
    b = p2.genes.join("");
  if (a !== b) return `Both parents must have the same genes in the same order (parent 1: ${a}, parent 2: ${b}).`;
  const rows = gametes(p1);
  const cols = gametes(p2);
  const grid = rows.map((r) =>
    cols.map((c) =>
      p1.genes
        .map((_, i) => orderPair(r[i], c[i]).join(""))
        .join(""),
    ),
  );
  const gCount = new Map<string, number>();
  const pCount = new Map<string, number>();
  for (const row of grid)
    for (const cell of row) {
      gCount.set(cell, (gCount.get(cell) ?? 0) + 1);
      const ph = phenotypeOf(cell);
      pCount.set(ph, (pCount.get(ph) ?? 0) + 1);
    }
  const genotypes = [...gCount.entries()].map(([genotype, count]) => ({ genotype, count })).sort((x, y) => cmpGenotype(x.genotype, y.genotype));
  const phenotypes = [...pCount.entries()]
    .map(([phenotype, count]) => ({ phenotype, count, description: describePhenotype(phenotype) }))
    .sort((x, y) => y.count - x.count || cmpGenotype(x.phenotype, y.phenotype));
  return { genes: p1.genes, rows, cols, grid, genotypes, phenotypes, total: rows.length * cols.length };
}

/** "AaBB" → "A_ B_"; "aabb" → "aa bb". */
export function phenotypeOf(genotype: string): string {
  const parts: string[] = [];
  for (let i = 0; i < genotype.length; i += 2) {
    const a = genotype[i];
    const b = genotype[i + 1];
    const U = a.toUpperCase();
    parts.push(a === U || b === U ? `${U}_` : `${a}${b}`);
  }
  return parts.join(" ");
}

function describePhenotype(ph: string): string {
  return ph
    .split(" ")
    .map((p) => (p.endsWith("_") ? `dominant ${p[0]}` : `recessive ${p[0]}`))
    .join(", ");
}

/** Sorts dominant-first: AA < Aa < aa per gene. */
function cmpGenotype(x: string, y: string) {
  const key = (s: string) =>
    s
      .split("")
      .map((ch) => (ch === "_" ? "1" : ch === " " ? "" : ch === ch.toUpperCase() ? "0" : "2"))
      .join("");
  return key(x) < key(y) ? -1 : key(x) > key(y) ? 1 : 0;
}

export function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/** Reduces counts to the smallest whole-number ratio, e.g. [4,8,4] → "1:2:1". */
export function ratio(counts: number[]): string {
  const g = counts.reduce((acc, c) => gcd(acc, c), 0) || 1;
  return counts.map((c) => c / g).join(":");
}

/* ------------------------------------------------------------------ */
/* DNA / RNA                                                           */
/* ------------------------------------------------------------------ */

/** IUPAC complements (DNA). U complements to A. Gaps stay gaps. */
const COMP: Record<string, string> = {
  A: "T",
  T: "A",
  U: "A",
  G: "C",
  C: "G",
  R: "Y",
  Y: "R",
  S: "S",
  W: "W",
  K: "M",
  M: "K",
  B: "V",
  V: "B",
  D: "H",
  H: "D",
  N: "N",
  "-": "-",
  ".": ".",
};

export const IUPAC_CODES = Object.keys(COMP).filter((k) => /[A-Z]/.test(k));

export type SeqRecord = { header: string | null; seq: string };

export type CleanResult = { records: SeqRecord[]; invalid: { char: string; record: number; position: number }[]; hasU: boolean; hasT: boolean };

/**
 * Splits FASTA records (lines starting with ">"), strips whitespace, digits
 * (GenBank-style numbering) and reports characters that are not IUPAC codes.
 */
export function cleanSequence(input: string): CleanResult {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const records: SeqRecord[] = [];
  let cur: SeqRecord | null = null;
  for (const line of lines) {
    if (line.startsWith(">") || line.startsWith(";")) {
      if (line.startsWith(";")) continue;
      cur = { header: line.slice(1).trim(), seq: "" };
      records.push(cur);
      continue;
    }
    if (!cur) {
      cur = { header: null, seq: "" };
      records.push(cur);
    }
    cur.seq += line.replace(/[\s\d]+/g, "").replace(/\*$/, "");
  }
  const invalid: CleanResult["invalid"] = [];
  let hasU = false;
  let hasT = false;
  records.forEach((r, ri) => {
    for (let i = 0; i < r.seq.length; i++) {
      const ch = r.seq[i].toUpperCase();
      if (!(ch in COMP)) invalid.push({ char: r.seq[i], record: ri + 1, position: i + 1 });
      if (ch === "U") hasU = true;
      if (ch === "T") hasT = true;
    }
  });
  return { records: records.filter((r) => r.seq.length || r.header !== null), invalid, hasU, hasT };
}

const keepCase = (src: string, out: string) => (src === src.toLowerCase() ? out.toLowerCase() : out);

/** Base-by-base complement. `rna` writes U instead of T. */
export function complement(seq: string, rna = false): string {
  let out = "";
  for (const ch of seq) {
    let c = COMP[ch.toUpperCase()] ?? ch;
    if (rna && c === "T") c = "U";
    out += keepCase(ch, c);
  }
  return out;
}

export const reverse = (seq: string) => [...seq].reverse().join("");
export const reverseComplement = (seq: string, rna = false) => reverse(complement(seq, rna));

/** Coding (sense) strand DNA → mRNA: T → U. */
export const transcribe = (seq: string) => seq.replace(/T/g, "U").replace(/t/g, "u");
/** mRNA → DNA: U → T. */
export const reverseTranscribe = (seq: string) => seq.replace(/U/g, "T").replace(/u/g, "t");

export type BaseStats = { length: number; counts: Record<string, number>; gc: number; at: number; gcPercent: number | null; ambiguous: number };

/** GC content counts G, C and S (G or C); A, T, U and W count as AT. Other codes and gaps are excluded from the percentage. */
export function baseStats(seq: string): BaseStats {
  const counts: Record<string, number> = {};
  let gc = 0,
    at = 0,
    ambiguous = 0,
    length = 0;
  for (const raw of seq) {
    const ch = raw.toUpperCase();
    if (ch === "-" || ch === ".") continue;
    length++;
    counts[ch] = (counts[ch] ?? 0) + 1;
    if (ch === "G" || ch === "C" || ch === "S") gc++;
    else if (ch === "A" || ch === "T" || ch === "U" || ch === "W") at++;
    else ambiguous++;
  }
  return { length, counts, gc, at, ambiguous, gcPercent: gc + at ? (gc / (gc + at)) * 100 : null };
}

/** Wraps a sequence to a fixed line width (0 = no wrapping). */
export function wrap(seq: string, width: number): string {
  if (!width || width <= 0) return seq;
  const out: string[] = [];
  for (let i = 0; i < seq.length; i += width) out.push(seq.slice(i, i + width));
  return out.join("\n");
}
