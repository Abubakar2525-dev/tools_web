"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Btn, CellInput, CellSelect, SelectField, TextField } from "@/components/tools/kit";
import { segsToHtml, plainText, normalizeDoi, type Name, type PartialDate, type Seg, type Source, type SourceType, SOURCE_TYPES } from "../lib/cite";
import { MONTHS } from "../lib/cite/util";

/* ------------------------------------------------------------------ */
/* Clipboard                                                           */
/* ------------------------------------------------------------------ */

/** Copies HTML (keeps italics in Word/Docs) plus plain text; falls back to plain text only. */
export async function copyRich(html: string, text: string): Promise<"rich" | "plain"> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard && "write" in navigator.clipboard) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return "rich";
    } catch {
      /* fall through to plain text */
    }
  }
  await navigator.clipboard.writeText(text);
  return "plain";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Serializes an edited contentEditable element to minimal HTML: text plus <i> runs only. */
function serialize(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node, italic: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = esc(node.textContent ?? "");
      out += italic && t ? `<i>${t}</i>` : t;
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      out += " ";
      return;
    }
    const it = italic || node.tagName === "I" || node.tagName === "EM" || node.style.fontStyle === "italic";
    node.childNodes.forEach((c) => walk(c, it));
    if (node !== root && (node.tagName === "DIV" || node.tagName === "P")) out += " ";
  };
  walk(root, false);
  return out.replace(/<\/i><i>/g, "").trim();
}

function useFlash() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  const flash = (m: string) => {
    setMsg(m);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 1800);
  };
  return [msg, flash] as const;
}

/** Copy buttons for a fixed list of segments (no editing). */
export function CopySegsBtns({ html, text, disabled }: { html: string; text: string; disabled?: boolean }) {
  const [msg, flash] = useFlash();
  return (
    <>
      <Btn
        variant="ghost"
        icon={msg ? "check" : "copy"}
        disabled={disabled || !text}
        onClick={async () => {
          try {
            const how = await copyRich(html, text);
            flash(how === "rich" ? "Copied with italics" : "Copied as text");
          } catch {
            flash("Copy failed");
          }
        }}
      >
        <span aria-live="polite">{msg ?? "Copy"}</span>
      </Btn>
    </>
  );
}

export function RenderSegs({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) => (s.italic ? <i key={i}>{s.text}</i> : <Fragment key={i}>{s.text}</Fragment>))}
    </>
  );
}

/**
 * A formatted citation the user can edit before copying. Italics render as
 * <i>; Ctrl/Cmd+I toggles italics while editing. When the generated text
 * changes, the box resets to the new output.
 */
