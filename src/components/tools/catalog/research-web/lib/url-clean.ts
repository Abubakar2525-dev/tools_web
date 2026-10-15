/**
 * URL tracking cleaner: removes known tracking parameters and unwraps redirect
 * wrappers (Google, Facebook, Instagram, YouTube, LinkedIn, Outlook Safe
 * Links, Proofpoint URL Defense and others). Our own curated list.
 */

export interface TrackingRule {
  /** Exact parameter name (lowercase) or prefix ending in "*". */
  name: string;
  source: string;
  /** Only applies on these host suffixes (e.g. "youtube.com"). */
  hosts?: string[];
  /** Off by default (affiliate tags support creators; some users want to keep them). */
  optional?: boolean;
}

export const TRACKING_RULES: TrackingRule[] = [
  { name: "utm_*", source: "Google Analytics / UTM campaign tags" },
  { name: "_ga", source: "Google Analytics cross-domain linker" },
  { name: "_gl", source: "Google Analytics cross-domain linker" },
  { name: "gclid", source: "Google Ads click ID" },
  { name: "gclsrc", source: "Google Ads click source" },
  { name: "dclid", source: "Google Display click ID" },
  { name: "gbraid", source: "Google Ads (iOS) click ID" },
  { name: "wbraid", source: "Google Ads (web-to-app) click ID" },
  { name: "srsltid", source: "Google Merchant listing ID" },
  { name: "fbclid", source: "Facebook click ID" },
  { name: "igshid", source: "Instagram share ID" },
  { name: "igsh", source: "Instagram share ID" },
  { name: "msclkid", source: "Microsoft Ads click ID" },
  { name: "twclid", source: "X (Twitter) Ads click ID" },
  { name: "ttclid", source: "TikTok Ads click ID" },
  { name: "li_fat_id", source: "LinkedIn first-party ad tracking" },
  { name: "yclid", source: "Yandex Ads click ID" },
  { name: "mc_cid", source: "Mailchimp campaign ID" },
  { name: "mc_eid", source: "Mailchimp subscriber ID" },
  { name: "_hsenc", source: "HubSpot email tracking" },
  { name: "_hsmi", source: "HubSpot email tracking" },
  { name: "__hstc", source: "HubSpot visitor tracking" },
  { name: "__hssc", source: "HubSpot session tracking" },
  { name: "__hsfp", source: "HubSpot fingerprint" },
  { name: "hsctatracking", source: "HubSpot CTA tracking" },
  { name: "mkt_tok", source: "Marketo email tracking" },
  { name: "oly_anon_id", source: "Omeda tracking" },
  { name: "oly_enc_id", source: "Omeda tracking" },
  { name: "vero_id", source: "Vero email tracking" },
  { name: "vero_conv", source: "Vero email tracking" },
  { name: "rb_clickid", source: "Rakuten click ID" },
  { name: "s_cid", source: "Adobe Analytics campaign ID" },
  { name: "ef_id", source: "Adobe Advertising click ID" },
  { name: "pk_*", source: "Matomo / Piwik campaign tags" },
  { name: "mtm_*", source: "Matomo campaign tags" },
  { name: "piwik_*", source: "Piwik campaign tags" },
  { name: "wickedid", source: "Wicked Reports click ID" },
  { name: "irclickid", source: "Impact affiliate click ID" },
  { name: "cvid", source: "Microsoft Bing conversation ID", hosts: ["bing.com", "msn.com"] },
  { name: "ocid", source: "Microsoft referral ID", hosts: ["bing.com", "msn.com", "microsoft.com"] },
  { name: "si", source: "Share tracking ID", hosts: ["youtube.com", "youtu.be", "spotify.com"] },
  { name: "feature", source: "YouTube share source", hosts: ["youtube.com", "youtu.be"] },
  { name: "pp", source: "YouTube search tracking", hosts: ["youtube.com"] },
  { name: "ref_src", source: "X (Twitter) referral", hosts: ["twitter.com", "x.com"] },
  { name: "ref_url", source: "X (Twitter) referral", hosts: ["twitter.com", "x.com"] },
  { name: "s", source: "X (Twitter) share client", hosts: ["twitter.com", "x.com"] },
  { name: "t", source: "X (Twitter) share token", hosts: ["twitter.com", "x.com"] },
  { name: "trk", source: "LinkedIn tracking", hosts: ["linkedin.com"] },
  { name: "trackingid", source: "LinkedIn tracking", hosts: ["linkedin.com"] },
  { name: "lipi", source: "LinkedIn page instance", hosts: ["linkedin.com"] },
  { name: "rcm", source: "LinkedIn recommendation tracking", hosts: ["linkedin.com"] },
  { name: "spm", source: "Alibaba/AliExpress tracking", hosts: ["aliexpress.com", "alibaba.com", "taobao.com", "tmall.com"] },
  { name: "scm", source: "Alibaba/AliExpress tracking", hosts: ["aliexpress.com", "alibaba.com", "taobao.com", "tmall.com"] },
  { name: "pf_rd_*", source: "Amazon page tracking", hosts: ["amazon."] },
  { name: "pd_rd_*", source: "Amazon page tracking", hosts: ["amazon."] },
  { name: "ref_", source: "Amazon referral", hosts: ["amazon."] },
  { name: "ref", source: "Amazon referral", hosts: ["amazon."] },
  { name: "_encoding", source: "Amazon encoding marker", hosts: ["amazon."] },
  { name: "psc", source: "Amazon variant selection marker", hosts: ["amazon."] },
  { name: "content-id", source: "Amazon content tracking", hosts: ["amazon."] },
  { name: "crid", source: "Amazon search tracking", hosts: ["amazon."] },
  { name: "sprefix", source: "Amazon search tracking", hosts: ["amazon."] },
  { name: "qid", source: "Amazon search timestamp", hosts: ["amazon."] },
  { name: "sr", source: "Amazon search rank", hosts: ["amazon."] },
  { name: "dib", source: "Amazon search tracking", hosts: ["amazon."] },
  { name: "dib_tag", source: "Amazon search tracking", hosts: ["amazon."] },
  { name: "tag", source: "Amazon affiliate tag", hosts: ["amazon."], optional: true },
  { name: "linkcode", source: "Amazon affiliate link code", hosts: ["amazon."], optional: true },
  { name: "linkid", source: "Amazon affiliate link ID", hosts: ["amazon."], optional: true },
  { name: "ascsubtag", source: "Amazon affiliate sub-tag", hosts: ["amazon."], optional: true },
  { name: "aff_id", source: "Affiliate ID", optional: true },
  { name: "affiliate_id", source: "Affiliate ID", optional: true },
];

