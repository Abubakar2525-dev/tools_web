"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, SelectField, SplitGrid, TextArea, TextField, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { CodeResult, ParseError, errorMessage, parseJson, useRunGuard } from "./shared";

type Mode = "json2xml" | "xml2json";

const JSON_SAMPLE = `{
  "library": {
    "@_name": "City branch",
    "book": [
      { "@_id": "b1", "title": "Dune", "author": "Frank Herbert", "year": 1965 },
      { "@_id": "b2", "title": "Kindred", "author": "Octavia E. Butler", "year": 1979, "note": { "@_lang": "en", "#text": "Signed copy" } }
    ]
  }
}`;

const XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<library name="City branch">
  <book id="b1">
    <title>Dune</title>
    <author>Frank Herbert</author>
    <year>1965</year>
  </book>
  <book id="b2">
    <title>Kindred &amp; more</title>
    <author>Octavia E. Butler</author>
    <year>1979</year>
    <note lang="en">Signed copy</note>
  </book>
</library>`;

type Out = { kind: "ok"; text: string; warnings: string[] } | { kind: "error"; title: string; message: string; line?: number | null; column?: number | null; source?: string };

const XML_NAME = /^[A-Za-z_][\w.-]*(:[A-Za-z_][\w.-]*)?$/;

function badKeys(v: unknown, prefix: string, text: string, out: Set<string>) {
  if (Array.isArray(v)) v.forEach((x) => badKeys(x, prefix, text, out));
  else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v)) {
      const name = k.startsWith(prefix) && prefix ? k.slice(prefix.length) : k;
      if (k !== text && !XML_NAME.test(name)) out.add(k);
      badKeys(val, prefix, text, out);
    }
  }
}

export default function Tool() {
  const [mode, setMode] = useState<Mode>("json2xml");
  const [input, setInput] = useState("");
  const [prefix, setPrefix] = useState("@_");
  const [textName, setTextName] = useState("#text");
  const [rootName, setRootName] = useState("root");
  const [indent, setIndent] = useState("  ");
  const [decl, setDecl] = useState(true);
  const [selfClose, setSelfClose] = useState(true);
  const [typed, setTyped] = useState(true);
  const [forceArray, setForceArray] = useState(false);
  const [stripNs, setStripNs] = useState(false);
  const [out, setOut] = useState<Out | null>(null);
  const [busy, setBusy] = useState(false);
  const guard = useRunGuard();

  const convert = async () => {
    if (!input.trim()) {
      setOut({ kind: "error", title: "Nothing to convert", message: `Paste some ${mode === "json2xml" ? "JSON" : "XML"} first.` });
      return;
    }
    const token = guard.start();
    setBusy(true);
    try {
      const fxp = await import("fast-xml-parser");
      if (!guard.isCurrent(token)) return;
      if (mode === "json2xml") {
        const p = parseJson(input);
        if (!p.ok) {
          setOut({ kind: "error", title: "Invalid JSON", message: p.message, line: p.line, column: p.column, source: input });
          return;
        }
        const warnings: string[] = [];
        let data = p.value;
        const isObj = data !== null && typeof data === "object" && !Array.isArray(data);
        const keys = isObj ? Object.keys(data as object) : [];
        const root = rootName.trim() || "root";
        if (!isObj || keys.length !== 1 || keys[0].startsWith(prefix) || Array.isArray((data as Record<string, unknown>)[keys[0]])) {
          data = Array.isArray(data) ? { [root]: { item: data } } : { [root]: isObj ? data : { [textName]: data } };
          warnings.push(`The JSON has no single top-level key, so it was wrapped in <${root}>${Array.isArray(p.value) ? " with one <item> per array entry" : ""}.`);
        }
        const bad = new Set<string>();
        badKeys(data, prefix, textName, bad);
        if (bad.size) warnings.push(`These keys are not valid XML element names and will produce invalid XML: ${[...bad].slice(0, 6).join(", ")}${bad.size > 6 ? "…" : ""}.`);
        const builder = new fxp.XMLBuilder({
          ignoreAttributes: false,
          attributeNamePrefix: prefix,
          textNodeName: textName,
          format: indent !== "",
          indentBy: indent,
          suppressEmptyNode: selfClose,
        });
        let xml = String(builder.build(data)).trim();
        if (decl) xml = `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
        setOut({ kind: "ok", text: xml + "\n", warnings });
      } else {
        const v = fxp.XMLValidator.validate(input);
        if (v !== true) {
          setOut({ kind: "error", title: "Invalid XML", message: v.err.msg, line: v.err.line, column: v.err.col, source: input });
          return;
        }
        const parser = new fxp.XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: prefix,
          textNodeName: textName,
          parseTagValue: typed,
          parseAttributeValue: typed,
          ignoreDeclaration: true,
          removeNSPrefix: stripNs,
          isArray: forceArray ? (_name, _path, isLeaf, isAttr) => !isAttr && !isLeaf : undefined,
        });
        const obj: unknown = parser.parse(input);
        setOut({ kind: "ok", text: JSON.stringify(obj, null, 2) + "\n", warnings: [] });
      }
    } catch (e) {
      if (guard.isCurrent(token)) setOut({ kind: "error", title: "Conversion failed", message: errorMessage(e) });
    } finally {
      if (guard.isCurrent(token)) setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Direction and options">
        <div className="space-y-5">
          <Segmented
            label="Direction"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setOut(null);
            }}
            options={[
              { value: "json2xml", label: "JSON to XML" },
              { value: "xml2json", label: "XML to JSON" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField label="Attribute key prefix" hint='Keys like "@_id" become id="…" attributes.' value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            <TextField label="Text content key" hint="Holds element text when attributes are present." value={textName} onChange={(e) => setTextName(e.target.value)} />
            {mode === "json2xml" ? (
              <>
                <TextField label="Wrapper element name" hint="Used when the JSON has no single root key." value={rootName} onChange={(e) => setRootName(e.target.value)} />
                <SelectField
                  label="Indentation"
                  value={indent}
                  onChange={(e) => setIndent(e.target.value)}
                  options={[
                    { value: "  ", label: "2 spaces" },
                    { value: "    ", label: "4 spaces" },
                    { value: "\t", label: "Tab" },
                    { value: "", label: "None (single line)" },
                  ]}
                />
                <Checkbox label="Add XML declaration" checked={decl} onChange={setDecl} />
                <Checkbox label="Self-close empty elements" checked={selfClose} onChange={setSelfClose} />
              </>
            ) : (
              <>
                <Checkbox label="Convert numbers and booleans" hint="Off: every value stays a string." checked={typed} onChange={setTyped} />
                <Checkbox label="Always use arrays for elements with children" hint="Keeps the JSON shape stable when an element appears once." checked={forceArray} onChange={setForceArray} />
                <Checkbox label="Remove namespace prefixes" checked={stripNs} onChange={setStripNs} />
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <SplitGrid>
        <ToolPanel
          title={mode === "json2xml" ? "JSON input" : "XML input"}
          actions={
            <>
              <Btn variant="ghost" icon="braces" onClick={() => setInput(mode === "json2xml" ? JSON_SAMPLE : XML_SAMPLE)}>
                Load sample
              </Btn>
              <ResetBtn
                onClick={() => {
                  setInput("");
                  setOut(null);
                }}
              />
            </>
          }
        >
          <div className="space-y-4">
            <TextArea
              label={mode === "json2xml" ? "JSON" : "XML"}
              mono
              rows={16}
              value={input}
              hint="Press Ctrl or Cmd + Enter to convert."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void convert();
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Btn icon="swap" onClick={() => void convert()} disabled={busy}>
                Convert
              </Btn>
              {busy && <Spinner label="Converting" />}
            </div>
          </div>
        </ToolPanel>
        <ToolPanel title="Result">
          {!out ? (
            <EmptyState icon="code" title="No result yet">
              Paste {mode === "json2xml" ? "JSON" : "XML"} and press Convert.
            </EmptyState>
          ) : out.kind === "error" ? (
            <ParseError title={out.title} message={out.message} line={out.line} column={out.column} source={out.source} />
          ) : (
            <div className="space-y-4">
              {out.warnings.map((w) => (
                <Notice key={w} tone="warning">
                  {w}
                </Notice>
              ))}
              <CodeResult
                code={out.text}
                filename={mode === "json2xml" ? "data.xml" : "data.json"}
                mime={mode === "json2xml" ? "application/xml" : "application/json"}
                extra={
                  <Btn
                    variant="subtle"
                    icon="swap"
                    onClick={() => {
                      setMode(mode === "json2xml" ? "xml2json" : "json2xml");
                      setInput(out.text);
                      setOut(null);
                    }}
                  >
                    Use as input
                  </Btn>
                }
              />
            </div>
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
