"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import {
  Btn,
  CellSelect,
  CopyBtn,
  EmptyState,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SelectField,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
} from "@/components/tools/kit";
import {
  STYLES,
  citationKey,
  emptySource,
  entryToSource,
  parseBibtex,
  referenceList,
  segsToHtml,
  plainText,
  sourceWarnings,
  toBibtex,
  type Source,
  type StyleId,
} from "./lib/cite";
import { EXAMPLES } from "./lib/cite/examples";
import { CopySegsBtns, RenderSegs, SourceForm } from "./shared/cite-ui";

type Mode = "create" | "parse";

const SAMPLE_BIB = String.raw`@article{lecun2015deep,
  author  = {LeCun, Yann and Bengio, Yoshua and Hinton, Geoffrey},
  title   = {Deep learning},
  journal = {Nature},
  volume  = {521},
  number  = {7553},
  pages   = {436--444},
  year    = {2015},
  month   = may,
  doi     = {10.1038/nature14539}
}

@book{kahneman2011,
  author    = {Kahneman, Daniel},
  title     = {Thinking, Fast and Slow},
  publisher = {Farrar, Straus and Giroux},
  address   = {New York},
  year      = 2011
}`;

const MAX_BIB_BYTES = 2 * 1024 * 1024;

function CreateMode() {
  const [source, setSource] = useState<Source>(() => emptySource("src", "journal"));
  const [keyOverride, setKeyOverride] = useState<string | null>(null);
  const [example, setExample] = useState("");
  const d = useDeferredValue(source);
  const autoKey = useMemo(() => citationKey(d), [d]);
  const key = keyOverride ?? autoKey;
  const keyBad = !/^[A-Za-z0-9_:.\-+/]+$/.test(key);
  const has = d.title.trim() !== "" || d.authors.some((a) => a.family.trim());
  const bib = has && !keyBad ? toBibtex(d, key) : "";
  const warnings = has ? sourceWarnings(d) : [];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel
        title="Source details"
        actions={
          <>
            <CellSelect
              label="Load an example"
              value={example}
              className="w-[13rem]"
              onChange={(e) => {
                const ex = EXAMPLES.find((x) => x.source.id === e.target.value);
                setExample(e.target.value);
                if (ex) {
                  setSource(structuredClone(ex.source));
                  setKeyOverride(null);
                }
              }}
              options={[{ value: "", label: "Load an example…" }, ...EXAMPLES.map((x) => ({ value: x.source.id, label: x.label }))]}
            />
            <ResetBtn
              onClick={() => {
                setSource(emptySource("src", source.type));
                setKeyOverride(null);
                setExample("");
              }}
            />
          </>
        }
      >
        <SourceForm value={source} onChange={setSource} titleHint="Type the title with the capitalization you want; it is wrapped in braces so BibTeX styles keep it." />
      </ToolPanel>
      <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
        <ToolPanel
          title="BibTeX entry"
          actions={
            <>
              <CopyBtn text={bib} />
              <Btn variant="ghost" icon="download" disabled={!bib} onClick={() => downloadFile(`${key || "reference"}.bib`, bib + "\n", "application/x-bibtex")}>
                .bib
              </Btn>
            </>
          }
        >
          <div className="space-y-4">
            <TextField
              label="Citation key"
              hint="Generated as family name + year + first title word. Edit it if you like."
              value={key}
              onChange={(e) => setKeyOverride(e.target.value)}
              error={keyBad && key ? "Use letters, digits and _ : . - + / only (no spaces or commas)." : null}
              className="font-mono"
            />
            {keyOverride !== null && (
              <Btn variant="subtle" icon="reset" onClick={() => setKeyOverride(null)}>
                Use generated key
              </Btn>
            )}
            {bib ? (
              <OutputBlock label="BibTeX entry">
                <code>{bib}</code>
              </OutputBlock>
            ) : (
              <EmptyState icon="braces" title="No entry yet">
                Fill in an author or title to generate BibTeX.
              </EmptyState>
            )}
            {warnings.length > 0 && (
              <Notice tone="warning" title="Check these details">
                <ul className="list-disc space-y-1 pl-4">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Notice>
            )}
          </div>
        </ToolPanel>
      </div>
    </div>
  );
}

