/**
 * Resume builder model, validation and PDF layout. Pure TypeScript: the layout
 * takes font measurers as parameters so it can be tested in Node with pdf-lib's
 * standard fonts, while the browser passes embedded Noto Sans.
 */

import type { PDFDocument, PDFFont } from "pdf-lib";
import { PAGE_SIZES, cleanPdfText, hexToRgb01, isHexColor, type Measurer, type PageSizeId } from "./pdfText";

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

export type SectionId = "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "links";
export type TemplateId = "classic" | "modern" | "compact";

export const SECTION_LABELS: Record<SectionId, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  links: "Links",
};
export const DEFAULT_ORDER: SectionId[] = ["summary", "experience", "education", "skills", "projects", "certifications", "links"];

export interface Contact {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
}
export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  /** One bullet point per line. */
  bullets: string;
}
export interface EducationItem {
  id: string;
  degree: string;
  school: string;
  location: string;
  start: string;
  end: string;
  details: string;
}
export interface SkillGroup {
  id: string;
  label: string;
  /** Comma-separated skills. */
  items: string;
}
export interface ProjectItem {
  id: string;
  name: string;
  link: string;
  /** One bullet point per line. */
  description: string;
}
export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
}
export interface LinkItem {
  id: string;
  label: string;
  url: string;
}

