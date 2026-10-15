import type { AnyIcon } from "@/components/ui/Icon";
import type { Faq } from "../types";

export type CategorySlug =
  | "pdf"
  | "image"
  | "audio"
  | "text"
  | "research"
  | "web"
  | "calculators"
  | "converters"
  | "finance"
  | "date-time"
  | "security"
  | "developer"
  | "social-media"
  | "everyday"
  | "travel"
  | "business"
  | "design"
  | "files"
  | "ai";

export type CategoryGroup = "Documents & media" | "Text & web" | "Numbers & time" | "Build & work";

export interface ToolCategory {
  slug: CategorySlug;
  name: string;
  icon: AnyIcon;
  /** One sentence, original. */
  description: string;
  group: CategoryGroup;
}

/**
 * One entry in the /tools catalog. Content fields are original copy.
 * Inline markup supported in text fields: `code`, **bold**, [text](/link).
 */
export interface CatalogTool {
  /** Unique across the whole catalog; page lives at /tools/<slug> unless `href` is set. */
  slug: string;
  name: string;
  category: CategorySlug;
  icon: AnyIcon;
  /** Card text, ≤ 20 words. */
  summary: string;
  /** Unique H1, ≤ 10 words. */
  h1: string;
  /** ≤ 52 chars; " | Nuvella Promo Code" is appended. */
  metaTitle: string;
  /** 130-160 chars. */
  metaDescription: string;
  primaryKeyword: string;
  /** 1-2 sentences. */
  intro: string;
  /** 3-5 steps matching the real UI. */
  instructions: string[];
  /** 2-3 short paragraphs explaining the real method and its limits. */
  howItWorks: string[];
  example: { title: string; body: string; input?: string; output?: string };
  /** 3-4 genuinely useful FAQs. */
  faqs: Faq[];
  /** 3 related tool slugs (any category). */
  related: string[];
  /**
   * Plain-language disclosure when any part of the tool uses the network
   * (e.g. downloading an ML model or fonts). Omit when fully offline.
   */
  network?: string;
  /** If set, the card links here (an existing page) and no /tools/<slug> page is generated. */
  href?: string;
  /** Shown in "popular" lists. */
  popular?: boolean;
  /** Not part of the reference inventory (our own addition). */
  original?: boolean;
}
