/**
 * Small MIME (RFC 5322 / 2045-2047 / 2231) parser for .eml files.
 * Handles folded headers, encoded words, multipart/* trees, base64,
 * quoted-printable and charsets (via TextDecoder). Pure: no DOM access.
 */

export type Header = { name: string; value: string };

export type MimePart = {
  headers: Header[];
  type: string;
  params: Record<string, string>;
  disposition: string;
  dispParams: Record<string, string>;
  /** Decoded body bytes (after transfer decoding). Empty for multipart containers. */
  body: Uint8Array;
  children: MimePart[];
};

export type Attachment = { name: string; size: number; type: string; inline: boolean };

export type ParsedEmail = {
  headers: Header[];
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  /** Plain-text body (from text/plain, or converted from HTML). */
  text: string;
  bodySource: "plain" | "html" | "none";
  attachments: Attachment[];
};

/* ------------------------------------------------------------------ */
/* Bytes and charsets                                                  */
/* ------------------------------------------------------------------ */

/** Bytes to a "binary string" (one char per byte) so structure parsing never corrupts data. */
export function bytesToBinary(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return s;
}

export function binaryToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

const CHARSET_ALIASES: Record<string, string> = { "us-ascii": "utf-8", ascii: "utf-8", "x-unknown": "utf-8", "unicode-1-1-utf-8": "utf-8" };

export function decodeCharset(bytes: Uint8Array, charset = "utf-8"): string {
  const cs = (charset || "utf-8").trim().toLowerCase().replace(/^"|"$/g, "");
  const label = CHARSET_ALIASES[cs] ?? cs;
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("windows-1252").decode(bytes);
    }
  }
}

/** Header text that arrived as raw 8-bit bytes: try UTF-8, fall back to Windows-1252. */
function decodeRawHeader(bin: string): string {
  if (!/[\x80-\xff]/.test(bin)) return bin;
  const bytes = binaryToBytes(bin);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/* ------------------------------------------------------------------ */
/* Transfer encodings                                                  */
/* ------------------------------------------------------------------ */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  t["-".charCodeAt(0)] = 62;
  t["_".charCodeAt(0)] = 63;
  return t;
})();

/** Lenient base64 decoder: ignores whitespace and junk, tolerates missing padding. */
export function decodeBase64(s: string): Uint8Array {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 61) break; // "="
    const v = c < 256 ? B64_LOOKUP[c] : -1;
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/** Quoted-printable (RFC 2045). `header` mode also turns "_" into a space (RFC 2047 "Q"). */
export function decodeQuotedPrintable(s: string, header = false): Uint8Array {
  const out: number[] = [];
  const src = header ? s.replace(/_/g, " ") : s.replace(/[ \t]+(\r?\n)/g, "$1");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "=") {
      const next2 = src.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(next2)) {
        out.push(parseInt(next2, 16));
        i += 2;
        continue;
      }
      // Soft line break.
      if (src[i + 1] === "\r" && src[i + 2] === "\n") {
        i += 2;
        continue;
      }
      if (src[i + 1] === "\n") {
        i += 1;
        continue;
      }
    }
    out.push(src.charCodeAt(i) & 0xff);
  }
  return Uint8Array.from(out);
}

/* ------------------------------------------------------------------ */
/* Headers                                                             */
/* ------------------------------------------------------------------ */

/** Decodes RFC 2047 encoded words; whitespace between adjacent encoded words is dropped. */
export function decodeEncodedWords(value: string): string {
  const re = /=\?([^?\s]+)\?([BbQq])\?([^?]*)\?=/g;
  let out = "";
  let last = 0;
  let prevWasWord = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    const between = value.slice(last, m.index);
    if (!(prevWasWord && /^\s*$/.test(between))) out += decodeRawHeader(between);
    const charset = m[1].split("*")[0];
    const bytes = m[2].toUpperCase() === "B" ? decodeBase64(m[3]) : decodeQuotedPrintable(m[3], true);
    out += decodeCharset(bytes, charset);
    last = re.lastIndex;
    prevWasWord = true;
  }
  out += decodeRawHeader(value.slice(last));
  return out;
}

