"use client";

import { useState } from "react";
import {
  Btn,
  CellInput,
  CopyBtn,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  SelectField,
  ToolPanel,
  fmt,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { TEMPLATES, allocate, pages, wordsPerPage } from "./lib/essay";

type Section = { id: string; name: string; percent: string };
const pctOf = (s: Section) => parseNum(s.percent) ?? 0;

type Plan = { target: string; spacing: string; fontSize: string; customWpp: string; sections: Section[] };

const fromTemplate = (key: string): Section[] =>
  TEMPLATES[key].sections.map(([name, percent], i) => ({ id: `${key}-${i}`, name, percent: String(percent) }));

const INITIAL: Plan = { target: "1500", spacing: "2", fontSize: "12", customWpp: "", sections: fromTemplate("five") };

export default function Tool() {
  const [plan, setPlan, clear] = usePersistentState<Plan>("essay-word-count-planner", INITIAL);
  const [template, setTemplate] = useState("five");
  const set = (patch: Partial<Plan>) => setPlan((p) => ({ ...p, ...patch }));
  const setSection = (id: string, patch: Partial<Section>) =>
    setPlan((p) => ({ ...p, sections: p.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const target = parseNum(plan.target);
  const targetErr = target === null || target < 1 || !Number.isInteger(target) || target > 1_000_000 ? "Enter a whole number of words." : null;
  const size = parseNum(plan.fontSize);
  const sizeErr = size === null || size < 6 || size > 30 ? "6 to 30 pt" : null;
  const custom = plan.customWpp.trim() ? parseNum(plan.customWpp) : null;
  const customErr = plan.customWpp.trim() && (custom === null || custom <= 0) ? "Enter a positive number." : null;
  const wpp = custom ?? (size && !sizeErr ? wordsPerPage(Number(plan.spacing), size) : 0);
  const sum = plan.sections.reduce((a, s) => a + pctOf(s), 0);
  const words = !targetErr && target ? allocate(target, plan.sections.map(pctOf)) : plan.sections.map(() => 0);

  const summary = plan.sections
    .map((s, i) => `${s.name || `Section ${i + 1}`}: ${words[i]} words (${fmt(pctOf(s), 1)}%)${wpp ? `, about ${fmt(pages(words[i], wpp), 1)} pages` : ""}`)
    .join("\n");

  const move = (i: number, d: -1 | 1) =>
    setPlan((p) => {
      const s = [...p.sections];
      const j = i + d;
      if (j < 0 || j >= s.length) return p;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...p, sections: s };
    });

  return (
    <div className="space-y-5">
      <ToolPanel title="Essay settings" actions={<ResetBtn onClick={clear} label="Clear plan" />}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Target word count" value={plan.target} onChange={(e) => set({ target: e.target.value })} error={targetErr} />
          <SelectField
            label="Line spacing"
            value={plan.spacing}
            onChange={(e) => set({ spacing: e.target.value })}
            options={[
              { value: "1", label: "Single" },
              { value: "1.5", label: "1.5 lines" },
              { value: "2", label: "Double" },
            ]}
          />
          <NumberField label="Font size (pt)" value={plan.fontSize} onChange={(e) => set({ fontSize: e.target.value })} error={sizeErr} />
          <NumberField
            label="Words per page"
            optional
            hint="Overrides the estimate."
            value={plan.customWpp}
            onChange={(e) => set({ customWpp: e.target.value })}
            error={customErr}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <SelectField
            label="Start from a structure"
            className="min-w-[220px]"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            options={Object.entries(TEMPLATES).map(([value, t]) => ({ value, label: t.label }))}
          />
          <Btn variant="ghost" onClick={() => set({ sections: fromTemplate(template).map((s) => ({ ...s, id: uid() })) })}>
            Apply structure
          </Btn>
        </div>
      </ToolPanel>

      <ToolPanel title="Sections">
        <div className="space-y-4">
          {!targetErr && target && (
            <div className="grid gap-4 sm:grid-cols-2">
              <ResultCard label="Total" value={`${fmt(target, 0)} words`} detail={wpp ? `About ${fmt(pages(target, wpp), 1)} pages at ${fmt(wpp, 0)} words per page` : undefined} />
              <ResultCard tone="neutral" label="Percent assigned" value={`${fmt(sum, 1)}%`} detail={Math.abs(sum - 100) < 0.01 ? "Adds up to 100%." : "Words are scaled so sections still total the target."} />
            </div>
          )}
          {Math.abs(sum - 100) >= 0.01 && plan.sections.length > 0 && (
            <Notice tone="warning">Section percentages add up to {fmt(sum, 1)}%, not 100%.</Notice>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Word budget per section</caption>
              <thead className="text-ink-2">
                <tr>
                  <th scope="col" className="pb-2 font-medium">Section</th>
                  <th scope="col" className="w-24 pb-2 font-medium">%</th>
                  <th scope="col" className="w-24 pb-2 text-right font-medium">Words</th>
                  <th scope="col" className="w-20 pb-2 text-right font-medium">Pages</th>
                  <th scope="col" className="w-36 pb-2 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.sections.map((s, i) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="py-2 pr-2">
                      <CellInput label={`Section ${i + 1} name`} value={s.name} onChange={(e) => setSection(s.id, { name: e.target.value })} />
                    </td>
                    <td className="py-2 pr-2">
                      <CellInput
                        label={`Section ${i + 1} percent`}
                        inputMode="decimal"
                        value={s.percent}
                        invalid={s.percent.trim() !== "" && (parseNum(s.percent) === null || pctOf(s) < 0)}
                        onChange={(e) => setSection(s.id, { percent: e.target.value })}
                      />
                    </td>
                    <td className="py-2 text-right tabular-nums">{fmt(words[i] ?? 0, 0)}</td>
                    <td className="py-2 text-right tabular-nums">{wpp ? fmt(pages(words[i] ?? 0, wpp), 1) : "–"}</td>
                    <td className="py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Btn variant="subtle" aria-label={`Move ${s.name || "section"} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                          ↑
                        </Btn>
                        <Btn variant="subtle" aria-label={`Move ${s.name || "section"} down`} disabled={i === plan.sections.length - 1} onClick={() => move(i, 1)}>
                          ↓
                        </Btn>
                        <Btn
                          variant="subtle"
                          icon="trash"
                          aria-label={`Remove ${s.name || "section"}`}
                          onClick={() => setPlan((p) => ({ ...p, sections: p.sections.filter((x) => x.id !== s.id) }))}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn variant="ghost" icon="plus" onClick={() => setPlan((p) => ({ ...p, sections: [...p.sections, { id: uid(), name: "New section", percent: "0" }] }))}>
              Add section
            </Btn>
            <CopyBtn text={summary} label="Copy plan" />
          </div>
          <p className="text-[0.8125rem] text-muted">
            Page counts are estimates for 1-inch margins and a typical 12 pt font: about 500 words single-spaced and 250 double-spaced. Real pages vary with font, headings and paragraph breaks.
          </p>
        </div>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}
