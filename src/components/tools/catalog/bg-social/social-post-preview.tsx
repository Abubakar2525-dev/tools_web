"use client";

import { useState } from "react";
import { Btn, PrivacyNote, ResetBtn, Segmented, SplitGrid, TextArea, TextField, ToolPanel } from "@/components/tools/kit";
import { FileDrop, useObjectUrl } from "@/components/tools/engines/files";
import { FOLD_RULES, type FoldRule } from "./lib/platforms";
import { foldText } from "./lib/misc";
import { countX, findUrls } from "./lib/text-count";

type Card = keyof typeof FOLD_RULES;

const CARD_NAMES: Record<Card, string> = {
  x: "Short-post feed (X-style)",
  instagram: "Photo feed (Instagram-style)",
  linkedin: "Professional feed (LinkedIn-style)",
  facebook: "Social feed (Facebook-style)",
};

const SAMPLE = `We rebuilt our onboarding from scratch, and activation went up in the first week.

What changed:
1. One question per screen
2. A real example instead of an empty state
3. Help text written by support, not marketing

Full write-up: https://example.com/blog/onboarding #product #ux @designteam`;

/** Splits text into plain, link, hashtag and mention runs for highlighting. */
function tokens(text: string) {
  const out: { t: string; kind: "plain" | "accent" }[] = [];
  const marks: { s: number; e: number }[] = findUrls(text).map((u) => ({ s: u.start, e: u.end }));
  const re = new RegExp("(^|[^\\p{L}\\p{N}_])([#@][\\p{L}\\p{N}_]+)", "gu");
  for (const m of text.matchAll(re)) {
    const s = (m.index ?? 0) + m[1].length;
    const e = s + m[2].length;
    if (!marks.some((k) => s < k.e && e > k.s)) marks.push({ s, e });
  }
  marks.sort((a, b) => a.s - b.s);
  let i = 0;
  for (const k of marks) {
    if (k.s > i) out.push({ t: text.slice(i, k.s), kind: "plain" });
    out.push({ t: text.slice(k.s, k.e), kind: "accent" });
    i = k.e;
  }
  if (i < text.length) out.push({ t: text.slice(i), kind: "plain" });
  return out;
}

function Body({ text, rule, accent, weighted }: { text: string; rule: FoldRule; accent: string; weighted?: boolean }) {
  const [open, setOpen] = useState(false);
  // X folds by weighted length: convert the weighted limit into a character index
  let fold = foldText(text, rule.maxChars, rule.maxLines);
  if (weighted) {
    const x = countX(text, rule.maxChars);
    fold = x.overflowAt >= 0 ? foldText(x.normalized.slice(0, x.overflowAt), Number.MAX_SAFE_INTEGER, rule.maxLines) : { visible: text, truncated: false };
    if (x.overflowAt >= 0) fold = { ...fold, truncated: true };
  }
  const shown = open || !fold.truncated ? text : fold.visible;
  return (
    <p className="whitespace-pre-wrap break-words">
      {tokens(shown).map((k, i) =>
        k.kind === "accent" ? (
          <span key={i} style={{ color: accent }}>
            {k.t}
          </span>
        ) : (
          <span key={i}>{k.t}</span>
        ),
      )}
      {fold.truncated && (
        <>
          {!open && "… "}
          <button type="button" onClick={() => setOpen((o) => !o)} className="font-medium underline-offset-2 hover:underline" style={{ color: open ? accent : "inherit", opacity: open ? 1 : 0.65 }}>
            {open ? " Show less" : rule.moreLabel}
          </button>
        </>
      )}
    </p>
  );
}

