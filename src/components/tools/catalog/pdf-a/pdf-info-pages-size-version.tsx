"use client";

import { useEffect, useRef, useState } from "react";
import { CopyBtn, Notice, PrivacyNote, Segmented, StatGrid, ToolPanel, fmt } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, fileToBytes, formatBytes } from "@/components/tools/engines/files";
import { getPdfLib, openPdf } from "@/components/tools/engines/pdf";
import { countRevisions, hasEncryptEntry, isLinearized, looksLikePdf, pdfHeaderVersion } from "./lib/bytes";
import { namePaperSize, normRot, ptToIn, ptToMm } from "./lib/layout";
import { PDF_ACCEPT, destroyDoc, friendlyError } from "./shared";

type PageInfo = { page: number; w: number; h: number; rotation: number };
type Info = {
  file: File;
  headerVersion: string | null;
  catalogVersion: string | null;
  encrypted: boolean;
  needsPassword: boolean;
  linearized: boolean;
  revisions: number;
  pageCount: number | null;
  pages: PageInfo[];
  meta: { label: string; value: string }[];
  notes: string[];
};

type State = { status: "idle" } | { status: "loading"; file: File } | { status: "error"; file: File; message: string } | { status: "ready"; info: Info };

const fmtDate = (d: Date | undefined) => (d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "");

