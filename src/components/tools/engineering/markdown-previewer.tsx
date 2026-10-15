"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Btn,
  CopyBtn,
  EmptyState,
  Notice,
  PrivacyNote,
  ResetBtn,
  Segmented,
  StatGrid,
  TextArea,
  ToolPanel,
  downloadFile,
  usePersistentState,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Sample                                                              */
/* ------------------------------------------------------------------ */

const SAMPLE = `# Release notes

A **safe** Markdown preview with _live_ rendering, ~~no surprises~~ and \`inline code\`.

## What's new

- Faster search across every workspace
- Nested lists work too
  - Indent with two spaces
  - Or four, if you prefer
- [x] Task lists render as checkboxes
- [ ] Ship the changelog

1. Write the draft
2. Preview it here
3. Copy or download the .md file

> Blockquotes are handy for callouts.
> They can span several lines.

\`\`\`ts
function greet(name: string) {
  return \`Hello, \${name}\`;
}
\`\`\`

| Feature | Status | Notes |
| :------ | :----: | ----: |
| Tables | Done | Aligned |
| Images | Links | Privacy |

Read the [Markdown guide](https://www.markdownguide.org) or jump to [the top](#release-notes).

![Team photo](https://example.com/team.jpg)

---

Made with care.
`;

/* ------------------------------------------------------------------ */
/* Block parser                                                        */
/* ------------------------------------------------------------------ */

type Align = "left" | "center" | "right" | null;

type ListItem = { text: string; task: null | boolean; children: ListBlock[] };
type ListBlock = { type: "list"; ordered: boolean; start: number; items: ListItem[] };

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "quote"; children: Block[] }
  | { type: "hr" }
  | { type: "table"; align: Align[]; head: string[]; rows: string[][] }
  | ListBlock;

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)?.*$/;
const HEADING_RE = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
const HR_RE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE_RE = /^ {0,3}>\s?(.*)$/;
const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function indentOf(s: string) {
  let n = 0;
  for (const ch of s) {
    if (ch === " ") n += 1;
    else if (ch === "\t") n += 4;
    else break;
  }
  return n;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

function startsBlock(line: string, next: string | undefined) {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line) ||
    (line.includes("|") && next !== undefined && TABLE_SEP_RE.test(next) && next.includes("-"))
  );
}

type RawItem = { indent: number; ordered: boolean; num: number; text: string };

function buildList(items: RawItem[], start: number): { node: ListBlock; next: number } {
  const base = items[start].indent;
  const node: ListBlock = { type: "list", ordered: items[start].ordered, start: items[start].num, items: [] };
  let i = start;
  while (i < items.length) {
    const it = items[i];
    if (it.indent < base) break;
    if (it.indent > base) {
      const sub = buildList(items, i);
      if (!node.items.length) node.items.push({ text: "", task: null, children: [] });
      node.items[node.items.length - 1].children.push(sub.node);
      i = sub.next;
      continue;
    }
    if (it.ordered !== node.ordered && node.items.length) break;
    const m = /^\[( |x|X)\]\s+(.*)$/.exec(it.text);
    node.items.push(m ? { text: m[2], task: m[1] !== " ", children: [] } : { text: it.text, task: null, children: [] });
    i++;
  }
  return { node, next: i };
}

function parseBlocks(src: string, depth = 0): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2] ?? "";
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^ {0,3}${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`).test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence (or end of input)
      out.push({ type: "code", lang, code: body.join("\n") });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      out.push({ type: "heading", level: heading[1].length, text: heading[2] ?? "" });
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      out.push({ type: "hr" });
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const q = QUOTE_RE.exec(lines[i]);
        inner.push(q ? q[1] : lines[i]);
        i++;
      }
      out.push({ type: "quote", children: depth < 8 ? parseBlocks(inner.join("\n"), depth + 1) : [{ type: "paragraph", text: inner.join("\n") }] });
      continue;
    }

    // GFM table
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const head = splitRow(line);
      const align: Align[] = splitRow(lines[i + 1]).map((c) => {
        const l = c.startsWith(":");
        const r = c.endsWith(":");
        return l && r ? "center" : r ? "right" : l ? "left" : null;
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push({ type: "table", align, head, rows });
      continue;
    }

    if (LIST_RE.test(line)) {
      const raw: RawItem[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = LIST_RE.exec(l);
        if (m) {
          const ordered = /\d/.test(m[2]);
          raw.push({ indent: indentOf(m[1]), ordered, num: ordered ? parseInt(m[2], 10) : 1, text: m[3] });
          i++;
          continue;
        }
        if (!l.trim()) {
          // A blank line ends the list unless the next line continues it.
          const nxt = lines[i + 1];
          if (nxt !== undefined && (LIST_RE.test(nxt) || (indentOf(nxt) >= 2 && nxt.trim()))) {
            i++;
            continue;
          }
          break;
        }
        if (indentOf(l) >= 2 || !startsBlock(l, lines[i + 1])) {
          // Lazy continuation of the previous item.
          raw[raw.length - 1].text += `\n${l.trim()}`;
          i++;
          continue;
        }
        break;
      }
      let k = 0;
      while (k < raw.length) {
        const { node, next } = buildList(raw, k);
        out.push(node);
        k = next;
      }
      continue;
    }

    // Paragraph
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i + 1])) {
      para.push(lines[i]);
      i++;
    }
    out.push({ type: "paragraph", text: para.join("\n") });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Inline renderer (returns React nodes, never HTML strings)           */
/* ------------------------------------------------------------------ */

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[`*_~[\]()!]/g, "")
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