export interface Resume {
  version: 1;
  contact: Contact;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillGroup[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  links: LinkItem[];
  order: SectionId[];
  template: TemplateId;
  accent: string;
  pageSize: PageSizeId;
}

export type ListKey = "experience" | "education" | "skills" | "projects" | "certifications" | "links";

export const TEMPLATES: { id: TemplateId; label: string; description: string; ats: boolean }[] = [
  { id: "classic", label: "Classic", description: "Single column, centered header, ruled section titles.", ats: true },
  { id: "modern", label: "Modern", description: "Accent color header band and colored section titles.", ats: false },
  { id: "compact", label: "Compact", description: "Single column with tighter spacing to fit more on a page.", ats: true },
];

export const DEFAULT_ACCENT = "#1f6f5c";

let seq = 0;
export const newId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const blankItem = {
  experience: (): ExperienceItem => ({ id: newId(), role: "", company: "", location: "", start: "", end: "", current: false, bullets: "" }),
  education: (): EducationItem => ({ id: newId(), degree: "", school: "", location: "", start: "", end: "", details: "" }),
  skills: (): SkillGroup => ({ id: newId(), label: "", items: "" }),
  projects: (): ProjectItem => ({ id: newId(), name: "", link: "", description: "" }),
  certifications: (): CertificationItem => ({ id: newId(), name: "", issuer: "", date: "" }),
  links: (): LinkItem => ({ id: newId(), label: "", url: "" }),
};

export function emptyResume(): Resume {
  return {
    version: 1,
    contact: { name: "", title: "", email: "", phone: "", location: "" },
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    links: [],
    order: [...DEFAULT_ORDER],
    template: "classic",
    accent: DEFAULT_ACCENT,
    pageSize: "a4",
  };
}

export function sampleResume(): Resume {
  return {
    ...emptyResume(),
    contact: {
      name: "Jordan Rivera",
      title: "Data analyst",
      email: "jordan.rivera@example.com",
      phone: "+1 555 0142",
      location: "Denver, CO",
    },
    summary:
      "Data analyst with four years of experience turning messy operational data into clear reporting. Comfortable owning a question from the first SQL query to the final presentation.",
    experience: [
      {
        id: newId(),
        role: "Data analyst",
        company: "Northwind Logistics",
        location: "Denver, CO",
        start: "Mar 2023",
        end: "",
        current: true,
        bullets:
          "Built a weekly delivery performance dashboard used by 12 regional managers\nRewrote the returns report in SQL, cutting refresh time from 40 to 6 minutes\nPartnered with finance to define a single on-time delivery metric",
      },
      {
        id: newId(),
        role: "Junior analyst",
        company: "Bluebird Retail",
        location: "Boulder, CO",
        start: "Jun 2021",
        end: "Feb 2023",
        current: false,
        bullets: "Maintained inventory forecasts for 300 stores\nAutomated a monthly Excel report with Python",
      },
    ],
    education: [
      {
        id: newId(),
        degree: "B.S. in Statistics",
        school: "University of Colorado",
        location: "Boulder, CO",
        start: "2017",
        end: "2021",
        details: "Minor in economics. Capstone on seasonal demand forecasting.",
      },
    ],
    skills: [
      { id: newId(), label: "Analysis", items: "SQL, Python (pandas), Excel, A/B testing" },
      { id: newId(), label: "Reporting", items: "Power BI, Tableau, Looker Studio" },
    ],
    projects: [
      {
        id: newId(),
        name: "Bike share demand model",
        link: "github.com/jrivera/bike-demand",
        description: "Forecast hourly rentals from weather and calendar data\nPublished the notebook and a short write-up",
      },
    ],
    certifications: [{ id: newId(), name: "Google Data Analytics Certificate", issuer: "Coursera", date: "2022" }],
    links: [
      { id: newId(), label: "LinkedIn", url: "linkedin.com/in/jordanrivera" },
      { id: newId(), label: "Portfolio", url: "jordanrivera.dev" },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Import / normalization                                              */
/* ------------------------------------------------------------------ */

const MAX_FIELD = 5000;
const MAX_ITEMS = 60;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.slice(0, MAX_FIELD) : typeof v === "number" ? String(v) : "");
const idOf = (v: unknown) => (typeof v === "string" && v.trim() && v.length <= 64 ? v : newId());

function list<T>(v: unknown, map: (o: Obj) => T): T[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isObj).slice(0, MAX_ITEMS).map(map);
}

/**
 * Turns unknown JSON (an import or stored data) into a valid Resume.
 * Returns an error string when the shape is not a resume at all.
 */
export function normalizeResume(input: unknown): Resume | string {
  const root = isObj(input) && isObj(input.resume) ? input.resume : input;
  if (!isObj(root)) return "The file does not contain a resume object.";
  if (!isObj(root.contact)) return "This JSON is missing the \"contact\" section, so it does not look like a resume from this tool.";
  const known: (keyof Resume)[] = ["summary", "experience", "education", "skills", "projects", "certifications", "links"];
  for (const k of known) {
    const v = root[k];
    if (v === undefined) continue;
    if (k === "summary" ? typeof v !== "string" : !Array.isArray(v)) return `The "${k}" field has the wrong type.`;
  }
  const c = root.contact;
  const order = Array.isArray(root.order)
    ? root.order.filter((s, i, a): s is SectionId => typeof s === "string" && s in SECTION_LABELS && a.indexOf(s) === i)
    : [];
  for (const s of DEFAULT_ORDER) if (!order.includes(s)) order.push(s);
  const template: TemplateId = root.template === "modern" || root.template === "compact" ? root.template : "classic";
  const accent = typeof root.accent === "string" && isHexColor(root.accent) ? root.accent : DEFAULT_ACCENT;
  return {
    version: 1,
    contact: { name: str(c.name), title: str(c.title), email: str(c.email), phone: str(c.phone), location: str(c.location) },
    summary: str(root.summary),
    experience: list(root.experience, (o) => ({
      id: idOf(o.id),
      role: str(o.role),
      company: str(o.company),
      location: str(o.location),
      start: str(o.start),
      end: str(o.end),
      current: o.current === true,
      bullets: Array.isArray(o.bullets) ? o.bullets.map(str).join("\n") : str(o.bullets),
    })),
    education: list(root.education, (o) => ({
      id: idOf(o.id),
      degree: str(o.degree),
      school: str(o.school),
      location: str(o.location),
      start: str(o.start),
      end: str(o.end),
      details: str(o.details),
    })),
    skills: list(root.skills, (o) => ({
      id: idOf(o.id),
      label: str(o.label),
      items: Array.isArray(o.items) ? o.items.map(str).join(", ") : str(o.items),
    })),
    projects: list(root.projects, (o) => ({ id: idOf(o.id), name: str(o.name), link: str(o.link), description: str(o.description) })),
    certifications: list(root.certifications, (o) => ({ id: idOf(o.id), name: str(o.name), issuer: str(o.issuer), date: str(o.date) })),
    links: list(root.links, (o) => ({ id: idOf(o.id), label: str(o.label), url: str(o.url) })),
    order,
    template,
    accent,
    pageSize: root.pageSize === "letter" ? "letter" : "a4",
  };
}

/** Parses the text of an imported JSON file. */
export function parseResumeJson(text: string): Resume | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return "This file is not valid JSON.";
  }
  return normalizeResume(data);
}

export function exportResumeJson(r: Resume): string {
  return JSON.stringify({ app: "stratum-resume-builder", ...r }, null, 2);
}

