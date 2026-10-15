/**
 * Tools that already existed before the full catalog: the original 10
 * engineering tools (pages at /tools/<slug>) and six reference-inventory tools
 * that are served by existing student-tool pages (aliases with `href`, so no
 * duplicate pages are created).
 */
import type { CatalogTool, CategorySlug } from "../types";
import type { ToolMeta } from "../../tool-types";
import { engineeringTools } from "../../tools-engineering";
import { studentTools } from "../../tools-student";

const engineeringCategory: Record<string, CategorySlug> = {
  "prompt-builder": "ai",
  "ai-use-case-planner": "ai",
  "rag-readiness-checklist": "ai",
  "token-estimator": "ai",
  "api-request-builder": "developer",
  "json-formatter": "developer",
  "regex-tester": "developer",
  "sql-formatter": "developer",
  "base64-encoder-decoder": "developer",
  "markdown-previewer": "text",
};

const popular = new Set(["json-formatter", "regex-tester", "prompt-builder", "sql-formatter"]);

function fromMeta(t: ToolMeta, category: CategorySlug, extra: Partial<CatalogTool> = {}): CatalogTool {
  return {
    slug: t.slug,
    name: t.name,
    category,
    icon: t.icon,
    summary: t.summary,
    h1: t.h1,
    metaTitle: t.metaTitle,
    metaDescription: t.metaDescription,
    primaryKeyword: t.primaryKeyword,
    intro: t.intro,
    instructions: t.instructions,
    howItWorks: t.howItWorks,
    example: t.example,
    faqs: t.faqs,
    related: t.related,
    ...extra,
  };
}

export const engineeringCatalog: CatalogTool[] = engineeringTools.map((t) =>
  fromMeta(t, engineeringCategory[t.slug] ?? "developer", {
    popular: popular.has(t.slug),
    original: engineeringCategory[t.slug] === "ai" || t.slug === "api-request-builder",
  }),
);

/** [catalog slug, student tool slug, category, display name] */
const aliases: [string, string, CategorySlug, string][] = [
  ["word-and-character-counter", "word-counter", "text", "Word & character counter"],
  ["percentage-calculator", "percentage-calculator", "calculators", "Percentage calculator"],
  ["gpa-calculator", "gpa-calculator", "calculators", "GPA calculator"],
  ["grade-calculator", "grade-calculator", "calculators", "Grade calculator"],
  ["pomodoro-timer", "pomodoro-timer", "date-time", "Pomodoro timer"],
  ["assignment-planner", "assignment-planner", "date-time", "Assignment planner"],
];

export const aliasCatalog: CatalogTool[] = aliases.flatMap(([slug, studentSlug, category, name]) => {
  const s = studentTools.find((t) => t.slug === studentSlug);
  return s ? [fromMeta(s, category, { slug, name, href: `/student-tools/${studentSlug}`, popular: slug === "word-and-character-counter" || slug === "percentage-calculator" })] : [];
});

export const tools: CatalogTool[] = [...engineeringCatalog, ...aliasCatalog];