/** Allows http(s), mailto, #anchors and relative paths. Anything else returns null. */
function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  const probe = url.replace(/[\u0000- \u007f]/g, "").toLowerCase();
  // In-page anchors are namespaced so they can't collide with ids on the host page.
  if (probe.startsWith("#")) return `#md-${url.slice(1)}`;
  if (/^(https?:|mailto:)/.test(probe)) return url;
  if (probe.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/.test(probe)) return null;
  return url;
}

function findClose(s: string, from: number, delim: string) {
  let j = s.indexOf(delim, from);
  while (j !== -1) {
    if (s[j - 1] !== "\\" && j > from && s[j - 1] !== " ") return j;
    j = s.indexOf(delim, j + 1);
  }
  return -1;
}

/** Finds the matching "]" for a "[" at `open`, respecting nesting. */
function matchBracket(s: string, open: number) {
  let depth = 0;
  for (let j = open; j < s.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (s[j] === "[") depth++;
    else if (s[j] === "]") {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

/** Parses "(url "title")" starting at `open`. Returns url and index after ")". */
function parseDest(s: string, open: number): { url: string; end: number } | null {
  if (s[open] !== "(") return null;
  let depth = 0;
  for (let j = open; j < s.length; j++) {
    if (s[j] === "(") depth++;
    else if (s[j] === ")") {
      depth--;
      if (depth === 0) {
        const inner = s.slice(open + 1, j).trim();
        const url = inner.replace(/\s+("[^"]*"|'[^']*')$/, "").replace(/^<(.*)>$/, "$1");
        return { url, end: j + 1 };
      }
    }
  }
  return null;
}

const ESCAPABLE = "\\`*_{}[]()#+-.!|~>";

function renderInline(s: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let buf = "";
  let k = 0;
  const key = () => `${keyPrefix}-${k++}`;
  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = "";
    }
  };

  let i = 0;
  while (i < s.length) {
    const c = s[i];

    if (c === "\\" && i + 1 < s.length && ESCAPABLE.includes(s[i + 1])) {
      buf += s[i + 1];
      i += 2;
      continue;
    }

    if (c === "\n") {
      const hard = buf.endsWith("  ") || buf.endsWith("\\");
      if (hard) {
        buf = buf.replace(/(\s+|\\)$/, "");
        flush();
        out.push(<br key={key()} />);
      } else buf += " ";
      i++;
      continue;
    }

    if (c === "`") {
      let n = 1;
      while (s[i + n] === "`") n++;
      const fence = "`".repeat(n);
      const end = s.indexOf(fence, i + n);
      if (end !== -1) {
        flush();
        out.push(
          <code key={key()} className="inline-code">
            {s.slice(i + n, end).replace(/\n/g, " ")}
          </code>,
        );
        i = end + n;
        continue;
      }
      buf += fence;
      i += n;
      continue;
    }

    // Images: never fetched. Rendered as a link or alt text.
    if (c === "!" && s[i + 1] === "[") {
      const close = matchBracket(s, i + 1);
      const dest = close !== -1 ? parseDest(s, close + 1) : null;
      if (dest) {
        flush();
        const alt = s.slice(i + 2, close) || "image";
        const href = safeHref(dest.url);
        const label = `Image: ${alt}`;
        out.push(
          href ? (
            <a
              key={key()}
              href={href}
              className="link"
              {...(/^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              [{label}]
            </a>
          ) : (
            <span key={key()} className="text-muted">
              [{label}]
            </span>
          ),
        );
        i = dest.end;
        continue;
      }
    }

    if (c === "[") {
      const close = matchBracket(s, i);
      const dest = close !== -1 ? parseDest(s, close + 1) : null;
      if (dest) {
        flush();
        const inner = renderInline(s.slice(i + 1, close), key());
        const href = safeHref(dest.url);
        if (href) {
          const external = /^https?:/i.test(href);
          out.push(
            <a
              key={key()}
              href={href}
              className="link"
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {inner}
            </a>,
          );
        } else {
          out.push(<Fragment key={key()}>{inner}</Fragment>);
        }
        i = dest.end;
        continue;
      }
    }

    // Autolink <https://...>
    if (c === "<") {
      const m = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(s.slice(i));
      if (m) {
        flush();
        const external = /^https?:/i.test(m[1]);
        out.push(
          <a key={key()} href={m[1]} className="link" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {m[1]}
          </a>,
        );
        i += m[0].length;
        continue;
      }
    }

    if (c === "~" && s[i + 1] === "~") {
      const end = findClose(s, i + 2, "~~");
      if (end !== -1 && s[i + 2] !== " ") {
        flush();
        out.push(<del key={key()}>{renderInline(s.slice(i + 2, end), key())}</del>);
        i = end + 2;
        continue;
      }
    }

    if ((c === "*" || c === "_") && s[i + 1] === c) {
      const prev = s[i - 1];
      const intraword = c === "_" && prev !== undefined && /[\p{L}\p{N}]/u.test(prev);
      const end = intraword ? -1 : findClose(s, i + 2, c + c);
      if (end !== -1 && s[i + 2] !== " ") {
        flush();
        out.push(<strong key={key()}>{renderInline(s.slice(i + 2, end), key())}</strong>);
        i = end + 2;
        continue;
      }
    }

    if (c === "*" || c === "_") {
      const prev = s[i - 1];
      const intraword = c === "_" && prev !== undefined && /[\p{L}\p{N}]/u.test(prev);
      if (!intraword && s[i + 1] !== " " && s[i + 1] !== undefined) {
        let end = findClose(s, i + 1, c);
        // Skip over a doubled delimiter that belongs to nested bold.
        while (end !== -1 && s[end + 1] === c) end = findClose(s, end + 2, c);
        if (end !== -1 && (c === "*" || !/[\p{L}\p{N}]/u.test(s[end + 1] ?? ""))) {
          flush();
          out.push(<em key={key()}>{renderInline(s.slice(i + 1, end), key())}</em>);
          i = end + 1;
          continue;
        }
      }
    }

    buf += c;
    i++;
  }
  flush();
  return out;
}

function plainText(s: string) {
  return s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*_~]/g, "");
}

/* ------------------------------------------------------------------ */
/* Block renderer                                                      */
/* ------------------------------------------------------------------ */

type HTag = "h2" | "h3" | "h4" | "h5" | "h6";
const HEADING_CLS: Record<HTag, string> = {
  h2: "!text-[1.45rem]",
  h3: "!text-[1.2rem]",
  h4: "text-[1.05rem] text-ink",
  h5: "text-[0.95rem] text-ink",
  h6: "text-[0.85rem] uppercase tracking-wide text-muted",
};

function RenderList({ list, k }: { list: ListBlock; k: string }) {
  const items = list.items.map((it, idx) => {
    const ik = `${k}-${idx}`;
    return (
      <li key={ik} className={it.task !== null ? "!list-none before:!hidden" : ""}>
        {it.task !== null && (
          <input
            type="checkbox"
            checked={it.task}
            readOnly
            disabled
            aria-label={it.task ? "Done" : "Not done"}
            className="mr-2 inline-block h-4 w-4 -translate-y-px align-middle accent-[var(--accent)]"
          />
        )}
        {renderInline(it.text, ik)}
        {it.children.map((c, ci) => (
          <RenderList key={`${ik}-c${ci}`} list={c} k={`${ik}-c${ci}`} />
        ))}
      </li>
    );
  });
  return list.ordered ? <ol start={list.start !== 1 ? list.start : undefined}>{items}</ol> : <ul>{items}</ul>;
}

function RenderBlocks({ blocks, prefix }: { blocks: Block[]; prefix: string }) {
  return (
    <>
      {blocks.map((b, idx) => {
        const k = `${prefix}-${idx}`;
        switch (b.type) {
          case "heading": {
            const Tag = `h${Math.min(b.level + 1, 6)}` as HTag;
            return (
              <Tag key={k} id={`md-${slugify(plainText(b.text))}`} className={HEADING_CLS[Tag]}>
                {renderInline(b.text, k)}
              </Tag>
            );
          }
          case "paragraph":
            return <p key={k}>{renderInline(b.text, k)}</p>;
          case "hr":
            return <hr key={k} className="border-line-strong" />;
          case "quote":
            return (
              <blockquote key={k} className="space-y-3">
                <RenderBlocks blocks={b.children} prefix={k} />
              </blockquote>
            );
          case "code":
            return (
              <div key={k} className="overflow-hidden rounded-lg bg-night">
                {b.lang && (
                  <div className="border-b border-night-line px-3 py-1.5 font-mono text-[0.72rem] uppercase tracking-wider text-night-muted">
                    {b.lang}
                  </div>
                )}
                <pre
                  tabIndex={0}
                  aria-label={b.lang ? `${b.lang} code` : "Code block"}
                  className="overflow-auto p-3.5 font-mono text-[0.82rem] leading-relaxed text-night-ink"
                >
                  <code>{b.code}</code>
                </pre>
              </div>
            );
          case "table":
            return (
              <div key={k} tabIndex={0} role="region" aria-label="Table" className="overflow-x-auto rounded-lg shadow-[0_0_0_1px_var(--line)]">
                <table className="w-full border-collapse text-[0.9em]">
                  <thead className="bg-sunken">
                    <tr>
                      {b.head.map((h, ci) => (
                        <th
                          key={ci}
                          scope="col"
                          style={{ textAlign: b.align[ci] ?? "left" }}
                          className="border-b border-line px-3 py-2 font-semibold text-ink"
                        >
                          {renderInline(h, `${k}-h${ci}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri} className="border-b border-line last:border-0">
                        {b.head.map((_, ci) => (
                          <td key={ci} style={{ textAlign: b.align[ci] ?? "left" }} className="px-3 py-2 align-top">
                            {renderInline(r[ci] ?? "", `${k}-${ri}-${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "list":
            return <RenderList key={k} list={b} k={k} />;
        }
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

type View = "write" | "preview" | "split";
const VIEWS: readonly { value: View; label: string }[] = [
  { value: "write", label: "Write" },
  { value: "preview", label: "Preview" },
  { value: "split", label: "Split" },
];

export default function Tool() {
  const [md, setMd, clearDraft] = usePersistentState("markdown-draft", SAMPLE);
  const [view, setView] = useState<View>("write");
  const text = typeof md === "string" ? md : "";

  const blocks = useMemo(() => parseBlocks(text), [text]);
  const words = useMemo(() => (plainText(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length, [text]);
  const minutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 230));
  const hasImages = /!\[[^\]]*\]\(/.test(text);

  return (
    <ToolPanel
      title="Markdown previewer"
      actions={
        <>
          <CopyBtn text={text} label="Copy Markdown" />
          <Btn variant="ghost" icon="download" disabled={!text} onClick={() => downloadFile("document.md", text, "text/markdown")}>
            Download .md
          </Btn>
          <Btn variant="ghost" icon="markdown" onClick={() => setMd(SAMPLE)}>
            Load sample
          </Btn>
          <ResetBtn label="Clear editor" onClick={() => setMd("")} />
        </>
      }
    >
      <div className="space-y-5">
        <div className="lg:hidden">
          <Segmented label="Editor view" value={view} onChange={setView} options={VIEWS} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className={view === "preview" ? "hidden lg:block" : "min-w-0"}>
            <TextArea
              label="Markdown"
              hint="Your draft is saved in this browser as you type."
              mono
              value={text}
              placeholder="# Start writing"
              onChange={(e) => setMd(e.target.value)}
              className="[&_textarea]:min-h-[420px]"
            />
          </div>

          <div className={view === "write" ? "hidden lg:block" : "min-w-0"}>
            <p className="text-sm font-medium text-ink" id="md-preview-label">
              Preview
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">Headings shift down one level so they fit inside this page.</p>
            <div className="mt-2">
              {blocks.length === 0 ? (
                <EmptyState icon="markdown" title="Nothing to preview yet">
                  Type some Markdown or load the sample to see it rendered here.
                </EmptyState>
              ) : (
                <article
                  aria-labelledby="md-preview-label"
                  className="prose-article min-h-[420px] overflow-hidden break-words rounded-lg bg-surface p-4 !text-[0.975rem] shadow-[inset_0_0_0_1px_var(--line-strong)] sm:p-5 [&>:first-child]:!mt-0 [&_blockquote]:!text-[1em] [&_h2]:!mt-[1.6em] [&_h3]:!mt-[1.4em] [&_ol]:pl-6 [&_ul_ul]:mt-1.5"
                >
                  <RenderBlocks blocks={blocks} prefix="b" />
                </article>
              )}
            </div>
          </div>
        </div>

        {hasImages && (
          <Notice tone="info">
            Images are shown as links instead of being loaded. Fetching remote images would tell their hosts that you
            opened this page, so the preview leaves them alone.
          </Notice>
        )}

        <StatGrid
          items={[
            { label: "Words", value: words.toLocaleString("en-US") },
            { label: "Reading time", value: words === 0 ? "0 min" : `${minutes} min` },
            { label: "Characters", value: text.length.toLocaleString("en-US") },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PrivacyNote stored />
          <Btn variant="danger" icon="trash" onClick={clearDraft}>
            Clear saved draft
          </Btn>
        </div>
      </div>
    </ToolPanel>
  );
}
