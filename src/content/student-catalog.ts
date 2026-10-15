import type { AnyIcon } from "@/components/ui/Icon";
import { getCatalogSourceTool } from "./catalog";
import type { CatalogTool } from "./catalog/types";
import rawStudentTools from "./student-reference.json";
import type { StudentCategory, ToolMeta } from "./tool-types";

export type StudentCategorySlug =
  | "writing-and-text"
  | "research-and-citations"
  | "math"
  | "statistics"
  | "physics"
  | "chemistry"
  | "engineering"
  | "biology"
  | "grades"
  | "productivity"
  | "finance"
  | "career"
  | "developer"
  | "presentations-and-diagrams"
  | "everyday";

export type StudentCategoryGroup = "Write & analyze" | "STEM & grades" | "Plan & build";

export interface StudentToolCategory {
  slug: StudentCategorySlug;
  name: StudentCategory;
  shortName: string;
  description: string;
  icon: AnyIcon;
  group: StudentCategoryGroup;
}

export const studentCategories: StudentToolCategory[] = [
  { slug: "writing-and-text", name: "Writing & Text", shortName: "Writing & text", description: "Count, assess, compare and clean academic writing.", icon: "text", group: "Write & analyze" },
  { slug: "research-and-citations", name: "Research & Citations", shortName: "Research & citations", description: "Build citations, bibliographies and literature matrices.", icon: "book", group: "Write & analyze" },
  { slug: "math", name: "Math", shortName: "Math", description: "Solve arithmetic, algebra, geometry and calculus problems.", icon: "calculator", group: "STEM & grades" },
  { slug: "statistics", name: "Statistics", shortName: "Statistics", description: "Explore distributions, tests, intervals and regression.", icon: "table", group: "STEM & grades" },
  { slug: "physics", name: "Physics", shortName: "Physics", description: "Work through mechanics, electricity and wave calculations.", icon: "atom", group: "STEM & grades" },
  { slug: "chemistry", name: "Chemistry", shortName: "Chemistry", description: "Calculate moles, solutions, gases, equations and decay.", icon: "atom", group: "STEM & grades" },
  { slug: "engineering", name: "Engineering", shortName: "Engineering", description: "Handle electrical, structural and fluid fundamentals.", icon: "bolt", group: "STEM & grades" },
  { slug: "biology", name: "Biology", shortName: "Biology", description: "Explore inheritance patterns and DNA complements.", icon: "heart", group: "STEM & grades" },
  { slug: "grades", name: "Grades", shortName: "Grades", description: "Plan GPA, weighted grades and exam targets.", icon: "grade", group: "STEM & grades" },
  { slug: "productivity", name: "Productivity", shortName: "Productivity", description: "Time study sessions and plan academic work.", icon: "timer", group: "Plan & build" },
  { slug: "finance", name: "Finance", shortName: "Finance", description: "Plan student budgets, loans, rent and savings.", icon: "coin", group: "Plan & build" },
  { slug: "career", name: "Career", shortName: "Career", description: "Build application materials and track opportunities.", icon: "briefcase", group: "Plan & build" },
  { slug: "developer", name: "Developer", shortName: "Developer", description: "Format, convert, test and generate developer data.", icon: "code", group: "Plan & build" },
  { slug: "presentations-and-diagrams", name: "Presentations & Diagrams", shortName: "Presentations & diagrams", description: "Create flowcharts, mind maps and timelines.", icon: "workflow", group: "Plan & build" },
  { slug: "everyday", name: "Everyday", shortName: "Everyday", description: "Use quick converters, clocks, calculators and generators.", icon: "sun", group: "Plan & build" },
];

export const studentCategoryGroups: StudentCategoryGroup[] = ["Write & analyze", "STEM & grades", "Plan & build"];

type RawStudentTool = { category: StudentCategorySlug; slug: string; name: string; sourceSlug: string };

/**
 * Keep the student directory focused on broadly useful academic tasks. The
 * underlying shared tools can still exist in the main tools catalog without
 * creating dozens of duplicate or highly specialized student-facing entries.
 */
