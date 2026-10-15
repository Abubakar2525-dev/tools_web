import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolDirectory } from "@/components/tools/ToolDirectory";
import { Icon } from "@/components/ui/Icon";
import { PageHero } from "@/components/ui/PageHero";
import { Container, JsonLd } from "@/components/ui/primitives";
import {
  getStudentCategory,
  studentCategories,
  studentCategoryHref,
  studentToolHref,
  studentToolsInCategory,
} from "@/content/student-catalog";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return studentCategories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: PageProps<"/student-tools/category/[category]">) {
  const { category: slug } = await params;
  const category = getStudentCategory(slug);
  if (!category) return {};
  const count = studentToolsInCategory(category.slug).length;
  return pageMetadata({
    title: `${category.name} tools for students`,
    description: `Explore ${count} free ${category.name.toLowerCase()} tools for students. ${category.description} Every tool runs in your browser with no sign-up.`,
    path: studentCategoryHref(category.slug),
  });
}

export default async function StudentCategoryPage({ params }: PageProps<"/student-tools/category/[category]">) {
  const { category: slug } = await params;
  const category = getStudentCategory(slug);
  if (!category) notFound();
  const tools = studentToolsInCategory(category.slug);
  const items = tools.map((tool) => ({
    href: studentToolHref(tool.slug),
    name: tool.name,
    summary: tool.source.summary,
    category: category.name,
    icon: tool.source.icon,
  }));

  return (
    <>
      <PageHero
        crumbs={[
          { name: "Student tools", path: "/student-tools" },
          { name: category.name, path: studentCategoryHref(category.slug) },
        ]}
        title={`${category.name} tools for students`}
        intro={`${category.description} Choose from ${tools.length} free tools, all running locally in your browser.`}
        aside={
          <div className="rounded-2xl bg-accent-soft p-6 text-[0.95rem] text-ink-2">
            <p className="font-medium text-ink">Private by default</p>
            <p className="mt-2">Your inputs stay on this device. Open a tool to see its method, assumptions, worked example and limits.</p>
          </div>
        }
      />
      <section aria-label={`${category.name} tool directory`} className="py-14 sm:py-20">
        <Container>
          <ToolDirectory items={items} categories={[]} label={`${category.name.toLowerCase()} tools`} />
          <Link href="/student-tools" className="arrow-link link mt-10 !no-underline">
            <Icon name="arrow" size={16} className="rotate-180" /> Browse all student tools
          </Link>
        </Container>
      </section>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${category.name} tools for students`,
          url: absoluteUrl(studentCategoryHref(category.slug)),
          hasPart: tools.map((tool) => ({
            "@type": "WebApplication",
            name: tool.name,
            url: absoluteUrl(studentToolHref(tool.slug)),
          })),
        }}
      />
    </>
  );
}
