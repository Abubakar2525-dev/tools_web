import type { Article, Block } from "../types";
import { article as evaluatingRag } from "./evaluating-rag-before-launch";
import { article as hybridRetrieval } from "./hybrid-retrieval-for-business-documents";
import { article as agentsFailSafely } from "./designing-ai-agents-that-fail-safely";
import { article as latencyCost } from "./reducing-llm-latency-and-cost";
import { article as promptInjection } from "./prompt-injection-defense-checklist";
import { article as dataReadiness } from "./data-readiness-for-ai";

/** Newest first; ties keep editorial order below. */
export const articles: Article[] = [
  evaluatingRag,
  agentsFailSafely,
  hybridRetrieval,
  latencyCost,
  promptInjection,
  dataReadiness,
].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export function getArticle(slug: string) {
  return articles.find((a) => a.slug === slug);
}

const stripMarkup = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[`*]/g, "");

function blockText(b: Block): string {
  switch (b.type) {
    case "ul":
    case "ol":
      return b.items.join(" ");
    case "code":
      return b.code;
    case "callout":
      return `${b.title ?? ""} ${b.text}`;
    default:
      return b.text;
  }
}

export function wordCount(a: Article) {
  return a.body
    .map((b) => stripMarkup(blockText(b)))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/** ~230 wpm for prose; code is read slower so it is weighted 2x. */
export function readingTime(a: Article) {
  const codeWords = a.body
    .filter((b) => b.type === "code")
    .reduce((n, b) => n + blockText(b).split(/\s+/).length, 0);
  return Math.max(1, Math.round((wordCount(a) + codeWords) / 230));
}

export function tableOfContents(a: Article) {
  return a.body.filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2");
}

export const articleCategories = Array.from(new Set(articles.map((a) => a.category)));

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
