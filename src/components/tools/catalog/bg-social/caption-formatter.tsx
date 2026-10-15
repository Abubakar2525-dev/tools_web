"use client";

import { useMemo } from "react";
import {
  Btn,
  Checkbox,
  CopyBtn,
  NumberField,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  SelectField,
  SplitGrid,
  StatGrid,
  TextArea,
  ToolPanel,
  downloadFile,
  fmt,
  parseNum,
  usePersistentState,
} from "@/components/tools/kit";
import { BULLETS, DEFAULT_CAPTION_OPTIONS, SPACERS, formatCaption, type BulletKey, type CaptionOptions, type SpacerKey } from "./lib/caption";
import { CAPTION_RULES, type PlatformId } from "./lib/platforms";
import { countCodePoints, countX } from "./lib/text-count";

const SAMPLE = `New recipe is live! #food #recipe #Food

Three things that made it work:
- slow roasted garlic
- a squeeze of lemon
- patience #cooking #2024

Link in bio #food #dinner`;

interface Saved {
  text: string;
  platform: PlatformId;
  opts: CaptionOptions;
  cap: string;
}

const INITIAL: Saved = { text: "", platform: "instagram", opts: DEFAULT_CAPTION_OPTIONS, cap: "5" };

const BULLET_LABELS: Record<BulletKey, string> = {
  keep: "Keep as typed",
  dot: "• Dot",
  arrow: "→ Arrow",
  check: "✓ Check",
  dash: "– Dash",
  numbered: "1. Numbered",
};

export default function Tool() {
  const [state, setState, clear] = usePersistentState<Saved>("caption-formatter", INITIAL);
  const { text, platform, opts, cap } = state;
  const rule = CAPTION_RULES.find((r) => r.id === platform) ?? CAPTION_RULES[0];
  const capNum = cap.trim() === "" ? null : parseNum(cap);
  const capError = cap.trim() !== "" && (capNum === null || capNum < 0 || !Number.isInteger(capNum)) ? "Enter a whole number, or leave empty for no cap." : null;

  const set = (p: Partial<Saved>) => setState((s) => ({ ...s, ...p }));
  const setOpt = (p: Partial<CaptionOptions>) => setState((s) => ({ ...s, opts: { ...s.opts, ...p } }));

  const result = useMemo(
    () => formatCaption(text, { ...opts, maxHashtags: capError ? null : capNum }),
    [text, opts, capNum, capError],
  );
  const length = platform === "x" ? countX(result.text).weighted : countCodePoints(result.text);
  const over = length > rule.maxChars;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Caption formatter"
        actions={
          <>
            <Btn variant="ghost" icon="text" onClick={() => set({ text: SAMPLE })}>
              Load sample
            </Btn>
            <ResetBtn onClick={clear} />
          </>
        }
      >
        <SplitGrid>
          <div className="min-w-0 space-y-4">
            <TextArea label="Your caption" rows={10} value={text} placeholder="Paste or write your caption…" onChange={(e) => set({ text: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Platform"
                value={platform}
                onChange={(e) => {
                  const r = CAPTION_RULES.find((x) => x.id === e.target.value) ?? CAPTION_RULES[0];
                  set({ platform: r.id, cap: r.maxHashtags === null ? "" : String(r.maxHashtags) });
                }}
                options={CAPTION_RULES.map((r) => ({ value: r.id, label: r.label }))}
              />
              <NumberField label="Hashtag cap" hint={rule.hashtagNote} value={cap} placeholder="No cap" onChange={(e) => set({ cap: e.target.value })} error={capError} />
              <SelectField
                label="Blank-line spacer"
                value={opts.spacer}
                onChange={(e) => setOpt({ spacer: e.target.value as SpacerKey })}
                options={(Object.keys(SPACERS) as SpacerKey[]).map((k) => ({ value: k, label: SPACERS[k].label }))}
              />
              <SelectField
                label="List bullets"
                value={opts.bullets}
                onChange={(e) => setOpt({ bullets: e.target.value as BulletKey })}
                options={(Object.keys(BULLETS) as BulletKey[]).map((k) => ({ value: k, label: BULLET_LABELS[k] }))}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="Move hashtags to the end" checked={opts.moveHashtags} onChange={(v) => setOpt({ moveHashtags: v })} />
              <Checkbox label="Remove duplicate hashtags" checked={opts.dedupeHashtags} onChange={(v) => setOpt({ dedupeHashtags: v })} />
              <Checkbox label="Drop number-only hashtags" checked={opts.dropNumericTags} onChange={(v) => setOpt({ dropNumericTags: v })} hint="#2024 isn't linked on most apps." />
              <Checkbox label="Lowercase hashtags" checked={opts.lowercaseTags} onChange={(v) => setOpt({ lowercaseTags: v })} />
              <Checkbox label="Collapse repeated blank lines" checked={opts.collapseBlank} onChange={(v) => setOpt({ collapseBlank: v })} />
              <Checkbox label="Trim spaces at line ends" checked={opts.trimLines} onChange={(v) => setOpt({ trimLines: v })} hint="Trailing spaces can break line breaks." />
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <StatGrid
              items={[
                { label: platform === "x" ? "Weighted length" : "Characters", value: `${fmt(length, 0)} / ${fmt(rule.maxChars, 0)}` },
                { label: "Hashtags kept", value: result.hashtags.length },
                { label: "Spacer lines", value: result.blankLinesFilled },
              ]}
            />
            {over && <Notice tone="error">This caption is {fmt(length - rule.maxChars, 0)} characters over the {rule.label} limit.</Notice>}
            {result.removedTags.length > 0 && (
              <Notice tone="info">
                Removed: {result.removedTags.map((t) => `#${t}`).join(" ")}
              </Notice>
            )}
            <OutputBlock label="Formatted caption">
              <code className="whitespace-pre-wrap break-words">{result.text || "Your formatted caption appears here."}</code>
            </OutputBlock>
            <div className="flex flex-wrap gap-2">
              <CopyBtn text={result.text} label="Copy caption" />
              <Btn variant="ghost" icon="download" disabled={!result.text} onClick={() => downloadFile("caption.txt", result.text)}>
                Download .txt
              </Btn>
            </div>
            <p className="text-[0.8125rem] text-muted">
              Spacer lines look empty but contain an invisible character, so apps keep your paragraph breaks. Paste into the app and check the preview before posting.
            </p>
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}
