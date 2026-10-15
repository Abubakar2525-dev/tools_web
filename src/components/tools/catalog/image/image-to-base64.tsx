"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, OutputBlock, PrivacyNote, Segmented, StatGrid, TextArea, TextField, ToolPanel, fmt } from "@/components/tools/kit";
import { FileChip, FileDrop, downloadBlob, formatBytes, useObjectUrl } from "@/components/tools/engines/files";
import { CHECKER, errMsg } from "./shared";
import { bytesToBase64, detectImageType, extForMime, parseBase64Input } from "./lib/bytes";

type Tab = "encode" | "decode";
type Snippet = "datauri" | "base64" | "css" | "html" | "markdown";

function Encode() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<{ file: File; b64: string; mime: string; error: string | null } | null>(null);
  const [alt, setAlt] = useState("");
  const [snippet, setSnippet] = useState<Snippet>("datauri");

  useEffect(() => {
    if (!file) return;
    let alive = true;
    file
      .arrayBuffer()
      .then((buf) => {
        const bytes = new Uint8Array(buf);
        const det = detectImageType(bytes);
        const mime = det?.mime ?? (file.type || "application/octet-stream");
        if (alive) setState({ file, b64: bytesToBase64(bytes), mime, error: null });
      })
      .catch((e) => alive && setState({ file, b64: "", mime: "", error: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [file]);

  const cur = state && state.file === file ? state : null;
  const url = useObjectUrl(file);
  const dataUri = cur && !cur.error ? `data:${cur.mime};base64,${cur.b64}` : "";
  const a = alt.replace(/"/g, "&quot;");
  const text = !dataUri
    ? ""
    : {
        datauri: dataUri,
        base64: cur?.b64 ?? "",
        css: `.image {\n  background-image: url("${dataUri}");\n}`,
        html: `<img src="${dataUri}" alt="${a}">`,
        markdown: `![${alt.replace(/[[\]]/g, "")}](${dataUri})`,
      }[snippet];
  const preview = text.length > 20000 ? `${text.slice(0, 20000)}\n… (${fmt(text.length - 20000, 0)} more characters; use Copy or Download for the full text)` : text;

  return (
    <div className="space-y-5">
      {file ? (
        <FileChip file={file} onRemove={() => setFile(null)} />
      ) : (
        <FileDrop onFiles={(f) => setFile(f[0] ?? null)} accept="image/*,.svg,.ico,.avif,.heic" maxSizeMB={20} allowPaste label="Choose an image to encode" />
      )}
      {cur?.error && <Notice tone="error">{cur.error}</Notice>}
      {cur && !cur.error && (
        <>
          <div className="flex flex-wrap items-start gap-4">
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Preview of the chosen image" className="max-h-40 max-w-full rounded-lg object-contain" style={CHECKER} />
            )}
            <div className="min-w-[220px] flex-1">
              <StatGrid
                items={[
                  { label: "Type", value: cur.mime.replace("image/", "") },
                  { label: "File size", value: formatBytes(cur.file.size) },
                  { label: "Base64 length", value: `${fmt(cur.b64.length, 0)} chars` },
                ]}
              />
            </div>
          </div>
          {cur.file.size > 100 * 1024 && (
            <Notice tone="warning">
              Base64 makes data about 33% larger and cannot be cached separately. Inlining is best for small icons; serve larger images as normal files.
            </Notice>
          )}
          <Segmented
            label="Snippet format"
            value={snippet}
            onChange={setSnippet}
            options={[
              { value: "datauri", label: "Data URI" },
              { value: "base64", label: "Base64 only" },
              { value: "css", label: "CSS" },
              { value: "html", label: "HTML" },
              { value: "markdown", label: "Markdown" },
            ]}
          />
          {(snippet === "html" || snippet === "markdown") && <TextField label="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} hint="Describe the image for screen reader users." />}
          <div className="flex flex-wrap gap-2">
            <CopyBtn text={text} />
            <Btn variant="ghost" icon="download" onClick={() => downloadBlob(new Blob([text], { type: "text/plain" }), `${cur.file.name.replace(/\.[^.]+$/, "")}-${snippet}.txt`)}>
              Download .txt
            </Btn>
          </div>
          <OutputBlock label="Encoded output">
            <code className="break-all whitespace-pre-wrap">{preview}</code>
          </OutputBlock>
        </>
      )}
      {!file && <EmptyState icon="image" title="No image yet">Choose or paste an image to get a data URI and ready-made snippets.</EmptyState>}
    </div>
  );
}

function Decode() {
  const [input, setInput] = useState("");
  const parsed = useMemo(() => (input.trim() ? parseBase64Input(input) : null), [input]);
  const detected = parsed?.ok ? detectImageType(parsed.bytes) : null;
  const blob = useMemo(() => (parsed?.ok && detected ? new Blob([parsed.bytes as BlobPart], { type: detected.mime }) : null), [parsed, detected]);
  const url = useObjectUrl(blob);
  const mismatch = parsed?.ok && detected && parsed.declaredMime && parsed.declaredMime !== detected.mime && !(parsed.declaredMime === "image/jpg" && detected.ext === "jpg");

  return (
    <div className="space-y-5">
      <TextArea
        label="Base64 or data URI"
        mono
        rows={8}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="data:image/png;base64,iVBORw0KGgo… or just the Base64 text"
        error={parsed && !parsed.ok ? parsed.error : null}
      />
      {parsed?.ok && !detected && (
        <Notice tone="warning" title="Valid Base64, but not a recognized image">
          Decoded {formatBytes(parsed.bytes.length)}. The first bytes do not match PNG, JPEG, GIF, WebP, AVIF, HEIC, BMP, ICO, TIFF or SVG.
          <div className="mt-2">
            <Btn variant="ghost" icon="download" onClick={() => downloadBlob(new Blob([parsed.bytes as BlobPart]), "decoded.bin")}>
              Download raw bytes
            </Btn>
          </div>
        </Notice>
      )}
      {parsed?.ok && detected && (
        <>
          <StatGrid
            items={[
              { label: "Detected type", value: detected.label },
              { label: "Decoded size", value: formatBytes(parsed.bytes.length) },
              { label: "Declared type", value: parsed.declaredMime ?? "none" },
            ]}
          />
          {mismatch && (
            <Notice tone="warning">
              The data URI says {parsed.declaredMime}, but the bytes are {detected.label}. The download uses the detected type.
            </Notice>
          )}
          {url && (
            <div className="rounded-xl p-3" style={CHECKER}>
              {/* An <img> never runs scripts inside SVG, so this preview is safe. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Decoded image preview" className="mx-auto max-h-80 max-w-full object-contain" />
            </div>
          )}
          {blob && (
            <Btn icon="download" onClick={() => downloadBlob(blob, `decoded.${extForMime(detected.mime)}`)}>
              Download .{extForMime(detected.mime)}
            </Btn>
          )}
        </>
      )}
      {!input.trim() && <EmptyState icon="binary" title="Nothing to decode yet">Paste Base64 text or a full data URI. Line breaks and URL-safe characters are fine.</EmptyState>}
    </div>
  );
}

export default function Tool() {
  const [tab, setTab] = useState<Tab>("encode");
  return (
    <div className="space-y-5">
      <ToolPanel
        title="Image and Base64"
        actions={
          <Segmented
            label="Direction"
            value={tab}
            onChange={setTab}
            options={[
              { value: "encode", label: "Image to Base64" },
              { value: "decode", label: "Base64 to image" },
            ]}
          />
        }
      >
        {tab === "encode" ? <Encode /> : <Decode />}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
