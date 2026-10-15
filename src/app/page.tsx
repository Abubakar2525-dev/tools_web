import type { Metadata } from "next";
import Link from "next/link";
import { StrataDiagram } from "@/components/home/StrataDiagram";
import { ProcessTimeline } from "@/components/home/ProcessTimeline";
import { DeveloperToolsSection, StudentToolsSection } from "@/components/home/ToolsSections";
import { ArticleCard, ProjectCard, ServiceRow } from "@/components/ui/cards";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container, CtaBand, FaqList, SectionHeader } from "@/components/ui/primitives";
import { articles, formatDate, readingTime } from "@/content/articles";
import { commitments, homeFaqs, principles, process, techCategories } from "@/content/home";
import { projects } from "@/content/projects";
import { services } from "@/content/services";
import { site } from "@/content/site";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: `${site.name} | AI engineering services and custom AI development` },
  description:
    "AI engineering studio building production-ready LLM applications, AI agents, RAG systems and AI workflow automation, from first prototype to monitored deployment.",
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    title: `${site.name} | From AI possibilities to production-ready systems`,
    description:
      "We engineer AI agents, LLM applications and the data systems beneath them, from first prototype to reliable production.",
    url: absoluteUrl("/"),
  },
};

const groups = ["Build", "Integrate", "Operate"] as const;

