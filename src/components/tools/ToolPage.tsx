import Link from "next/link";
import type { ComponentType } from "react";
import { Icon } from "@/components/ui/Icon";
import { Breadcrumbs, Container, CtaBand, FaqList, JsonLd, RichText } from "@/components/ui/primitives";
import type { ToolMeta } from "@/content/tool-types";
import { getTool, toolHref, toolSections } from "@/content/tools";
import { site } from "@/content/site";
import { absoluteUrl } from "@/lib/seo";
import { ToolCard } from "./ToolCard";

/** Shared layout for every individual tool page (engineering and student). */
export function ToolPage({
  tool,
  Component,
  relatedTools,
  categoryHref,
}: {
  tool: ToolMeta;
  Component: ComponentType;
  relatedTools?: ToolMeta[];
  categoryHref?: string;
}) {
  const section = toolSections[tool.kind];
  const related = relatedTools ?? tool.related.map((s) => getTool(tool.kind, s)).filter((t) => t !== undefined);
  const path = toolHref(tool);

  return (
    <>
      <section className="page-hero relative border-b border-line">
        <Container className="relative pb-10 pt-10 sm:pb-12 sm:pt-14">
          <div className="hero-in">
            <Breadcrumbs
              items={[
                { name: section.label, path: section.base },
                ...(categoryHref ? [{ name: tool.category, path: categoryHref }] : []),
                { name: tool.name, path },
              ]}
            />
          </div>
          <div className="mt-10 flex flex-col gap-6 sm:mt-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[46rem]">
              <div className="hero-in flex items-center gap-3" style={{ "--i": 1 } as React.CSSProperties}>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-accent-night">
                  <Icon name={tool.icon} size={22} />
                </span>
                <span className="chip">{tool.category}</span>
              </div>
              <h1 className="display hero-in mt-6 !text-[clamp(2.1rem,1.5rem+2.4vw,3.4rem)]" style={{ "--i": 2 } as React.CSSProperties}>
                {tool.h1}
              </h1>
              <p className="lead hero-in mt-4" style={{ "--i": 3 } as React.CSSProperties}>
                <RichText text={tool.intro} />
              </p>
            </div>
            <ul className="hero-in flex flex-wrap gap-2 lg:justify-end" style={{ "--i": 3 } as React.CSSProperties} aria-label="Tool facts">
              {["Free", "No sign-up", "Runs in your browser"].map((f) => (
                <li key={f} className="chip">
                  <Icon name="check" size={14} className="text-accent" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section aria-label={`${tool.name} tool`} className="tool-root bg-sunken py-8 sm:py-12">
        <Container>
          <Component />
        </Container>
      </section>

      <section aria-label="Guide" className="py-20 sm:py-24">
        <Container className="grid gap-14 lg:grid-cols-[1fr_300px] lg:gap-16">
          <div className="min-w-0 max-w-[46rem] space-y-14">
            <div data-reveal>
              <h2 className="h2 !text-[1.85rem]">How to use this tool</h2>
              <ol className="mt-6 space-y-4">
                {tool.instructions.map((step, i) => (
                  <li key={i} className="grid grid-cols-[32px_1fr] gap-3 text-ink-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full font-mono text-xs text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]">
                      {i + 1}
                    </span>
                    <span className="pt-1">
                      <RichText text={step} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div data-reveal>
              <h2 className="h2 !text-[1.85rem]">How it works</h2>
              <div className="mt-5 space-y-4 text-[1.0625rem] leading-relaxed text-ink-2">
                {tool.howItWorks.map((p, i) => (
                  <p key={i}>
                    <RichText text={p} />
                  </p>
                ))}
              </div>
            </div>

            <div data-reveal>
              <h2 className="h2 !text-[1.85rem]">Example: {tool.example.title}</h2>
              <p className="mt-4 text-ink-2">
                <RichText text={tool.example.body} />
              </p>
              {(tool.example.input || tool.example.output) && (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {tool.example.input && <ExampleBlock label="Input" text={tool.example.input} />}
                  {tool.example.output && <ExampleBlock label="Result" text={tool.example.output} />}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
            <div>
              <h2 className="font-sans text-sm font-medium tracking-normal text-ink">Related tools</h2>
              <ul className="mt-4 space-y-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={toolHref(r)} className="group flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-sunken">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2 group-hover:bg-surface">
                        <Icon name={r.icon} size={18} />
                      </span>
                      <span className="text-[0.95rem] text-ink">{r.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={categoryHref ?? section.base} className="arrow-link link mt-4 !no-underline text-sm">
                All {categoryHref ? tool.category.toLowerCase() : section.label.toLowerCase()} <Icon name="arrow" size={14} />
              </Link>
            </div>
            {tool.learnMore && tool.learnMore.length > 0 && (
              <div>
                <h2 className="font-sans text-sm font-medium tracking-normal text-ink">Learn more</h2>
                <ul className="mt-3 space-y-2 text-[0.9rem]">
                  {tool.learnMore.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="link">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-xl bg-accent-soft p-5 text-sm text-ink-2">
              <p className="font-medium text-ink">Your data stays with you</p>
              <p className="mt-1">This tool runs in your browser. We do not receive or store what you enter.</p>
            </div>
          </aside>
        </Container>
      </section>

      <section aria-labelledby="faq-title" className="border-t border-line py-20 sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.6fr] lg:gap-16">
          <h2 id="faq-title" className="h2 !text-[1.85rem]" data-reveal>
            Frequently asked questions
          </h2>
          <FaqList faqs={tool.faqs} />
        </Container>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="more-title" className="bg-sunken py-20 sm:py-24">
          <Container>
            <h2 id="more-title" className="h2 !text-[1.85rem]" data-reveal>
              More {categoryHref ? tool.category.toLowerCase() : section.label.toLowerCase()}
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r, i) => (
                <li key={r.slug} data-reveal style={{ "--i": i } as React.CSSProperties}>
                  <ToolCard tool={{ href: toolHref(r), name: r.name, summary: r.summary, category: r.category, icon: r.icon }} headingLevel="h3" />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {tool.kind === "engineering" ? (
        <CtaBand
          title="Need more than a utility?"
          body="We design and build production AI systems: retrieval, agents, integrations and the evaluation that keeps them honest."
          cta="Start a conversation"
        />
      ) : (
        <CtaBand
          title="Keep learning, one project at a time."
          body="Roadmaps, study guides, project ideas and interview prep, written for students and junior developers."
          cta="Explore learning resources"
          href="/student-tools/resources"
        />
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: tool.name,
          description: tool.metaDescription,
          url: absoluteUrl(path),
          applicationCategory: tool.kind === "engineering" ? "DeveloperApplication" : "EducationalApplication",
          operatingSystem: "Any (web browser)",
          browserRequirements: "Requires JavaScript",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          provider: { "@id": `${site.url}/#organization` },
        }}
      />
    </>
  );
}

function ExampleBlock({ label, text }: { label: string; text: string }) {
  return (
    <figure className="overflow-hidden rounded-xl bg-night text-night-ink">
      <figcaption className="border-b border-night-line px-4 py-2 font-mono text-xs text-night-muted">{label}</figcaption>
      <pre tabIndex={0} className="overflow-x-auto whitespace-pre-wrap break-words p-4 font-mono text-[0.85rem] leading-relaxed">
        {text}
      </pre>
    </figure>
  );
}
