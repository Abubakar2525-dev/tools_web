"use client";

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
  Segmented,
  SplitGrid,
  StatGrid,
  ToolPanel,
  fmt,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Missing = "normalize" | "zero";
type Component = { id: string; name: string; weight: string; score: string; outOf: string };
type Boundary = { id: string; letter: string; min: string };
type GradeState = {
  components: Component[];
  missing: Missing;
  boundaries: Boundary[];
  finalWeight: string;
  finalTarget: string;
};

const INITIAL_BOUNDARIES: Boundary[] = [
  { id: "b1", letter: "A", min: "90" },
  { id: "b2", letter: "B", min: "80" },
  { id: "b3", letter: "C", min: "70" },
  { id: "b4", letter: "D", min: "60" },
  { id: "b5", letter: "F", min: "0" },
];

const INITIAL: GradeState = {
  components: [
    { id: "g1", name: "", weight: "", score: "", outOf: "" },
    { id: "g2", name: "", weight: "", score: "", outOf: "" },
    { id: "g3", name: "", weight: "", score: "", outOf: "" },
  ],
  missing: "normalize",
  boundaries: INITIAL_BOUNDARIES,
  finalWeight: "",
  finalTarget: "",
};

const EPS = 1e-9;

/* ------------------------------------------------------------------ */
/* Pure logic                                                          */
/* ------------------------------------------------------------------ */

type CompEval =
  | { status: "blank"; errors: string[] }
  | { status: "error"; errors: string[]; field: Set<"weight" | "score" | "outOf"> }
  | { status: "pending"; errors: string[]; weight: number }
  | { status: "done"; errors: string[]; weight: number; pct: number };

function evalComponent(c: Component): CompEval {
  if (!c.name.trim() && !c.weight.trim() && !c.score.trim() && !c.outOf.trim()) return { status: "blank", errors: [] };
  const errors: string[] = [];
  const field = new Set<"weight" | "score" | "outOf">();
  const w = parseNum(c.weight);
  if (c.weight.trim() === "") {
    errors.push("Enter a weight.");
    field.add("weight");
  } else if (w === null) {
    errors.push("Weight must be a number, like 25.");
    field.add("weight");
  } else if (w <= 0) {
    errors.push("Weight must be more than 0%.");
    field.add("weight");
  } else if (w > 100) {
    errors.push("Weight cannot be above 100%.");
    field.add("weight");
  }

  const hasScore = c.score.trim() !== "";
  const s = parseNum(c.score);
  const o = parseNum(c.outOf);
  if (hasScore) {
    if (s === null) {
      errors.push("Score must be a number.");
      field.add("score");
    } else if (s < 0) {
      errors.push("Score cannot be negative.");
      field.add("score");
    }
    if (c.outOf.trim() === "") {
      errors.push("Enter the maximum possible score.");
      field.add("outOf");
    } else if (o === null || o <= 0) {
      errors.push("Out of must be a number above 0.");
      field.add("outOf");
    } else if (s !== null && s > o) {
      errors.push("Score is higher than the maximum.");
      field.add("score");
    }
  } else if (c.outOf.trim() !== "" && (o === null || o <= 0)) {
    errors.push("Out of must be a number above 0.");
    field.add("outOf");
  }

  if (errors.length || w === null) return { status: "error", errors, field };
  if (!hasScore || s === null || o === null) return { status: "pending", errors, weight: w };
  return { status: "done", errors, weight: w, pct: (s / o) * 100 };
}

type BoundaryEval = { letter: string; min: number | null; errors: string[] };

function evalBoundaries(rows: Boundary[]) {
  const seen = new Set<string>();
  let prevMin: number | null = null;
  let prevLetter = "";
  const out: BoundaryEval[] = rows.map((b) => {
    const errors: string[] = [];
    const letter = b.letter.trim();
    if (!letter) errors.push("Enter a letter.");
    else if (seen.has(letter.toUpperCase())) errors.push(`"${letter}" is already used. Letters must be unique.`);
    if (letter) seen.add(letter.toUpperCase());
    const m = parseNum(b.min);
    let min: number | null = null;
    if (b.min.trim() === "") errors.push("Enter a minimum percentage.");
    else if (m === null) errors.push("Minimum must be a number.");
    else if (m < 0 || m > 100) errors.push("Minimum must be between 0 and 100.");
    else if (prevMin !== null && m >= prevMin) errors.push(`Must be lower than ${prevLetter || "the row above"} (${fmt(prevMin, 2)}%).`);
    else min = m;
    if (m !== null && m >= 0 && m <= 100) {
      prevMin = m;
      prevLetter = letter;
    }
    return { letter, min, errors };
  });
  const valid = out.every((b) => b.errors.length === 0);
  return { rows: out, valid };
}

