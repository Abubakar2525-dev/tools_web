"use client";

import {
  Btn,
  CellInput,
  CellSelect,
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  SelectField,
  SplitGrid,
  StatGrid,
  ToolPanel,
  fmt,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Types and presets                                                   */
/* ------------------------------------------------------------------ */

type PresetId = "plusminus" | "plain" | "five" | "ten" | "custom";
type ScaleRow = { id: string; label: string; points: string };
type Course = { id: string; name: string; credits: string; grade: string; include: boolean };
type GpaState = { preset: PresetId; custom: ScaleRow[]; courses: Course[] };

const PRESETS: Record<Exclude<PresetId, "custom">, { name: string; grades: [string, number][] }> = {
  plusminus: {
    name: "4.0 scale with +/-",
    grades: [
      ["A", 4],
      ["A-", 3.7],
      ["B+", 3.3],
      ["B", 3],
      ["B-", 2.7],
      ["C+", 2.3],
      ["C", 2],
      ["C-", 1.7],
      ["D+", 1.3],
      ["D", 1],
      ["F", 0],
    ],
  },
  plain: {
    name: "4.0 scale without +/-",
    grades: [
      ["A", 4],
      ["B", 3],
      ["C", 2],
      ["D", 1],
      ["F", 0],
    ],
  },
  five: {
    name: "5.0 scale",
    grades: [
      ["A", 5],
      ["B", 4],
      ["C", 3],
      ["D", 2],
      ["E", 1],
      ["F", 0],
    ],
  },
  ten: {
    name: "10-point scale",
    grades: [
      ["O", 10],
      ["A+", 9],
      ["A", 8],
      ["B+", 7],
      ["B", 6],
      ["C", 5],
      ["P", 4],
      ["F", 0],
    ],
  },
};

const PRESET_OPTIONS: { value: PresetId; label: string }[] = [
  { value: "plusminus", label: "4.0 scale with +/- (A=4.0, A-=3.7 ...)" },
  { value: "plain", label: "4.0 scale without +/- (A=4 ... F=0)" },
  { value: "five", label: "5.0 scale (A=5 ... F=0)" },
  { value: "ten", label: "10-point scale (O=10 ... F=0)" },
  { value: "custom", label: "Custom scale" },
];

const MAX_CREDITS = 30;
const MAX_POINTS = 100;

function presetRows(id: Exclude<PresetId, "custom">, prefix: string): ScaleRow[] {
  return PRESETS[id].grades.map(([label, points], i) => ({ id: `${prefix}${i}`, label, points: String(points) }));
}

const INITIAL: GpaState = {
  preset: "plusminus",
  custom: presetRows("plusminus", "s"),
  courses: [
    { id: "c1", name: "", credits: "", grade: "", include: true },
    { id: "c2", name: "", credits: "", grade: "", include: true },
    { id: "c3", name: "", credits: "", grade: "", include: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Pure logic                                                          */
/* ------------------------------------------------------------------ */

/** Rounds half away from zero at `d` decimals and always shows `d` decimals (3.5 -> "3.50"). */
function fixed(n: number, d: number) {
  const f = 10 ** d;
  return (Math.round((n + Number.EPSILON) * f) / f).toFixed(d);
}

type ResolvedScaleRow = { id: string; label: string; points: number | null; labelError: string | null; pointsError: string | null };

function resolveScale(state: GpaState) {
  const source: ScaleRow[] = state.preset === "custom" ? state.custom : presetRows(state.preset, "p");
  const seen = new Set<string>();
  const rows: ResolvedScaleRow[] = source.map((r) => {
    const label = r.label.trim();
    let labelError: string | null = null;
    if (!label) labelError = "Enter a grade label.";
    else if (seen.has(label.toUpperCase())) labelError = `"${label}" is already on the scale. Labels must be unique.`;
    if (label) seen.add(label.toUpperCase());

    const p = parseNum(r.points);
    let pointsError: string | null = null;
    if (r.points.trim() === "") pointsError = "Enter grade points.";
    else if (p === null) pointsError = "Points must be a number, like 3.7.";
    else if (p < 0) pointsError = "Points cannot be negative.";
    else if (p > MAX_POINTS) pointsError = `Points look too high (max ${MAX_POINTS}).`;
    return { id: r.id, label, points: pointsError ? null : p, labelError, pointsError };
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.labelError && r.points !== null) map.set(r.label, r.points);
  }
  const name = state.preset === "custom" ? "Custom scale" : PRESETS[state.preset].name;
  const invalidCount = rows.filter((r) => r.labelError || r.pointsError).length;
  return { rows, map, name, invalidCount };
}

type CourseEval =
  | { status: "blank" | "excluded"; errors: string[] }
  | { status: "error"; errors: string[] }
  | { status: "ok"; errors: string[]; credits: number; points: number; qp: number };

function evaluateCourse(c: Course, scale: Map<string, number>): CourseEval {
  if (!c.include) return { status: "excluded", errors: [] };
  if (!c.name.trim() && !c.credits.trim() && !c.grade) return { status: "blank", errors: [] };
  const errors: string[] = [];
  const credits = parseNum(c.credits);
  if (c.credits.trim() === "") errors.push("Enter credit hours.");
  else if (credits === null) errors.push("Credit hours must be a number, like 3 or 1.5.");
  else if (credits <= 0) errors.push("Credit hours must be more than 0.");
  else if (credits > MAX_CREDITS) errors.push(`Credit hours look too high (max ${MAX_CREDITS} per course).`);

  const points = c.grade ? scale.get(c.grade) : undefined;
  if (!c.grade) errors.push("Choose a grade.");
  else if (points === undefined) errors.push(`Grade "${c.grade}" is not on the current scale. Choose it again.`);

  if (errors.length || credits === null || points === undefined) return { status: "error", errors };
  return { status: "ok", errors, credits, points, qp: points * credits };
}

/* ------------------------------------------------------------------ */
/* Small layout helpers                                                */
/* ------------------------------------------------------------------ */

/** A table cell that shows its column label above the input on small screens. */
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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [stored, setState, clear] = usePersistentState<GpaState>("gpa", INITIAL);
  const state: GpaState = {
    preset: stored.preset ?? INITIAL.preset,
    custom: Array.isArray(stored.custom) && stored.custom.length ? stored.custom : INITIAL.custom,
    courses: Array.isArray(stored.courses) && stored.courses.length ? stored.courses : INITIAL.courses,
  };

  const scale = resolveScale(state);
  const evals = state.courses.map((c) => evaluateCourse(c, scale.map));

  let totalCredits = 0;
  let totalQp = 0;
  evals.forEach((e) => {
    if (e.status === "ok") {
      totalCredits += e.credits;
      totalQp += e.qp;
    }
  });
  const gpa = totalCredits > 0 ? totalQp / totalCredits : null;
  const errorCount = evals.filter((e) => e.status === "error").length;
  const excludedCount = evals.filter((e) => e.status === "excluded").length;
  const counted = evals.filter((e) => e.status === "ok").length;
  const scaleMax = Math.max(0, ...Array.from(scale.map.values()));

  const gradeOptions = Array.from(scale.map.entries()).map(([label, points]) => ({
    value: label,
    label: `${label} (${fmt(points, 2)})`,
  }));

  /* updates */
  const update = (fn: (s: GpaState) => GpaState) => setState((prev) => fn({ ...INITIAL, ...prev }));
  const patchCourse = (id: string, patch: Partial<Course>) =>
    update((s) => ({ ...s, courses: s.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const addCourse = () =>
    update((s) => ({ ...s, courses: [...s.courses, { id: uid(), name: "", credits: "", grade: "", include: true }] }));
  const removeCourse = (id: string) =>
    update((s) => (s.courses.length <= 1 ? s : { ...s, courses: s.courses.filter((c) => c.id !== id) }));
  const patchScaleRow = (id: string, patch: Partial<ScaleRow>) =>
    update((s) => ({ ...s, custom: s.custom.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const addScaleRow = () => update((s) => ({ ...s, custom: [...s.custom, { id: uid(), label: "", points: "" }] }));
  const removeScaleRow = (id: string) =>
    update((s) => (s.custom.length <= 1 ? s : { ...s, custom: s.custom.filter((r) => r.id !== id) }));
  const customizePreset = () =>
    update((s) => (s.preset === "custom" ? s : { ...s, preset: "custom", custom: presetRows(s.preset, `${uid()}-`) }));

  /* summary */
  const summary = (() => {
    if (gpa === null) return "";
    const lines = [
      `GPA: ${fixed(gpa, 2)} (precise: ${fixed(gpa, 3)})`,
      `Scale: ${scale.name}`,
      `Total credits: ${fmt(totalCredits, 2)}`,
      `Total quality points: ${fmt(totalQp, 2)}`,
      "",
      "Courses:",
    ];
    state.courses.forEach((c, i) => {
      const e = evals[i];
      const name = c.name.trim() || `Course ${i + 1}`;
      if (e.status === "ok")
        lines.push(`- ${name}: ${c.grade} (${fmt(e.points, 2)} pts) x ${fmt(e.credits, 2)} credits = ${fmt(e.qp, 2)} quality points`);
      else if (e.status === "excluded") lines.push(`- ${name}: excluded from GPA`);
      else if (e.status === "error") lines.push(`- ${name}: not counted (needs fixing)`);
    });
    lines.push("", `Formula: GPA = sum(points x credits) / sum(credits) = ${fmt(totalQp, 3)} / ${fmt(totalCredits, 3)}`);
    return lines.join("\n");
  })();

  return (
    <div className="space-y-5">
      <Notice title="Grading systems differ between universities">
        Grade points, plus and minus grades, and which courses count toward GPA vary by school. Pick the closest
        scale below or build your own, and check your student handbook for the official rules.
      </Notice>

      <SplitGrid>
        <ToolPanel
          title="Courses"
          actions={
            <ResetBtn
              onClick={() => {
                clear();
              }}
            />
          }
        >
          <div className="space-y-4">
            <SelectField
              label="Grading scale"
              value={state.preset}
              onChange={(e) => update((s) => ({ ...s, preset: e.target.value as PresetId }))}
              options={PRESET_OPTIONS}
              hint="Grade points per letter. View or edit the table below."
            />

            <div
              aria-hidden="true"
              className="hidden gap-2 text-[0.8125rem] font-medium text-ink-2 sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_7.5rem_5.5rem_2.5rem]"
            >
              <span>Course (optional)</span>
              <span>Credits</span>
              <span>Grade</span>
              <span>Count</span>
              <span />
            </div>

            <ol className="space-y-3 sm:space-y-2">
              {state.courses.map((c, i) => {
                const n = i + 1;
                const e = evals[i];
                const errId = `gpa-err-${c.id}`;
                const hasErr = e.status === "error";
                const creditErr = hasErr && e.errors.some((m) => m.startsWith("Credit") || m.startsWith("Enter credit"));
                const gradeErr = hasErr && e.errors.some((m) => m.includes("grade") || m.startsWith("Grade"));
                const options = [{ value: "", label: "Select" }, ...gradeOptions];
                if (c.grade && !scale.map.has(c.grade)) options.splice(1, 0, { value: c.grade, label: `${c.grade} (not on scale)` });
                return (
                  <li
                    key={c.id}
                    className={`grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl p-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_7.5rem_5.5rem_2.5rem] sm:items-center sm:gap-x-2 sm:rounded-none sm:p-0 ${
                      hasErr ? "bg-[color-mix(in_oklch,var(--danger)_6%,transparent)] sm:bg-transparent" : "bg-sunken sm:bg-transparent"
                    } ${!c.include ? "opacity-70" : ""}`}
                  >
                    <Cell label={`Course ${n} name (optional)`} className="col-span-2 sm:col-span-1">
                      <CellInput
                        label={`Course ${n} name`}
                        placeholder={`Course ${n}`}
                        value={c.name}
                        onChange={(ev) => patchCourse(c.id, { name: ev.target.value })}
                        autoComplete="off"
                      />
                    </Cell>
                    <Cell label="Credits">
                      <CellInput
                        label={`Course ${n} credit hours`}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="3"
                        value={c.credits}
                        invalid={creditErr}
                        aria-describedby={hasErr ? errId : undefined}
                        onChange={(ev) => patchCourse(c.id, { credits: ev.target.value })}
                      />
                    </Cell>
                    <Cell label="Grade">
                      <CellSelect
                        label={`Course ${n} grade`}
                        value={c.grade}
                        options={options}
                        aria-invalid={gradeErr ? true : undefined}
                        aria-describedby={hasErr ? errId : undefined}
                        onChange={(ev) => patchCourse(c.id, { grade: ev.target.value })}
                      />
                    </Cell>
                    <div className="flex h-10 items-center">
                      <Checkbox
                        checked={c.include}
                        onChange={(v) => patchCourse(c.id, { include: v })}
                        label={
                          <>
                            Include<span className="sr-only"> course {n} in GPA</span>
                          </>
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      <Btn
                        variant="subtle"
                        icon="trash"
                        className="w-10 !px-0"
                        aria-label={`Remove course ${n}`}
                        title={state.courses.length <= 1 ? "At least one course is needed" : `Remove course ${n}`}
                        disabled={state.courses.length <= 1}
                        onClick={() => removeCourse(c.id)}
                      />
                    </div>
                    <RowErrors id={errId} errors={hasErr ? e.errors : []} />
                  </li>
                );
              })}
            </ol>

            <Btn variant="ghost" icon="plus" onClick={addCourse}>
              Add course
            </Btn>
          </div>
        </ToolPanel>

        <ToolPanel title="Result" actions={<CopyBtn text={summary} label="Copy summary" />}>
          <div className="space-y-4">
            {errorCount > 0 && (
              <Notice tone="warning" title={`${errorCount} ${errorCount === 1 ? "course needs" : "courses need"} fixing`}>
                Rows with problems are left out of the GPA until they are fixed. Look for the messages under each row.
              </Notice>
            )}
            {scale.invalidCount > 0 && (
              <Notice tone="warning" title="Your custom scale has problems">
                {scale.invalidCount} {scale.invalidCount === 1 ? "grade is" : "grades are"} incomplete or duplicated and
                cannot be selected until fixed.
              </Notice>
            )}

            {gpa === null ? (
              <EmptyState icon="grade" title="No GPA yet">
                Enter credit hours and a grade for at least one included course.
              </EmptyState>
            ) : (
              <>
                <ResultCard
                  label="Your GPA"
                  value={fixed(gpa, 2)}
                  detail={
                    <>
                      Precise value {fixed(gpa, 3)} on a {fmt(scaleMax, 2)}-point maximum. {counted}{" "}
                      {counted === 1 ? "course" : "courses"} counted
                      {excludedCount > 0 ? `, ${excludedCount} excluded` : ""}.
                    </>
                  }
                />
                <StatGrid
                  items={[
                    { label: "Total credits", value: fmt(totalCredits, 2) },
                    { label: "Quality points", value: fmt(totalQp, 2) },
                    { label: "Courses counted", value: counted },
                  ]}
                />

                <div>
                  <h3 className="font-sans text-[0.9375rem] font-semibold tracking-normal">How it was calculated</h3>
                  <p className="mt-1 text-sm text-ink-2">
                    Each grade is converted to points, multiplied by the course credits to get quality points, then the
                    total is divided by total credits.
                  </p>
                  <p className="mt-2 rounded-lg bg-sunken px-3 py-2 font-mono text-[0.8125rem] text-ink [overflow-wrap:anywhere]">
                    GPA = Σ(points × credits) ÷ Σ credits = {fmt(totalQp, 3)} ÷ {fmt(totalCredits, 3)} = {fixed(gpa, 3)}
                  </p>
                  <p className="mt-1 text-[0.8125rem] text-muted">
                    Shown rounded to 2 decimals. Some schools truncate instead of rounding.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[300px] text-left text-sm">
                    <caption className="sr-only">Per-course breakdown</caption>
                    <thead className="text-[0.8125rem] text-muted">
                      <tr>
                        <th scope="col" className="py-1.5 pr-2 font-medium">Course</th>
                        <th scope="col" className="py-1.5 pr-2 font-medium">Grade</th>
                        <th scope="col" className="py-1.5 pr-2 text-right font-medium">Credits</th>
                        <th scope="col" className="py-1.5 text-right font-medium">Quality pts</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {state.courses.map((c, i) => {
                        const e = evals[i];
                        if (e.status === "blank") return null;
                        const name = c.name.trim() || `Course ${i + 1}`;
                        return (
                          <tr key={c.id} className="border-t border-line">
                            <th scope="row" className="max-w-[10rem] truncate py-2 pr-2 font-normal text-ink">
                              {name}
                            </th>
                            {e.status === "ok" ? (
                              <>
                                <td className="py-2 pr-2">
                                  {c.grade} <span className="text-muted">({fmt(e.points, 2)})</span>
                                </td>
                                <td className="py-2 pr-2 text-right">{fmt(e.credits, 2)}</td>
                                <td className="py-2 text-right font-medium">{fmt(e.qp, 2)}</td>
                              </>
                            ) : (
                              <td colSpan={3} className={`py-2 text-right ${e.status === "error" ? "text-danger" : "text-muted"}`}>
                                {e.status === "excluded" ? "Excluded by you" : "Not counted, needs fixing"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </ToolPanel>
      </SplitGrid>

      <ToolPanel
        title={`Grading scale: ${scale.name}`}
        actions={
          state.preset !== "custom" ? (
            <Btn variant="ghost" icon="table" onClick={customizePreset}>
              Edit as custom scale
            </Btn>
          ) : (
            <Btn variant="ghost" icon="plus" onClick={addScaleRow}>
              Add grade
            </Btn>
          )
        }
      >
        {state.preset !== "custom" ? (
          <div>
            <p className="text-sm text-ink-2">
              This preset is read only. Choose &quot;Edit as custom scale&quot; to copy it and change labels or points.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Grade points on this scale">
              {scale.rows.map((r) => (
                <li key={r.id} className="chip tabular-nums">
                  <span className="font-medium text-ink">{r.label}</span> = {fmt(r.points ?? 0, 2)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              Add or remove grades and set their points. Labels must be unique and points must be 0 or more. Courses
              using a removed grade will ask you to choose again.
            </p>
            <div aria-hidden="true" className="hidden gap-2 text-[0.8125rem] font-medium text-ink-2 sm:grid sm:grid-cols-[8rem_8rem_2.5rem]">
              <span>Grade label</span>
              <span>Points</span>
              <span />
            </div>
            <ol className="space-y-3 sm:space-y-2">
              {state.custom.map((r, i) => {
                const n = i + 1;
                const res = scale.rows[i];
                const errs = [res?.labelError, res?.pointsError].filter((x): x is string => Boolean(x));
                const errId = `gpa-scale-err-${r.id}`;
                return (
                  <li
                    key={r.id}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-end gap-x-3 gap-y-2 rounded-xl bg-sunken p-3 sm:grid-cols-[8rem_8rem_2.5rem] sm:gap-x-2 sm:bg-transparent sm:p-0"
                  >
                    <Cell label="Grade label">
                      <CellInput
                        label={`Scale row ${n} grade label`}
                        value={r.label}
                        maxLength={8}
                        autoComplete="off"
                        invalid={Boolean(res?.labelError)}
                        aria-describedby={errs.length ? errId : undefined}
                        onChange={(ev) => patchScaleRow(r.id, { label: ev.target.value })}
                      />
                    </Cell>
                    <Cell label="Points">
                      <CellInput
                        label={`Scale row ${n} points`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={r.points}
                        invalid={Boolean(res?.pointsError)}
                        aria-describedby={errs.length ? errId : undefined}
                        onChange={(ev) => patchScaleRow(r.id, { points: ev.target.value })}
                      />
                    </Cell>
                    <Btn
                      variant="subtle"
                      icon="trash"
                      className="w-10 !px-0"
                      aria-label={`Remove scale row ${n}${r.label ? ` (${r.label})` : ""}`}
                      disabled={state.custom.length <= 1}
                      onClick={() => removeScaleRow(r.id)}
                    />
                    <RowErrors id={errId} errors={errs} />
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </ToolPanel>

      <PrivacyNote stored />
    </div>
  );
}
