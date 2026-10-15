import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { PageHero } from "@/components/ui/PageHero";
import { Container, CtaBand, RichText } from "@/components/ui/primitives";
import { resourceSections } from "@/content/student-resources";
import { studentTools, toolHref } from "@/content/tools";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "AI and software engineering learning roadmaps",
  description:
    "Original AI engineering and software engineering roadmaps, study guides, beginner tutorials, project ideas, interview prep and coding exercises for students.",
  path: "/student-tools/resources",
});

/** EDIT ME: re-check external links periodically; they point to sites we do not control. */
const LINKS_CHECKED = "October 12, 2026";

export default function ResourcesPage() {
  const practiceTool = studentTools.find((t) => t.slug === "coding-practice-planner");
  const studyTool = studentTools.find((t) => t.slug === "study-planner");

  return (
    <>
      <PageHero
        crumbs={[
          { name: "Student tools", path: "/student-tools" },
          { name: "Learning resources", path: "/student-tools/resources" },
        ]}
        title="Learning roadmaps and guides for future engineers."
        intro="Original guides from our engineers on learning AI and software engineering, followed by a short list of trusted external resources. Labels show which is which."
      />

      <Container className="py-14 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[240px_1fr] lg:gap-16">
          <nav aria-labelledby="contents-title" className="lg:sticky lg:top-28 lg:self-start">
            <p id="contents-title" className="text-sm font-medium text-ink">
              Contents
            </p>
            <ol className="mt-4 space-y-1 border-l border-line">
              {resourceSections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-[0.875rem] text-muted transition-colors hover:border-accent hover:text-ink"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
            <div className="mt-8 space-y-2 text-sm">
              {studyTool && (
                <Link href={toolHref(studyTool)} className="link block">
                  Plan it with the study planner
                </Link>
              )}
              {practiceTool && (
                <Link href={toolHref(practiceTool)} className="link block">
                  Track it with the coding practice planner
                </Link>
              )}
            </div>
          </nav>

          <div className="min-w-0 space-y-20">
            {resourceSections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-28">
                <span
                  className={`chip !h-6 !text-[0.75rem] ${s.kind === "external" ? "" : "!bg-accent-soft !text-accent-strong !shadow-none"}`}
                >
                  {s.kind === "external" ? "External resources: third-party sites" : "Original guide by Nuvella Promo Code"}
                </span>
                <h2 id={`${s.id}-title`} className="h2 mt-4 !text-[clamp(1.6rem,1.3rem+1vw,2.1rem)]">
                  {s.title}
                </h2>
                <p className="mt-3 max-w-[62ch] text-ink-2">
                  <RichText text={s.intro} />
                </p>

                {s.items && (
                  <ol className="mt-8 space-y-4">
                    {s.items.map((it, i) => (
                      <li key={it.title} className="card p-6 sm:p-7" data-reveal style={{ "--i": i % 3 } as React.CSSProperties}>
                        <div className="flex gap-4">
                          <span className="font-mono text-xs leading-7 text-accent-strong">{String(i + 1).padStart(2, "0")}</span>
                          <div className="min-w-0">
                            <h3 className="font-display text-[1.2rem] font-semibold leading-snug tracking-[-0.015em]">{it.title}</h3>
                            <p className="mt-2 text-ink-2">
                              <RichText text={it.body} />
                            </p>
                            {it.points && it.points.length > 0 && (
                              <ul className="mt-4 space-y-2 text-[0.95rem] text-ink-2">
                                {it.points.map((pt) => (
                                  <li key={pt} className="flex gap-2.5">
                                    <Icon name="check" size={16} className="mt-1 shrink-0 text-accent" />
                                    <span>
                                      <RichText text={pt} />
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {s.links && (
                  <>
                    <p className="mt-4 text-sm text-muted">
                      These links open independent websites that we do not control or endorse commercially. Links checked{" "}
                      {LINKS_CHECKED}.
                    </p>
                    <ul className="mt-6 divide-y divide-line border-y border-line">
                      {s.links.map((l) => (
                        <li key={l.href}>
                          <a
                            href={l.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group grid gap-1 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
                          >
                            <span>
                              <span className="flex flex-wrap items-baseline gap-x-3">
                                <span className="font-medium text-ink group-hover:text-accent-strong">{l.label}</span>
                                <span className="text-sm text-muted">{l.source}</span>
                              </span>
                              <span className="mt-1 block text-[0.95rem] text-ink-2">{l.note}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-sm text-muted group-hover:text-ink">
                              {new URL(l.href).hostname.replace(/^www\./, "")}
                              <Icon name="external" size={14} />
                              <span className="sr-only">(opens in a new tab)</span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            ))}
          </div>
        </div>
      </Container>

      <CtaBand
        title="Put the roadmap to work."
        body="Plan your week, track practice problems and calculate your grades with our free student tools."
        cta="Explore student tools"
        href="/student-tools"
      />
    </>
  );
}
