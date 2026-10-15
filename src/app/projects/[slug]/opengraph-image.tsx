import { ogContentType, ogImage, ogSize } from "@/lib/og";
import { getProject } from "@/content/projects";

export const alt = "Projects page preview";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getProject(slug);
  return ogImage({ kicker: s ? "Reference build" : "Nuvella Promo Code", title: s ? s.title : "Page not found" });
}
