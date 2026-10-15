"use client";

import { useMemo, useRef, useState } from "react";
import { PrivacyNote, ResetBtn, SelectField, TextField, ToolPanel } from "@/components/tools/kit";
import { CATEGORY_LABEL, ELEMENTS, type Category, type Element } from "./lib/elements";

const HUE: Record<Category, number> = {
  "alkali-metal": 25,
  "alkaline-earth-metal": 65,
  "transition-metal": 250,
  "post-transition-metal": 200,
  metalloid: 165,
  nonmetal: 135,
  halogen: 100,
  "noble-gas": 300,
  lanthanide: 340,
  actinide: 5,
};

const tint = (c: Category, pct = 26) => `color-mix(in oklch, oklch(0.72 0.13 ${HUE[c]}) ${pct}%, var(--surface))`;

/** Grid position: row 1-7 main table, 9-10 f-block rows (row 8 is a spacer). */
function cell(e: Element): { row: number; col: number } {
  if (e.group !== null) return { row: e.period, col: e.group };
  const start = e.period === 6 ? 57 : 89;
  return { row: e.period === 6 ? 9 : 10, col: 3 + (e.number - start) };
}

const POS = new Map(ELEMENTS.map((e) => [e.number, cell(e)]));
const AT = new Map(ELEMENTS.map((e) => [`${cell(e).row}:${cell(e).col}`, e]));

function matches(e: Element, q: string): boolean {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  if (/^\d+$/.test(s)) return e.number === Number(s);
  return e.symbol.toLowerCase() === s || e.name.toLowerCase().includes(s) || (e.alt ?? "").includes(s) || CATEGORY_LABEL[e.category].toLowerCase().includes(s);
}

