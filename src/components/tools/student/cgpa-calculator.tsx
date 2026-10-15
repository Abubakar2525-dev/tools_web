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
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Mode = "semesters" | "previous";
type Method = "weighted" | "simple";
type ScaleChoice = "4" | "5" | "10" | "custom";
type Semester = { id: string; label: string; gpa: string; credits: string };
type PrevInputs = { cgpa: string; credits: string; gpa: string; newCredits: string };
type TargetInputs = { current: string; credits: string; target: string; upcoming: string };
type CgpaState = {
  mode: Mode;
  method: Method;
  scale: ScaleChoice;
  customMax: string;
  semesters: Semester[];
  prev: PrevInputs;
  target: TargetInputs;
};

const INITIAL: CgpaState = {
  mode: "semesters",
  method: "weighted",
  scale: "4",
  customMax: "",
  semesters: [
    { id: "s1", label: "", gpa: "", credits: "" },
    { id: "s2", label: "", gpa: "", credits: "" },
  ],
  prev: { cgpa: "", credits: "", gpa: "", newCredits: "" },
  target: { current: "", credits: "", target: "", upcoming: "" },
};

const MAX_SEM_CREDITS = 60;
const MAX_TOTAL_CREDITS = 1000;
const EPS = 1e-9;

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/** Rounds half away from zero and always shows `d` decimals. */
function fixed(n: number, d: number) {
  const f = 10 ** d;
  return (Math.round((n + Number.EPSILON) * f) / f).toFixed(d);
}

type Check = { value: number | null; error: string | null };

function checkGpa(raw: string, max: number | null, what = "GPA"): Check {
  if (raw.trim() === "") return { value: null, error: `Enter ${what === "GPA" ? "a GPA" : `the ${what}`}.` };
  const n = parseNum(raw);
  if (n === null) return { value: null, error: `${what} must be a number, like 3.45.` };
  if (n < 0) return { value: null, error: `${what} cannot be negative.` };
  if (max !== null && n > max + EPS) return { value: null, error: `${what} cannot be above the scale maximum of ${fmt(max, 2)}.` };
  return { value: n, error: null };
}

function checkCredits(raw: string, limit: number, allowZero = false): Check {
  if (raw.trim() === "") return { value: null, error: "Enter credit hours." };
  const n = parseNum(raw);
  if (n === null) return { value: null, error: "Credits must be a number, like 15 or 17.5." };
  if (n < 0 || (!allowZero && n === 0)) return { value: null, error: allowZero ? "Credits cannot be negative." : "Credits must be more than 0." };
  if (n > limit) return { value: null, error: `Credits look too high (max ${limit}).` };
  return { value: n, error: null };
}

