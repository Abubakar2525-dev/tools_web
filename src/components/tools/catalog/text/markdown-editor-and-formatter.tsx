"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { demoteHeadings } from "@/components/tools/engines/files";
import { Btn, CopyBtn, Notice, PrivacyNote, ResetBtn, SplitGrid, ToolPanel, downloadFile, monoAreaCls, usePersistentState } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { loadMarkdownLibs, type MarkdownLibs } from "./md-libs";

const STARTER = `# Project notes

Write **Markdown** here. The preview updates as you type and your draft is saved in this browser.

## Next steps
* tidy the list markers
* press Format to normalize spacing

| Task | Owner |
|---|---|
| Draft | Ana |
`;

type Action = { id: string; label: string; title: string; apply: (sel: string) => { text: string; select?: [number, number] } };

/** Each action returns replacement text for the selection and the range (relative) to select afterwards. */
const wrap = (mark: string, placeholder: string) => (sel: string) => {
  const inner = sel || placeholder;
  return { text: `${mark}${inner}${mark}`, select: [mark.length, mark.length + inner.length] as [number, number] };
};
const linePrefix = (prefix: (i: number) => string, placeholder: string) => (sel: string) => {
  const lines = (sel || placeholder).split("\n");
  const text = lines.map((l, i) => prefix(i) + l).join("\n");
  return { text, select: [0, text.length] as [number, number] };
};

const ACTIONS: Action[] = [
  { id: "b", label: "B", title: "Bold", apply: wrap("**", "bold text") },
  { id: "i", label: "I", title: "Italic", apply: wrap("*", "italic text") },
  { id: "h", label: "H2", title: "Heading", apply: linePrefix(() => "## ", "Heading") },
  { id: "ul", label: "• List", title: "Bulleted list", apply: linePrefix(() => "- ", "List item") },
  { id: "ol", label: "1. List", title: "Numbered list", apply: linePrefix((i) => `${i + 1}. `, "List item") },
  { id: "q", label: "Quote", title: "Blockquote", apply: linePrefix(() => "> ", "Quote") },
  {
    id: "link",
    label: "Link",
    title: "Link",
    apply: (sel) => {
      const t = sel || "link text";
      return { text: `[${t}](https://)`, select: [t.length + 3, t.length + 11] };
    },
  },
  {
    id: "code",
    label: "Code",
    title: "Inline code or code block",
    apply: (sel) => (sel.includes("\n") ? { text: "```\n" + sel + "\n```", select: [4, 4 + sel.length] } : wrap("`", "code")(sel)),
  },
  {
    id: "table",
    label: "Table",
    title: "Insert table",
    apply: () => {
      const text = "\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n";
      return { text, select: [3, 11] };
    },
  },
];

