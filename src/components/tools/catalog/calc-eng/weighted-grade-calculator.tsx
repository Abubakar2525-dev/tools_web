"use client";

import { useMemo } from "react";
import {
  Btn,
  CellInput,
  CopyBtn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  SelectField,
  StatGrid,
  ToolPanel,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { num } from "@/components/tools/engines/FormulaTool";
import { SCALE_PRESETS, letterFor } from "./lib/grades";

type Row = { id: string; name: string; weight: string; score: string };
type Saved = { rows: Row[]; scale: string; target: string };

const initial: Saved = {
  rows: [
    { id: "r1", name: "Homework", weight: "20", score: "92" },
    { id: "r2", name: "Quizzes", weight: "15", score: "85" },
    { id: "r3", name: "Midterm", weight: "25", score: "78" },
    { id: "r4", name: "Project", weight: "15", score: "" },
    { id: "r5", name: "Final exam", weight: "25", score: "" },
  ],
  scale: "standard",
  target: "85",
};

export default function Tool() {
  const [data, setData, clear] = usePersistentState<Saved>("weighted-grade-calculator", initial);
  const rows = data.rows;
  const setRows = (fn: (r: Row[]) => Row[]) => setData((d) => ({ ...d, rows: fn(d.rows) }));
  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const calc = useMemo(() => {
    let wDone = 0,
      wAll = 0,
      sum = 0;
    const errors: string[] = [];
    rows.forEach((r, i) => {
      const w = parseNum(r.weight);
      const s = r.score.trim() === "" ? null : parseNum(r.score);
      if (r.weight.trim() === "") return;
      if (w === null || w < 0) {
        errors.push(`Row ${i + 1}: weight must be a non-negative number.`);
        return;
      }
      if (r.score.trim() !== "" && (s === null || s < 0)) {
        errors.push(`Row ${i + 1}: score must be a number of 0 or more.`);
        return;
      }
      wAll += w;
      if (s !== null) {
        wDone += w;
        sum += w * s;
      }
    });
    if (errors.length) return { kind: "error" as const, errors };
    if (wDone === 0) return { kind: "empty" as const };
    const grade = sum / wDone;
    const target = parseNum(data.target);
    const remaining = wAll - wDone;
    let needed: number | null = null;
    if (target !== null && remaining > 0) needed = (target * wAll - sum) / remaining;
    const ifZero = sum / wAll;
    return { kind: "ok" as const, grade, wDone, wAll, remaining, needed, target, ifZero };
  }, [rows, data.target]);

  const scaleRows = SCALE_PRESETS[data.scale]?.rows ?? SCALE_PRESETS.standard.rows;

  const text = calc.kind === "ok"
    ? `Weighted grade: ${num(calc.grade, 4)}% (${letterFor(calc.grade, scaleRows)})\n${rows
        .filter((r) => r.weight.trim())
        .map((r) => `${r.name || "Category"}: weight ${r.weight}%, score ${r.score || "pending"}`)
        .join("\n")}`
    : "";

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <ToolPanel title="Categories" actions={<ResetBtn onClick={clear} />}>
        <div className="hidden grid-cols-[1fr_5.5rem_5.5rem_2.75rem] gap-2 px-1 pb-2 text-[0.8125rem] text-muted sm:grid">
          <span>Category</span>
          <span>Weight %</span>
          <span>Score %</span>
          <span className="sr-only">Remove</span>
        </div>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className="grid grid-cols-[1fr_1fr_2.75rem] gap-2 sm:grid-cols-[1fr_5.5rem_5.5rem_2.75rem]">
              <CellInput label={`Category ${i + 1} name`} value={r.name} placeholder="Category" onChange={(e) => update(r.id, { name: e.target.value })} className="col-span-3 sm:col-span-1" />
              <CellInput label={`Category ${i + 1} weight in percent`} inputMode="decimal" placeholder="Weight" value={r.weight} onChange={(e) => update(r.id, { weight: e.target.value })} />
              <CellInput label={`Category ${i + 1} score in percent`} inputMode="decimal" placeholder="Score" value={r.score} onChange={(e) => update(r.id, { score: e.target.value })} />
              <Btn variant="danger" icon="trash" aria-label={`Remove category ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="!px-0" />
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Btn variant="ghost" icon="plus" onClick={() => setRows((rs) => [...rs, { id: uid(), name: "", weight: "", score: "" }])}>
            Add category
          </Btn>
        </div>
        <p className="mt-4 text-[0.8125rem] text-muted">Leave a score empty for work not graded yet. It then counts toward the target calculation instead of the current grade.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Letter scale"
            value={data.scale}
            onChange={(e) => setData((d) => ({ ...d, scale: e.target.value }))}
            options={Object.entries(SCALE_PRESETS).map(([value, s]) => ({ value, label: s.label }))}
          />
          <NumberField label="Target course grade (%)" optional value={data.target} onChange={(e) => setData((d) => ({ ...d, target: e.target.value }))} />
        </div>
      </ToolPanel>

      <ToolPanel title="Result" actions={text ? <CopyBtn text={text} label="Copy result" /> : undefined}>
        <div className="space-y-5">
          {calc.kind === "error" ? (
            <Notice tone="error">{calc.errors.join(" ")}</Notice>
          ) : calc.kind === "empty" ? (
            <EmptyState icon="grade" title="Add weights and scores">
              The grade appears once at least one category has both.
            </EmptyState>
          ) : (
            <>
              <ResultCard label="Current weighted grade" value={`${num(calc.grade, 4)}%`} detail={`Letter: ${letterFor(calc.grade, scaleRows)}, based on ${num(calc.wDone)}% of the course graded so far.`} />
              <StatGrid
                items={[
                  { label: "Total weight entered", value: `${num(calc.wAll)}%` },
                  { label: "Weight still to come", value: `${num(calc.remaining)}%` },
                  { label: "Guaranteed minimum", value: `${num(calc.ifZero, 4)}%` },
                  ...(calc.needed !== null ? [{ label: `Average needed for ${num(calc.target as number)}%`, value: `${num(calc.needed, 4)}%` }] : []),
                ]}
              />
              {Math.abs(calc.wAll - 100) > 1e-9 && (
                <Notice tone="warning">Weights add up to {num(calc.wAll)}%, not 100%. Results are normalized to the weights you entered.</Notice>
              )}
              {calc.needed !== null &&
                (calc.needed > 100 ? (
                  <Notice tone="warning">Reaching {num(calc.target as number)}% would need more than 100% on the remaining work, so it is out of reach without extra credit.</Notice>
                ) : calc.needed <= 0 ? (
                  <Notice tone="success">You will reach {num(calc.target as number)}% even with zero on the remaining work.</Notice>
                ) : (
                  <Notice>You need an average of {num(calc.needed, 4)}% on the remaining {num(calc.remaining)}% of the course.</Notice>
                ))}
              <p className="text-[0.8125rem] text-muted">Grade = Σ(weight × score) ÷ Σ(weight of graded categories).</p>
            </>
          )}
          <PrivacyNote stored />
        </div>
      </ToolPanel>
    </div>
  );
}