const curatedStudentToolSlugs = new Set([
  // Writing and research
  "word-counter",
  "essay-word-count-planner",
  "readability-checker",
  "text-case-converter",
  "text-cleaner",
  "find-and-replace",
  "text-difference-checker",
  "apa-citation-generator",
  "mla-citation-generator",
  "ieee-citation-generator",
  "bibtex-generator",
  "reference-list-generator",
  "literature-matrix",

  // Math and statistics
  "scientific-calculator",
  "fraction-calculator",
  "percentage-calculator",
  "ratio-calculator",
  "quadratic-equation-solver",
  "system-of-equations-solver",
  "matrix-calculator",
  "geometry-calculator",
  "derivative-calculator",
  "mean-average-calculator",
  "standard-deviation-calculator",
  "probability-calculator",
  "z-score-calculator",
  "confidence-interval-calculator",
  "p-value-calculator",
  "regression-calculator",

  // Science and engineering
  "speed-distance-time-calculator",
  "acceleration-calculator",
  "force-calculator",
  "power-calculator",
  "projectile-motion-calculator",
  "ohm-s-law-calculator",
  "wavelength-calculator",
  "molar-mass-calculator",
  "mole-calculator",
  "molarity-calculator",
  "stoichiometry-calculator",
  "chemical-equation-balancer",
  "ph-calculator",
  "periodic-table",
  "voltage-divider-calculator",
  "resistor-calculator",
  "stress-calculator",
  "reynolds-number-calculator",
  "punnett-square-calculator",
  "dna-complement-generator",

  // Grades, planning, and student finance
  "gpa-calculator",
  "gpa-goal-planner",
  "grade-calculator",
  "final-grade-calculator",
  "weighted-grade-calculator",
  "pomodoro-timer",
  "study-timer",
  "exam-countdown",
  "semester-planner",
  "assignment-planner",
  "daily-study-planner",
  "project-planner",
  "calendar",
  "student-budget-calculator",
  "rent-affordability-calculator",
  "student-loan-calculator",
  "savings-calculator",
  "compound-interest-calculator",

  // Career, coding, and presentation work
  "resume-builder",
  "academic-cv-builder",
  "portfolio-builder",
  "job-application-tracker",
  "json-formatter",
  "json-validator",
  "sql-formatter",
  "base64-encoder-decoder",
  "url-encoder-decoder",
  "jwt-decoder",
  "uuid-generator",
  "hash-generator",
  "regex-tester",
  "markdown-editor",
  "sql-playground",
  "git-command-helper",
  "flowchart-maker",
  "mind-map-maker",
  "timeline-maker",

  // Everyday student utilities
  "unit-converter",
  "time-zone-converter",
  "date-calculator",
  "age-calculator",
  "bmi-calculator",
  "random-picker",
  "qr-code-generator",
  "password-generator",
]);

export interface StudentCatalogEntry extends RawStudentTool {
  source: CatalogTool;
  categoryInfo: StudentToolCategory;
}

export const studentCatalog: StudentCatalogEntry[] = (rawStudentTools as RawStudentTool[])
  .filter((item) => curatedStudentToolSlugs.has(item.slug))
  .map((item) => {
  const source = getCatalogSourceTool(item.sourceSlug);
  const categoryInfo = studentCategories.find((category) => category.slug === item.category);
  if (!source) throw new Error(`Missing catalog source for student tool: ${item.slug} -> ${item.sourceSlug}`);
  if (!categoryInfo) throw new Error(`Missing student category: ${item.category}`);
  return { ...item, source, categoryInfo };
  });

const bySlug = new Map(studentCatalog.map((tool) => [tool.slug, tool]));

export const studentToolHref = (slug: string) => `/student-tools/${slug}`;
export const studentCategoryHref = (slug: StudentCategorySlug) => `/student-tools/category/${slug}`;
export const getStudentCatalogTool = (slug: string) => bySlug.get(slug);
export const studentToolsInCategory = (slug: StudentCategorySlug) => studentCatalog.filter((tool) => tool.category === slug);
export const getStudentCategory = (slug: string) => studentCategories.find((category) => category.slug === slug);

function seoDescription(name: string, summary: string) {
  const first = `Use this free ${name.toLowerCase()} in your browser. ${summary}`;
  const padded = `${first} Get clear validation, practical explanations and private local processing with no sign-up required.`;
  if (padded.length <= 160) return padded;
  const clipped = padded.slice(0, 157).replace(/\s+\S*$/, "").replace(/[,:;]$/, "");
  return `${clipped}.`;
}

export function studentToolMeta(entry: StudentCatalogEntry): ToolMeta {
  const related = studentToolsInCategory(entry.category)
    .filter((tool) => tool.slug !== entry.slug)
    .slice(0, 3)
    .map((tool) => tool.slug);
  return {
    slug: entry.slug,
    kind: "student",
    name: entry.name,
    category: entry.categoryInfo.name,
    icon: entry.source.icon,
    summary: entry.source.summary,
    h1: entry.name,
    metaTitle: entry.name,
    metaDescription: seoDescription(entry.name, entry.source.summary),
    primaryKeyword: entry.name.toLowerCase(),
    intro: `${entry.source.intro} This student route uses the same tested browser-based engine while keeping the task easy to find in its subject area.`,
    instructions: entry.source.instructions,
    howItWorks: entry.source.howItWorks,
    example: entry.source.example,
    faqs: entry.source.faqs,
    related,
    learnMore: [{ label: "Learning roadmaps and study guides", href: "/student-tools/resources" }],
  };
}
