import Link from "next/link";
import { ToolDirectory } from "@/components/tools/ToolDirectory";
import { Icon } from "@/components/ui/Icon";
import { PageHero } from "@/components/ui/PageHero";
import { ButtonLink, Container, CtaBand, JsonLd } from "@/components/ui/primitives";
import { resourceSections } from "@/content/student-resources";
import {
  studentCatalog,
  studentCategories,
  studentCategoryHref,
  studentToolHref,
  studentToolsInCategory,
} from "@/content/student-catalog";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: `${studentCatalog.length} useful student tools for study and learning`,
  description:
    `Explore ${studentCatalog.length} practical browser-based student tools for writing, citations, math, science, grades, productivity, careers and coding.`,
  path: "/student-tools",
});

export default function StudentToolsPage() {
  const items = [
    ...studentCatalog.map((tool) => ({
      href: studentToolHref(tool.slug),
      name: tool.name,
      summary: tool.source.summary,
      category: tool.categoryInfo.name,
      icon: tool.source.icon,
    })),
  ];

  return (
    <>
      <PageHero
        crumbs={[{ name: "Student tools", path: "/student-tools" }]}
        title={`${studentCatalog.length} useful tools for learning, planning and building.`}
        intro="A focused student toolkit for writing, research, math, science, grades, productivity, finance, careers and coding. Every tool works in your browser without an account."
        aside={
          <div className="rounded-2xl bg-accent-soft p-6 text-[0.95rem] text-ink-2">
            <p className="font-medium text-ink">{studentCategories.length} subjects, {studentCatalog.length} useful tools</p>
            <p className="mt-2">
              Search the curated directory or narrow it by subject. We keep the tools students are most likely to use
              and leave out repetitive or highly specialized entries.
            </p>
          </div>
        }
      />

      <section aria-labelledby="student-categories-title" className="border-b border-line py-14 sm:py-20">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker mb-3">Browse by subject</p>
              <h2 id="student-categories-title" className="h2 !text-[1.85rem]">Student tool categories</h2>
            </div>
            <p className="text-sm text-muted">{studentCategories.length} categories · {studentCatalog.length} tools</p>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {studentCategories.map((category, index) => (
              <li key={category.slug} data-reveal style={{ "--i": index % 3 } as React.CSSProperties}>
                <Link href={studentCategoryHref(category.slug)} className="card card-interactive flex h-full items-start gap-4 p-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2">
                    <Icon name={category.icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline justify-between gap-3 font-medium text-ink">
                      {category.name}
                      <span className="font-mono text-xs text-muted">{studentToolsInCategory(category.slug).length}</span>
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">{category.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-label="Student tool directory" className="py-14 sm:py-20">
        <Container>
          <ToolDirectory items={items} categories={studentCategories.map((category) => category.name)} label="student tools" />
        </Container>
      </section>

      <section aria-labelledby="resources-title" className="bg-sunken py-20 sm:py-28">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16" data-reveal>
            <h2 id="resources-title" className="h2 max-w-[18ch]">
              Learning resources for students and junior developers
            </h2>
            <p className="lead max-w-[48ch]">
              Original roadmaps and guides written by our engineers, plus a short list of trusted external courses.
              Each section is labelled so you know which is which.
            </p>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {resourceSections.map((r, i) => (
              <li key={r.id} data-reveal style={{ "--i": i % 4 } as React.CSSProperties}>
                <Link
                  href={`/student-tools/resources#${r.id}`}
                  className="card card-interactive group flex h-full flex-col p-5"
                >
                  <span
                    className={`chip !h-6 self-start !text-[0.75rem] ${r.kind === "external" ? "" : "!bg-accent-soft !text-accent-strong !shadow-none"}`}
                  >
                    {r.kind === "external" ? "External links" : "Original guide"}
                  </span>
                  <span className="mt-4 font-display text-[1.1rem] font-semibold leading-snug tracking-[-0.015em] text-ink">
                    {r.title}
                  </span>
                  <span className="mt-2 line-clamp-3 text-sm text-ink-2">{r.intro}</span>
                  <span className="arrow-link mt-auto pt-5 text-sm text-ink">
                    Read <Icon name="arrow" size={14} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10" data-reveal>
            <ButtonLink href="/student-tools/resources" variant="ghost">
              All learning resources
            </ButtonLink>
          </div>
        </Container>
      </section>

      <CtaBand
        title="Learning AI engineering?"
        body="Our engineering notes cover retrieval, agents, evaluation and security at a practical, implementation level."
        cta="Read the engineering notes"
        href="/articles"
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Free student tools",
          url: absoluteUrl("/student-tools"),
          hasPart: studentCatalog.map((tool) => ({
            "@type": "WebApplication",
            name: tool.name,
            url: absoluteUrl(studentToolHref(tool.slug)),
          })),
        }}
      />
    </>
  );
}
