/**
 * robots.txt generation, parsing and URL testing following RFC 9309 and
 * Google's documented matching rules:
 *  - the crawler obeys the group with the most specific matching user-agent
 *    (groups naming the same agent are merged), else the "*" group;
 *  - among rules matching the path, the longest pattern wins;
 *  - on equal length, allow wins (least restrictive);
 *  - "*" matches any sequence, a trailing "$" anchors the end;
 *  - an empty Disallow means nothing is disallowed; /robots.txt is always allowed.
 */

export interface AiCrawler {
  token: string;
  owner: string;
  note: string;
}

export const AI_CRAWLERS: AiCrawler[] = [
  { token: "GPTBot", owner: "OpenAI", note: "Collects data for model training" },
  { token: "OAI-SearchBot", owner: "OpenAI", note: "Indexes pages for ChatGPT search results" },
  { token: "ChatGPT-User", owner: "OpenAI", note: "Fetches pages when a user asks ChatGPT to" },
  { token: "ClaudeBot", owner: "Anthropic", note: "Collects data for model training" },
  { token: "Claude-SearchBot", owner: "Anthropic", note: "Indexes pages for search features" },
  { token: "Claude-User", owner: "Anthropic", note: "Fetches pages when a user asks Claude to" },
  { token: "anthropic-ai", owner: "Anthropic", note: "Older token, kept for compatibility" },
  { token: "Google-Extended", owner: "Google", note: "Control token for Gemini training and grounding; does not affect Google Search" },
  { token: "Applebot-Extended", owner: "Apple", note: "Control token for Apple AI training; does not affect Applebot search" },
  { token: "CCBot", owner: "Common Crawl", note: "Open web crawl widely used to train models" },
  { token: "PerplexityBot", owner: "Perplexity", note: "Indexes pages for Perplexity answers" },
  { token: "Perplexity-User", owner: "Perplexity", note: "Fetches pages when a user asks" },
  { token: "Bytespider", owner: "ByteDance", note: "Crawler associated with ByteDance AI products" },
  { token: "Meta-ExternalAgent", owner: "Meta", note: "Collects data for Meta AI training" },
  { token: "Amazonbot", owner: "Amazon", note: "Crawler for Amazon services including AI" },
  { token: "cohere-ai", owner: "Cohere", note: "Crawler associated with Cohere models" },
  { token: "Diffbot", owner: "Diffbot", note: "Structured data extraction used for AI" },
];

export interface RobotsRule {
  id: string;
  type: "allow" | "disallow";
  path: string;
}

export interface RobotsGroup {
  id: string;
  agents: string;
  rules: RobotsRule[];
  crawlDelay: string;
}

export interface RobotsConfig {
  groups: RobotsGroup[];
  aiBlocked: string[];
  sitemaps: string;
}

export function generateRobots(c: RobotsConfig): string {
  const blocks: string[] = [];
  for (const g of c.groups) {
    const agents = g.agents
      .split(/[\n,]+/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (!agents.length) continue;
    const lines = agents.map((a) => `User-agent: ${a}`);
    const rules = g.rules.filter((r) => r.path.trim() || r.type === "disallow");
    if (!rules.length) lines.push("Disallow:");
    for (const r of rules) lines.push(`${r.type === "allow" ? "Allow" : "Disallow"}: ${r.path.trim()}`);
    if (g.crawlDelay.trim() && /^\d+(\.\d+)?$/.test(g.crawlDelay.trim())) lines.push(`Crawl-delay: ${g.crawlDelay.trim()}`);
    blocks.push(lines.join("\n"));
  }
  if (c.aiBlocked.length) {
    blocks.push(["# AI crawlers", ...c.aiBlocked.map((a) => `User-agent: ${a}`), "Disallow: /"].join("\n"));
  }
  const maps = c.sitemaps
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (maps.length) blocks.push(maps.map((m) => `Sitemap: ${m}`).join("\n"));
  return blocks.join("\n\n") + "\n";
}

/* ------------------------------ Parsing ------------------------------ */

export interface ParsedRule {
  allow: boolean;
  pattern: string;
  line: number;
}

export interface ParsedGroup {
  agents: string[];
  rules: ParsedRule[];
  line: number;
}

export interface ParsedRobots {
  groups: ParsedGroup[];
  sitemaps: string[];
  warnings: string[];
}

export function parseRobots(text: string): ParsedRobots {
  const groups: ParsedGroup[] = [];
  const sitemaps: string[] = [];
  const warnings: string[] = [];
  let current: ParsedGroup | null = null;
  let lastWasAgent = false;
  text.split(/\r\n|\r|\n/).forEach((rawLine, idx) => {
    const line = idx + 1;
    const content = rawLine.replace(/#.*$/, "").trim();
    if (!content) return;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(content);
    if (!m) {
      warnings.push(`Line ${line}: not a “field: value” line, ignored.`);
      return;
    }
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], line };
        groups.push(current);
      }
      current.agents.push(value);
      lastWasAgent = true;
      return;
    }
    lastWasAgent = false;
    if (key === "allow" || key === "disallow") {
      if (!current) {
        warnings.push(`Line ${line}: rule before any User-agent line, ignored.`);
        return;
      }
      current.rules.push({ allow: key === "allow", pattern: value, line });
    } else if (key === "sitemap") sitemaps.push(value);
    else if (key !== "crawl-delay" && key !== "host" && key !== "clean-param") warnings.push(`Line ${line}: unknown field “${m[1]}”, ignored.`);
  });
  return { groups, sitemaps, warnings };
}

