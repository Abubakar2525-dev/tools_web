import { ImageResponse } from "next/og";
import { site } from "@/content/site";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

/** Shared Open Graph card: charcoal field, strata mark, page title. Hex colors only (Satori). */
export function ogImage({ kicker, title }: { kicker: string; title: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#141a1b",
          color: "#f2f5f4",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, width: 48 }}>
            <div style={{ width: 30, height: 6, borderRadius: 3, background: "#f2f5f4", opacity: 0.55 }} />
            <div style={{ width: 30, height: 6, borderRadius: 3, background: "#f2f5f4", opacity: 0.8, marginLeft: 6 }} />
            <div style={{ width: 30, height: 6, borderRadius: 3, background: "#4fc7ad", marginLeft: 12 }} />
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>{site.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 26, color: "#4fc7ad" }}>{kicker}</div>
          <div style={{ fontSize: title.length > 60 ? 56 : 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>
            {title}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#a3adab" }}>
          <div>{site.tagline}</div>
          <div>{site.url.replace(/^https?:\/\//, "")}</div>
        </div>
      </div>
    ),
    ogSize,
  );
}
