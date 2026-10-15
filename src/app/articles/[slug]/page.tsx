import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton, ShareLinks, Toc } from "@/components/articles/ArticleClient";
import { ArticleCard } from "@/components/ui/cards";
import { Icon } from "@/components/ui/Icon";
import { Breadcrumbs, Container, CtaBand, JsonLd, RichText } from "@/components/ui/primitives";
import { articles, formatDate, getArticle, readingTime, tableOfContents, wordCount } from "@/content/articles";
import { getService } from "@/content/services";
import type { Block } from "@/content/types";
import { absoluteUrl, articleLd, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/articles/[slug]">) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  return pageMetadata({
    title: a.metaTitle ?? a.title,
    description: a.description,
    path: `/articles/${a.slug}`,
    type: "article",
    publishedTime: a.publishedAt,
    modifiedTime: a.updatedAt,
  });
}

function renderBlock(b: Block, i: number) {
  switch (b.type) {
    case "p":
      return (
        <p key={i}>
          <RichText text={b.text} />
        </p>
      );
    case "h2":
      return (
        <h2 key={i} id={b.id}>
          {b.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={i} id={b.id}>
          {b.text}
        </h3>
      );
    case "ul":
      return (
        <ul key={i}>
          {b.items.map((it, j) => (
            <li key={j}>
              <RichText text={it} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={i}>
          {b.items.map((it, j) => (
            <li key={j}>
              <RichText text={it} />
            </li>
          ))}
        </ol>
      );
    case "code":
      return (
        <figure key={i} className="!mt-8 overflow-hidden rounded-xl bg-night text-night-ink shadow-md">
          <div className="flex items-center justify-between border-b border-night-line py-1.5 pl-4 pr-1.5">
            <span className="font-mono text-xs text-night-muted">{b.lang}</span>
            <CopyButton text={b.code} />
          </div>
          <pre className="overflow-x-auto p-5 text-[0.85rem] leading-[1.7]" tabIndex={0}>
            <code className="font-mono">{b.code}</code>
          </pre>
          {b.caption && <figcaption className="border-t border-night-line px-4 py-3 text-sm text-night-muted">{b.caption}</figcaption>}
        </figure>
      );
    case "callout":
      return (
        <aside key={i} className="!mt-8 rounded-xl bg-accent-soft p-6 text-ink" aria-label={b.title ?? "Key takeaway"}>
          {b.title && <p className="font-semibold">{b.title}</p>}
          <p className={b.title ? "mt-2 text-ink-2" : "text-ink-2"}>
            <RichText text={b.text} />
          </p>
        </aside>
      );
    case "quote":
      return (
        <blockquote key={i}>
          <p>
            <RichText text={b.text} />
          </p>
        </blockquote>
      );
  }
}

export default async function ArticlePage({ params }: PageProps<"/articles/[slug]">) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();

  const toc = tableOfContents(a).map((h) => ({ id: h.id, text: h.text }));
  const url = absoluteUrl(`/articles/${a.slug}`);
  const minutes = readingTime(a);
  const related = [
    ...articles.filter((x) => x.slug !== a.slug && x.category === a.category),
    ...articles.filter((x) => x.slug !== a.slug && x.category !== a.category),
  ].slice(0, 3);
  const svcs = a.relatedServices.map(getService).filter((s) => s !== undefined);

  return (
    <>
      <div aria-hidden="true" className="reading-progress fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-accent" />

      <article>
        <header className="page-hero relative border-b border-line">
          <Container className="pb-14 pt-10 sm:pb-16 sm:pt-14">
            <div className="hero-in">
              <Breadcrumbs
                items={[
                  { name: "Articles", path: "/articles" },
                  { name: a.title, path: `/articles/${a.slug}` },
                ]}
              />
            </div>
            <div className="mx-auto mt-12 max-w-[1100px] sm:mt-16"><div className="max-w-[48rem]">
              <p className="hero-in flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted" style={{ "--i": 1 } as React.CSSProperties}>
                <span className="font-medium text-accent-strong">{a.category}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
                {a.updatedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Updated <time dateTime={a.updatedAt}>{formatDate(a.updatedAt)}</time>
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{minutes} min read</span>
              </p>
              <h1 className="display hero-in mt-5 !text-[clamp(2.2rem,1.5rem+2.8vw,3.6rem)]" style={{ "--i": 2 } as React.CSSProperties}>
                {a.title}
              </h1>
              <p className="lead hero-in mt-6" style={{ "--i": 3 } as React.CSSProperties}>
                {a.description}
              </p>
              <p className="hero-in mt-8 text-sm text-muted" style={{ "--i": 4 } as React.CSSProperties}>
                By <span className="font-medium text-ink">{a.author.name}</span>, {a.author.role}
              </p>
            </div></div>
          </Container>
        </header>

        <Container className="py-14 sm:py-20">
          <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[1fr_240px] lg:gap-16">
            <div className="prose-article min-w-0 max-w-[44rem]">{a.body.map(renderBlock)}</div>
            <aside className="hidden lg:block">
              <div className="sticky top-28 space-y-10">
                {toc.length > 2 && <Toc items={toc} />}
                {svcs.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Related services</p>
                    <ul className="mt-3 space-y-2 text-[0.875rem]">
                      {svcs.map((s) => (
                        <li key={s.slug}>
                          <Link href={`/services/${s.slug}`} className="link">
                            {s.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </aside>
          </div>

          <footer className="mx-auto mt-16 max-w-[1100px] border-t border-line pt-8">
            <div className="flex max-w-[44rem] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">Found this useful? Share it with your team.</p>
              <ShareLinks url={url} title={a.title} />
            </div>
          </footer>
        </Container>
      </article>

      <section aria-labelledby="related-title" className="bg-sunken py-20 sm:py-24">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="related-title" className="h2">
              Keep reading
            </h2>
            <Link href="/articles" className="arrow-link link !no-underline">
              All articles <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {related.map((r, i) => (
              <div key={r.slug} data-reveal style={{ "--i": i } as React.CSSProperties}>
                <ArticleCard article={r} />
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand title="Want help applying this?" body="We build and review systems like the one described here. Tell us what you are working on." />

      <JsonLd
        data={articleLd({
          title: a.title,
          description: a.description,
          path: `/articles/${a.slug}`,
          publishedAt: a.publishedAt,
          updatedAt: a.updatedAt,
          author: a.author.name,
          section: a.category,
          wordCount: wordCount(a),
        })}
      />
    </>
  );
}
