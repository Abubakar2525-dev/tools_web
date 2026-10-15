"use client";

import { useCallback, useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, ToolPanel, fmt, uid } from "@/components/tools/kit";
import { FileDrop, downloadBlob, formatBytes, loadImage, useObjectUrl, zipFiles } from "@/components/tools/engines/files";
import { CHECKER, errMsg } from "./shared";
import { containerOf, stripMetadata } from "./lib/metadata";

type Meta = Record<string, unknown>;
type Cleaned = { blob: Blob; removed: string[]; kept: string[] };
type Item = { id: string; file: File; meta: Meta | null; error: string | null; reading: boolean; cleaned?: Cleaned; cleanError?: string };

const FIELDS: [string, string][] = [
  ["Make", "Camera make"],
  ["Model", "Camera model"],
  ["LensModel", "Lens"],
  ["DateTimeOriginal", "Date taken"],
  ["CreateDate", "Created"],
  ["ModifyDate", "Modified"],
  ["ExposureTime", "Shutter"],
  ["FNumber", "Aperture"],
  ["ISO", "ISO"],
  ["FocalLength", "Focal length"],
  ["Orientation", "Orientation"],
  ["Software", "Software"],
  ["Artist", "Artist"],
  ["Copyright", "Copyright"],
  ["ImageWidth", "Width"],
  ["ImageHeight", "Height"],
];

function show(k: string, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" });
  if (k === "ExposureTime" && typeof v === "number") return v >= 1 ? `${v} s` : `1/${Math.round(1 / v)} s`;
  if (k === "FNumber" && typeof v === "number") return `f/${v}`;
  if (k === "FocalLength" && typeof v === "number") return `${v} mm`;
  if (v instanceof Uint8Array || v instanceof ArrayBuffer) return `${v.byteLength} bytes of binary data`;
  if (Array.isArray(v)) return v.map((x) => show("", x)).join(", ");
  if (typeof v === "object") {
    try {
      return JSON.stringify(v).slice(0, 300);
    } catch {
      return "[object]";
    }
  }
  return String(v).slice(0, 300);
}

async function readMeta(file: File): Promise<Meta | null> {
  const exifr = (await import("exifr")).default;
  const out = (await exifr.parse(file, { tiff: true, exif: true, gps: true, xmp: true, iptc: true, icc: false, ifd1: false, jfif: false, ihdr: false })) as Meta | undefined;
  return out ?? null;
}

