"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, TextField, ToolPanel, downloadFile } from "@/components/tools/kit";
import { parseUrl, type ParsedUrl } from "./lib/web-url";

const SAMPLE = "https://user:pa%24s@shop.example.co.uk:8443/catalog/winter%20coats/item-42?color=navy&size=M&tag=sale&tag=new&q=caf%C3%A9#reviews";

function toJson(p: ParsedUrl) {
  return JSON.stringify(
    {
      href: p.href,
      protocol: p.protocol,
      username: p.username || undefined,
      password: p.password || undefined,
      hostname: p.hostname,
      port: p.port || undefined,
      origin: p.origin,
      pathname: p.pathname,
      pathSegments: p.pathSegments,
      query: p.params.map((q) => ({ key: q.key, value: q.value })),
      hash: p.hash || undefined,
    },
    null,
    2,
  );
}

export default function Tool() {
  const [input, setInput] = useState("");
  const d = useDeferredValue(input);
  const result = useMemo(() => {
    if (!d.trim()) return null;
    try {
      return { ok: true as const, url: parseUrl(d) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Could not parse this URL." };
    }
  }, [d]);

  const p = result?.ok ? result.url : null;
  const json = p ? toJson(p) : "";
  const dupKeys = p ? new Set(p.params.map((x) => x.key).filter((k, i, a) => a.indexOf(k) !== i)) : new Set<string>();

  const rows: [string, string, string?][] = p
    ? [
        ["Protocol", p.protocol],
        ["Username", p.username || "(none)"],
        ["Password", p.password ? "•".repeat(Math.min(p.password.length, 12)) : "(none)", p.password ? "Credentials in a URL are visible to anyone who sees the link." : undefined],
        ["Hostname", p.hostname],
        ["Port", p.port || (p.defaultPort ? `${p.defaultPort} (default)` : "(none)")],
        ["Top-level domain", p.tld ? `.${p.tld}` : "(none)"],
        ["Origin", p.origin],
        ["Path", p.pathname],
        ["Query string", p.search || "(none)"],
        ["Fragment", p.hash || "(none)", p.hash ? "The fragment is never sent to the server." : undefined],
      ]
    : [];

  return (
    <div className="space-y-5">
      <ToolPanel
        title="URL"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => setInput(SAMPLE)}>
              Load sample
            </Btn>
            <ResetBtn onClick={() => setInput("")} />
          </>
        }
      >
        <TextField label="URL to parse" placeholder="https://example.com/path?key=value#section" value={input} onChange={(e) => setInput(e.target.value)} inputMode="url" spellCheck={false} className="font-mono" />
      </ToolPanel>

      {!result ? (
        <EmptyState icon="link" title="Paste a URL to see its parts">
          Components are decoded for reading; the raw form is shown too.
        </EmptyState>
      ) : !result.ok ? (
        <Notice tone="error">{result.error}</Notice>
      ) : (
        p && (
          <div className="grid gap-5 lg:grid-cols-2">
            <ToolPanel title="Components">
              {p.assumedScheme && (
                <div className="mb-4">
                  <Notice tone="info">No scheme was given, so https:// was assumed.</Notice>
                </div>
              )}
              <dl className="divide-y divide-line">
                {rows.map(([k, v, note]) => (
                  <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[9rem_1fr]">
                    <dt className="text-sm text-muted">{k}</dt>
                    <dd className="min-w-0 break-all font-mono text-[0.9rem] text-ink">
                      {v}
                      {note && <span className="mt-0.5 block font-sans text-[0.8125rem] text-muted">{note}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              {p.pathSegments.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-ink">Path segments (decoded)</p>
                  <ol className="mt-2 flex flex-wrap gap-2">
                    {p.pathSegments.map((s, i) => (
                      <li key={i} className="rounded-md bg-sunken px-2 py-1 font-mono text-[0.85rem] text-ink">
                        <span className="text-muted">{i + 1}.</span> {s}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </ToolPanel>
            <div className="min-w-0 space-y-5">
              <ToolPanel title={`Query parameters (${p.params.length})`}>
                {p.params.length === 0 ? (
                  <p className="text-sm text-muted">This URL has no query string.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg shadow-[0_0_0_1px_var(--line)]" tabIndex={0} aria-label="Query parameters table">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="bg-sunken text-left">
                          <th scope="col" className="px-3 py-2 font-medium">Key</th>
                          <th scope="col" className="px-3 py-2 font-medium">Value (decoded)</th>
                          <th scope="col" className="px-3 py-2 font-medium">Raw</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.params.map((q, i) => (
                          <tr key={i} className="border-t border-line align-top">
                            <td className="break-all px-3 py-2 font-mono">
                              {q.key}
                              {dupKeys.has(q.key) && <span className="ml-1 font-sans text-[0.75rem] text-muted">(repeated)</span>}
                            </td>
                            <td className="break-all px-3 py-2 font-mono">{q.value || <span className="text-muted">(empty)</span>}</td>
                            <td className="break-all px-3 py-2 font-mono text-muted">{q.rawValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ToolPanel>
              <ToolPanel
                title="JSON"
                actions={
                  <>
                    <CopyBtn text={json} />
                    <Btn variant="ghost" icon="download" onClick={() => downloadFile("url.json", json, "application/json")}>
                      Download
                    </Btn>
                  </>
                }
              >
                <pre tabIndex={0} aria-label="URL as JSON" className="max-h-[360px] overflow-auto rounded-lg bg-night p-4 font-mono text-[0.85rem] leading-relaxed text-night-ink">
                  <code>{json}</code>
                </pre>
              </ToolPanel>
            </div>
          </div>
        )
      )}
      <PrivacyNote />
    </div>
  );
}