export default function Tool() {
  const [draft, setDraft, clear] = useStoredDraft();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [libs, setLibs] = useState<MarkdownLibs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formatState, setFormatState] = useState<{ kind: "idle" | "busy" | "done" | "error"; msg?: string }>({ kind: "idle" });
  const editorId = useId();
  const deferred = useDeferredValue(draft);

  useEffect(() => {
    let alive = true;
    loadMarkdownLibs()
      .then((l) => alive && setLibs(l))
      .catch(() => alive && setLoadError("The preview could not be loaded. Check your connection and reload the page."));
    return () => {
      alive = false;
    };
  }, []);

  const preview = useMemo(() => (libs ? libs.sanitize(libs.toHtml(deferred)) : ""), [libs, deferred]);

  const apply = (a: Action) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = draft.slice(start, end);
    const r = a.apply(sel);
    const next = draft.slice(0, start) + r.text + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const [s, e] = r.select ?? [r.text.length, r.text.length];
      el.setSelectionRange(start + s, start + e);
    });
  };

  const format = async () => {
    setFormatState({ kind: "busy" });
    try {
      const [{ format: fmt }, md] = await Promise.all([import("prettier/standalone"), import("prettier/plugins/markdown")]);
      const out = await fmt(draft, { parser: "markdown", plugins: [md], proseWrap: "preserve" });
      setDraft(out);
      setFormatState({ kind: "done", msg: out === draft ? "Already formatted." : "Formatted." });
    } catch (e) {
      setFormatState({ kind: "error", msg: e instanceof Error ? e.message.split("\n")[0] : "Could not format this Markdown." });
    }
  };

  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Markdown editor"
        actions={
          <>
            <Btn icon="markdown" onClick={format} disabled={!draft.trim() || formatState.kind === "busy"}>
              {formatState.kind === "busy" ? "Formatting…" : "Format"}
            </Btn>
            <Btn variant="ghost" icon="download" disabled={!draft} onClick={() => downloadFile("document.md", draft, "text/markdown")}>
              Download .md
            </Btn>
            <CopyBtn text={draft} />
            <ResetBtn onClick={clear} label="Clear draft" />
          </>
        }
      >
        <div role="toolbar" aria-label="Formatting" aria-controls={editorId} className="mb-3 flex flex-wrap gap-1.5">
          {ACTIONS.map((a) => (
            <Btn key={a.id} variant="ghost" title={a.title} aria-label={a.title} onClick={() => apply(a)} className="min-h-10 min-w-10 font-mono">
              <span aria-hidden="true" className={a.id === "b" ? "font-bold" : a.id === "i" ? "italic" : ""}>
                {a.label}
              </span>
            </Btn>
          ))}
        </div>
        {formatState.kind === "error" && (
          <div className="mb-3">
            <Notice tone="error">Format failed: {formatState.msg}</Notice>
          </div>
        )}
        {formatState.kind === "done" && (
          <p className="mb-3 text-[0.8125rem] text-muted" role="status">
            {formatState.msg}
          </p>
        )}
        <SplitGrid>
          <div className="min-w-0">
            <label htmlFor={editorId} className="text-sm font-medium">
              Markdown
            </label>
            <textarea
              id={editorId}
              ref={ref}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (formatState.kind !== "idle") setFormatState({ kind: "idle" });
              }}
              onKeyDown={(e) => {
                if (!(e.ctrlKey || e.metaKey)) return;
                const k = e.key.toLowerCase();
                const a = k === "b" ? ACTIONS[0] : k === "i" ? ACTIONS[1] : k === "k" ? ACTIONS[6] : null;
                if (a) {
                  e.preventDefault();
                  apply(a);
                }
              }}
              spellCheck
              className={`${monoAreaCls} mt-2 min-h-[420px]`}
            />
            <p className="mt-2 text-[0.8125rem] tabular-nums text-muted">
              {words.toLocaleString()} words · {draft.length.toLocaleString()} characters · Ctrl or Cmd + B, I, K for bold, italic, link
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium" id={`${editorId}-pv`}>
              Preview
            </p>
            {loadError ? (
              <div className="mt-2">
                <Notice tone="error">{loadError}</Notice>
              </div>
            ) : !libs ? (
              <div className="mt-2">
                <Spinner label="Loading preview" />
              </div>
            ) : (
              <div
                aria-labelledby={`${editorId}-pv`}
                className="mt-2 max-h-[460px] min-h-[420px] overflow-auto rounded-lg p-4 shadow-[inset_0_0_0_1px_var(--line-strong)] [&_a]:text-accent-strong [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-3 [&_code]:font-mono [&_code]:text-[0.875em] [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-sunken [&_pre]:p-3 [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:px-2 [&_ul]:list-disc [&>*+*]:mt-3"
                // Sanitized with DOMPurify.
                dangerouslySetInnerHTML={{ __html: demoteHeadings(preview) }}
              />
            )}
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}

function useStoredDraft() {
  return usePersistentState<string>("markdown-editor-and-formatter", STARTER);
}
