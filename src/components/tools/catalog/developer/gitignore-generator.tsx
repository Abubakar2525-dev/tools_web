"use client";

import { useMemo, useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, OutputBlock, PrivacyNote, ResetBtn, TextArea, TextField, ToolPanel, downloadFile, usePersistentState } from "@/components/tools/kit";
import { TEMPLATES, mergeTemplates } from "./lib/gitignore";

const GROUPS = ["Language", "Framework", "Tooling", "Editor", "OS"] as const;
const GROUP_LABEL: Record<(typeof GROUPS)[number], string> = {
  Language: "Languages",
  Framework: "Frameworks and engines",
  Tooling: "Tooling",
  Editor: "Editors and IDEs",
  OS: "Operating systems",
};

const QUICK: { label: string; ids: string[] }[] = [
  { label: "Next.js app", ids: ["node", "nextjs", "vscode", "macos", "windows"] },
  { label: "Python service", ids: ["python", "jupyter", "docker", "vscode", "macos", "linux"] },
  { label: ".NET API", ids: ["dotnet", "visualstudio", "jetbrains", "windows"] },
  { label: "Unity game", ids: ["unity", "visualstudio", "macos", "windows"] },
];

export default function Tool() {
  const [state, setState, clear] = usePersistentState<{ ids: string[]; custom: string }>("gitignore-generator", { ids: [], custom: "" });
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const result = useMemo(() => mergeTemplates(state.ids, state.custom), [state]);

  const toggle = (id: string, on: boolean) => setState((s) => ({ ...s, ids: on ? [...s.ids.filter((x) => x !== id), id] : s.ids.filter((x) => x !== id) }));

  return (
    <div className="space-y-5">
      <ToolPanel title="Pick templates" actions={<ResetBtn onClick={clear} />}>
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick presets">
            {QUICK.map((p) => (
              <Btn key={p.label} variant="ghost" onClick={() => setState((s) => ({ ...s, ids: p.ids }))}>
                {p.label}
              </Btn>
            ))}
          </div>
          <TextField label="Search templates" placeholder="node, unity, mac…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {GROUPS.map((g) => {
              const items = TEMPLATES.filter((t) => t.group === g && (!q || t.name.toLowerCase().includes(q) || t.id.includes(q)));
              if (!items.length) return null;
              return (
                <fieldset key={g}>
                  <legend className="mb-2 text-sm font-semibold text-ink">{GROUP_LABEL[g]}</legend>
                  <div className="space-y-2">
                    {items.map((t) => (
                      <Checkbox key={t.id} label={t.name} checked={state.ids.includes(t.id)} onChange={(v) => toggle(t.id, v)} />
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
          <TextArea
            label="Your own rules"
            optional
            mono
            rows={4}
            placeholder={"# project specific\n/uploads/\n*.local.json"}
            value={state.custom}
            onChange={(e) => setState((s) => ({ ...s, custom: e.target.value }))}
            hint="Added at the end in a Custom section. Lines starting with ! re-include a path."
          />
        </div>
      </ToolPanel>
      <ToolPanel
        title=".gitignore"
        actions={
          <>
            <CopyBtn text={result.text} />
            <Btn variant="ghost" icon="download" disabled={!result.text} onClick={() => downloadFile(".gitignore", result.text)}>
              Download
            </Btn>
          </>
        }
      >
        {!result.text ? (
          <EmptyState icon="file" title="Nothing selected">
            Choose templates or a quick preset. Sections are merged in the order you pick them.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              {state.ids.length} template{state.ids.length === 1 ? "" : "s"}, {result.text.split("\n").filter((l) => l && !l.startsWith("#")).length} rules
              {result.removed > 0 ? `, ${result.removed} duplicate${result.removed === 1 ? "" : "s"} removed` : ""}.
            </p>
            <OutputBlock label=".gitignore content">
              <code>{result.text}</code>
            </OutputBlock>
            <p className="text-[0.8125rem] text-muted">Files Git already tracks stay tracked. Run git rm -r --cached on them after adding new rules.</p>
          </div>
        )}
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}
