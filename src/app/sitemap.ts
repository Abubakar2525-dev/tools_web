import type { MetadataRoute } from "next";
import { articles } from "@/content/articles";
import { projects } from "@/content/projects";
import { services } from "@/content/services";
import { studentTools, toolHref } from "@/content/tools";
import { catalogPages } from "@/content/catalog";
import { categories, categoryHref } from "@/content/catalog/categories";
import { studentCatalog, studentCategories, studentCategoryHref, studentToolHref } from "@/content/student-catalog";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const latest = articles.map((a) => a.updatedAt ?? a.publishedAt).sort().at(-1);
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), priority: 1, changeFrequency: "monthly", lastModified: latest },
    { url: absoluteUrl("/services"), priority: 0.9, changeFrequency: "monthly" },
    { url: absoluteUrl("/projects"), priority: 0.8, changeFrequency: "monthly" },
    { url: absoluteUrl("/articles"), priority: 0.8, changeFrequency: "weekly", lastModified: latest },
    { url: absoluteUrl("/tools"), priority: 0.8, changeFrequency: "monthly" },
    { url: absoluteUrl("/student-tools"), priority: 0.8, changeFrequency: "monthly" },
    { url: absoluteUrl("/student-tools/resources"), priority: 0.7, changeFrequency: "monthly" },
    { url: absoluteUrl("/about"), priority: 0.6, changeFrequency: "yearly" },
    { url: absoluteUrl("/contact"), priority: 0.7, changeFrequency: "yearly" },
    { url: absoluteUrl("/privacy"), priority: 0.2, changeFrequency: "yearly" },
    { url: absoluteUrl("/terms"), priority: 0.2, changeFrequency: "yearly" },
  ];
  return [
    ...staticPages,
    ...services.map((s) => ({ url: absoluteUrl(`/services/${s.slug}`), priority: 0.8, changeFrequency: "monthly" as const })),
    ...projects.map((p) => ({ url: absoluteUrl(`/projects/${p.slug}`), priority: 0.6, changeFrequency: "yearly" as const })),
    ...categories.map((c) => ({ url: absoluteUrl(categoryHref(c.slug)), priority: 0.7, changeFrequency: "monthly" as const })),
    ...catalogPages.map((t) => ({ url: absoluteUrl(`/tools/${t.slug}`), priority: 0.6, changeFrequency: "monthly" as const })),
    ...studentCategories.map((category) => ({
      url: absoluteUrl(studentCategoryHref(category.slug)),
      priority: 0.7,
      changeFrequency: "monthly" as const,
    })),
    ...studentCatalog.map((tool) => ({
      url: absoluteUrl(studentToolHref(tool.slug)),
      priority: 0.7,
      changeFrequency: "monthly" as const,
    })),
    ...studentTools
      .filter((tool) => !studentCatalog.some((entry) => entry.slug === tool.slug))
      .map((t) => ({ url: absoluteUrl(toolHref(t)), priority: 0.6, changeFrequency: "monthly" as const })),
    ...articles.map((a) => ({
      url: absoluteUrl(`/articles/${a.slug}`),
      lastModified: a.updatedAt ?? a.publishedAt,
      priority: 0.7,
      changeFrequency: "yearly" as const,
    })),
  ];
}