/* ------------------------------ Matching ------------------------------ */

/** Percent-encodes non-ASCII and normalizes hex case so equal paths compare equal. */
export function normalizePath(p: string): string {
  let out = "";
  for (const ch of p) {
    const code = ch.codePointAt(0) ?? 0;
    out += code > 0x7e || code < 0x21 ? encodeURIComponent(ch) : ch;
  }
  return out.replace(/%[0-9a-f]{2}/gi, (h) => h.toUpperCase());
}

export function patternMatches(pattern: string, path: string): boolean {
  const pat = normalizePath(pattern);
  const anchored = pat.endsWith("$");
  const body = anchored ? pat.slice(0, -1) : pat;
  const re = new RegExp(
    `^${body
      .split("*")
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}${anchored ? "$" : ""}`,
  );
  return re.test(path);
}

export interface TestResult {
  allowed: boolean;
  agentGroup: string[];
  rule: ParsedRule | null;
  reason: string;
}

/** Extracts "path?query" from a full URL or a path. */
export function toTestPath(input: string): string {
  const s = input.trim();
  if (!s) return "/";
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      const u = new URL(s);
      return u.pathname + u.search;
    }
  } catch {
    /* fall through */
  }
  const noHash = s.split("#")[0];
  return noHash.startsWith("/") ? noHash : `/${noHash}`;
}

export function testRobots(parsed: ParsedRobots, userAgent: string, rawPath: string): TestResult {
  const token = userAgent.trim().toLowerCase();
  const path = normalizePath(toTestPath(rawPath));
  let groups = parsed.groups.filter((g) => g.agents.some((a) => a.toLowerCase() === token));
  let agentGroup = groups.length ? [userAgent.trim()] : [];
  if (!groups.length) {
    groups = parsed.groups.filter((g) => g.agents.some((a) => a === "*"));
    agentGroup = groups.length ? ["*"] : [];
  }
  if (path === "/robots.txt") return { allowed: true, agentGroup, rule: null, reason: "/robots.txt is always allowed." };
  if (!groups.length) return { allowed: true, agentGroup, rule: null, reason: "No group applies to this user-agent, so everything is allowed." };
  let best: ParsedRule | null = null;
  for (const g of groups) {
    for (const r of g.rules) {
      if (!r.pattern) continue; // empty Disallow: no restriction
      if (!patternMatches(r.pattern, path)) continue;
      const len = normalizePath(r.pattern).length;
      const bestLen = best ? normalizePath(best.pattern).length : -1;
      if (len > bestLen || (len === bestLen && r.allow && !best?.allow)) best = r;
    }
  }
  if (!best) return { allowed: true, agentGroup, rule: null, reason: "No rule matches this path, so it is allowed." };
  return {
    allowed: best.allow,
    agentGroup,
    rule: best,
    reason: `Longest matching rule is “${best.allow ? "Allow" : "Disallow"}: ${best.pattern}” (line ${best.line}).`,
  };
}
