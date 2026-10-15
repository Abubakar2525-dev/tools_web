import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container } from "@/components/ui/primitives";
import { getTool, toolHref } from "@/content/tools";
import { catalog, catalogHref, toolsInCategory } from "@/content/catalog";
import { categoryHref, getCategory } from "@/content/catalog/categories";
import type { CategorySlug } from "@/content/catalog/types";

const featuredCategories: CategorySlug[] = ["pdf", "image", "text", "developer", "calculators", "converters", "finance", "design"];

export function DeveloperToolsSection() {
  const cats = featuredCategories.map((slug) => getCategory(slug)).filter((c): c is NonNullable<typeof c> => !!c);
  const popular = catalog.filter((t) => t.popular).slice(0, 10);

  return (
    <section aria-labelledby="devtools-title" className="bg-sunken py-24 sm:py-32">
      <Container>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16" data-reveal>
          <h2 id="devtools-title" className="h2 max-w-[16ch]">
            Practical tools for everyday work.
          </h2>
          <div>
            <p className="lead max-w-[46ch]">
              {catalog.length} free tools for PDFs, images, text, code, numbers and documents. Everything is processed on
              your device, with no sign-up.
            </p>
            <ButtonLink href="/tools" arrow className="mt-7">
              Explore all tools
            </ButtonLink>
          </div>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cats.map((c, i) => {
            const tools = toolsInCategory(c.slug);
            return (
              <li key={c.slug} data-reveal style={{ "--i": i % 4 } as React.CSSProperties}>
                <Link href={categoryHref(c.slug)} className="card card-interactive group flex h-full flex-col p-5">
                  <span className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-sunken text-ink-2 transition-colors group-hover:bg-ink group-hover:text-accent-night">
                      <Icon name={c.icon} size={20} />
                    </span>
                    <span className="text-sm tabular-nums text-muted">{tools.length} tools</span>
                  </span>
                  <span className="mt-4 font-display text-[1.15rem] font-semibold tracking-[-0.015em] text-ink">{c.name}</span>
                  <span className="mt-1.5 line-clamp-2 text-sm text-ink-2">{tools.slice(0, 3).map((t) => t.name).join(", ")}</span>
                  <span className="arrow-link mt-auto pt-4 text-sm text-ink">
                    Browse <Icon name="arrow" size={14} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {popular.length > 0 && (
          <div className="mt-10" data-reveal>
            <p className="text-sm text-muted">Popular right now</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {popular.map((t) => (
                <li key={t.slug}>
                  <Link href={catalogHref(t)} className="chip !h-10 !px-4 !text-[0.95rem] transition-colors hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--line-strong)]">
                    <Icon name={t.icon} size={16} className="text-accent-strong" />
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Container>
    </section>
  );
}

const studentPicks = ["cgpa-calculator", "study-planner", "assignment-planner", "pomodoro-timer", "citation-formatter"];

export function StudentToolsSection() {
  const picks = studentPicks.map((s) => getTool("student", s)).filter((t) => t !== undefined);
  const gpa = getTool("student", "gpa-calculator");

  return (
    <section aria-labelledby="student-title" className="relative overflow-hidden py-24 sm:py-32">
      <div aria-hidden="true" className="absolute inset-x-3 inset-y-0 rounded-[22px] bg-accent-soft sm:inset-x-4" />
      <Container className="relative">
        <div className="max-w-[40rem]" data-reveal>
          <h2 id="student-title" className="h2">
            Study smarter. Build your future.
          </h2>
          <p className="lead mt-5">
            Calculate grades, organize assignments, plan study sessions and find practical resources for your learning
            journey.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
          {gpa && (
            <Link href={toolHref(gpa)} className="card card-interactive group flex flex-col p-6 sm:p-8" data-reveal>
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 font-medium">
                  <Icon name={gpa.icon} size={20} className="text-accent-strong" />
                  {gpa.name}
                </span>
                <span className="chip !h-6 !text-[0.75rem]">Configurable scale</span>
              </span>
              <span className="mt-6 block overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]" aria-hidden="true">
                {[
                  ["Data structures", "3 cr", "A", "4.0"],
                  ["Linear algebra", "4 cr", "B+", "3.3"],
                  ["Technical writing", "2 cr", "C", "2.0"],
                ].map((r) => (
                  <span key={r[0]} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-line bg-surface px-4 py-3 text-sm last:border-b-0">
                    <span className="truncate text-ink">{r[0]}</span>
                    <span className="text-muted tabular-nums">{r[1]}</span>
                    <span className="w-6 text-ink">{r[2]}</span>
                    <span className="w-8 text-right tabular-nums text-ink-2">{r[3]}</span>
                  </span>
                ))}
              </span>
              <span className="mt-6 flex items-end justify-between gap-4">
                <span>
                  <span className="block text-sm text-ink-2">Semester GPA</span>
                  <span className="font-display text-[2.75rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">3.24</span>
                </span>
                <span className="text-right text-sm text-muted">
                  29.2 quality points
                  <br />÷ 9 credits
                </span>
              </span>
              <span className="arrow-link mt-8 text-ink">
                Calculate your GPA <Icon name="arrow" size={16} />
              </span>
            </Link>
          )}

          <div className="flex flex-col">
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line)]">
              {picks.map((t, i) => (
                <li key={t.slug} data-reveal style={{ "--i": i } as React.CSSProperties}>
                  <Link href={toolHref(t)} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-sunken">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2 transition-colors group-hover:bg-ink group-hover:text-accent-night">
                      <Icon name={t.icon} size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{t.name}</span>
                      <span className="block truncate text-sm text-muted">{t.summary}</span>
                    </span>
                    <Icon name="arrow" size={18} className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-4" data-reveal>
              <ButtonLink href="/student-tools" arrow>
                Explore student tools
              </ButtonLink>
              <Link href="/student-tools/resources" className="link text-sm">
                Learning roadmaps and guides
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
