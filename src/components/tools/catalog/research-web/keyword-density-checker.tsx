"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, EmptyState, PrivacyNote, ResetBtn, Segmented, StatGrid, TextArea, TextField, ToolPanel, fmt } from "@/components/tools/kit";
import { containsPhrase, countPhrase, ngrams, tokenize, type PageParts } from "./lib/keywords";

type InputMode = "auto" | "text" | "html";

const SAMPLE = `<!doctype html>
<html lang="en"><head>
<title>Indoor herb garden: how to grow herbs on a windowsill</title>
<meta name="description" content="Grow basil, mint and parsley indoors with this simple windowsill herb garden guide covering light, watering and harvesting.">
</head><body>
<h1>How to start an indoor herb garden</h1>
<p>An indoor herb garden gives you fresh herbs all year. Most herbs need six hours of light, so a sunny windowsill is the best place to start.</p>
<h2>Choosing herbs</h2>
<p>Basil, mint, parsley and chives are easy herbs for beginners. Plant each herb in its own pot so watering is simple.</p>
<h2>Watering and harvesting</h2>
<p>Water when the top of the soil feels dry. Harvest herbs often: regular cutting keeps the herb garden bushy.</p>
<script>console.log("ignored")</script>
</body></html>`;

function extract(html: string): PageParts {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript, template, svg").forEach((n) => n.remove());
  const title = doc.querySelector("title")?.textContent?.trim() ?? null;
  const metaDescription = doc.querySelector('meta[name="description" i]')?.getAttribute("content")?.trim() ?? null;
  const h1 = [...doc.querySelectorAll("h1")].map((h) => (h.textContent ?? "").replace(/\s+/g, " ").trim());
  // Put spaces between block elements so words do not run together.
  doc.body?.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, td, th, br, section, article").forEach((el) => el.append(" "));
  return {
    text: (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim(),
    title,
    metaDescription,
    h1,
    headings: doc.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
    imagesWithoutAlt: [...doc.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
  };
}

const looksLikeHtml = (s: string) => /<\s*(html|head|body|p|div|h[1-6]|title|meta|span|a|article|section)[\s>/]/i.test(s);

function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold ${ok === null ? "bg-sunken text-muted" : ok ? "bg-accent-soft text-accent-strong" : "bg-[color-mix(in_oklch,var(--danger)_14%,transparent)] text-danger"}`}
      >
        {ok === null ? "–" : ok ? "✓" : "!"}
      </span>
      <div className="min-w-0 text-sm">
        <p className="text-ink">
          <span className="sr-only">{ok === null ? "Not applicable: " : ok ? "Pass: " : "Check: "}</span>
          {label}
        </p>
        {detail && <p className="break-words text-[0.8125rem] text-muted">{detail}</p>}
      </div>
    </li>
  );
}

function NgramTable({ title, rows }: { title: string; rows: { phrase: string; count: number; density: number }[] }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-medium text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">None repeated.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-[0_0_0_1px_var(--line)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sunken text-left">
                <th scope="col" className="px-3 py-2 font-medium">Phrase</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Count</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Density</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.phrase} className="border-t border-line">
                  <td className="break-words px-3 py-1.5">{r.phrase}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.count}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.density, 2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Tool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<InputMode>("auto");
  const [targets, setTargets] = useState("");
  const [stop, setStop] = useState(true);
  const d = useDeferredValue(input);

  const analysis = useMemo(() => {
    if (!d.trim()) return null;
    const isHtml = mode === "html" || (mode === "auto" && looksLikeHtml(d));
    const parts: PageParts | null = isHtml && typeof DOMParser !== "undefined" ? extract(d) : null;
    const text = parts ? parts.text : d;
    const words = tokenize(text);
    const opts = { stop, minLength: 3, limit: 15 };
    return {
      isHtml: !!parts,
      parts,
      text,
      words,
      one: ngrams(words, 1, opts),
      two: ngrams(words, 2, opts),
      three: ngrams(words, 3, opts),
      unique: new Set(words).size,
    };
  }, [d, mode, stop]);

  const targetList = targets
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Content"
        actions={
          <>
            <Btn
              variant="ghost"
              icon="spark"
              onClick={() => {
                setInput(SAMPLE);
                setTargets("herb garden, indoor herb garden");
              }}
            >
              Load sample
            </Btn>
            <ResetBtn
              onClick={() => {
                setInput("");
                setTargets("");
              }}
            />
          </>
        }
      >
        <div className="space-y-4">
          <Segmented
            label="Input type"
            value={mode}
            onChange={setMode}
            options={[
              { value: "auto", label: "Detect" },
              { value: "text", label: "Plain text" },
              { value: "html", label: "HTML" },
            ]}
          />
          <TextArea label="Text or page HTML" mono rows={12} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste an article, or the page source (View source, then copy)." hint="HTML is parsed in your browser; scripts and styles are ignored and never run." />
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <TextField label="Target keywords" optional placeholder="herb garden, windowsill herbs" hint="Comma separated, up to 10. Phrases are matched as whole words." value={targets} onChange={(e) => setTargets(e.target.value)} />
            <div className="pb-1">
              <Checkbox label="Ignore stop words" checked={stop} onChange={setStop} hint="the, and, of…" />
            </div>
          </div>
        </div>
      </ToolPanel>

      {!analysis ? (
        <EmptyState icon="search" title="Paste content to analyze">
          You will see word counts, the most frequent words and phrases, and keyword checks.
        </EmptyState>
      ) : analysis.words.length === 0 ? (
        <EmptyState icon="search" title="No words found">
          The input has no readable text.
        </EmptyState>
      ) : (
        <>
          <StatGrid
            items={[
              { label: "Words", value: analysis.words.length.toLocaleString() },
              { label: "Unique words", value: analysis.unique.toLocaleString() },
              { label: "Input read as", value: analysis.isHtml ? "HTML" : "Text" },
            ]}
          />
          {targetList.length > 0 && (
            <ToolPanel title="Target keywords">
              <div className="overflow-x-auto rounded-lg shadow-[0_0_0_1px_var(--line)]" tabIndex={0} aria-label="Target keyword results">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-sunken text-left">
                      <th scope="col" className="px-3 py-2 font-medium">Keyword</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Count</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Density</th>
                      <th scope="col" className="px-3 py-2 font-medium">In first 100 words</th>
                      {analysis.parts && <th scope="col" className="px-3 py-2 font-medium">Title / H1 / description</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {targetList.map((t) => {
                      const c = countPhrase(analysis.words, t);
                      const early = countPhrase(analysis.words.slice(0, 100), t) > 0;
                      const p = analysis.parts;
                      const yn = (b: boolean) => (b ? "yes" : "no");
                      return (
                        <tr key={t} className="border-t border-line">
                          <td className="break-words px-3 py-2 font-medium">{t}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt((c / analysis.words.length) * 100, 2)}%</td>
                          <td className="px-3 py-2">{yn(early)}</td>
                          {p && (
                            <td className="px-3 py-2">
                              {yn(!!p.title && containsPhrase(p.title, t))} / {yn(p.h1.some((h) => containsPhrase(h, t)))} / {yn(!!p.metaDescription && containsPhrase(p.metaDescription, t))}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[0.8125rem] text-muted">
                Density = occurrences ÷ total words × 100. There is no official ideal density; write for readers and use the keyword where it fits naturally.
              </p>
            </ToolPanel>
          )}
          {analysis.parts && (
            <ToolPanel title="Page checks">
              <ul className="divide-y divide-line">
                <Check ok={!!analysis.parts.title} label={analysis.parts.title ? `Title: ${analysis.parts.title.length} characters` : "No <title> element"} detail={analysis.parts.title ?? undefined} />
                {analysis.parts.title && <Check ok={analysis.parts.title.length >= 30 && analysis.parts.title.length <= 60} label="Title length between 30 and 60 characters" />}
                <Check
                  ok={!!analysis.parts.metaDescription}
                  label={analysis.parts.metaDescription ? `Meta description: ${analysis.parts.metaDescription.length} characters` : "No meta description"}
                  detail={analysis.parts.metaDescription ?? undefined}
                />
                {analysis.parts.metaDescription && <Check ok={analysis.parts.metaDescription.length >= 70 && analysis.parts.metaDescription.length <= 160} label="Description length between 70 and 160 characters" />}
                <Check ok={analysis.parts.h1.length === 1} label={analysis.parts.h1.length === 1 ? "Exactly one H1" : `${analysis.parts.h1.length} H1 headings (one is recommended)`} detail={analysis.parts.h1.join(" | ") || undefined} />
                {targetList.length > 0 && (
                  <Check ok={targetList.some((t) => analysis.parts!.h1.some((h) => containsPhrase(h, t)))} label="A target keyword appears in the H1" />
                )}
                <Check ok={analysis.parts.imagesWithoutAlt === 0} label={analysis.parts.imagesWithoutAlt ? `${analysis.parts.imagesWithoutAlt} image(s) without an alt attribute` : "All images have an alt attribute"} />
              </ul>
            </ToolPanel>
          )}
          <ToolPanel title="Most frequent">
            <div className="grid gap-5 lg:grid-cols-3">
              <NgramTable title="Single words" rows={analysis.one} />
              <NgramTable title="Two-word phrases" rows={analysis.two} />
              <NgramTable title="Three-word phrases" rows={analysis.three} />
            </div>
            <p className="mt-3 text-[0.8125rem] text-muted">Phrases are shown when they appear at least twice. Words shorter than three letters and bare numbers are skipped in the single-word list.</p>
          </ToolPanel>
        </>
      )}
      <PrivacyNote />
    </div>
  );
}