/* ------------------------------------------------------------------ */
/* Validation and helpers                                              */
/* ------------------------------------------------------------------ */

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export interface ResumeIssues {
  name?: string;
  email?: string;
  /** Keyed by link or project id. */
  urls: Record<string, string>;
}

/** Looks like a URL or bare domain ("github.com/me"), with no spaces or unsafe scheme. */
export function urlProblem(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  if (/\s/.test(v)) return "Links cannot contain spaces.";
  const scheme = v.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !/^(https?|mailto)$/i.test(scheme[1])) return "Use a web address (https://…) or a domain like github.com/you.";
  if (!scheme && !/^[^/]+\.[a-z]{2,}/i.test(v)) return "This does not look like a web address.";
  return null;
}

export function validateResume(r: Resume): ResumeIssues {
  const issues: ResumeIssues = { urls: {} };
  if (!r.contact.name.trim()) issues.name = "Add your name before exporting.";
  if (r.contact.email.trim() && !isEmail(r.contact.email)) issues.email = "Check the email address format (name@example.com).";
  for (const l of r.links) {
    const p = urlProblem(l.url);
    if (p) issues.urls[l.id] = p;
  }
  for (const p of r.projects) {
    const e = urlProblem(p.link);
    if (e) issues.urls[p.id] = e;
  }
  return issues;
}

export function moveItem<T>(arr: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= arr.length || to < 0 || to >= arr.length) return arr.slice();
  const next = arr.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);

export const splitSkills = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function dateRange(start: string, end: string, current = false): string {
  const a = start.trim();
  const b = current ? "Present" : end.trim();
  if (a && b) return `${a} – ${b}`;
  return a || b;
}

export const joinParts = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(" · ");

/** True when the section has anything to print. */
export function sectionHasContent(r: Resume, s: SectionId): boolean {
  switch (s) {
    case "summary":
      return r.summary.trim() !== "";
    case "experience":
      return r.experience.some((e) => e.role.trim() || e.company.trim() || e.bullets.trim());
    case "education":
      return r.education.some((e) => e.degree.trim() || e.school.trim());
    case "skills":
      return r.skills.some((g) => g.items.trim() || g.label.trim());
    case "projects":
      return r.projects.some((p) => p.name.trim() || p.description.trim());
    case "certifications":
      return r.certifications.some((c) => c.name.trim());
    case "links":
      return r.links.some((l) => l.url.trim());
  }
}

export const contactLine = (c: Contact) => joinParts(c.email, c.phone, c.location);

export function fileSlug(name: string) {
  const s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "resume";
}

/* ------------------------------------------------------------------ */
/* Template styles (shared by the HTML preview and the PDF)            */
/* ------------------------------------------------------------------ */

export interface TemplateStyle {
  margin: number;
  nameSize: number;
  titleSize: number;
  contactSize: number;
  headingSize: number;
  bodySize: number;
  smallSize: number;
  lineHeight: number;
  sectionGap: number;
  itemGap: number;
  centerHeader: boolean;
  band: boolean;
  rule: boolean;
  uppercaseHeadings: boolean;
  accentHeadings: boolean;
}

export const TEMPLATE_STYLES: Record<TemplateId, TemplateStyle> = {
  classic: {
    margin: 54,
    nameSize: 22,
    titleSize: 12,
    contactSize: 9.5,
    headingSize: 10.5,
    bodySize: 10,
    smallSize: 9,
    lineHeight: 1.38,
    sectionGap: 14,
    itemGap: 8,
    centerHeader: true,
    band: false,
    rule: true,
    uppercaseHeadings: true,
    accentHeadings: false,
  },
  modern: {
    margin: 48,
    nameSize: 24,
    titleSize: 12.5,
    contactSize: 9.5,
    headingSize: 12,
    bodySize: 10,
    smallSize: 9,
    lineHeight: 1.4,
    sectionGap: 16,
    itemGap: 9,
    centerHeader: false,
    band: true,
    rule: false,
    uppercaseHeadings: false,
    accentHeadings: true,
  },
  compact: {
    margin: 40,
    nameSize: 18,
    titleSize: 10.5,
    contactSize: 8.5,
    headingSize: 9.5,
    bodySize: 9,
    smallSize: 8.5,
    lineHeight: 1.3,
    sectionGap: 10,
    itemGap: 5,
    centerHeader: false,
    band: false,
    rule: true,
    uppercaseHeadings: true,
    accentHeadings: true,
  },
};

/* ------------------------------------------------------------------ */
/* PDF layout                                                          */
/* ------------------------------------------------------------------ */

