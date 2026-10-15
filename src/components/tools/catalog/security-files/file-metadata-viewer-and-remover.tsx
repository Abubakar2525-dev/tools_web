"use client";

import { useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, downloadBlob, formatBytes } from "@/components/tools/engines/files";
import {
  type MetaFormat,
  type MetaItem,
  type MetaReport,
  type OfficeParts,
  cleanOffice,
  inspectJpeg,
  inspectMp3,
  inspectOffice,
  inspectPng,
  inspectWebp,
  sniffMetaFormat,
  stripJpeg,
  stripMp3,
  stripPng,
  stripWebp,
} from "./lib/metadata";
import { TableWrap, errorText, tdCls, thCls } from "./shared";

const MIME: Record<Exclude<MetaFormat, null>, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp3: "audio/mpeg",
  pdf: "application/pdf",
  ooxml: "application/octet-stream",
};

/* ------------------------------------------------------------------ */
/* Readers that need libraries (loaded on demand)                      */
/* ------------------------------------------------------------------ */

function show(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  if (v instanceof Uint8Array || v instanceof ArrayBuffer) return null;
  if (Array.isArray(v)) {
    if (v.length > 16) return `${v.length} values`;
    return v.map((x) => show(x) ?? "").join(", ");
  }
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s ? (s.length > 300 ? `${s.slice(0, 300)}…` : s) : null;
}

async function exifFields(bytes: Uint8Array): Promise<MetaItem[]> {
  try {
    const exifr = (await import("exifr")).default;
    const data = (await exifr.parse(bytes, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: true,
      iptc: true,
      icc: false,
      ifd1: false,
      jfif: false,
      interop: false,
      mergeOutput: true,
      translateValues: true,
      reviveValues: true,
    })) as Record<string, unknown> | undefined;
    if (!data) return [];
    const out: MetaItem[] = [];
    for (const [k, v] of Object.entries(data)) {
      const s = show(v);
      if (s) out.push({ label: k, value: s });
    }
    return out;
  } catch {
    return [];
  }
}

async function pdfOpen(bytes: Uint8Array) {
  const lib = await import("pdf-lib");
  try {
    const doc = await lib.PDFDocument.load(bytes, { updateMetadata: false });
    return { lib, doc };
  } catch (e) {
    if (/encrypt/i.test(errorText(e))) throw new Error("This PDF is encrypted. Remove its password first, then try again.");
    throw new Error("This PDF could not be parsed.");
  }
}

async function inspectPdf(bytes: Uint8Array): Promise<MetaReport> {
  const { lib, doc } = await pdfOpen(bytes);
  const fields: MetaItem[] = [];
  const blocks: MetaReport["blocks"] = [];
  const infoRef = doc.context.trailerInfo.Info;
  const info = infoRef ? doc.context.lookup(infoRef) : undefined;
  if (info instanceof lib.PDFDict) {
    const keys = info.keys();
    blocks.push({ name: "Document information dictionary", bytes: 0, removable: true, detail: `${keys.length} entries` });
    for (const k of keys) {
      const v = info.get(k);
      let s: string | null = null;
      if (v instanceof lib.PDFString || v instanceof lib.PDFHexString) {
        s = v.decodeText();
        const d = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(s);
        if (d) s = `${d[1]}-${d[2] ?? "01"}-${d[3] ?? "01"} ${d[4] ?? "00"}:${d[5] ?? "00"}:${d[6] ?? "00"} (${s})`;
      } else if (v) s = v.toString();
      if (s) fields.push({ label: k.decodeText(), value: s });
    }
  }
  const xmp = doc.catalog.get(lib.PDFName.of("Metadata"));
  if (xmp) {
    const stream = doc.context.lookup(xmp);
    let size = 0;
    if (stream instanceof lib.PDFRawStream) {
      size = stream.contents.length;
      const text = new TextDecoder().decode(stream.contents);
      for (const tag of ["dc:creator", "xmp:CreatorTool", "pdf:Producer", "xmp:CreateDate", "xmp:ModifyDate", "xmpMM:DocumentID"]) {
        const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(text);
        if (m) {
          const v = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (v) fields.push({ label: `XMP ${tag}`, value: v });
        }
      }
    }
    blocks.push({ name: "XMP metadata stream", bytes: size, removable: true });
  }
  return { format: "PDF document", blocks, fields };
}

