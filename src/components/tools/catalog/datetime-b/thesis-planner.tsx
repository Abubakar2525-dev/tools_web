"use client";

import { Btn, CellInput, EmptyState, Notice, NumberField, PrivacyNote, StatGrid, TextField, ToolPanel, fmt, parseNum, uid, usePersistentState } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { backSchedule, diffDays, isDayKey, splitWords } from "./lib/dates";
import { normalizeThesis, thesisInitial, type Chapter, type Milestone, type ThesisState } from "./lib/schema";
import { BackupBar, PrintArea, PrintBox, SubHead, fmtDay, useToday } from "./shared";

const iconBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-35";

type Status = { label: string; tone: "done" | "now" | "late" | "later" };

function statusOf(m: Milestone, start: string, due: string, today: string): Status {
  if (m.done) return { label: "Done", tone: "done" };
  if (today > due) return { label: `Overdue by ${diffDays(due, today)} d`, tone: "late" };
  if (today >= start) return { label: `In progress, ${diffDays(today, due)} d left`, tone: "now" };
  return { label: `Starts in ${diffDays(today, start)} d`, tone: "later" };
}

const TONE_CLS: Record<Status["tone"], string> = {
  done: "text-accent-strong",
  now: "font-medium text-ink",
  late: "font-medium text-danger",
  later: "text-muted",
};

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function Tool() {
  const [state, setState, clear] = usePersistentState<ThesisState>("thesis-planner", thesisInitial);
  const today = useToday() ?? "";
  const { milestones, chapters, submission } = state;

  const sched = isDayKey(submission) ? backSchedule(submission, state.bufferDays, milestones.map((m) => m.days)) : [];
  const planStart = sched[0]?.start;
  const lateStart = today && planStart && planStart < today && !milestones[0]?.done ? diffDays(planStart, today) : 0;
  const totalDays = milestones.reduce((a, m) => a + m.days, 0);
  const daysLeft = today && isDayKey(submission) ? diffDays(today, submission) : null;

  const pctSum = chapters.reduce((a, c) => a + c.percent, 0);
  const targets = splitWords(state.totalWords, chapters.map((c) => c.percent));
  const written = chapters.reduce((a, c) => a + c.written, 0);
  const msDone = milestones.filter((m) => m.done).length;

  const setMs = (fn: (m: Milestone[]) => Milestone[]) => setState((s) => ({ ...s, milestones: fn(s.milestones) }));
  const patchMs = (id: string, p: Partial<Milestone>) => setMs((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const setCh = (fn: (c: Chapter[]) => Chapter[]) => setState((s) => ({ ...s, chapters: fn(s.chapters) }));
  const patchCh = (id: string, p: Partial<Chapter>) => setCh((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const intIn = (raw: string, min: number, max: number) => {
    const n = parseNum(raw);
    return n !== null && Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Thesis plan">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Thesis title" optional value={state.title} maxLength={200} onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))} />
          <TextField
            label="Submission date"
            type="date"
            value={submission}
            onChange={(e) => setState((s) => ({ ...s, submission: isDayKey(e.target.value) ? e.target.value : "" }))}
          />
          <NumberField
            label="Buffer before submission (days)"
            hint="Slack kept free after the last milestone."
            defaultValue={String(state.bufferDays)}
            key={`buf-${state.bufferDays}`}
            onBlur={(e) => {
              const n = intIn(e.target.value, 0, 365);
              if (n !== null) setState((s) => ({ ...s, bufferDays: n }));
            }}
          />
        </div>

        {sched.length > 0 && (
          <div className="mt-5">
            <StatGrid
              items={[
                { label: "Days until submission", value: daysLeft === null ? "-" : daysLeft < 0 ? `${-daysLeft} days ago` : daysLeft },
                { label: "Plan starts", value: fmtDay(planStart!, { month: "short", day: "numeric", year: "numeric" }) },
                { label: "Milestones done", value: `${msDone} of ${milestones.length}` },
              ]}
            />
          </div>
        )}
        {lateStart > 0 && (
          <div className="mt-4">
            <Notice tone="warning" title="The schedule doesn't fit">
              Working back from submission, the first milestone should have started {lateStart} day{lateStart === 1 ? "" : "s"} ago. Shorten some
              durations or the buffer, or mark finished milestones as done.
            </Notice>
          </div>
        )}

        <div className="mt-6">
          <SubHead>Milestones (in order)</SubHead>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Each milestone runs right after the previous one. Total {totalDays} days plus a {state.bufferDays}-day buffer.
          </p>
          {milestones.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon="list" title="No milestones">
                Add the stages of your project below.
              </EmptyState>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" role="region" aria-label="Milestones" tabIndex={0}>
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="bg-sunken text-left">
                  <tr>
                    <th scope="col" className="w-12 px-2 py-2 font-medium text-ink">
                      Done
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium text-ink">
                      Milestone
                    </th>
                    <th scope="col" className="w-24 px-2 py-2 font-medium text-ink">
                      Days
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium text-ink">
                      Dates
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium text-ink">
                      Status
                    </th>
                    <th scope="col" className="px-2 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m, i) => {
                    const s = sched[i];
                    const st = s && today ? statusOf(m, s.start, s.due, today) : null;
                    return (
                      <tr key={m.id} className={`border-t border-line ${st?.tone === "now" ? "bg-accent-soft" : ""}`}>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${m.name || `Milestone ${i + 1}`} done`}
                            checked={m.done}
                            onChange={() => patchMs(m.id, { done: !m.done })}
                            className="h-[18px] w-[18px] accent-[var(--accent)]"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <CellInput label={`Milestone ${i + 1} name`} value={m.name} maxLength={160} onChange={(e) => patchMs(m.id, { name: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <CellInput
                            label={`${m.name || `Milestone ${i + 1}`} duration in days`}
                            inputMode="numeric"
                            defaultValue={String(m.days)}
                            key={`d-${m.id}-${m.days}`}
                            onBlur={(e) => {
                              const n = intIn(e.target.value, 1, 730);
                              if (n !== null) patchMs(m.id, { days: n });
                              else e.target.value = String(m.days);
                            }}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-ink-2">
                          {s ? `${fmtDay(s.start, { month: "short", day: "numeric" })} to ${fmtDay(s.due, { month: "short", day: "numeric", year: "numeric" })}` : "Set a submission date"}
                        </td>
                        <td className={`px-2 py-1.5 ${st ? TONE_CLS[st.tone] : "text-muted"}`}>{st?.label ?? "-"}</td>
                        <td className="whitespace-nowrap px-1 py-1.5">
                          <span className="flex">
                            <button type="button" className={iconBtn} aria-label={`Move ${m.name} earlier`} disabled={i === 0} onClick={() => setMs((ms) => move(ms, i, -1))}>
                              <Icon name="chevron" size={16} className="rotate-180" />
                            </button>
                            <button
                              type="button"
                              className={iconBtn}
                              aria-label={`Move ${m.name} later`}
                              disabled={i === milestones.length - 1}
                              onClick={() => setMs((ms) => move(ms, i, 1))}
                            >
                              <Icon name="chevron" size={16} />
                            </button>
                            <button
                              type="button"
                              className={`${iconBtn} hover:!text-danger`}
                              aria-label={`Delete ${m.name}`}
                              onClick={() => setMs((ms) => ms.filter((x) => x.id !== m.id))}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Btn variant="ghost" icon="plus" className="mt-3" onClick={() => setMs((ms) => [...ms, { id: uid(), name: "New milestone", days: 14, done: false }])}>
            Add milestone
          </Btn>
        </div>
      </ToolPanel>

      <ToolPanel title="Word count by chapter">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Total word target"
            defaultValue={String(state.totalWords)}
            key={`tw-${state.totalWords}`}
            onBlur={(e) => {
              const n = intIn(e.target.value, 0, 1_000_000);
              if (n !== null) setState((s) => ({ ...s, totalWords: n }));
            }}
          />
          <div className="self-end">
            <StatGrid
              items={[
                { label: "Written", value: written.toLocaleString("en-US") },
                { label: "Progress", value: state.totalWords ? `${fmt((written / state.totalWords) * 100, 0)}%` : "-" },
              ]}
            />
          </div>
        </div>
        <p className={`mt-3 text-sm ${Math.abs(pctSum - 100) > 1e-9 ? "font-medium text-danger" : "text-ink-2"}`} role="status">
          Shares add up to {fmt(pctSum, 2)}%{Math.abs(pctSum - 100) > 1e-9 ? `. Adjust them to total 100% (${pctSum > 100 ? "over" : "under"} by ${fmt(Math.abs(pctSum - 100), 2)}).` : "."}
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" role="region" aria-label="Chapters" tabIndex={0}>
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead className="bg-sunken text-left">
              <tr>
                <th scope="col" className="px-2 py-2 font-medium text-ink">Chapter</th>
                <th scope="col" className="w-24 px-2 py-2 font-medium text-ink">Share %</th>
                <th scope="col" className="w-24 px-2 py-2 text-right font-medium text-ink">Target</th>
                <th scope="col" className="w-28 px-2 py-2 font-medium text-ink">Written</th>
                <th scope="col" className="w-40 px-2 py-2 font-medium text-ink">Progress</th>
                <th scope="col" className="w-12 px-2 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((c, i) => {
                const target = targets[i] ?? 0;
                const pct = target ? Math.min(100, (c.written / target) * 100) : 0;
                return (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-2 py-1.5">
                      <CellInput label={`Chapter ${i + 1} name`} value={c.name} maxLength={160} onChange={(e) => patchCh(c.id, { name: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        label={`${c.name} share in percent`}
                        inputMode="decimal"
                        defaultValue={String(c.percent)}
                        key={`p-${c.id}-${c.percent}`}
                        onBlur={(e) => {
                          const n = parseNum(e.target.value);
                          if (n !== null && n >= 0 && n <= 100) patchCh(c.id, { percent: n });
                          else e.target.value = String(c.percent);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-ink">{target.toLocaleString("en-US")}</td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        label={`${c.name} words written`}
                        inputMode="numeric"
                        defaultValue={String(c.written)}
                        key={`w-${c.id}-${c.written}`}
                        onBlur={(e) => {
                          const n = intIn(e.target.value, 0, 1_000_000);
                          if (n !== null) patchCh(c.id, { written: n });
                          else e.target.value = String(c.written);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 text-right text-[0.8rem] tabular-nums text-ink-2">{fmt(pct, 0)}%</span>
                      </div>
                    </td>
                    <td className="px-1 py-1.5">
                      <button type="button" className={`${iconBtn} hover:!text-danger`} aria-label={`Delete ${c.name}`} onClick={() => setCh((cs) => cs.filter((x) => x.id !== c.id))}>
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Btn variant="ghost" icon="plus" className="mt-3" onClick={() => setCh((cs) => [...cs, { id: uid(), name: "New chapter", percent: 0, written: 0 }])}>
          Add chapter
        </Btn>
        <p className="mt-3 text-[0.8125rem] text-muted">Word counts are entered by you. Paste a chapter into a word counter to get the number.</p>
      </ToolPanel>

      <ToolPanel>
        <div className="space-y-4">
          <BackupBar<ThesisState>
            tool="thesis-planner"
            data={state}
            normalize={normalizeThesis}
            onImport={(v) => setState(v)}
            onClear={clear}
            hasData
            printLabel="Print plan"
          />
          <PrivacyNote stored />
        </div>
      </ToolPanel>

      <PrintArea>
        <h2>{state.title.trim() || "Thesis plan"}</h2>
        <p className="meta">
          {isDayKey(submission) ? `Submission ${fmtDay(submission, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · buffer ${state.bufferDays} days` : "No submission date set"}
        </p>
        <h2>Milestones</h2>
        <table>
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Days</th>
              <th>Start</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((m, i) => (
              <tr key={m.id}>
                <td>
                  <PrintBox checked={m.done} />
                  {m.name}
                </td>
                <td>{m.days}</td>
                <td>{sched[i] ? fmtDay(sched[i].start) : ""}</td>
                <td>{sched[i] ? fmtDay(sched[i].due) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>Chapters ({state.totalWords.toLocaleString("en-US")} words)</h2>
        <table>
          <thead>
            <tr>
              <th>Chapter</th>
              <th>Share</th>
              <th>Target</th>
              <th>Written</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((c, i) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{fmt(c.percent, 2)}%</td>
                <td>{(targets[i] ?? 0).toLocaleString("en-US")}</td>
                <td>{c.written.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintArea>
    </div>
  );
}
