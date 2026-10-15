/**
 * Content model for the site. All marketing copy lives in /src/content so it
 * can be edited (or swapped for a CMS) without touching presentation code.
 *
 * Inline text fields support a tiny markup subset rendered by <RichText>:
 *   `code`, **bold**, [link text](/internal-or-https-url)
 */

export type IconName =
  | "app"
  | "agent"
  | "rag"
  | "llm"
  | "workflow"
  | "data"
  | "code"
  | "deploy"
  | "shield"
  | "gauge"
  | "layers"
  | "search"
  | "check"
  | "spark";

export type ServiceGroup = "Build" | "Integrate" | "Grow" | "Operate";

export interface Faq {
  q: string;
  a: string;
}

export interface TitledText {
  title: string;
  body: string;
}

export interface Service {
  slug: string;
  /** Full name, used in H1-adjacent contexts and lists. */
  title: string;
  /** 1-3 words for nav menus. */
  navLabel: string;
  group: ServiceGroup;
  icon: IconName;
  /** <title> without brand suffix, ≤ 60 chars incl. suffix " | Nuvella Promo Code". */
  metaTitle: string;
  /** 140-160 chars. */
  metaDescription: string;
  /** Single primary search intent this page targets. */
  primaryKeyword: string;
  secondaryKeywords: string[];
  /** Unique H1 for the service page. */
  h1: string;
  /** Card / menu description, ≤ 22 words. */
  summary: string;
  /** Page intro, 2-3 sentences. */
  intro: string;
  /** Business problems this solves (3-4). */
  problems: TitledText[];
  /** Concrete things the client receives (4-6 short items). */
  deliverables: string[];
  /** Implementation process (4 steps). */
  approach: TitledText[];
  /** Typical technologies, honest and specific. */
  stack: string[];
  /** Systems it commonly connects to. */
  integrations: string[];
  /** 4 service-specific FAQs. */
  faqs: Faq[];
  relatedProjects: string[];
  relatedArticles: string[];
  /** Keep focused homepage curation stable as the full service catalog grows. */
  featuredOnHome?: boolean;
}

export type ProjectVisual = "pipeline" | "graph" | "agent" | "console";

export interface Project {
  slug: string;
  title: string;
  /**
   * "illustrative" = a reference build / scenario written to show approach,
   * NOT a completed client engagement. Must be labelled as such in the UI.
   */
  kind: "illustrative" | "client";
  sector: string;
  metaTitle: string;
  metaDescription: string;
  /** One sentence for cards. */
  summary: string;
  challenge: string;
  /** How we would / did approach it (3-4 paragraphs-worth of points). */
  solution: string[];
  /** Ordered architecture nodes, rendered as a flow diagram. */
  architecture: { label: string; detail: string }[];
  stack: string[];
  phases: TitledText[];
  /**
   * For illustrative projects these are design targets / evaluation criteria,
   * phrased as such — never as achieved results.
   */
  outcomes: TitledText[];
  services: string[];
  visual: ProjectVisual;
}

export type ArticleCategory =
  | "RAG"
  | "Agents"
  | "LLM Engineering"
  | "Production"
  | "Data";

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string; id: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; lang: string; code: string; caption?: string }
  | { type: "callout"; title?: string; text: string }
  | { type: "quote"; text: string };

export interface Article {
  slug: string;
  title: string;
  /** Optional shorter <title>; defaults to title. */
  metaTitle?: string;
  /** Meta description + card excerpt, 140-160 chars. */
  description: string;
  category: ArticleCategory;
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string;
  updatedAt?: string;
  author: { name: string; role: string };
  primaryKeyword: string;
  relatedServices: string[];
  body: Block[];
}