export function EditableCitation({ label, segs, hanging = false }: { label: string; segs: Seg[]; hanging?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = segsToHtml(segs);
  const [editedFor, setEditedFor] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const edited = editedFor === key;
  const [msg, flash] = useFlash();

  const copy = async (rich: boolean) => {
    const el = ref.current;
    if (!el) return;
    const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    try {
      if (rich) {
        const how = await copyRich(serialize(el), text);
        flash(how === "rich" ? "Copied with italics" : "Copied as text");
      } else {
        await navigator.clipboard.writeText(text);
        flash("Copied as text");
      }
    } catch {
      flash("Copy failed");
    }
  };

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">
          {label} {edited && <span className="font-normal text-muted">(edited)</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {edited && (
            <Btn
              variant="subtle"
              icon="reset"
              onClick={() => {
                setEditedFor(null);
                setVersion((v) => v + 1);
              }}
            >
              Revert
            </Btn>
          )}
          <Btn variant="ghost" icon={msg ? "check" : "copy"} onClick={() => copy(true)} disabled={!segs.length}>
            <span aria-live="polite">{msg ?? "Copy"}</span>
          </Btn>
          <Btn variant="subtle" onClick={() => copy(false)} disabled={!segs.length}>
            Plain text
          </Btn>
        </div>
      </div>
      <div
        key={`${key}#${version}`}
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={`${label} (editable)`}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={() => setEditedFor(key)}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        className={`min-h-[52px] break-words rounded-lg bg-surface px-4 py-3 font-serif text-[1rem] leading-relaxed text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] ${
          hanging ? "pl-10 -indent-6" : ""
        }`}
      >
        <RenderSegs segs={segs} />
      </div>
    </div>
  );
}

export const segsPlain = plainText;

/* ------------------------------------------------------------------ */
/* Source form                                                         */
/* ------------------------------------------------------------------ */

type Show = Partial<Record<"editors" | "container" | "publisher" | "place" | "edition" | "volume" | "issue" | "pages" | "number" | "thesis" | "doi", true>>;

const SHOW: Record<SourceType, Show> = {
  book: { editors: true, publisher: true, place: true, edition: true, doi: true },
  chapter: { editors: true, container: true, publisher: true, place: true, edition: true, pages: true, doi: true },
  journal: { container: true, volume: true, issue: true, pages: true, doi: true },
  webpage: { container: true },
  report: { publisher: true, place: true, number: true, doi: true },
  news: { container: true, volume: true, issue: true, pages: true },
  conference: { editors: true, container: true, publisher: true, place: true, pages: true, doi: true },
  thesis: { publisher: true, place: true, thesis: true, doi: true },
};

const TITLE_LABEL: Record<SourceType, string> = {
  book: "Book title",
  chapter: "Chapter title",
  journal: "Article title",
  webpage: "Page title",
  report: "Report title",
  news: "Article title",
  conference: "Paper title",
  thesis: "Thesis title",
};

const CONTAINER_LABEL: Partial<Record<SourceType, string>> = {
  chapter: "Title of the edited book",
  journal: "Journal name",
  webpage: "Website name",
  news: "Newspaper or magazine",
  conference: "Proceedings or conference name",
};

const PUBLISHER_LABEL: Partial<Record<SourceType, string>> = {
  book: "Publisher",
  chapter: "Publisher",
  report: "Publisher or issuing organization",
  conference: "Publisher",
  thesis: "University",
};

export function NamesEditor({ label, names, onChange, addLabel }: { label: string; names: Name[]; onChange: (n: Name[]) => void; addLabel: string }) {
  const set = (i: number, patch: Partial<Name>) => onChange(names.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= names.length) return;
    const next = [...names];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="mt-2 space-y-2">
        {names.map((n, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-sunken/60 p-2 sm:grid-cols-[8.5rem_1fr_1fr_auto] sm:bg-transparent sm:p-0">
            <CellSelect
              label={`${label} ${i + 1} kind`}
              value={n.org ? "org" : "person"}
              onChange={(e) => set(i, e.target.value === "org" ? { org: true, given: "" } : { org: false })}
              options={[
                { value: "person", label: "Person" },
                { value: "org", label: "Organization" },
              ]}
              className="col-span-2 sm:col-span-1"
            />
            {n.org ? (
              <CellInput label={`${label} ${i + 1} organization name`} placeholder="Organization name" value={n.family} onChange={(e) => set(i, { family: e.target.value })} className="col-span-2 sm:col-span-2" />
            ) : (
              <>
                <CellInput label={`${label} ${i + 1} given names`} placeholder="Given names" value={n.given} onChange={(e) => set(i, { given: e.target.value })} className="col-span-2 sm:col-span-1" />
                <CellInput label={`${label} ${i + 1} family name`} placeholder="Family name" value={n.family} onChange={(e) => set(i, { family: e.target.value })} className="col-span-2 sm:col-span-1" />
              </>
            )}
            <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
              <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-ink-2 hover:bg-sunken disabled:opacity-40" aria-label={`Move ${label.toLowerCase()} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-ink-2 hover:bg-sunken disabled:opacity-40" aria-label={`Move ${label.toLowerCase()} ${i + 1} down`} disabled={i === names.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-danger hover:bg-sunken" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(names.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <Btn variant="subtle" icon="plus" onClick={() => onChange([...names, { given: "", family: "" }])} disabled={names.length >= 60}>
          {addLabel}
        </Btn>
      </div>
    </fieldset>
  );
}

const MONTH_OPTIONS = [{ value: "", label: "Month" }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))];

export function DateInput({ label, value, onChange, hint }: { label: string; value: PartialDate; onChange: (d: PartialDate) => void; hint?: string }) {
  const yearBad = value.year.trim() !== "" && !/^\d{4}[a-z]?$/.test(value.year.trim()) && !/^(in press|forthcoming)$/i.test(value.year.trim());
  const day = Number(value.day);
  const dayBad = value.day.trim() !== "" && (!Number.isInteger(day) || day < 1 || day > 31 || !value.month);
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      {hint && <p className="mt-1 text-[0.8125rem] text-muted">{hint}</p>}
      <div className="mt-2 grid grid-cols-[1fr_1.4fr_1fr] gap-2">
        <CellInput label={`${label}: year`} placeholder="Year" inputMode="numeric" value={value.year} invalid={yearBad} onChange={(e) => onChange({ ...value, year: e.target.value })} />
        <CellSelect label={`${label}: month`} value={value.month} options={MONTH_OPTIONS} onChange={(e) => onChange({ ...value, month: e.target.value })} />
        <CellInput label={`${label}: day`} placeholder="Day" inputMode="numeric" value={value.day} invalid={dayBad} onChange={(e) => onChange({ ...value, day: e.target.value })} />
      </div>
      {(yearBad || dayBad) && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {yearBad ? "Use a four-digit year, or “in press”." : "Day must be 1 to 31 and needs a month."}
        </p>
      )}
    </fieldset>
  );
}

