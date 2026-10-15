import type { Faq } from "./types";
import type { AnyIcon } from "@/components/ui/Icon";

export type ToolKind = "engineering" | "student";

export type EngineeringCategory =
  | "AI Engineering"
  | "Developer Utilities"
  | "Data and APIs"
  | "Text and Content"
  | "Testing and Validation";

export type StudentCategory =
  | "Writing & Text"
  | "Research & Citations"
  | "Math"
  | "Statistics"
  | "Physics"
  | "Chemistry"
  | "Engineering"
  | "Biology"
  | "Grades"
  | "Productivity"
  | "Finance"
  | "Career"
  | "Developer"
  | "Presentations & Diagrams"
  | "Everyday"
  | "Academic Calculators"
  | "Study Productivity"
  | "Writing and References"
  | "Programming Practice"
  | "Learning Resources";

/**
 * Supporting content for a tool page. The interactive component lives in
 * src/components/tools/<kind>/<slug>.tsx and is wired up in the registry.
 * Inline markup supported: `code`, **bold**, [text](/link).
 */
export interface ToolMeta {
  slug: string;
  kind: ToolKind;
  /** Short name for cards and nav, e.g. "JSON formatter". */
  name: string;
  category: EngineeringCategory | StudentCategory;
  icon: AnyIcon;
  /** Card description, ≤ 20 words. */
  summary: string;
  /** Unique H1, ≤ 9 words. */
  h1: string;
  /** ≤ 50 chars; " | Nuvella Promo Code" is appended. */
  metaTitle: string;
  /** 140-160 chars. */
  metaDescription: string;
  primaryKeyword: string;
  /** 1-2 sentences under the H1. */
  intro: string;
  /** 3-5 ordered steps. */
  instructions: string[];
  /** 2-3 short paragraphs. */
  howItWorks: string[];
  example: { title: string; body: string; input?: string; output?: string };
  /** 4 genuinely useful FAQs. */
  faqs: Faq[];
  /** 3 slugs of related tools of the same kind. */
  related: string[];
  /** Article or service slugs worth linking, as paths ("/articles/x"). */
  learnMore?: { label: string; href: string }[];
}
