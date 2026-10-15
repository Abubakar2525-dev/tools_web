/** HTML head tag generation for meta, Open Graph and Twitter/X card tags. */

export const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Cuts at a word boundary and adds an ellipsis (approximates how result snippets truncate). */
export function truncate(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

export interface MetaInput {
  title: string;
  description: string;
  canonical: string;
  index: boolean;
  follow: boolean;
  noarchive: boolean;
  nosnippet: boolean;
  maxImagePreview: "" | "none" | "standard" | "large";
  viewport: boolean;
  charset: boolean;
  lang: string;
  author: string;
  themeColor: string;
}

export function robotsContent(m: Pick<MetaInput, "index" | "follow" | "noarchive" | "nosnippet" | "maxImagePreview">): string {
  const parts: string[] = [];
  if (!m.index) parts.push("noindex");
  if (!m.follow) parts.push("nofollow");
  if (m.noarchive) parts.push("noarchive");
  if (m.nosnippet) parts.push("nosnippet");
  if (m.maxImagePreview) parts.push(`max-image-preview:${m.maxImagePreview}`);
  return parts.join(", ");
}

export function metaTags(m: MetaInput): string {
  const out: string[] = [];
  if (m.charset) out.push(`<meta charset="utf-8">`);
  if (m.viewport) out.push(`<meta name="viewport" content="width=device-width, initial-scale=1">`);
  if (m.title.trim()) out.push(`<title>${escText(m.title.trim())}</title>`);
  if (m.description.trim()) out.push(`<meta name="description" content="${escAttr(m.description.trim())}">`);
  if (m.canonical.trim()) out.push(`<link rel="canonical" href="${escAttr(m.canonical.trim())}">`);
  const robots = robotsContent(m);
  if (robots) out.push(`<meta name="robots" content="${robots}">`);
  if (m.author.trim()) out.push(`<meta name="author" content="${escAttr(m.author.trim())}">`);
  if (m.themeColor.trim()) out.push(`<meta name="theme-color" content="${escAttr(m.themeColor.trim())}">`);
  if (m.lang.trim()) out.unshift(`<!-- Put the language on the root element: <html lang="${escAttr(m.lang.trim())}"> -->`);
  return out.join("\n");
}

export interface OgInput {
  title: string;
  description: string;
  url: string;
  siteName: string;
  type: string;
  locale: string;
  image: string;
  imageAlt: string;
  imageWidth: string;
  imageHeight: string;
  publishedTime: string;
  author: string;
  card: "summary" | "summary_large_image";
  twitterSite: string;
  twitterCreator: string;
  twitterDuplicate: boolean;
}

const handle = (h: string) => {
  const s = h.trim();
  if (!s) return "";
  return s.startsWith("@") ? s : `@${s}`;
};

export function ogTags(o: OgInput): string {
  const out: string[] = [];
  const prop = (p: string, v: string) => {
    if (v.trim()) out.push(`<meta property="${p}" content="${escAttr(v.trim())}">`);
  };
  const name = (n: string, v: string) => {
    if (v.trim()) out.push(`<meta name="${n}" content="${escAttr(v.trim())}">`);
  };
  prop("og:title", o.title);
  prop("og:description", o.description);
  prop("og:type", o.type || "website");
  prop("og:url", o.url);
  prop("og:site_name", o.siteName);
  prop("og:locale", o.locale);
  prop("og:image", o.image);
  if (o.image.trim()) {
    prop("og:image:alt", o.imageAlt);
    prop("og:image:width", o.imageWidth);
    prop("og:image:height", o.imageHeight);
  }
  if (o.type === "article") {
    prop("article:published_time", o.publishedTime);
    prop("article:author", o.author);
  }
  out.push("");
  name("twitter:card", o.card);
  name("twitter:site", handle(o.twitterSite));
  name("twitter:creator", handle(o.twitterCreator));
  if (o.twitterDuplicate) {
    name("twitter:title", o.title);
    name("twitter:description", o.description);
    name("twitter:image", o.image);
    if (o.image.trim()) name("twitter:image:alt", o.imageAlt);
  }
  return out.join("\n").replace(/\n+$/, "");
}

/** Hostname for preview cards ("www.example.com" → "example.com"). */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Breadcrumb-like display URL used in search previews: "example.com › blog › post". */
export function breadcrumbUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean).map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
    return [u.hostname.replace(/^www\./, ""), ...parts].join(" › ");
  } catch {
    return url;
  }
}
