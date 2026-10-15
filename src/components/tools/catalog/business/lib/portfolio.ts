/**
 * Portfolio builder: model, validation and a generator for one self-contained,
 * accessible HTML file. All user text is HTML-escaped, links are limited to
 * http(s) and mailto, and a Content-Security-Policy blocks every external request.
 */

import { isHexColor } from "./pdfText";

export type PortfolioTheme = "light" | "dark" | "auto";

export interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  /** Comma-separated tags. */
  tags: string;
  link: string;
}
export interface PortfolioLink {
  id: string;
  label: string;
  url: string;
}
export interface Portfolio {
  version: 1;
  name: string;
  headline: string;
  bio: string;
  location: string;
  email: string;
  avatarMode: "initials" | "image" | "none";
  /** data:image/... URL (downscaled before storing). */
  avatar: string;
  projects: PortfolioProject[];
  /** Comma-separated skills. */
  skills: string;
  links: PortfolioLink[];
  accent: string;
  theme: PortfolioTheme;
}

export const DEFAULT_ACCENT = "#2f6fdb";

let seq = 0;
export const newId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const blankProject = (): PortfolioProject => ({ id: newId(), title: "", description: "", tags: "", link: "" });
export const blankLink = (): PortfolioLink => ({ id: newId(), label: "", url: "" });

export function emptyPortfolio(): Portfolio {
  return {
    version: 1,
    name: "",
    headline: "",
    bio: "",
    location: "",
    email: "",
    avatarMode: "initials",
    avatar: "",
    projects: [],
    skills: "",
    links: [],
    accent: DEFAULT_ACCENT,
    theme: "light",
  };
}