function letterFor(pct: number, bounds: BoundaryEval[]): string | null {
  for (const b of bounds) if (b.min !== null && pct >= b.min - EPS) return b.letter;
  return null;
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

function Cell({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span aria-hidden="true" className="mb-1 block text-[0.8125rem] font-medium text-ink-2 sm:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

function RowErrors({ id, errors }: { id: string; errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul id={id} className="col-span-full space-y-0.5 text-sm text-danger" aria-live="polite">
      {errors.map((e) => (
        <li key={e} className="flex items-start gap-1.5">
          <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
          {e}
        </li>
      ))}
    </ul>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-sunken px-3 py-2 font-mono text-[0.8125rem] text-ink [overflow-wrap:anywhere]">{children}</p>
  );
}

const rowTone = (bad: boolean) =>
  bad ? "bg-[color-mix(in_oklch,var(--danger)_6%,transparent)] sm:bg-transparent" : "bg-sunken sm:bg-transparent";

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [stored, setState, clear] = usePersistentState<GradeState>("grade-calculator", INITIAL);
  const state: GradeState = {
    ...INITIAL,
    ...stored,
    components: Array.isArray(stored.components) && stored.components.length ? stored.components : INITIAL.components,
    boundaries: Array.isArray(stored.boundaries) && stored.boundaries.length ? stored.boundaries : INITIAL.boundaries,
  };
  const update = (fn: (s: GradeState) => GradeState) => setState((p) => fn({ ...INITIAL, ...p }));

  /* ---------- components ---------- */
  const evals = state.components.map(evalComponent);
  let totalWeight = 0;
  let doneWeight = 0;
  let earned = 0; // weight points: Σ weight × pct / 100
  let doneCount = 0;
  let pendingCount = 0;
  for (const e of evals) {
    if (e.status === "done") {
      totalWeight += e.weight;
      doneWeight += e.weight;
      earned += (e.weight * e.pct) / 100;
      doneCount++;
    } else if (e.status === "pending") {
      totalWeight += e.weight;
      pendingCount++;
    }
  }
  const errorCount = evals.filter((e) => e.status === "error").length;
  const weightsOff = totalWeight > 0 && Math.abs(totalWeight - 100) > 1e-6;
  const current =
    doneWeight <= 0 ? null : state.missing === "normalize" ? (earned / doneWeight) * 100 : (earned / totalWeight) * 100;
  const maxPossible = totalWeight > 0 ? ((earned + (totalWeight - doneWeight)) / totalWeight) * 100 : null;

  /* ---------- boundaries ---------- */
  const bounds = evalBoundaries(state.boundaries);
  const letter = current !== null && bounds.valid ? letterFor(current, bounds.rows) : null;

  /* ---------- final exam ---------- */
  const fwRaw = state.finalWeight;
  const ftRaw = state.finalTarget;
  const fw = parseNum(fwRaw);
  const ft = parseNum(ftRaw);
  const fwError =
    fwRaw.trim() === "" ? null : fw === null ? "Weight must be a number." : fw <= 0 || fw > 100 ? "Enter a weight above 0 and up to 100%." : null;
  const ftError =
    ftRaw.trim() === "" ? null : ft === null ? "Target must be a number." : ft < 0 || ft > 100 ? "Enter a target between 0 and 100%." : null;
  const finalReady = fw !== null && ft !== null && !fwError && !ftError && (current !== null || fw === 100);
  const required = finalReady ? (fw === 100 ? ft! : (ft! - current! * (1 - fw! / 100)) / (fw! / 100)) : null;

  /* ---------- ops ---------- */
  const patchComp = (id: string, p: Partial<Component>) =>
    update((s) => ({ ...s, components: s.components.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const addComp = () =>
    update((s) => ({ ...s, components: [...s.components, { id: uid(), name: "", weight: "", score: "", outOf: "" }] }));
  const removeComp = (id: string) =>
    update((s) => (s.components.length <= 1 ? s : { ...s, components: s.components.filter((c) => c.id !== id) }));
  const patchBound = (id: string, p: Partial<Boundary>) =>
    update((s) => ({ ...s, boundaries: s.boundaries.map((b) => (b.id === id ? { ...b, ...p } : b)) }));
  const addBound = () => update((s) => ({ ...s, boundaries: [...s.boundaries, { id: uid(), letter: "", min: "" }] }));
  const removeBound = (id: string) =>
    update((s) => (s.boundaries.length <= 1 ? s : { ...s, boundaries: s.boundaries.filter((b) => b.id !== id) }));

  const summary =
    current === null
      ? ""
      : [
          `Current grade: ${fmt(current, 2)}%${letter ? ` (${letter})` : ""}`,
          `Method: ${state.missing === "normalize" ? "normalized to completed weights" : "missing work counted as 0"}`,
          `Completed weight: ${fmt(doneWeight, 2)}% of ${fmt(totalWeight, 2)}%`,
          ...state.components.flatMap((c, i) => {
            const e = evals[i];
            const name = c.name.trim() || `Component ${i + 1}`;
            if (e.status === "done") return [`- ${name}: ${fmt(e.pct, 2)}% (weight ${fmt(e.weight, 2)}%)`];
            if (e.status === "pending") return [`- ${name}: not graded yet (weight ${fmt(e.weight, 2)}%)`];
            return [];
          }),
          ...(required !== null ? [`Needed on final (${fmt(fw!, 2)}% weight) for ${fmt(ft!, 2)}%: ${fmt(required, 2)}%`] : []),
        ].join("\n");

  const compCols = "sm:grid-cols-[minmax(0,1fr)_5rem_5.5rem_5.5rem_2.5rem]";

  return (
    <div className="space-y-5">
      <SplitGrid>
        <ToolPanel title="Graded components" actions={<ResetBtn onClick={clear} />}>
          <div className="space-y-4">
            <p className="text-sm text-ink-2">
              List each assignment, quiz or exam with its weight from your syllabus. Leave the score empty for work that
              is not graded yet.
            </p>
            <div aria-hidden="true" className={`hidden gap-2 text-[0.8125rem] font-medium text-ink-2 sm:grid ${compCols}`}>
              <span>Component</span>
              <span>Weight %</span>
              <span>Score</span>
              <span>Out of</span>
              <span />
            </div>
            <ol className="space-y-3 sm:space-y-2">
              {state.components.map((c, i) => {
                const n = i + 1;
                const e = evals[i];
                const errId = `grade-err-${c.id}`;
                const bad = e.status === "error";
                const has = (f: "weight" | "score" | "outOf") => e.status === "error" && e.field.has(f);
                return (
                  <li
                    key={c.id}
                    className={`grid grid-cols-3 items-end gap-x-3 gap-y-2 rounded-xl p-3 sm:items-center sm:gap-x-2 sm:rounded-none sm:p-0 ${compCols} ${rowTone(bad)}`}
                  >
                    <Cell label={`Component ${n} name`} className="col-span-2 sm:col-span-1">
                      <CellInput
                        label={`Component ${n} name`}
                        placeholder={`e.g. Midterm`}
                        autoComplete="off"
                        value={c.name}
                        onChange={(ev) => patchComp(c.id, { name: ev.target.value })}
                      />
                    </Cell>
                    <div className="flex justify-end sm:order-last">
                      <Btn
                        variant="subtle"
                        icon="trash"
                        className="w-10 !px-0"
                        aria-label={`Remove component ${n}`}
                        disabled={state.components.length <= 1}
                        onClick={() => removeComp(c.id)}
                      />
                    </div>
                    <Cell label="Weight %">
                      <CellInput
                        label={`Component ${n} weight percent`}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="20"
                        value={c.weight}
                        invalid={has("weight")}
                        aria-describedby={bad ? errId : undefined}
                        onChange={(ev) => patchComp(c.id, { weight: ev.target.value })}
                      />
                    </Cell>
                    <Cell label="Score">
                      <CellInput
                        label={`Component ${n} score obtained`}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="Not yet"
                        value={c.score}
                        invalid={has("score")}
                        aria-describedby={bad ? errId : undefined}
                        onChange={(ev) => patchComp(c.id, { score: ev.target.value })}
                      />
                    </Cell>
                    <Cell label="Out of">
                      <CellInput
                        label={`Component ${n} out of`}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="100"
                        value={c.outOf}
                        invalid={has("outOf")}
                        aria-describedby={bad ? errId : undefined}
                        onChange={(ev) => patchComp(c.id, { outOf: ev.target.value })}
                      />
                    </Cell>
                    <RowErrors id={errId} errors={e.errors} />
                  </li>
                );
              })}
            </ol>
            <Btn variant="ghost" icon="plus" onClick={addComp}>
              Add component
            </Btn>

            <div className="space-y-2 pt-1">
              <p className="text-sm font-medium text-ink">Ungraded work</p>
              <Segmented<Missing>
                label="How to treat ungraded work"
                value={state.missing}
                onChange={(v) => update((s) => ({ ...s, missing: v }))}
                options={[
                  { value: "normalize", label: "Normalize to completed" },
                  { value: "zero", label: "Treat missing as 0" },
                ]}
              />
              <p className="text-[0.8125rem] text-muted">
                {state.missing === "normalize"
                  ? "Shows how you are doing on the work graded so far. Best for a mid-term check."
                  : "Counts ungraded work as zero. Shows the grade you would get if nothing else were submitted."}
              </p>
            </div>
          </div>
        </ToolPanel>

        <ToolPanel title="Current grade" actions={<CopyBtn text={summary} label="Copy summary" />}>
          <div className="space-y-4">
            {errorCount > 0 && (
              <Notice tone="warning" title={`${errorCount} ${errorCount === 1 ? "row needs" : "rows need"} fixing`}>
                Rows with problems are left out until fixed.
              </Notice>
            )}
            {weightsOff && (
              <Notice tone="warning" title={`Weights add up to ${fmt(totalWeight, 2)}%, not 100%`}>
                {totalWeight < 100
                  ? "Some components may be missing. The result is scaled to the weights you entered."
                  : "Check your syllabus. The result is scaled to the weights you entered, so extra weight dilutes every score."}
              </Notice>
            )}
            {current === null ? (
              <EmptyState icon="grade" title="No grade yet">
                Enter a weight, score and maximum for at least one component.
              </EmptyState>
            ) : (
              <>
                <ResultCard
                  label="Weighted percentage"
                  value={`${fmt(current, 2)}%`}
                  detail={
                    bounds.valid
                      ? letter
                        ? `Letter grade ${letter} on your boundaries.`
                        : "Below your lowest boundary."
                      : "Fix the grade boundaries to see a letter grade."
                  }
                />
                <StatGrid
                  items={[
                    { label: "Letter grade", value: letter ?? "n/a" },
                    { label: "Weight graded", value: `${fmt(doneWeight, 2)}%` },
                    {
                      label: "Max possible",
                      value: maxPossible !== null && pendingCount > 0 ? `${fmt(maxPossible, 2)}%` : `${fmt(current, 2)}%`,
                    },
                  ]}
                />
                <div className="space-y-2">
                  <h3 className="font-sans text-[0.9375rem] font-semibold tracking-normal">How it was calculated</h3>
                  {state.missing === "normalize" ? (
                    <Formula>
                      grade = Σ(weight × score%) ÷ Σ graded weights = {fmt(earned * 100, 3)} ÷ {fmt(doneWeight, 3)} ={" "}
                      {fmt(current, 3)}%
                    </Formula>
                  ) : (
                    <Formula>
                      grade = Σ(weight × score%) ÷ Σ all weights = {fmt(earned * 100, 3)} ÷ {fmt(totalWeight, 3)} = {fmt(current, 3)}%
                    </Formula>
                  )}
                  <p className="text-[0.8125rem] text-muted">
                    {doneCount} graded, {pendingCount} not graded yet. The letter is picked from the unrounded percentage,
                    so 89.99% is not rounded up to an A. &quot;Max possible&quot; assumes 100% on everything left.
                  </p>
                </div>
              </>
            )}
          </div>
        </ToolPanel>
      </SplitGrid>

      <SplitGrid>
        <ToolPanel title="What do I need on the final?">
          <div className="space-y-4">
            <p className="text-sm text-ink-2">
              Uses your current grade above as the grade for everything except the final. Do not list the final in the
              components table.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Final exam weight %"
                placeholder="e.g. 30"
                value={state.finalWeight}
                error={fwError}
                onChange={(e) => update((s) => ({ ...s, finalWeight: e.target.value }))}
              />
              <NumberField
                label="Target overall grade %"
                placeholder="e.g. 80"
                value={state.finalTarget}
                error={ftError}
                onChange={(e) => update((s) => ({ ...s, finalTarget: e.target.value }))}
              />
            </div>
            {required === null ? (
              <p className="text-sm text-muted" aria-live="polite">
                {current === null && fw !== 100
                  ? "Enter at least one graded component above, then the final weight and your target."
                  : "Enter the final exam weight and your target grade."}
              </p>
            ) : required > 100 + EPS ? (
              <Notice tone="error" title="Not reachable with this final">
                You would need {fmt(required, 2)}% on the final, which is more than 100%. With a perfect final your grade
                would be {fmt(fw === 100 ? 100 : current! * (1 - fw! / 100) + fw!, 2)}%.
              </Notice>
            ) : required <= EPS ? (
              <Notice tone="success" title="Already secured">
                You reach {fmt(ft!, 2)}% even with 0% on the final, assuming your current grade holds.
              </Notice>
            ) : (
              <ResultCard
                label="Score needed on the final"
                value={`${fmt(required, 2)}%`}
                detail={
                  <>
                    needed = (target − current × (1 − final weight)) ÷ final weight = ({fmt(ft!, 2)} − {fmt(current ?? 0, 2)} ×{" "}
                    {fmt(1 - fw! / 100, 4)}) ÷ {fmt(fw! / 100, 4)}
                  </>
                }
              />
            )}
          </div>
        </ToolPanel>

        <ToolPanel
          title="Grade boundaries"
          actions={
            <>
              <Btn variant="subtle" onClick={() => update((s) => ({ ...s, boundaries: INITIAL_BOUNDARIES }))}>
                Default boundaries
              </Btn>
              <Btn variant="ghost" icon="plus" onClick={addBound}>
                Add
              </Btn>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              List grades from highest to lowest with the minimum percentage for each. Use 0 for the lowest grade.
            </p>
            {!bounds.valid && (
              <Notice tone="warning">Fix the highlighted rows. Minimums must go down from top to bottom.</Notice>
            )}
            <div aria-hidden="true" className="hidden gap-2 text-[0.8125rem] font-medium text-ink-2 sm:grid sm:grid-cols-[6rem_7rem_2.5rem]">
              <span>Letter</span>
              <span>Minimum %</span>
              <span />
            </div>
            <ol className="space-y-3 sm:space-y-2">
              {state.boundaries.map((b, i) => {
                const n = i + 1;
                const ev = bounds.rows[i];
                const errId = `bound-err-${b.id}`;
                const bad = ev.errors.length > 0;
                return (
                  <li
                    key={b.id}
                    className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-end gap-x-3 gap-y-2 rounded-xl p-3 sm:grid-cols-[6rem_7rem_2.5rem] sm:gap-x-2 sm:rounded-none sm:p-0 ${rowTone(bad)}`}
                  >
                    <Cell label="Letter">
                      <CellInput
                        label={`Boundary ${n} letter`}
                        value={b.letter}
                        maxLength={6}
                        autoComplete="off"
                        invalid={ev.errors.some((m) => m.includes("etter") || m.includes("used"))}
                        aria-describedby={bad ? errId : undefined}
                        onChange={(e) => patchBound(b.id, { letter: e.target.value })}
                      />
                    </Cell>
                    <Cell label="Minimum %">
                      <CellInput
                        label={`Boundary ${n} minimum percent`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={b.min}
                        invalid={ev.errors.some((m) => m.includes("inimum") || m.startsWith("Must"))}
                        aria-describedby={bad ? errId : undefined}
                        onChange={(e) => patchBound(b.id, { min: e.target.value })}
                      />
                    </Cell>
                    <Btn
                      variant="subtle"
                      icon="trash"
                      className="w-10 !px-0"
                      aria-label={`Remove boundary ${n}${b.letter ? ` (${b.letter})` : ""}`}
                      disabled={state.boundaries.length <= 1}
                      onClick={() => removeBound(b.id)}
                    />
                    <RowErrors id={errId} errors={ev.errors} />
                  </li>
                );
              })}
            </ol>
          </div>
        </ToolPanel>
      </SplitGrid>

      <PrivacyNote stored />
    </div>
  );
}
