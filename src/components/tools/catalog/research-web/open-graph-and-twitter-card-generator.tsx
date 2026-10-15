"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, OutputBlock, PrivacyNote, ResetBtn, Segmented, SelectField, TextArea, TextField, ToolPanel } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { displayHost, ogTags, truncate, type OgInput } from "./lib/meta";

const INITIAL: OgInput = {
  title: "",
  description: "",
  url: "",
  siteName: "",
  type: "website",
  locale: "en_US",
  image: "",
  imageAlt: "",
  imageWidth: "1200",
  imageHeight: "630",
  publishedTime: "",
  author: "",
  card: "summary_large_image",
  twitterSite: "",
  twitterCreator: "",
  twitterDuplicate: false,
};

const SAMPLE: OgInput = {
  ...INITIAL,
  title: "A field guide to backyard birds",
  description: "Identify 40 common garden birds by shape, song and season, with tips for feeders and nest boxes.",
  url: "https://example.com/guides/backyard-birds",
  siteName: "Example Nature",
  type: "article",
  image: "https://example.com/images/birds-cover.jpg",
  imageAlt: "A robin perched on a garden fence",
  publishedTime: "2026-04-02",
  twitterSite: "examplenature",
};

const isAbsUrl = (s: string) => {
  try {
    return /^https?:$/.test(new URL(s).protocol);
  } catch {
    return false;
  }
};