export function samplePortfolio(): Portfolio {
  return {
    ...emptyPortfolio(),
    name: "Maya Chen",
    headline: "Product designer focused on accessible web apps",
    bio: "I design and prototype interfaces for small teams that ship often. Most of my work sits between research and front-end code.\n\nCurrently open to freelance projects and part-time roles.",
    location: "Toronto, Canada",
    email: "maya.chen@example.com",
    projects: [
      {
        id: newId(),
        title: "Clinic booking flow",
        description: "Redesigned a three-step appointment flow and tested it with screen reader users.",
        tags: "UX research, Accessibility, Figma",
        link: "https://example.com/clinic-case-study",
      },
      {
        id: newId(),
        title: "Recipe scaler",
        description: "A tiny web app that rescales ingredient lists and converts units.",
        tags: "HTML, CSS, JavaScript",
        link: "https://example.com/recipe-scaler",
      },
    ],
    skills: "Interaction design, Prototyping, Usability testing, HTML and CSS, Design systems",
    links: [
      { id: newId(), label: "GitHub", url: "https://github.com/example" },
      { id: newId(), label: "LinkedIn", url: "https://www.linkedin.com/in/example" },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const isEmail = (s: string) => /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(s.trim());

/**
 * Validates a link and returns a normalized absolute URL. Only http, https
 * and mailto are allowed. A bare domain ("github.com/me") gets https://.
 */
export function safeUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const v = raw.trim();
  if (!v) return { ok: false, error: "Add a link." };
  if (/\s/.test(v)) return { ok: false, error: "Links cannot contain spaces." };
  if (/^mailto:/i.test(v)) {
    return isEmail(v.slice(7).split("?")[0]) ? { ok: true, url: v } : { ok: false, error: "The mailto link needs a valid email address." };
  }
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(v);
  if (hasScheme && !/^https?:\/\//i.test(v)) return { ok: false, error: "Only http, https and mailto links are allowed." };
  let u: URL;
  try {
    u = new URL(hasScheme ? v : `https://${v}`);
  } catch {
    return { ok: false, error: "This is not a valid web address." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "Only http, https and mailto links are allowed." };
  if (!u.hostname.includes(".") && u.hostname !== "localhost") return { ok: false, error: "This is not a valid web address." };
  return { ok: true, url: u.href };
}

/** Error text for a link field (null when empty or valid). */
export const linkError = (raw: string) => {
  if (!raw.trim()) return null;
  const r = safeUrl(raw);
  return r.ok ? null : r.error;
};

const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
export const MAX_AVATAR_CHARS = 200_000;
export const isSafeAvatar = (s: string) => s.length <= MAX_AVATAR_CHARS && AVATAR_RE.test(s);

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export const splitList = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export interface PortfolioIssues {
  name?: string;
  email?: string;
  accent?: string;
  /** Keyed by project or link id. */
  urls: Record<string, string>;
}

export function validatePortfolio(p: Portfolio): PortfolioIssues {
  const out: PortfolioIssues = { urls: {} };
  if (!p.name.trim()) out.name = "Add your name.";
  if (p.email.trim() && !isEmail(p.email)) out.email = "Check the email address format (name@example.com).";
  if (!isHexColor(p.accent)) out.accent = "Use a hex color like #2f6fdb.";
  for (const pr of p.projects) {
    const e = linkError(pr.link);
    if (e) out.urls[pr.id] = e;
  }
  for (const l of p.links) {
    const e = l.url.trim() ? linkError(l.url) : l.label.trim() ? "Add a link or remove this row." : null;
    if (e) out.urls[l.id] = e;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Normalization (stored drafts)                                       */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
const idOf = (v: unknown) => (typeof v === "string" && v && v.length <= 64 ? v : newId());

export function normalizePortfolio(input: unknown): Portfolio {
  const base = emptyPortfolio();
  if (!isObj(input)) return base;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter(isObj).slice(0, 50) : []);
  const avatar = str(input.avatar, MAX_AVATAR_CHARS);
  return {
    version: 1,
    name: str(input.name, 200),
    headline: str(input.headline, 300),
    bio: str(input.bio),
    location: str(input.location, 200),
    email: str(input.email, 200),
    avatarMode: input.avatarMode === "image" || input.avatarMode === "none" ? input.avatarMode : "initials",
    avatar: isSafeAvatar(avatar) ? avatar : "",
    projects: arr(input.projects).map((o) => ({
      id: idOf(o.id),
      title: str(o.title, 300),
      description: str(o.description),
      tags: str(o.tags, 500),
      link: str(o.link, 2000),
    })),
    skills: str(input.skills, 2000),
    links: arr(input.links).map((o) => ({ id: idOf(o.id), label: str(o.label, 100), url: str(o.url, 2000) })),
    accent: typeof input.accent === "string" && isHexColor(input.accent) ? input.accent : base.accent,
    theme: input.theme === "dark" || input.theme === "auto" ? input.theme : "light",
  };
}

/* ------------------------------------------------------------------ */
/* Color                                                               */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function luminance([r, g, b]: [number, number, number]) {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
export function contrast(a: string, b: string) {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

/** Mixes the accent toward black or white until it reaches 4.5:1 against the background. */
export function readableAccent(accent: string, bg: string): string {
  const a = isHexColor(accent) ? accent : DEFAULT_ACCENT;
  const target = luminance(hexToRgb(bg)) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  const rgb = hexToRgb(a);
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const mixed = toHex(rgb.map((v, k) => v + (target[k] - v) * t));
    if (contrast(mixed, bg) >= 4.5) return mixed;
  }
  return toHex(target);
}

const PALETTES = {
  light: { bg: "#ffffff", surface: "#f4f5f7", ink: "#16181d", muted: "#545a66", line: "#dde0e6" },
  dark: { bg: "#111318", surface: "#1b1e25", ink: "#eef0f4", muted: "#a8aebb", line: "#2e333d" },
};

/* ------------------------------------------------------------------ */
/* HTML generator                                                      */
/* ------------------------------------------------------------------ */

function paletteCss(p: (typeof PALETTES)["light"], accent: string) {
  const link = readableAccent(accent, p.bg);
  const onAccent = contrast("#ffffff", accent) >= contrast("#111111", accent) ? "#ffffff" : "#111111";
  return `--bg:${p.bg};--surface:${p.surface};--ink:${p.ink};--muted:${p.muted};--line:${p.line};--link:${link};--accent:${accent};--on-accent:${onAccent};`;
}

function paragraphs(text: string, indent: string) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `${indent}<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/** Builds the complete HTML document. Every user value is escaped. */
export function generatePortfolioHtml(input: Portfolio, year = new Date().getFullYear()): string {
  const p = input;
  const e = escapeHtml;
  const name = p.name.trim() || "Your name";
  const accent = isHexColor(p.accent) ? p.accent : DEFAULT_ACCENT;
  const headline = p.headline.trim();
  const description = (headline || p.bio.trim().split("\n")[0] || `Portfolio of ${name}`).slice(0, 160);

  const themeCss =
    p.theme === "auto"
      ? `:root{color-scheme:light dark;${paletteCss(PALETTES.light, accent)}}\n@media (prefers-color-scheme:dark){:root{${paletteCss(PALETTES.dark, accent)}}}`
      : `:root{color-scheme:${p.theme};${paletteCss(PALETTES[p.theme], accent)}}`;

  const css = `${themeCss}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 1.0625rem/1.65 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
a{color:var(--link);text-underline-offset:.18em}
a:hover{text-decoration-thickness:2px}
a:focus-visible{outline:3px solid var(--link);outline-offset:3px;border-radius:4px}
.skip{position:absolute;left:1rem;top:-4rem;padding:.6rem 1rem;background:var(--accent);color:var(--on-accent);border-radius:8px;z-index:10}
.skip:focus{top:1rem}
.wrap{max-width:52rem;margin:0 auto;padding:0 1.25rem}
header.hero{padding:4rem 0 2.5rem;border-bottom:1px solid var(--line)}
.hero .wrap{display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap}
.avatar{width:6rem;height:6rem;border-radius:50%;flex:none;object-fit:cover;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-size:2rem;font-weight:700;letter-spacing:.02em}
h1{margin:0;font-size:clamp(2rem,6vw,2.75rem);line-height:1.1;letter-spacing:-.02em}
.headline{margin:.5rem 0 0;font-size:1.2rem;color:var(--muted)}
.meta{margin:.5rem 0 0;color:var(--muted);font-size:.95rem}
main section{padding:2.5rem 0;border-bottom:1px solid var(--line)}
h2{margin:0 0 1rem;font-size:1.35rem;letter-spacing:-.01em}
h2::before{content:"";display:inline-block;width:.6rem;height:.6rem;border-radius:2px;background:var(--accent);margin-right:.6rem;vertical-align:.12em}
.projects{list-style:none;margin:0;padding:0;display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))}
.card{height:100%;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:1.25rem;display:flex;flex-direction:column;gap:.6rem}
.card h3{margin:0;font-size:1.1rem}
.card p{margin:0;color:var(--muted)}
.tags{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.4rem}
.tags li{font-size:.8rem;padding:.15rem .6rem;border-radius:999px;border:1px solid var(--line)}
.card a{margin-top:auto;font-weight:600}
.skills{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.5rem}
.skills li{padding:.35rem .8rem;border-radius:8px;background:var(--surface);border:1px solid var(--line)}
footer{padding:2.5rem 0 3rem}
footer ul{list-style:none;margin:0 0 1.25rem;padding:0;display:flex;flex-wrap:wrap;gap:.5rem 1.25rem}
footer a{display:inline-block;padding:.35rem 0}
.small{color:var(--muted);font-size:.875rem;margin:0}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media print{.skip{display:none}body{background:#fff;color:#000}}`;

  const out: string[] = [];
  out.push("<!doctype html>");
  out.push('<html lang="en">');
  out.push("<head>");
  out.push('<meta charset="utf-8">');
  out.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  out.push(
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`,
  );
  out.push('<meta name="referrer" content="no-referrer">');
  out.push(`<title>${e(headline ? `${name}, ${headline}` : name)}</title>`);
  out.push(`<meta name="description" content="${e(description)}">`);
  out.push(`<style>\n${css}\n</style>`);
  out.push("</head>");
  out.push("<body>");
  out.push('<a class="skip" href="#main">Skip to content</a>');

  // Header
  out.push('<header class="hero">');
  out.push('  <div class="wrap">');
  if (p.avatarMode === "image" && isSafeAvatar(p.avatar)) {
    out.push(`    <img class="avatar" src="${p.avatar}" alt="Photo of ${e(name)}" width="96" height="96">`);
  } else if (p.avatarMode === "initials" || p.avatarMode === "image") {
    out.push(`    <div class="avatar" aria-hidden="true">${e(initials(name))}</div>`);
  }
  out.push("    <div>");
  out.push(`      <h1>${e(name)}</h1>`);
  if (headline) out.push(`      <p class="headline">${e(headline)}</p>`);
  if (p.location.trim()) out.push(`      <p class="meta">${e(p.location.trim())}</p>`);
  out.push("    </div>");
  out.push("  </div>");
  out.push("</header>");

  out.push('<main id="main">');
  out.push('  <div class="wrap">');

  if (p.bio.trim()) {
    out.push('    <section aria-labelledby="about-title">');
    out.push('      <h2 id="about-title">About</h2>');
    out.push(paragraphs(p.bio, "      "));
    out.push("    </section>");
  }

  const projects = p.projects.filter((x) => x.title.trim() || x.description.trim());
  if (projects.length) {
    out.push('    <section aria-labelledby="projects-title">');
    out.push('      <h2 id="projects-title">Projects</h2>');
    out.push('      <ul class="projects">');
    for (const pr of projects) {
      const title = pr.title.trim() || "Untitled project";
      out.push("        <li>");
      out.push('          <article class="card">');
      out.push(`            <h3>${e(title)}</h3>`);
      if (pr.description.trim()) out.push(`            <p>${e(pr.description.trim()).replace(/\n/g, "<br>")}</p>`);
      const tags = splitList(pr.tags);
      if (tags.length) {
        out.push(`            <ul class="tags" aria-label="Tags">${tags.map((t) => `<li>${e(t)}</li>`).join("")}</ul>`);
      }
      const link = pr.link.trim() ? safeUrl(pr.link) : null;
      if (link && link.ok) {
        out.push(`            <a href="${e(link.url)}" rel="noopener noreferrer">View project<span class="sr-only">: ${e(title)}</span></a>`);
      }
      out.push("          </article>");
      out.push("        </li>");
    }
    out.push("      </ul>");
    out.push("    </section>");
  }

  const skills = splitList(p.skills);
  if (skills.length) {
    out.push('    <section aria-labelledby="skills-title">');
    out.push('      <h2 id="skills-title">Skills</h2>');
    out.push(`      <ul class="skills">${skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`);
    out.push("    </section>");
  }

  out.push("  </div>");
  out.push("</main>");

  // Footer with contact and social links
  const contactLinks: string[] = [];
  if (p.email.trim() && isEmail(p.email)) {
    const addr = p.email.trim();
    contactLinks.push(`<li><a href="mailto:${e(addr)}">${e(addr)}</a></li>`);
  }
  for (const l of p.links) {
    const r = l.url.trim() ? safeUrl(l.url) : null;
    if (!r || !r.ok) continue;
    const label = l.label.trim() || r.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    contactLinks.push(`<li><a href="${e(r.url)}" rel="noopener noreferrer me">${e(label)}</a></li>`);
  }
  out.push("<footer>");
  out.push('  <div class="wrap">');
  if (contactLinks.length) {
    out.push('    <h2 id="contact-title">Contact</h2>');
    out.push('    <nav aria-labelledby="contact-title">');
    out.push(`      <ul>${contactLinks.join("")}</ul>`);
    out.push("    </nav>");
  }
  out.push(`    <p class="small">&copy; ${year} ${e(name)}</p>`);
  out.push("  </div>");
  out.push("</footer>");
  out.push("</body>");
  out.push("</html>");
  return out.join("\n");
}

export function portfolioFileName(name: string) {
  const s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${s || "portfolio"}.html`;
}
