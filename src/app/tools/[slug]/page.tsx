import { notFound } from "next/navigation";
import { CatalogToolPage } from "@/components/tools/CatalogToolPage";
import { catalogPages, getCatalogTool } from "@/content/catalog";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return catalogPages.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/tools/[slug]">) {
  const { slug } = await params;
  const t = getCatalogTool(slug);
  if (!t || t.href) return {};
  return pageMetadata({ title: t.metaTitle, description: t.metaDescription, path: `/tools/${t.slug}` });
}

export default async function ToolRoute({ params }: PageProps<"/tools/[slug]">) {
  const { slug } = await params;
  const tool = getCatalogTool(slug);
  if (!tool || tool.href) notFound();
  return <CatalogToolPage tool={tool} />;
}
