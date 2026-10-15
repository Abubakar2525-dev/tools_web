"use client";

import { useMemo, useState } from "react";
import { Btn, CellInput, CellSelect, Checkbox, CopyBtn, Notice, OutputBlock, PrivacyNote, ResetBtn, Segmented, TextArea, TextField, ToolPanel, downloadFile, uid } from "@/components/tools/kit";
import { AI_CRAWLERS, generateRobots, parseRobots, testRobots, type RobotsConfig, type RobotsGroup } from "./lib/robots";

const newGroup = (agents = "*"): RobotsGroup => ({ id: uid(), agents, rules: [{ id: uid(), type: "disallow", path: "" }], crawlDelay: "" });

const PRESETS: { id: string; label: string; make: () => RobotsConfig }[] = [
  { id: "allow", label: "Allow everything", make: () => ({ groups: [newGroup()], aiBlocked: [], sitemaps: "" }) },
  { id: "block", label: "Block everything", make: () => ({ groups: [{ ...newGroup(), rules: [{ id: uid(), type: "disallow", path: "/" }] }], aiBlocked: [], sitemaps: "" }) },
  {
    id: "common",
    label: "Typical site",
    make: () => ({
      groups: [
        {
          ...newGroup(),
          rules: [
            { id: uid(), type: "disallow", path: "/admin/" },
            { id: uid(), type: "disallow", path: "/cart" },
            { id: uid(), type: "disallow", path: "/*?sessionid=" },
            { id: uid(), type: "allow", path: "/admin/public/" },
          ],
        },
      ],
      aiBlocked: [],
      sitemaps: "https://example.com/sitemap.xml",
    }),
  },
  {
    id: "noai",
    label: "Allow search, block AI training",
    make: () => ({ groups: [newGroup()], aiBlocked: ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot", "Meta-ExternalAgent", "Bytespider"], sitemaps: "" }),
  },
];

const TEST_AGENTS = ["Googlebot", "Bingbot", "GPTBot", "ClaudeBot", "CCBot", "Some-other-bot"];

export default function Tool() {
  const [config, setConfig] = useState<RobotsConfig>(() => PRESETS[0].make());
  const [source, setSource] = useState<"generated" | "pasted">("generated");
  const [pasted, setPasted] = useState("");
  const [agent, setAgent] = useState("Googlebot");
  const [testPath, setTestPath] = useState("/admin/settings");
  const text = useMemo(() => generateRobots(config), [config]);
  const parsed = useMemo(() => parseRobots(source === "generated" ? text : pasted), [source, text, pasted]);
  const result = agent.trim() ? testRobots(parsed, agent, testPath) : null;

  const setGroup = (id: string, patch: Partial<RobotsGroup>) => setConfig((c) => ({ ...c, groups: c.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  const badSitemaps = config.sitemaps
    .split(/\s+/)
    .filter(Boolean)
    .filter((s) => {
      try {
        return !/^https?:$/.test(new URL(s).protocol);
      } catch {
        return true;
      }
    });

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title="Rules" actions={<ResetBtn onClick={() => setConfig(PRESETS[0].make())} />}>
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Btn key={p.id} variant="ghost" onClick={() => setConfig(p.make())}>
                  {p.label}
                </Btn>
              ))}
            </div>
            {config.groups.map((g, gi) => (
              <fieldset key={g.id} className="space-y-3 rounded-xl bg-sunken p-4">
                <legend className="sr-only">Group {gi + 1}</legend>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">Group {gi + 1}</p>
                  {config.groups.length > 1 && (
                    <Btn variant="danger" icon="trash" onClick={() => setConfig((c) => ({ ...c, groups: c.groups.filter((x) => x.id !== g.id) }))}>
                      Remove group
                    </Btn>
                  )}
                </div>
                <TextField label="User-agents" hint="Comma separated. * means every crawler without its own group." value={g.agents} onChange={(e) => setGroup(g.id, { agents: e.target.value })} />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink">Paths</p>
                  {g.rules.map((r, ri) => (
                    <div key={r.id} className="grid grid-cols-[7.5rem_1fr_auto] gap-2">
                      <CellSelect
                        label={`Rule ${ri + 1} type`}
                        value={r.type}
                        onChange={(e) => setGroup(g.id, { rules: g.rules.map((x) => (x.id === r.id ? { ...x, type: e.target.value as "allow" | "disallow" } : x)) })}
                        options={[
                          { value: "disallow", label: "Disallow" },
                          { value: "allow", label: "Allow" },
                        ]}
                      />
                      <CellInput
                        label={`Rule ${ri + 1} path`}
                        placeholder={r.type === "disallow" ? "/private/ (empty allows all)" : "/public/"}
                        value={r.path}
                        invalid={r.path.trim() !== "" && !/^[/*]/.test(r.path.trim())}
                        onChange={(e) => setGroup(g.id, { rules: g.rules.map((x) => (x.id === r.id ? { ...x, path: e.target.value } : x)) })}
                        className="font-mono"
                      />
                      <Btn variant="danger" icon="trash" aria-label={`Remove rule ${ri + 1}`} onClick={() => setGroup(g.id, { rules: g.rules.filter((x) => x.id !== r.id) })} />
                    </div>
                  ))}
                  {g.rules.some((r) => r.path.trim() !== "" && !/^[/*]/.test(r.path.trim())) && (
                    <p className="text-sm text-danger" role="alert">
                      Paths should start with / (or *).
                    </p>
                  )}
                  <Btn variant="subtle" icon="plus" onClick={() => setGroup(g.id, { rules: [...g.rules, { id: uid(), type: "disallow", path: "" }] })}>
                    Add path
                  </Btn>
                </div>
                <TextField label="Crawl-delay (seconds)" optional hint="Ignored by Google; some other crawlers honor it." inputMode="decimal" value={g.crawlDelay} onChange={(e) => setGroup(g.id, { crawlDelay: e.target.value })} error={g.crawlDelay.trim() && !/^\d+(\.\d+)?$/.test(g.crawlDelay.trim()) ? "Use a number of seconds." : null} />
              </fieldset>
            ))}
            <Btn variant="subtle" icon="plus" onClick={() => setConfig((c) => ({ ...c, groups: [...c.groups, newGroup("Googlebot")] }))}>
              Add user-agent group
            </Btn>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Block AI crawlers</legend>
              <p className="mt-1 text-[0.8125rem] text-muted">Adds a group with Disallow: / for each selected token. Compliance is voluntary; robots.txt is not access control.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {AI_CRAWLERS.map((a) => (
                  <Checkbox
                    key={a.token}
                    label={a.token}
                    hint={`${a.owner}: ${a.note}`}
                    checked={config.aiBlocked.includes(a.token)}
                    onChange={(on) => setConfig((c) => ({ ...c, aiBlocked: on ? [...c.aiBlocked, a.token] : c.aiBlocked.filter((x) => x !== a.token) }))}
                  />
                ))}
              </div>
            </fieldset>
            <TextArea label="Sitemap URLs" optional rows={2} hint="One absolute URL per line." value={config.sitemaps} onChange={(e) => setConfig((c) => ({ ...c, sitemaps: e.target.value }))} error={badSitemaps.length ? `Not an absolute URL: ${badSitemaps[0]}` : null} />
          </div>
        </ToolPanel>
        <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          <ToolPanel
            title="robots.txt"
            actions={
              <>
                <CopyBtn text={text} />
                <Btn variant="ghost" icon="download" onClick={() => downloadFile("robots.txt", text)}>
                  Download
                </Btn>
              </>
            }
          >
            <OutputBlock label="Generated robots.txt">
              <code>{text}</code>
            </OutputBlock>
            <p className="mt-2 text-[0.8125rem] text-muted">Upload to the root of the host, e.g. https://example.com/robots.txt. Each subdomain needs its own file.</p>
          </ToolPanel>
          <ToolPanel title="Test a URL">
            <div className="space-y-4">
              <Segmented
                label="Rules to test"
                value={source}
                onChange={setSource}
                options={[
                  { value: "generated", label: "Generated file" },
                  { value: "pasted", label: "Paste a robots.txt" },
                ]}
              />
              {source === "pasted" && <TextArea label="robots.txt to test" mono rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"User-agent: *\nDisallow: /private/"} />}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <TextField label="User-agent token" value={agent} onChange={(e) => setAgent(e.target.value)} list="robots-agents" hint="The crawler's product token, e.g. Googlebot." />
                  <datalist id="robots-agents">
                    {TEST_AGENTS.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>
                <TextField label="URL or path" value={testPath} onChange={(e) => setTestPath(e.target.value)} placeholder="/folder/page?x=1" className="font-mono" />
              </div>
              {result && (
                <div aria-live="polite">
                  <Notice tone={result.allowed ? "success" : "error"} title={result.allowed ? "Allowed" : "Blocked"}>
                    <p>{result.reason}</p>
                    <p className="mt-1 text-[0.8125rem]">Group used: {result.agentGroup.length ? result.agentGroup.join(", ") : "none"}.</p>
                  </Notice>
                </div>
              )}
              {parsed.warnings.length > 0 && (
                <Notice tone="warning">
                  <ul className="list-disc space-y-1 pl-4">
                    {parsed.warnings.slice(0, 6).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              <p className="text-[0.8125rem] text-muted">
                Uses Google’s matching rules: the most specific user-agent group applies (otherwise *), the longest matching path wins, Allow wins a tie, * matches anything and $ marks the end. Google-only behavior such as Googlebot-Image falling back to Googlebot rules is not modeled.
              </p>
            </div>
          </ToolPanel>
        </div>
      </div>
      <PrivacyNote />
    </div>
  );
}
