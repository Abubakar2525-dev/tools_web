/**
 * Plain text → HTML, and an HTML → text walker that works on any DOM-like
 * tree (the browser's DOMParser output, or plain objects in tests).
 * Self-contained for direct Node testing.
 */

export function escapeHtml(s: string, quotes = true): string {
  const out = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return quotes ? out.replace(/"/g, "&quot;").replace(/'/g, "&#39;") : out;
}

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}])/gi;
const EMAIL_RE = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;

/** Escapes text, then wraps URLs (and optionally emails) in links. */
export function autolink(escaped: string, o: { newTab?: boolean; emails?: boolean } = {}): string {
  const attrs = o.newTab ? ' target="_blank" rel="noopener noreferrer"' : "";
  let out = escaped.replace(URL_RE, (m) => {
    // The match is already escaped text; &amp; inside URLs stays escaped in the href as well, which is valid HTML.
    const href = m.startsWith("www.") ? `https://${m}` : m;
    return `<a href="${href.replace(/"/g, "&quot;")}"${attrs}>${m}</a>`;
  });
  if (o.emails) out = out.replace(EMAIL_RE, (m) => `<a href="mailto:${m}">${m}</a>`);
  return out;
}

export function textToHtml(
  text: string,
  o: { paragraphs?: boolean; lineBreaks?: boolean; links?: boolean; newTab?: boolean; emails?: boolean; indent?: boolean } = {},
): string {
  const norm = text.replace(/\r\n?/g, "\n").trim();
  if (!norm) return "";
  const conv = (s: string) => {
    let e = escapeHtml(s, false);
    if (o.links) e = autolink(e, { newTab: o.newTab, emails: o.emails });
    if (o.lineBreaks) e = e.replace(/\n/g, "<br>\n");
    return e;
  };
  if (!o.paragraphs) return conv(norm);
  return norm
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${o.indent ? "\n  " : ""}${conv(p).replace(/\n/g, o.indent ? "\n  " : "\n")}${o.indent ? "\n" : ""}</p>`)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* HTML → plain text                                                   */
/* ------------------------------------------------------------------ */

/** The subset of the DOM Node interface the walker needs. */
export interface NodeLike {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  childNodes: ArrayLike<NodeLike>;
  getAttribute?: (name: string) => string | null;
}

export type HtmlToTextOptions = {
  links?: "text" | "text-url" | "url";
  bullets?: string;
  tables?: "tsv" | "pipe";
  headingsUpper?: boolean;
  images?: boolean;
};

const BLOCK = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM",
  "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "UL", "DETAILS", "SUMMARY",
]);
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE", "META", "LINK", "SVG", "IFRAME", "OBJECT", "BUTTON", "SELECT"]);

/**
 * Walks the tree and emits text with paragraph breaks, "• " bullets
 * (numbered for <ol>), tab- or pipe-separated table rows and optional link
 * targets. Whitespace inside normal text collapses like a browser does; <pre>
 * keeps it.
 */
export function htmlNodeToText(root: NodeLike, o: HtmlToTextOptions = {}): string {
  const out: string[] = [];
  const bullet = o.bullets ?? "• ";
  // "\u0000B" marks a pending block break; resolved at the end.
  const BR = "\u0000B";
  const push = (s: string) => out.push(s);

  const walk = (node: NodeLike, ctx: { pre: boolean; listDepth: number }) => {
    if (node.nodeType === 3) {
      const v = node.nodeValue ?? "";
      push(ctx.pre ? v : v.replace(/[ \t\n\r\f]+/g, " "));
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    const tag = node.nodeName.toUpperCase();
    if (SKIP.has(tag)) return;
    const kids = () => {
      for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i], ctx);
    };
    switch (tag) {
      case "BR":
        push("\n");
        return;
      case "HR":
        push(BR + "----------" + BR);
        return;
      case "IMG": {
        const alt = node.getAttribute?.("alt");
        if (o.images && alt) push(`[${alt}]`);
        return;
      }
      case "A": {
        const href = node.getAttribute?.("href") ?? "";
        const start = out.length;
        kids();
        const text = out.slice(start).join("").trim();
        const usable = href && !href.startsWith("#") && !/^javascript:/i.test(href);
        if (usable && o.links === "text-url" && text && text !== href) push(` (${href})`);
        else if (usable && o.links === "url") {
          out.length = start;
          push(href);
        }
        return;
      }
      case "UL":
      case "OL": {
        if (ctx.listDepth === 0) push(BR);
        let n = 0;
        for (let i = 0; i < node.childNodes.length; i++) {
          const li = node.childNodes[i];
          if (li.nodeType === 1 && li.nodeName.toUpperCase() === "LI") {
            n++;
            const indent = "  ".repeat(ctx.listDepth);
            push("\n" + indent + (tag === "OL" ? `${n}. ` : bullet));
            for (let j = 0; j < li.childNodes.length; j++) walk(li.childNodes[j], { ...ctx, listDepth: ctx.listDepth + 1 });
          } else walk(li, ctx);
        }
        if (ctx.listDepth === 0) push(BR);
        return;
      }
      case "TABLE": {
        push(BR);
        const rows: NodeLike[] = [];
        const collect = (n: NodeLike) => {
          for (let i = 0; i < n.childNodes.length; i++) {
            const c = n.childNodes[i];
            if (c.nodeType !== 1) continue;
            const t = c.nodeName.toUpperCase();
            if (t === "TR") rows.push(c);
            else if (t === "THEAD" || t === "TBODY" || t === "TFOOT") collect(c);
          }
        };
        collect(node);
        const lines = rows.map((r) => {
          const cells: string[] = [];
          for (let i = 0; i < r.childNodes.length; i++) {
            const c = r.childNodes[i];
            if (c.nodeType === 1 && /^T[DH]$/i.test(c.nodeName)) {
              cells.push(htmlNodeToText(c, o).replace(/\s*\n+\s*/g, " ").trim());
            }
          }
          return o.tables === "pipe" ? `| ${cells.join(" | ")} |` : cells.join("\t");
        });
        push(lines.join("\n"));
        push(BR);
        return;
      }
      case "PRE":
        push(BR);
        walk({ ...node, nodeName: "DIV" }, { ...ctx, pre: true });
        push(BR);
        return;
      default:
        break;
    }
    if (/^H[1-6]$/.test(tag) && o.headingsUpper) {
      const start = out.length;
      kids();
      const text = out.splice(start).join("");
      push(BR + text.toUpperCase() + BR);
      return;
    }
    const block = BLOCK.has(tag) || tag === "LI" || tag === "TR";
    if (block) push(BR);
    kids();
    if (block) push(BR);
  };

  walk(root, { pre: false, listDepth: 0 });
  return out
    .join("")
    .replace(/\s*\u0000B(?:\s*\u0000B)*[ \t]*\n?/g, "\n\n")
    .split("\n")
    .map((l) => l.replace(/[  ]+$/g, "").replace(/^ (?=\S)/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}