function ParseMode() {
  const [text, setText] = useState("");
  const [style, setStyle] = useState<StyleId>("apa");
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const d = useDeferredValue(text);

  const parsed = useMemo(() => {
    if (!d.trim()) return null;
    const r = parseBibtex(d);
    const sources = r.entries.map((e, i) => entryToSource(e, `${e.key || "entry"}-${i}`));
    return { ...r, sources };
  }, [d]);
  const items = useMemo(() => (parsed ? referenceList(style, parsed.sources) : []), [parsed, style]);
  const html = items.map((i) => `<p>${segsToHtml(i.segs)}</p>`).join("");
  const plain = items.map((i) => plainText(i.segs)).join("\n");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel
        title="BibTeX input"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => setText(SAMPLE_BIB)}>
              Load sample
            </Btn>
            <Btn variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>
              Open .bib
            </Btn>
            <ResetBtn onClick={() => setText("")} />
          </>
        }
      >
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
              setFileError("That file is larger than 2 MB. Split it or paste the entries you need.");
              return;
            }
            setFileError(null);
            setText(await f.text());
          }}
        />
        {fileError && (
          <div className="mb-3">
            <Notice tone="error">{fileError}</Notice>
          </div>
        )}
        <TextArea label="Paste BibTeX entries" mono rows={16} value={text} onChange={(e) => setText(e.target.value)} placeholder="@article{key, author = {…}, title = {…}, …}" hint="@string macros, # concatenation, @comment blocks and LaTeX accents are handled." />
      </ToolPanel>
      <div className="min-w-0 space-y-5">
        <ToolPanel
          title="Formatted references"
          actions={<CopySegsBtns html={html} text={plain} disabled={!items.length} />}
        >
          <div className="space-y-4">
            <SelectField label="Style" value={style} onChange={(e) => setStyle(e.target.value as StyleId)} options={STYLES.map((s) => ({ value: s.value, label: s.label }))} />
            {!parsed ? (
              <EmptyState icon="book" title="Nothing parsed yet">
                Paste BibTeX or open a .bib file. Entries are rendered in the chosen style.
              </EmptyState>
            ) : (
              <>
                <p className="text-sm text-ink-2" aria-live="polite">
                  {parsed.entries.length} {parsed.entries.length === 1 ? "entry" : "entries"} parsed
                  {parsed.errors.length ? `, ${parsed.errors.length} with errors` : ""}.
                </p>
                {parsed.errors.length > 0 && (
                  <Notice tone="error" title="Some entries could not be read">
                    <ul className="list-disc space-y-1 pl-4">
                      {parsed.errors.slice(0, 8).map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
                {parsed.warnings.length > 0 && (
                  <Notice tone="warning">
                    <ul className="list-disc space-y-1 pl-4">
                      {parsed.warnings.slice(0, 8).map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
                <ol className="space-y-3">
                  {items.map((it) => (
                    <li key={it.source.id} className="rounded-lg bg-sunken px-4 py-3 pl-10 -indent-6 font-serif leading-relaxed text-ink break-words">
                      <RenderSegs segs={it.segs} />
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </ToolPanel>
      </div>
    </div>
  );
}

export default function Tool() {
  const [mode, setMode] = useState<Mode>("create");
  return (
    <div className="space-y-5">
      <Segmented
        label="Mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "create", label: "Create a BibTeX entry" },
          { value: "parse", label: "Format pasted BibTeX" },
        ]}
      />
      {mode === "create" ? <CreateMode /> : <ParseMode />}
      <PrivacyNote />
    </div>
  );
}
