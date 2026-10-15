import type { CatalogTool } from "./types";
import { tools as existing } from "./tools/existing";
import { tools as tPdfA } from "./tools/pdf-a";
import { tools as tPdfB } from "./tools/pdf-b";
import { tools as tImage } from "./tools/image";
import { tools as tBgSocial } from "./tools/bg-social";
import { tools as tAudio } from "./tools/audio";
import { tools as tText } from "./tools/text";
import { tools as tResearchWeb } from "./tools/research-web";
import { tools as tCalcMath } from "./tools/calc-math";
import { tools as tCalcScience } from "./tools/calc-science";
import { tools as tCalcEng } from "./tools/calc-eng";
import { tools as tConverters } from "./tools/converters";
import { tools as tFinance } from "./tools/finance";
import { tools as tDatetimeA } from "./tools/datetime-a";
import { tools as tDatetimeB } from "./tools/datetime-b";
import { tools as tSecurityFiles } from "./tools/security-files";
import { tools as tDeveloper } from "./tools/developer";
import { tools as tBusiness } from "./tools/business";
import { tools as tDesign } from "./tools/design";

/** Every implemented tool, including engines reused by the student catalog. */
const allCatalog: CatalogTool[] = [
  ...existing,
  ...tPdfA,
  ...tPdfB,
  ...tImage,
  ...tBgSocial,
  ...tAudio,
  ...tText,
  ...tResearchWeb,
  ...tCalcMath,
  ...tCalcScience,
  ...tCalcEng,
  ...tConverters,
  ...tFinance,
  ...tDatetimeA,
  ...tDatetimeB,
  ...tSecurityFiles,
  ...tDeveloper,
  ...tBusiness,
  ...tDesign,
];

/**
 * Public /tools catalog: common, broadly useful tasks without near-duplicate
 * variations or specialist calculators that make the directory hard to scan.
 */
