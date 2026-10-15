import { ogContentType, ogImage, ogSize } from "@/lib/og";

export const alt = "Nuvella Promo Code: from AI possibilities to production-ready systems";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogImage({ kicker: "AI engineering studio", title: "From AI possibilities to production-ready systems." });
}
