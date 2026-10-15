"use client";

import { useEffect, useRef, useState } from "react";
import { Notice, uid } from "@/components/tools/kit";
import { FileDrop } from "@/components/tools/engines/files";
import { IMAGE_ACCEPT } from "@/components/tools/catalog/image/lib/pipeline";
import { ItemEditor } from "./editor";
import { NumInput, RangeInput } from "./shared";
import { fileToStoredImage } from "./images";
import { viewSize } from "./lib/geometry";
import type { ImageItem, Item, StoredImage } from "./lib/write";

interface Uploaded {
  id: string;
  name: string;
  url: string;
  data: StoredImage;
}

export default function Tool() {
  const [uploads, setUploads] = useState<Uploaded[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [width, setWidth] = useState(150);
  const [error, setError] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);

  useEffect(
    () => () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const current = uploads.find((u) => u.id === currentId) ?? null;
  const images = new Map(uploads.map((u) => [u.id, u.data]));
  const imageUrls = Object.fromEntries(uploads.map((u) => [u.id, u.url]));

  async function addFiles(files: File[]) {
    setError(null);
    const added: Uploaded[] = [];
    for (const f of files) {
      try {
        const data = await fileToStoredImage(f);
        const url = URL.createObjectURL(data.blob);
        urlsRef.current.push(url);
        added.push({ id: uid(), name: f.name, url, data: { bytes: data.bytes, type: data.type, width: data.width, height: data.height } });
      } catch (e) {
        setError(e instanceof Error ? e.message : `${f.name} could not be read.`);
      }
    }
    if (added.length) {
      setUploads((u) => [...u, ...added]);
      setCurrentId(added[0].id);
    }
  }

  return (
    <ItemEditor
      suffix="with-image"
      mode="point"
      addLabel="Add at page center"
      hint="Click the page to place the selected image (its center lands where you click). Drag to move, use the corner handle or the size fields to resize."
      blockedReason={current ? null : "Add a PNG or JPG image in the panel on the right first."}
      images={images}
      imageUrls={imageUrls}
      createItem={(g, geom) => {
        if (g.kind !== "point" || !current) return null;
        const page = viewSize(geom);
        const w = Math.min(width, page.w * 0.9);
        const h = (w * current.data.height) / current.data.width;
        const item: ImageItem = { kind: "image", id: uid(), page: g.page, x: g.x - w / 2, y: g.y - h / 2, w, h, imageId: current.id, label: current.name };
        return item;
      }}
      settings={
        <section aria-label="Images" className="space-y-4">
          <FileDrop accept={IMAGE_ACCEPT} multiple maxFiles={10} maxSizeMB={25} compact label="Add an image" hint="PNG, JPG, WebP, AVIF, GIF, BMP or HEIC up to 25 MB each." allowPaste onFiles={addFiles} />
          {error && <Notice tone="error">{error}</Notice>}
          {uploads.length > 0 && (
            <fieldset>
              <legend className="text-[0.8125rem] font-medium text-ink-2">Image to place</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {uploads.map((u) => (
                  <label key={u.id} className={`relative cursor-pointer rounded-lg p-1 ${u.id === currentId ? "bg-accent-soft ring-2 ring-accent" : "bg-sunken"}`}>
                    <input type="radio" name="pdfb-image" className="sr-only" checked={u.id === currentId} onChange={() => setCurrentId(u.id)} />
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                    <img src={u.url} alt={u.name} className="h-16 w-full object-contain" />
                    {u.id === currentId && <span className="sr-only">(selected)</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <RangeInput label="Width when placed" min={20} max={600} step={5} value={width} onChange={setWidth} format={(v) => `${v} pt (${(v / 72).toFixed(2)} in)`} />
        </section>
      }
      inspector={(it: Item, onChange) =>
        it.kind === "image" ? (
          <div className="grid grid-cols-2 gap-3">
            <NumInput
              key={`w${it.id}${it.w}`}
              label="Width"
              suffix="pt"
              value={it.w}
              min={4}
              max={5000}
              onCommit={(v) => onChange({ ...it, w: v, h: (v * it.h) / it.w })}
            />
            <NumInput
              key={`h${it.id}${it.h}`}
              label="Height"
              suffix="pt"
              value={it.h}
              min={4}
              max={5000}
              onCommit={(v) => onChange({ ...it, h: v, w: (v * it.w) / it.h })}
            />
            <p className="col-span-2 text-[0.8125rem] text-muted">Width and height stay in proportion.</p>
          </div>
        ) : null
      }
      doneMessage={(n) => `Placed ${n} image${n === 1 ? "" : "s"}.`}
    />
  );
}
