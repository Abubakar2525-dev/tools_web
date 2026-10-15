"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Btn,
  CopyBtn,
  EmptyState,
  Notice,
  PrivacyNote,
  ResetBtn,
  Segmented,
  ToolPanel,
  downloadFile,
  usePersistentState,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Checklist content                                                   */
/* ------------------------------------------------------------------ */

type Answer = "yes" | "partly" | "no" | "unsure";

const ANSWERS: readonly { value: Answer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partly", label: "Partly" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];

const ANSWER_LABEL: Record<Answer, string> = { yes: "Yes", partly: "Partly", no: "No", unsure: "Not sure" };
const ANSWER_VALUE: Record<Answer, number> = { yes: 1, partly: 0.5, unsure: 0.25, no: 0 };
const GAP_ORDER: Record<Answer, number> = { no: 0, unsure: 1, partly: 2, yes: 3 };

type Item = {
  id: string;
  q: string;
  why: string;
  /** 3 = critical, 2 = important, 1 = helpful */
  weight: 1 | 2 | 3;
  next: string;
};
type SectionDef = { id: string; title: string; items: Item[] };

const SECTIONS: SectionDef[] = [
  {
    id: "sources",
    title: "Sources and content",
    items: [
      {
        id: "src-inventory",
        q: "You know exactly which sources the assistant should answer from.",
        why: "Retrieval can only be as good as the corpus you choose.",
        weight: 3,
        next: "List every candidate source, mark which are in scope for version one and why.",
      },
      {
        id: "src-current",
        q: "The content is current, and outdated documents are removed or marked.",
        why: "Stale pages produce confident, wrong answers.",
        weight: 3,
        next: "Audit the top sources for outdated pages and add an archive or expiry rule.",
      },
      {
        id: "src-formats",
        q: "Documents can be extracted as clean text (tables, PDFs and scans included).",
        why: "Bad parsing silently drops the facts people ask about.",
        weight: 2,
        next: "Run extraction on 20 representative files and inspect the output by hand.",
      },
      {
        id: "src-metadata",
        q: "Documents carry useful metadata such as product, date, region or owner.",
        why: "Metadata enables filtering and fixes many wrong-context answers.",
        weight: 1,
        next: "Define a small metadata schema and backfill it for the in-scope sources.",
      },
    ],
  },
  {
    id: "retrieval",
    title: "Retrieval requirements",
    items: [
      {
        id: "ret-questions",
        q: "You have a list of real questions users ask, with the right answers.",
        why: "Real questions shape chunking, search and evaluation.",
        weight: 3,
        next: "Collect 50 to 100 real questions from tickets, search logs or interviews, with reference answers.",
      },
      {
        id: "ret-citations",
        q: "Answers must cite their sources, and users can open them.",
        why: "Citations make answers verifiable and build trust.",
        weight: 2,
        next: "Decide the citation format and make sure each chunk keeps a link back to its source.",
      },
      {
        id: "ret-unanswerable",
        q: "You've defined what should happen when the answer isn't in the sources.",
        why: "Saying \"I don't know\" beats inventing an answer.",
        weight: 2,
        next: "Write the fallback behavior (decline, escalate, or suggest a contact) and test it.",
      },
      {
        id: "ret-latency",
        q: "There's an agreed target for response time and cost per question.",
        why: "Latency and cost limits rule out some retrieval designs.",
        weight: 1,
        next: "Set target p95 latency and a cost ceiling per answer before choosing models.",
      },
    ],
  },
  {
    id: "security",
    title: "Access and security",
    items: [
      {
        id: "sec-permissions",
        q: "Users must only see content they're allowed to see, and you know how to enforce that.",
        why: "Leaking restricted documents through answers is the most common RAG incident.",
        weight: 3,
        next: "Map source permissions and plan permission-aware filtering at retrieval time.",
      },
      {
        id: "sec-pii",
        q: "Sensitive or personal data in the sources is identified and handled.",
        why: "Anything indexed can end up in an answer.",
        weight: 3,
        next: "Scan sources for personal and confidential data, then exclude, redact or restrict it.",
      },
      {
        id: "sec-vendor",
        q: "Model and vector store vendors are approved for this data.",
        why: "Procurement and legal reviews can block a launch late.",
        weight: 2,
        next: "Start the security review for model, embedding and hosting providers now.",
      },
      {
        id: "sec-injection",
        q: "You've considered prompt injection from content inside documents.",
        why: "Retrieved text can contain instructions that hijack the model.",
        weight: 1,
        next: "Add tests with adversarial documents and keep tools behind least-privilege access.",
      },
    ],
  },
  {
    id: "evaluation",
    title: "Evaluation",
    items: [
      {
        id: "eval-set",
        q: "There's a test set to score answers before launch.",
        why: "Without one, every change is a guess.",
        weight: 3,
        next: "Turn your real questions into a versioned evaluation set with expected answers and sources.",
      },
      {
        id: "eval-metrics",
        q: "You measure retrieval and answer quality separately.",
        why: "It tells you whether to fix search or generation.",
        weight: 2,
        next: "Track retrieval hit rate and answer correctness and faithfulness as separate scores.",
      },
      {
        id: "eval-bar",
        q: "There's an agreed quality bar for going live.",
        why: "A clear bar stops endless tuning and premature launches.",
        weight: 2,
        next: "Agree with stakeholders on minimum scores and unacceptable failure types.",
      },
      {
        id: "eval-feedback",
        q: "Users can flag bad answers, and someone reviews the flags.",
        why: "Production feedback finds failures your test set missed.",
        weight: 1,
        next: "Add thumbs up and down with a reason, and route flags to a weekly review.",
      },
    ],
  },
  {
    id: "operations",
    title: "Operations and deployment",
    items: [
      {
        id: "ops-sync",
        q: "The index updates automatically when sources change.",
        why: "Manual re-indexing drifts out of date within weeks.",
        weight: 3,
        next: "Design incremental sync with deletions handled, and alert on failed runs.",
      },
      {
        id: "ops-monitoring",
        q: "You'll log queries, retrieved chunks and answers for debugging.",
        why: "You can't fix an answer you can't reproduce.",
        weight: 2,
        next: "Plan structured tracing per request, with retention that respects your privacy rules.",
      },
      {
        id: "ops-hosting",
        q: "Hosting, environments and the release process are decided.",
        why: "Infrastructure decisions often hold up the pilot.",
        weight: 1,
        next: "Pick where the pipeline runs and set up separate staging and production indexes.",
      },
      {
        id: "ops-integration",
        q: "You know where users will access the assistant (app, chat tool, intranet).",
        why: "Adoption depends on meeting people where they already work.",
        weight: 1,
        next: "Choose one surface for the pilot and confirm authentication works there.",
      },
    ],
  },
  {
    id: "ownership",
    title: "Ownership",
    items: [
      {
        id: "own-product",
        q: "One person owns the assistant's quality and roadmap.",
        why: "Shared ownership usually means no ownership.",
        weight: 3,
        next: "Name an accountable owner with time set aside for review and prioritization.",
      },
      {
        id: "own-content",
        q: "Each source has an owner who keeps it accurate.",
        why: "Answer quality degrades as content goes unmaintained.",
        weight: 2,
        next: "Assign content owners per source and agree on an update cadence.",
      },
      {
        id: "own-metric",
        q: "There's a business metric the assistant should move.",
        why: "It justifies the investment and guides trade-offs.",
        weight: 2,
        next: "Pick one metric (deflection, handle time, search success) and record the baseline.",
      },
      {
        id: "own-budget",
        q: "Budget covers running costs and ongoing maintenance, not just the build.",
        why: "RAG systems need continuous care after launch.",
        weight: 1,
        next: "Estimate monthly model, hosting and maintenance costs and get them approved.",
      },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items.map((it) => ({ ...it, section: s.title })));
const TOTAL = ALL_ITEMS.length;

type Answers = Record<string, Answer>;

function isAnswer(v: unknown): v is Answer {
  return v === "yes" || v === "partly" || v === "no" || v === "unsure";
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

function score(items: Item[], answers: Answers) {
  let got = 0;
  let max = 0;
  let answered = 0;
  for (const it of items) {
    const a = answers[it.id];
    if (!a) continue;
    answered++;
    got += it.weight * ANSWER_VALUE[a];
    max += it.weight;
  }
  return { pct: max ? Math.round((got / max) * 100) : null, answered };
}

function band(pct: number, criticalNo: boolean) {
  if (pct >= 75 && !criticalNo) return { label: "Ready to prototype", detail: "Foundations look solid. Scope a focused prototype and measure it against your test set." };
  if (pct >= 50 || (pct >= 75 && criticalNo))
    return {
      label: "Prototype with caveats",
      detail: criticalNo
        ? "The score is good, but at least one critical item is a No. Prototype only after a plan for it is in place."
        : "You can prototype, but close the top gaps below before a pilot with real users.",
    };
  return { label: "Fix foundations first", detail: "Building now would likely stall. Work through the top gaps, then reassess." };
}

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

function Bar({ pct, label }: { pct: number | null; label: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true" title={label}>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${pct ?? 0}%` }}
      />
    </div>
  );
}

export default function Tool() {
  const [stored, setStored, clear] = usePersistentState<Answers>("rag-readiness", {});

  const answers = useMemo(() => {
    const clean: Answers = {};
    if (stored && typeof stored === "object") {
      for (const [k, v] of Object.entries(stored)) if (isAnswer(v)) clean[k] = v;
    }
    return clean;
  }, [stored]);

  const setAnswer = (id: string, a: Answer) => setStored((prev) => ({ ...(prev ?? {}), [id]: a }));

  const results = useMemo(() => {
    const sections = SECTIONS.map((s) => ({ id: s.id, title: s.title, total: s.items.length, ...score(s.items, answers) }));
    const overall = score(ALL_ITEMS, answers);
    const criticalNo = ALL_ITEMS.some((it) => it.weight === 3 && answers[it.id] === "no");
    const gaps = ALL_ITEMS.filter((it) => {
      const a = answers[it.id];
      return a && a !== "yes";
    }).sort((x, y) => {
      const ax = answers[x.id] as Answer;
      const ay = answers[y.id] as Answer;
      return GAP_ORDER[ax] - GAP_ORDER[ay] || y.weight - x.weight;
    });
    return { sections, overall, criticalNo, gaps };
  }, [answers]);

  const answered = results.overall.answered;
  const complete = answered === TOTAL;
  const verdict = results.overall.pct !== null ? band(results.overall.pct, results.criticalNo) : null;

  const markdown = useMemo(() => {
    const lines: string[] = ["# RAG readiness self-assessment", ""];
    lines.push(`Answered ${answered} of ${TOTAL} items.`);
    if (results.overall.pct !== null && verdict) {
      lines.push("", `**Overall readiness: ${results.overall.pct}/100 (${verdict.label})**`, "", verdict.detail);
    }
    lines.push("", "## Section scores", "");
    for (const s of results.sections) lines.push(`- ${s.title}: ${s.pct === null ? "not answered" : `${s.pct}/100`} (${s.answered} of ${s.total} answered)`);
    lines.push("", "## Prioritized gaps", "");
    if (!results.gaps.length) lines.push("No gaps among the answered items.");
    results.gaps.forEach((g, i) => {
      lines.push(`${i + 1}. **${g.q}** (${g.section}, answered: ${ANSWER_LABEL[answers[g.id]]})`, `   Next step: ${g.next}`);
    });
    lines.push("", "## All answers", "");
    for (const s of SECTIONS) {
      lines.push(`### ${s.title}`, "");
      for (const it of s.items) lines.push(`- ${it.q} **${answers[it.id] ? ANSWER_LABEL[answers[it.id]] : "Not answered"}**`);
      lines.push("");
    }
    return lines.join("\n").trim() + "\n";
  }, [answers, answered, results, verdict]);

  return (
    <div className="space-y-5">
      <Notice tone="info" title="A self-assessment, not an audit">
        Answer honestly for your first RAG use case. Scores weight critical items more heavily, and Not sure counts as a
        small risk. For how to measure quality before launch, read{" "}
        <Link href="/articles/evaluating-rag-before-launch" className="link font-medium">
          evaluating RAG before launch
        </Link>
        .
      </Notice>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <ToolPanel title="Checklist" actions={<ResetBtn onClick={clear} label="Reset answers" />}>
          <div className="space-y-8">
            <div>
              <p className="text-sm text-ink-2" aria-live="polite">
                Answered <span className="font-semibold tabular-nums text-ink">{answered}</span> of {TOTAL}
              </p>
              <div className="mt-2">
                <Bar pct={(answered / TOTAL) * 100} label={`${answered} of ${TOTAL} answered`} />
              </div>
            </div>

            {SECTIONS.map((s, si) => (
              <section key={s.id} aria-labelledby={`rag-sec-${s.id}`}>
                <h3 id={`rag-sec-${s.id}`} className="text-[1.05rem] text-ink">
                  <span className="mr-2 font-mono text-[0.8rem] text-muted">{String(si + 1).padStart(2, "0")}</span>
                  {s.title}
                </h3>
                <ul className="mt-3 divide-y divide-line">
                  {s.items.map((it) => (
                    <li key={it.id} className="py-4 first:pt-1">
                      <p className="text-[0.95rem] font-medium text-ink" aria-hidden="true">
                        {it.q}
                        {it.weight === 3 && <span className="chip ml-2 !h-6 align-middle text-[0.72rem]">Critical</span>}
                      </p>
                      <p className="mt-0.5 text-[0.8125rem] text-muted">Why it matters: {it.why}</p>
                      <div className="mt-2.5">
                        <Segmented<Answer>
                          label={`${it.q}${it.weight === 3 ? " (critical)" : ""}`}
                          value={answers[it.id] ?? ("" as Answer)}
                          onChange={(v) => setAnswer(it.id, v)}
                          options={ANSWERS}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ToolPanel>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          <ToolPanel
            title="Readiness"
            actions={
              <>
                <CopyBtn text={answered ? markdown : ""} label="Copy" />
                <Btn
                  variant="ghost"
                  icon="download"
                  disabled={!answered}
                  onClick={() => downloadFile("rag-readiness.md", markdown, "text/markdown")}
                >
                  Download .md
                </Btn>
              </>
            }
          >
            {results.overall.pct === null || !verdict ? (
              <EmptyState icon="checklist" title="No answers yet">
                Answer a few items to see your score. Results update as you go.
              </EmptyState>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl bg-accent-soft p-5" aria-live="polite" aria-atomic="true">
                  <p className="text-sm text-ink-2">{complete ? "Overall readiness" : "Provisional readiness"}</p>
                  <p className="mt-1 font-display text-[2.25rem] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
                    {results.overall.pct}
                    <span className="text-[1.1rem] text-ink-2">/100</span>
                  </p>
                  <p className="mt-2 font-medium text-ink">{verdict.label}</p>
                  <p className="mt-1 text-sm text-ink-2">{verdict.detail}</p>
                  {!complete && (
                    <p className="mt-2 text-[0.8125rem] text-ink-2">
                      Based on {answered} of {TOTAL} answers. Finish the checklist for a final score.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-[0.95rem] text-ink">By section</h3>
                  <ul className="mt-3 space-y-3">
                    {results.sections.map((s) => (
                      <li key={s.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-ink-2">{s.title}</span>
                          <span className="tabular-nums font-medium text-ink">{s.pct === null ? "Not answered" : `${s.pct}/100`}</span>
                        </div>
                        <div className="mt-1.5">
                          <Bar pct={s.pct} label={s.pct === null ? "Not answered" : `${s.pct} out of 100`} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </ToolPanel>

          <ToolPanel title="Top gaps">
            {results.gaps.length === 0 ? (
              <p className="text-sm text-muted">
                {answered ? "No gaps among your answers so far." : "Gaps appear here, with No answers first, then Not sure, then Partly."}
              </p>
            ) : (
              <ol className="space-y-4">
                {results.gaps.map((g, i) => (
                  <li key={g.id} className="flex gap-3">
                    <span aria-hidden="true" className="font-mono text-[0.8rem] text-muted">
                      {i + 1}.
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.9rem] font-medium text-ink">{g.q}</p>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        <span className={`chip !h-6 text-[0.72rem] ${answers[g.id] === "no" ? "!text-danger" : ""}`}>
                          {ANSWER_LABEL[answers[g.id]]}
                        </span>
                        <span className="chip !h-6 text-[0.72rem]">{g.section}</span>
                        {g.weight === 3 && <span className="chip !h-6 text-[0.72rem]">Critical</span>}
                      </p>
                      <p className="mt-1.5 text-[0.85rem] text-ink-2">
                        <span className="font-medium text-ink">Next step:</span> {g.next}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-6 border-t border-line pt-4 text-sm text-ink-2">
              Need help closing the gaps?{" "}
              <Link href="/services/rag-development" className="link font-medium">
                See our RAG development service
              </Link>
            </p>
          </ToolPanel>

          <PrivacyNote stored />
        </div>
      </div>
    </div>
  );
}
