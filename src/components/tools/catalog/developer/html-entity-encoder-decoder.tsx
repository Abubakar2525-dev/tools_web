"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, CopyBtn, Notice, PrivacyNote, ResetBtn, Segmented, SelectField, SplitGrid, StatGrid, TextArea, ToolPanel, downloadFile } from "@/components/tools/kit";
import { decodeEntities, encodeEntities, type EncodeMode } from "./lib/entities";

type Dir = "encode" | "decode";

const ENCODE_SAMPLE = `<p class="note">Café & crème brûlée cost €4.50 — "best" in town © 2026 😀</p>`;
const DECODE_SAMPLE = `&lt;p&gt;Caf&eacute; &amp; cr&egrave;me br&#251;l&#xE9;e &mdash; &quot;best&quot; &check; &bigstar; &copy; 2026&lt;/p&gt;`;

const cache = new Map<string, string | null>();

/** Resolves any HTML5 named reference using a detached document from DOMParser. Nothing touches the live page. */
function domResolve(ref: string): string | null {
  if (cache.has(ref)) return cache.get(ref) ?? null;
  let out: string | null = null;
  if (typeof DOMParser !== "undefined" && /^&[A-Za-z][A-Za-z0-9]*;$/.test(ref)) {
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${ref}`, "text/html");
    const text = doc.body.textContent ?? "";
    out = text && text !== ref ? text : null;
  }
  cache.set(ref, out);
  return out;
}

export default function Tool() {
  const [dir, setDir] = useState<Dir>("encode");
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<EncodeMode>("named");
  const [hex, setHex] = useState(false);
  const [quotes, setQuotes] = useState(true);
  const [whitespace, setWhitespace] = useState(false);
  const dInput = useDeferredValue(input);

  const res = useMemo(() => {
    if (!dInput) return null;
    if (dir === "encode") {
      const r = encodeEntities(dInput, { mode, hex, quotes, whitespace });
      return { text: r.text, count: r.encoded, unknown: [] as string[] };
    }
    const r = decodeEntities(dInput, domResolve);
    return { text: r.text, count: r.decoded, unknown: r.unknown };
  }, [dInput, dir, mode, hex, quotes, whitespace]);

  return (
    <div className="space-y-5">
      <ToolPanel title="Options">
        <div className="space-y-5">
          <Segmented
            label="Direction"
            value={dir}
            onChange={setDir}
            options={[
              { value: "encode", label: "Encode" },
              { value: "decode", label: "Decode" },
            ]}
          />
          {dir === "encode" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label="What to escape"
                value={mode}
                onChange={(e) => setMode(e.target.value as EncodeMode)}
                options={[
                  { value: "minimal", label: "Only & < > (and quotes)" },
                  { value: "named", label: "Also non-ASCII, named where possible" },
                  { value: "numeric", label: "Also non-ASCII, numeric only" },
                ]}
              />
              <div className="space-y-3 pt-1 sm:col-span-1 lg:col-span-3">
                <Checkbox label={"Escape quotes (\" and ')"} hint="Needed inside attribute values." checked={quotes} onChange={setQuotes} />
                <Checkbox label={"Hexadecimal numeric references (&#xE9;)"} checked={hex} onChange={setHex} />
                <Checkbox label="Encode tabs and line breaks" checked={whitespace} onChange={setWhitespace} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-2">
              Decodes named (&amp;eacute;), decimal (&amp;#233;) and hex (&amp;#xE9;) references, including every HTML5 name. Tags in the input stay as text; nothing is rendered.
            </p>
          )}
        </div>
      </ToolPanel>
      <SplitGrid>
        <ToolPanel
          title={dir === "encode" ? "Text or HTML to encode" : "Encoded text"}
          actions={
            <>
              <Btn variant="ghost" icon="code" onClick={() => setInput(dir === "encode" ? ENCODE_SAMPLE : DECODE_SAMPLE)}>
                Load sample
              </Btn>
              <ResetBtn onClick={() => setInput("")} />
            </>
          }
        >
          <TextArea label="Input" mono rows={14} value={input} onChange={(e) => setInput(e.target.value)} placeholder={dir === "encode" ? "<b>Fish & chips</b>" : "&lt;b&gt;Fish &amp; chips&lt;/b&gt;"} />
        </ToolPanel>
        <ToolPanel
          title="Result"
          actions={
            <>
              <Btn variant="subtle" icon="swap" disabled={!res} onClick={() => {
                  if (!res) return;
                  setInput(res.text);
                  setDir(dir === "encode" ? "decode" : "encode");
                }}>
                Use as input
              </Btn>
              <Btn variant="ghost" icon="download" disabled={!res} onClick={() => res && downloadFile(dir === "encode" ? "encoded.txt" : "decoded.txt", res.text)}>
                Download
              </Btn>
              <CopyBtn text={res?.text ?? ""} />
            </>
          }
        >
          <div className="space-y-4">
            <TextArea label="Output" mono rows={14} readOnly value={res?.text ?? ""} placeholder="The result appears as you type." />
            {res && (
              <StatGrid
                items={[
                  { label: dir === "encode" ? "Characters escaped" : "References decoded", value: res.count.toLocaleString() },
                  { label: "Input length", value: dInput.length.toLocaleString() },
                  { label: "Output length", value: res.text.length.toLocaleString() },
                ]}
              />
            )}
            {res && res.unknown.length > 0 && (
              <Notice tone="warning">Not recognized, left unchanged: {res.unknown.slice(0, 8).join(", ")}</Notice>
            )}
          </div>
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
