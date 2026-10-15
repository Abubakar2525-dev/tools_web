import { notFound } from "next/navigation";
import { ToolPage } from "@/components/tools/ToolPage";
import { ToolHost } from "@/components/tools/catalog/registry";
import { studentComponents } from "@/components/tools/registry";
import {
  getStudentCatalogTool,
  studentCatalog,
  studentCategoryHref,
  studentToolMeta,
} from "@/content/student-catalog";
import { studentTools, getTool } from "@/content/tools";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return [...new Set([...studentCatalog.map((tool) => tool.slug), ...studentTools.map((tool) => tool.slug)])].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/student-tools/[slug]">) {
  const { slug } = await params;
  const entry = getStudentCatalogTool(slug);
  if (entry) {
    const tool = studentToolMeta(entry);
    return pageMetadata({ title: tool.metaTitle, description: tool.metaDescription, path: `/student-tools/${tool.slug}` });
  }
  const t = getTool("student", slug);
  if (!t) return {};
  return pageMetadata({ title: t.metaTitle, description: t.metaDescription, path: `/student-tools/${t.slug}` });
}

export default async function StudentToolPage({ params }: PageProps<"/student-tools/[slug]">) {
  const { slug } = await params;
  const entry = getStudentCatalogTool(slug);
  if (entry) {
    const tool = studentToolMeta(entry);
    const aliasSlug = entry.source.href?.split("/").filter(Boolean).at(-1);
    const ExistingComponent = studentComponents[slug] ?? (aliasSlug ? studentComponents[aliasSlug] : undefined);
    const Component = ExistingComponent ?? function StudentCatalogComponent() {
      return <ToolHost slug={entry.sourceSlug} />;
    };
    const relatedTools = tool.related
      .map(getStudentCatalogTool)
      .filter((related) => related !== undefined)
      .map(studentToolMeta);
    return (
      <ToolPage
        tool={tool}
        Component={Component}
        relatedTools={relatedTools}
        categoryHref={studentCategoryHref(entry.category)}
      />
    );
  }
  const tool = getTool("student", slug);
  const Component = studentComponents[slug];
  if (!tool || !Component) notFound();
  return <ToolPage tool={tool} Component={Component} />;
}