function resolveMax(s: CgpaState): Check {
  if (s.scale !== "custom") return { value: Number(s.scale), error: null };
  if (s.customMax.trim() === "") return { value: null, error: "Enter your scale maximum." };
  const n = parseNum(s.customMax);
  if (n === null) return { value: null, error: "Scale maximum must be a number." };
  if (n <= 0) return { value: null, error: "Scale maximum must be more than 0." };
  if (n > 100) return { value: null, error: "Scale maximum looks too high (max 100)." };
  return { value: n, error: null };
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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [stored, setState, clear] = usePersistentState<CgpaState>("cgpa", INITIAL);
  const state: CgpaState = {
    ...INITIAL,
    ...stored,
    semesters: Array.isArray(stored.semesters) && stored.semesters.length ? stored.semesters : INITIAL.semesters,
    prev: { ...INITIAL.prev, ...stored.prev },
    target: { ...INITIAL.target, ...stored.target },
  };
  const update = (fn: (s: CgpaState) => CgpaState) =>
    setState((p) => fn({ ...INITIAL, ...p, prev: { ...INITIAL.prev, ...p.prev }, target: { ...INITIAL.target, ...p.target } }));

  const maxCheck = resolveMax(state);
  const max = maxCheck.value;

  /* ---------- semesters mode ---------- */
  const semEvals = state.semesters.map((s) => {
    const blank = !s.label.trim() && !s.gpa.trim() && !s.credits.trim();
    if (blank) return { blank: true as const, errors: [] as string[], gpaErr: false, credErr: false, gpa: 0, credits: null as number | null };
    const g = checkGpa(s.gpa, max);
    const creditsOptional = state.method === "simple" && s.credits.trim() === "";
    const c = creditsOptional ? { value: null, error: null } : checkCredits(s.credits, MAX_SEM_CREDITS);
    const errors = [g.error, c.error].filter((x): x is string => Boolean(x));
    return { blank: false as const, errors, gpaErr: Boolean(g.error), credErr: Boolean(c.error), gpa: g.value ?? 0, credits: c.value };
  });
  const validSems = semEvals
    .map((e, i) => ({ e, s: state.semesters[i], i }))
    .filter(({ e }) => !e.blank && e.errors.length === 0);
  const semErrorCount = semEvals.filter((e) => !e.blank && e.errors.length > 0).length;

  let sumQp = 0;
  let sumCred = 0;
  let sumGpa = 0;
  for (const { e } of validSems) {
    sumGpa += e.gpa;
    if (e.credits !== null) {
      sumQp += e.gpa * e.credits;
      sumCred += e.credits;
    }
  }
  const allHaveCredits = validSems.every(({ e }) => e.credits !== null);
  const weighted = validSems.length && allHaveCredits && sumCred > 0 ? sumQp / sumCred : null;
  const simple = validSems.length ? sumGpa / validSems.length : null;
  const semResult = state.method === "weighted" ? weighted : simple;

  /* ---------- previous mode ---------- */
  const pC = checkGpa(state.prev.cgpa, max, "Previous CGPA");
  const pCr = checkCredits(state.prev.credits, MAX_TOTAL_CREDITS, true);
  const nG = checkGpa(state.prev.gpa, max, "New semester GPA");
  const nCr = checkCredits(state.prev.newCredits, MAX_SEM_CREDITS);
  const prevTouched = Object.values(state.prev).some((v) => v.trim() !== "");
  const prevOk = pC.value !== null && pCr.value !== null && nG.value !== null && nCr.value !== null;
  const prevResult = prevOk ? (pC.value! * pCr.value! + nG.value! * nCr.value!) / (pCr.value! + nCr.value!) : null;

  /* ---------- active result ---------- */
  const result = state.mode === "semesters" ? semResult : prevResult;
  const resultCredits =
    state.mode === "semesters" ? (allHaveCredits && sumCred > 0 ? sumCred : null) : prevOk ? pCr.value! + nCr.value! : null;

  /* ---------- target helper ---------- */
  const tCur = checkGpa(state.target.current, max, "Current CGPA");
  const tCr = checkCredits(state.target.credits, MAX_TOTAL_CREDITS, true);
  const tTar = checkGpa(state.target.target, max, "Target CGPA");
  const tUp = checkCredits(state.target.upcoming, MAX_SEM_CREDITS);
  const targetTouched = Object.values(state.target).some((v) => v.trim() !== "");
  const targetOk = tCur.value !== null && tCr.value !== null && tTar.value !== null && tUp.value !== null && max !== null;
  let targetOut: { required: number; bestCase: number } | null = null;
  if (targetOk) {
    const C = tCr.value!;
    const U = tUp.value!;
    const required = (tTar.value! * (C + U) - tCur.value! * C) / U;
    const bestCase = (tCur.value! * C + max! * U) / (C + U);
    targetOut = { required, bestCase };
  }

  /* ---------- semester row ops ---------- */
  const patchSem = (id: string, patch: Partial<Semester>) =>
    update((s) => ({ ...s, semesters: s.semesters.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const addSem = () => update((s) => ({ ...s, semesters: [...s.semesters, { id: uid(), label: "", gpa: "", credits: "" }] }));
  const removeSem = (id: string) =>
    update((s) => (s.semesters.length <= 1 ? s : { ...s, semesters: s.semesters.filter((r) => r.id !== id) }));
  const setPrev = (k: keyof PrevInputs, v: string) => update((s) => ({ ...s, prev: { ...s.prev, [k]: v } }));
  const setTarget = (k: keyof TargetInputs, v: string) => update((s) => ({ ...s, target: { ...s.target, [k]: v } }));

  /* ---------- summary ---------- */
  const methodName = state.mode === "previous" || state.method === "weighted" ? "credit-weighted" : "simple average";
  const summary = (() => {
    if (result === null) return "";
    const lines = [`CGPA: ${fixed(result, 2)} (precise: ${fixed(result, 3)}) on a ${fmt(max ?? 0, 2)} scale`, `Method: ${methodName}`];
    if (resultCredits !== null) lines.push(`Total credits: ${fmt(resultCredits, 2)}`);
    if (state.mode === "semesters") {
      lines.push("", "Semesters:");
      validSems.forEach(({ e, s, i }) => {
        const name = s.label.trim() || `Semester ${i + 1}`;
        lines.push(`- ${name}: GPA ${fmt(e.gpa, 2)}${e.credits !== null ? `, ${fmt(e.credits, 2)} credits` : ""}`);
      });
    } else {
      lines.push(
        "",
        `Previous: CGPA ${fmt(pC.value!, 2)} over ${fmt(pCr.value!, 2)} credits`,
        `New semester: GPA ${fmt(nG.value!, 2)} over ${fmt(nCr.value!, 2)} credits`,
      );
    }
    if (targetOut && tTar.value !== null) {
      lines.push("", `Target CGPA ${fmt(tTar.value, 2)}: required next-semester GPA ${fixed(targetOut.required, 2)}`);
    }
    return lines.join("\n");
  })();

  const gridCols = "sm:grid-cols-[minmax(0,1fr)_6rem_6rem_2.5rem]";

  return (
    <div className="space-y-5">
      <SplitGrid>
        <ToolPanel title="Your semesters" actions={<ResetBtn onClick={clear} />}>
          <div className="space-y-5">
            <Segmented<Mode>
              label="Calculation mode"
              value={state.mode}
              onChange={(v) => update((s) => ({ ...s, mode: v }))}
              options={[
                { value: "semesters", label: "Semester GPAs" },
                { value: "previous", label: "Previous CGPA + new semester" },
              ]}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Grading scale maximum"
                value={state.scale}
                onChange={(e) => update((s) => ({ ...s, scale: e.target.value as ScaleChoice }))}
                options={[
                  { value: "4", label: "4.0" },
                  { value: "5", label: "5.0" },
                  { value: "10", label: "10.0" },
                  { value: "custom", label: "Custom" },
                ]}
                hint="Used to check that every GPA is in range."
              />
              {state.scale === "custom" && (
                <NumberField
                  label="Custom maximum"
                  placeholder="e.g. 4.3"
                  value={state.customMax}
                  error={state.customMax.trim() ? maxCheck.error : null}
                  onChange={(e) => update((s) => ({ ...s, customMax: e.target.value }))}
                />
              )}
            </div>

            {state.mode === "semesters" ? (
              <>
                <Segmented<Method>
                  label="Averaging method"
                  value={state.method}
                  onChange={(v) => update((s) => ({ ...s, method: v }))}
                  options={[
                    { value: "weighted", label: "Credit-weighted" },
                    { value: "simple", label: "Simple average" },
                  ]}
                />
                <p className="-mt-2 text-[0.8125rem] text-muted">
                  {state.method === "weighted"
                    ? "Heavier semesters count more. This is the most common method."
                    : "Every semester counts equally. Credits are optional in this method."}
                </p>

                <div
                  aria-hidden="true"
                  className={`hidden gap-2 text-[0.8125rem] font-medium text-ink-2 sm:grid ${gridCols}`}
                >
                  <span>Semester (optional)</span>
                  <span>GPA</span>
                  <span>Credits</span>
                  <span />
                </div>
                <ol className="-mt-2 space-y-3 sm:space-y-2">
                  {state.semesters.map((s, i) => {
                    const n = i + 1;
                    const e = semEvals[i];
                    const errId = `cgpa-err-${s.id}`;
                    const hasErr = e.errors.length > 0;
                    return (
                      <li
                        key={s.id}
                        className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-end gap-x-3 gap-y-2 rounded-xl p-3 sm:items-center sm:gap-x-2 sm:rounded-none sm:p-0 ${gridCols} ${
                          hasErr ? "bg-[color-mix(in_oklch,var(--danger)_6%,transparent)] sm:bg-transparent" : "bg-sunken sm:bg-transparent"
                        }`}
                      >
                        <Cell label={`Semester ${n} name (optional)`} className="col-span-3 sm:col-span-1">
                          <CellInput
                            label={`Semester ${n} name`}
                            placeholder={`Semester ${n}`}
                            autoComplete="off"
                            value={s.label}
                            onChange={(ev) => patchSem(s.id, { label: ev.target.value })}
                          />
                        </Cell>
                        <Cell label="GPA">
                          <CellInput
                            label={`Semester ${n} GPA`}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="3.5"
                            value={s.gpa}
                            invalid={e.gpaErr}
                            aria-describedby={hasErr ? errId : undefined}
                            onChange={(ev) => patchSem(s.id, { gpa: ev.target.value })}
                          />
                        </Cell>
                        <Cell label={state.method === "simple" ? "Credits (optional)" : "Credits"}>
                          <CellInput
                            label={`Semester ${n} credits`}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="15"
                            value={s.credits}
                            invalid={e.credErr}
                            aria-describedby={hasErr ? errId : undefined}
                            onChange={(ev) => patchSem(s.id, { credits: ev.target.value })}
                          />
                        </Cell>
                        <Btn
                          variant="subtle"
                          icon="trash"
                          className="w-10 !px-0"
                          aria-label={`Remove semester ${n}`}
                          disabled={state.semesters.length <= 1}
                          onClick={() => removeSem(s.id)}
                        />
                        <RowErrors id={errId} errors={e.errors} />
                      </li>
                    );
                  })}
                </ol>
                <Btn variant="ghost" icon="plus" onClick={addSem}>
                  Add semester
                </Btn>
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Previous CGPA"
                  placeholder="3.2"
                  value={state.prev.cgpa}
                  error={state.prev.cgpa.trim() ? pC.error : null}
                  onChange={(e) => setPrev("cgpa", e.target.value)}
                />
                <NumberField
                  label="Credits completed so far"
                  placeholder="60"
                  value={state.prev.credits}
                  error={state.prev.credits.trim() ? pCr.error : null}
                  onChange={(e) => setPrev("credits", e.target.value)}
                />
                <NumberField
                  label="New semester GPA"
                  placeholder="3.8"
                  value={state.prev.gpa}
                  error={state.prev.gpa.trim() ? nG.error : null}
                  onChange={(e) => setPrev("gpa", e.target.value)}
                />
                <NumberField
                  label="New semester credits"
                  placeholder="15"
                  value={state.prev.newCredits}
                  error={state.prev.newCredits.trim() ? nCr.error : null}
                  onChange={(e) => setPrev("newCredits", e.target.value)}
                />
                <p className="text-[0.8125rem] text-muted sm:col-span-2">
                  This mode is always credit-weighted, because a previous CGPA already combines many semesters.
                </p>
              </div>
            )}
          </div>
        </ToolPanel>

        <ToolPanel title="Result" actions={<CopyBtn text={summary} label="Copy summary" />}>
          <div className="space-y-4">
            {maxCheck.error && (
              <Notice tone="warning" title="Set your scale maximum">
                {maxCheck.error}
              </Notice>
            )}
            {state.mode === "semesters" && semErrorCount > 0 && (
              <Notice tone="warning" title={`${semErrorCount} ${semErrorCount === 1 ? "semester needs" : "semesters need"} fixing`}>
                Rows with problems are left out of the result until fixed.
              </Notice>
            )}
            {state.mode === "previous" && prevTouched && !prevOk && !maxCheck.error && (
              <Notice tone="info">Fill in all four fields to see your updated CGPA.</Notice>
            )}

            {result === null ? (
              <EmptyState icon="grade" title="No CGPA yet">
                {state.mode === "semesters"
                  ? state.method === "weighted"
                    ? "Enter a GPA and credits for at least one semester."
                    : "Enter a GPA for at least one semester."
                  : "Enter your previous CGPA, credits so far, and the new semester's GPA and credits."}
              </EmptyState>
            ) : (
              <>
                <ResultCard
                  label={state.mode === "previous" ? "Updated CGPA" : "Your CGPA"}
                  value={fixed(result, 2)}
                  detail={
                    <>
                      Precise value {fixed(result, 3)} out of {fmt(max ?? 0, 2)}, {methodName}.
                    </>
                  }
                />
                {state.mode === "semesters" ? (
                  <StatGrid
                    items={[
                      { label: "Semesters counted", value: validSems.length },
                      { label: "Total credits", value: allHaveCredits && sumCred > 0 ? fmt(sumCred, 2) : "Not given" },
                      {
                        label: state.method === "weighted" ? "Simple average" : "Credit-weighted",
                        value:
                          state.method === "weighted"
                            ? simple !== null
                              ? fixed(simple, 2)
                              : "n/a"
                            : weighted !== null
                              ? fixed(weighted, 2)
                              : "Needs credits",
                      },
                    ]}
                  />
                ) : (
                  <StatGrid
                    items={[
                      { label: "Total credits", value: fmt(pCr.value! + nCr.value!, 2) },
                      { label: "Change", value: `${result - pC.value! >= 0 ? "+" : "−"}${fixed(Math.abs(result - pC.value!), 2)}` },
                      { label: "Direction", value: Math.abs(result - pC.value!) < 0.0005 ? "No change" : result > pC.value! ? "Up" : "Down" },
                    ]}
                  />
                )}

                <div className="space-y-2">
                  <h3 className="font-sans text-[0.9375rem] font-semibold tracking-normal">How it was calculated</h3>
                  {state.mode === "previous" ? (
                    <Formula>
                      CGPA = (prev CGPA × prev credits + new GPA × new credits) ÷ (prev credits + new credits) = ({fmt(pC.value!, 3)} ×{" "}
                      {fmt(pCr.value!, 3)} + {fmt(nG.value!, 3)} × {fmt(nCr.value!, 3)}) ÷ {fmt(pCr.value! + nCr.value!, 3)} ={" "}
                      {fixed(result, 3)}
                    </Formula>
                  ) : state.method === "weighted" ? (
                    <Formula>
                      CGPA = Σ(GPA × credits) ÷ Σ credits = {fmt(sumQp, 3)} ÷ {fmt(sumCred, 3)} = {fixed(result, 3)}
                    </Formula>
                  ) : (
                    <Formula>
                      CGPA = Σ GPA ÷ number of semesters = {fmt(sumGpa, 3)} ÷ {validSems.length} = {fixed(result, 3)}
                    </Formula>
                  )}
                  <p className="text-[0.8125rem] text-muted">Shown rounded to 2 decimals. Some schools truncate instead.</p>
                </div>

                {state.mode === "semesters" && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[280px] text-left text-sm">
                      <caption className="sr-only">Per-semester breakdown</caption>
                      <thead className="text-[0.8125rem] text-muted">
                        <tr>
                          <th scope="col" className="py-1.5 pr-2 font-medium">Semester</th>
                          <th scope="col" className="py-1.5 pr-2 text-right font-medium">GPA</th>
                          <th scope="col" className="py-1.5 pr-2 text-right font-medium">Credits</th>
                          <th scope="col" className="py-1.5 text-right font-medium">GPA × credits</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {validSems.map(({ e, s, i }) => (
                          <tr key={s.id} className="border-t border-line">
                            <th scope="row" className="max-w-[9rem] truncate py-2 pr-2 font-normal text-ink">
                              {s.label.trim() || `Semester ${i + 1}`}
                            </th>
                            <td className="py-2 pr-2 text-right">{fmt(e.gpa, 2)}</td>
                            <td className="py-2 pr-2 text-right">{e.credits !== null ? fmt(e.credits, 2) : "n/a"}</td>
                            <td className="py-2 text-right">{e.credits !== null ? fmt(e.gpa * e.credits, 2) : "n/a"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <Notice title="Your university may calculate CGPA differently">
              Most schools weight each semester by credits, but some use a simple average of semester GPAs, replace
              grades for repeated courses, or leave out pass/fail courses. Check your handbook before relying on a
              number.
            </Notice>
          </div>
        </ToolPanel>
      </SplitGrid>

      <ToolPanel title="Target CGPA helper">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            Find the GPA you need next semester to reach a target CGPA. The math is credit-weighted.
          </p>
          {result !== null && resultCredits !== null && (
            <Btn
              variant="ghost"
              icon="arrow"
              onClick={() =>
                update((s) => ({
                  ...s,
                  target: { ...s.target, current: fixed(result, 3), credits: String(Number(resultCredits.toFixed(3))) },
                }))
              }
            >
              Use my CGPA and credits from above
            </Btn>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField
              label="Current CGPA"
              value={state.target.current}
              error={state.target.current.trim() ? tCur.error : null}
              onChange={(e) => setTarget("current", e.target.value)}
            />
            <NumberField
              label="Credits completed"
              value={state.target.credits}
              error={state.target.credits.trim() ? tCr.error : null}
              onChange={(e) => setTarget("credits", e.target.value)}
            />
            <NumberField
              label="Target CGPA"
              value={state.target.target}
              error={state.target.target.trim() ? tTar.error : null}
              onChange={(e) => setTarget("target", e.target.value)}
            />
            <NumberField
              label="Next semester credits"
              value={state.target.upcoming}
              error={state.target.upcoming.trim() ? tUp.error : null}
              onChange={(e) => setTarget("upcoming", e.target.value)}
            />
          </div>

          {!targetOut ? (
            <p className="text-sm text-muted" aria-live="polite">
              {targetTouched ? "Fill in all four fields with valid numbers to see the required GPA." : "Fill in the four fields above."}
            </p>
          ) : targetOut.required > max! + EPS ? (
            <Notice tone="error" title="Not reachable in one semester">
              You would need a GPA of {fixed(targetOut.required, 2)}, which is above the scale maximum of {fmt(max!, 2)}. Even
              a perfect semester brings you to {fixed(targetOut.bestCase, 2)}. Try a lower target or spread it over more
              credits.
            </Notice>
          ) : targetOut.required <= EPS ? (
            <Notice tone="success" title="Target already secured">
              Your CGPA stays at or above {fmt(tTar.value!, 2)} even with a 0.00 GPA next semester.
            </Notice>
          ) : (
            <ResultCard
              label="GPA needed next semester"
              value={fixed(targetOut.required, 2)}
              detail={
                <>
                  Required = (target × (completed + next) − current × completed) ÷ next = ({fmt(tTar.value!, 3)} ×{" "}
                  {fmt(tCr.value! + tUp.value!, 3)} − {fmt(tCur.value!, 3)} × {fmt(tCr.value!, 3)}) ÷ {fmt(tUp.value!, 3)} ={" "}
                  {fixed(targetOut.required, 3)}. Aim slightly higher if your school rounds down.
                </>
              }
            />
          )}
        </div>
      </ToolPanel>

      <PrivacyNote stored />
    </div>
  );
}