function ImageBox({ src, alt, load, className }: { src: string; alt: string; load: boolean; className: string }) {
  if (load && isAbsUrl(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt || "Preview image"} referrerPolicy="no-referrer" className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} grid place-items-center bg-sunken text-muted`} aria-hidden="true">
      <Icon name="image" size={28} />
    </div>
  );
}

export default function Tool() {
  const [o, setO] = useState<OgInput>(INITIAL);
  const [loadImage, setLoadImage] = useState(false);
  const [preview, setPreview] = useState<"large" | "summary">("large");
  const set = (patch: Partial<OgInput>) => setO((p) => ({ ...p, ...patch }));
  const code = ogTags(o);
  const host = displayHost(o.url) || "example.com";
  const problems: string[] = [];
  if (o.url.trim() && !isAbsUrl(o.url.trim())) problems.push("og:url must be an absolute http(s) URL.");
  if (o.image.trim() && !isAbsUrl(o.image.trim())) problems.push("og:image must be an absolute URL; relative paths are ignored by most platforms.");
  if (!o.title.trim()) problems.push("og:title is required by the Open Graph protocol.");
  if (!o.image.trim()) problems.push("Without og:image, most platforms show a text-only card.");
  if (o.image.trim() && !o.imageAlt.trim()) problems.push("Add image alt text for screen reader users.");
  const w = Number(o.imageWidth);
  const h = Number(o.imageHeight);
  if (o.imageWidth && o.imageHeight && w > 0 && h > 0 && o.card === "summary_large_image" && Math.abs(w / h - 1.91) > 0.2)
    problems.push("Large image cards are cropped to about 1.91:1 (1200×630 works well).");

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title="Share details"
          actions={
            <>
              <Btn variant="ghost" icon="spark" onClick={() => setO(SAMPLE)}>
                Load sample
              </Btn>
              <ResetBtn onClick={() => setO(INITIAL)} />
            </>
          }
        >
          <div className="space-y-4">
            <TextField label="Title (og:title)" value={o.title} onChange={(e) => set({ title: e.target.value })} hint={`${o.title.length} characters. Keep it under about 60.`} />
            <TextArea label="Description (og:description)" rows={3} value={o.description} onChange={(e) => set({ description: e.target.value })} hint={`${o.description.length} characters. Around 100 to 200 is typical.`} />
            <TextField label="Page URL (og:url)" inputMode="url" placeholder="https://example.com/page" value={o.url} onChange={(e) => set({ url: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Site name" optional value={o.siteName} onChange={(e) => set({ siteName: e.target.value })} />
              <SelectField
                label="Type (og:type)"
                value={o.type}
                onChange={(e) => set({ type: e.target.value })}
                options={["website", "article", "profile", "book", "video.other", "music.song"].map((x) => ({ value: x, label: x }))}
              />
              <TextField label="Locale" optional placeholder="en_US" value={o.locale} onChange={(e) => set({ locale: e.target.value })} />
              {o.type === "article" && <TextField label="Published date" optional type="date" value={o.publishedTime} onChange={(e) => set({ publishedTime: e.target.value })} />}
              {o.type === "article" && <TextField label="Article author" optional value={o.author} onChange={(e) => set({ author: e.target.value })} />}
            </div>
            <TextField label="Image URL (og:image)" inputMode="url" placeholder="https://example.com/share.jpg" value={o.image} onChange={(e) => set({ image: e.target.value })} />
            <TextField label="Image alt text" optional value={o.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Image width" optional inputMode="numeric" value={o.imageWidth} onChange={(e) => set({ imageWidth: e.target.value.replace(/\D/g, "") })} />
              <TextField label="Image height" optional inputMode="numeric" value={o.imageHeight} onChange={(e) => set({ imageHeight: e.target.value.replace(/\D/g, "") })} />
            </div>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ink">X (Twitter) card</legend>
              <SelectField
                label="Card type"
                value={o.card}
                onChange={(e) => set({ card: e.target.value as OgInput["card"] })}
                options={[
                  { value: "summary_large_image", label: "Large image (summary_large_image)" },
                  { value: "summary", label: "Small square image (summary)" },
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Site handle" optional placeholder="@yoursite" value={o.twitterSite} onChange={(e) => set({ twitterSite: e.target.value })} />
                <TextField label="Creator handle" optional placeholder="@author" value={o.twitterCreator} onChange={(e) => set({ twitterCreator: e.target.value })} />
              </div>
              <Checkbox label="Repeat title, description and image as twitter: tags" checked={o.twitterDuplicate} onChange={(v) => set({ twitterDuplicate: v })} hint="Not needed: X falls back to the og: tags. Turn on only if a tool you use expects them." />
            </fieldset>
          </div>
        </ToolPanel>
        <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          <ToolPanel title="Link preview">
            <div className="space-y-4">
              <Segmented
                label="Preview layout"
                value={preview}
                onChange={setPreview}
                options={[
                  { value: "large", label: "Large image card" },
                  { value: "summary", label: "Compact card" },
                ]}
              />
              <Checkbox
                label="Load the image in the preview"
                checked={loadImage}
                onChange={setLoadImage}
                hint="Off by default. When on, your browser requests the image from its host (the address you typed), like opening it in a tab."
              />
              {preview === "large" ? (
                <figure className="overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]" aria-label="Large link preview card">
                  <ImageBox src={o.image.trim()} alt={o.imageAlt} load={loadImage} className="aspect-[1.91/1] w-full" />
                  <figcaption className="px-4 py-3">
                    <p className="text-[0.75rem] uppercase tracking-wide text-muted">{host}</p>
                    <p className="mt-0.5 font-semibold leading-snug text-ink">{o.title.trim() ? truncate(o.title, 90) : "Your title"}</p>
                    <p className="mt-0.5 text-[0.875rem] text-ink-2">{o.description.trim() ? truncate(o.description, 140) : "Your description"}</p>
                  </figcaption>
                </figure>
              ) : (
                <figure className="flex overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]" aria-label="Compact link preview card">
                  <ImageBox src={o.image.trim()} alt={o.imageAlt} load={loadImage} className="aspect-square w-28 shrink-0" />
                  <figcaption className="min-w-0 px-4 py-3">
                    <p className="text-[0.75rem] text-muted">{host}</p>
                    <p className="mt-0.5 truncate font-semibold text-ink">{o.title.trim() || "Your title"}</p>
                    <p className="mt-0.5 line-clamp-2 text-[0.875rem] text-ink-2">{o.description.trim() || "Your description"}</p>
                  </figcaption>
                </figure>
              )}
              <p className="text-[0.8125rem] text-muted">A neutral mock-up. Each platform crops and truncates a little differently and caches previews.</p>
              {problems.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-[0.8125rem] text-ink-2">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </ToolPanel>
          <ToolPanel title="HTML" actions={<CopyBtn text={code} />}>
            <OutputBlock label="Generated Open Graph and card tags">
              <code>{code}</code>
            </OutputBlock>
          </ToolPanel>
        </div>
      </div>
      <PrivacyNote />
    </div>
  );
}
