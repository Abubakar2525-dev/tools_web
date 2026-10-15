"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, PrivacyNote, ResetBtn, StatGrid, TextArea, ToolPanel, fmt } from "@/components/tools/kit";
import { CHAR_LIMITS } from "./lib/platforms";
import { countBy, countX, textStats } from "./lib/text-count";

const SAMPLE = "Shipping our new pricing page today 🚀 Details: https://example.com/blog/pricing-update-2026 #buildinpublic\n\n東京からこんにちは 👋";

export default function Tool() {
  const [text, setText] = useState("");
  const [premium, setPremium] = useState(false);
  const deferred = useDeferredValue(text);

  const xLimit = premium ? 25000 : 280;
  const x = useMemo(() => countX(deferred, xLimit), [deferred, xLimit]);
  const stats = useMemo(() => textStats(deferred), [deferred]);
  const rows = useMemo(
    () =>
      CHAR_LIMITS.filter((l) => l.id !== (premium ? "x-post" : "x-premium")).map((l) => {
        const n = countBy(l.method, deferred, l.limit);
        return { ...l, n, left: l.limit - n };
      }),
    [deferred, premium],
  );

  const overflow = x.overflowAt >= 0 ? x.normalized.slice(x.overflowAt) : "";
  const fits = x.overflowAt >= 0 ? x.normalized.slice(0, x.overflowAt) : "";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Count characters for every platform"
        actions={
          <>
            <Btn variant="ghost" icon="text" onClick={() => setText(SAMPLE)}>
              Load sample
            </Btn>
            <ResetBtn onClick={() => setText("")} />
          </>
        }
      >
        <div className="space-y-5">
          <TextArea label="Post text" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste your post…" />
          <StatGrid
            items={[
              { label: "X weighted length", value: `${fmt(x.weighted, 0)} / ${fmt(xLimit, 0)}` },
              { label: "Characters (code points)", value: fmt(stats.codePoints, 0) },
              { label: "Graphemes (visible)", value: fmt(stats.graphemes, 0) },
              { label: "Words", value: fmt(stats.words, 0) },
              { label: "Hashtags / mentions", value: `${stats.hashtags} / ${stats.mentions}` },
              { label: "Links / emoji", value: `${stats.urls} / ${stats.emoji}` },
            ]}
          />

          <div className="rounded-xl bg-sunken p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium text-ink">
                X: {x.weighted <= xLimit ? `${fmt(x.remaining, 0)} left` : `${fmt(-x.remaining, 0)} over the limit`}
              </p>
              <Checkbox label="Premium long post (25,000)" checked={premium} onChange={setPremium} />
            </div>
            <p className="mt-1 text-ink-2">
              {x.urls} link{x.urls === 1 ? "" : "s"} counted as 23 each, {x.emoji} emoji counted as 2 each, {x.heavy} other character{x.heavy === 1 ? "" : "s"} counted as 2 (for example CJK).
              {x.invalidChars ? " The text contains characters X rejects (U+FFFE, U+FEFF or U+FFFF)." : ""}
            </p>
            {overflow && (
              <div className="mt-3">
                <p className="text-[0.8125rem] text-muted">Text past the limit is marked:</p>
                <p className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3">
                  {fits}
                  <mark className="rounded bg-[color-mix(in_oklch,var(--danger)_22%,transparent)] text-ink">{overflow}</mark>
                </p>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">Character count against each platform limit</caption>
              <thead className="bg-sunken text-[0.8125rem] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Where</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Count</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Limit</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const ratio = Math.min(1, r.n / r.limit);
                  const over = r.left < 0;
                  const folded = r.foldAt !== undefined && r.n > r.foldAt;
                  return (
                    <tr key={r.id}>
                      <th scope="row" className="px-4 py-2.5 font-normal text-ink">
                        {r.label}
                        {r.note && <span className="block text-[0.75rem] text-muted">{r.note}</span>}
                      </th>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt(r.n, 0)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted">{fmt(r.limit, 0)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                            <span className={`block h-full rounded-full ${over ? "bg-danger" : "bg-accent"}`} style={{ width: `${ratio * 100}%` }} />
                          </span>
                          <span className={over ? "text-danger" : "text-ink-2"}>
                            {over ? `${fmt(-r.left, 0)} over` : `${fmt(r.left, 0)} left`}
                            {!over && folded ? `, cut after ~${r.foldAt} in feeds` : ""}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[0.8125rem] text-muted">Limits as published by each platform in October 2026. Feed cut-off points are approximate and vary by screen size.</p>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
