import { ProcessTimeline } from "@/components/home/ProcessTimeline";
import { Icon } from "@/components/ui/Icon";
import { PageHero } from "@/components/ui/PageHero";
import { ButtonLink, Container, CtaBand } from "@/components/ui/primitives";
import { principles, process } from "@/content/home";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About our AI engineering studio",
  description:
    "Nuvella Promo Code is an AI engineering studio focused on production systems: evaluated, observable and maintainable LLM applications, agents and data pipelines.",
  path: "/about",
});

/**
 * EDIT ME: the story below describes intent and working style only. Add real
 * founding details, team members and credentials when you are ready to publish
 * them. Do not add invented history or people.
 */
const roles = [
  {
    title: "Technical lead",
    body: "Owns the architecture and is your day-to-day counterpart. Writes code, not just slides.",
    icon: "layers" as const,
  },
  {
    title: "AI / ML engineer",
    body: "Retrieval, prompting, evaluation and model selection, measured against your test sets.",
    icon: "llm" as const,
  },
  {
    title: "Product engineer",
    body: "Interfaces, APIs and integrations that make the AI part usable inside real workflows.",
    icon: "app" as const,
  },
  {
    title: "Data and platform engineer",
    body: "Pipelines, permissions, deployment and observability, brought in when the project needs them.",
    icon: "data" as const,
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "About", path: "/about" }]}
        title="We build the unglamorous half of AI products."
        intro={`${site.name} is an AI engineering studio. A demo takes an afternoon; we focus on everything after it: evaluation, integration, security and the operational work that lets a model-powered feature earn trust.`}
      />

      <section aria-labelledby="story-title" className="py-24 sm:py-32">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.4fr] lg:gap-20">
          <h2 id="story-title" className="h2" data-reveal>
            Why we exist
          </h2>
          <div className="space-y-6 text-[1.125rem] leading-relaxed text-ink-2" data-reveal style={{ "--i": 1 } as React.CSSProperties}>
            <p>
              Language models made it easy to build something impressive and hard to build something dependable. Many
              teams reach a convincing prototype quickly, then stall: answers drift, costs climb, nobody can say whether
              last week&rsquo;s prompt change helped, and security review raises questions no one planned for.
            </p>
            <p>
              We started {site.name} to work on that second half. Our approach is ordinary software engineering applied
              to a new kind of component: clear requirements, measured quality, small reversible releases and systems
              your own engineers can understand and change.
            </p>
            <p>
              That also means saying when AI is the wrong tool. A deterministic workflow, a better search index or a
              cleaner data model is sometimes the higher-value answer, and we would rather tell you that up front.
            </p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="philosophy-title" className="bg-sunken py-24 sm:py-32">
        <Container>
          <h2 id="philosophy-title" className="h2 max-w-[20ch]" data-reveal>
            Engineering philosophy
          </h2>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-line shadow-[0_0_0_1px_var(--line)] md:grid-cols-2">
            {principles.map((p, i) => (
              <div key={p.title} className="bg-bg p-8 sm:p-10" data-reveal style={{ "--i": i } as React.CSSProperties}>
                <span className="font-mono text-xs text-accent-strong">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="h3 mt-3">{p.title}</h3>
                <p className="mt-3 text-ink-2">{p.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="process-title" className="bg-night py-24 text-night-ink sm:py-32">
        <Container>
          <h2 id="process-title" className="h2 max-w-[18ch] text-night-ink" data-reveal>
            How an engagement runs
          </h2>
          <div className="mt-16">
            <ProcessTimeline steps={process} />
          </div>
        </Container>
      </section>

      <section aria-labelledby="team-title" className="py-24 sm:py-32">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16" data-reveal>
            <h2 id="team-title" className="h2 max-w-[18ch]">
              Who you work with
            </h2>
            <p className="lead max-w-[46ch]">
              Small, senior teams shaped around the problem. You talk to the people writing the code, and the team grows
              or shrinks with the phase of work.
            </p>
          </div>
          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((r, i) => (
              <li key={r.title} className="card p-7" data-reveal style={{ "--i": i } as React.CSSProperties}>
                <Icon name={r.icon} size={24} className="text-accent" />
                <h3 className="mt-6 font-sans text-[1.0625rem] font-semibold tracking-normal">{r.title}</h3>
                <p className="mt-2 text-[0.95rem] text-ink-2">{r.body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-14 flex flex-wrap items-center gap-4" data-reveal>
            <ButtonLink href="/contact" arrow>
              {site.primaryCta.label}
            </ButtonLink>
            <ButtonLink href="/projects" variant="ghost">
              Explore our work
            </ButtonLink>
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
