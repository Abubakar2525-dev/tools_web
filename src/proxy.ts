import { NextResponse, type NextRequest } from "next/server";
import { services } from "@/content/services";
import { projects } from "@/content/projects";
import { articles } from "@/content/articles";
import { studentTools } from "@/content/tools";
import { catalogPages } from "@/content/catalog";
import { categories } from "@/content/catalog/categories";
import { studentCatalog, studentCategories } from "@/content/student-catalog";

/**
 * Detail routes stream their HTML, so a notFound() thrown inside the page can
 * no longer change the status code. Rejecting unknown slugs here, before
 * rendering, guarantees a real HTTP 404 (not a soft 404) for crawlers.
 */
const known: Record<string, Set<string>> = {
  services: new Set(services.map((s) => s.slug)),
  projects: new Set(projects.map((p) => p.slug)),
  articles: new Set(articles.map((a) => a.slug)),
  tools: new Set([...catalogPages.map((t) => t.slug), "category"]),
  "student-tools": new Set([...studentCatalog.map((tool) => tool.slug), ...studentTools.map((t) => t.slug), "category", "resources"]),
};

const categorySlugs = new Set<string>(categories.map((c) => c.slug));
const studentCategorySlugs = new Set<string>(studentCategories.map((category) => category.slug));

export function proxy(request: NextRequest) {
  const [, section, slug, sub] = request.nextUrl.pathname.split("/");
  const unknownCategory = section === "tools" && slug === "category" && (!sub || !categorySlugs.has(sub));
  const unknownStudentCategory = section === "student-tools" && slug === "category" && (!sub || !studentCategorySlugs.has(sub));
  if ((slug && known[section] && !known[section].has(slug)) || unknownCategory || unknownStudentCategory) {
    return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/services/:slug*", "/projects/:slug*", "/articles/:slug*", "/tools/:slug*", "/student-tools/:slug*"],
};
