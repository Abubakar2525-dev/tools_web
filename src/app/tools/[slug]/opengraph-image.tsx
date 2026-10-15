import { ogContentType, ogImage, ogSize } from "@/lib/og";
import { getCatalogTool } from "@/content/catalog";
import { getCategory } from "@/content/catalog/categories";

export const alt = "Free tool preview";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getCatalogTool(slug);
  return ogImage({ kicker: t ? `Free tool · ${getCategory(t.category)?.name ?? "Tools"}` : "Nuvella Promo Code", title: t ? t.h1 : "Page not found" });
}
