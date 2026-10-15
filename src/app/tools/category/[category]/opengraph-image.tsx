import { ogContentType, ogImage, ogSize } from "@/lib/og";
import { getCategory } from "@/content/catalog/categories";
import { toolsInCategory } from "@/content/catalog";

export const alt = "Tool category preview";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const c = getCategory(category);
  return ogImage({ kicker: c ? `${toolsInCategory(c.slug).length} free tools` : "Nuvella Promo Code", title: c ? `${c.name} tools` : "Page not found" });
}