function hostMatches(host: string, suffixes: string[]): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return suffixes.some((s) => (s.endsWith(".") ? h.startsWith(s) || h.includes(`.${s}`) : h === s || h.endsWith(`.${s}`)));
}

export function matchRule(param: string, host: string, opts: { affiliate: boolean; extra: string[] }): TrackingRule | null {
  const p = param.toLowerCase();
  for (const r of TRACKING_RULES) {
    if (r.optional && !opts.affiliate) continue;
    if (r.hosts && !hostMatches(host, r.hosts)) continue;
    if (r.name.endsWith("*") ? p.startsWith(r.name.slice(0, -1)) : p === r.name) return r;
  }
  for (const e of opts.extra) {
    const x = e.trim().toLowerCase();
    if (!x) continue;
    if (x.endsWith("*") ? p.startsWith(x.slice(0, -1)) : p === x) return { name: x, source: "Your custom list" };
  }
  return null;
}

/* ------------------------------ Unwrapping ------------------------------ */

interface Wrapper {
  label: string;
  test: (u: URL) => boolean;
  extract: (u: URL) => string | null;
}

const isHost = (u: URL, ...hosts: string[]) => hostMatches(u.hostname, hosts);
const param = (u: URL, ...names: string[]) => {
  for (const n of names) {
    const v = u.searchParams.get(n);
    if (v) return v;
  }
  return null;
};

/** Proofpoint URL Defense v2: "-" stands for "%" and "_" for "/". */
function proofpointV2(u: string) {
  return decodeSafe(u.replace(/-/g, "%").replace(/_/g, "/"));
}

function decodeSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export const WRAPPERS: Wrapper[] = [
  { label: "Google redirect", test: (u) => /(^|\.)google\.[a-z.]+$/i.test(u.hostname) && u.pathname === "/url", extract: (u) => param(u, "q", "url") },
  {
    label: "Google AMP viewer",
    test: (u) => /(^|\.)google\.[a-z.]+$/i.test(u.hostname) && u.pathname.startsWith("/amp/"),
    extract: (u) => {
      const rest = u.pathname.replace(/^\/amp\/(s\/)?/, "");
      return rest ? `${u.pathname.startsWith("/amp/s/") ? "https" : "http"}://${decodeSafe(rest)}${u.search}` : null;
    },
  },
  { label: "Facebook link shim", test: (u) => isHost(u, "l.facebook.com", "lm.facebook.com", "l.messenger.com") && u.pathname.startsWith("/l.php"), extract: (u) => param(u, "u") },
  { label: "Instagram link shim", test: (u) => isHost(u, "l.instagram.com"), extract: (u) => param(u, "u") },
  { label: "Threads link shim", test: (u) => isHost(u, "l.threads.net", "l.threads.com"), extract: (u) => param(u, "u") },
  { label: "YouTube redirect", test: (u) => isHost(u, "youtube.com") && u.pathname === "/redirect", extract: (u) => param(u, "q") },
  { label: "LinkedIn redirect", test: (u) => isHost(u, "linkedin.com") && u.pathname.startsWith("/redir/"), extract: (u) => param(u, "url") },
  { label: "Reddit outbound link", test: (u) => isHost(u, "out.reddit.com"), extract: (u) => param(u, "url") },
  { label: "Slack redirect", test: (u) => isHost(u, "slack-redir.net"), extract: (u) => param(u, "url") },
  { label: "Outlook Safe Links", test: (u) => /safelinks\.protection\.outlook\.com$/i.test(u.hostname), extract: (u) => param(u, "url") },
  {
    label: "Proofpoint URL Defense",
    test: (u) => isHost(u, "urldefense.proofpoint.com", "urldefense.com"),
    extract: (u) => {
      if (u.pathname.startsWith("/v2/")) {
        const v = param(u, "u");
        return v ? proofpointV2(v) : null;
      }
      const m = /\/v3\/__(.+?)__;/.exec(u.pathname + u.search + u.hash);
      return m ? m[1] : null;
    },
  },
  { label: "VK away link", test: (u) => isHost(u, "vk.com") && u.pathname === "/away.php", extract: (u) => param(u, "to") },
  { label: "Steam link filter", test: (u) => isHost(u, "steamcommunity.com") && u.pathname.startsWith("/linkfilter"), extract: (u) => param(u, "url", "u") },
  {
    label: "Disqus redirect",
    test: (u) => isHost(u, "disq.us") && u.pathname === "/url",
    extract: (u) => {
      const v = param(u, "url");
      return v ? v.replace(/:[A-Za-z0-9_-]{20,}$/, "") : null;
    },
  },
  { label: "Skimlinks redirect", test: (u) => isHost(u, "go.skimresources.com", "go.redirectingat.com"), extract: (u) => param(u, "url") },
];

export interface CleanResult {
  input: string;
  output: string;
  removed: { name: string; source: string }[];
  unwrapped: string[];
  error?: string;
  changed: boolean;
}

export interface CleanOptions {
  affiliate: boolean;
  extra: string[];
  stripHashTracking: boolean;
}

export function cleanUrl(raw: string, opts: CleanOptions): CleanResult {
  const input = raw.trim();
  const res: CleanResult = { input, output: input, removed: [], unwrapped: [], changed: false };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`);
  } catch {
    return { ...res, error: "Not a valid URL." };
  }
  if (!/^https?:$/.test(url.protocol)) return { ...res, error: "Only http and https links are cleaned." };

  for (let depth = 0; depth < 6; depth++) {
    const w = WRAPPERS.find((x) => x.test(url));
    if (!w) break;
    const target = w.extract(url);
    if (!target) break;
    try {
      const next = new URL(target);
      if (!/^https?:$/.test(next.protocol)) break;
      url = next;
      res.unwrapped.push(w.label);
    } catch {
      break;
    }
  }

  // Work on the raw query so kept parameters keep their original encoding.
  const keep: string[] = [];
  for (const part of url.search.replace(/^\?/, "").split("&")) {
    if (!part) continue;
    const k = decodeSafe(part.split("=")[0].replace(/\+/g, " "));
    const r = matchRule(k, url.hostname, opts);
    if (r) res.removed.push({ name: k, source: r.source });
    else keep.push(part);
  }
  if (res.removed.length) url.search = keep.length ? `?${keep.join("&")}` : "";
  // Amazon puts "/ref=..." path segments in product links.
  if (hostMatches(url.hostname, ["amazon."]) && /\/ref=[^/]*$/.test(url.pathname)) {
    res.removed.push({ name: url.pathname.match(/ref=[^/]*$/)?.[0] ?? "ref", source: "Amazon referral path segment" });
    url.pathname = url.pathname.replace(/\/ref=[^/]*$/, "");
  }
  if (opts.stripHashTracking && /^#(:~:text=|xtor=|utm_)/i.test(url.hash)) {
    res.removed.push({ name: url.hash.slice(0, 20), source: "Tracking or text-fragment hash" });
    url.hash = "";
  }
  let out = url.toString();
  if (!keep.length && out.includes("?")) out = out.replace(/\?(?=#|$)/, "");
  res.output = out;
  res.changed = out !== input;
  return res;
}

/** Finds URL-like tokens in free text (one per line or mixed with prose). */
export function extractUrls(text: string): string[] {
  const found = text.match(/\bhttps?:\/\/[^\s<>"'`]+|\bwww\.[^\s<>"'`]+/gi) ?? [];
  return found.map((u) => u.replace(/[),.;:!?\]]+$/, ""));
}
