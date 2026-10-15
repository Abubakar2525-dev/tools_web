"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Notice, PrivacyNote, ToolPanel, uid } from "@/components/tools/kit";
import { FileDrop, ProgressBar, baseName, downloadBlob, formatBytes, useObjectUrl, zipFiles } from "@/components/tools/engines/files";
import { AUDIO_ACCEPT } from "./shared/browser";
import { pictureExt } from "./lib/art";

type Pic = { id: string; source: string; name: string; blob: Blob; type?: string; description?: string; width?: number; height?: number };
type Miss = { source: string; reason: string };

function PicCard({ p }: { p: Pic }) {
  const url = useObjectUrl(p.blob);
  return (
    <li className="overflow-hidden rounded-xl bg-sunken">
      <div className="grid aspect-square place-items-center bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
        {url && <img src={url} alt={`${p.type ?? "Picture"} from ${p.source}`} className="max-h-full max-w-full object-contain" />}
      </div>
      <div className="space-y-1 p-3 text-sm">
        <p className="truncate font-medium text-ink" title={p.source}>
          {p.source}
        </p>
        <p className="text-[0.8125rem] text-muted">
          {[p.type, p.width && p.height ? `${p.width}×${p.height}` : null, p.blob.type.replace("image/", "").toUpperCase(), formatBytes(p.blob.size)].filter(Boolean).join(" · ")}
        </p>
        <Btn variant="ghost" icon="download" onClick={() => downloadBlob(p.blob, p.name)}>
          Download
        </Btn>
      </div>
    </li>
  );
}

export default function Tool() {
  const [pics, setPics] = useState<Pic[]>([]);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const token = useRef(0);
  useEffect(() => {
    const t = token;
    return () => {
      t.current += 1;
    };
  }, []);

  const extract = async (files: File[]) => {
    const t = ++token.current;
    setProgress(0);
    const { parseBlob } = await import("music-metadata");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const meta = await parseBlob(f, { duration: false, skipPostHeaders: false });
        if (t !== token.current) return;
        const list = meta.common.picture ?? [];
        if (!list.length) setMisses((m) => [...m, { source: f.name, reason: "No embedded picture found." }]);
        const found: Pic[] = [];
        for (let k = 0; k < list.length; k++) {
          const pic = list[k];
          const mime = pic.format.includes("/") ? pic.format : `image/${pic.format.toLowerCase()}`;
          const blob = new Blob([pic.data.slice()], { type: mime });
          let width: number | undefined;
          let height: number | undefined;
          try {
            const bmp = await createImageBitmap(blob);
            width = bmp.width;
            height = bmp.height;
            bmp.close();
          } catch {
            /* size unknown */
          }
          const suffix = list.length > 1 ? `-${k + 1}` : "";
          found.push({ id: uid(), source: f.name, name: `${baseName(f.name)}-cover${suffix}.${pictureExt(mime)}`, blob, type: pic.type, description: pic.description, width, height });
        }
        if (found.length) setPics((p) => [...p, ...found]);
      } catch {
        if (t === token.current) setMisses((m) => [...m, { source: f.name, reason: "Could not read this file's tags." }]);
      }
      if (t === token.current) setProgress((i + 1) / files.length);
    }
    if (t === token.current) setProgress(null);
  };

  const zipAll = async () => {
    setZipping(true);
    try {
      downloadBlob(await zipFiles(pics.map((p) => ({ name: p.name, data: p.blob })), 0), "album-art.zip");
    } finally {
      setZipping(false);
    }
  };

  const clear = () => {
    token.current += 1;
    setPics([]);
    setMisses([]);
    setProgress(null);
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Album art extractor" actions={pics.length || misses.length ? <Btn variant="subtle" icon="reset" onClick={clear}>Clear</Btn> : undefined}>
        <FileDrop accept={AUDIO_ACCEPT} multiple maxFiles={200} maxSizeMB={1024} onFiles={extract} label="Choose audio files or drop them here" hint="MP3, FLAC, M4A, OGG, OPUS, WMA… Only tags are read, so large files are fine." compact={pics.length > 0} />
        {progress !== null && (
          <div className="mt-4">
            <ProgressBar value={progress} label="Reading tags" />
          </div>
        )}
        {misses.length > 0 && (
          <div className="mt-4">
            <Notice tone="info" title={`${misses.length} file${misses.length > 1 ? "s" : ""} without usable art`}>
              <ul className="space-y-0.5">
                {misses.slice(0, 20).map((m, i) => (
                  <li key={`${m.source}-${i}`}>
                    {m.source}: {m.reason}
                  </li>
                ))}
                {misses.length > 20 && <li>…and {misses.length - 20} more.</li>}
              </ul>
            </Notice>
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
      {pics.length > 0 && (
        <ToolPanel
          title={`${pics.length} picture${pics.length > 1 ? "s" : ""} found`}
          actions={
            <Btn icon="download" onClick={zipAll} disabled={zipping}>
              {zipping ? "Zipping…" : "Download all (ZIP)"}
            </Btn>
          }
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pics.map((p) => (
              <PicCard key={p.id} p={p} />
            ))}
          </ul>
        </ToolPanel>
      )}
    </div>
  );
}
