"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Btn,
  CopyBtn,
  Notice,
  OutputBlock,
  PrivacyNote,
  Segmented,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  usePersistentState,
} from "@/components/tools/kit";
import { FileDrop, Spinner, loadImage } from "@/components/tools/engines/files";
import { Icon } from "@/components/ui/Icon";
import { moveItem } from "./lib/resume";
import {
  MAX_AVATAR_CHARS,
  blankLink,
  blankProject,
  emptyPortfolio,
  generatePortfolioHtml,
  initials,
  normalizePortfolio,
  portfolioFileName,
  samplePortfolio,
  validatePortfolio,
  type Portfolio,
  type PortfolioLink,
  type PortfolioProject,
  type PortfolioTheme,
} from "./lib/portfolio";

const AVATAR_PX = 320;

/** Center-crops and downsizes a photo so the data URL stays small enough to store and embed. */
async function makeAvatar(file: File): Promise<string> {
  const bmp = await loadImage(file);
  const side = Math.min(bmp.width, bmp.height);
  const size = Math.min(AVATAR_PX, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  let url = canvas.toDataURL("image/jpeg", 0.85);
  if (url.length > MAX_AVATAR_CHARS) url = canvas.toDataURL("image/jpeg", 0.6);
  if (url.length > MAX_AVATAR_CHARS) throw new Error("The photo is still too large after resizing. Try a simpler image.");
  return url;
}

function IconBtn({
  label,
  icon,
  onClick,
  disabled = false,
  rotate = false,
  danger = false,
}: {
  label: string;
  icon: "chevron" | "trash";
  onClick: () => void;
  disabled?: boolean;
  rotate?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-35 ${
        danger ? "text-danger" : "text-ink-2 hover:text-ink"
      }`}
    >
      <Icon name={icon} size={18} className={rotate ? "rotate-180" : ""} />
    </button>
  );
}

function Row({
  title,
  name,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  title: string;
  name: string;
  index: number;
  count: number;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-sunken/60 p-3 shadow-[inset_0_0_0_1px_var(--line)] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-ink-2">{title}</p>
        <div className="flex shrink-0 items-center">
          <IconBtn label={`Move ${name} up`} icon="chevron" rotate disabled={index === 0} onClick={() => onMove(-1)} />
          <IconBtn label={`Move ${name} down`} icon="chevron" disabled={index === count - 1} onClick={() => onMove(1)} />
          <IconBtn label={`Remove ${name}`} icon="trash" danger onClick={onRemove} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function Tool() {
  const [stored, setStored] = usePersistentState<Portfolio>("portfolio-builder", emptyPortfolio());
  const p = useMemo(() => normalizePortfolio(stored), [stored]);
  const [backup, setBackup] = useState<{ data: Portfolio; msg: string } | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showNameError, setShowNameError] = useState(false);
  const [width, setWidth] = useState<"full" | "phone">("full");
  const [announce, setAnnounce] = useState("");

  const deferred = useDeferredValue(p);
  const html = useMemo(() => generatePortfolioHtml(deferred), [deferred]);
  const issues = validatePortfolio(p);
  const badLinks = Object.keys(issues.urls).length;

  const update = (fn: (x: Portfolio) => Portfolio) => setStored((prev) => fn(normalizePortfolio(prev)));
  const set = <K extends keyof Portfolio>(k: K, v: Portfolio[K]) => update((x) => ({ ...x, [k]: v }));

  const patchProject = (id: string, patch: Partial<PortfolioProject>) =>
    update((x) => ({ ...x, projects: x.projects.map((pr) => (pr.id === id ? { ...pr, ...patch } : pr)) }));
  const patchLink = (id: string, patch: Partial<PortfolioLink>) =>
    update((x) => ({ ...x, links: x.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const replaceAll = (next: Portfolio, msg: string) => {
    setBackup({ data: p, msg });
    setStored(next);
    setShowNameError(false);
    setAvatarError(null);
  };

  const onAvatar = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const url = await makeAvatar(f);
      update((x) => ({ ...x, avatar: url, avatarMode: "image" }));
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : "Could not read that image.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const download = () => {
    if (!p.name.trim()) {
      setShowNameError(true);
      return;
    }
    downloadFile(portfolioFileName(p.name), generatePortfolioHtml(p), "text/html");
  };

  const hasContent = !!(p.name.trim() || p.bio.trim() || p.projects.length || p.links.length || p.skills.trim());

  return (
    <div className="space-y-5">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <ToolPanel
        title="Portfolio builder"
        actions={
          <>
            <Btn variant="ghost" icon="file" onClick={() => replaceAll(samplePortfolio(), "Loaded the sample portfolio.")}>
              Load sample
            </Btn>
            <Btn variant="subtle" icon="reset" disabled={!hasContent} onClick={() => replaceAll(emptyPortfolio(), "Cleared the form.")}>
              Clear
            </Btn>
          </>
        }
      >
        {backup && (
          <div className="mb-5">
            <Notice tone="info">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span>{backup.msg} Your previous draft can be restored.</span>
                <Btn
                  variant="ghost"
                  icon="reset"
                  onClick={() => {
                    setStored(backup.data);
                    setBackup(null);
                    setAnnounce("Previous draft restored.");
                  }}
                >
                  Undo
                </Btn>
                <Btn variant="subtle" onClick={() => setBackup(null)}>
                  Dismiss
                </Btn>
              </span>
            </Notice>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6">
            <fieldset className="space-y-3">
              <legend className="mb-3 text-base font-semibold text-ink">Profile</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Name"
                  autoComplete="name"
                  value={p.name}
                  error={showNameError && issues.name ? issues.name : null}
                  onChange={(e) => set("name", e.target.value)}
                />
                <TextField label="Location" optional value={p.location} onChange={(e) => set("location", e.target.value)} />
                <TextField
                  className="sm:col-span-2"
                  label="Headline"
                  optional
                  placeholder="Front-end developer who loves data visualization"
                  value={p.headline}
                  onChange={(e) => set("headline", e.target.value)}
                />
                <TextArea
                  className="sm:col-span-2"
                  label="About you"
                  optional
                  hint="Leave a blank line between paragraphs."
                  rows={4}
                  value={p.bio}
                  onChange={(e) => set("bio", e.target.value)}
                />
                <TextField
                  className="sm:col-span-2"
                  label="Email"
                  optional
                  type="email"
                  autoComplete="email"
                  hint="Shown as a mailto link in the footer."
                  value={p.email}
                  error={issues.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-3 text-base font-semibold text-ink">Photo</legend>
              <Segmented
                label="Avatar"
                value={p.avatarMode}
                onChange={(v) => set("avatarMode", v)}
                options={[
                  { value: "initials", label: `Initials (${initials(p.name)})` },
                  { value: "image", label: "Photo" },
                  { value: "none", label: "None" },
                ]}
              />
              {p.avatarMode === "image" && (
                <div className="space-y-3">
                  {p.avatar ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                      <img src={p.avatar} alt="Your uploaded photo" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
                      <Btn variant="subtle" icon="trash" onClick={() => update((x) => ({ ...x, avatar: "", avatarMode: "initials" }))}>
                        Remove photo
                      </Btn>
                    </div>
                  ) : null}
                  <FileDrop
                    compact
                    accept="image/png,image/jpeg,image/webp"
                    maxSizeMB={10}
                    label={p.avatar ? "Replace the photo" : "Choose a photo or drop it here"}
                    hint={`PNG, JPG or WebP up to 10 MB. It is cropped to a square and resized to ${AVATAR_PX} px, then embedded in the file.`}
                    onFiles={onAvatar}
                  />
                  {avatarBusy && <Spinner label="Resizing photo" />}
                  {avatarError && <Notice tone="error">{avatarError}</Notice>}
                  {!p.avatar && !avatarBusy && <p className="text-[0.8125rem] text-muted">Until you add a photo, your initials are shown.</p>}
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-3 text-base font-semibold text-ink">Projects</legend>
              {p.projects.length === 0 && <p className="text-sm text-muted">No projects yet.</p>}
              {p.projects.map((pr, i, arr) => (
                <Row
                  key={pr.id}
                  title={pr.title.trim() || `Project ${i + 1}`}
                  name={`project ${i + 1}`}
                  index={i}
                  count={arr.length}
                  onMove={(d) => {
                    update((x) => ({ ...x, projects: moveItem(x.projects, i, d) }));
                    setAnnounce(`Project moved to position ${i + d + 1} of ${arr.length}.`);
                  }}
                  onRemove={() => {
                    update((x) => ({ ...x, projects: x.projects.filter((q) => q.id !== pr.id) }));
                    setAnnounce("Project removed.");
                  }}
                >
                  <TextField label="Title" value={pr.title} onChange={(e) => patchProject(pr.id, { title: e.target.value })} />
                  <TextField
                    label="Link"
                    optional
                    placeholder="https://…"
                    hint="http, https or mailto. https:// is added to bare domains."
                    value={pr.link}
                    error={issues.urls[pr.id]}
                    onChange={(e) => patchProject(pr.id, { link: e.target.value })}
                  />
                  <TextArea
                    className="sm:col-span-2"
                    label="Description"
                    rows={3}
                    value={pr.description}
                    onChange={(e) => patchProject(pr.id, { description: e.target.value })}
                  />
                  <TextField
                    className="sm:col-span-2"
                    label="Tags"
                    optional
                    hint="Separate with commas."
                    placeholder="React, Accessibility"
                    value={pr.tags}
                    onChange={(e) => patchProject(pr.id, { tags: e.target.value })}
                  />
                </Row>
              ))}
              <Btn
                variant="ghost"
                icon="plus"
                onClick={() => {
                  update((x) => ({ ...x, projects: [...x.projects, blankProject()] }));
                  setAnnounce("New project added at the end of the list.");
                }}
              >
                Add project
              </Btn>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-3 text-base font-semibold text-ink">Skills and links</legend>
              <TextArea
                label="Skills"
                optional
                hint="Separate with commas or new lines."
                rows={2}
                value={p.skills}
                onChange={(e) => set("skills", e.target.value)}
              />
              {p.links.map((l, i, arr) => (
                <Row
                  key={l.id}
                  title={l.label.trim() || `Link ${i + 1}`}
                  name={`link ${i + 1}`}
                  index={i}
                  count={arr.length}
                  onMove={(d) => {
                    update((x) => ({ ...x, links: moveItem(x.links, i, d) }));
                    setAnnounce(`Link moved to position ${i + d + 1} of ${arr.length}.`);
                  }}
                  onRemove={() => {
                    update((x) => ({ ...x, links: x.links.filter((q) => q.id !== l.id) }));
                    setAnnounce("Link removed.");
                  }}
                >
                  <TextField label="Label" placeholder="GitHub" value={l.label} onChange={(e) => patchLink(l.id, { label: e.target.value })} />
                  <TextField
                    label="Address"
                    placeholder="https://github.com/you"
                    value={l.url}
                    error={issues.urls[l.id]}
                    onChange={(e) => patchLink(l.id, { url: e.target.value })}
                  />
                </Row>
              ))}
              <Btn
                variant="ghost"
                icon="plus"
                onClick={() => {
                  update((x) => ({ ...x, links: [...x.links, blankLink()] }));
                  setAnnounce("New link added.");
                }}
              >
                Add social or website link
              </Btn>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-3 text-base font-semibold text-ink">Style</legend>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-ink">Theme</p>
                  <Segmented
                    label="Theme"
                    value={p.theme}
                    onChange={(v: PortfolioTheme) => set("theme", v)}
                    options={[
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                      { value: "auto", label: "Match visitor" },
                    ]}
                  />
                </div>
                <div>
                  <label htmlFor="portfolio-accent" className="mb-2 block text-sm font-medium text-ink">
                    Accent color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="portfolio-accent"
                      type="color"
                      value={p.accent}
                      onChange={(e) => set("accent", e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded-lg bg-surface p-1 shadow-[inset_0_0_0_1px_var(--line-strong)]"
                    />
                    <span className="font-mono text-sm text-muted">{p.accent}</span>
                  </div>
                </div>
              </div>
              <p className="text-[0.8125rem] text-muted">
                Link text uses a lighter or darker shade of the accent when needed, so it keeps at least 4.5:1 contrast
                with the background.
              </p>
            </fieldset>
          </div>

          <div className="min-w-0">
            <div className="space-y-4 lg:sticky lg:top-24">
              <div className="flex flex-wrap items-center gap-2">
                <Btn icon="download" onClick={download}>
                  Download .html
                </Btn>
                <CopyBtn text={html} label="Copy HTML" />
              </div>
              {showNameError && issues.name && <Notice tone="error">Add your name before downloading.</Notice>}
              {badLinks > 0 && (
                <Notice tone="warning">
                  {badLinks === 1 ? "1 link is" : `${badLinks} links are`} not valid and will be left out of the page until
                  fixed.
                </Notice>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">Preview</p>
                <Segmented
                  label="Preview width"
                  value={width}
                  onChange={setWidth}
                  options={[
                    { value: "full", label: "Full width" },
                    { value: "phone", label: "Phone (375 px)" },
                  ]}
                />
              </div>
              <div className="overflow-x-auto rounded-xl bg-sunken p-2 shadow-[inset_0_0_0_1px_var(--line)]">
                <iframe
                  title="Portfolio preview"
                  sandbox=""
                  srcDoc={html}
                  className="mx-auto block h-[640px] rounded-lg bg-white"
                  style={{ width: width === "phone" ? 375 : "100%" }}
                />
              </div>
              <p className="text-[0.8125rem] text-muted">
                The preview runs in a locked sandbox, so links do not open here. The downloaded file is one HTML page with
                inline CSS, no scripts and no external requests; host it anywhere that serves static files.
              </p>
              <details className="rounded-xl shadow-[inset_0_0_0_1px_var(--line)]">
                <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-ink">View HTML source</summary>
                <div className="px-3 pb-3">
                  <OutputBlock label="Generated HTML">
                    <code>{html}</code>
                  </OutputBlock>
                </div>
              </details>
            </div>
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}
