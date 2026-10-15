/**
 * Email signature HTML generator. Output is table-based with inline styles
 * only (no classes, no <style>, no scripts) because many email clients strip
 * everything else. Every user value is HTML-escaped and every link is checked:
 * only http(s), mailto: and tel: links are produced.
 */

export type SignatureTemplate = "side" | "stacked" | "compact";

export const SIGNATURE_TEMPLATES: { value: SignatureTemplate; label: string }[] = [
  { value: "side", label: "Side by side" },
  { value: "stacked", label: "Stacked" },
  { value: "compact", label: "Compact" },
];

export const SOCIAL_NETWORKS = ["LinkedIn", "X", "GitHub", "Instagram", "Facebook", "YouTube", "Mastodon", "Bluesky", "Website"] as const;

export interface SocialLink {
  id: string;
  network: string;
  url: string;
}

export interface SignatureData {
  name: string;
  title: string;
  company: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  address: string;
  imageUrl: string;
  imageWidth: number;
  imageRound: boolean;
  accent: string;
  template: SignatureTemplate;
  socials: SocialLink[];
  disclaimer: string;
}

export const DEFAULT_SIGNATURE: SignatureData = {
  name: "Jordan Avery",
  title: "Customer success lead",
  company: "Northwind Analytics",
  phone: "+1 (312) 555-0148",
  mobile: "",
  email: "jordan@northwind.example",
  website: "northwind.example",
  address: "200 W Lake St, Chicago, IL 60606",
  imageUrl: "",
  imageWidth: 80,
  imageRound: false,
  accent: "#1f6f5c",
  template: "side",
  socials: [{ id: "s1", network: "LinkedIn", url: "https://www.linkedin.com/in/example" }],
  disclaimer: "",
};

/* ------------------------------------------------------------------ */
/* Escaping and link validation                                        */
/* ------------------------------------------------------------------ */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Returns a normalized http(s) URL or null. With `allowBare`, "example.com/x"
 * becomes "https://example.com/x". Any other scheme (javascript:, data:…) is rejected.
 */
