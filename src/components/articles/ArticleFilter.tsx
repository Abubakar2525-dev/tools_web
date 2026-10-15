"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { ArticleCover } from "@/components/articles/ArticleVisuals";
import { Icon } from "@/components/ui/Icon";

export type ArticleSummary = {
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  date: string;
  minutes: number;
};

export function ArticleFilter({ items, categories }: { items: ArticleSummary[]; categories: string[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("All");
  const q = useDeferredValue(query.trim().toLowerCase());
  const searchId = useId();

  const visible = useMemo(
    () =>
      items.filter(
        (article) =>
          (cat === "All" || article.category === cat) &&
          (!q || `${article.title} ${article.description} ${article.category}`.toLowerCase().includes(q)),
      ),
    [items, cat, q],
  );

  const isDefaultView = cat === "All" && !q;

  return (
    <div>
      <div className="grid gap-7 pb-9 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:gap-16">
        <div>
          <p className="kicker mb-3">Explore the archive</p>
          <h2 className="h2">Browse the field notes.</h2>
          <p className="mt-4 max-w-[42ch] text-ink-2">
            Search practical guidance by topic, from retrieval quality and agent safety to production cost and data readiness.
          </p>
        </div>

        <div className="rounded-[18px] border border-line bg-surface p-3 shadow-sm sm:p-4">
          <label htmlFor={searchId} className="mb-2.5 block px-1 font-mono text-[0.68rem] font-medium uppercase tracking-[0.08em] text-muted">
            Search the archive
          </label>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 grid w-12 place-items-center text-muted transition-colors group-focus-within:text-accent-strong">
              <Icon name="search" size={20} />
            </span>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                  event.currentTarget.blur();
                }
              }}
              style={{ height: 53 }}
              placeholder="Search titles, topics, and keywords..."
              className="w-full rounded-xl bg-bg-sunken pl-12 pr-12 text-base text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] outline-none transition-[background-color,box-shadow] placeholder:text-muted hover:bg-bg focus-visible:bg-surface focus-visible:shadow-[inset_0_0_0_2px_var(--accent),0_0_0_4px_var(--accent-soft)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                <Icon name="close" size={17} />
              </button>
            )}
          </div>

          <div className="mt-4 border-t border-line px-1 pt-4 sm:flex sm:items-center sm:gap-6">
            <span className="mb-2 block shrink-0 font-mono text-[0.68rem] font-medium uppercase tracking-[0.08em] text-muted sm:mb-0">
              Topics
            </span>
            <div role="group" aria-label="Filter articles by category" className="flex flex-wrap gap-2">
              {["All", ...categories].map((category) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={cat === category}
                  onClick={() => setCat(category)}
                  className="h-9 rounded-full bg-bg px-3.5 text-[0.8125rem] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line)] transition-[background-color,color,box-shadow,transform] duration-150 hover:-translate-y-px hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--line-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-pressed:bg-ink aria-pressed:text-surface aria-pressed:shadow-none"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!isDefaultView && (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            className="link text-sm"
            onClick={() => {
              setQuery("");
              setCat("All");
            }}
          >
            Reset search
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-10 rounded-[18px] border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-strong" aria-hidden="true">
            <Icon name="search" size={22} />
          </span>
          <h3 className="h3 mt-5">No matching field notes.</h3>
          <p className="mx-auto mt-3 max-w-[42ch] text-muted">
            Try a broader keyword, choose another topic, or return to the complete article archive.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-7"
            onClick={() => {
              setQuery("");
              setCat("All");
            }}
          >
            Show all articles
          </button>
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((article, index) => {
            const featured = isDefaultView && index === 0;
            return (
              <li
                key={article.slug}
                className={featured ? "lg:col-span-2" : ""}
                data-reveal
                style={{ "--i": index % 3 } as React.CSSProperties}
              >
                <article className="articlesArticleCard group relative flex flex-col">
                  <ArticleCover category={article.category} index={items.findIndex((item) => item.slug === article.slug)} featured={featured} />
                  <div className={`flex flex-1 flex-col ${featured ? "p-7 sm:p-8" : "p-6"}`}>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] text-muted">
                      <span className="font-medium text-accent-strong">{article.category}</span>
                      <span aria-hidden="true">/</span>
                      <time dateTime={article.publishedAt}>{article.date}</time>
                      <span aria-hidden="true">/</span>
                      <span>{article.minutes} min read</span>
                    </p>
                    <h3 className={`mt-4 font-display leading-[1.16] tracking-[-0.025em] ${featured ? "text-[1.8rem] sm:text-[2.05rem]" : "text-[1.42rem]"}`}>
                      {article.title}
                    </h3>
                    <p className={`mt-4 text-[0.95rem] leading-relaxed text-ink-2 ${featured ? "max-w-[66ch]" : ""}`}>
                      {article.description}
                    </p>
                    <p className="arrow-link mt-7 text-ink" aria-hidden="true">
                      Read article <Icon name="arrow" size={16} />
                    </p>
                  </div>
                  <Link href={`/articles/${article.slug}`} className="absolute inset-0 rounded-[18px] focus-visible:outline-offset-[-4px]">
                    <span className="sr-only">Read article: {article.title}</span>
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
