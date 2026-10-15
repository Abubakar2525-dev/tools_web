import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { Icon } from "@/components/ui/Icon";
import { ArticleCard, ProjectCard } from "@/components/ui/cards";
import { ServiceIllustration } from "@/components/services/ServiceIllustration";
import { ButtonLink, Container, CtaBand, FaqList, JsonLd, RichText } from "@/components/ui/primitives";
import { getService, services } from "@/content/services";
import { getProject } from "@/content/projects";
import { getArticle } from "@/content/articles";
import { site } from "@/content/site";
import { pageMetadata, serviceLd } from "@/lib/seo";

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) return {};
  return pageMetadata({ title: s.metaTitle, description: s.metaDescription, path: `/services/${s.slug}` });
}

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) notFound();

  const related = s.relatedProjects.map(getProject).filter((p) => p !== undefined);
  const reading = s.relatedArticles.map(getArticle).filter((a) => a !== undefined);
  const others = services.filter((o) => o.slug !== s.slug && o.group === s.group).slice(0, 3);
  const fallbackOthers = others.length ? others : services.filter((o) => o.slug !== s.slug).slice(0, 3);
  const benefits = s.deliverables.slice(0, 4).map((deliverable, index) => ({
    title: deliverable,
    body: `A concrete part of the engagement designed to address ${s.problems[index % s.problems.length].title.toLowerCase()}, with a reviewable output rather than an undocumented promise.`,
  }));
  const useCases = s.integrations.slice(0, 4).map((integration, index) => ({
    title: integration,
    body: `${s.navLabel} can connect this part of the operating environment through ${s.stack[index % s.stack.length]}, with ownership, error handling and handover made explicit.`,
  }));

  return (
    <>
      <PageHero
        crumbs={[
          { name: "Services", path: "/services" },
          { name: s.navLabel, path: `/services/${s.slug}` },
        ]}
        title={s.h1}
        intro={<RichText text={s.intro} />}
        aside={<ServiceIllustration service={s} />}
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/contact" arrow>
            {site.primaryCta.label}
          </ButtonLink>
          <ButtonLink href="#approach" variant="ghost">
            See the approach
          </ButtonLink>
        </div>
      </PageHero>

      {/* Overview */}
      <section id="overview" aria-labelledby="overview-title" className="py-20 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.3fr] lg:gap-20">
          <div data-reveal>
            <p className="kicker mb-4">Service overview</p>
            <h2 id="overview-title" className="h2 max-w-[15ch]">A practical route from need to working system</h2>
          </div>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties}>
            <p className="lead">{s.summary}</p>
            <p className="mt-5 max-w-[62ch] text-ink-2">
              The engagement is planned around the specific constraints behind <strong className="font-medium text-ink">{s.primaryKeyword}</strong>.
              Architecture, implementation and validation stay connected, so the result can fit the systems your team already operates.
            </p>
            <div className="mt-7 flex flex-wrap gap-2" aria-label="Related capabilities">
              {s.secondaryKeywords.slice(0, 4).map((keyword) => <span key={keyword} className="chip">{keyword}</span>)}
            </div>
          </div>
        </Container>
      </section>

      {/* Problems */}
      <section aria-labelledby="problems-title" className="bg-sunken py-24 sm:py-28">
        <Container>
          <h2 id="problems-title" className="h2 max-w-[20ch]" data-reveal>
            Problems this solves
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-line shadow-[0_0_0_1px_var(--line)] md:grid-cols-2">
            {s.problems.map((p, i) => (
              <div key={p.title} className="bg-surface p-7 sm:p-9" data-reveal style={{ "--i": i } as React.CSSProperties}>
                <h3 className="h3">{p.title}</h3>
                <p className="mt-3 text-ink-2">
                  <RichText text={p.body} />
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Deliverables + benefits */}
      <section aria-labelledby="offer-title" className="py-24 sm:py-28">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-16" data-reveal>
            <div>
              <p className="kicker mb-4">What we deliver</p>
              <h2 id="offer-title" className="h2 max-w-[16ch]">Deliverables and practical benefits</h2>
            </div>
            <p className="lead max-w-[50ch] lg:justify-self-end">
              Each item is reviewable during delivery and documented for the people who will own it next.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {benefits.map((benefit, index) => (
              <article key={benefit.title} className="card relative overflow-hidden p-7 sm:p-8" data-reveal style={{ "--i": index } as React.CSSProperties}>
                <span className="font-mono text-xs text-accent-strong">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="h3 mt-5">{benefit.title}</h3>
                <p className="mt-3 text-ink-2">{benefit.body}</p>
              </article>
            ))}
          </div>
          {s.deliverables.length > benefits.length && (
            <ul className="mt-6 grid gap-3 rounded-2xl border border-line p-6 sm:grid-cols-2 sm:p-7">
              {s.deliverables.slice(benefits.length).map((deliverable) => (
                <li key={deliverable} className="flex gap-2.5 text-ink-2">
                  <Icon name="check" size={18} className="mt-[3px] shrink-0 text-accent" />
                  <RichText text={deliverable} />
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>

      {/* Approach */}
      <section id="approach" aria-labelledby="approach-title" className="bg-night py-24 text-night-ink sm:py-28">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-end lg:gap-16" data-reveal>
            <div>
              <p className="kicker mb-4 !text-accent-night">Delivery approach</p>
              <h2 id="approach-title" className="h2 max-w-[15ch] text-night-ink">
                How we implement it
              </h2>
            </div>
            <p className="lead max-w-[52ch] !text-night-muted lg:justify-self-end">
              Four stages, each ending in something reviewable. Scope and sequencing adapt to your data and constraints.
            </p>
          </div>

          <ol className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {s.approach.map((a, i) => (
              <li
                key={a.title}
                className="group relative flex min-h-[270px] flex-col overflow-hidden rounded-2xl bg-night-2 p-7 text-night-ink shadow-[inset_0_0_0_1px_var(--night-line)] transition-transform duration-200 hover:-translate-y-1 motion-reduce:transform-none sm:p-8"
                data-reveal
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-accent opacity-70 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                <div className="flex items-center justify-between gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-night font-mono text-sm font-medium text-accent-night shadow-[inset_0_0_0_1px_var(--night-line)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-night-muted">Step {i + 1}</span>
                </div>
                <h3 className="h3 mt-8 text-night-ink">{a.title}</h3>
                <p className="mt-3 text-[0.98rem] leading-relaxed text-night-muted">
                  <RichText text={a.body} />
                </p>
                <div className="mt-auto flex items-center gap-2 pt-7 text-accent-night" aria-hidden="true">
                  <span className="h-px flex-1 bg-night-line" />
                  <Icon name="arrow" size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Use cases */}
      <section aria-labelledby="use-cases-title" className="bg-sunken py-24 sm:py-28">
        <Container>
          <div className="max-w-[48rem]" data-reveal>
            <p className="kicker mb-4">Where it fits</p>
            <h2 id="use-cases-title" className="h2">Common systems and use cases</h2>
            <p className="lead mt-5">Typical connection points for {s.navLabel.toLowerCase()}; the final shape follows your actual workflow and constraints.</p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-line shadow-[0_0_0_1px_var(--line)] sm:grid-cols-2 lg:grid-cols-4">
            {useCases.map((useCase, index) => (
              <article key={useCase.title} className="bg-bg p-6 sm:p-7" data-reveal style={{ "--i": index } as React.CSSProperties}>
                <Icon name={s.icon} size={22} className="text-accent-strong" />
                <h3 className="mt-6 font-medium text-ink">{useCase.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{useCase.body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* Why Backendz */}
      <section aria-labelledby="why-title" className="py-24 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.4fr] lg:gap-20">
          <div data-reveal>
            <p className="kicker mb-4">Why Backendz</p>
            <h2 id="why-title" className="h2 max-w-[14ch]">Built for clarity and ownership</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <article data-reveal>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-strong"><Icon name="layers" size={20} /></span>
              <h3 className="mt-5 font-medium text-ink">Fit before fashion</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">We select from tools such as {s.stack.slice(0, 3).join(", ")} only when they fit the service and operating context.</p>
            </article>
            <article data-reveal style={{ "--i": 1 } as React.CSSProperties}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-strong"><Icon name="check" size={20} /></span>
              <h3 className="mt-5 font-medium text-ink">Reviewable progress</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">Work moves from &quot;{s.approach[0].title}&quot; through &quot;{s.approach.at(-1)?.title},&quot; with decisions and outputs visible along the way.</p>
            </article>
            <article data-reveal style={{ "--i": 2 } as React.CSSProperties}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-strong"><Icon name="workflow" size={20} /></span>
              <h3 className="mt-5 font-medium text-ink">A usable handover</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">Documentation and ownership are part of delivery, so {s.navLabel.toLowerCase()} does not depend on hidden knowledge.</p>
            </article>
          </div>
        </Container>
      </section>

      {/* Stack + integrations */}
      <section aria-labelledby="stack-title" className="py-24 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div data-reveal>
            <h2 id="stack-title" className="h2">
              Typical technology
            </h2>
            <p className="mt-4 max-w-[48ch] text-ink-2">
              A starting point, not a mandate. We fit the stack to your team, hosting and compliance needs.
            </p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {s.stack.map((t) => (
                <li key={t} className="chip !h-9 !px-3.5 !text-[0.9rem]">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties}>
            <h2 className="h2">Common integrations</h2>
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {s.integrations.map((t) => (
                <li key={t} className="flex items-center justify-between py-4 text-ink-2">
                  {t}
                  <Icon name="workflow" size={18} className="text-muted" />
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* Related */}
      {(related.length > 0 || reading.length > 0) && (
        <section aria-labelledby="related-title" className="bg-sunken py-24 sm:py-28">
          <Container>
            <h2 id="related-title" className="h2" data-reveal>
              Related work and reading
            </h2>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {related.map((p, i) => (
                <div key={p.slug} data-reveal style={{ "--i": i } as React.CSSProperties}>
                  <ProjectCard project={p} />
                </div>
              ))}
              {reading.map((a, i) => (
                <div key={a.slug} data-reveal style={{ "--i": i + related.length } as React.CSSProperties}>
                  <ArticleCard article={a} />
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="bg-sunken py-24 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.6fr] lg:gap-16">
          <div data-reveal>
            <h2 id="faq-title" className="h2">
              {s.navLabel}: common questions
            </h2>
            <p className="mt-5 text-ink-2">Related services:</p>
            <ul className="mt-3 space-y-2">
              {fallbackOthers.map((o) => (
                <li key={o.slug}>
                  <Link href={`/services/${o.slug}`} className="link">
                    {o.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <FaqList faqs={s.faqs} />
        </Container>
      </section>

      <CtaBand
        title={`Planning ${s.navLabel.toLowerCase()}?`}
        body="Tell us about the workflow and constraints. We will reply with a candid view of feasibility and a sensible first milestone."
      />

      <JsonLd
        data={serviceLd({
          name: s.title,
          description: s.metaDescription,
          path: `/services/${s.slug}`,
          serviceType: s.primaryKeyword,
        })}
      />
    </>
  );
}
