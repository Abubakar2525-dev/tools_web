"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { demoteHeadings } from "@/components/tools/engines/files";
import {
  Btn,
  Checkbox,
  CopyBtn,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SelectField,
  SplitGrid,
  TextArea,
  ToolPanel,
  downloadFile,
} from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { loadMarkdownLibs, loadTurndown, type MarkdownLibs, type TurndownFn } from "./md-libs";

type Dir = "md2html" | "html2md";
type Tab = "source" | "preview";

const MD_SAMPLE = `# Weekly update

Shipping went **well** this week. Highlights:

- New [pricing page](https://example.com/pricing)
- Faster search, about *2x* on large lists
- Bug fixes

| Area | Status |
| --- | --- |
| API | Done |
| Docs | In review |

\`\`\`js
console.log("hello");
\`\`\`
`;

const HTML_SAMPLE = `<h2>Meeting notes</h2>
<p>We agreed to <strong>ship on Friday</strong>. See the <a href="https://example.com/plan">plan</a>.</p>
<ul><li>Write release notes</li><li>Update screenshots</li></ul>
<pre><code>npm run release</code></pre>`;

export default function Tool() {
  const [dir, setDir] = useState<Dir>("md2html");
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<Tab>("preview");
  const [breaks, setBreaks] = useState(false);
  const [sanitizeSource, setSanitizeSource] = useState(true);
  const [heading, setHeading] = useState<"atx" | "setext">("atx");
  const [bullet, setBullet] = useState<"-" | "*" | "+">("-");
  const [md, setMd] = useState<MarkdownLibs | null>(null);
  const [td, setTd] = useState<TurndownFn | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const deferred = useDeferredValue(input);

  useEffect(() => {
    let alive = true;
    const p = dir === "md2html" ? loadMarkdownLibs().then((l) => alive && setMd(l)) : loadTurndown().then((f) => alive && setTd(() => f));
    p.catch(() => alive && setLoadError("The converter could not be loaded. Check your connection and reload the page."));
    return () => {
      alive = false;
    };
  }, [dir]);

  const result = useMemo(() => {
    if (!deferred.trim()) return null;
    try {
      if (dir === "md2html") {
        if (!md) return null;
        const raw = md.toHtml(deferred, { breaks });
        const safe = md.sanitize(raw);
        return { output: sanitizeSource ? safe : raw, preview: safe, changed: safe !== raw };
      }
      if (!td) return null;
      return { output: td(deferred, { headingStyle: heading, bullet, fence: "```" }).trim(), preview: null, changed: false };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not convert this input." };
    }
  }, [deferred, dir, md, td, breaks, sanitizeSource, heading, bullet]);

  const ready = dir === "md2html" ? md !== null : td !== null;
  const output = result && "output" in result ? (result.output ?? "") : "";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Convert"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => setInput(dir === "md2html" ? MD_SAMPLE : HTML_SAMPLE)}>
              Load sample
            </Btn>
            <ResetBtn onClick={() => setInput("")} />
          </>
        }
      >
        <div className="space-y-5">
          <Segmented
            label="Direction"
            value={dir}
            onChange={(d) => {
              setDir(d);
              if (output) setInput(output);
            }}
            options={[
              { value: "md2html", label: "Markdown to HTML" },
              { value: "html2md", label: "HTML to Markdown" },
            ]}
          />
          {dir === "md2html" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Checkbox label="Treat single line breaks as <br>" checked={breaks} onChange={setBreaks} />
              <Checkbox label="Sanitize the HTML source too" hint="Removes scripts, event handlers and unsafe links. The preview is always sanitized." checked={sanitizeSource} onChange={setSanitizeSource} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Heading style"
                value={heading}
                onChange={(e) => setHeading(e.target.value as "atx" | "setext")}
                options={[
                  { value: "atx", label: "# Hash headings" },
                  { value: "setext", label: "Underlined (=== / ---)" },
                ]}
              />
              <SelectField
                label="Bullet marker"
                value={bullet}
                onChange={(e) => setBullet(e.target.value as "-" | "*" | "+")}
                options={["-", "*", "+"]}
              />
            </div>
          )}
        </div>
      </ToolPanel>

      <SplitGrid>
        <ToolPanel title={dir === "md2html" ? "Markdown" : "HTML"}>
          <TextArea label={dir === "md2html" ? "Markdown input" : "HTML input"} mono value={input} onChange={(e) => setInput(e.target.value)} rows={16} />
        </ToolPanel>
        <ToolPanel
          title={dir === "md2html" ? "HTML" : "Markdown"}
          actions={
            <>
              <Btn
                variant="ghost"
                icon="download"
                disabled={!output}
                onClick={() => (dir === "md2html" ? downloadFile("converted.html", output, "text/html") : downloadFile("converted.md", output, "text/markdown"))}
              >
                Download
              </Btn>
              <CopyBtn text={output} />
            </>
          }
        >
          {loadError ? (
            <Notice tone="error">{loadError}</Notice>
          ) : !ready ? (
            <Spinner label="Loading converter" />
          ) : result && "error" in result ? (
            <Notice tone="error">{result.error}</Notice>
          ) : (
            <div className="space-y-3">
              {dir === "md2html" && (
                <Segmented
                  label="Output view"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: "preview", label: "Preview" },
                    { value: "source", label: "HTML source" },
                  ]}
                />
              )}
              {result && "changed" in result && result.changed && (
                <Notice tone="warning">Unsafe markup (such as scripts or event handlers) was removed{sanitizeSource ? "" : " from the preview"}.</Notice>
              )}
              {dir === "md2html" && tab === "preview" ? (
                result && "preview" in result && result.preview ? (
                  <div
                    className="max-h-[480px] min-h-[220px] overflow-auto rounded-lg p-4 shadow-[inset_0_0_0_1px_var(--line-strong)] [&_a]:text-accent-strong [&_a]:underline [&_code]:font-mono [&_code]:text-[0.875em] [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-sunken [&_pre]:p-3 [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:px-2 [&_ul]:list-disc [&>*+*]:mt-3"
                    // Sanitized with DOMPurify above.
                    dangerouslySetInnerHTML={{ __html: demoteHeadings(result.preview) }}
                  />
                ) : (
                  <p className="text-sm text-muted">The rendered preview appears here.</p>
                )
              ) : (
                <OutputBlock label={dir === "md2html" ? "HTML source" : "Markdown output"}>
                  <code>{output || "The result appears here as you type."}</code>
                </OutputBlock>
              )}
            </div>
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
