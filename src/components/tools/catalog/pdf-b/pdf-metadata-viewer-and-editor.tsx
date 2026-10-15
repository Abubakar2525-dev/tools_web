"use client";

import { useEffect, useState } from "react";
import { Btn, Checkbox, Notice, PrivacyNote, StatGrid, TextField, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { getPdfLib } from "@/components/tools/engines/pdf";
import { PdfPicker, ResultBar, outName, type PdfSource } from "./shared";
import { type PdfLib, loadForEdit } from "./lib/write";
import { fromLocalInput, splitKeywords, toLocalInput } from "./lib/text";
import type { PDFDocument } from "pdf-lib";

interface Meta {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  created: string;
  modified: string;
}

const EMPTY: Meta = { title: "", author: "", subject: "", keywords: "", creator: "", producer: "", created: "", modified: "" };

const LABELS: [keyof Meta, string, string?][] = [
  ["title", "Title"],
  ["author", "Author"],
  ["subject", "Subject"],
  ["keywords", "Keywords", "Separate with commas."],
  ["creator", "Creator (original app)"],
  ["producer", "Producer (PDF writer)"],
];

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/** Removes the catalog's XMP metadata stream, including the stream object itself. */
function removeXmp(L: PdfLib, doc: PDFDocument) {
  const key = L.PDFName.of("Metadata");
  const raw = doc.catalog.get(key);
  if (!raw) return false;
  doc.catalog.delete(key);
  if (raw instanceof L.PDFRef) doc.context.delete(raw);
  return true;
}

function infoDict(L: PdfLib, doc: PDFDocument) {
  const existing = doc.context.lookup(doc.context.trailerInfo.Info);
  if (existing instanceof L.PDFDict) return existing;
  const d = doc.context.obj({});
  doc.context.trailerInfo.Info = doc.context.register(d);
  return d;
}

async function readMeta(bytes: Uint8Array) {
  const L = await getPdfLib();
  const doc = await loadForEdit(L, bytes);
  const meta: Meta = {
    title: safe(() => doc.getTitle()) ?? "",
    author: safe(() => doc.getAuthor()) ?? "",
    subject: safe(() => doc.getSubject()) ?? "",
    keywords: safe(() => doc.getKeywords()) ?? "",
    creator: safe(() => doc.getCreator()) ?? "",
    producer: safe(() => doc.getProducer()) ?? "",
    created: toLocalInput(safe(() => doc.getCreationDate())),
    modified: toLocalInput(safe(() => doc.getModificationDate())),
  };
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  const known = new Set(["Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "ModDate"]);
  const extra =
    info instanceof L.PDFDict
      ? info
          .keys()
          .map((k) => k.decodeText())
          .filter((k) => !known.has(k))
      : [];
  const hasXmp = !!doc.catalog.get(L.PDFName.of("Metadata"));
  return { meta, extra, hasXmp, pages: doc.getPageCount(), version: new TextDecoder().decode(bytes.slice(0, 8)).match(/%PDF-(\d\.\d)/)?.[1] ?? "unknown" };
}

export default function Tool() {
  const [source, setSource] = useState<PdfSource | null>(null);
  const [info, setInfo] = useState<{ bytes: Uint8Array; data: Awaited<ReturnType<typeof readMeta>> } | { bytes: Uint8Array; error: string } | null>(null);
  const [meta, setMeta] = useState<Meta>(EMPTY);
  const [dropXmp, setDropXmp] = useState(true);
  const [touchMod, setTouchMod] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; kind: "edit" | "strip" } | null>(null);

  useEffect(() => {
    if (!source) return;
    let alive = true;
    readMeta(source.bytes)
      .then((data) => {
        if (!alive) return;
        setInfo({ bytes: source.bytes, data });
        setMeta(data.meta);
      })
      .catch((e: unknown) => {
        if (alive) setInfo({ bytes: source.bytes, error: e instanceof Error ? e.message : "Could not read this PDF." });
      });
    return () => {
      alive = false;
    };
  }, [source]);

  const current = source && info && info.bytes === source.bytes ? info : null;
  const data = current && "data" in current ? current.data : null;
  const createdBad = meta.created !== "" && !fromLocalInput(meta.created);
  const modifiedBad = meta.modified !== "" && !fromLocalInput(meta.modified);

  async function run(kind: "edit" | "strip") {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const L = await getPdfLib();
      const doc = await loadForEdit(L, source.bytes);
      const dict = infoDict(L, doc);
      if (kind === "strip") {
        for (const k of dict.keys()) dict.delete(k);
        doc.context.trailerInfo.Info = undefined;
        removeXmp(L, doc);
      } else {
        const setOrDelete = (key: string, value: string, setter: (v: string) => void) => {
          if (value.trim()) setter(value.trim());
          else dict.delete(L.PDFName.of(key));
        };
        setOrDelete("Title", meta.title, (v) => doc.setTitle(v));
        setOrDelete("Author", meta.author, (v) => doc.setAuthor(v));
        setOrDelete("Subject", meta.subject, (v) => doc.setSubject(v));
        setOrDelete("Keywords", meta.keywords, (v) => doc.setKeywords(splitKeywords(v)));
        setOrDelete("Creator", meta.creator, (v) => doc.setCreator(v));
        setOrDelete("Producer", meta.producer, (v) => doc.setProducer(v));
        const c = fromLocalInput(meta.created);
        if (c) doc.setCreationDate(c);
        else dict.delete(L.PDFName.of("CreationDate"));
        const m = touchMod ? new Date() : fromLocalInput(meta.modified);
        if (m) doc.setModificationDate(m);
        else dict.delete(L.PDFName.of("ModDate"));
        if (dropXmp) removeXmp(L, doc);
      }
      const bytes = await doc.save();
      setResult({ bytes, kind });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The PDF could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolPanel title={source ? undefined : "Choose a PDF"}>
      <div className="space-y-5">
        <PdfPicker
          source={source}
          onChange={(s) => {
            setSource(s);
            setResult(null);
            setError(null);
          }}
        />
        {source && !current && <Spinner label="Reading metadata" />}
        {current && "error" in current && <Notice tone="error">{current.error}</Notice>}
        {data && source && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run("edit");
            }}
          >
            <StatGrid
              items={[
                { label: "PDF version", value: data.version },
                { label: "Pages", value: data.pages },
                { label: "XMP metadata", value: data.hasXmp ? "Present" : "None" },
              ]}
            />
            {data.extra.length > 0 && (
              <p className="text-sm text-ink-2">
                Other info fields in this file: <span className="font-mono text-[0.8125rem]">{data.extra.join(", ")}</span>. They are kept when editing and removed by Strip all.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {LABELS.map(([k, label, hint]) => (
                <TextField key={k} label={label} hint={hint} optional value={meta[k]} onChange={(e) => setMeta((m) => ({ ...m, [k]: e.target.value }))} />
              ))}
              <TextField label="Created" type="datetime-local" optional value={meta.created} error={createdBad ? "Enter a valid date and time." : null} onChange={(e) => setMeta((m) => ({ ...m, created: e.target.value }))} />
              <TextField
                label="Modified"
                type="datetime-local"
                optional
                value={meta.modified}
                disabled={touchMod}
                error={modifiedBad ? "Enter a valid date and time." : null}
                onChange={(e) => setMeta((m) => ({ ...m, modified: e.target.value }))}
              />
            </div>
            <p className="text-[0.8125rem] text-muted">Leave a field empty to remove it. Times are in your local time zone.</p>
            <div className="space-y-3 rounded-xl bg-sunken p-4">
              <Checkbox label="Set Modified to now" checked={touchMod} onChange={setTouchMod} />
              <Checkbox
                label="Remove XMP metadata"
                checked={dropXmp}
                onChange={setDropXmp}
                hint={data.hasXmp ? "This file has an XMP block that may still hold the old values. Many apps read XMP first." : "This file has no XMP block."}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Btn type="submit" icon="check" disabled={busy || createdBad || modifiedBad}>
                Save changes
              </Btn>
              <Btn variant="danger" icon="trash" disabled={busy} onClick={() => void run("strip")}>
                Strip all metadata
              </Btn>
            </div>
            {busy && <Spinner label="Saving" />}
            {error && <Notice tone="error">{error}</Notice>}
            {result && (
              <ResultBar
                bytes={result.bytes}
                name={outName(source, result.kind === "strip" ? "no-metadata" : "metadata")}
                message={result.kind === "strip" ? "Removed the document info dictionary and the XMP metadata stream." : "Metadata updated."}
              />
            )}
          </form>
        )}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}