/** Parses a PDF date string like D:20240131120000+01'00' (used for pdf.js info). */
function pdfDate(s: unknown): string {
  if (typeof s !== "string") return "";
  const m = /^D?:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz+-])?(\d{2})?'?(\d{2})?/.exec(s);
  if (!m) return s;
  const [, y, mo = "01", d = "01", h = "00", mi = "00", se = "00", tz, th = "00", tm = "00"] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${se}${!tz || tz.toUpperCase() === "Z" ? "Z" : `${tz}${th}:${tm}`}`;
  return fmtDate(new Date(iso)) || s;
}

async function inspect(file: File): Promise<Info> {
  const bytes = await fileToBytes(file);
  if (!looksLikePdf(bytes)) throw new Error("This file does not start with a PDF header, so it is not a PDF or is damaged.");
  const info: Info = {
    file,
    headerVersion: pdfHeaderVersion(bytes),
    catalogVersion: null,
    encrypted: hasEncryptEntry(bytes),
    needsPassword: false,
    linearized: isLinearized(bytes),
    revisions: countRevisions(bytes),
    pageCount: null,
    pages: [],
    meta: [],
    notes: [],
  };

  // pdf-lib: structure, page boxes and (for unencrypted files) metadata.
  try {
    const { PDFDocument, PDFName } = await getPdfLib();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    info.encrypted ||= doc.isEncrypted;
    const v = doc.catalog.get(PDFName.of("Version"));
    if (v) info.catalogVersion = v.toString().replace(/^\//, "");
    info.pageCount = doc.getPageCount();
    info.pages = doc.getPages().map((p, i) => {
      const box = p.getCropBox();
      return { page: i + 1, w: box.width, h: box.height, rotation: normRot(p.getRotation().angle) };
    });
    if (!info.encrypted) {
      const add = (label: string, value: string | undefined) => value && info.meta.push({ label, value });
      add("Title", doc.getTitle());
      add("Author", doc.getAuthor());
      add("Subject", doc.getSubject());
      add("Keywords", doc.getKeywords());
      add("Creator (app)", doc.getCreator());
      add("Producer", doc.getProducer());
      add("Created", fmtDate(doc.getCreationDate()));
      add("Modified", fmtDate(doc.getModificationDate()));
    }
  } catch {
    info.notes.push("The file structure could not be fully parsed, so page sizes come from the renderer instead.");
  }

  // pdf.js: decrypts metadata when no password is needed, and fills gaps.
  try {
    const js = await openPdf(bytes);
    try {
      if (info.pageCount === null) {
        info.pageCount = js.numPages;
        for (let i = 1; i <= js.numPages; i++) {
          const pg = await js.getPage(i);
          const vp = pg.getViewport({ scale: 1, rotation: 0 });
          info.pages.push({ page: i, w: vp.width, h: vp.height, rotation: normRot(pg.rotate) });
        }
      }
      if (info.encrypted || info.meta.length === 0) {
        const { info: raw } = await js.getMetadata();
        const r = raw as Record<string, unknown>;
        const str = (k: string) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string) : undefined);
        const add = (label: string, value: string | undefined) => value && info.meta.push({ label, value });
        info.meta = [];
        add("Title", str("Title"));
        add("Author", str("Author"));
        add("Subject", str("Subject"));
        add("Keywords", str("Keywords"));
        add("Creator (app)", str("Creator"));
        add("Producer", str("Producer"));
        add("Created", str("CreationDate") && pdfDate(r.CreationDate));
        add("Modified", str("ModDate") && pdfDate(r.ModDate));
      }
    } finally {
      destroyDoc(js);
    }
  } catch (e) {
    const msg = friendlyError(e);
    if (/password/i.test(msg)) {
      info.needsPassword = true;
      info.notes.push("A password is required to open this PDF, so its metadata cannot be read.");
    } else if (info.pageCount === null) throw new Error(msg);
  }
  return info;
}

type Unit = "pt" | "mm" | "in";
const conv = (pt: number, u: Unit) => (u === "pt" ? fmt(pt, 1) : u === "mm" ? fmt(ptToMm(pt), 1) : fmt(ptToIn(pt), 2));

export default function Tool() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [unit, setUnit] = useState<Unit>("mm");
  const token = useRef(0);
  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );

  const load = async (file: File) => {
    const my = ++token.current;
    setState({ status: "loading", file });
    try {
      const info = await inspect(file);
      if (my === token.current) setState({ status: "ready", info });
    } catch (e) {
      if (my === token.current) setState({ status: "error", file, message: friendlyError(e, "This PDF could not be read.") });
    }
  };
  const clear = () => {
    token.current++;
    setState({ status: "idle" });
  };

  return (
    <ToolPanel title="PDF info">
      <div className="space-y-5">
        {state.status === "idle" || state.status === "error" ? (
          <>
            <FileDrop accept={PDF_ACCEPT} maxSizeMB={500} label="Choose a PDF to inspect" onFiles={(f) => f[0] && load(f[0])} />
            {state.status === "error" && <Notice tone="error">{state.message}</Notice>}
          </>
        ) : state.status === "loading" ? (
          <Spinner label={`Inspecting ${state.file.name}`} />
        ) : (
          <Report info={state.info} unit={unit} setUnit={setUnit} onClear={clear} />
        )}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

function Report({ info, unit, setUnit, onClear }: { info: Info; unit: Unit; setUnit: (u: Unit) => void; onClear: () => void }) {
  const version = info.catalogVersion && info.headerVersion && Number(info.catalogVersion) > Number(info.headerVersion) ? info.catalogVersion : info.headerVersion;
  const groups = new Map<string, { w: number; h: number; pages: number[] }>();
  for (const p of info.pages) {
    const swap = p.rotation === 90 || p.rotation === 270;
    const w = swap ? p.h : p.w;
    const h = swap ? p.w : p.h;
    const k = `${Math.round(w)}x${Math.round(h)}`;
    const g = groups.get(k) ?? { w, h, pages: [] };
    g.pages.push(p.page);
    groups.set(k, g);
  }
  const sizeLine = (w: number, h: number) => `${conv(w, unit)} × ${conv(h, unit)} ${unit}`;

  const report = [
    `File: ${info.file.name}`,
    `File size: ${formatBytes(info.file.size)} (${fmt(info.file.size, 0)} bytes)`,
    `PDF version: ${version ?? "unknown"}${info.catalogVersion && info.catalogVersion !== info.headerVersion ? ` (header ${info.headerVersion}, catalog ${info.catalogVersion})` : ""}`,
    `Pages: ${info.pageCount ?? "unknown"}`,
    `Encrypted: ${info.encrypted ? "yes" : "no"}${info.needsPassword ? " (password required to open)" : ""}`,
    `Linearized (fast web view): ${info.linearized ? "yes" : "no"}`,
    `Saved revisions: ${info.revisions}`,
    ...info.meta.map((m) => `${m.label}: ${m.value}`),
    "Page sizes:",
    ...[...groups.values()].map((g) => `  ${sizeLine(g.w, g.h)}${namePaperSize(g.w, g.h) ? ` (${namePaperSize(g.w, g.h)})` : ""}: ${g.pages.length} ${g.pages.length === 1 ? "page" : "pages"}`),
  ].join("\n");

  return (
    <div className="space-y-5">
      <FileChip file={info.file} onRemove={onClear} />
      <StatGrid
        items={[
          { label: "Pages", value: info.pageCount ?? "?" },
          { label: "File size", value: formatBytes(info.file.size) },
          { label: "PDF version", value: version ?? "?" },
          { label: "Encrypted", value: info.encrypted ? "Yes" : "No" },
          { label: "Fast web view", value: info.linearized ? "Yes" : "No" },
          { label: "Saved revisions", value: info.revisions },
        ]}
      />
      {info.catalogVersion && info.catalogVersion !== info.headerVersion && (
        <p className="text-sm text-ink-2">
          The header says {info.headerVersion}, but the document catalog declares version {info.catalogVersion}, which takes precedence when it is higher.
        </p>
      )}
      {info.notes.map((n) => (
        <Notice key={n} tone="warning">
          {n}
        </Notice>
      ))}
      {info.revisions > 1 && <p className="text-sm text-ink-2">This file was saved with {info.revisions - 1} incremental update(s), so earlier versions of its content may still be inside it.</p>}

      <section aria-labelledby="pdfinfo-meta">
        <h3 id="pdfinfo-meta" className="mb-2 text-sm font-medium text-ink">
          Metadata
        </h3>
        {info.meta.length ? (
          <dl className="grid gap-x-4 gap-y-1.5 rounded-xl bg-sunken p-4 text-sm sm:grid-cols-[10rem_1fr]">
            {info.meta.map((m) => (
              <div key={m.label} className="contents">
                <dt className="text-muted">{m.label}</dt>
                <dd className="break-words text-ink">{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted">{info.encrypted && info.needsPassword ? "Metadata is encrypted." : "No document metadata is set."}</p>
        )}
      </section>

      <section aria-labelledby="pdfinfo-sizes" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="pdfinfo-sizes" className="text-sm font-medium text-ink">
            Page sizes
          </h3>
          <Segmented
            label="Units"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "mm", label: "mm" },
              { value: "in", label: "in" },
              { value: "pt", label: "pt" },
            ]}
          />
        </div>
        <ul className="space-y-1 text-sm text-ink-2">
          {[...groups.values()].map((g) => (
            <li key={`${g.w}x${g.h}`}>
              <span className="font-medium tabular-nums text-ink">{sizeLine(g.w, g.h)}</span>
              {namePaperSize(g.w, g.h) && ` · ${namePaperSize(g.w, g.h)}`} · {g.pages.length} {g.pages.length === 1 ? "page" : "pages"}
            </li>
          ))}
        </ul>
        {info.pages.length > 1 && (
          <div className="max-h-80 overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} aria-label="Size of every page">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="sticky top-0 bg-surface text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Page
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Size ({unit}, as displayed)
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Rotation
                  </th>
                </tr>
              </thead>
              <tbody>
                {info.pages.slice(0, 2000).map((p) => {
                  const swap = p.rotation === 90 || p.rotation === 270;
                  return (
                    <tr key={p.page} className="border-t border-line">
                      <td className="px-3 py-1.5">{p.page}</td>
                      <td className="px-3 py-1.5">{sizeLine(swap ? p.h : p.w, swap ? p.w : p.h)}</td>
                      <td className="px-3 py-1.5">{p.rotation}°</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <CopyBtn text={report} label="Copy report" />
    </div>
  );
}
