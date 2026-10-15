"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, OutputBlock, PrivacyNote, ResetBtn, SelectField, TextArea, TextField, ToolPanel } from "@/components/tools/kit";
import { breadcrumbUrl, metaTags, truncate, type MetaInput } from "./lib/meta";

const INITIAL: MetaInput = {
  title: "",
  description: "",
  canonical: "",
  index: true,
  follow: true,
  noarchive: false,
  nosnippet: false,
  maxImagePreview: "large",
  viewport: true,
  charset: true,
  lang: "en",
  author: "",
  themeColor: "",
};

const SAMPLE: MetaInput = {
  ...INITIAL,
  title: "Sourdough starter guide: feeding, timing and fixes",
  description: "Learn how to feed a sourdough starter, read its rise and fix common problems like hooch, slow activity and sour smells, with a simple daily schedule.",
  canonical: "https://example.com/baking/sourdough-starter-guide",
  author: "Example Bakery",
};

function lengthNote(len: number, min: number, max: number, unit: string) {
  if (len === 0) return { tone: "muted", text: `0 characters. Recommended ${min} to ${max}.` };
  if (len < min) return { tone: "warn", text: `${len} characters: short. Aim for ${min} to ${max} ${unit}.` };
  if (len > max) return { tone: "warn", text: `${len} characters: likely truncated in results (about ${max} fit).` };
  return { tone: "ok", text: `${len} characters: good length.` };
}

function Counter({ note }: { note: { tone: string; text: string } }) {
  return (
    <p className={`mt-1.5 flex items-center gap-1.5 text-[0.8125rem] ${note.tone === "warn" ? "text-ink" : "text-muted"}`} aria-live="polite">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${note.tone === "ok" ? "bg-accent" : note.tone === "warn" ? "bg-[oklch(0.75_0.15_75)]" : "bg-line-strong"}`} />
      {note.tone === "warn" ? "Warning: " : ""}
      {note.text}
    </p>
  );
}

export default function Tool() {
  const [m, setM] = useState<MetaInput>(INITIAL);
  const set = (patch: Partial<MetaInput>) => setM((p) => ({ ...p, ...patch }));
  const code = metaTags(m);
  const titleNote = lengthNote(m.title.trim().length, 30, 60, "characters");
  const descNote = lengthNote(m.description.trim().length, 70, 160, "characters");
  let canonicalError: string | null = null;
  if (m.canonical.trim()) {
    try {
      const u = new URL(m.canonical.trim());
      if (!/^https?:$/.test(u.protocol)) canonicalError = "Use an absolute http(s) URL.";
    } catch {
      canonicalError = "Use an absolute URL, e.g. https://example.com/page.";
    }
  }
  const themeBad = m.themeColor.trim() !== "" && !/^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl|oklch)a?\(.+\))$/i.test(m.themeColor.trim());

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title="Page details"
          actions={
            <>
              <Btn variant="ghost" icon="spark" onClick={() => setM(SAMPLE)}>
                Load sample
              </Btn>
              <ResetBtn onClick={() => setM(INITIAL)} />
            </>
          }
        >
          <div className="space-y-5">
            <div>
              <TextField label="Title" value={m.title} onChange={(e) => set({ title: e.target.value })} placeholder="Primary keyword, then a clear benefit" />
              <Counter note={titleNote} />
            </div>
            <div>
              <TextArea label="Meta description" rows={3} value={m.description} onChange={(e) => set({ description: e.target.value })} placeholder="One or two sentences that make someone want to click." />
              <Counter note={descNote} />
            </div>
            <TextField label="Canonical URL" optional inputMode="url" value={m.canonical} onChange={(e) => set({ canonical: e.target.value })} placeholder="https://example.com/page" error={canonicalError} />
            <fieldset>
              <legend className="text-sm font-medium text-ink">Robots</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Checkbox label="Allow indexing" checked={m.index} onChange={(v) => set({ index: v })} hint="Off adds noindex." />
                <Checkbox label="Follow links" checked={m.follow} onChange={(v) => set({ follow: v })} hint="Off adds nofollow." />
                <Checkbox label="No cached copy" checked={m.noarchive} onChange={(v) => set({ noarchive: v })} />
                <Checkbox label="No snippet" checked={m.nosnippet} onChange={(v) => set({ nosnippet: v })} hint="Hides the description text in results." />
              </div>
              <div className="mt-3">
                <SelectField
                  label="Image preview size"
                  value={m.maxImagePreview}
                  onChange={(e) => set({ maxImagePreview: e.target.value as MetaInput["maxImagePreview"] })}
                  options={[
                    { value: "", label: "Not set" },
                    { value: "large", label: "large" },
                    { value: "standard", label: "standard" },
                    { value: "none", label: "none" },
                  ]}
                />
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Author" optional value={m.author} onChange={(e) => set({ author: e.target.value })} />
              <TextField label="Theme color" optional placeholder="#0f766e" value={m.themeColor} onChange={(e) => set({ themeColor: e.target.value })} error={themeBad ? "Use a CSS color such as #0f766e." : null} />
              <TextField label="Page language" optional placeholder="en" value={m.lang} onChange={(e) => set({ lang: e.target.value })} hint="Goes on the html element, shown as a comment." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Checkbox label="Include charset" checked={m.charset} onChange={(v) => set({ charset: v })} />
              <Checkbox label="Include responsive viewport" checked={m.viewport} onChange={(v) => set({ viewport: v })} />
            </div>
          </div>
        </ToolPanel>
        <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          <ToolPanel title="Search result preview">
            <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]" role="img" aria-label={`Preview: ${m.title || "untitled"}. ${m.description}`}>
              <p className="truncate text-[0.8125rem] text-ink-2">{m.canonical.trim() ? breadcrumbUrl(m.canonical.trim()) : "example.com › page"}</p>
              <p className="mt-1 text-[1.15rem] leading-snug text-accent-strong">{m.title.trim() ? truncate(m.title, 60) : "Your page title appears here"}</p>
              {!m.nosnippet && <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">{m.description.trim() ? truncate(m.description, 160) : "Your meta description appears here. Search engines may show different text if it matches the query better."}</p>}
            </div>
            <p className="mt-3 text-[0.8125rem] text-muted">
              A generic approximation. Search engines truncate by pixel width, not characters, and may rewrite titles and snippets.
            </p>
            {!m.index && <p className="mt-2 text-[0.8125rem] text-ink">Note: with noindex, this page will not appear in results at all.</p>}
          </ToolPanel>
          <ToolPanel title="HTML" actions={<CopyBtn text={code} />}>
            <OutputBlock label="Generated meta tags">
              <code>{code || "<!-- Fill in the form -->"}</code>
            </OutputBlock>
            <p className="mt-2 text-[0.8125rem] text-muted">Paste inside the page’s &lt;head&gt;. Values are HTML-escaped.</p>
          </ToolPanel>
        </div>
      </div>
      <PrivacyNote />
    </div>
  );
}
