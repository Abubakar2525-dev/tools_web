"use client";

import { useState } from "react";
import {
  Btn,
  CellInput,
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  StatGrid,
  ToolPanel,
  fmt,
  parseNum,
  uid,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Types and helpers                                                   */
/* ------------------------------------------------------------------ */

type Mode = "marks" | "subjects" | "of" | "change" | "needed";

const MODES: { value: Mode; label: string }[] = [
  { value: "marks", label: "Marks to percentage" },
  { value: "subjects", label: "Multiple subjects" },
  { value: "of", label: "Percent of a number" },
  { value: "change", label: "Percentage change" },
  { value: "needed", label: "Marks needed" },
];

type Num = { value: number | null; error: string | null };

/** Validates a typed number. Empty input returns no value and no error, so untouched fields stay quiet. */
function num(raw: string, opts: { min?: number; positive?: boolean; name: string }): Num {
  if (raw.trim() === "") return { value: null, error: null };
  const n = parseNum(raw);
  if (n === null) return { value: null, error: `${opts.name} must be a number.` };
  if (opts.positive && n <= 0) return { value: null, error: `${opts.name} must be more than 0.` };
  if (opts.min !== undefined && n < opts.min) return { value: null, error: `${opts.name} cannot be negative.` };
  return { value: n, error: null };
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.8125rem] font-medium text-ink-2">Formula used</p>
      <p className="mt-1 rounded-lg bg-sunken px-3 py-2 font-mono text-[0.8125rem] text-ink [overflow-wrap:anywhere]">
        {children}
      </p>
    </div>
  );
}

function Pending({ text }: { text: string }) {
  return (
    <EmptyState icon="percent" title="Waiting for numbers">
      {text}
    </EmptyState>
  );
}