/** Splits a header block into unfolded name/value pairs (values still raw). */
export function parseHeaderBlock(block: string): Header[] {
  const headers: Header[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && headers.length) headers[headers.length - 1].value += " " + line.trim();
    else {
      const i = line.indexOf(":");
      if (i > 0) headers.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
    }
  }
  return headers;
}

const getHeader = (hs: Header[], name: string) => hs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

/** Parses `type/subtype; a=b; c="d"` including RFC 2231 continuations and charsets. */
export function parseStructured(value: string): { value: string; params: Record<string, string> } {
  const parts: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '"' && value[i - 1] !== "\\") q = !q;
    if (ch === ";" && !q) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  const main = (parts.shift() ?? "").trim().toLowerCase();
  const raw: Record<string, string> = {};
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i < 0) continue;
    const k = p.slice(0, i).trim().toLowerCase();
    let v = p.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\(.)/g, "$1");
    raw[k] = v;
  }
  const params: Record<string, string> = {};
  const continued = new Map<string, { idx: number; v: string; enc: boolean }[]>();
  for (const [k, v] of Object.entries(raw)) {
    const m = /^([^*]+)\*(\d+)?(\*)?$/.exec(k);
    if (!m) {
      params[k] = decodeEncodedWords(v);
      continue;
    }
    const base = m[1];
    const list = continued.get(base) ?? [];
    list.push({ idx: m[2] ? Number(m[2]) : 0, v, enc: Boolean(m[3]) || (!m[2] && k.endsWith("*")) });
    continued.set(base, list);
  }
  for (const [base, list] of continued) {
    list.sort((a, b) => a.idx - b.idx);
    let charset = "utf-8";
    let bin = "";
    list.forEach((seg, n) => {
      let v = seg.v;
      if (seg.enc && n === 0) {
        const m = /^([^']*)'[^']*'(.*)$/.exec(v);
        if (m) {
          charset = m[1] || "utf-8";
          v = m[2];
        }
      }
      bin += seg.enc ? v.replace(/%([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))) : v;
    });
    params[base] = decodeCharset(binaryToBytes(bin), charset);
  }
  return { value: main, params };
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

function splitHeadBody(bin: string): [string, string] {
  const m = /\r?\n\r?\n/.exec(bin);
  if (!m) return [bin, ""];
  return [bin.slice(0, m.index), bin.slice(m.index + m[0].length)];
}

function decodeTransfer(body: string, encoding: string): Uint8Array {
  const enc = encoding.trim().toLowerCase();
  if (enc === "base64") return decodeBase64(body);
  if (enc === "quoted-printable") return decodeQuotedPrintable(body);
  return binaryToBytes(body);
}

export function parsePart(bin: string, depth = 0, defaultType = "text/plain"): MimePart {
  const [head, body] = splitHeadBody(bin);
  const headers = parseHeaderBlock(head);
  const ct = parseStructured(getHeader(headers, "content-type") || defaultType);
  const cd = parseStructured(getHeader(headers, "content-disposition"));
  const part: MimePart = {
    headers,
    type: ct.value || defaultType,
    params: ct.params,
    disposition: cd.value,
    dispParams: cd.params,
    body: new Uint8Array(0),
    children: [],
  };
  const boundary = ct.params.boundary;
  if (part.type.startsWith("multipart/") && boundary && depth < 20) {
    const childDefault = part.type === "multipart/digest" ? "message/rfc822" : "text/plain";
    const esc = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|\\r?\\n)--${esc}(--)?[ \\t]*(?=\\r?\\n|$)`, "g");
    const marks: { start: number; end: number; close: boolean }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) marks.push({ start: m.index, end: re.lastIndex, close: Boolean(m[1]) });
    for (let i = 0; i < marks.length; i++) {
      if (marks[i].close) break;
      const from = marks[i].end;
      const to = i + 1 < marks.length ? marks[i + 1].start : body.length;
      const chunk = body.slice(from, to).replace(/^\r?\n/, "");
      part.children.push(parsePart(chunk, depth + 1, childDefault));
    }
  } else {
    part.body = decodeTransfer(body, getHeader(headers, "content-transfer-encoding"));
  }
  return part;
}

export const partText = (p: MimePart) => decodeCharset(p.body, p.params.charset);

const fileNameOf = (p: MimePart) => p.dispParams.filename || p.params.name || "";

/* ------------------------------------------------------------------ */
/* HTML to text (fallback without DOM)                                 */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", euro: "€" };

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Regex-based HTML to text, used when no DOMParser is available. */
export function htmlToTextBasic(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/(p|div|h[1-6]|tr|table|ul|ol|blockquote|section|article)>/gi, "\n\n")
      .replace(/<\/t[dh]>/gi, "\t")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

export function parseEml(bytes: Uint8Array, htmlToText: (html: string) => string = htmlToTextBasic): ParsedEmail {
  let bin = bytesToBinary(bytes);
  // Strip a leading mbox "From " line if present.
  if (/^From [^\r\n]*\r?\n/.test(bin) && !/^From:/i.test(bin)) bin = bin.replace(/^From [^\r\n]*\r?\n/, "");
  const root = parsePart(bin);
  const h = (n: string) => decodeEncodedWords(getHeader(root.headers, n));

  let plain: string | null = null;
  let html: string | null = null;
  const attachments: Attachment[] = [];

  const walk = (p: MimePart) => {
    if (p.type.startsWith("multipart/")) {
      if (p.type === "multipart/alternative") {
        // Take the best alternative only; other alternatives are not attachments.
        const plainAlt = p.children.find((c) => c.type === "text/plain" && c.disposition !== "attachment");
        const htmlAlt = p.children.find((c) => c.type === "text/html" && c.disposition !== "attachment");
        const nested = p.children.filter((c) => c.type.startsWith("multipart/"));
        if (plainAlt && plain === null) plain = partText(plainAlt);
        if (htmlAlt && html === null) html = partText(htmlAlt);
        nested.forEach(walk);
        return;
      }
      p.children.forEach(walk);
      return;
    }
    const name = fileNameOf(p);
    const isText = p.type === "text/plain" || p.type === "text/html";
    if (isText && p.disposition !== "attachment" && !name) {
      if (p.type === "text/plain" && plain === null) plain = partText(p);
      else if (p.type === "text/html" && html === null) html = partText(p);
      else if (p.type === "text/plain" && plain !== null) plain += "\n\n" + partText(p);
      return;
    }
    let display = name;
    if (!display && p.type === "message/rfc822") {
      const inner = parsePart(bytesToBinary(p.body));
      const subj = decodeEncodedWords(getHeader(inner.headers, "subject"));
      display = `${subj || "Attached message"}.eml`;
    }
    attachments.push({
      name: display || `Unnamed ${p.type} part`,
      size: p.body.length,
      type: p.type,
      inline: p.disposition === "inline" || (!p.disposition && Boolean(getHeader(p.headers, "content-id"))),
    });
  };
  walk(root);

  let text = "";
  let bodySource: ParsedEmail["bodySource"] = "none";
  const plainStr = plain as string | null;
  const htmlStr = html as string | null;
  if (plainStr !== null && plainStr.trim()) {
    text = plainStr;
    bodySource = "plain";
  } else if (htmlStr !== null) {
    text = htmlToText(htmlStr);
    bodySource = "html";
  }

  return {
    headers: root.headers.map((x) => ({ name: x.name, value: decodeEncodedWords(x.value) })),
    subject: h("subject"),
    from: h("from"),
    to: h("to"),
    cc: h("cc"),
    date: h("date"),
    text: text.replace(/\r\n?/g, "\n"),
    bodySource,
    attachments,
  };
}
