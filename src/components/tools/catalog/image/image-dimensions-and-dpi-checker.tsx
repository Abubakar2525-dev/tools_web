"use client";

import { useCallback, useState } from "react";
import { Btn, EmptyState, NumberField, PrivacyNote, ResetBtn, ToolPanel, fmt, parseNum, uid } from "@/components/tools/kit";
import { FileDrop, downloadBlob, formatBytes, useObjectUrl } from "@/components/tools/engines/files";
import { CHECKER, errMsg } from "./shared";
import { aspectLabel, detectImageType } from "./lib/bytes";
import { containerOf, readDensity, writeDensity, type Density } from "./lib/metadata";
import { decodeImage } from "./lib/pipeline";

type Info = { width: number; height: number; type: string; densities: Density[]; writable: boolean };
type Item = { id: string; file: File; info: Info | null; error: string | null };

async function inspect(file: File): Promise<Info> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const det = detectImageType(bytes);
  let densities: Density[] = [];
  try {
    densities = readDensity(bytes);
  } catch {
    densities = [];
  }
  const bmp = await decodeImage(file);
  const info = { width: bmp.width, height: bmp.height, type: det?.label ?? (file.type || "unknown"), densities, writable: containerOf(bytes) === "jpeg" || containerOf(bytes) === "png" };
  bmp.close();
  return info;
}

function Card({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const [dpi, setDpi] = useState("300");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const i = item.info;
  const d = parseNum(dpi);
  const dpiErr = d === null || d < 1 || d > 65535 ? "Enter a DPI between 1 and 65535." : null;
  const stored = i?.densities.find((x) => x.unit === "dpi");
  const printDpi = d && !dpiErr ? d : 300;
  const previewUrl = useObjectUrl(item.file);
  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate font-medium text-ink">{item.file.name}</p>
        <button type="button" onClick={onRemove} className="grid h-10 w-10 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink">
          <span aria-hidden="true">×</span>
          <span className="sr-only">Remove {item.file.name}</span>
        </button>
      </div>
      <div className="mt-3 grid max-w-xs aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-surface" style={CHECKER}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl ?? undefined} alt={`Preview of ${item.file.name}`} className="max-h-full max-w-full object-contain" />
      </div>
      {item.error && <p className="mt-2 text-sm text-danger">{item.error}</p>}
      {!i && !item.error && <p className="mt-2 text-sm text-muted">Reading…</p>}
      {i && (
        <div className="mt-3 space-y-4">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line text-sm shadow-[0_0_0_1px_var(--line)] sm:grid-cols-3">
            {[
              ["Pixels", `${i.width} × ${i.height}`],
              ["Aspect ratio", aspectLabel(i.width, i.height)],
              ["Megapixels", fmt((i.width * i.height) / 1e6, 2)],
              ["Format", i.type],
              ["File size", formatBytes(item.file.size)],
              ["Stored DPI", stored ? (Math.abs(stored.x - stored.y) < 0.5 ? fmt(stored.x, 1) : `${fmt(stored.x, 1)} × ${fmt(stored.y, 1)}`) : "none"],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-3 py-2">
                <dt className="text-[0.8125rem] text-muted">{k}</dt>
                <dd className="font-semibold tabular-nums text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {i.densities.length > 0 ? (
            <ul className="text-sm text-ink-2">
              {i.densities.map((x, k) => (
                <li key={k}>
                  {x.source}: {x.unit === "dpi" ? `${fmt(x.x, 2)} × ${fmt(x.y, 2)} DPI` : `${x.x}:${x.y} (aspect only)`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">No resolution is stored. Most software then assumes 72 or 96 DPI.</p>
          )}
          <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-end">
            <NumberField label="DPI" value={dpi} onChange={(e) => setDpi(e.target.value)} error={dpiErr} />
            <p className="text-sm text-ink-2" aria-live="polite">
              At {fmt(printDpi, 0)} DPI this prints at {fmt(i.width / printDpi, 2)} × {fmt(i.height / printDpi, 2)} in ({fmt((i.width / printDpi) * 2.54, 2)} × {fmt((i.height / printDpi) * 2.54, 2)} cm).
            </p>
          </div>
          {i.writable ? (
            <Btn
              icon="download"
              disabled={!!dpiErr}
              onClick={async () => {
                setMsg(null);
                try {
                  const bytes = new Uint8Array(await item.file.arrayBuffer());
                  const out = writeDensity(bytes, d as number);
                  downloadBlob(new Blob([out as BlobPart], { type: item.file.type || "application/octet-stream" }), item.file.name);
                  setMsg({ ok: true, text: `Saved with ${fmt(d as number, 0)} DPI. Pixels are unchanged; only the header was edited.` });
                } catch (e) {
                  setMsg({ ok: false, text: errMsg(e) });
                }
              }}
            >
              Download with {d && !dpiErr ? fmt(d, 0) : "new"} DPI
            </Btn>
          ) : (
            <p className="text-sm text-muted">Writing DPI is supported for JPG and PNG. Other formats can be converted first.</p>
          )}
          {msg && <p className={`text-sm ${msg.ok ? "text-ink-2" : "text-danger"}`}>{msg.text}</p>}
        </div>
      )}
    </li>
  );
}

export default function Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const add = useCallback((files: File[]) => {
    const fresh = files.map((file) => ({ id: uid(), file, info: null, error: null }));
    setItems((p) => [...p, ...fresh]);
    fresh.forEach((it) =>
      inspect(it.file)
        .then((info) => setItems((p) => p.map((x) => (x.id === it.id ? { ...x, info } : x))))
        .catch((e) => setItems((p) => p.map((x) => (x.id === it.id ? { ...x, error: errMsg(e) } : x)))),
    );
  }, []);
  return (
    <div className="space-y-5">
      <ToolPanel title="Image size and DPI" actions={items.length ? <ResetBtn onClick={() => setItems([])} label="Clear all" /> : undefined}>
        <div className="space-y-5">
          <FileDrop onFiles={add} accept="image/*,.heic,.heif" multiple maxSizeMB={80} maxFiles={30} allowPaste label="Choose images to inspect" />
          {items.length ? (
            <ul className="space-y-4">
              {items.map((it) => (
                <Card key={it.id} item={it} onRemove={() => setItems((p) => p.filter((x) => x.id !== it.id))} />
              ))}
            </ul>
          ) : (
            <EmptyState icon="ruler" title="No images yet">See pixel size, aspect ratio, megapixels and stored DPI, and set a new DPI for print without recompressing.</EmptyState>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
