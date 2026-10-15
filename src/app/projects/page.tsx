import { PageHero } from "@/components/ui/PageHero";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ProjectVisual } from "@/components/ui/ProjectVisual";
import { ProjectCard, ReferenceBadge } from "@/components/ui/cards";
import { Container, CtaBand, JsonLd } from "@/components/ui/primitives";
import { projects } from "@/content/projects";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "AI projects and reference architectures",
  description:
    "Reference builds showing how we design RAG assistants, AI agents, document automation and LLM evaluation tooling, from architecture to rollout plan.",
  path: "/projects",
});

export default function ProjectsPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "Projects", path: "/projects" }]}
        title="How we build: reference projects."
        intro="Each project below is a reference build: a representative problem worked through in full, from architecture and stack to phased rollout and how success would be measured."
        aside={
          <div className="rounded-2xl bg-accent-soft p-6 text-[0.95rem] text-ink-2">
            <p className="font-medium text-ink">About these examples</p>
            <p className="mt-2">
              They are illustrative scenarios, not client case studies. We do not publish invented client names or
              results. Client work will appear here once it can be shared with permission.
            </p>
          </div>
        }
      />

      <section aria-label="Project gallery" className="py-20 sm:py-28">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            {projects.map((p, i) => (
              <div
                key={p.slug}
                className={i % 3 === 0 ? "md:col-span-2" : ""}
                data-reveal
                style={{ "--i": i % 2 } as React.CSSProperties}
              >
                {i % 3 === 0 ? <WideCard index={i} /> : <ProjectCard project={p} headingLevel="h2" />}
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand title="Have a problem like these?" body="We can usually tell within one conversation whether an AI approach is worth pursuing, and what a first milestone should prove." />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "AI projects and reference architectures",
          url: absoluteUrl("/projects"),
          hasPart: projects.map((p) => ({ "@type": "CreativeWork", name: p.title, url: absoluteUrl(`/projects/${p.slug}`) })),
        }}
      />
    </>
  );
}

/** Full-width feature card used for every third project to vary rhythm. */
function WideCard({ index }: { index: number }) {
  const p = projects[index];
  return (
    <article className="card card-interactive group relative grid overflow-hidden md:grid-cols-[1.15fr_1fr]">
      <div className="order-2 flex flex-col p-7 sm:p-10 md:order-1">
        <div className="flex flex-wrap items-center gap-2">
          <ReferenceBadge kind={p.kind} />
          <span className="text-[0.8125rem] text-muted">{p.sector}</span>
        </div>
        <h2 className="h3 mt-5 sm:text-[2rem]">
          <Link href={`/projects/${p.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {p.title}
          </Link>
        </h2>
        <p className="mt-4 max-w-[52ch] text-ink-2">{p.challenge}</p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {p.stack.slice(0, 5).map((t) => (
            <li key={t} className="chip">
              {t}
            </li>
          ))}
        </ul>
        <p className="arrow-link mt-auto pt-8 text-ink" aria-hidden="true">
          Read the build <Icon name="arrow" size={16} />
        </p>
      </div>
      <div className="order-1 grid min-h-[240px] place-items-center overflow-hidden border-b border-line bg-sunken md:order-2 md:border-b-0 md:border-l">
        <ProjectVisual kind={p.visual} fit="contain" className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
      </div>
    </article>
  );
}