export function SourceForm({ value, onChange, titleHint }: { value: Source; onChange: (s: Source) => void; titleHint?: string }) {
  const s = value;
  const show = SHOW[s.type];
  const set = (patch: Partial<Source>) => onChange({ ...s, ...patch });
  const doiBad = s.doi.trim() !== "" && !normalizeDoi(s.doi);
  return (
    <div className="space-y-5">
      <SelectField label="Source type" value={s.type} onChange={(e) => set({ type: e.target.value as SourceType })} options={SOURCE_TYPES} />
      <NamesEditor
        label={s.type === "book" ? "Authors (leave empty for an edited book)" : "Authors"}
        names={s.authors}
        onChange={(authors) => set({ authors })}
        addLabel="Add author"
      />
      {show.editors && <NamesEditor label="Editors" names={s.editors} onChange={(editors) => set({ editors })} addLabel="Add editor" />}
      <TextField label={TITLE_LABEL[s.type]} hint={titleHint} value={s.title} onChange={(e) => set({ title: e.target.value })} />
      {show.container && <TextField label={CONTAINER_LABEL[s.type] ?? "Container"} value={s.container} onChange={(e) => set({ container: e.target.value })} />}
      {(show.edition || show.volume || show.issue || show.pages || show.number) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {show.edition && <TextField label="Edition" optional hint="A number, e.g. 2. Leave empty for a first edition." value={s.edition} onChange={(e) => set({ edition: e.target.value })} />}
          {show.volume && <TextField label="Volume" optional value={s.volume} onChange={(e) => set({ volume: e.target.value })} />}
          {show.issue && <TextField label="Issue" optional value={s.issue} onChange={(e) => set({ issue: e.target.value })} />}
          {show.pages && <TextField label="Pages" optional placeholder="45-67" hint="A range, a single page, or an article number." value={s.pages} onChange={(e) => set({ pages: e.target.value })} />}
          {show.number && <TextField label="Report number" optional value={s.number} onChange={(e) => set({ number: e.target.value })} />}
        </div>
      )}
      {show.thesis && (
        <SelectField
          label="Degree"
          value={s.thesisType}
          onChange={(e) => set({ thesisType: e.target.value as "phd" | "masters" })}
          options={[
            { value: "phd", label: "Doctoral (PhD) dissertation" },
            { value: "masters", label: "Master’s thesis" },
          ]}
        />
      )}
      {(show.publisher || show.place) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {show.publisher && <TextField label={PUBLISHER_LABEL[s.type] ?? "Publisher"} optional value={s.publisher} onChange={(e) => set({ publisher: e.target.value })} />}
          {show.place && <TextField label="Place of publication" optional hint="Used by Harvard, IEEE and Chicago." value={s.place} onChange={(e) => set({ place: e.target.value })} />}
        </div>
      )}
      <DateInput
        label="Publication date"
        value={s.date}
        onChange={(date) => set({ date })}
        hint={s.type === "webpage" || s.type === "news" ? "Full date if shown. Leave empty if the page has no date." : "Year is enough for most sources."}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {show.doi && (
          <TextField label="DOI" optional placeholder="10.1000/xyz123" value={s.doi} onChange={(e) => set({ doi: e.target.value })} error={doiBad ? "Not a DOI. It should start with 10." : null} />
        )}
        <TextField label="URL" optional placeholder="https://" inputMode="url" value={s.url} onChange={(e) => set({ url: e.target.value })} />
      </div>
      <DateInput label="Accessed date" value={s.accessed} onChange={(accessed) => set({ accessed })} hint="For online sources without a fixed date (MLA, Harvard, IEEE and APA use it)." />
    </div>
  );
}
