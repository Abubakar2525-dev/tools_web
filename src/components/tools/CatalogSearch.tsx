"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { Icon, type AnyIcon } from "@/components/ui/Icon";

export type SearchItem = { href: string; name: string; summary: string; category: string; icon: AnyIcon; keyword: string };

/**
 * Search across the whole catalog. When the query is empty, the server-rendered
 * category overview (children) shows instead, so every link stays crawlable.
 */
export function CatalogSearch({ items, children }: { items: SearchItem[]; children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const id = useId();

  const results = useMemo(() => {
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    return items
      .map((t) => {
        const name = t.name.toLowerCase();
        const hay = `${name} ${t.summary.toLowerCase()} ${t.category.toLowerCase()} ${t.keyword.toLowerCase()}`;
        if (!terms.every((term) => hay.includes(term))) return null;
        const score = (name.startsWith(q) ? 3 : 0) + (name.includes(q) ? 2 : 0) + terms.filter((term) => name.includes(term)).length;
        return { t, score };
      })
      .filter((x): x is { t: SearchItem; score: number } => x !== null)
      .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name))
      .map((x) => x.t);
  }, [items, q]);

  return (
    <div>
      <div className="relative mx-auto max-w-2xl">
        <label htmlFor={id} className="sr-only">
          Search all tools
        </label>
        <Icon name="search" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${items.length} tools, e.g. "merge pdf" or "loan"`}
          className="h-14 w-full rounded-xl bg-surface pl-12 pr-4 text-[1.05rem] shadow-[inset_0_0_0_1px_var(--line-strong),var(--shadow-md)] outline-none transition-shadow placeholder:text-muted focus-visible:shadow-[inset_0_0_0_2px_var(--accent),var(--shadow-md)]"
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {q ? `${results.length} ${results.length === 1 ? "tool" : "tools"} found` : ""}
      </p>

      {q ? (
        <div className="mt-10">
          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
              <Icon name="search" size={24} className="mx-auto text-muted" />
              <p className="mt-3 font-medium">No tools match &ldquo;{query}&rdquo;.</p>
              <p className="mt-1 text-muted">Try a shorter or different word, or browse the categories.</p>
              <button type="button" className="btn btn-ghost btn-sm mt-6" onClick={() => setQuery("")}>
                Clear search
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                {results.length} {results.length === 1 ? "result" : "results"}
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.slice(0, 60).map((t) => (
                  <li key={t.href}>
                    <Link href={t.href} className="group flex h-full gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)] transition-shadow hover:shadow-md">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2 transition-colors group-hover:bg-ink group-hover:text-accent-night">
                        <Icon name={t.icon} size={20} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">{t.name}</span>
                        <span className="block text-xs text-muted">{t.category}</span>
                        <span className="mt-1 line-clamp-2 text-sm text-ink-2">{t.summary}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {results.length > 60 && <p className="mt-4 text-sm text-muted">Showing the first 60. Add another word to narrow the results.</p>}
            </>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