export function safeHttpUrl(raw: string, allowBare = true): string | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  let candidate = s;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    if (!allowBare || !/^[^/?#@]+\.[a-z]{2,}([/?#:].*)?$/i.test(s)) return null;
    candidate = `https://${s}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname || !u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}$/i;

export function mailHref(email: string): string | null {
  const s = email.trim();
  return EMAIL_RE.test(s) ? `mailto:${s}` : null;
}

export function telHref(phone: string): string | null {
  const s = phone.trim();
  if (!s || !/^[+\d\s().\-/x]+$/i.test(s)) return null;
  const digits = s.replace(/x.*$/i, "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return digits.replace(/\D/g, "").length >= 3 ? `tel:${digits}` : null;
}

export const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s.trim());

export type SignatureErrors = Partial<Record<string, string>>;

export function validateSignature(d: SignatureData): SignatureErrors {
  const e: SignatureErrors = {};
  if (d.email.trim() && !mailHref(d.email)) e.email = "Enter a valid email address, like name@company.com.";
  if (d.phone.trim() && !telHref(d.phone)) e.phone = "Use digits, spaces, +, ( ), - or x for an extension.";
  if (d.mobile.trim() && !telHref(d.mobile)) e.mobile = "Use digits, spaces, +, ( ), - or x for an extension.";
  if (d.website.trim() && !safeHttpUrl(d.website)) e.website = "Enter a web address such as example.com or https://example.com.";
  if (d.imageUrl.trim() && !safeHttpUrl(d.imageUrl, false)) e.imageUrl = "Use a full link starting with https:// to an image that is already online.";
  if (!isHex(d.accent)) e.accent = "Use a 6-digit hex color such as #1f6f5c.";
  for (const s of d.socials) if (s.url.trim() && !safeHttpUrl(s.url)) e[`social-${s.id}`] = "Enter a web link starting with https://.";
  return e;
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

const FONT = "font-family:Arial,Helvetica,sans-serif;";
const INK = "#222222";
const BODY = "#444444";
const MUTED = "#777777";

interface Item {
  label: string;
  text: string;
  href: string | null;
}

function contactItems(d: SignatureData): Item[] {
  const items: Item[] = [];
  if (d.phone.trim()) items.push({ label: "Phone", text: d.phone.trim(), href: telHref(d.phone) });
  if (d.mobile.trim()) items.push({ label: "Mobile", text: d.mobile.trim(), href: telHref(d.mobile) });
  if (d.email.trim() && mailHref(d.email)) items.push({ label: "Email", text: d.email.trim(), href: mailHref(d.email) });
  const web = safeHttpUrl(d.website);
  if (web) items.push({ label: "Web", text: d.website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, ""), href: web });
  if (d.address.trim()) items.push({ label: "Address", text: d.address.trim(), href: null });
  return items;
}

function socialLinks(d: SignatureData): { network: string; href: string }[] {
  return d.socials
    .map((s) => ({ network: s.network.trim() || "Link", href: safeHttpUrl(s.url) }))
    .filter((s): s is { network: string; href: string } => s.href !== null);
}

function link(text: string, href: string | null, accent: string, extra = ""): string {
  const t = escapeHtml(text);
  if (!href) return t;
  return `<a href="${escapeHtml(href)}" style="color:${accent};text-decoration:none;${extra}">${t}</a>`;
}

function imageCell(d: SignatureData): string | null {
  const src = safeHttpUrl(d.imageUrl, false);
  if (!src) return null;
  const w = Math.max(32, Math.min(200, Math.round(d.imageWidth || 80)));
  const radius = d.imageRound ? `border-radius:${Math.round(w / 2)}px;height:${w}px;` : "height:auto;";
  return `<img src="${escapeHtml(src)}" width="${w}" alt="${escapeHtml(d.name.trim() || d.company.trim() || "Logo")}" style="display:block;border:0;outline:none;width:${w}px;${radius}max-width:${w}px;">`;
}

const nl2br = (s: string) => escapeHtml(s.trim()).replace(/\r?\n/g, "<br>");

/** Builds the signature fragment (a single outer table). */
export function buildSignatureHtml(d: SignatureData): string {
  const accent = isHex(d.accent) ? d.accent.trim() : "#1f6f5c";
  const name = d.name.trim();
  const roleLine = [d.title.trim(), d.company.trim()].filter(Boolean);
  const items = contactItems(d);
  const socials = socialLinks(d);
  const img = imageCell(d);
  const tableOpen = (style = "") =>
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;${FONT}${style}">`;

  const nameHtml = name ? `<div style="${FONT}font-size:16px;line-height:20px;font-weight:bold;color:${INK};">${escapeHtml(name)}</div>` : "";
  const roleHtml = roleLine.length
    ? `<div style="${FONT}font-size:13px;line-height:18px;color:${BODY};">${roleLine.map(escapeHtml).join(` <span style="color:${accent};">|</span> `)}</div>`
    : "";
  const contactRows = items
    .map(
      (it) =>
        `<div style="${FONT}font-size:12px;line-height:18px;color:${BODY};"><span style="color:${accent};font-weight:bold;">${escapeHtml(it.label)}</span>&nbsp;&nbsp;${link(it.text, it.href, BODY)}</div>`,
    )
    .join("");
  const socialHtml = socials.length
    ? `<div style="${FONT}font-size:12px;line-height:18px;padding-top:6px;">${socials
        .map((s) => link(s.network, s.href, accent, "font-weight:bold;"))
        .join(`<span style="color:${MUTED};">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`)}</div>`
    : "";
  const disclaimerRow = d.disclaimer.trim()
    ? `<tr><td colspan="2" style="${FONT}padding-top:12px;font-size:10px;line-height:14px;color:${MUTED};">${nl2br(d.disclaimer)}</td></tr>`
    : "";

  let body: string;
  if (d.template === "stacked") {
    body = `${tableOpen()}${img ? `<tr><td style="padding:0 0 10px 0;">${img}</td></tr>` : ""}<tr><td style="padding:0 0 8px 0;">${nameHtml}${roleHtml}</td></tr><tr><td style="border-top:2px solid ${accent};padding:8px 0 0 0;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td>${contactRows}${socialHtml}</td></tr>${disclaimerRow.replace(' colspan="2"', "")}</table>`;
  } else if (d.template === "compact") {
    const head = [name ? `<b style="color:${INK};">${escapeHtml(name)}</b>` : "", ...roleLine.map(escapeHtml)].filter(Boolean).join(` <span style="color:${accent};">|</span> `);
    const contacts = items.map((it) => link(it.text, it.href, BODY)).join(` <span style="color:${accent};">|</span> `);
    body = `${tableOpen()}<tr>${img ? `<td style="padding:0 12px 0 0;vertical-align:middle;">${img}</td>` : ""}<td style="vertical-align:middle;border-left:2px solid ${accent};padding:0 0 0 10px;"><div style="${FONT}font-size:13px;line-height:19px;color:${BODY};">${head}</div>${contacts ? `<div style="${FONT}font-size:12px;line-height:18px;color:${BODY};">${contacts}</div>` : ""}${socialHtml}</td></tr>${disclaimerRow}</table>`;
  } else {
    body = `${tableOpen()}<tr>${img ? `<td style="padding:0 16px 0 0;vertical-align:top;">${img}</td>` : ""}<td style="vertical-align:top;border-left:3px solid ${accent};padding:0 0 0 14px;">${nameHtml}${roleHtml}<div style="font-size:0;line-height:0;height:8px;">&nbsp;</div>${contactRows}${socialHtml}</td></tr>${disclaimerRow}</table>`;
  }
  return body;
}

/** Full standalone HTML document (download and preview). */
export function buildSignatureDocument(d: SignatureData): string {
  const title = escapeHtml(d.name.trim() ? `Email signature: ${d.name.trim()}` : "Email signature");
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n</head>\n<body style="margin:0;padding:16px;background:#ffffff;">\n${buildSignatureHtml(d)}\n</body>\n</html>\n`;
}

/** Plain-text version used as the text/plain clipboard flavor. */
export function signaturePlainText(d: SignatureData): string {
  const lines: string[] = [];
  if (d.name.trim()) lines.push(d.name.trim());
  const role = [d.title.trim(), d.company.trim()].filter(Boolean).join(" | ");
  if (role) lines.push(role);
  for (const it of contactItems(d)) lines.push(`${it.label}: ${it.text}`);
  for (const s of socialLinks(d)) lines.push(`${s.network}: ${s.href}`);
  if (d.disclaimer.trim()) lines.push("", d.disclaimer.trim());
  return lines.join("\n");
}
