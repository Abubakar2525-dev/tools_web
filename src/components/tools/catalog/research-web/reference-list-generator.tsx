"use client";

import { useMemo, useRef, useState } from "react";
import {
  Btn,
  CellSelect,
  EmptyState,
  Notice,
  PrivacyNote,
  Segmented,
  SelectField,
  TextArea,
  ToolPanel,
  downloadFile,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import {
  STYLES,
  emptySource,
  entryToSource,
  parseBibtex,
  plainText,
  referenceList,
  segsToHtml,
  sourceWarnings,
  toBibtexList,
  type Source,
  type StyleId,
} from "./lib/cite";
import { EXAMPLES } from "./lib/cite/examples";
import { CopySegsBtns, RenderSegs, SourceForm } from "./shared/cite-ui";

interface Saved {
  style: StyleId;
  sources: Source[];
}

const INITIAL: Saved = { style: "apa", sources: [] };
const MAX_BIB_BYTES = 2 * 1024 * 1024;

const isSource = (s: unknown): s is Source =>
  !!s && typeof s === "object" && typeof (s as Source).id === "string" && typeof (s as Source).title === "string" && Array.isArray((s as Source).authors);

type Panel = "form" | "bibtex";

export default function Tool() {
  const [saved, setSaved] = usePersistentState<Saved>("reference-list-generator", INITIAL);
  const sources = useMemo(() => (Array.isArray(saved.sources) ? saved.sources.filter(isSource) : []), [saved.sources]);
  const style: StyleId = STYLES.some((s) => s.value === saved.style) ? saved.style : "apa";

  const [panel, setPanel] = useState<Panel>("form");
  const [draft, setDraft] = useState<Source>(() => emptySource(uid(), "journal"));
  const [editing, setEditing] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [bibText, setBibText] = useState("");
  const [importMsg, setImportMsg] = useState<{ tone: "success" | "error" | "warning"; text: string; details?: string[] } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => referenceList(style, sources), [style, sources]);
  const html = items.map((i) => `<p>${segsToHtml(i.segs)}</p>`).join("");
  const plain = items.map((i) => plainText(i.segs)).join("\n");

  const setSources = (fn: (s: Source[]) => Source[]) => setSaved((prev) => ({ ...prev, sources: fn(Array.isArray(prev.sources) ? prev.sources.filter(isSource) : []) }));

  const submit = () => {
    if (!draft.title.trim()) {
      setFormError("Add a title before saving the source.");
      return;
    }
    setFormError(null);
    if (editing) setSources((list) => list.map((s) => (s.id === editing ? { ...draft, id: editing } : s)));
    else setSources((list) => [...list, { ...draft, id: uid() }]);
    setEditing(null);
    setDraft(emptySource(uid(), draft.type));
  };

  const importBib = (text: string) => {
    const r = parseBibtex(text);
    if (!r.entries.length) {
      setImportMsg({ tone: "error", text: "No BibTeX entries were found.", details: r.errors.slice(0, 6) });
      return;
    }
    const added = r.entries.map((e) => entryToSource(e, uid()));
    const untitled = added.filter((s) => !s.title.trim()).length;
    setSources((list) => [...list, ...added.filter((s) => s.title.trim())]);
    setImportMsg({
      tone: r.errors.length || untitled ? "warning" : "success",
      text: `Added ${added.length - untitled} ${added.length - untitled === 1 ? "source" : "sources"}.${untitled ? ` Skipped ${untitled} without a title.` : ""}`,
      details: [...r.errors, ...r.warnings].slice(0, 6),
    });
    setBibText("");
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title={editing ? "Edit source" : "Add a source"}>
          <div className="space-y-5">
            <Segmented
              label="Add sources by"
              value={panel}
              onChange={setPanel}
              options={[
                { value: "form", label: "Form" },
                { value: "bibtex", label: "BibTeX import" },
              ]}
            />
            {panel === "form" ? (
              <>
                <CellSelect
                  label="Load an example"
                  value=""
                  onChange={(e) => {
                    const ex = EXAMPLES.find((x) => x.source.id === e.target.value);
                    if (ex) setDraft({ ...structuredClone(ex.source), id: uid() });
                  }}
                  options={[{ value: "", label: "Fill the form with an example…" }, ...EXAMPLES.map((x) => ({ value: x.source.id, label: x.label }))]}
                />
                <SourceForm value={draft} onChange={setDraft} titleHint="Use sentence case for APA, Harvard and IEEE. MLA and Chicago convert titles to title case." />
                {sourceWarnings(draft).length > 0 && draft.title.trim() && (
                  <Notice tone="warning">
                    <ul className="list-disc space-y-1 pl-4">
                      {sourceWarnings(draft).map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
                {formError && <Notice tone="error">{formError}</Notice>}
                <div className="flex flex-wrap gap-2">
                  <Btn icon={editing ? "check" : "plus"} onClick={submit}>
                    {editing ? "Save changes" : "Add to list"}
                  </Btn>
                  {editing && (
                    <Btn
                      variant="ghost"
                      onClick={() => {
                        setEditing(null);
                        setDraft(emptySource(uid(), draft.type));
                        setFormError(null);
                      }}
                    >
                      Cancel editing
                    </Btn>
                  )}
                </div>
              </>
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".bib,.bibtex,.txt,text/plain,application/x-bibtex"
                  className="sr-only"
                  aria-label="Open a .bib file"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    if (f.size > MAX_BIB_BYTES) {
                      setImportMsg({ tone: "error", text: "That file is larger than 2 MB." });
                      return;
                    }
                    importBib(await f.text());
                  }}
                />
                <TextArea label="Paste BibTeX" mono rows={10} value={bibText} onChange={(e) => setBibText(e.target.value)} placeholder="@article{key, …}" hint="Entries from Zotero, Mendeley, Google Scholar or a .bib file." />
                <div className="flex flex-wrap gap-2">
                  <Btn icon="plus" disabled={!bibText.trim()} onClick={() => importBib(bibText)}>
                    Import pasted entries
                  </Btn>
                  <Btn variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>
                    Open .bib file
                  </Btn>
                </div>
              </>
            )}
            {importMsg && (
              <Notice tone={importMsg.tone}>
                <p>{importMsg.text}</p>
                {importMsg.details && importMsg.details.length > 0 && (
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {importMsg.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                )}
              </Notice>
            )}
          </div>
        </ToolPanel>

        <div className="min-w-0 space-y-5">
          <ToolPanel
            title={`Reference list (${sources.length})`}
            actions={
              <>
                <CopySegsBtns html={html} text={plain} disabled={!items.length} />
                <Btn variant="ghost" icon="download" disabled={!sources.length} onClick={() => downloadFile("references.bib", toBibtexList(sources), "application/x-bibtex")}>
                  .bib
                </Btn>
                <Btn variant="ghost" icon="download" disabled={!items.length} onClick={() => downloadFile("references.txt", plain + "\n")}>
                  .txt
                </Btn>
              </>
            }
          >
            <div className="space-y-4">
              <SelectField label="Citation style" value={style} onChange={(e) => setSaved((p) => ({ ...p, style: e.target.value as StyleId }))} options={STYLES.map((s) => ({ value: s.value, label: s.label }))} />
              <p className="text-[0.8125rem] text-muted">
                {style === "ieee"
                  ? "IEEE lists are numbered in the order you added sources (citation order)."
                  : "Sorted alphabetically by first author (or title), then year. Same author and year get a, b, c suffixes in author-date styles."}
              </p>
              {items.length === 0 ? (
                <EmptyState icon="book" title="Your list is empty">
                  Add sources with the form or import BibTeX. The list is saved in this browser.
                </EmptyState>
              ) : (
                <ol className="space-y-2">
                  {items.map((it) => (
                    <li key={it.source.id} className="rounded-lg bg-sunken px-4 py-3">
                      <p className="break-words pl-6 -indent-6 font-serif leading-relaxed text-ink">
                        <RenderSegs segs={it.segs} />
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Btn
                          variant="subtle"
                          icon="pen"
                          onClick={() => {
                            setDraft(structuredClone(it.source));
                            setEditing(it.source.id);
                            setPanel("form");
                            setFormError(null);
                          }}
                        >
                          Edit
                        </Btn>
                        {style === "ieee" && (
                          <>
                            <Btn
                              variant="subtle"
                              aria-label="Move up"
                              disabled={sources[0]?.id === it.source.id}
                              onClick={() =>
                                setSources((list) => {
                                  const i = list.findIndex((s) => s.id === it.source.id);
                                  if (i <= 0) return list;
                                  const n = [...list];
                                  [n[i - 1], n[i]] = [n[i], n[i - 1]];
                                  return n;
                                })
                              }
                            >
                              ↑
                            </Btn>
                            <Btn
                              variant="subtle"
                              aria-label="Move down"
                              disabled={sources[sources.length - 1]?.id === it.source.id}
                              onClick={() =>
                                setSources((list) => {
                                  const i = list.findIndex((s) => s.id === it.source.id);
                                  if (i < 0 || i >= list.length - 1) return list;
                                  const n = [...list];
                                  [n[i + 1], n[i]] = [n[i], n[i + 1]];
                                  return n;
                                })
                              }
                            >
                              ↓
                            </Btn>
                          </>
                        )}
                        <Btn variant="danger" icon="trash" onClick={() => setSources((list) => list.filter((s) => s.id !== it.source.id))}>
                          Delete
                        </Btn>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {confirmClear ? (
                    <>
                      <span className="text-sm text-ink-2">Delete all {sources.length} sources?</span>
                      <Btn
                        variant="danger"
                        onClick={() => {
                          setSources(() => []);
                          setConfirmClear(false);
                        }}
                      >
                        Yes, clear list
                      </Btn>
                      <Btn variant="ghost" onClick={() => setConfirmClear(false)}>
                        Keep
                      </Btn>
                    </>
                  ) : (
                    <Btn variant="subtle" icon="trash" onClick={() => setConfirmClear(true)}>
                      Clear list
                    </Btn>
                  )}
                </div>
              )}
            </div>
          </ToolPanel>
        </div>
      </div>
      <PrivacyNote stored />
    </div>
  );
}
