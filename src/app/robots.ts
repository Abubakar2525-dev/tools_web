import type { MetadataRoute } from "next";
import { site } from "@/content/site";

/**
 * Production allows crawling. Any non-production deployment (previews, staging)
 * is disallowed so duplicate copies never get indexed. Set
 * NEXT_PUBLIC_SITE_ENV=production on the live deployment only.
 */
export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.NEXT_PUBLIC_SITE_ENV === "production";
  return isProd
    ? {
        rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
        sitemap: `${site.url}/sitemap.xml`,
        host: site.url,
      }
    : { rules: [{ userAgent: "*", disallow: "/" }] };
}