const curatedCatalogSlugs = new Set([
  ...existing.map((tool) => tool.slug),

  // PDF and documents
  "pdf-editor",
  "pdf-to-image",
  "pdf-to-text",
  "pdf-to-markdown",
  "image-to-pdf",
  "text-to-pdf",
  "document-scanner",
  "merge-pdf",
  "split-pdf",
  "extract-pdf-pages",
  "delete-pdf-pages",
  "rotate-pdf",
  "reorder-pdf-pages",
  "pdf-info-pages-size-version",
  "sign-pdf",
  "add-watermark-to-pdf",
  "add-page-numbers",
  "crop-pdf",
  "annotate-pdf",
  "pdf-form-filler",
  "compare-pdfs",

  // Images and social media
  "image-converter",
  "heic-to-jpg-png-webp",
  "favicon-and-ico-generator",
  "image-compressor",
  "image-resizer",
  "image-cropper",
  "rotate-and-flip-image",
  "photo-adjustments",
  "image-watermark",
  "screenshot-annotator",
  "image-to-text-ocr",
  "exif-viewer-and-remover",
  "qr-code-generator",
  "qr-code-scanner",
  "barcode-generator",
  "social-media-image-resizer",
  "youtube-thumbnail-maker",
  "open-graph-image-generator",
  "social-post-preview",

  // Audio
  "audio-trimmer",
  "audio-merger",
  "audio-splitter",
  "volume-changer-and-normalizer",
  "audio-speed-changer",
  "voice-recorder",
  "audio-waveform-generator",
  "audio-metadata-and-id3-tag-editor",

  // Text, research, and web
  "readability-checker",
  "word-frequency-counter",
  "case-converter",
  "text-cleaner",
  "remove-duplicate-lines",
  "remove-empty-lines",
  "remove-extra-spaces",
  "sort-lines",
  "find-and-replace",
  "diff-checker",
  "markdown-to-html-converter",
  "html-to-plain-text",
  "lorem-ipsum-generator",
  "apa-citation-generator",
  "mla-citation-generator",
  "chicago-citation-generator",
  "ieee-citation-generator",
  "bibtex-generator",
  "reference-list-generator",
  "literature-matrix",
  "url-encoder-decoder",
  "url-parser",
  "utm-builder",
  "meta-tag-generator",
  "open-graph-and-twitter-card-generator",
  "schema-json-ld-generator",
  "robotstxt-generator",

  // Math and science
  "basic-calculator",
  "scientific-calculator",
  "ratio-and-proportion-calculator",
  "fraction-calculator",
  "exponent-calculator",
  "root-calculator",
  "logarithm-calculator",
  "probability-calculator",
  "equation-solver",
  "quadratic-equation-solver",
  "matrix-calculator",
  "mean-median-and-mode-calculator",
  "standard-deviation-and-variance-calculator",
  "z-score-calculator",
  "confidence-interval-calculator",
  "p-value-calculator",
  "regression-calculator",
  "area-calculator",
  "triangle-calculator",
  "volume-and-surface-area-calculator",
  "speed-distance-and-time-calculator",
  "acceleration-calculator",
  "force-calculator",
  "energy-calculator",
  "power-calculator",
  "density-calculator",
  "molarity-calculator",
  "molecular-weight-calculator",
  "ph-calculator",
  "stoichiometry-calculator",
  "chemical-equation-balancer",
  "periodic-table",

  // Engineering, grades, travel, and everyday calculators
  "ohms-law-calculator",
  "resistor-color-code-calculator",
  "voltage-divider-calculator",
  "stress-calculator",
  "strain-calculator",
  "reynolds-number-calculator",
  "final-grade-calculator",
  "weighted-grade-calculator",
  "gpa-goal-planner",
  "time-calculator",
  "bmi-calculator",
  "random-picker",
  "fuel-cost-calculator",
  "mileage-and-fuel-consumption-calculator",
  "parking-cost-calculator",
  "gps-coordinate-converter",
  "distance-between-coordinates",
  "ev-charging-cost-calculator",

  // Converters
  "length-converter",
  "weight-converter",
  "temperature-converter",
  "area-converter",
  "volume-converter",
  "speed-converter",
  "time-converter",
  "cooking-unit-converter",
  "data-storage-converter",
  "number-base-converter",
  "decimal-to-fraction-converter",
  "scientific-notation-converter",

  // Finance
  "discount-calculator",
  "tip-calculator",
  "bill-splitter",
  "vat-gst-sales-tax-calculator",
  "unit-price-comparison",
  "loan-emi-calculator",
  "mortgage-calculator",
  "compound-interest-calculator",
  "savings-calculator",
  "roi-calculator",
  "budget-planner",
  "expense-tracker",
  "subscription-cost-calculator",
  "student-budget-calculator",
  "rent-affordability-calculator",

  // Date, time, and planning
  "age-calculator",
  "date-difference-calculator",
  "add-subtract-days",
  "business-days-calculator",
  "countdown",
  "time-zone-converter",
  "world-clock",
  "meeting-planner",
  "unix-timestamp-converter",
  "stopwatch",
  "timer-and-alarm",
  "calendar-invite-ics-generator",
  "week-planner",
  "to-do-list-and-checklist",
  "habit-tracker",

  // Security and files
  "password-generator",
  "passphrase-generator",
  "password-strength-checker",
  "2fa-totp-code-generator",
  "hash-generator",
  "file-checksum-calculator-and-verifier",
  "text-encryption-decryption",
  "file-encryption-decryption",
  "zip-creator",
  "archive-extractor",
  "gzip-compressor",
  "batch-file-renamer",
  "duplicate-file-finder",
  "file-comparison",
  "file-metadata-viewer-and-remover",

  // Developer
  "json-to-typescript",
  "json-to-csv-converter",
  "json-to-xml-converter",
  "json-to-yaml-converter",
  "xml-formatter",
  "yaml-formatter",
  "csv-viewer-and-formatter",
  "html-formatter",
  "css-formatter-and-minifier",
  "javascript-formatter-and-minifier",
  "jwt-decoder",
  "uuid-ulid-generator",
  "mock-data-generator",
  "cron-expression-builder-and-parser",
  "regex-explainer",
  "sql-playground",
  "git-command-helper",

  // Business and design
  "invoice-generator",
  "receipt-generator",
  "quotation-generator",
  "purchase-order-generator",
  "expense-report-generator",
  "letterhead-generator",
  "business-card-generator",
  "email-signature-generator",
  "timesheet-and-working-hours-calculator",
  "profit-margin-calculator",
  "break-even-calculator",
  "cash-flow-calculator",
  "resume-builder",
  "portfolio-builder",
  "job-application-tracker",
  "color-picker",
  "color-palette-generator",
  "image-color-extractor",
  "contrast-checker-wcag",
  "css-gradient-generator",
  "css-box-shadow-generator",
  "font-pairing-tool",
  "type-scale-generator",
  "svg-optimizer",
  "flowchart-maker",
  "mind-map-maker",
  "timeline-maker",
]);

export const catalog: CatalogTool[] = allCatalog.filter((tool) => curatedCatalogSlugs.has(tool.slug));

const bySlug = new Map<string, CatalogTool>();
for (const t of catalog) {
  if (bySlug.has(t.slug)) throw new Error(`Duplicate catalog slug: ${t.slug}`);
  bySlug.set(t.slug, t);
}

export const getCatalogTool = (slug: string) => bySlug.get(slug);

const sourceBySlug = new Map(allCatalog.map((tool) => [tool.slug, tool]));
export const getCatalogSourceTool = (slug: string) => sourceBySlug.get(slug);

/** Tools that have their own /tools/<slug> page (not aliases). */
export const catalogPages = catalog.filter((t) => !t.href);

export const catalogHref = (t: Pick<CatalogTool, "slug" | "href">) => t.href ?? `/tools/${t.slug}`;

export function toolsInCategory(slug: string) {
  return catalog.filter((t) => t.category === slug);
}
