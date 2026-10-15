import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container, CtaBand, JsonLd } from "@/components/ui/primitives";
import { serviceNavigationGroups, services } from "@/content/services";
import { site } from "@/content/site";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Digital, AI and software engineering services",
  description:
    "Digital, AI and software services across product development, websites, e-commerce, growth, infrastructure, maintenance and production operations.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "Services", path: "/services" }]}
        title="Digital services, from first idea to dependable operation."
        intro={`${services.length} focused services across AI, software, websites, growth and infrastructure. We will help identify the smallest useful combination for your goal.`}
        aside={
          <nav aria-label="Service groups" className="card p-2">
            {serviceNavigationGroups.map((group) => (
              <a
                key={group.title}
                href={`#${group.title.toLowerCase()}`}
                className="group flex items-start justify-between gap-4 rounded-[10px] p-4 transition-colors hover:bg-sunken"
              >
                <span>
                  <span className="block font-medium text-ink">{group.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{group.blurb}</span>
                </span>
                <Icon name="arrow" size={18} className="mt-1 rotate-90 text-muted transition-transform group-hover:translate-y-0.5" />
              </a>
            ))}
          </nav>
        }
      />

      {serviceNavigationGroups.map((group, groupIndex) => (
        <section
          key={group.title}
          id={group.title.toLowerCase()}
          aria-labelledby={`group-${group.title}`}
          className={`py-20 sm:py-28 ${groupIndex % 2 === 1 ? "bg-sunken" : ""}`}
        >
          <Container>
            <div className="flex flex-wrap items-baseline justify-between gap-4" data-reveal>
              <h2 id={`group-${group.title}`} className="h2">
                {group.title}
              </h2>
              <p className="max-w-[44ch] text-ink-2">{group.blurb}</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {group.services.map((s, i) => (
                  <article
                    key={s.slug}
                    className="card card-interactive group relative flex flex-col p-7 sm:p-9"
                    data-reveal
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between gap-6">
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink text-accent-night">
                        <Icon name={s.icon} size={24} />
                      </span>
                      <span className="font-mono text-xs text-muted">{s.primaryKeyword}</span>
                    </div>
                    <h3 className="h3 mt-7 sm:text-[1.65rem]">
                      <Link href={`/services/${s.slug}`} className="after:absolute after:inset-0 after:content-['']">
                        {s.title}
                      </Link>
                    </h3>
                    <p className="mt-3 text-ink-2">{s.summary}</p>
                    <div className="mt-6 border-t border-line pt-5">
                      <p className="text-sm font-medium text-ink">Solves</p>
                      <ul className="mt-3 space-y-2 text-[0.9375rem] text-ink-2">
                        {s.problems.slice(0, 3).map((p) => (
                          <li key={p.title} className="flex gap-2.5">
                            <Icon name="check" size={18} className="mt-[3px] shrink-0 text-accent" />
                            {p.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {s.stack.slice(0, 4).map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="arrow-link mt-8 text-ink" aria-hidden="true">
                      Service details <Icon name="arrow" size={16} />
                    </p>
                  </article>
                ))}
            </div>
          </Container>
        </section>
      ))}

      <section aria-labelledby="scope-title" className="py-24 sm:py-28">
        <Container className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div data-reveal>
            <h2 id="scope-title" className="h2 max-w-[18ch]">
              Not sure where your project fits?
            </h2>
            <p className="lead mt-5 max-w-[52ch]">
              Describe the workflow and the outcome you want. We will map it to the right mix of services and suggest a
              first milestone small enough to validate quickly.
            </p>
          </div>
          <div className="lg:justify-self-end" data-reveal style={{ "--i": 1 } as React.CSSProperties}>
            <ButtonLink href="/contact" arrow>
              {site.primaryCta.label}
            </ButtonLink>
          </div>
        </Container>
      </section>

      <CtaBand />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Digital, AI and software engineering services",
          itemListElement: services.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: s.title,
            url: absoluteUrl(`/services/${s.slug}`),
          })),
        }}
      />
    </>
  );
}
