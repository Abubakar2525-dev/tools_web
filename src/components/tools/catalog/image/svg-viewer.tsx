"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, NumberField, OutputBlock, PrivacyNote, Segmented, StatGrid, TextArea, ToolPanel, fmt, parseNum } from "@/components/tools/kit";
import { FileChip, FileDrop, baseName, canvasToBlob, downloadBlob, formatBytes, useObjectUrl } from "@/components/tools/engines/files";
import { CHECKER, errMsg } from "./shared";
import { bytesToBase64 } from "./lib/bytes";
import { makeCanvas } from "./lib/pipeline";

type Info = { ok: true; width: number; height: number; viewBox: string | null; rawW: string | null; rawH: string | null; normalized: string; elements: number; hasScript: boolean; external: boolean } | { ok: false; error: string };

const UNIT: Record<string, number> = { "": 1, px: 1, pt: 4 / 3, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, em: 16, rem: 16 };

function toPx(v: string | null) {
  if (!v) return null;
  const m = /^\s*([0-9.]+(?:e[-+]?\d+)?)\s*([a-z]*)\s*$/i.exec(v);
  if (!m) return null;
  const k = UNIT[m[2].toLowerCase()];
  const n = Number(m[1]);
  return k && n > 0 ? n * k : null;
}

/** Parses the SVG as XML (never inserted into the page) to read its size. */
function inspect(text: string): Info {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length) return { ok: false, error: "This is not well-formed SVG/XML. Check for unclosed tags or stray characters." };
  const root = doc.documentElement;
  if (root.localName !== "svg") return { ok: false, error: `The root element is <${root.localName}>, not <svg>.` };
  const rawW = root.getAttribute("width");
  const rawH = root.getAttribute("height");
  const viewBox = root.getAttribute("viewBox");
  const vb = viewBox?.trim().split(/[\s,]+/).map(Number);
  const vbOk = vb && vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0;
  let w = toPx(rawW);
  let h = toPx(rawH);
  if (vbOk && vb) {
    if (!w && !h) {
      w = vb[2];
      h = vb[3];
    } else if (w && !h) h = (w * vb[3]) / vb[2];
    else if (h && !w) w = (h * vb[2]) / vb[3];
  }
  w = w ?? 300;
  h = h ?? 150;
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  root.setAttribute("width", String(w));
  root.setAttribute("height", String(h));
  const normalized = new XMLSerializer().serializeToString(doc);
  const external = /\b(?:href|xlink:href)\s*=\s*["']\s*(?:https?:)?\/\//i.test(text) || /@import|url\(\s*["']?https?:/i.test(text);
  return {
    ok: true,
    width: w,
    height: h,
    viewBox,
    rawW,
    rawH,
    normalized,
    elements: doc.getElementsByTagName("*").length,
    hasScript: doc.getElementsByTagName("script").length > 0 || /\son[a-z]+\s*=/i.test(text),
    external,
  };
}

