"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, SelectField, SplitGrid, TextArea, ToolPanel } from "@/components/tools/kit";
import { XmlError, formatXml, minifyXml, xmlStats } from "./lib/xml";
import { CodeResult, ParseError, SizeStats, byteLen, errorMessage } from "./shared";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Feed exported 2026-10-01 -->
<feed xmlns="http://www.w3.org/2005/Atom"><title>Release notes</title><entry id="42"><title>Faster search</title>
<summary type="html"><![CDATA[<p>Search is <b>2x</b> faster.</p>]]></summary><pre xml:space="preserve">  keep   this
     spacing</pre><p>Mixed <em>inline</em> content stays as written.</p><updated>2026-09-30T12:00:00Z</updated></entry><?render mode="compact"?></feed>`;

type Action = "format" | "minify" | "validate";
type Out =
  | { kind: "ok"; action: Action; text: string; stats: ReturnType<typeof xmlStats>; before: number }
  | { kind: "error"; message: string; line: number | null; column: number | null; source: string };

/** Validates with the browser's XML parser (a detached document; nothing is inserted into the page). */
function validateWithDom(text: string): { message: string; line: number | null; column: number | null } | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const err = doc.getElementsByTagName("parsererror")[0];
  if (!err) return null;
  const raw = (err.textContent ?? "").replace(/\s+/g, " ").trim();
  const m = /line(?: number)? (\d+)(?:,)? (?:at )?column (\d+)/i.exec(raw);
  let message = raw
    .replace(/^This page contains the following errors:\s*/i, "")
    .replace(/Below is a rendering of the page up to the first error\.?/i, "")
    .replace(/^error on line \d+ at column \d+:\s*/i, "")
    .replace(/^XML Parsing Error:\s*/i, "")
    .replace(/Location:.*$/i, "")
    .trim();
  if (!message) message = "The XML is not well-formed.";
  return { message, line: m ? Number(m[1]) : null, column: m ? Number(m[2]) : null };
}

export default function Tool() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState("  ");
  const [removeComments, setRemoveComments] = useState(false);
  const [out, setOut] = useState<Out | null>(null);
  const [emptyErr, setEmptyErr] = useState(false);

  const run = (action: Action, text = input) => {
    if (!text.trim()) {
      setEmptyErr(true);
      setOut(null);
      return;
    }
    setEmptyErr(false);
    const dom = validateWithDom(text);
    if (dom) {
      setOut({ kind: "error", ...dom, source: text });
      return;
    }
    try {
      const stats = xmlStats(text);
      const result = action === "minify" ? minifyXml(text, { removeComments }) : action === "format" ? formatXml(text, { indent, removeComments }) : "";
      setOut({ kind: "ok", action, text: result, stats, before: byteLen(text) });
    } catch (e) {
      if (e instanceof XmlError) setOut({ kind: "error", message: e.message, line: e.line, column: e.column, source: text });
      else setOut({ kind: "error", message: errorMessage(e), line: null, column: null, source: text });
    }
  };

  return (
    <div className="space-y-5">
      <SplitGrid>
        <ToolPanel
          title="XML input"
          actions={
            <>
              <Btn
                variant="ghost"
                icon="code"
                onClick={() => {
                  setInput(SAMPLE);
                  run("format", SAMPLE);
                }}
              >
                Load sample
              </Btn>
              <ResetBtn
                onClick={() => {
                  setInput("");
                  setOut(null);
                  setEmptyErr(false);
                }}
              />
            </>
          }
        >
          <div className="space-y-4">
            <TextArea
              label="XML"
              mono
              rows={16}
              value={input}
              error={emptyErr ? "Paste some XML first." : null}
              hint="Press Ctrl or Cmd + Enter to format."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  run("format");
                }
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Indent"
                value={indent}
                onChange={(e) => setIndent(e.target.value)}
                options={[
                  { value: "  ", label: "2 spaces" },
                  { value: "    ", label: "4 spaces" },
                  { value: "\t", label: "Tab" },
                ]}
              />
              <div className="pt-7">
                <Checkbox label="Remove comments" checked={removeComments} onChange={setRemoveComments} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn icon="code" onClick={() => run("format")}>
                Format
              </Btn>
              <Btn variant="ghost" onClick={() => run("minify")}>
                Minify
              </Btn>
              <Btn variant="ghost" icon="check" onClick={() => run("validate")}>
                Validate
              </Btn>
            </div>
          </div>
        </ToolPanel>
        <ToolPanel title="Result">
          {!out ? (
            <EmptyState icon="code" title="No result yet">
              Paste XML and choose Format, Minify or Validate.
            </EmptyState>
          ) : out.kind === "error" ? (
            <ParseError title="XML is not well-formed" message={out.message} line={out.line} column={out.column} source={out.source} />
          ) : (
            <div className="space-y-4">
              <Notice tone="success">
                Well-formed XML{out.stats.root ? ` with root element <${out.stats.root}>` : ""}: {out.stats.elements.toLocaleString()} elements, {out.stats.attributes.toLocaleString()} attributes, depth {out.stats.depth}.
              </Notice>
              {out.action !== "validate" && (
                <>
                  <SizeStats before={out.before} after={byteLen(out.text)} />
                  <CodeResult code={out.text} filename={out.action === "minify" ? "minified.xml" : "formatted.xml"} mime="application/xml" label="Formatted XML" />
                </>
              )}
              <p className="text-[0.8125rem] text-muted">Well-formed means the syntax is correct. It is not checked against a DTD or XML Schema.</p>
            </div>
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
