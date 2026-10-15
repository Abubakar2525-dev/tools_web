import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolDirectory } from "@/components/tools/ToolDirectory";
import { Icon } from "@/components/ui/Icon";
import { PageHero } from "@/components/ui/PageHero";
import { Container, CtaBand, JsonLd } from "@/components/ui/primitives";
import { catalogHref, toolsInCategory } from "@/content/catalog";
import { categories, categoryHref, getCategory } from "@/content/catalog/categories";
import type { CategorySlug } from "@/content/catalog/types";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/tools/category/[category]">) {
  const { category } = await params;
  const c = getCategory(category);
  if (!c) return {};
  const n = toolsInCategory(c.slug).length;
  return pageMetadata({
    title: `Free ${c.name.toLowerCase()} tools`,
    description: `${n} free ${c.name.toLowerCase()} tools that run in your browser. ${c.description}`.slice(0, 160),
    path: categoryHref(c.slug),
  });
}

export default async function CategoryPage({ params }: PageProps<"/tools/category/[category]">) {
  const { category } = await params;
  const c = getCategory(category);
  if (!c) notFound();
  const tools = toolsInCategory(c.slug);
  const items = tools.map((t) => ({ href: catalogHref(t), name: t.name, summary: t.summary, category: c.name, icon: t.icon }));
  const others = categories.filter((o) => o.slug !== c.slug);

  return (
    <>
      <PageHero
        crumbs={[
          { name: "Tools", path: "/tools" },
          { name: c.name, path: categoryHref(c.slug) },
        ]}
        title={`${c.name} tools`}
        intro={`${c.description} ${tools.length} ${tools.length === 1 ? "tool" : "tools"}, all free and processed on your device.`}
        aside={
          <div className="flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_var(--line)]">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink text-accent-night">
              <Icon name={c.icon} size={28} />
            </span>
            <p className="text-sm text-ink-2">
              <span className="block font-display text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">{tools.length}</span>
              tools in this category
            </p>
          </div>
        }
      />

      <section aria-label={`${c.name} tools`} className="py-14 sm:py-20">
        <Container>
          {items.length > 0 ? (
            <ToolDirectory items={items} categories={[]} label={`${c.name.toLowerCase()} tools`} />
          ) : (
            <p className="text-ink-2">Tools for this category are being added.</p>
          )}
        </Container>
      </section>

      <section aria-labelledby="other-cats" className="bg-sunken py-16 sm:py-20">
        <Container>
          <h2 id="other-cats" className="h2 !text-[1.85rem]">
            Other categories
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={categoryHref(o.slug)} className="group flex items-center gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)] transition-shadow hover:shadow-md">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2 transition-colors group-hover:bg-ink group-hover:text-accent-night">
                    <Icon name={o.icon} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{o.name}</span>
                    <span className="text-sm tabular-nums text-muted">{toolsInCategory(o.slug as CategorySlug).length} tools</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <CtaBand />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${c.name} tools`,
          url: absoluteUrl(categoryHref(c.slug)),
          hasPart: tools.map((t) => ({ "@type": "WebApplication", name: t.name, url: absoluteUrl(catalogHref(t)) })),
        }}
      />
    </>
  );
}
