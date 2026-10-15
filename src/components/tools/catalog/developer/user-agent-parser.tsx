"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, StatGrid, TextArea, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";

type UAResult = {
  ua: string;
  browser: { name?: string; version?: string; major?: string };
  engine: { name?: string; version?: string };
  os: { name?: string; version?: string };
  device: { vendor?: string; model?: string; type?: string };
  cpu: { architecture?: string };
};
type Parse = (ua: string) => UAResult;

type Hints = Record<string, string>;

const SAMPLES: { label: string; ua: string }[] = [
  { label: "Chrome on Windows", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36" },
  { label: "Safari on iPhone", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1" },
  { label: "Firefox on Linux", ua: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0" },
  { label: "Samsung tablet", ua: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Safari/537.36" },
  { label: "Googlebot", ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { label: "curl", ua: "curl/8.9.1" },
];

interface NavigatorUAData {
  brands?: { brand: string; version: string }[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
}

async function readClientHints(): Promise<Hints | null> {
  const data = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  if (!data) return null;
  const out: Hints = {};
  if (data.brands) out.Brands = data.brands.map((b) => `${b.brand} ${b.version}`).join(", ");
  if (data.platform) out.Platform = data.platform;
  if (data.mobile !== undefined) out.Mobile = data.mobile ? "yes" : "no";
  try {
    const hi = await data.getHighEntropyValues?.(["platformVersion", "architecture", "bitness", "model", "fullVersionList"]);
    if (hi) {
      if (hi.platformVersion) out["Platform version"] = String(hi.platformVersion);
      if (hi.architecture) out.Architecture = `${String(hi.architecture)}${hi.bitness ? ` (${String(hi.bitness)}-bit)` : ""}`;
      if (hi.model) out.Model = String(hi.model);
      if (Array.isArray(hi.fullVersionList)) out["Full versions"] = (hi.fullVersionList as { brand: string; version: string }[]).map((b) => `${b.brand} ${b.version}`).join(", ");
    }
  } catch {
    /* the browser may refuse high-entropy hints */
  }
  return out;
}

const show = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ") || "Unknown";

export default function Tool() {
  const [parse, setParse] = useState<Parse | null>(null);
  const [mine, setMine] = useState("");
  const [hints, setHints] = useState<Hints | null | undefined>(undefined);
  const [input, setInput] = useState("");
  const dInput = useDeferredValue(input);

  useEffect(() => {
    let alive = true;
    import("ua-parser-js").then((m) => {
      if (!alive) return;
      const Ctor = m.default as unknown as new (ua?: string) => { getResult: () => UAResult };
      setParse(() => (ua: string) => new Ctor(ua).getResult());
      setMine(navigator.userAgent);
      setInput((cur) => cur || navigator.userAgent);
    });
    readClientHints().then((h) => {
      if (alive) setHints(h);
    });
    return () => {
      alive = false;
    };
  }, []);

  const result = useMemo(() => (parse && dInput.trim() ? parse(dInput.trim()) : null), [parse, dInput]);
  const isMine = mine !== "" && dInput.trim() === mine;
  const deviceType = result?.device.type ?? (result && (result.device.model || result.device.vendor) ? "unknown" : "desktop (no device token)");

  return (
    <div className="space-y-5">
      <ToolPanel
        title="User-agent string"
        actions={
          <>
            <Btn variant="ghost" icon="globe" disabled={!mine} onClick={() => setInput(mine)}>
              Use my browser
            </Btn>
            <ResetBtn onClick={() => setInput("")} />
          </>
        }
      >
        <div className="space-y-4">
          <TextArea label="User agent" mono rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Mozilla/5.0 (...)" />
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <Btn key={s.label} variant="ghost" onClick={() => setInput(s.ua)}>
                {s.label}
              </Btn>
            ))}
          </div>
        </div>
      </ToolPanel>
      <ToolPanel title="Parsed result" actions={result ? <CopyBtn text={JSON.stringify(result, null, 2)} label="Copy JSON" /> : undefined}>
        {!parse ? (
          <Spinner label="Loading the parser" />
        ) : !result ? (
          <EmptyState icon="globe" title="No user agent">
            Paste a user-agent string or use your browser&apos;s.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <StatGrid
              items={[
                { label: "Browser", value: show(result.browser.name, result.browser.version) },
                { label: "Engine", value: show(result.engine.name, result.engine.version) },
                { label: "Operating system", value: show(result.os.name, result.os.version) },
                { label: "Device type", value: deviceType },
                { label: "Device", value: show(result.device.vendor, result.device.model) },
                { label: "CPU architecture", value: result.cpu.architecture ?? "Unknown" },
              ]}
            />
            {/bot|crawler|spider|curl|wget|python-requests|headless/i.test(result.ua) && <Notice>This looks like a bot, crawler or command-line client rather than a person&apos;s browser.</Notice>}
            {isMine && (
              <Notice title="About your own browser">
                Chromium browsers freeze parts of the user agent (UA reduction): the OS version and device model are often fixed placeholders, such as Windows NT 10.0 even on Windows 11, or Android 10 with the model shown as K. The client hints below come from the browser directly and are more accurate.
              </Notice>
            )}
          </div>
        )}
      </ToolPanel>
      <ToolPanel title="Client hints from this browser">
        {hints === undefined ? (
          <Spinner label="Reading client hints" />
        ) : hints === null ? (
          <p className="text-sm text-ink-2">This browser does not expose User-Agent Client Hints (navigator.userAgentData). Firefox and Safari currently rely on the user-agent string only.</p>
        ) : (
          <dl className="divide-y divide-line text-sm">
            {Object.entries(hints).map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr]">
                <dt className="text-muted">{k}</dt>
                <dd className="break-words text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
