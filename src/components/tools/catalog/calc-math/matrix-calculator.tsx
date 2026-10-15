"use client";

import { useMemo, useRef, useState } from "react";
import {
  Btn,
  CellInput,
  CopyBtn,
  Notice,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  SelectField,
  StatGrid,
  TextField,
  ToolPanel,
} from "@/components/tools/kit";
import { num } from "@/components/tools/engines/FormulaTool";
import { Q } from "./lib/rational";
import * as M from "./lib/matrix";

const MAX = 8;
type Cells = string[][];
type Op = "add" | "sub" | "mul" | "mulBA" | "transpose" | "det" | "inverse" | "rank" | "rref" | "trace" | "power" | "scale";

const OPS: { value: Op; label: string; unary: boolean }[] = [
  { value: "det", label: "Determinant", unary: true },
  { value: "inverse", label: "Inverse", unary: true },
  { value: "rref", label: "Row reduce (RREF)", unary: true },
  { value: "rank", label: "Rank", unary: true },
  { value: "transpose", label: "Transpose", unary: true },
  { value: "trace", label: "Trace", unary: true },
  { value: "power", label: "Power (Mⁿ)", unary: true },
  { value: "scale", label: "Multiply by a number", unary: true },
  { value: "add", label: "A + B", unary: false },
  { value: "sub", label: "A − B", unary: false },
  { value: "mul", label: "A × B", unary: false },
  { value: "mulBA", label: "B × A", unary: false },
];

const emptyCells = (): Cells => Array.from({ length: MAX }, () => Array.from({ length: MAX }, () => ""));
const fromRows = (rows: string[][]): Cells => {
  const c = emptyCells();
  rows.forEach((r, i) => r.forEach((v, j) => (c[i][j] = v)));
  return c;
};

type Size = { r: number; c: number };
type Outcome =
  | { kind: "matrix"; m: M.Mat; label: string; ops?: string[]; extra?: { label: string; value: string }[] }
  | { kind: "scalar"; value: string; decimal?: string; label: string; ops?: string[] }
  | { kind: "error"; message: string };

function slice(cells: Cells, s: Size) {
  return cells.slice(0, s.r).map((row) => row.slice(0, s.c));
}

function run(op: Op, which: "A" | "B", a: M.Mat, b: M.Mat, power: string, scalar: string): Outcome {
  const X = which === "A" ? a : b;
  const name = which;
  try {
    switch (op) {
      case "add":
        return { kind: "matrix", m: M.add(a, b), label: "A + B" };
      case "sub":
        return { kind: "matrix", m: M.sub(a, b), label: "A − B" };
      case "mul":
        return { kind: "matrix", m: M.mul(a, b), label: "A × B" };
      case "mulBA":
        return { kind: "matrix", m: M.mul(b, a), label: "B × A" };
      case "transpose":
        return { kind: "matrix", m: M.transpose(X), label: `${name}ᵀ` };
      case "det": {
        if (X.length !== X[0].length) return { kind: "error", message: "The determinant needs a square matrix." };
        const r = M.rref(X);
        const d = r.det;
        return {
          kind: "scalar",
          value: d.toString(),
          decimal: d.isInt() ? undefined : num(d.toNumber(), 12),
          label: `det(${name})`,
          ops: [
            ...r.ops,
            `det = product of pivots${r.swaps ? ` × (−1)^${r.swaps} for row swaps` : ""}${r.rank < X.length ? "; a zero pivot column means det = 0" : ""}`,
          ],
        };
      }
      case "inverse": {
        const r = M.inverse(X);
        return { kind: "matrix", m: r.inverse, label: `${name}⁻¹`, ops: ["Row reduce [M | I] until the left side is I; the right side is then M⁻¹.", ...r.ops] };
      }
      case "rank": {
        const r = M.rref(X);
        return { kind: "scalar", value: String(r.rank), label: `rank(${name})`, ops: [...r.ops, `Pivot columns: ${r.pivots.map((p) => p + 1).join(", ") || "none"}`] };
      }
      case "rref": {
        const r = M.rref(X);
        return { kind: "matrix", m: r.m, label: `RREF(${name})`, ops: r.ops, extra: [{ label: "Rank", value: String(r.rank) }, { label: "Pivot columns", value: r.pivots.map((p) => p + 1).join(", ") || "none" }] };
      }
      case "trace": {
        const t = M.trace(X);
        return { kind: "scalar", value: t.toString(), decimal: t.isInt() ? undefined : num(t.toNumber(), 12), label: `tr(${name})` };
      }
      case "power": {
        const n = Number(power);
        if (!Number.isInteger(n) || Math.abs(n) > 64) return { kind: "error", message: "Enter a whole-number power between −64 and 64." };
        return { kind: "matrix", m: M.power(X, n), label: `${name}^${n}` };
      }
      case "scale": {
        const k = Q.parse(scalar);
        if (!k) return { kind: "error", message: "Enter the number to multiply by (fractions are fine)." };
        return { kind: "matrix", m: M.scale(X, k), label: `${k} × ${name}` };
      }
    }
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Could not compute." };
  }
}

