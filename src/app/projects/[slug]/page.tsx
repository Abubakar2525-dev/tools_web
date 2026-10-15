import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { Icon } from "@/components/ui/Icon";
import { ProjectVisual } from "@/components/ui/ProjectVisual";
import { ReferenceBadge } from "@/components/ui/cards";
import { ButtonLink, Container, CtaBand, JsonLd, RichText } from "@/components/ui/primitives";
import { getProject, projects } from "@/content/projects";
import { getService } from "@/content/services";
import { site } from "@/content/site";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) return {};
  return pageMetadata({ title: p.metaTitle, description: p.metaDescription, path: `/projects/${p.slug}` });
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) notFound();

  const idx = projects.findIndex((x) => x.slug === p.slug);
  const next = projects[(idx + 1) % projects.length];
  const svcs = p.services.map(getService).filter((s) => s !== undefined);

  return (
    <>
      <PageHero
        crumbs={[
          { name: "Projects", path: "/projects" },
          { name: p.title, path: `/projects/${p.slug}` },
        ]}
        title={p.title}
        intro={p.summary}
      >
        <div className="flex flex-wrap items-center gap-3">
          <ReferenceBadge kind={p.kind} />
          <span className="chip">{p.sector}</span>
          {svcs.map((s) => (
            <Link key={s.slug} href={`/services/${s.slug}`} className="chip transition-colors hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--line-strong)]">
              {s.navLabel}
            </Link>
          ))}
        </div>
      </PageHero>

      <Container className="-mt-px">
        {p.kind === "illustrative" && (
          <p className="mt-8 rounded-xl bg-accent-soft px-5 py-4 text-[0.9375rem] text-ink-2">
            <strong className="font-medium text-ink">Reference build.</strong> This is a representative scenario written
            to show our approach. It is not a description of a specific client engagement, and the success criteria below
            are design targets rather than reported results.
          </p>
        )}
        <div className="card mt-8 overflow-hidden !rounded-[22px]" data-reveal>
          <ProjectVisual kind={p.visual} className="aspect-[16/7] w-full" />
        </div>
      </Container>

      {/* Challenge + solution */}
      <section aria-labelledby="challenge-title" className="py-24 sm:py-28">
        <Container className="grid gap-14 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
          <div data-reveal>
            <h2 id="challenge-title" className="h2">
              The problem
            </h2>
            <p className="lead mt-6">
              <RichText text={p.challenge} />
            </p>
          </div>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties}>
            <h2 className="h2">The approach</h2>
            <ul className="mt-6 space-y-5">
              {p.solution.map((s, i) => (
                <li key={i} className="flex gap-4 text-ink-2">
                  <span className="mt-0.5 font-mono text-xs leading-6 text-accent-strong">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <RichText text={s} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* Architecture */}
      <section aria-labelledby="arch-title" className="bg-night py-24 text-night-ink sm:py-28">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6" data-reveal>
            <h2 id="arch-title" className="h2 text-night-ink">
              Architecture
            </h2>
            <p className="max-w-[44ch] text-night-muted">The request and data path, in order. Each stage is observable and testable in isolation.</p>
          </div>
          <ol className="mt-14 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {p.architecture.map((n, i) => (
              <li
                key={n.label}
                className="relative rounded-2xl bg-night-2 p-6 shadow-[inset_0_0_0_1px_var(--night-line)]"
                data-reveal
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-accent-night">stage {i + 1}</span>
                  {i < p.architecture.length - 1 && <Icon name="arrow" size={16} className="text-night-muted" />}
                </div>
                <h3 className="mt-4 font-display text-[1.2rem] tracking-[-0.015em] text-night-ink">{n.label}</h3>
                <p className="mt-2 text-[0.95rem] text-night-muted">
                  <RichText text={n.detail} />
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-12 border-t border-night-line pt-8" data-reveal>
            <h3 className="font-sans text-sm font-medium tracking-normal text-night-ink">Stack</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {p.stack.map((t) => (
                <li key={t} className="rounded-full px-3 py-1.5 text-sm text-night-ink shadow-[inset_0_0_0_1px_var(--night-line)]">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* Phases */}
      <section aria-labelledby="phases-title" className="py-24 sm:py-28">
        <Container>
          <h2 id="phases-title" className="h2" data-reveal>
            Delivery plan
          </h2>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-line shadow-[0_0_0_1px_var(--line)] md:grid-cols-2 lg:grid-cols-4">
            {p.phases.map((ph, i) => (
              <li key={ph.title} className="bg-bg p-7" data-reveal style={{ "--i": i } as React.CSSProperties}>
                <span className="font-mono text-xs text-muted">Phase {i + 1}</span>
                <h3 className="h3 mt-3">{ph.title}</h3>
                <p className="mt-3 text-[0.95rem] text-ink-2">
                  <RichText text={ph.body} />
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Outcomes */}
      <section aria-labelledby="outcomes-title" className="bg-sunken py-24 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.6fr] lg:gap-16">
          <div data-reveal>
            <h2 id="outcomes-title" className="h2">
              {p.kind === "illustrative" ? "How success is measured" : "Results"}
            </h2>
            {p.kind === "illustrative" && (
              <p className="mt-5 text-ink-2">Design targets and evaluation criteria agreed before build, not reported outcomes.</p>
            )}
          </div>
          <ul className="space-y-4">
            {p.outcomes.map((o, i) => (
              <li key={o.title} className="card flex gap-5 p-6 sm:p-7" data-reveal style={{ "--i": i } as React.CSSProperties}>
                <Icon name="check" size={22} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <h3 className="font-sans text-[1.0625rem] font-semibold tracking-normal">{o.title}</h3>
                  <p className="mt-1.5 text-ink-2">
                    <RichText text={o.body} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Next */}
      <section aria-label="Next project" className="py-20">
        <Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href={`/projects/${next.slug}`} className="group">
            <span className="text-sm text-muted">Next reference build</span>
            <span className="mt-2 flex items-center gap-3 font-display text-[1.6rem] font-semibold tracking-[-0.02em] sm:text-[2rem]">
              {next.title}
              <Icon name="arrow" size={24} className="transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
          <ButtonLink href="/contact" variant="ghost">
            {site.primaryCta.label}
          </ButtonLink>
        </Container>
      </section>

      <CtaBand />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: p.title,
          description: p.metaDescription,
          url: absoluteUrl(`/projects/${p.slug}`),
          creator: { "@id": `${site.url}/#organization` },
          keywords: p.stack.join(", "),
        }}
      />
    </>
  );
}