export interface RGB {
  r: number;
  g: number;
  b: number;
}
export type DrawOp =
  | { t: "text"; x: number; y: number; text: string; size: number; bold: boolean; color: RGB }
  | { t: "rect"; x: number; y: number; w: number; h: number; color: RGB }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; thickness: number; color: RGB };

export interface LayoutFonts {
  regular: Measurer;
  bold: Measurer;
}

const INK: RGB = { r: 0.1, g: 0.1, b: 0.12 };
const MUTED: RGB = { r: 0.36, g: 0.37, b: 0.4 };
const RULE: RGB = { r: 0.78, g: 0.79, b: 0.8 };
const WHITE: RGB = { r: 1, g: 1, b: 1 };

/** Darkens a color until it reaches at least 4.5:1 on white so accent text stays readable. */
function readableOnWhite(c: RGB): RGB {
  const lum = (x: RGB) => {
    const ch = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * ch(x.r) + 0.7152 * ch(x.g) + 0.0722 * ch(x.b);
  };
  let out = c;
  for (let i = 0; i < 20 && 1.05 / (lum(out) + 0.05) < 4.5; i++) out = { r: out.r * 0.85, g: out.g * 0.85, b: out.b * 0.85 };
  return out;
}

/** Greedy word wrap where the first line has less room (for a bold lead-in like "Skills: "). */
function wrapWithLead(font: Measurer, text: string, size: number, firstWidth: number, width: number): string[] {
  const out: string[] = [];
  const max = () => (out.length === 0 ? firstWidth : width);
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= max();
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const cand = line ? `${line} ${w}` : w;
    if (fits(cand)) {
      line = cand;
      continue;
    }
    if (line) {
      out.push(line);
      line = "";
    }
    if (fits(w)) {
      line = w;
      continue;
    }
    // Hard-break a word longer than the line.
    for (const ch of Array.from(w)) {
      if (!line || fits(line + ch)) line += ch;
      else {
        out.push(line);
        line = ch;
      }
    }
  }
  if (line || !out.length) out.push(line);
  return out;
}

function wrap(font: Measurer, text: string, size: number, width: number): string[] {
  return wrapWithLead(font, text, size, width, width);
}

export interface LayoutResult {
  pages: DrawOp[][];
  width: number;
  height: number;
}

/**
 * Lays the resume out into pages of draw operations. Text is wrapped to the
 * content width and a new page starts whenever the next line would cross the
 * bottom margin. Entry headers are kept with their first line.
 */
