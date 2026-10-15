"use client";

import { useEffect, useState } from "react";
import { demoteHeadings } from "@/components/tools/engines/files";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, Segmented, ToolPanel, downloadFile, inputCls, uid, usePersistentState } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { normalizeNotes, notesInitial, type Note, type NotesState } from "./lib/schema";
import { BackupBar, ConfirmButton, PrintArea } from "./shared";

type Mode = "write" | "preview" | "split";

const noteTitle = (n: Note) => n.title.trim() || n.body.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find(Boolean)?.slice(0, 60) || "Untitled note";

const fileSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "note";

function toMarkdown(n: Note) {
  const title = n.title.trim();
  return title && !n.body.trimStart().startsWith("# ") ? `# ${title}\n\n${n.body}` : n.body;
}

function fmtUpdated(ms: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Renders Markdown to sanitized HTML (marked + DOMPurify, loaded on first use). */
function useMarkdown(src: string | null, key: string | null) {
  const [out, setOut] = useState<{ key: string | null; html: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (src === null) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const [{ marked }, purify] = await Promise.all([import("marked"), import("dompurify")]);
        const raw = await marked.parse(src, { gfm: true });
        const html = purify.default.sanitize(raw, { USE_PROFILES: { html: true } });
        if (!cancelled) {
          setOut({ key, html });
          setError(null);
        }
      } catch {
        if (!cancelled) setError("The preview could not be rendered.");
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [src, key]);
  // Hide the previous note's preview right after switching notes.
  return { html: out && out.key === key ? out.html : null, error };
}

export default function Tool() {
  const [state, setState, clear] = usePersistentState<NotesState>("notes", notesInitial);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("write");

  const notes = state.notes;
  const active = notes.find((n) => n.id === state.activeId) ?? null;
  const { html, error } = useMarkdown(active ? active.body : null, active?.id ?? null);

  const q = query.trim().toLowerCase();
  const shown = [...notes]
    .sort((a, b) => b.updated - a.updated)
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));

  const create = () => {
    const n: Note = { id: uid(), title: "", body: "", updated: Date.now() };
    setState((s) => ({ notes: [n, ...s.notes], activeId: n.id }));
    setMode("write");
    setQuery("");
  };

  const update = (patch: Partial<Note>) => {
    if (!active) return;
    const id = active.id;
    setState((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updated: Date.now() } : n)) }));
  };

  const words = active ? (active.body.trim().match(/\S+/g)?.length ?? 0) : 0;

  const preview = (
    <div>
      <p className="text-sm font-medium text-ink" id="note-preview-label">
        Preview
      </p>
      <div className="mt-2">
        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <div
            role="region"
            aria-labelledby="note-preview-label"
            tabIndex={0}
            className="prose-article min-h-[360px] overflow-auto break-words rounded-lg bg-surface p-4 !text-[0.975rem] shadow-[inset_0_0_0_1px_var(--line-strong)] sm:p-5 [&>:first-child]:!mt-0 [&_ol]:pl-6 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-night [&_pre]:p-3 [&_pre]:text-night-ink [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:px-2"
            dangerouslySetInnerHTML={{ __html: demoteHeadings(html ?? "") }}
          />
        )}
        {active && !active.body.trim() && <p className="mt-2 text-sm text-muted">Nothing to preview yet.</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <ToolPanel title="Notes">
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <aside aria-label="All notes" className="space-y-3">
            <Btn icon="plus" onClick={create} className="w-full justify-center">
              New note
            </Btn>
            <div className="relative">
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                aria-label="Search notes"
                placeholder="Search notes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${inputCls} h-10 pl-9`}
              />
            </div>
            <p className="text-[0.8125rem] text-muted" aria-live="polite">
              {q ? `${shown.length} of ${notes.length} notes match` : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
            </p>
            <ul className="max-h-[420px] space-y-1 overflow-y-auto">
              {shown.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    aria-current={n.id === active?.id ? "true" : undefined}
                    onClick={() => setState((s) => ({ ...s, activeId: n.id }))}
                    className={`block w-full rounded-lg px-3 py-2 text-left transition-colors ${n.id === active?.id ? "bg-accent-soft" : "hover:bg-sunken"}`}
                  >
                    <span className="block truncate text-[0.9rem] font-medium text-ink">{noteTitle(n)}</span>
                    <span className="block truncate text-[0.78rem] text-muted">
                      {fmtUpdated(n.updated)}
                      {n.body.trim() ? ` · ${n.body.replace(/[#*_`>-]/g, "").trim().slice(0, 50)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0">
            {!active ? (
              <EmptyState icon="pen" title={notes.length ? "Select a note" : "No notes yet"}>
                {notes.length ? "Pick a note from the list, or start a new one." : "Create a note to start writing. Markdown is supported."}
              </EmptyState>
            ) : (
              <div className="space-y-4">
                <input
                  aria-label="Note title"
                  placeholder="Title"
                  value={active.title}
                  maxLength={200}
                  onChange={(e) => update({ title: e.target.value })}
                  className={`${inputCls} h-12 font-display text-[1.25rem] font-semibold`}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Segmented
                    label="View"
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: "write", label: "Write" },
                      { value: "preview", label: "Preview" },
                      { value: "split", label: "Side by side" },
                    ]}
                  />
                  <span className="text-[0.8125rem] tabular-nums text-muted">
                    {words} words · saved {fmtUpdated(active.updated)}
                  </span>
                </div>
                <div className={mode === "split" ? "grid gap-4 xl:grid-cols-2" : ""}>
                  {mode !== "preview" && (
                    <div>
                      <label htmlFor="note-body" className="text-sm font-medium text-ink">
                        Note (Markdown)
                      </label>
                      <textarea
                        id="note-body"
                        value={active.body}
                        maxLength={500_000}
                        onChange={(e) => update({ body: e.target.value })}
                        placeholder={"# Heading\n\n- bullet\n- **bold** and _italic_\n\n[link](https://example.com)"}
                        className={`${inputCls} mt-2 min-h-[360px] resize-y py-3 font-mono text-[0.9rem] leading-relaxed`}
                      />
                    </div>
                  )}
                  {mode !== "write" && preview}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Btn
                    variant="ghost"
                    icon="download"
                    onClick={() => downloadFile(`${fileSlug(noteTitle(active))}.md`, toMarkdown(active), "text/markdown")}
                  >
                    Download .md
                  </Btn>
                  <CopyBtn text={toMarkdown(active)} label="Copy Markdown" />
                  <Btn variant="ghost" icon="file" onClick={() => window.print()}>
                    Print note
                  </Btn>
                  <ConfirmButton
                    label="Delete note"
                    confirmLabel="Delete this note"
                    onConfirm={() =>
                      setState((s) => {
                        const rest = s.notes.filter((n) => n.id !== active.id);
                        return { notes: rest, activeId: rest[0]?.id ?? null };
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </ToolPanel>

      <ToolPanel>
        <div className="space-y-4">
          <BackupBar<NotesState>
            tool="notes"
            data={state}
            normalize={normalizeNotes}
            onImport={(v) => setState(v)}
            onClear={clear}
            hasData={notes.length > 0}
            onPrint={null}
          />
          <p className="text-[0.8125rem] text-muted">Export JSON saves every note in one backup file. Use Download .md for a single note.</p>
          <PrivacyNote stored />
        </div>
      </ToolPanel>

      {active && (
        <PrintArea>
          <h2>{noteTitle(active)}</h2>
          {html ? <div dangerouslySetInnerHTML={{ __html: demoteHeadings(html) }} /> : <p style={{ whiteSpace: "pre-wrap" }}>{active.body}</p>}
        </PrintArea>
      )}
    </div>
  );
}