function MatrixInput({
  name,
  cells,
  size,
  onCells,
  onSize,
  invalid,
}: {
  name: string;
  cells: Cells;
  size: Size;
  onCells: (c: Cells) => void;
  onSize: (s: Size) => void;
  invalid: { row: number; col: number } | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const focusCell = (i: number, j: number) => {
    const el = wrap.current?.querySelector<HTMLInputElement>(`input[data-cell="${i}-${j}"]`);
    if (el) {
      el.focus();
      el.select();
    }
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number, j: number) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length;
    if (e.key === "ArrowUp" && i > 0) focusCell(i - 1, j);
    else if ((e.key === "ArrowDown" || e.key === "Enter") && i < size.r - 1) focusCell(i + 1, j);
    else if (e.key === "Enter" && i === size.r - 1 && j < size.c - 1) focusCell(0, j + 1);
    else if (e.key === "ArrowLeft" && atStart && j > 0) focusCell(i, j - 1);
    else if (e.key === "ArrowRight" && atEnd && j < size.c - 1) focusCell(i, j + 1);
    else return;
    e.preventDefault();
  };
  const sizes = Array.from({ length: MAX }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <h3 className="mr-auto font-sans text-base font-semibold">Matrix {name}</h3>
        <SelectField label="Rows" value={String(size.r)} onChange={(e) => onSize({ ...size, r: Number(e.target.value) })} options={sizes} className="w-24" />
        <SelectField label="Columns" value={String(size.c)} onChange={(e) => onSize({ ...size, c: Number(e.target.value) })} options={sizes} className="w-24" />
      </div>
      <div ref={wrap} className="overflow-x-auto pb-1">
        <div className="grid w-max gap-1.5" style={{ gridTemplateColumns: `repeat(${size.c}, minmax(4.25rem, 5.5rem))` }}>
          {Array.from({ length: size.r }, (_, i) =>
            Array.from({ length: size.c }, (_, j) => (
              <CellInput
                key={`${i}-${j}`}
                data-cell={`${i}-${j}`}
                label={`${name} row ${i + 1}, column ${j + 1}`}
                value={cells[i][j]}
                placeholder="0"
                inputMode="text"
                autoComplete="off"
                invalid={invalid?.row === i && invalid?.col === j}
                onKeyDown={(e) => onKey(e, i, j)}
                onChange={(e) => {
                  const next = cells.map((r) => [...r]);
                  next[i][j] = e.target.value;
                  onCells(next);
                }}
                className="text-center tabular-nums"
              />
            )),
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Btn variant="subtle" onClick={() => onCells(emptyCells())}>
          Clear {name}
        </Btn>
        <Btn
          variant="subtle"
          disabled={size.r !== size.c}
          onClick={() => {
            const next = emptyCells();
            for (let k = 0; k < size.r; k++) next[k][k] = "1";
            onCells(next);
          }}
        >
          Identity
        </Btn>
      </div>
    </div>
  );
}

function ResultMatrix({ m, decimal }: { m: M.Mat; decimal: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-sunken p-3" tabIndex={0} aria-label="Result matrix">
      <table className="mx-auto border-separate border-spacing-x-3 border-spacing-y-1 font-mono text-[0.9rem] tabular-nums">
        <tbody>
          {m.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j} className="whitespace-nowrap text-right text-ink">
                  {decimal ? num(v.toNumber(), 8) : v.toString()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Tool() {
  const [cellsA, setA] = useState<Cells>(() => fromRows([["2", "1", "1"], ["1", "3", "2"], ["1", "0", "0"]]));
  const [cellsB, setB] = useState<Cells>(() => fromRows([["1", "0", "2"], ["0", "1", "0"], ["3", "1", "1"]]));
  const [sizeA, setSizeA] = useState<Size>({ r: 3, c: 3 });
  const [sizeB, setSizeB] = useState<Size>({ r: 3, c: 3 });
  const [op, setOp] = useState<Op>("inverse");
  const [which, setWhich] = useState<"A" | "B">("A");
  const [power, setPower] = useState("2");
  const [scalar, setScalar] = useState("2");
  const [decimal, setDecimal] = useState<"frac" | "dec">("frac");

  const pa = useMemo(() => M.parseGrid(slice(cellsA, sizeA)), [cellsA, sizeA]);
  const pb = useMemo(() => M.parseGrid(slice(cellsB, sizeB)), [cellsB, sizeB]);
  const unary = OPS.find((o) => o.value === op)?.unary ?? true;
  const needsB = !unary || which === "B";
  const needsA = !unary || which === "A";

  const outcome: Outcome = useMemo(() => {
    if (needsA && "error" in pa) return { kind: "error", message: `Matrix A, ${pa.error}` };
    if (needsB && "error" in pb) return { kind: "error", message: `Matrix B, ${pb.error}` };
    const a = "m" in pa ? pa.m : [];
    const b = "m" in pb ? pb.m : [];
    return run(op, which, a, b, power, scalar);
  }, [pa, pb, op, which, power, scalar, needsA, needsB]);

  const resultText =
    outcome.kind === "matrix"
      ? outcome.m.map((r) => r.map((v) => (decimal === "dec" ? String(v.toNumber()) : v.toAscii())).join("\t")).join("\n")
      : outcome.kind === "scalar"
        ? outcome.value.replace(/−/g, "-")
        : "";

  const reset = () => {
    setA(fromRows([["2", "1", "1"], ["1", "3", "2"], ["1", "0", "0"]]));
    setB(fromRows([["1", "0", "2"], ["0", "1", "0"], ["3", "1", "1"]]));
    setSizeA({ r: 3, c: 3 });
    setSizeB({ r: 3, c: 3 });
    setOp("inverse");
    setWhich("A");
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Matrices" actions={<ResetBtn onClick={reset} />}>
        <p className="mb-5 text-sm text-ink-2">
          Enter integers, decimals or fractions (3/4). Empty cells count as 0. Use the arrow keys to move between cells; Enter moves down.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <MatrixInput name="A" cells={cellsA} size={sizeA} onCells={setA} onSize={setSizeA} invalid={"error" in pa ? pa : null} />
          <MatrixInput name="B" cells={cellsB} size={sizeB} onCells={setB} onSize={setSizeB} invalid={"error" in pb ? pb : null} />
        </div>
      </ToolPanel>

      <ToolPanel title="Result" actions={resultText ? <CopyBtn text={resultText} label="Copy result" /> : undefined}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Operation" value={op} onChange={(e) => setOp(e.target.value as Op)} options={OPS.map((o) => ({ value: o.value, label: o.label }))} />
          {unary && (
            <SelectField
              label="Apply to"
              value={which}
              onChange={(e) => setWhich(e.target.value as "A" | "B")}
              options={[
                { value: "A", label: "Matrix A" },
                { value: "B", label: "Matrix B" },
              ]}
            />
          )}
          {op === "power" && <TextField label="Power n" value={power} onChange={(e) => setPower(e.target.value)} inputMode="numeric" />}
          {op === "scale" && <TextField label="Multiply by" value={scalar} onChange={(e) => setScalar(e.target.value)} />}
        </div>
        <div className="mt-4">
          <Segmented
            label="Number format"
            value={decimal}
            onChange={setDecimal}
            options={[
              { value: "frac", label: "Exact fractions" },
              { value: "dec", label: "Decimals" },
            ]}
          />
        </div>
        <div className="mt-5 space-y-4" aria-live="polite">
          {outcome.kind === "error" && <Notice tone="error">{outcome.message}</Notice>}
          {outcome.kind === "scalar" && (
            <ResultCard label={outcome.label} value={decimal === "dec" && outcome.decimal ? outcome.decimal : outcome.value} detail={outcome.decimal && decimal === "frac" ? `≈ ${outcome.decimal}` : undefined} />
          )}
          {outcome.kind === "matrix" && (
            <>
              <p className="text-sm font-medium text-ink">
                {outcome.label} ({outcome.m.length} × {outcome.m[0]?.length ?? 0})
              </p>
              <ResultMatrix m={outcome.m} decimal={decimal === "dec"} />
              {outcome.extra && <StatGrid items={outcome.extra} />}
            </>
          )}
          {outcome.kind !== "error" && "ops" in outcome && outcome.ops && outcome.ops.length > 0 && (
            <details className="rounded-xl bg-sunken p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">Show the row operations ({outcome.ops.length})</summary>
              <ol className="mt-3 list-decimal space-y-1 pl-5 font-mono text-[0.8125rem] text-ink-2">
                {outcome.ops.slice(0, 200).map((s, i) => (
                  <li key={i} className="break-words">
                    {s}
                  </li>
                ))}
              </ol>
            </details>
          )}
          <p className="text-[0.8125rem] text-muted">All arithmetic uses exact fractions, so there is no rounding error. Matrices up to 8 × 8.</p>
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}
