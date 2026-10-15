import { ogContentType, ogImage, ogSize } from "@/lib/og";
import { getService } from "@/content/services";

export const alt = "Services page preview";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getService(slug);
  return ogImage({ kicker: s ? "Service" : "Nuvella Promo Code", title: s ? s.title : "Page not found" });
}
