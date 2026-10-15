/**
 * Lazily loads Markdown and sanitizer libraries (marked, DOMPurify, turndown)
 * on first use so they stay out of the initial bundle.
 */

export type MarkdownLibs = {
  toHtml: (md: string, o?: { breaks?: boolean; gfm?: boolean }) => string;
  sanitize: (html: string) => string;
};

let mdPromise: Promise<MarkdownLibs> | null = null;

export function loadMarkdownLibs(): Promise<MarkdownLibs> {
  if (!mdPromise) {
    mdPromise = Promise.all([import("marked"), import("dompurify")])
      .then(([m, d]) => {
        const purify = d.default;
        return {
          toHtml: (md: string, o: { breaks?: boolean; gfm?: boolean } = {}) =>
            m.marked.parse(md, { async: false, gfm: o.gfm !== false, breaks: o.breaks === true }),
          sanitize: (html: string) => purify.sanitize(html, { USE_PROFILES: { html: true } }),
        };
      })
      .catch((e: unknown) => {
        mdPromise = null;
        throw e;
      });
  }
  return mdPromise;
}

export type TurndownFn = (html: string, o: { headingStyle: "atx" | "setext"; bullet: "-" | "*" | "+"; fence: "```" | "~~~" }) => string;

let tdPromise: Promise<TurndownFn> | null = null;

export function loadTurndown(): Promise<TurndownFn> {
  if (!tdPromise) {
    tdPromise = import("turndown")
      .then((mod) => {
        const TurndownService = mod.default;
        return (html: string, o: { headingStyle: "atx" | "setext"; bullet: "-" | "*" | "+"; fence: "```" | "~~~" }) => {
          const td = new TurndownService({ headingStyle: o.headingStyle, bulletListMarker: o.bullet, codeBlockStyle: "fenced", fence: o.fence, emDelimiter: "*" });
          td.remove(["script", "style", "noscript", "iframe", "object"]);
          // Simple GFM-style tables: header row, separator, body rows.
          td.addRule("table", {
            filter: "table",
            replacement: (_content, node) => {
              const el = node as HTMLTableElement;
              const rows = Array.from(el.rows).map((r) => Array.from(r.cells).map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|")));
              if (!rows.length) return "";
              const cols = Math.max(...rows.map((r) => r.length));
              const line = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => r[i] ?? "").join(" | ")} |`;
              return `\n\n${[line(rows[0]), `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n")}\n\n`;
            },
          });
          return td.turndown(html);
        };
      })
      .catch((e: unknown) => {
        tdPromise = null;
        throw e;
      });
  }
  return tdPromise;
}