export default function Tool() {
  const [selected, setSelected] = useState(26);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"all" | Category>("all");
  const refs = useRef(new Map<number, HTMLButtonElement>());

  const visible = useMemo(() => new Set(ELEMENTS.filter((e) => matches(e, query) && (cat === "all" || e.category === cat)).map((e) => e.number)), [query, cat]);
  const filtering = query.trim() !== "" || cat !== "all";
  const el = ELEMENTS[selected - 1];

  const focusEl = (n: number) => {
    setSelected(n);
    refs.current.get(n)?.focus();
  };

  const onKey = (e: React.KeyboardEvent, from: Element) => {
    const p = POS.get(from.number)!;
    const dir: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const row = ELEMENTS.filter((x) => POS.get(x.number)!.row === p.row);
      focusEl((e.key === "Home" ? row[0] : row[row.length - 1]).number);
      return;
    }
    const d = dir[e.key];
    if (!d) return;
    e.preventDefault();
    let r = p.row + d[0];
    let c = p.col + d[1];
    while (r >= 1 && r <= 10 && c >= 1 && c <= 18) {
      const hit = AT.get(`${r}:${c}`);
      if (hit) {
        focusEl(hit.number);
        return;
      }
      r += d[0];
      c += d[1];
    }
  };

  const results = filtering ? ELEMENTS.filter((e) => visible.has(e.number)) : [];

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Periodic table"
        actions={
          <ResetBtn
            onClick={() => {
              setQuery("");
              setCat("all");
              setSelected(26);
            }}
          />
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Search" placeholder="Name, symbol, number or category" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
          <SelectField
            label="Category"
            value={cat}
            onChange={(e) => setCat(e.target.value as "all" | Category)}
            options={[{ value: "all", label: "All categories" }, ...(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))]}
          />
        </div>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {filtering ? `${results.length} element${results.length === 1 ? "" : "s"} match.` : "Use the arrow keys to move between elements; Home and End jump along a row."}
        </p>
        {filtering && results.length > 0 && results.length <= 30 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Matching elements">
            {results.map((e) => (
              <li key={e.number}>
                <button
                  type="button"
                  onClick={() => setSelected(e.number)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent"
                  style={{ background: tint(e.category, 18) }}
                >
                  <span className="font-semibold">{e.symbol}</span> {e.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 overflow-x-auto pb-2" role="region" aria-label="Periodic table grid, scrolls sideways on small screens">
          <div
            role="group"
            aria-label="Periodic table of the elements"
            className="grid min-w-[760px] gap-[3px]"
            style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))", gridTemplateRows: "repeat(7, auto) 12px auto auto" }}
          >
            <div className="pointer-events-none flex items-center text-[0.6875rem] leading-tight text-muted" style={{ gridRow: 9, gridColumn: "1 / span 2" }}>
              Lanthanides 57-70
            </div>
            <div className="pointer-events-none flex items-center text-[0.6875rem] leading-tight text-muted" style={{ gridRow: 10, gridColumn: "1 / span 2" }}>
              Actinides 89-102
            </div>
            {ELEMENTS.map((e) => {
              const p = POS.get(e.number)!;
              const on = visible.has(e.number);
              const isSel = e.number === selected;
              return (
                <div key={e.number} style={{ gridRow: p.row, gridColumn: p.col }}>
                  <button
                    ref={(node) => {
                      if (node) refs.current.set(e.number, node);
                      else refs.current.delete(e.number);
                    }}
                    type="button"
                    tabIndex={isSel ? 0 : -1}
                    aria-label={`${e.name}, ${e.symbol}, atomic number ${e.number}, ${CATEGORY_LABEL[e.category]}${filtering && !on ? ", does not match the filter" : ""}`}
                    aria-pressed={isSel}
                    onClick={() => setSelected(e.number)}
                    onFocus={() => setSelected(e.number)}
                    onKeyDown={(ev) => onKey(ev, e)}
                    className={`flex aspect-[1/1.1] w-full flex-col items-center justify-center rounded-md px-0.5 text-ink transition-opacity duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
                      isSel ? "shadow-[inset_0_0_0_2px_var(--ink)]" : "shadow-[inset_0_0_0_1px_var(--line)]"
                    } ${filtering && !on ? "opacity-25" : ""}`}
                    style={{ background: tint(e.category) }}
                  >
                    <span className="text-[0.625rem] leading-none tabular-nums text-ink-2">{e.number}</span>
                    <span className="text-[1rem] font-semibold leading-tight">{e.symbol}</span>
                    <span className="hidden max-w-full truncate text-[0.5625rem] leading-none text-ink-2 xl:block">{e.weightText}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2" aria-label="Category legend">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <li key={c} className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
              <span aria-hidden="true" className="h-3.5 w-3.5 rounded-sm shadow-[inset_0_0_0_1px_var(--line-strong)]" style={{ background: tint(c, 60) }} />
              {CATEGORY_LABEL[c]}
            </li>
          ))}
        </ul>
      </ToolPanel>

      <ToolPanel title="Element details">
        <div className="grid gap-5 md:grid-cols-[180px_1fr]" aria-live="polite">
          <div className="flex aspect-square flex-col items-center justify-center rounded-xl shadow-[inset_0_0_0_1px_var(--line-strong)]" style={{ background: tint(el.category, 34) }}>
            <span className="text-sm tabular-nums text-ink-2">{el.number}</span>
            <span className="font-display text-[3.25rem] font-semibold leading-none text-ink">{el.symbol}</span>
            <span className="mt-1 text-sm text-ink">{el.name}</span>
            <span className="text-[0.8125rem] tabular-nums text-ink-2">{el.weightText}</span>
          </div>
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-line shadow-[0_0_0_1px_var(--line)] sm:grid-cols-2">
            {[
              ["Name", el.name + (el.alt ? ` (also ${el.alt})` : "")],
              ["Atomic number", String(el.number)],
              ["Standard atomic weight", el.bracketed ? `${el.weightText} (mass number of a long-lived isotope)` : el.weightText],
              ["Category", CATEGORY_LABEL[el.category]],
              ["Group", el.group === null ? "None (f-block series)" : String(el.group)],
              ["Period", String(el.period)],
              ["Block", `${el.block}-block`],
              ["Electron configuration", el.config + (el.predicted ? " (predicted)" : "")],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-4 py-3">
                <dt className="text-[0.8125rem] text-muted">{k}</dt>
                <dd className="mt-0.5 font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {el.predicted && <p className="mt-4 text-sm text-muted">Only a few atoms of this element have ever been made, so its configuration and category are theoretical predictions.</p>}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}
