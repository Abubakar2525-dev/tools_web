"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, TextField, ToolPanel, downloadFile, parseNum } from "@/components/tools/kit";
import { COMMON_TLDS, DEFAULT_PREFIXES, DEFAULT_SUFFIXES, generateIdeas, shuffle, type DomainStyle } from "./lib/domains";

const STYLE_LABELS: { value: DomainStyle; label: string; hint: string }[] = [
  { value: "plain", label: "Keyword alone", hint: "cloud" },
  { value: "prefix", label: "Prefix + keyword", hint: "getcloud" },
  { value: "suffix", label: "Keyword + suffix", hint: "cloudhq" },
  { value: "combo", label: "Two keywords", hint: "cloudnest" },
  { value: "blend", label: "Blends", hint: "smart + artist → smartist" },
  { value: "short", label: "Dropped vowel", hint: "builder → buildr" },
];

const list = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);

type Order = "length" | "alpha" | "shuffle";

export default function Tool() {
  const [keywords, setKeywords] = useState("");
  const [prefixes, setPrefixes] = useState(DEFAULT_PREFIXES.join(", "));
  const [suffixes, setSuffixes] = useState(DEFAULT_SUFFIXES.join(", "));
  const [styles, setStyles] = useState<Set<DomainStyle>>(new Set(["plain", "prefix", "suffix", "combo", "blend"]));
  const [tlds, setTlds] = useState<Set<string>>(new Set([".com", ".io", ".co"]));
  const [hyphen, setHyphen] = useState(false);
  const [maxLen, setMaxLen] = useState("15");
  const [order, setOrder] = useState<Order>("length");
  const [seed, setSeed] = useState(1);
  const dk = useDeferredValue(keywords);

  const max = parseNum(maxLen);
  const maxBad = max === null || max < 2 || max > 63 || !Number.isInteger(max);

  const domains = useMemo(() => {
    if (maxBad) return [];
    const ideas = generateIdeas(list(dk), { prefixes: list(prefixes), suffixes: list(suffixes), styles, hyphen, maxLength: max ?? 15 });
    let sorted = ideas;
    if (order === "length") sorted = [...ideas].sort((a, b) => a.label.length - b.label.length || a.label.localeCompare(b.label));
    else if (order === "alpha") sorted = [...ideas].sort((a, b) => a.label.localeCompare(b.label));
    else sorted = shuffle(ideas, seed);
    const tl = [...tlds];
    return sorted.flatMap((i) => tl.map((t) => ({ domain: `${i.label}${t}`, style: i.style })));
  }, [dk, prefixes, suffixes, styles, hyphen, max, maxBad, order, seed, tlds]);

  const shown = domains.slice(0, 600);
  const text = shown.map((d) => d.domain).join("\n");
  const toggle = <T,>(set: Set<T>, v: T, on: boolean) => {
    const n = new Set(set);
    if (on) n.add(v);
    else n.delete(v);
    return n;
  };

  return (
    <div className="space-y-5">
      <Notice tone="warning" title="Availability is not checked">
        These are ideas only. Checking whether a domain is registered needs a WHOIS or registry lookup over the internet, which this tool never does. Confirm with a registrar before you rely on a name.
      </Notice>
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title="Inputs"
          actions={
            <ResetBtn
              onClick={() => {
                setKeywords("");
                setPrefixes(DEFAULT_PREFIXES.join(", "));
                setSuffixes(DEFAULT_SUFFIXES.join(", "));
              }}
            />
          }
        >
          <div className="space-y-4">
            <TextField label="Keywords" placeholder="cloud, nest, data" hint="Two or more words give combinations and blends. Accents are transliterated." value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            <TextField label="Prefixes" value={prefixes} onChange={(e) => setPrefixes(e.target.value)} />
            <TextField label="Suffixes" value={suffixes} onChange={(e) => setSuffixes(e.target.value)} />
            <fieldset>
              <legend className="text-sm font-medium text-ink">Patterns</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {STYLE_LABELS.map((s) => (
                  <Checkbox key={s.value} label={s.label} hint={s.hint} checked={styles.has(s.value)} onChange={(on) => setStyles((p) => toggle(p, s.value, on))} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Extensions</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {COMMON_TLDS.map((t) => (
                  <Checkbox key={t} label={t} checked={tlds.has(t)} onChange={(on) => setTlds((p) => toggle(p, t, on))} />
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Maximum name length" inputMode="numeric" value={maxLen} onChange={(e) => setMaxLen(e.target.value)} error={maxBad ? "Enter a whole number from 2 to 63." : null} hint="Without the extension." />
              <div className="pt-7">
                <Checkbox label="Join words with hyphens" checked={hyphen} onChange={setHyphen} />
              </div>
            </div>
          </div>
        </ToolPanel>
        <ToolPanel
          title={`Ideas (${domains.length.toLocaleString()})`}
          actions={
            <>
              <CopyBtn text={text} label="Copy list" />
              <Btn variant="ghost" icon="download" disabled={!shown.length} onClick={() => downloadFile("domain-ideas.txt", text + "\n")}>
                .txt
              </Btn>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="Order"
                value={order}
                onChange={setOrder}
                options={[
                  { value: "length", label: "Shortest" },
                  { value: "alpha", label: "A to Z" },
                  { value: "shuffle", label: "Shuffled" },
                ]}
              />
              {order === "shuffle" && (
                <Btn variant="subtle" icon="swap" onClick={() => setSeed((s) => s + 1)}>
                  Shuffle again
                </Btn>
              )}
            </div>
            {!list(dk).length ? (
              <EmptyState icon="globe" title="Add a keyword">
                Ideas appear here as you type.
              </EmptyState>
            ) : !tlds.size ? (
              <Notice tone="error">Choose at least one extension.</Notice>
            ) : !shown.length ? (
              <p className="text-sm text-muted">No names fit. Raise the maximum length or enable more patterns.</p>
            ) : (
              <>
                <ul className="grid max-h-[560px] gap-1 overflow-auto sm:grid-cols-2" aria-label="Domain ideas">
                  {shown.map((d) => (
                    <li key={d.domain} className="flex items-center justify-between gap-2 rounded-md bg-sunken px-3 py-2">
                      <span className="min-w-0 break-all font-mono text-[0.9rem] text-ink">{d.domain}</span>
                      <span className="shrink-0 text-[0.75rem] text-muted">{d.domain.split(".")[0].length} ch</span>
                    </li>
                  ))}
                </ul>
                {domains.length > shown.length && <p className="text-[0.8125rem] text-muted">Showing the first {shown.length} of {domains.length.toLocaleString()}.</p>}
              </>
            )}
          </div>
        </ToolPanel>
      </div>
      <PrivacyNote />
    </div>
  );
}