export default function HomePage() {
  const [featured, ...restProjects] = projects;
  const [leadArticle, ...moreArticles] = articles;

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <Container className="relative pt-16 sm:pt-24 lg:pt-28">
          <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-end lg:gap-14">
            <h1 id="hero-title" className="display hero-in max-w-[15ch]">
              From AI possibilities to{" "}
              <span className="relative whitespace-nowrap">
                production-ready
                <svg
                  aria-hidden="true"
                  viewBox="0 0 300 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1.5 left-0 h-[0.18em] w-full text-accent"
                >
                  <path d="M2 8 C 80 2, 200 2, 298 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="hero-underline" />
                </svg>
              </span>{" "}
              systems.
            </h1>
            <div className="hero-in pb-2" style={{ "--i": 2 } as React.CSSProperties}>
              <p className="lead max-w-[40ch]">
                We engineer AI agents, LLM applications and the data systems beneath them, from first prototype to
                reliable production.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/contact" arrow>
                  Discuss your project
                </ButtonLink>
                <ButtonLink href="/projects" variant="ghost">
                  Explore our work
                </ButtonLink>
              </div>
            </div>
          </div>

          <div className="hero-in relative mt-14 sm:mt-20" style={{ "--i": 4 } as React.CSSProperties}>
            <div className="card relative overflow-hidden !rounded-[22px] p-4 shadow-lg sm:p-8">
              <div className="mb-5 flex items-center justify-between gap-4 sm:mb-7">
                <p className="font-mono text-xs text-muted">One request, five layers. Illustrative trace.</p>
                <p className="hidden items-center gap-2 font-mono text-xs text-muted sm:flex">
                  <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" /> live path
                </p>
              </div>
              <StrataDiagram />
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------- Commitments strip ---------------- */}
      <section aria-label="How we engineer" className="mt-20 sm:mt-24">
        <Container>
          <ul className="grid gap-px overflow-hidden rounded-2xl bg-line shadow-[0_0_0_1px_var(--line)] sm:grid-cols-2 lg:grid-cols-4">
            {commitments.map((c, i) => (
              <li key={c.title} className="bg-bg p-6 sm:p-7" data-reveal style={{ "--i": i } as React.CSSProperties}>
                <Icon name={c.icon} size={22} className="text-accent" />
                <h2 className="mt-5 font-sans text-[1rem] font-semibold tracking-normal text-ink">{c.title}</h2>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">{c.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ---------------- Services ---------------- */}
      <section aria-labelledby="services-title" className="py-28 sm:py-36">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.6fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start" data-reveal>
            <p className="kicker mb-4">What we build</p>
            <h2 id="services-title" className="h2">
              Engineering for every layer of an AI product.
            </h2>
            <p className="lead mt-5">
              Pick one layer or the whole stack. Every engagement is scoped around a workflow you can measure.
            </p>
            <Link href="/services" className="arrow-link link mt-7 !no-underline">
              Compare all services <Icon name="arrow" size={16} />
            </Link>
          </div>

          <div className="space-y-10">
            {groups.map((g) => (
              <div key={g}>
                <h3 className="flex items-center gap-3 px-3 font-mono text-xs font-normal tracking-normal text-muted sm:px-5">
                  {g}
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </h3>
                <ul className="mt-2">
                  {services
                    .filter((s) => s.group === g && s.featuredOnHome !== false)
                    .map((s, i) => (
                      <ServiceRow key={s.slug} service={s} index={i} />
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ---------------- Projects (bento) ---------------- */}
      <section aria-labelledby="work-title" className="bg-sunken py-24 sm:py-32">
        <Container>
          <SectionHeader
            align="split"
            title={<span id="work-title">Reference builds, documented end to end.</span>}
            intro="Representative systems that show how we approach architecture, evaluation and rollout. They are scenarios, not client case studies, and are labelled that way."
          />
          <div className="mt-14 grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7 lg:row-span-2" data-reveal>
              <ProjectCard project={featured} size="lg" />
            </div>
            {restProjects.slice(0, 2).map((p, i) => (
              <div key={p.slug} className="lg:col-span-5" data-reveal style={{ "--i": i + 1 } as React.CSSProperties}>
                <ProjectCard project={p} />
              </div>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <ButtonLink href="/projects" variant="ghost">
              Explore our work
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* ---------------- Process ---------------- */}
      <section aria-labelledby="process-title" className="bg-night py-24 text-night-ink sm:py-32">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16" data-reveal>
            <div>
              <p className="kicker mb-4 !text-night-muted">How we work</p>
              <h2 id="process-title" className="h2 max-w-[16ch] text-night-ink">
                Five steps from fuzzy idea to measured system.
              </h2>
            </div>
            <p className="lead max-w-[46ch] !text-night-muted">
              Every phase ends in something you can review: a document, a working slice, an eval report or a release.
            </p>
          </div>
          <div className="mt-16 sm:mt-20">
            <ProcessTimeline steps={process} />
          </div>
        </Container>
      </section>

      {/* ---------------- Technology ---------------- */}
      <section aria-labelledby="tech-title" className="py-28 sm:py-36">
        <Container>
          <SectionHeader
            title={<span id="tech-title">Pragmatic, well-supported tools.</span>}
            intro="We pick boring infrastructure on purpose and stay model-agnostic, so your system outlives the current model leaderboard."
          />
          <dl className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {techCategories.map((c, i) => (
              <div key={c.title} className="border-t border-line-strong pt-5" data-reveal style={{ "--i": i % 3 } as React.CSSProperties}>
                <dt className="font-display text-[1.15rem] font-semibold tracking-[-0.015em]">{c.title}</dt>
                <dd className="mt-4 flex flex-wrap gap-2">
                  {c.items.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <DeveloperToolsSection />

      {/* ---------------- Articles ---------------- */}
      <section aria-labelledby="articles-title" className="py-24 sm:py-32">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6" data-reveal>
            <div>
              <p className="kicker mb-4">Articles</p>
              <h2 id="articles-title" className="h2 max-w-[20ch]">
                Field notes from building AI systems.
              </h2>
            </div>
            <Link href="/articles" className="arrow-link link !no-underline">
              All articles <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            <article className="group relative" data-reveal>
              <div className="card overflow-hidden !rounded-[18px] bg-night p-8 text-night-ink sm:p-10">
                <p className="flex flex-wrap gap-x-3 text-[0.8125rem] text-night-muted">
                  <span className="font-medium text-accent-night">{leadArticle.category}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={leadArticle.publishedAt}>{formatDate(leadArticle.publishedAt)}</time>
                  <span aria-hidden="true">·</span>
                  <span>{readingTime(leadArticle)} min read</span>
                </p>
                <h3 className="mt-6 font-display text-[1.75rem] leading-[1.12] tracking-[-0.025em] sm:text-[2.1rem]">
                  <Link href={`/articles/${leadArticle.slug}`} className="after:absolute after:inset-0 after:content-['']">
                    {leadArticle.title}
                  </Link>
                </h3>
                <p className="mt-5 max-w-[52ch] text-night-muted">{leadArticle.description}</p>
                <p className="arrow-link mt-10 text-night-ink" aria-hidden="true">
                  Read article <Icon name="arrow" size={16} />
                </p>
              </div>
            </article>
            <div className="divide-y divide-line border-y border-line">
              {moreArticles.slice(0, 4).map((a, i) => (
                <div key={a.slug} data-reveal style={{ "--i": i } as React.CSSProperties}>
                  <ArticleCard article={a} variant="row" />
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <StudentToolsSection />

      {/* ---------------- Why us ---------------- */}
      <section aria-labelledby="why-title" className="bg-sunken py-24 sm:py-32">
        <Container className="grid gap-14 lg:grid-cols-[0.9fr_1.4fr] lg:gap-20">
          <div data-reveal>
            <h2 id="why-title" className="h2">
              Senior engineering, without the theatre.
            </h2>
            <p className="lead mt-5">
              We treat AI features like any other production system: designed, tested, observable and owned. The
              difference is how much of that work has to happen before launch.
            </p>
          </div>
          <ol className="grid gap-x-10 gap-y-12 sm:grid-cols-2">
            {principles.map((p, i) => (
              <li key={p.title} data-reveal style={{ "--i": i } as React.CSSProperties}>
                <span className="font-mono text-xs text-accent-strong">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="h3 mt-3">{p.title}</h3>
                <p className="mt-3 text-ink-2">{p.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section aria-labelledby="faq-title" className="py-28 sm:py-36">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.6fr] lg:gap-16">
          <div data-reveal>
            <h2 id="faq-title" className="h2">
              Questions we hear early on.
            </h2>
            <p className="mt-5 text-ink-2">
              Something else on your mind?{" "}
              <Link href="/contact" className="link">
                Ask us directly
              </Link>
              .
            </p>
          </div>
          <FaqList faqs={homeFaqs} />
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