function ModeShell({
  title,
  onReset,
  copyText,
  inputs,
  output,
}: {
  title: string;
  onReset: () => void;
  copyText: string;
  inputs: React.ReactNode;
  output: React.ReactNode;
}) {
  return (
    <ToolPanel
      title={title}
      actions={
        <>
          <CopyBtn text={copyText} label="Copy result" />
          <ResetBtn onClick={onReset} />
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">{inputs}</div>
        <div className="space-y-4">{output}</div>
      </div>
    </ToolPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Mode 1: marks to percentage                                         */
/* ------------------------------------------------------------------ */

function MarksMode() {
  const [obtained, setObtained] = useState("");
  const [total, setTotal] = useState("");
  const [bonus, setBonus] = useState(false);

  const o = num(obtained, { min: 0, name: "Marks obtained" });
  const t = num(total, { positive: true, name: "Total marks" });
  let overError: string | null = null;
  if (o.value !== null && t.value !== null && !bonus && o.value > t.value)
    overError = "Marks obtained are higher than the total. Tick \"Allow bonus marks\" if that is intended.";
  const pct = o.value !== null && t.value !== null && !overError ? (o.value / t.value) * 100 : null;

  return (
    <ModeShell
      title="Marks to percentage"
      onReset={() => {
        setObtained("");
        setTotal("");
        setBonus(false);
      }}
      copyText={pct !== null ? `${fmt(o.value!, 4)} out of ${fmt(t.value!, 4)} = ${fmt(pct, 2)}%` : ""}
      inputs={
        <>
          <NumberField label="Marks obtained" placeholder="e.g. 432" value={obtained} error={o.error ?? overError} onChange={(e) => setObtained(e.target.value)} />
          <NumberField label="Total marks" placeholder="e.g. 500" value={total} error={t.error} onChange={(e) => setTotal(e.target.value)} />
          <Checkbox
            label="Allow bonus marks"
            hint="Lets marks obtained go above the total, for extra credit."
            checked={bonus}
            onChange={setBonus}
          />
        </>
      }
      output={
        pct === null ? (
          <Pending text="Enter marks obtained and total marks." />
        ) : (
          <>
            <ResultCard label="Percentage" value={`${fmt(pct, 2)}%`} detail={`${fmt(o.value!, 4)} out of ${fmt(t.value!, 4)} marks`} />
            {pct > 100 && <Notice tone="info">Above 100% because bonus marks are included.</Notice>}
            <Formula>
              percentage = obtained ÷ total × 100 = {fmt(o.value!, 4)} ÷ {fmt(t.value!, 4)} × 100 = {fmt(pct, 4)}%
            </Formula>
          </>
        )
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Mode 2: multiple subjects                                           */
/* ------------------------------------------------------------------ */

type SubjectRow = { id: string; name: string; obtained: string; total: string };
const newRow = (id = uid()): SubjectRow => ({ id, name: "", obtained: "", total: "" });
const initialRows = (): SubjectRow[] => [newRow("r1"), newRow("r2"), newRow("r3")];

function SubjectsMode() {
  const [rows, setRows] = useState<SubjectRow[]>(initialRows);
  const [bonus, setBonus] = useState(false);

  const evals = rows.map((r) => {
    const blank = !r.name.trim() && !r.obtained.trim() && !r.total.trim();
    if (blank) return { status: "blank" as const, errors: [] as string[], o: 0, t: 0 };
    const errors: string[] = [];
    const o = num(r.obtained, { min: 0, name: "Marks obtained" });
    const t = num(r.total, { positive: true, name: "Total marks" });
    if (r.obtained.trim() === "") errors.push("Enter marks obtained.");
    else if (o.error) errors.push(o.error);
    if (r.total.trim() === "") errors.push("Enter total marks.");
    else if (t.error) errors.push(t.error);
    if (o.value !== null && t.value !== null && !bonus && o.value > t.value) errors.push("Obtained is higher than total.");
    if (errors.length || o.value === null || t.value === null) return { status: "error" as const, errors, o: 0, t: 0 };
    return { status: "ok" as const, errors, o: o.value, t: t.value };
  });

  let sumO = 0;
  let sumT = 0;
  let sumPct = 0;
  let count = 0;
  evals.forEach((e) => {
    if (e.status === "ok") {
      sumO += e.o;
      sumT += e.t;
      sumPct += (e.o / e.t) * 100;
      count++;
    }
  });
  const errorCount = evals.filter((e) => e.status === "error").length;
  const overall = count > 0 && sumT > 0 ? (sumO / sumT) * 100 : null;
  const avgPct = count > 0 ? sumPct / count : null;

  const patch = (id: string, p: Partial<SubjectRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const copyText =
    overall === null
      ? ""
      : [
          `Overall: ${fmt(sumO, 4)} / ${fmt(sumT, 4)} = ${fmt(overall, 2)}%`,
          ...rows.flatMap((r, i) => {
            const e = evals[i];
            return e.status === "ok" ? [`${r.name.trim() || `Subject ${i + 1}`}: ${fmt(e.o, 4)} / ${fmt(e.t, 4)} = ${fmt((e.o / e.t) * 100, 2)}%`] : [];
          }),
        ].join("\n");

  const cols = "sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_5rem_2.5rem]";

  return (
    <ModeShell
      title="Multiple subjects"
      onReset={() => {
        setRows(initialRows());
        setBonus(false);
      }}
      copyText={copyText}
      inputs={
        <>
          <div aria-hidden="true" className={`hidden gap-2 text-[0.8125rem] font-medium text-ink-2 sm:grid ${cols}`}>
            <span>Subject (optional)</span>
            <span>Obtained</span>
            <span>Total</span>
            <span className="text-right">Percent</span>
            <span />
          </div>
          <ol className="space-y-3 sm:space-y-2">
            {rows.map((r, i) => {
              const n = i + 1;
              const e = evals[i];
              const errId = `pct-sub-err-${r.id}`;
              const hasErr = e.status === "error";
              return (
                <li
                  key={r.id}
                  className={`grid grid-cols-2 items-end gap-x-3 gap-y-2 rounded-xl p-3 sm:items-center sm:gap-x-2 sm:rounded-none sm:p-0 ${cols} ${
                    hasErr ? "bg-[color-mix(in_oklch,var(--danger)_6%,transparent)] sm:bg-transparent" : "bg-sunken sm:bg-transparent"
                  }`}
                >
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <span aria-hidden="true" className="mb-1 block text-[0.8125rem] font-medium text-ink-2 sm:hidden">
                      Subject {n} (optional)
                    </span>
                    <CellInput label={`Subject ${n} name`} placeholder={`Subject ${n}`} autoComplete="off" value={r.name} onChange={(ev) => patch(r.id, { name: ev.target.value })} />
                  </div>
                  <div className="min-w-0">
                    <span aria-hidden="true" className="mb-1 block text-[0.8125rem] font-medium text-ink-2 sm:hidden">
                      Obtained
                    </span>
                    <CellInput
                      label={`Subject ${n} marks obtained`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={r.obtained}
                      invalid={hasErr && e.errors.some((m) => m.includes("obtained") || m.startsWith("Obtained"))}
                      aria-describedby={hasErr ? errId : undefined}
                      onChange={(ev) => patch(r.id, { obtained: ev.target.value })}
                    />
                  </div>
                  <div className="min-w-0">
                    <span aria-hidden="true" className="mb-1 block text-[0.8125rem] font-medium text-ink-2 sm:hidden">
                      Total
                    </span>
                    <CellInput
                      label={`Subject ${n} total marks`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={r.total}
                      invalid={hasErr && e.errors.some((m) => m.includes("otal"))}
                      aria-describedby={hasErr ? errId : undefined}
                      onChange={(ev) => patch(r.id, { total: ev.target.value })}
                    />
                  </div>
                  <p className="flex h-10 items-center text-sm tabular-nums text-ink-2 sm:justify-end">
                    <span className="sm:sr-only">Percent:&nbsp;</span>
                    {e.status === "ok" ? `${fmt((e.o / e.t) * 100, 2)}%` : "n/a"}
                  </p>
                  <div className="flex justify-end">
                    <Btn
                      variant="subtle"
                      icon="trash"
                      className="w-10 !px-0"
                      aria-label={`Remove subject ${n}`}
                      disabled={rows.length <= 1}
                      onClick={() => setRows((rs) => (rs.length <= 1 ? rs : rs.filter((x) => x.id !== r.id)))}
                    />
                  </div>
                  {hasErr && (
                    <ul id={errId} className="col-span-full space-y-0.5 text-sm text-danger" aria-live="polite">
                      {e.errors.map((m) => (
                        <li key={m} className="flex items-start gap-1.5">
                          <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            <Btn variant="ghost" icon="plus" onClick={() => setRows((rs) => [...rs, newRow()])}>
              Add subject
            </Btn>
          </div>
          <Checkbox label="Allow bonus marks" hint="Lets a subject's obtained marks go above its total." checked={bonus} onChange={setBonus} />
        </>
      }
      output={
        <>
          {errorCount > 0 && (
            <Notice tone="warning" title={`${errorCount} ${errorCount === 1 ? "subject is" : "subjects are"} left out`}>
              Fix the messages under those rows to include them.
            </Notice>
          )}
          {overall === null ? (
            <Pending text="Enter obtained and total marks for at least one subject." />
          ) : (
            <>
              <ResultCard label="Overall percentage" value={`${fmt(overall, 2)}%`} detail={`${fmt(sumO, 4)} out of ${fmt(sumT, 4)} marks across ${count} ${count === 1 ? "subject" : "subjects"}`} />
              <StatGrid
                items={[
                  { label: "Marks obtained", value: fmt(sumO, 4) },
                  { label: "Total marks", value: fmt(sumT, 4) },
                  { label: "Average of subject %", value: avgPct !== null ? `${fmt(avgPct, 2)}%` : "n/a" },
                ]}
              />
              <Formula>
                overall = Σ obtained ÷ Σ total × 100 = {fmt(sumO, 4)} ÷ {fmt(sumT, 4)} × 100 = {fmt(overall, 4)}%
              </Formula>
              <p className="text-[0.8125rem] text-muted">
                The overall figure weights subjects by their total marks. The average of subject percentages treats every
                subject equally, so the two differ when totals differ. Check which one your school uses.
              </p>
            </>
          )}
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Mode 3: percent of a number                                         */
/* ------------------------------------------------------------------ */

function OfMode() {
  const [pct, setPct] = useState("");
  const [base, setBase] = useState("");
  const p = num(pct, { name: "Percentage" });
  const b = num(base, { name: "Number" });
  const res = p.value !== null && b.value !== null ? (p.value / 100) * b.value : null;

  return (
    <ModeShell
      title="Percent of a number"
      onReset={() => {
        setPct("");
        setBase("");
      }}
      copyText={res !== null ? `${fmt(p.value!, 4)}% of ${fmt(b.value!, 4)} = ${fmt(res, 4)}` : ""}
      inputs={
        <>
          <NumberField label="Percentage (X)" hint="Without the % sign." placeholder="e.g. 15" value={pct} error={p.error} onChange={(e) => setPct(e.target.value)} />
          <NumberField label="Of the number (Y)" placeholder="e.g. 240" value={base} error={b.error} onChange={(e) => setBase(e.target.value)} />
        </>
      }
      output={
        res === null ? (
          <Pending text="Enter a percentage and a number." />
        ) : (
          <>
            <ResultCard label={`${fmt(p.value!, 4)}% of ${fmt(b.value!, 4)}`} value={fmt(res, 4)} />
            <Formula>
              result = X ÷ 100 × Y = {fmt(p.value!, 4)} ÷ 100 × {fmt(b.value!, 4)} = {fmt(res, 6)}
            </Formula>
          </>
        )
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Mode 4: percentage change                                           */
/* ------------------------------------------------------------------ */

function ChangeMode() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const a = num(from, { name: "Starting value" });
  const b = num(to, { name: "New value" });
  const zeroError = a.value === 0 ? "Starting value cannot be 0, because change is measured relative to it." : null;
  const change = a.value !== null && b.value !== null && !zeroError ? ((b.value - a.value) / Math.abs(a.value)) * 100 : null;
  const rounded = change !== null ? Math.round(change * 10000) / 10000 : null;
  const direction = rounded === null ? "" : rounded > 0 ? "Increase" : rounded < 0 ? "Decrease" : "No change";
  const text =
    change === null
      ? ""
      : direction === "No change"
        ? `No change from ${fmt(a.value!, 4)} to ${fmt(b.value!, 4)}`
        : `${direction} of ${fmt(Math.abs(change), 2)}% from ${fmt(a.value!, 4)} to ${fmt(b.value!, 4)}`;

  return (
    <ModeShell
      title="Percentage change"
      onReset={() => {
        setFrom("");
        setTo("");
      }}
      copyText={text}
      inputs={
        <>
          <NumberField label="From (starting value)" placeholder="e.g. 64" value={from} error={a.error ?? zeroError} onChange={(e) => setFrom(e.target.value)} />
          <NumberField label="To (new value)" placeholder="e.g. 80" value={to} error={b.error} onChange={(e) => setTo(e.target.value)} />
        </>
      }
      output={
        change === null ? (
          <Pending text="Enter a starting value and a new value." />
        ) : (
          <>
            <ResultCard
              label={direction}
              value={direction === "No change" ? "0%" : `${change > 0 ? "+" : "−"}${fmt(Math.abs(change), 2)}%`}
              detail={text}
            />
            <StatGrid
              items={[
                { label: "Difference", value: `${b.value! - a.value! >= 0 ? "+" : "−"}${fmt(Math.abs(b.value! - a.value!), 4)}` },
                { label: "Direction", value: direction },
                { label: "New as % of old", value: `${fmt((b.value! / a.value!) * 100, 2)}%` },
              ]}
            />
            <Formula>
              change = (new − old) ÷ |old| × 100 = ({fmt(b.value!, 4)} − {fmt(a.value!, 4)}) ÷ {fmt(Math.abs(a.value!), 4)} × 100 ={" "}
              {fmt(change, 4)}%
            </Formula>
            <p className="text-[0.8125rem] text-muted">
              For a change in marks or grades, this is a relative change. A move from 60% to 75% is a 25% increase, or 15
              percentage points.
            </p>
          </>
        )
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Mode 5: marks needed                                                */
/* ------------------------------------------------------------------ */

function NeededMode() {
  const [target, setTarget] = useState("");
  const [total, setTotal] = useState("");
  const tp = num(target, { min: 0, name: "Target percentage" });
  const tt = num(total, { positive: true, name: "Total marks" });
  const overError = tp.value !== null && tp.value > 100 ? "Target cannot be above 100%." : null;
  const needed = tp.value !== null && tt.value !== null && !overError ? (tp.value / 100) * tt.value : null;
  // Round up so the student is guaranteed to reach the target with whole marks.
  const wholeMarks = needed !== null ? Math.ceil(needed - 1e-9) : null;

  return (
    <ModeShell
      title="Marks needed"
      onReset={() => {
        setTarget("");
        setTotal("");
      }}
      copyText={needed !== null ? `To score ${fmt(tp.value!, 4)}% of ${fmt(tt.value!, 4)} you need ${fmt(needed, 4)} marks (${wholeMarks} in whole marks).` : ""}
      inputs={
        <>
          <NumberField label="Target percentage" hint="Without the % sign." placeholder="e.g. 85" value={target} error={tp.error ?? overError} onChange={(e) => setTarget(e.target.value)} />
          <NumberField label="Total marks" placeholder="e.g. 600" value={total} error={tt.error} onChange={(e) => setTotal(e.target.value)} />
        </>
      }
      output={
        needed === null ? (
          <Pending text="Enter a target percentage and total marks." />
        ) : (
          <>
            <ResultCard
              label="Marks you need"
              value={fmt(needed, 4)}
              detail={
                Number.isInteger(Math.round(needed * 1e6) / 1e6)
                  ? `Out of ${fmt(tt.value!, 4)} to reach ${fmt(tp.value!, 4)}%.`
                  : `At least ${wholeMarks} if marks are whole numbers (rounded up), out of ${fmt(tt.value!, 4)}.`
              }
            />
            <Formula>
              marks = target ÷ 100 × total = {fmt(tp.value!, 4)} ÷ 100 × {fmt(tt.value!, 4)} = {fmt(needed, 6)}
            </Formula>
          </>
        )
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [mode, setMode] = useState<Mode>("marks");
  return (
    <div className="space-y-5">
      <Segmented<Mode> label="Calculator mode" value={mode} onChange={setMode} options={MODES} />
      {/* Each mode keeps its own inputs; switching modes does not clear them. */}
      <div hidden={mode !== "marks"}>
        <MarksMode />
      </div>
      <div hidden={mode !== "subjects"}>
        <SubjectsMode />
      </div>
      <div hidden={mode !== "of"}>
        <OfMode />
      </div>
      <div hidden={mode !== "change"}>
        <ChangeMode />
      </div>
      <div hidden={mode !== "needed"}>
        <NeededMode />
      </div>
      <PrivacyNote />
    </div>
  );
}
