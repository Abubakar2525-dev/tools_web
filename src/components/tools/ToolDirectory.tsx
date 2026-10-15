"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ToolCard, type ToolCardData } from "./ToolCard";

/**
 * Searchable, filterable tool grid. The full list is server-rendered, so every
 * tool link is crawlable; filtering only narrows it on the client.
 */
export function ToolDirectory({
  items,
  categories,
  label,
}: {
  items: ToolCardData[];
  categories: readonly string[];
  label: string;
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const q = useDeferredValue(query.trim().toLowerCase());
  const searchId = useId();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((i) => m.set(i.category, (m.get(i.category) ?? 0) + 1));
    return m;
  }, [items]);

  const visible = useMemo(
    () =>
      items.filter(
        (t) =>
          (cat === "All" || t.category === cat) &&
          (!q || `${t.name} ${t.summary} ${t.category}`.toLowerCase().includes(q)),
      ),
    [items, cat, q],
  );

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {categories.length > 0 ? (
        <div role="group" aria-label={`Filter ${label} by category`} className="-mx-1 flex flex-wrap gap-1.5">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line)] transition-[background-color,color,box-shadow] duration-150 hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--line-strong)] aria-pressed:bg-ink aria-pressed:text-surface aria-pressed:shadow-none"
            >
              {c}
              <span className="text-xs tabular-nums opacity-60">{c === "All" ? items.length : (counts.get(c) ?? 0)}</span>
            </button>
          ))}
        </div>
        ) : (
          <p className="text-sm text-muted">
            {items.length} {items.length === 1 ? "tool" : "tools"}
          </p>
        )}
        <div className="relative lg:w-72">
          <label htmlFor={searchId} className="sr-only">
            Search {label}
          </label>
          <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools"
            className="h-11 w-full rounded-lg bg-surface pl-10 pr-3 text-[0.95rem] shadow-[inset_0_0_0_1px_var(--line-strong)] outline-none transition-shadow placeholder:text-muted focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none"
          />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? "tool" : "tools"} shown
      </p>

      {visible.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
          <Icon name="search" size={24} className="mx-auto text-muted" />
          <p className="mt-3 font-medium">No tools match {query ? <>&ldquo;{query}&rdquo;</> : "this filter"}.</p>
          <p className="mt-1 text-muted">Try another word, or show every category.</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-6"
            onClick={() => {
              setQuery("");
              setCat("All");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <li key={t.href}>
              <ToolCard tool={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
