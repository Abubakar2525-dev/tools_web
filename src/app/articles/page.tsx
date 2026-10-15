import { ArticleFilter } from "@/components/articles/ArticleFilter";
import { ArticleHeroVisual } from "@/components/articles/ArticleVisuals";
import "@/components/articles/articles.css";
import { Breadcrumbs, Container, CtaBand, JsonLd } from "@/components/ui/primitives";
import { articleCategories, articles, formatDate, readingTime } from "@/content/articles";
import { site } from "@/content/site";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "AI engineering articles and guides",
  description:
    "Practical guides on RAG, AI agents, LLM cost and latency, prompt injection defense and data readiness, written by engineers who build production AI systems.",
  path: "/articles",
});

export default function ArticlesPage() {
  const items = articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    description: a.description,
    category: a.category,
    publishedAt: a.publishedAt,
    date: formatDate(a.publishedAt),
    minutes: readingTime(a),
  }));

  return (
    <>
      <section aria-labelledby="articles-hero-title" className="page-hero relative border-b border-line">
        <Container className="relative pb-16 pt-10 sm:pb-20 sm:pt-14 lg:pb-24">
          <div className="hero-in">
            <Breadcrumbs items={[{ name: "Articles", path: "/articles" }]} />
          </div>
          <div className="mt-11 grid gap-10 sm:mt-14 lg:grid-cols-[0.93fr_1.07fr] lg:items-center lg:gap-16">
            <div>
              <p className="kicker hero-in mb-5" style={{ "--i": 1 } as React.CSSProperties}>
                Engineering field notes
              </p>
              <h1
                id="articles-hero-title"
                className="display hero-in max-w-[12ch] !text-[clamp(2.6rem,1.65rem+3.7vw,4.5rem)]"
                style={{ "--i": 2 } as React.CSSProperties}
              >
                Articles for systems that have to work.
              </h1>
              <p className="lead hero-in mt-6 max-w-[52ch]" style={{ "--i": 3 } as React.CSSProperties}>
                Practical writing on AI agents, retrieval, LLM engineering, production security and the data systems beneath reliable software.
              </p>
              <ul className="hero-in mt-8 flex flex-wrap gap-2" style={{ "--i": 4 } as React.CSSProperties} aria-label="Article archive summary">
                <li className="chip">{articles.length} field notes</li>
                <li className="chip">{articleCategories.length} focused topics</li>
                <li className="chip">Written by engineers</li>
              </ul>
            </div>
            <div className="hero-in" style={{ "--i": 3 } as React.CSSProperties}>
              <ArticleHeroVisual />
            </div>
          </div>
        </Container>
      </section>
      <section aria-label="Articles" className="py-20 sm:py-28">
        <Container>
          <ArticleFilter items={items} categories={articleCategories} />
        </Container>
      </section>
      <CtaBand
        title="Working on something similar?"
        body="If an article describes a problem you are facing, we are glad to talk it through."
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `${site.name} articles`,
          url: absoluteUrl("/articles"),
          publisher: { "@id": `${site.url}/#organization` },
          blogPost: articles.map((a) => ({
            "@type": "BlogPosting",
            headline: a.title,
            url: absoluteUrl(`/articles/${a.slug}`),
            datePublished: a.publishedAt,
          })),
        }}
      />
    </>
  );
}
