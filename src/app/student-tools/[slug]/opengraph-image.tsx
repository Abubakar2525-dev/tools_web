import { ogContentType, ogImage, ogSize } from "@/lib/og";
import { getTool } from "@/content/tools";
import { getStudentCatalogTool, studentToolMeta } from "@/content/student-catalog";

export const alt = "Free tool preview";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getStudentCatalogTool(slug);
  const t = entry ? studentToolMeta(entry) : getTool("student", slug);
  return ogImage({ kicker: t ? `Free tool · ${t.category}` : "Nuvella Promo Code", title: t ? t.h1 : "Page not found" });
}
