"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, PrivacyNote, TextField, ToolPanel } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { AREAS, GIT_TASKS } from "./lib/gitCommands";

export default function Tool() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string>("All");
  const [safeOnly, setSafeOnly] = useState(false);
  const dq = useDeferredValue(query);

  const list = useMemo(() => {
    const words = dq.toLowerCase().split(/\s+/).filter(Boolean);
    return GIT_TASKS.filter((t) => {
      if (area !== "All" && t.area !== area) return false;
      if (safeOnly && t.warning) return false;
      if (!words.length) return true;
      const hay = `${t.task} ${t.explain} ${t.commands.join(" ")} ${t.keywords ?? ""} ${t.area}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [dq, area, safeOnly]);

  const grouped = AREAS.map((a) => ({ area: a, items: list.filter((t) => t.area === a) })).filter((g) => g.items.length);

  return (
    <div className="space-y-5">
      <ToolPanel title="Find a Git command">
        <div className="space-y-4">
          <TextField label="What do you want to do?" placeholder="undo last commit, rename branch, delete remote branch…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by area">
            {["All", ...AREAS].map((a) => (
              <Btn key={a} variant={area === a ? "primary" : "ghost"} aria-pressed={area === a} onClick={() => setArea(a)}>
                {a}
              </Btn>
            ))}
          </div>
          <Checkbox label="Hide commands that can lose work or rewrite history" checked={safeOnly} onChange={setSafeOnly} />
          <p className="text-[0.8125rem] text-muted" aria-live="polite">
            {list.length} of {GIT_TASKS.length} tasks. Replace text in &lt;angle brackets&gt; with your own values.
          </p>
        </div>
      </ToolPanel>
      {grouped.length === 0 ? (
        <EmptyState icon="search" title="No matching tasks">
          Try fewer or different words, such as &quot;stash&quot; or &quot;tag&quot;.
        </EmptyState>
      ) : (
        grouped.map((g) => (
          <ToolPanel key={g.area} title={g.area}>
            <ul className="space-y-4">
              {g.items.map((t) => {
                const text = t.commands.join("\n");
                return (
                  <li key={t.task} className="rounded-xl bg-sunken p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-sans text-[1rem] font-semibold text-ink">{t.task}</h3>
                      <CopyBtn text={t.commands.filter((c) => !c.startsWith("#")).join("\n")} />
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-night p-3 font-mono text-[0.85rem] leading-relaxed text-night-ink" tabIndex={0} aria-label={`Commands for: ${t.task}`}>
                      <code>{text}</code>
                    </pre>
                    <p className="mt-3 text-sm text-ink-2">{t.explain}</p>
                    {t.warning && (
                      <p className="mt-2 flex items-start gap-2 text-sm text-ink">
                        <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-danger" />
                        <span>
                          <span className="font-medium">Careful: </span>
                          {t.warning}
                        </span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </ToolPanel>
        ))
      )}
      <PrivacyNote />
    </div>
  );
}
