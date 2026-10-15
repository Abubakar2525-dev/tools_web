"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, PrivacyNote, ResetBtn, StatGrid, TextArea, TextField, ToolPanel, downloadFile } from "@/components/tools/kit";
import { TRACKING_RULES, WRAPPERS, cleanUrl, extractUrls } from "./lib/url-clean";

const SAMPLE = [
  "https://www.google.com/url?sa=t&url=https%3A%2F%2Fexample.com%2Fguide%3Futm_source%3Dnewsletter%26utm_medium%3Demail%26page%3D2&ved=2ahUKE",
  "https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.org%2Fpost%2F12%3Ffbclid%3DIwAR0abc&h=AT3xyz",
  "https://example.net/shop/item?id=88&gclid=Cj0KCQ&mc_eid=1a2b3c&color=red",
  "https://youtu.be/dQw4w9WgXcQ?si=Ab12Cd34",
].join("\n");

export default function Tool() {
  const [input, setInput] = useState("");
  const [affiliate, setAffiliate] = useState(false);
  const [hash, setHash] = useState(true);
  const [extra, setExtra] = useState("");
  const d = useDeferredValue(input);

  const results = useMemo(() => {
    const extraList = extra.split(/[\s,]+/).filter(Boolean);
    const lines = d.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // Each line may be a bare URL or prose containing URLs.
    const urls = lines.flatMap((l) => (/^\S+$/.test(l) ? [l] : extractUrls(l)));
    return urls.slice(0, 2000).map((u) => cleanUrl(u, { affiliate, extra: extraList, stripHashTracking: hash }));
  }, [d, affiliate, hash, extra]);

  const cleaned = results.map((r) => (r.error ? r.input : r.output)).join("\n");
  const removedCount = results.reduce((n, r) => n + r.removed.length, 0);
  const unwrappedCount = results.reduce((n, r) => n + r.unwrapped.length, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title="Links to clean"
          actions={
            <>
              <Btn variant="ghost" icon="spark" onClick={() => setInput(SAMPLE)}>
                Load sample
              </Btn>
              <ResetBtn onClick={() => setInput("")} />
            </>
          }
        >
          <div className="space-y-4">
            <TextArea label="One URL per line" mono rows={10} value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://example.com/page?utm_source=…" hint="You can also paste text that contains links; each link is found and cleaned." />
            <Checkbox label="Also remove affiliate tags" checked={affiliate} onChange={setAffiliate} hint="Amazon tag=, linkCode= and generic aff_id parameters. Off by default because they pay creators." />
            <Checkbox label="Remove tracking fragments" checked={hash} onChange={setHash} hint="Drops #utm_… and #xtor=… fragments and #:~:text= highlights." />
            <TextField label="Extra parameters to remove" optional placeholder="ref, source, cmp*" hint="Comma or space separated. End with * to match a prefix." value={extra} onChange={(e) => setExtra(e.target.value)} />
          </div>
        </ToolPanel>
        <div className="min-w-0 space-y-5">
          <ToolPanel
            title="Clean links"
            actions={
              <>
                <CopyBtn text={results.length ? cleaned : ""} label="Copy all" />
                <Btn variant="ghost" icon="download" disabled={!results.length} onClick={() => downloadFile("clean-links.txt", cleaned + "\n")}>
                  .txt
                </Btn>
              </>
            }
          >
            {!results.length ? (
              <EmptyState icon="link" title="Nothing to clean yet">
                Paste links on the left. Results update as you type.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                <StatGrid
                  items={[
                    { label: "Links", value: results.length },
                    { label: "Parameters removed", value: removedCount },
                    { label: "Redirects unwrapped", value: unwrappedCount },
                  ]}
                />
                <ol className="space-y-3" aria-live="polite">
                  {results.map((r, i) => (
                    <li key={i} className="rounded-lg bg-sunken p-3">
                      {r.error ? (
                        <p className="text-sm">
                          <span className="font-medium text-danger">Skipped:</span> <span className="break-all font-mono">{r.input}</span> <span className="text-muted">({r.error})</span>
                        </p>
                      ) : (
                        <>
                          <p className="break-all font-mono text-[0.875rem] text-ink">{r.output}</p>
                          <p className="mt-1.5 text-[0.8125rem] text-muted">
                            {r.changed ? (
                              <>
                                {r.unwrapped.length > 0 && <>Unwrapped: {r.unwrapped.join(" → ")}. </>}
                                {r.removed.length > 0 && <>Removed: {r.removed.map((x) => x.name).join(", ")}.</>}
                                {!r.unwrapped.length && !r.removed.length && "Normalized."}
                              </>
                            ) : (
                              "Already clean."
                            )}
                          </p>
                          <div className="mt-2">
                            <CopyBtn text={r.output} />
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </ToolPanel>
          <ToolPanel title="What gets removed">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-ink">
                {TRACKING_RULES.length} tracking parameters and {WRAPPERS.length} redirect wrappers
              </summary>
              <ul className="mt-3 grid gap-1 text-[0.8125rem] text-ink-2 sm:grid-cols-2">
                {TRACKING_RULES.map((r) => (
                  <li key={`${r.name}-${r.hosts?.join() ?? ""}`}>
                    <code className="font-mono">{r.name}</code> {r.source}
                    {r.hosts ? ` (on ${r.hosts.join(", ")})` : ""}
                    {r.optional ? " (optional)" : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm font-medium text-ink">Redirects unwrapped</p>
              <p className="mt-1 text-[0.8125rem] text-ink-2">{WRAPPERS.map((w) => w.label).join(", ")}.</p>
              <p className="mt-3 text-[0.8125rem] text-muted">
                Shorteners such as t.co or bit.ly cannot be expanded here, because that requires requesting the link and this tool never makes network requests.
              </p>
            </details>
          </ToolPanel>
        </div>
      </div>
      <PrivacyNote />
    </div>
  );
}