async function stripPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const { lib, doc } = await pdfOpen(bytes);
  const infoRef = doc.context.trailerInfo.Info;
  const info = infoRef ? doc.context.lookup(infoRef) : undefined;
  if (info instanceof lib.PDFDict) for (const k of info.keys()) info.delete(k);
  const xmp = doc.catalog.get(lib.PDFName.of("Metadata"));
  if (xmp) {
    doc.catalog.delete(lib.PDFName.of("Metadata"));
    if (xmp instanceof lib.PDFRef) doc.context.delete(xmp);
  }
  return doc.save();
}

const OFFICE_PARTS = { core: "docProps/core.xml", app: "docProps/app.xml", custom: "docProps/custom.xml" } as const;

async function readOffice(bytes: Uint8Array) {
  const { unzipSync, strFromU8 } = await import("fflate");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("This Office file could not be unzipped. It may be damaged or password-protected.");
  }
  const parts: OfficeParts = {};
  const sizes: Record<string, number> = {};
  for (const [k, path] of Object.entries(OFFICE_PARTS) as [keyof OfficeParts, string][]) {
    if (files[path]) {
      parts[k] = strFromU8(files[path]);
      sizes[path] = files[path].length;
    }
  }
  return { files, parts, sizes };
}

async function inspectOoxml(bytes: Uint8Array) {
  const { parts, sizes } = await readOffice(bytes);
  return inspectOffice(parts, sizes);
}

async function stripOoxml(bytes: Uint8Array) {
  const { zipSync, strToU8 } = await import("fflate");
  const { files, parts } = await readOffice(bytes);
  const clean = cleanOffice(parts);
  for (const [k, path] of Object.entries(OFFICE_PARTS) as [keyof OfficeParts, string][]) {
    const v = clean[k];
    if (v !== undefined) files[path] = strToU8(v);
  }
  return zipSync(files, { level: 6 });
}

async function inspect(format: Exclude<MetaFormat, null>, bytes: Uint8Array): Promise<MetaReport> {
  if (format === "jpeg" || format === "png" || format === "webp") {
    const inflate = format === "png" ? (await import("fflate")).unzlibSync : undefined;
    const base = format === "jpeg" ? inspectJpeg(bytes) : format === "png" ? inspectPng(bytes, inflate) : inspectWebp(bytes);
    return { ...base, fields: [...base.fields, ...(await exifFields(bytes))] };
  }
  if (format === "mp3") return inspectMp3(bytes);
  if (format === "pdf") return inspectPdf(bytes);
  return inspectOoxml(bytes);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

type State =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; format: Exclude<MetaFormat, null>; bytes: Uint8Array; before: MetaReport; after?: { bytes: Uint8Array; report: MetaReport } };

