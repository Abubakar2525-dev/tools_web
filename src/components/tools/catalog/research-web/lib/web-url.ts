/** URL encoding, parsing and UTM helpers (WHATWG URL + RFC 3986 percent-encoding, UTF-8). */

/* ------------------------------ Encoding ------------------------------ */

export type EncodeMode = "component" | "uri" | "decode";

export function encodeText(s: string, mode: "component" | "uri", plusForSpace: boolean): string {
  const out = mode === "component" ? encodeURIComponent(s) : encodeURI(s);
  return plusForSpace ? out.replace(/%20/g, "+") : out;
}

export function decodeText(s: string, plusAsSpace: boolean): string {
  const input = plusAsSpace ? s.replace(/\+/g, " ") : s;
  try {
    return decodeURIComponent(input);
  } catch {
    // Locate the first bad escape for a helpful message.
    const bad = /%(?![0-9a-f]{2})|%[0-9a-f]{2}/gi;
    let m: RegExpExecArray | null;
    while ((m = bad.exec(input))) {
      if (!/^%[0-9a-f]{2}$/i.test(m[0])) throw new Error(`Malformed escape “${input.slice(m.index, m.index + 3)}” at position ${m.index + 1}. A % must be followed by two hex digits.`);
    }
    throw new Error("The percent-escapes do not form valid UTF-8 (for example a lone %C3 without its second byte).");
  }
}

/* ------------------------------ Parsing ------------------------------ */

export interface QueryParam {
  key: string;
  value: string;
  rawKey: string;
  rawValue: string;
}

export interface ParsedUrl {
  href: string;
  assumedScheme: boolean;
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  port: string;
  defaultPort: string;
  host: string;
  origin: string;
  pathname: string;
  pathSegments: string[];
  search: string;
  params: QueryParam[];
  hash: string;
  tld: string;
}

const DEFAULT_PORTS: Record<string, string> = { "http:": "80", "https:": "443", "ftp:": "21", "ws:": "80", "wss:": "443" };

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
};

export function parseUrl(input: string): ParsedUrl {
  const s = input.trim();
  if (!s) throw new Error("Enter a URL.");
  let assumedScheme = false;
  let u: URL;
  // "example.com:8080/x" would otherwise parse with "example.com:" as the scheme.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && /^([\w-]+\.)+[a-z]{2,}(:\d+)?([/?#]|$)|^localhost(:\d+)?([/?#]|$)/i.test(s)) {
    u = new URL(`https://${s}`);
    assumedScheme = true;
  } else {
    try {
      u = new URL(s);
    } catch {
      throw new Error("This is not a valid absolute URL. Include the scheme, for example https://example.com/page.");
    }
  }
  const params: QueryParam[] = u.search
    .replace(/^\?/, "")
    .split("&")
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      const rawKey = eq < 0 ? part : part.slice(0, eq);
      const rawValue = eq < 0 ? "" : part.slice(eq + 1);
      return { key: safeDecode(rawKey), value: safeDecode(rawValue), rawKey, rawValue };
    });
  const labels = u.hostname.split(".");
  return {
    href: u.href,
    assumedScheme,
    protocol: u.protocol,
    username: safeDecode(u.username),
    password: safeDecode(u.password),
    hostname: u.hostname,
    port: u.port,
    defaultPort: DEFAULT_PORTS[u.protocol] ?? "",
    host: u.host,
    origin: u.origin,
    pathname: u.pathname,
    pathSegments: u.pathname.split("/").filter(Boolean).map(safeDecode),
    search: u.search,
    params,
    hash: u.hash,
    tld: labels.length > 1 && !/^\d+$/.test(labels[labels.length - 1]) ? labels[labels.length - 1] : "",
  };
}

/* ------------------------------ UTM ------------------------------ */

export const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"] as const;
export type UtmField = (typeof UTM_FIELDS)[number];
export type UtmValues = Record<UtmField, string>;

export interface UtmOptions {
  lowercase: boolean;
  spaces: "-" | "_" | "%20" | "+";
}

export function normalizeUtmValue(v: string, o: UtmOptions): string {
  let s = v.trim().replace(/\s+/g, " ");
  if (o.lowercase) s = s.toLowerCase();
  if (o.spaces === "-" || o.spaces === "_") s = s.replace(/ /g, o.spaces);
  return s;
}

export function buildUtmUrl(base: string, values: UtmValues, o: UtmOptions): { url: string; error?: string; warnings: string[] } {
  const warnings: string[] = [];
  let u: URL;
  const b = base.trim();
  if (!b) return { url: "", error: "Enter the page URL.", warnings };
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(b) ? b : `https://${b}`);
  } catch {
    return { url: "", error: "This is not a valid URL.", warnings };
  }
  if (!/^https?:$/.test(u.protocol)) return { url: "", error: "Use an http or https URL.", warnings };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(b)) warnings.push("No scheme given, so https:// was added.");
  if (!values.utm_source.trim()) return { url: "", error: "Campaign source (utm_source) is required.", warnings };
  if (!values.utm_medium.trim()) warnings.push("Add a medium (utm_medium). Analytics tools group traffic into channels by it.");
  if (!values.utm_campaign.trim() && !values.utm_id.trim()) warnings.push("Add a campaign name or ID so the visits can be told apart.");
  // Keep the existing query, but drop any UTM parameters we are about to set.
  const kept = u.search
    .replace(/^\?/, "")
    .split("&")
    .filter((p) => p && !UTM_FIELDS.includes(safeDecode(p.split("=")[0]).toLowerCase() as UtmField));
  const added: string[] = [];
  for (const f of UTM_FIELDS) {
    const v = normalizeUtmValue(values[f], o);
    if (!v) continue;
    let enc = encodeURIComponent(v);
    if (o.spaces === "+") enc = enc.replace(/%20/g, "+");
    added.push(`${f}=${enc}`);
    if (/[A-Z]/.test(v)) warnings.push(`${f} contains capitals. Many analytics tools treat “Email” and “email” as different values.`);
  }
  const query = [...kept, ...added].join("&");
  const hash = u.hash;
  u.hash = "";
  u.search = "";
  return { url: `${u.toString()}${query ? `?${query}` : ""}${hash}`, warnings: [...new Set(warnings)] };
}