/** URL-encoded data URI (smaller than Base64 for SVG). */
function encodeSvgUri(svg: string) {
  const s = svg.replace(/\s+/g, " ").replace(/"/g, "'").trim();
  return `data:image/svg+xml,${s.replace(/[\r\n%#()<>?[\\\]^`{|}]/g, encodeURIComponent)}`;
}

type Bg = "checker" | "white" | "dark";

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [bg, setBg] = useState<Bg>("checker");
  const [scale, setScale] = useState("2");
  const [snippet, setSnippet] = useState<"base64" | "utf8" | "css" | "img">("utf8");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    file.text().then((t) => alive && setText(t));
    return () => {
      alive = false;
    };
  }, [file]);

  const info = useMemo(() => (text.trim() ? inspect(text) : null), [text]);
  const blob = useMemo(() => (info?.ok ? new Blob([info.normalized], { type: "image/svg+xml" }) : null), [info]);
  const url = useObjectUrl(blob);
  const s = parseNum(scale);
  const scaleErr = s === null || s <= 0 || s > 32 ? "Use a scale between 0.1 and 32." : null;
  const outW = info?.ok && s ? Math.round(info.width * s) : 0;
  const outH = info?.ok && s ? Math.round(info.height * s) : 0;

  const snippetText = useMemo(() => {
    if (!info?.ok) return "";
    const b64 = `data:image/svg+xml;base64,${bytesToBase64(new TextEncoder().encode(info.normalized))}`;
    const utf = encodeSvgUri(info.normalized);
    if (snippet === "base64") return b64;
    if (snippet === "utf8") return utf;
    if (snippet === "css") return `.icon {\n  width: ${fmt(info.width, 2)}px;\n  height: ${fmt(info.height, 2)}px;\n  background: url("${utf}") no-repeat center / contain;\n}`;
    return `<img src="${utf}" width="${Math.round(info.width)}" height="${Math.round(info.height)}" alt="">`;
  }, [info, snippet]);

  const exportPng = async () => {
    if (!url || !info?.ok || scaleErr) return;
    setBusy(true);
    setError(null);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const { canvas, ctx } = makeCanvas(outW, outH);
      ctx.drawImage(img, 0, 0, outW, outH);
      let png: Blob;
      try {
        png = await canvasToBlob(canvas, "image/png");
      } catch {
        throw new Error("The browser blocked exporting this SVG (it may embed HTML via foreignObject).");
      }
      downloadBlob(png, `${file ? baseName(file.name) : "image"}@${scale}x.png`);
    } catch (e) {
      setError(errMsg(e).includes("tainted") ? "The browser blocked exporting this SVG (it may embed HTML or external content)." : errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const bgStyle: React.CSSProperties = bg === "checker" ? CHECKER : { background: bg === "white" ? "#fff" : "#16181d" };

  return (
    <div className="space-y-5">
      <ToolPanel title="SVG viewer and converter">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            {file ? (
              <FileChip
                file={file}
                onRemove={() => {
                  setFile(null);
                  setText("");
                }}
              />
            ) : (
              <FileDrop onFiles={(f) => setFile(f[0] ?? null)} accept=".svg,image/svg+xml" maxSizeMB={10} label="Choose an SVG file" compact />
            )}
            <TextArea
              label="Or paste SVG code"
              mono
              rows={10}
              value={text}
              onChange={(e) => {
                setFile(null);
                setText(e.target.value);
              }}
              placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">…</svg>'
              error={info && !info.ok ? info.error : null}
            />
            {info?.ok && (
              <StatGrid
                items={[
                  { label: "Rendered size", value: `${fmt(info.width, 1)} × ${fmt(info.height, 1)}` },
                  { label: "width / height", value: `${info.rawW ?? "none"} / ${info.rawH ?? "none"}` },
                  { label: "viewBox", value: info.viewBox ?? "none" },
                  { label: "Elements", value: fmt(info.elements, 0) },
                  { label: "Source size", value: formatBytes(new Blob([text]).size) },
                  { label: "Aspect", value: (info.width / info.height).toFixed(3) },
                ]}
              />
            )}
            {info?.ok && info.hasScript && <Notice tone="warning">This SVG contains scripts or event handlers. They do not run in this preview (it is shown as an image), but they could run if you open the file directly in a browser.</Notice>}
            {info?.ok && info.external && <Notice>This SVG references external files. Image previews do not load them, so parts may be missing here and in the PNG.</Notice>}
          </div>
          <div className="min-w-0 space-y-4">
            {info?.ok && url ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Segmented
                    label="Preview background"
                    value={bg}
                    onChange={setBg}
                    options={[
                      { value: "checker", label: "Checker" },
                      { value: "white", label: "White" },
                      { value: "dark", label: "Dark" },
                    ]}
                  />
                </div>
                <div className="grid min-h-[220px] place-items-center overflow-auto rounded-xl p-4" style={bgStyle}>
                  {/* Rendered through <img>, which never executes scripts in the SVG. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="SVG preview" className="max-h-[360px] max-w-full" />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-36">
                    <NumberField label="PNG scale" value={scale} onChange={(e) => setScale(e.target.value)} error={scaleErr} />
                  </div>
                  <Btn icon="download" disabled={!!scaleErr || busy} onClick={exportPng}>
                    {busy ? "Exporting…" : `PNG ${outW} × ${outH}`}
                  </Btn>
                  <Btn variant="ghost" icon="download" onClick={() => blob && downloadBlob(blob, `${file ? baseName(file.name) : "image"}.svg`)}>
                    SVG
                  </Btn>
                </div>
                {error && <Notice tone="error">{error}</Notice>}
                <Segmented
                  label="Snippet"
                  value={snippet}
                  onChange={setSnippet}
                  options={[
                    { value: "utf8", label: "Data URI" },
                    { value: "base64", label: "Base64 URI" },
                    { value: "css", label: "CSS" },
                    { value: "img", label: "<img>" },
                  ]}
                />
                <div className="flex justify-end">
                  <CopyBtn text={snippetText} />
                </div>
                <OutputBlock label="Snippet">
                  <code className="break-all whitespace-pre-wrap">{snippetText}</code>
                </OutputBlock>
              </>
            ) : (
              <EmptyState icon="image" title="No SVG yet">
                Choose or paste an SVG to preview it safely, see its size and viewBox, and export PNG or code snippets.
              </EmptyState>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