export function layoutResume(input: Resume, fonts: LayoutFonts): LayoutResult {
  const r = input;
  const page = PAGE_SIZES[r.pageSize];
  const st = TEMPLATE_STYLES[r.template];
  const accent = readableOnWhite(hexToRgb01(r.accent));
  const band = hexToRgb01(r.accent);
  const headingColor = st.accentHeadings ? accent : INK;
  const m = st.margin;
  const W = page.w - 2 * m;
  const bottom = m;
  const pages: DrawOp[][] = [[]];
  let ops = pages[0];
  let y = page.h - m;
  const t = (s: string) => cleanPdfText(s).replace(/\n/g, " ").trim();
  const lh = (size: number) => size * st.lineHeight;

  const newPage = () => {
    ops = [];
    pages.push(ops);
    y = page.h - m;
  };
  const ensure = (h: number) => {
    if (y - h < bottom) newPage();
  };
  /** Advances one line and returns its baseline. */
  const nextLine = (size: number) => {
    const h = lh(size);
    ensure(h);
    y -= h;
    return y + (h - size) * 0.5 + size * 0.22;
  };
  const textAt = (s: string, x: number, baseline: number, size: number, bold: boolean, color: RGB) => {
    if (s) ops.push({ t: "text", x, y: baseline, text: s, size, bold, color });
  };

  const font = (bold: boolean) => (bold ? fonts.bold : fonts.regular);

  /** A line with bold left text and regular right text (dates). Left wraps if needed. */
  const headerRow = (left: string, right: string, size: number, leftBold = true, leftColor: RGB = INK) => {
    const rw = right ? fonts.regular.widthOfTextAtSize(right, st.smallSize) : 0;
    const leftLines = wrap(font(leftBold), left, size, Math.max(40, W - (rw ? rw + 12 : 0)));
    leftLines.forEach((ln, i) => {
      const b = nextLine(size);
      textAt(ln, m, b, size, leftBold, leftColor);
      if (i === 0 && right) textAt(right, m + W - rw, b, st.smallSize, false, MUTED);
    });
  };
  const para = (s: string, size: number, color: RGB = INK, x = m, width = W) => {
    for (const ln of wrap(fonts.regular, s, size, width)) textAt(ln, x, nextLine(size), size, false, color);
  };
  const bullets = (items: string[]) => {
    const size = st.bodySize;
    const indent = size * 1.2;
    for (const it of items) {
      const ls = wrap(fonts.regular, t(it), size, W - indent);
      ls.forEach((ln, i) => {
        const b = nextLine(size);
        if (i === 0) textAt("•", m + size * 0.25, b, size, false, INK);
        textAt(ln, m + indent, b, size, false, INK);
      });
    }
  };
  const leadLine = (lead: string, rest: string) => {
    const size = st.bodySize;
    const leadText = rest ? `${lead}: ` : lead;
    const lw = fonts.bold.widthOfTextAtSize(leadText, size);
    const ls = rest ? wrapWithLead(fonts.regular, rest, size, W - lw, W) : [""];
    ls.forEach((ln, i) => {
      const b = nextLine(size);
      if (i === 0) {
        textAt(leadText.trimEnd(), m, b, size, true, INK);
        textAt(ln, m + lw, b, size, false, INK);
      } else textAt(ln, m, b, size, false, INK);
    });
  };

  /* ---- header ---- */
  const c = r.contact;
  const name = t(c.name) || "Your name";
  const title = t(c.title);
  const contact = t(contactLine(c));
  if (st.band) {
    const pad = 18;
    const nameLines = wrap(fonts.bold, name, st.nameSize, W);
    const contactLines = contact ? wrap(fonts.regular, contact, st.contactSize, W) : [];
    const h =
      pad * 2 +
      nameLines.length * lh(st.nameSize) +
      (title ? lh(st.titleSize) : 0) +
      (contactLines.length ? 4 + contactLines.length * lh(st.contactSize) : 0);
    ops.push({ t: "rect", x: 0, y: page.h - h, w: page.w, h, color: band });
    const onBand = bandTextColor(band);
    y = page.h - pad;
    for (const ln of nameLines) textAt(ln, m, nextLine(st.nameSize), st.nameSize, true, onBand);
    if (title) textAt(title, m, nextLine(st.titleSize), st.titleSize, false, onBand);
    if (contactLines.length) y -= 4;
    for (const ln of contactLines) textAt(ln, m, nextLine(st.contactSize), st.contactSize, false, onBand);
    y = page.h - h - st.sectionGap;
  } else {
    const centered = (s: string, size: number, bold: boolean, color: RGB) => {
      for (const ln of wrap(font(bold), s, size, W)) {
        const w = font(bold).widthOfTextAtSize(ln, size);
        textAt(ln, st.centerHeader ? m + (W - w) / 2 : m, nextLine(size), size, bold, color);
      }
    };
    centered(name, st.nameSize, true, st.accentHeadings ? accent : INK);
    if (title) centered(title, st.titleSize, false, MUTED);
    if (contact) centered(contact, st.contactSize, false, MUTED);
    y -= st.sectionGap * 0.6;
  }

  /* ---- sections ---- */
  const heading = (label: string) => {
    const size = st.headingSize;
    const s = st.uppercaseHeadings ? label.toUpperCase() : label;
    // Keep the heading with at least two body lines.
    ensure(lh(size) + 4 + lh(st.bodySize) * 2);
    const b = nextLine(size);
    textAt(s, m, b, size, true, headingColor);
    if (st.rule) {
      y -= 3;
      ops.push({ t: "line", x1: m, y1: y, x2: m + W, y2: y, thickness: 0.6, color: st.accentHeadings ? accent : RULE });
    }
    y -= 4;
  };
  const keepTogether = (rows: number) => ensure(lh(st.bodySize) * rows + 2);

  let first = true;
  for (const s of r.order) {
    if (!sectionHasContent(r, s)) continue;
    if (!first) y -= st.sectionGap;
    first = false;
    heading(SECTION_LABELS[s]);
    switch (s) {
      case "summary":
        for (const p of r.summary.split(/\n\s*\n/)) {
          para(t(p), st.bodySize);
        }
        break;
      case "experience": {
        const items = r.experience.filter((e) => e.role.trim() || e.company.trim() || e.bullets.trim());
        items.forEach((e, i) => {
          if (i > 0) y -= st.itemGap;
          keepTogether(3);
          headerRow(t(e.role) || t(e.company), t(dateRange(e.start, e.end, e.current)), st.bodySize + 0.5);
          const sub = t(joinParts(e.role.trim() ? e.company : "", e.location));
          if (sub) para(sub, st.smallSize, MUTED);
          bullets(lines(e.bullets));
        });
        break;
      }
      case "education": {
        const items = r.education.filter((e) => e.degree.trim() || e.school.trim());
        items.forEach((e, i) => {
          if (i > 0) y -= st.itemGap;
          keepTogether(2);
          headerRow(t(e.degree) || t(e.school), t(dateRange(e.start, e.end)), st.bodySize + 0.5);
          const sub = t(joinParts(e.degree.trim() ? e.school : "", e.location));
          if (sub) para(sub, st.smallSize, MUTED);
          if (e.details.trim()) para(t(e.details), st.bodySize);
        });
        break;
      }
      case "skills":
        for (const g of r.skills) {
          const items = splitSkills(g.items).map(t).join(", ");
          if (g.label.trim()) leadLine(t(g.label), items);
          else if (items) para(items, st.bodySize);
        }
        break;
      case "projects": {
        const items = r.projects.filter((p) => p.name.trim() || p.description.trim());
        items.forEach((p, i) => {
          if (i > 0) y -= st.itemGap;
          keepTogether(2);
          headerRow(t(p.name), "", st.bodySize + 0.5);
          if (p.link.trim()) para(t(p.link), st.smallSize, accent);
          bullets(lines(p.description));
        });
        break;
      }
      case "certifications":
        for (const ce of r.certifications.filter((x) => x.name.trim())) {
          headerRow(t(joinParts(ce.name, ce.issuer)), t(ce.date), st.bodySize, false);
        }
        break;
      case "links":
        for (const l of r.links.filter((x) => x.url.trim())) {
          if (l.label.trim()) leadLine(t(l.label), t(l.url));
          else para(t(l.url), st.bodySize);
        }
        break;
    }
  }

  /* ---- footer page numbers ---- */
  if (pages.length > 1) {
    const size = 8;
    pages.forEach((p, i) => {
      const label = `${name} · Page ${i + 1} of ${pages.length}`;
      const w = fonts.regular.widthOfTextAtSize(label, size);
      p.push({ t: "text", x: m + W - w, y: m / 2, text: label, size, bold: false, color: MUTED });
    });
  }
  return { pages, width: page.w, height: page.h };
}

