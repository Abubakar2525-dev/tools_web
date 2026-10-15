import Link from "next/link";
import { CatalogSearch } from "@/components/tools/CatalogSearch";
import { Icon } from "@/components/ui/Icon";
import { Breadcrumbs, Container, CtaBand, JsonLd } from "@/components/ui/primitives";
import { catalog, catalogHref, toolsInCategory } from "@/content/catalog";
import { categories, categoryGroups, categoryHref, getCategory } from "@/content/catalog/categories";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

const total = catalog.length;

export const metadata = pageMetadata({
  title: "Free online tools for PDFs, images, text and more",
  description: `${total} free online tools that run in your browser: PDF, image, audio, text, developer, calculator, converter, finance, design and business utilities.`,
  path: "/tools",
});

export default function ToolsHub() {
  const items = catalog.map((t) => ({
    href: catalogHref(t),
    name: t.name,
    summary: t.summary,
    category: getCategory(t.category)?.name ?? "",
    icon: t.icon,
    keyword: t.primaryKeyword,
  }));
  const popular = catalog.filter((t) => t.popular).slice(0, 12);

  return (
    <>
      <section className="page-hero relative border-b border-line">
        <Container className="relative pb-14 pt-10 sm:pb-16 sm:pt-14">
          <div className="hero-in">
            <Breadcrumbs items={[{ name: "Tools", path: "/tools" }]} />
          </div>
          <div className="mx-auto mt-12 max-w-3xl text-center sm:mt-14">
            <h1 className="display hero-in !text-[clamp(2.4rem,1.5rem+3.2vw,4rem)]" style={{ "--i": 1 } as React.CSSProperties}>
              {total} free tools that run in your browser.
            </h1>
            <p className="lead hero-in mx-auto mt-5 max-w-[56ch]" style={{ "--i": 2 } as React.CSSProperties}>
              Convert, edit, calculate and generate without uploading anything. Files and text are processed on your
              device, and no account is needed.
            </p>
          </div>
        </Container>
      </section>

      <section aria-label="Find a tool" className="py-12 sm:py-16">
        <Container>
          <CatalogSearch items={items}>
            {popular.length > 0 && (
              <div className="mt-14">
                <h2 className="font-sans text-sm font-medium tracking-normal text-muted">Popular tools</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
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

            {categoryGroups.map((g) => (
              <div key={g} className="mt-16">
                <h2 className="flex items-center gap-3 font-mono text-xs font-normal tracking-normal text-muted">
                  {g}
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </h2>
                <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {categories
                    .filter((c) => c.group === g)
                    .map((c) => {
                      const tools = toolsInCategory(c.slug);
                      return (
                        <li key={c.slug} data-reveal>
                          <article className="card flex h-full flex-col p-6">
                            <div className="flex items-start justify-between gap-4">
                              <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink text-accent-night">
                                <Icon name={c.icon} size={24} />
                              </span>
                              <span className="chip !h-7 tabular-nums">{tools.length} tools</span>
                            </div>
                            <h3 className="mt-5 font-display text-[1.3rem] font-semibold tracking-[-0.02em]">
                              <Link href={categoryHref(c.slug)} className="hover:text-accent-strong">
                                {c.name}
                              </Link>
                            </h3>
                            <p className="mt-2 text-[0.95rem] text-ink-2">{c.description}</p>
                            <ul className="mt-5 space-y-1.5 text-[0.925rem]">
                              {tools.slice(0, 5).map((t) => (
                                <li key={t.slug}>
                                  <Link href={catalogHref(t)} className="link">
                                    {t.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                            <Link href={categoryHref(c.slug)} className="arrow-link mt-auto pt-6 text-ink">
                              All {tools.length} {c.name.toLowerCase()} tools <Icon name="arrow" size={16} />
                            </Link>
                          </article>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </CatalogSearch>
        </Container>
      </section>

      <section aria-labelledby="privacy-title" className="bg-sunken py-16 sm:py-20">
        <Container className="grid gap-8 lg:grid-cols-3">
          <h2 id="privacy-title" className="h2 !text-[1.85rem] lg:col-span-1">
            Built to keep your files private
          </h2>
          <ul className="grid gap-6 sm:grid-cols-3 lg:col-span-2">
            {[
              { icon: "shield" as const, t: "Processed on your device", d: "PDFs, images, audio and text never leave your browser." },
              { icon: "info" as const, t: "Clear disclosures", d: "The few tools that download a model or fonts say so on the page." },
              { icon: "check" as const, t: "Free, no sign-up", d: "Open a tool and start. Planners save only in your browser." },
            ].map((x) => (
              <li key={x.t}>
                <Icon name={x.icon} size={22} className="text-accent" />
                <p className="mt-3 font-medium text-ink">{x.t}</p>
                <p className="mt-1 text-sm text-ink-2">{x.d}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <CtaBand
        title="Need a tool built for your team?"
        body="We build production software and AI systems: document pipelines, internal tools, integrations and agents."
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Free online tools",
          url: absoluteUrl("/tools"),
          hasPart: categories.map((c) => ({ "@type": "CollectionPage", name: `${c.name} tools`, url: absoluteUrl(categoryHref(c.slug)) })),
        }}
      />
    </>
  );
}
