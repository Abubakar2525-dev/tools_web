import type { Metadata } from "next";
import { site } from "@/content/site";

export const absoluteUrl = (path = "/") => `${site.url}${path === "/" ? "" : path}`;

/**
 * Per-page metadata with consistent canonical + Open Graph + Twitter fields.
 * `title` is the page-specific part; the root layout template appends the brand.
 */
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  publishedTime,
  modifiedTime,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${site.name}`,
      description,
      url,
      siteName: site.name,
      locale: site.locale,
      type,
      ...(type === "article" ? { publishedTime, modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${site.name}`,
      description,
    },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

/* ---------------- JSON-LD builders (only genuine data) ---------------- */

export const organizationLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${site.url}/#organization`,
  name: site.legalName,
  url: site.url,
  logo: `${site.url}/logo.svg`,
  description: site.description,
  ...(site.contact.email ? { email: site.contact.email } : {}),
  sameAs: Object.values(site.social).filter(Boolean),
});

export const websiteLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${site.url}/#website`,
  name: site.name,
  url: site.url,
  publisher: { "@id": `${site.url}/#organization` },
  inLanguage: "en-US",
});

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: absoluteUrl(it.path),
  })),
});

export const serviceLd = (s: { name: string; description: string; path: string; serviceType: string }) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  name: s.name,
  description: s.description,
  serviceType: s.serviceType,
  url: absoluteUrl(s.path),
  provider: { "@id": `${site.url}/#organization` },
  areaServed: "Worldwide", // EDIT ME: restrict to real markets if needed
});

export const faqLd = (faqs: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a.replace(/[`*]/g, "") },
  })),
});

export const articleLd = (a: {
  title: string;
  description: string;
  path: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  section: string;
  wordCount: number;
}) => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: a.title,
  description: a.description,
  url: absoluteUrl(a.path),
  mainEntityOfPage: absoluteUrl(a.path),
  image: `${absoluteUrl(a.path)}/opengraph-image`,
  datePublished: a.publishedAt,
  dateModified: a.updatedAt ?? a.publishedAt,
  author: { "@type": "Organization", name: a.author, url: site.url },
  publisher: { "@id": `${site.url}/#organization` },
  articleSection: a.section,
  wordCount: a.wordCount,
  inLanguage: "en-US",
});