/** White or near-black text, whichever contrasts more with the band color. */
export function bandTextColor(c: RGB): RGB {
  const ch = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const L = 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  const onWhite = 1.05 / (L + 0.05);
  const onDark = (L + 0.05) / 0.06;
  return onWhite >= onDark ? WHITE : INK;
}

/** CSS color for the preview, matching the PDF's accent adjustment. */
export function readableAccentCss(hex: string): string {
  const c = readableOnWhite(hexToRgb01(hex));
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}
export function bandTextCss(hex: string): string {
  const c = bandTextColor(hexToRgb01(hex));
  return c === WHITE ? "#ffffff" : "#1a1a1f";
}

type RgbFn = (r: number, g: number, b: number) => ReturnType<typeof import("pdf-lib").rgb>;

/** Draws the layout into a pdf-lib document using the given fonts. */
export function renderResumePdf(doc: PDFDocument, r: Resume, fonts: { regular: PDFFont; bold: PDFFont }, rgb: RgbFn) {
  const layout = layoutResume(r, fonts);
  for (const ops of layout.pages) {
    const page = doc.addPage([layout.width, layout.height]);
    for (const op of ops) {
      if (op.t === "text") {
        page.drawText(op.text, {
          x: op.x,
          y: op.y,
          size: op.size,
          font: op.bold ? fonts.bold : fonts.regular,
          color: rgb(op.color.r, op.color.g, op.color.b),
        });
      } else if (op.t === "rect") {
        page.drawRectangle({ x: op.x, y: op.y, width: op.w, height: op.h, color: rgb(op.color.r, op.color.g, op.color.b) });
      } else {
        page.drawLine({
          start: { x: op.x1, y: op.y1 },
          end: { x: op.x2, y: op.y2 },
          thickness: op.thickness,
          color: rgb(op.color.r, op.color.g, op.color.b),
        });
      }
    }
  }
  const name = r.contact.name.trim();
  doc.setTitle(name ? `${name}, resume` : "Resume");
  if (name) doc.setAuthor(name);
  doc.setCreator("Nuvella Promo Code resume builder");
  doc.setProducer("pdf-lib");
  return layout.pages.length;
}
