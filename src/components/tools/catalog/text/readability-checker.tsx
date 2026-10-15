"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, EmptyState, Notice, PrivacyNote, ResetBtn, ResultCard, StatGrid, TextArea, ToolPanel, fmt } from "@/components/tools/kit";
import { analyzeReadability, easeBand } from "./lib/readability";

const SAMPLE = `Readability formulas give a rough idea of how hard a passage is to read. They look at two things: how long the sentences are, and how long the words are. Short sentences with familiar words usually score as easier.

These scores were built for English prose, so they can mislead on code, lists, poetry or very short texts. Treat the numbers as a prompt to review your writing, not as a verdict. Notwithstanding the considerable methodological limitations inherent in syllable-based approximations, institutional communications departments frequently incorporate these measurements into comprehensive editorial guidelines for organizational documentation.`;

const LONG = 25;

export default function Tool() {
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text);
  const r = useMemo(() => (deferred.trim() ? analyzeReadability(deferred) : null), [deferred]);

  const flagged = r ? r.sentenceList.filter((s) => s.words > LONG || s.complexWords >= 4) : [];
  const grades = r
    ? [
        { label: "Flesch-Kincaid grade", value: r.fleschKincaidGrade },
        { label: "Gunning fog", value: r.gunningFog },
        { label: "SMOG", value: r.smog },
        { label: "Coleman-Liau", value: r.colemanLiau },
        { label: "Automated Readability Index", value: r.ari },
      ]
    : [];
  const avgGrade = grades.length ? grades.reduce((a, g) => a + g.value, 0) / grades.length : 0;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Text to analyze"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => setText(SAMPLE)}>
              Load sample
            </Btn>
            <ResetBtn onClick={() => setText("")} />
          </>
        }
      >
        <TextArea
          label="Your text"
          hint="English prose works best. Paste at least a few sentences for stable scores."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
        />
      </ToolPanel>

      <ToolPanel title="Scores">
        {!r ? (
          <EmptyState icon="grade" title="No scores yet">
            Type or paste some English text to see readability scores.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            {r.words < 100 && (
              <Notice tone="warning">Short texts give unstable scores. Most formulas were designed for samples of 100 words or more.</Notice>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <ResultCard
                label="Flesch reading ease (0 to 100, higher is easier)"
                value={fmt(r.fleschReadingEase, 1)}
                detail={easeBand(r.fleschReadingEase)}
              />
              <ResultCard
                tone="neutral"
                label="Average US grade level (5 formulas)"
                value={fmt(avgGrade, 1)}
                detail={`Roughly ${avgGrade < 1 ? "early elementary" : `grade ${Math.round(avgGrade)}`} reading level`}
              />
            </div>
            <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
              <table className="w-full min-w-[420px] text-left text-sm">
                <caption className="sr-only">Grade-level formulas</caption>
                <thead className="bg-sunken text-ink-2">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Formula
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      US grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.label} className="border-t border-line">
                      <th scope="row" className="px-4 py-2.5 font-normal">
                        {g.label}
                      </th>
                      <td className="px-4 py-2.5 tabular-nums">{fmt(g.value, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <StatGrid
              items={[
                { label: "Sentences", value: fmt(r.sentences, 0) },
                { label: "Words", value: fmt(r.words, 0) },
                { label: "Syllables (est.)", value: fmt(r.syllables, 0) },
                { label: "Words per sentence", value: fmt(r.avgWordsPerSentence, 1) },
                { label: "Syllables per word", value: fmt(r.avgSyllablesPerWord, 2) },
                { label: "Complex words", value: `${fmt(r.complexWords, 0)} (${fmt((r.complexWords / r.words) * 100, 1)}%)` },
              ]}
            />
            <div>
              <h3 className="text-sm font-semibold text-ink">Sentences to review</h3>
              <p className="mt-1 text-[0.8125rem] text-muted">
                Flagged when longer than {LONG} words or containing 4 or more complex words (3+ syllables).
              </p>
              {flagged.length === 0 ? (
                <p className="mt-3 text-sm text-ink-2">No long or dense sentences found.</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {flagged.map((s, i) => (
                    <li key={i} className="rounded-lg bg-sunken px-4 py-3 text-sm">
                      <p className="text-ink">{s.text}</p>
                      <p className="mt-1 text-[0.8125rem] text-muted">
                        {s.words > LONG ? `Long: ${s.words} words` : `${s.words} words`}
                        {s.complexWords >= 4 ? ` · Dense: ${s.complexWords} complex words` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <p className="text-[0.8125rem] text-muted">
              These are estimates for English text. Syllables are counted with a rule-based heuristic, so individual words can be off by one.
            </p>
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
