/**
 * QR payload builders (Wi-Fi, email, phone, SMS, vCard 3.0), color contrast,
 * bulk list/CSV parsing and scan-result classification. Pure TypeScript.
 */
import { parseHex, type Rgb } from "./encoders";

/* ------------------------------------------------------------------ */
/* Payloads                                                            */
/* ------------------------------------------------------------------ */

/** Escapes \ ; , : and " with a backslash, as the Wi-Fi QR convention requires. */
export const escapeWifi = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");

export type WifiAuth = "WPA" | "WEP" | "nopass";

export function wifiPayload(o: { ssid: string; password: string; auth: WifiAuth; hidden: boolean }) {
  let s = `WIFI:T:${o.auth};S:${escapeWifi(o.ssid)};`;
  if (o.auth !== "nopass") s += `P:${escapeWifi(o.password)};`;
  if (o.hidden) s += "H:true;";
  return s + ";";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mailtoPayload(o: { to: string; subject: string; body: string }) {
  const q: string[] = [];
  if (o.subject) q.push(`subject=${encodeURIComponent(o.subject)}`);
  if (o.body) q.push(`body=${encodeURIComponent(o.body)}`);
  return `mailto:${o.to.trim()}${q.length ? `?${q.join("&")}` : ""}`;
}

/** Normalizes a phone number to digits with an optional leading +. Returns null if invalid. */
export function normalizePhone(raw: string) {
  const t = raw.trim();
  if (!/^\+?[\d\s().-]{3,}$/.test(t)) return null;
  const digits = t.replace(/[^\d]/g, "");
  if (digits.length < 3 || digits.length > 15) return null;
  return (t.startsWith("+") ? "+" : "") + digits;
}

export const telPayload = (phone: string) => `tel:${phone}`;
/** SMSTO:number:message is the form most scanner apps understand. */
export const smsPayload = (phone: string, message: string) => `SMSTO:${phone}:${message}`;

/** Escapes a vCard 3.0 text value (RFC 2426 section 5). */
export const escapeVcard = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export type VCardInput = {
  firstName: string;
  lastName: string;
  org: string;
  title: string;
  mobile: string;
  workPhone: string;
  email: string;
  url: string;
  street: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  note: string;
};

export function vcardPayload(v: VCardInput) {
  const e = escapeVcard;
  const fn = [v.firstName, v.lastName].map((s) => s.trim()).filter(Boolean).join(" ") || v.org.trim();
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${e(v.lastName.trim())};${e(v.firstName.trim())};;;`, `FN:${e(fn)}`];
  if (v.org.trim()) lines.push(`ORG:${e(v.org.trim())}`);
  if (v.title.trim()) lines.push(`TITLE:${e(v.title.trim())}`);
  if (v.mobile.trim()) lines.push(`TEL;TYPE=CELL:${v.mobile.trim()}`);
  if (v.workPhone.trim()) lines.push(`TEL;TYPE=WORK,VOICE:${v.workPhone.trim()}`);
  if (v.email.trim()) lines.push(`EMAIL;TYPE=INTERNET:${v.email.trim()}`);
  if (v.url.trim()) lines.push(`URL:${v.url.trim()}`);
  if ([v.street, v.city, v.region, v.postcode, v.country].some((s) => s.trim()))
    lines.push(`ADR;TYPE=WORK:;;${e(v.street.trim())};${e(v.city.trim())};${e(v.region.trim())};${e(v.postcode.trim())};${e(v.country.trim())}`);
  if (v.note.trim()) lines.push(`NOTE:${e(v.note.trim())}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/* ------------------------------------------------------------------ */
/* Contrast                                                            */
/* ------------------------------------------------------------------ */

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
export const luminance = (c: Rgb) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);

/** WCAG contrast ratio between two hex colors (1..21), or null if either is invalid. */
export function contrastRatio(a: string, b: string) {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return null;
  const la = luminance(x);
  const lb = luminance(y);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Human advice for QR colors. Returns null when the pair is fine. */
export function qrColorWarning(fg: string, bg: string) {
  const r = contrastRatio(fg, bg);
  if (r === null) return "Enter colors as hex values, for example #111111.";
  const f = parseHex(fg);
  const b = parseHex(bg);
  if (f && b && luminance(f) > luminance(b)) return "The code color is lighter than the background. Many scanners cannot read inverted codes; use a dark code on a light background.";
  if (r < 3) return `Contrast is low (${r.toFixed(1)}:1). Aim for at least 4:1 so phone cameras read the code reliably.`;
  if (r < 4) return `Contrast is ${r.toFixed(1)}:1. It may scan, but a darker code color is safer.`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Bulk input                                                          */
/* ------------------------------------------------------------------ */

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += ch;
    } else if (ch === '"' && field === "") q = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type BulkRow = { line: number; name: string; content: string };

/**
 * "lines": one payload per non-empty line, names come from the line number.
 * "csv": name,content per row; extra unquoted commas stay in the content.
 * A first row of exactly "name,content" is treated as a header.
 */
export function parseBulk(text: string, mode: "lines" | "csv"): BulkRow[] {
  if (mode === "lines") {
    return text
      .split(/\r?\n/)
      .map((l, i) => ({ line: i + 1, content: l.trim() }))
      .filter((r) => r.content)
      .map((r) => ({ ...r, name: "" }));
  }
  const rows = parseCsv(text);
  const out: BulkRow[] = [];
  rows.forEach((r, i) => {
    if (i === 0 && r.length >= 2 && r[0].trim().toLowerCase() === "name" && r[1].trim().toLowerCase() === "content") return;
    const name = (r[0] ?? "").trim();
    const content = r.slice(1).join(",").trim();
    out.push({ line: i + 1, name, content });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Scan classification                                                 */
/* ------------------------------------------------------------------ */

export type ScanKind =
  | { kind: "url"; url: string; host: string; warnings: string[] }
  | { kind: "wifi"; ssid: string; password: string; auth: string; hidden: boolean }
  | { kind: "email"; to: string }
  | { kind: "phone"; number: string }
  | { kind: "sms"; number: string; message: string }
  | { kind: "vcard" }
  | { kind: "geo"; lat: number; lon: number }
  | { kind: "scheme"; scheme: string }
  | { kind: "text" };

/** Splits a Wi-Fi field list on unescaped semicolons and unescapes values. */
export function parseWifi(s: string) {
  const body = s.replace(/^WIFI:/i, "");
  const fields: Record<string, string> = {};
  let key = "";
  let val = "";
  let inKey = true;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && i + 1 < body.length) {
      if (inKey) key += body[++i];
      else val += body[++i];
    } else if (inKey && ch === ":") inKey = false;
    else if (ch === ";") {
      if (key) fields[key.toUpperCase()] = val;
      key = "";
      val = "";
      inKey = true;
    } else if (inKey) key += ch;
    else val += ch;
  }
  if (key && !inKey) fields[key.toUpperCase()] = val;
  return { ssid: fields.S ?? "", password: fields.P ?? "", auth: fields.T ?? "nopass", hidden: (fields.H ?? "").toLowerCase() === "true" };
}

/** Points out URL features commonly used to disguise a destination. */
export function urlWarnings(u: URL) {
  const w: string[] = [];
  if (u.protocol === "http:") w.push("The link is not encrypted (http, not https).");
  if (u.username || u.password) w.push("The link contains text before an @ sign; the real site is the part after it.");
  if (/(^|\.)xn--/i.test(u.hostname)) w.push("The domain uses international characters (punycode), which can imitate another site's name.");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname) || u.hostname.startsWith("[")) w.push("The link points to a raw IP address instead of a domain name.");
  return w;
}

export function classifyScan(text: string): ScanKind {
  const t = text.trim();
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      return { kind: "url", url: u.href, host: u.hostname, warnings: urlWarnings(u) };
    } catch {
      return { kind: "text" };
    }
  }
  if (/^WIFI:/i.test(t)) return { kind: "wifi", ...parseWifi(t) };
  if (/^mailto:/i.test(t)) return { kind: "email", to: decodeURIComponent(t.slice(7).split("?")[0]) };
  if (/^tel:/i.test(t)) return { kind: "phone", number: t.slice(4) };
  if (/^SMSTO:/i.test(t)) {
    const [, num = "", ...msg] = t.split(":");
    return { kind: "sms", number: num, message: msg.join(":") };
  }
  if (/^BEGIN:VCARD/i.test(t)) return { kind: "vcard" };
  const geo = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i.exec(t);
  if (geo) return { kind: "geo", lat: Number(geo[1]), lon: Number(geo[2]) };
  const scheme = /^([a-z][a-z0-9+.-]{1,20}):/i.exec(t);
  if (scheme && !/\s/.test(t)) return { kind: "scheme", scheme: scheme[1].toLowerCase() };
  return { kind: "text" };
}
