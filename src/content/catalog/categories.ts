import type { CategorySlug, ToolCategory } from "./types";

export const categories: ToolCategory[] = [
  { slug: "pdf", name: "PDF & documents", icon: "file", group: "Documents & media", description: "Convert, merge, split, sign and edit PDFs without uploading them anywhere." },
  { slug: "image", name: "Images", icon: "image", group: "Documents & media", description: "Convert, compress, resize and edit images, plus QR codes, barcodes and background removal." },
  { slug: "audio", name: "Audio", icon: "wave", group: "Documents & media", description: "Trim, merge, speed up, normalize and inspect audio files in the browser." },
  { slug: "files", name: "File management", icon: "folder", group: "Documents & media", description: "Create and extract archives, rename in bulk, compare files and strip metadata." },
  { slug: "text", name: "Text", icon: "text", group: "Text & web", description: "Count, clean, sort, compare and convert text in dozens of everyday ways." },
  { slug: "research", name: "Research & citations", icon: "book", group: "Text & web", description: "Citation generators for APA, MLA, Chicago, Harvard, IEEE and BibTeX." },
  { slug: "web", name: "Web & URL", icon: "globe", group: "Text & web", description: "URL utilities, SEO meta tags, structured data and robots.txt helpers." },
  { slug: "social-media", name: "Social media", icon: "share", group: "Text & web", description: "Platform-sized images, banners, thumbnails, captions and post previews." },
  { slug: "calculators", name: "Calculators", icon: "calculator", group: "Numbers & time", description: "Math, statistics, physics, chemistry, electronics, engineering and grade calculators." },
  { slug: "converters", name: "Converters", icon: "swap", group: "Numbers & time", description: "Unit, size and number converters with clear formulas and reference tables." },
  { slug: "finance", name: "Finance", icon: "coin", group: "Numbers & time", description: "Loans, savings, budgets, taxes and payment-number validators." },
  { slug: "date-time", name: "Date & time", icon: "calendar", group: "Numbers & time", description: "Date math, time zones, timers and planners that save to your browser." },
  { slug: "developer", name: "Developer", icon: "code", group: "Build & work", description: "Formatters, converters, generators and parsers for everyday engineering work." },
  { slug: "ai", name: "AI engineering", icon: "spark", group: "Build & work", description: "Prompt, planning and readiness tools for teams building with language models." },
  { slug: "security", name: "Security", icon: "lock", group: "Build & work", description: "Passwords, hashes, checksums, one-time codes and local encryption." },
  { slug: "design", name: "Design", icon: "palette", group: "Build & work", description: "Color, CSS generators, typography and diagram makers." },
  { slug: "business", name: "Business", icon: "briefcase", group: "Build & work", description: "Invoices, quotes and receipts, plus pay, pricing and cash-flow calculators." },
  { slug: "travel", name: "Travel & vehicles", icon: "car", group: "Build & work", description: "Fuel, mileage, parking, coordinates and vehicle cost calculators." },
  { slug: "everyday", name: "Everyday life", icon: "sun", group: "Build & work", description: "Quick helpers for time math, BMI and random picks." },
];

export const categoryGroups = ["Documents & media", "Text & web", "Numbers & time", "Build & work"] as const;

export function getCategory(slug: string) {
  return categories.find((c) => c.slug === slug);
}

export const categoryHref = (slug: CategorySlug) => `/tools/category/${slug}`;
