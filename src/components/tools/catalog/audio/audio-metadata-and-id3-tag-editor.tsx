"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { IAudioMetadata } from "music-metadata";
import type { ImageType } from "browser-id3-writer";
import { Btn, Notice, PrivacyNote, ResetBtn, TextArea, TextField, ToolPanel, inputCls } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, downloadBlob, formatBytes, useObjectUrl } from "@/components/tools/engines/files";
import { formatTime } from "./lib/pcm";
import { AUDIO_ACCEPT } from "./shared/browser";
import { isMp3, tagsFromMeta, validateTags, type TagForm } from "./lib/tags";

type Loaded = { file: File; meta: IAudioMetadata; cover: { data: Uint8Array; format: string; blob: Blob } | null };
type CoverChoice = { kind: "keep" } | { kind: "remove" } | { kind: "new"; file: File };

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words text-right tabular-nums text-ink">{v}</dd>
    </div>
  );
}

export default function Tool() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TagForm | null>(null);
  const [cover, setCover] = useState<CoverChoice>({ kind: "keep" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const token = useRef(0);
  const coverId = useId();
  useEffect(() => () => void (token.current += 1), []);

  const shownCover = cover.kind === "new" ? cover.file : cover.kind === "keep" ? (loaded?.cover?.blob ?? null) : null;
  const coverUrl = useObjectUrl(shownCover);

  const open = async (file: File) => {
    const t = ++token.current;
    setBusy(true);
    setError(null);
    setLoaded(null);
    setSaved(null);
    try {
      const { parseBlob } = await import("music-metadata");
      const meta = await parseBlob(file, { duration: true });
      if (t !== token.current) return;
      const pic = meta.common.picture?.[0];
      const l: Loaded = { file, meta, cover: pic ? { data: pic.data, format: pic.format, blob: new Blob([pic.data.slice()], { type: pic.format }) } : null };
      setLoaded(l);
      setForm(tagsFromMeta(meta));
      setCover({ kind: "keep" });
    } catch (e) {
      if (t === token.current) setError(`Could not read this file's metadata. It may be damaged or in an unsupported format. ${e instanceof Error ? `(${e.message})` : ""}`);
    } finally {
      if (t === token.current) setBusy(false);
    }
  };

  const clear = () => {
    token.current += 1;
    setLoaded(null);
    setForm(null);
    setError(null);
    setSaved(null);
    setBusy(false);
  };

  const mp3 = loaded ? isMp3(loaded.file.name, loaded.file.type, loaded.meta.format.container) : false;
  const errors = form ? validateTags(form) : {};
  const set = (k: keyof TagForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(null);
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));
  };

  const save = async () => {
    if (!loaded || !form || Object.keys(errors).length) return;
    setSaving(true);
    setError(null);
    try {
      const { ID3Writer } = await import("browser-id3-writer");
      const w = new ID3Writer(await loaded.file.arrayBuffer());
      const list = (s: string) => s.split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean);
      if (form.title.trim()) w.setFrame("TIT2", form.title.trim());
      if (list(form.artist).length) w.setFrame("TPE1", list(form.artist));
      if (form.album.trim()) w.setFrame("TALB", form.album.trim());
      if (form.albumArtist.trim()) w.setFrame("TPE2", form.albumArtist.trim());
      if (form.year.trim()) w.setFrame("TYER", Number(form.year.trim()));
      if (form.track.trim()) w.setFrame("TRCK", form.track.trim());
      if (list(form.genre).length) w.setFrame("TCON", list(form.genre));
      if (form.comment.trim()) w.setFrame("COMM", { description: "", text: form.comment.trim(), language: "eng" });
      const pic = cover.kind === "new" ? new Uint8Array(await cover.file.arrayBuffer()) : cover.kind === "keep" ? loaded.cover?.data : null;
      if (pic) {
        const copy = pic.slice();
        w.setFrame("APIC", { type: 3 as ImageType, data: copy.buffer, description: "Cover" });
      }
      w.addTag();
      const blob = w.getBlob();
      downloadBlob(blob, loaded.file.name);
      setSaved(`Saved ${loaded.file.name} (${formatBytes(blob.size)}). The audio frames were copied unchanged.`);
    } catch (e) {
      setError(`Could not write the tags. ${e instanceof Error ? e.message : ""}`);
    } finally {
      setSaving(false);
    }
  };

  const f = loaded?.meta.format;
  const ch = f?.numberOfChannels;

  return (
    <div className="space-y-5">
      <ToolPanel title="Audio metadata and ID3 tag editor">
        {!loaded && !busy ? (
          <FileDrop accept={AUDIO_ACCEPT} maxSizeMB={1024} onFiles={(fs) => fs[0] && open(fs[0])} label="Choose an audio file or drop it here" hint="MP3 tags can be edited. Other formats (FLAC, M4A, OGG, WAV…) are shown read-only." />
        ) : (
          <div className="space-y-3">
            {loaded && <FileChip file={loaded.file} onRemove={clear} />}
            {busy && <Spinner label="Reading metadata" />}
          </div>
        )}
        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {loaded && f && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Format</h3>
              <dl>
                <Row k="Container" v={f.container ?? "unknown"} />
                <Row k="Codec" v={[f.codec, f.codecProfile].filter(Boolean).join(", ") || "unknown"} />
                <Row k="Duration" v={f.duration ? formatTime(f.duration, 2) : "unknown"} />
                <Row k="Bitrate" v={f.bitrate ? `${Math.round(f.bitrate / 1000)} kbps` : "unknown"} />
                <Row k="Sample rate" v={f.sampleRate ? `${f.sampleRate} Hz` : "unknown"} />
                <Row k="Bit depth" v={f.bitsPerSample ? `${f.bitsPerSample}-bit` : "n/a (lossy)"} />
                <Row k="Channels" v={ch ? (ch === 1 ? "1 (mono)" : ch === 2 ? "2 (stereo)" : ch) : "unknown"} />
                <Row k="Lossless" v={f.lossless === undefined ? "unknown" : f.lossless ? "yes" : "no"} />
                <Row k="Tag types" v={f.tagTypes.length ? f.tagTypes.join(", ") : "none"} />
                {f.tool && <Row k="Encoder" v={f.tool} />}
                <Row k="File size" v={formatBytes(loaded.file.size)} />
              </dl>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Cover art</h3>
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img src={coverUrl} alt="Cover art" className="max-h-60 rounded-lg shadow-[0_0_0_1px_var(--line)]" />
              ) : (
                <p className="text-sm text-muted">{cover.kind === "remove" ? "Cover will be removed." : "No embedded cover art."}</p>
              )}
              {loaded.meta.common.picture && loaded.meta.common.picture.length > 1 && <p className="mt-2 text-[0.8125rem] text-muted">{loaded.meta.common.picture.length} pictures embedded; the first is shown.</p>}
            </div>
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>

      {loaded && form && (
        <ToolPanel
          title={mp3 ? "Edit ID3 tags" : "Tags (read-only)"}
          actions={mp3 ? <ResetBtn onClick={() => (setForm(tagsFromMeta(loaded.meta)), setCover({ kind: "keep" }), setSaved(null))} label="Revert" /> : undefined}
        >
          {!mp3 && (
            <div className="mb-5">
              <Notice tone="info">Editing is available for MP3 files only (ID3v2). For {f?.container ?? "this format"} the tags are shown so you can check them, but they cannot be saved here.</Notice>
            </div>
          )}
          <fieldset disabled={!mp3} className="grid gap-4 sm:grid-cols-2">
            <legend className="sr-only">Tag fields</legend>
            <TextField label="Title" value={form.title} onChange={set("title")} />
            <TextField label="Artist" value={form.artist} onChange={set("artist")} hint="Separate several artists with ;" />
            <TextField label="Album" value={form.album} onChange={set("album")} />
            <TextField label="Album artist" value={form.albumArtist} onChange={set("albumArtist")} />
            <TextField label="Year" value={form.year} onChange={set("year")} inputMode="numeric" error={errors.year} />
            <TextField label="Track" value={form.track} onChange={set("track")} hint="For example 3 or 3/12" error={errors.track} />
            <TextField label="Genre" value={form.genre} onChange={set("genre")} hint="Separate several genres with ;" />
            <TextArea label="Comment" value={form.comment} onChange={set("comment")} className="sm:col-span-2" />
            {mp3 && (
              <div className="sm:col-span-2">
                <label htmlFor={coverId} className="text-sm font-medium text-ink">
                  Replace cover image
                </label>
                <p className="mt-1 text-[0.8125rem] text-muted">JPEG or PNG, ideally square and under 1 MB.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    id={coverId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className={`${inputCls} h-11 py-2 text-sm sm:max-w-xs`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) setError("Cover image is larger than 10 MB.");
                        else setCover({ kind: "new", file });
                        setSaved(null);
                      }
                      e.target.value = "";
                    }}
                  />
                  {(loaded.cover || cover.kind === "new") && cover.kind !== "remove" && (
                    <Btn variant="subtle" icon="trash" onClick={() => setCover({ kind: "remove" })}>
                      Remove cover
                    </Btn>
                  )}
                  {cover.kind !== "keep" && (
                    <Btn variant="subtle" icon="reset" onClick={() => setCover({ kind: "keep" })}>
                      Keep original cover
                    </Btn>
                  )}
                </div>
              </div>
            )}
          </fieldset>
          {mp3 && (
            <div className="mt-6 space-y-3">
              <Notice tone="info">Saving writes a fresh ID3v2.3 tag with the fields above. Other ID3v2 frames in the file (lyrics, ratings, custom fields) are not carried over. The audio itself is not re-encoded.</Notice>
              <Btn icon="download" onClick={save} disabled={saving || Object.keys(errors).length > 0}>
                {saving ? "Saving…" : "Save tagged MP3"}
              </Btn>
              {saved && <Notice tone="success">{saved}</Notice>}
            </div>
          )}
        </ToolPanel>
      )}
    </div>
  );
}