function PhotoPreview({ item }: { item: Item }) {
  const originalUrl = useObjectUrl(item.file);
  const cleanedUrl = useObjectUrl(item.cleaned?.blob);
  return (
    <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
      {[
        { label: "Original", url: originalUrl },
        { label: "Clean copy", url: cleanedUrl },
      ].map(({ label, url }) => (
        <figure key={label}>
          <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-surface" style={CHECKER}>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={`${label} preview of ${item.file.name}`} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="px-2 text-center text-[0.75rem] text-muted">{label === "Original" ? "Preview" : "Not cleaned yet"}</span>
            )}
          </div>
          <figcaption className="mt-1 text-[0.75rem] text-muted">{label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const [keepIcc, setKeepIcc] = useState(true);
  const [keepOrientation, setKeepOrientation] = useState(true);
  const [busy, setBusy] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  const patch = useCallback((id: string, p: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i))), []);

  const add = useCallback(
    (files: File[]) => {
      const fresh = files.map((file) => ({ id: uid(), file, meta: null, error: null, reading: true }));
      setItems((prev) => [...prev, ...fresh]);
      fresh.forEach((it) => {
        readMeta(it.file)
          .then((meta) => patch(it.id, { meta, reading: false }))
          .catch((e) => patch(it.id, { error: `Could not read metadata: ${errMsg(e)}`, reading: false }));
      });
    },
    [patch],
  );

  const cleanAll = async () => {
    setBusy(true);
    for (const it of items) {
      try {
        const bytes = new Uint8Array(await it.file.arrayBuffer());
        if (!containerOf(bytes)) throw new Error("Removal works on JPG, PNG and WebP. Convert other formats first.");
        const r = stripMetadata(bytes, { keepIcc, keepOrientation });
        const blob = new Blob([r.output as BlobPart], { type: it.file.type || "application/octet-stream" });
        // Verify the cleaned file still decodes before offering it.
        const bmp = await loadImage(blob).catch(() => {
          throw new Error("The cleaned file did not decode, so it was not kept. The original may be damaged.");
        });
        bmp.close();
        patch(it.id, { cleaned: { blob, removed: r.removed, kept: r.kept }, cleanError: undefined });
      } catch (e) {
        patch(it.id, { cleanError: errMsg(e), cleaned: undefined });
      }
    }
    setBusy(false);
  };

  const cleaned = items.filter((i) => i.cleaned);
  const anyGps = items.some((i) => typeof i.meta?.latitude === "number");

  return (
    <div className="space-y-5">
      <ToolPanel title="View and remove photo metadata" actions={items.length ? <ResetBtn onClick={() => setItems([])} label="Clear all" /> : undefined}>
        <div className="space-y-5">
          <FileDrop
            onFiles={add}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/tiff,.jpg,.jpeg,.png,.webp,.heic,.heif,.tif,.tiff"
            multiple
            maxSizeMB={60}
            maxFiles={50}
            label="Choose photos"
            hint="Read: JPG, PNG, WebP, HEIC, TIFF. Remove: JPG, PNG, WebP. Up to 60 MB each."
          />
          {anyGps && (
            <Notice tone="warning" title="Location found">
              At least one photo contains GPS coordinates that reveal where it was taken, which can be a home or workplace. Remove metadata before sharing it publicly.
            </Notice>
          )}
          {items.length > 0 && (
            <div className="space-y-3 rounded-xl bg-sunken p-4">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Checkbox label="Keep color profile (ICC)" checked={keepIcc} onChange={setKeepIcc} hint="Keeps colors accurate; contains no personal data." />
                <Checkbox label="Keep orientation" checked={keepOrientation} onChange={setKeepOrientation} hint="Keeps a single rotation tag so photos stay upright." />
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn icon="trash" disabled={busy} onClick={cleanAll}>
                  {busy ? "Removing…" : `Remove metadata from ${items.length} file${items.length === 1 ? "" : "s"}`}
                </Btn>
                {cleaned.length > 1 && (
                  <Btn
                    variant="ghost"
                    icon="download"
                    onClick={async () => {
                      setZipError(null);
                      try {
                        downloadBlob(await zipFiles(cleaned.map((i) => ({ name: i.file.name, data: (i.cleaned as Cleaned).blob })), 0), "photos-without-metadata.zip");
                      } catch (e) {
                        setZipError(errMsg(e));
                      }
                    }}
                  >
                    Download all as ZIP
                  </Btn>
                )}
              </div>
              {zipError && <p className="text-sm text-danger">{zipError}</p>}
              <p className="text-[0.8125rem] text-muted">Pixels are not re-encoded: only metadata blocks are cut out, so quality is unchanged.</p>
            </div>
          )}
          {items.length === 0 ? (
            <EmptyState icon="eye" title="No photos yet">Add photos to see camera, lens, date and location data, then strip it without recompressing.</EmptyState>
          ) : (
            <ul className="space-y-4">
              {items.map((it) => {
                const m = it.meta;
                const lat = typeof m?.latitude === "number" ? m.latitude : null;
                const lon = typeof m?.longitude === "number" ? m.longitude : null;
                const rows = m ? FIELDS.map(([k, label]) => [label, show(k, m[k])] as const).filter(([, v]) => v) : [];
                const all = m ? Object.entries(m).filter(([k]) => k !== "latitude" && k !== "longitude") : [];
                return (
                  <li key={it.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-ink">{it.file.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm tabular-nums text-muted">{formatBytes(it.file.size)}</span>
                        <button
                          type="button"
                          className="grid h-10 w-10 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
                          onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                        >
                          <span aria-hidden="true">×</span>
                          <span className="sr-only">Remove {it.file.name} from the list</span>
                        </button>
                      </div>
                    </div>
                    <PhotoPreview item={it} />
                    {it.reading && <p className="mt-2 text-sm text-muted">Reading metadata…</p>}
                    {it.error && <p className="mt-2 text-sm text-danger">{it.error}</p>}
                    {!it.reading && !it.error && !m && <p className="mt-2 text-sm text-ink-2">No Exif, GPS, XMP or IPTC metadata found.</p>}
                    {lat !== null && lon !== null && (
                      <p className="mt-2 rounded-lg bg-[color-mix(in_oklch,oklch(0.75_0.15_75)_14%,transparent)] px-3 py-2 text-sm text-ink">
                        <strong>GPS location:</strong> {lat.toFixed(6)}, {lon.toFixed(6)}
                        {typeof m?.GPSAltitude === "number" ? `, altitude ${fmt(m.GPSAltitude as number, 0)} m` : ""}
                      </p>
                    )}
                    {rows.length > 0 && (
                      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                        {rows.map(([label, v]) => (
                          <div key={label} className="flex justify-between gap-3 border-b border-line py-1">
                            <dt className="text-muted">{label}</dt>
                            <dd className="min-w-0 truncate text-right text-ink" title={v}>
                              {v}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {all.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm text-ink-2">All {all.length} fields</summary>
                        <div className="mt-2 max-h-72 overflow-auto rounded-lg bg-sunken p-3">
                          <table className="w-full text-left text-[0.8125rem]">
                            <tbody>
                              {all.map(([k, v]) => (
                                <tr key={k} className="align-top">
                                  <th scope="row" className="py-0.5 pr-3 font-mono font-normal text-muted">
                                    {k}
                                  </th>
                                  <td className="break-all py-0.5 text-ink">{show(k, v)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                    {it.cleanError && <p className="mt-3 text-sm text-danger">{it.cleanError}</p>}
                    {it.cleaned && (
                      <div className="mt-3 space-y-2 rounded-lg bg-accent-soft p-3 text-sm">
                        <p>
                          Cleaned: {formatBytes(it.file.size)} → {formatBytes(it.cleaned.blob.size)}.{" "}
                          {it.cleaned.removed.length ? `Removed ${it.cleaned.removed.join("; ")}.` : "No removable metadata blocks were present."}
                        </p>
                        {it.cleaned.kept.length > 0 && <p className="text-ink-2">Kept: {it.cleaned.kept.join(", ")}.</p>}
                        <Btn icon="download" onClick={() => downloadBlob((it.cleaned as Cleaned).blob, it.file.name)}>
                          Download clean copy
                        </Btn>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