function ReportView({ report, title }: { report: MetaReport; title: string }) {
  const removable = report.blocks.filter((b) => b.removable);
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {removable.length === 0 && report.fields.length === 0 ? (
        <Notice tone="success">No metadata found.</Notice>
      ) : (
        <>
          {report.blocks.length > 0 && (
            <ul className="space-y-1 text-sm">
              {report.blocks.map((b, i) => (
                <li key={`${b.name}-${i}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-sunken px-3 py-2">
                  <span className="text-ink">
                    {b.name}
                    {!b.removable && <span className="text-muted"> (kept, needed for correct display)</span>}
                    {b.detail && <span className="block break-all text-[0.8125rem] text-muted">{b.detail}</span>}
                  </span>
                  {b.bytes > 0 && <span className="tabular-nums text-muted">{formatBytes(b.bytes)}</span>}
                </li>
              ))}
            </ul>
          )}
          {report.fields.length > 0 && (
            <TableWrap label={`${title} fields`}>
              <thead>
                <tr>
                  <th className={thCls}>Field</th>
                  <th className={thCls}>Value</th>
                </tr>
              </thead>
              <tbody>
                {report.fields.map((f, i) => (
                  <tr key={`${f.label}-${i}`}>
                    <td className={`${tdCls} whitespace-nowrap text-ink-2`}>{f.label}</td>
                    <td className={`${tdCls} break-all`}>{f.value}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </>
      )}
    </div>
  );
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>({ kind: "empty" });
  const [keepIcc, setKeepIcc] = useState(true);
  const [keepOrientation, setKeepOrientation] = useState(true);
  const [working, setWorking] = useState(false);
  const [stripError, setStripError] = useState<string | null>(null);

  const open = async (f: File | null) => {
    setFile(f);
    setStripError(null);
    if (!f) return setState({ kind: "empty" });
    setState({ kind: "loading" });
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const format = sniffMetaFormat(bytes, f.name);
      if (!format) throw new Error("Unsupported file. Use JPEG, PNG, WebP, PDF, MP3, DOCX, XLSX or PPTX.");
      const before = await inspect(format, bytes);
      setState({ kind: "ready", format, bytes, before });
    } catch (e) {
      setState({ kind: "error", message: errorText(e, "This file could not be read.") });
    }
  };

  const strip = async () => {
    if (state.kind !== "ready") return;
    setWorking(true);
    setStripError(null);
    try {
      const { format, bytes } = state;
      let out: Uint8Array;
      if (format === "jpeg") out = stripJpeg(bytes, { keepIcc, keepOrientation });
      else if (format === "png") out = stripPng(bytes, { keepIcc });
      else if (format === "webp") out = stripWebp(bytes, { keepIcc });
      else if (format === "mp3") out = stripMp3(bytes);
      else if (format === "pdf") out = await stripPdf(bytes);
      else out = await stripOoxml(bytes);
      const report = await inspect(format, out);
      setState({ ...state, after: { bytes: out, report } });
    } catch (e) {
      setStripError(errorText(e, "Metadata could not be removed."));
    } finally {
      setWorking(false);
    }
  };

  const isImage = state.kind === "ready" && (state.format === "jpeg" || state.format === "png" || state.format === "webp");
  const after = state.kind === "ready" ? state.after : undefined;
  const mime = state.kind === "ready" ? MIME[state.format] : "application/octet-stream";
  const cleanName = file ? file.name.replace(/(\.[^.]+)?$/, (ext) => `-clean${ext}`) : "clean";

  return (
    <div className="space-y-5">
      <ToolPanel title="File metadata viewer and remover">
        <div className="space-y-5">
          {file ? (
            <FileChip file={file} onRemove={() => void open(null)} />
          ) : (
            <FileDrop
              onFiles={(f) => void open(f[0])}
              accept=".jpg,.jpeg,.png,.webp,.pdf,.mp3,.docx,.xlsx,.pptx,.docm,.xlsm,.pptm,image/jpeg,image/png,image/webp,application/pdf,audio/mpeg"
              maxSizeMB={300}
              hint="JPEG, PNG, WebP, PDF, MP3, DOCX, XLSX or PPTX up to 300 MB."
            />
          )}
          {state.kind === "empty" && (
            <EmptyState icon="eye" title="Choose a file to inspect">
              You will see the hidden details it carries, such as GPS position, camera, author or editing software, before deciding to remove them.
            </EmptyState>
          )}
          {state.kind === "loading" && <Spinner label="Reading metadata" />}
          {state.kind === "error" && <Notice tone="error">{state.message}</Notice>}
          {state.kind === "ready" && (
            <>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                {isImage && <Checkbox label="Keep the color profile (ICC)" checked={keepIcc} onChange={setKeepIcc} hint="Removing it can shift colors on wide-gamut photos." />}
                {state.format === "jpeg" && (
                  <Checkbox label="Keep rotation (orientation tag only)" checked={keepOrientation} onChange={setKeepOrientation} hint="Without it, some photos display sideways." />
                )}
              </div>
              <Btn icon="trash" onClick={() => void strip()} disabled={working}>
                Remove metadata
              </Btn>
              {working && <Spinner label="Removing metadata" />}
              {stripError && <Notice tone="error">{stripError}</Notice>}
              <div className="grid gap-6 lg:grid-cols-2" aria-live="polite">
                <ReportView report={state.before} title={`Before (${formatBytes(state.bytes.length)})`} />
                {after ? (
                  <div className="min-w-0 space-y-3">
                    <ReportView report={after.report} title={`After (${formatBytes(after.bytes.length)})`} />
                    <Btn icon="download" onClick={() => downloadBlob(new Blob([after.bytes as BlobPart], { type: mime }), cleanName)}>
                      Download {cleanName}
                    </Btn>
                  </div>
                ) : (
                  <EmptyState icon="trash" title="Not cleaned yet">
                    Press Remove metadata to build a clean copy. Your original file is not changed.
                  </EmptyState>
                )}
              </div>
              <p className="text-[0.8125rem] text-muted">
                {state.format === "pdf"
                  ? "PDFs are rewritten by pdf-lib: page content and images are copied as they are, the information dictionary is emptied and the XMP stream is dropped. Metadata inside embedded images or attachments is not touched."
                  : state.format === "ooxml"
                    ? "Document properties are cleared. Names stored in comments, tracked changes or the document body itself are not edited; review those in Office."
                    : state.format === "mp3"
                      ? "ID3v2, ID3v1 and APEv2 tags are cut off by byte range; the audio frames are not touched."
                      : "Metadata segments and chunks are removed byte for byte. The image data is not decoded or re-compressed, so quality is unchanged."}
              </p>
            </>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
