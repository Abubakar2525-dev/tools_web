import { ogContentType, ogImage, ogSize } from "@/lib/og";
import { getArticle } from "@/content/articles";

export const alt = "Article page preview";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getArticle(slug);
  return ogImage({ kicker: s ? s.category : "Nuvella Promo Code", title: s ? s.title : "Page not found" });
}