function Avatar({ url, name, size, square }: { url: string | null; name: string; size: number; square?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
    <img src={url} alt="" className={`shrink-0 object-cover ${square ? "rounded-md" : "rounded-full"}`} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center bg-[#6366f1] font-semibold text-white ${square ? "rounded-md" : "rounded-full"}`} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

const ICON_ROW = ["Reply", "Repost", "Like", "Share"];

export default function Tool() {
  const [name, setName] = useState("Avery Chen");
  const [handle, setHandle] = useState("averybuilds");
  const [text, setText] = useState(SAMPLE);
  const [card, setCard] = useState<Card>("x");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [image, setImage] = useState<File | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const imageUrl = useObjectUrl(image);
  const avatarUrl = useObjectUrl(avatar);

  const dark = theme === "dark";
  const c = {
    bg: dark ? "#0f1115" : "#ffffff",
    ink: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#64748b",
    line: dark ? "#262a33" : "#e2e8f0",
    accent: dark ? "#60a5fa" : "#2563eb",
  };
  const cleanHandle = handle.replace(/^@/, "").trim() || "handle";
  const rule = FOLD_RULES[card];

  const img = (aspect: string) =>
    imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
      <img src={imageUrl} alt="Attached image" className="w-full object-cover" style={{ aspectRatio: aspect }} />
    ) : null;

  const meta = <span style={{ color: c.muted }}>· 2h</span>;
  const actions = (
    <div className="mt-3 flex justify-between text-[0.8125rem]" style={{ color: c.muted }} aria-hidden="true">
      {ICON_ROW.map((a) => (
        <span key={a}>{a}</span>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Preview a post before you publish"
        actions={
          <ResetBtn
            onClick={() => {
              setText("");
              setImage(null);
              setAvatar(null);
            }}
          />
        }
      >
        <SplitGrid>
          <div className="min-w-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
              <TextField label="Handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
            </div>
            <TextArea label="Post text" rows={9} value={text} onChange={(e) => setText(e.target.value)} />
            <FileDrop compact accept="image/png,image/jpeg,image/webp,image/gif,image/avif" maxSizeMB={25} onFiles={(f) => setImage(f[0])} label={image ? `Replace ${image.name}` : "Attach an image (optional)"} hint="Shown cropped the way each feed tends to crop it." />
            <FileDrop compact accept="image/png,image/jpeg,image/webp" maxSizeMB={10} onFiles={(f) => setAvatar(f[0])} label={avatar ? "Replace profile photo" : "Profile photo (optional)"} hint="Initials are used otherwise." />
            {image && (
              <Btn variant="subtle" onClick={() => setImage(null)}>
                Remove image
              </Btn>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Segmented
                label="Layout"
                value={card}
                onChange={setCard}
                options={(Object.keys(CARD_NAMES) as Card[]).map((k) => ({ value: k, label: CARD_NAMES[k].split(" (")[0] }))}
              />
              <Segmented
                label="Theme"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </div>
            <p className="text-[0.8125rem] text-muted">
              {CARD_NAMES[card]}: text folds after about {rule.maxChars} {card === "x" ? "weighted characters" : "characters"}
              {rule.maxLines < 100 ? ` or ${rule.maxLines} lines` : ""}.
            </p>

            <article
              key={card + text}
              aria-label={`${CARD_NAMES[card]} preview`}
              className="overflow-hidden rounded-xl text-[0.9375rem] leading-normal"
              style={{ background: c.bg, color: c.ink, boxShadow: `0 0 0 1px ${c.line}` }}
            >
              {card === "x" && (
                <div className="flex gap-3 p-4">
                  <Avatar url={avatarUrl} name={name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-bold">{name || "Name"}</span> <span style={{ color: c.muted }}>@{cleanHandle}</span> {meta}
                    </p>
                    <div className="mt-0.5">
                      <Body text={text} rule={rule} accent={c.accent} weighted />
                    </div>
                    {imageUrl && <div className="mt-3 overflow-hidden rounded-2xl" style={{ boxShadow: `0 0 0 1px ${c.line}` }}>{img("16 / 9")}</div>}
                    {actions}
                  </div>
                </div>
              )}

              {card === "instagram" && (
                <div>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar url={avatarUrl} name={name} size={32} />
                    <span className="font-semibold">{cleanHandle}</span>
                  </div>
                  {img("4 / 5") ?? (
                    <div className="grid aspect-[4/5] place-items-center text-sm" style={{ background: dark ? "#1b1f27" : "#f1f5f9", color: c.muted }}>
                      Photo posts need an image
                    </div>
                  )}
                  <div className="p-3">
                    <div className="mb-2 flex gap-4 text-[0.8125rem]" style={{ color: c.muted }} aria-hidden="true">
                      <span>Like</span>
                      <span>Comment</span>
                      <span>Share</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="min-w-0">
                        <Body text={`${cleanHandle} ${text}`} rule={rule} accent={c.accent} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(card === "linkedin" || card === "facebook") && (
                <div>
                  <div className="flex gap-3 p-4 pb-2">
                    <Avatar url={avatarUrl} name={name} size={card === "linkedin" ? 48 : 40} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{name || "Name"}</p>
                      <p className="truncate text-[0.8125rem]" style={{ color: c.muted }}>
                        {card === "linkedin" ? `@${cleanHandle} · 2h · Public` : "2h · Public"}
                      </p>
                    </div>
                  </div>
                  <div className="px-4 pb-3">
                    <Body text={text} rule={rule} accent={c.accent} />
                  </div>
                  {img(card === "linkedin" ? "1.91 / 1" : "1 / 1")}
                  <div className="flex justify-around border-t px-2 py-2.5 text-[0.8125rem]" style={{ borderColor: c.line, color: c.muted }} aria-hidden="true">
                    <span>Like</span>
                    <span>Comment</span>
                    <span>{card === "linkedin" ? "Repost" : "Share"}</span>
                    {card === "linkedin" && <span>Send</span>}
                  </div>
                </div>
              )}
            </article>
            <p className="text-[0.8125rem] text-muted">
              These are neutral mock layouts, not the real apps. Fold points vary by device and change over time, so treat the cut as a guide.
            </p>
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
