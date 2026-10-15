/**
 * vCard 2.1 / 3.0 / 4.0 reader and vCard 3.0 writer, plus the table mapping
 * used by the vCard ↔ CSV converter. Pure TypeScript, no DOM.
 *
 * Reader covers: line unfolding (3.0/4.0 drop one leading space or tab, 2.1
 * keeps it), quoted-printable soft line breaks and decoding with CHARSET,
 * property groups (item1.EMAIL), TYPE parameters in all three syntaxes, PREF,
 * backslash escapes and structured values (N, ADR, ORG).
 */

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

export interface TypedValue {
  value: string;
  /** Lowercase TYPE values without "pref". */
  types: string[];
  pref: boolean;
  /** Custom label from an Apple-style grouped X-ABLabel property. */
  label?: string;
}

export interface Address {
  types: string[];
  pref: boolean;
  label?: string;
  poBox: string;
  extended: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface Contact {
  version: string;
  fn: string;
  family: string;
  given: string;
  middle: string;
  prefix: string;
  suffix: string;
  nickname: string;
  org: string;
  department: string;
  title: string;
  phones: TypedValue[];
  emails: TypedValue[];
  urls: TypedValue[];
  addresses: Address[];
  bday: string;
  note: string;
}

export function emptyContact(version = "3.0"): Contact {
  return {
    version,
    fn: "",
    family: "",
    given: "",
    middle: "",
    prefix: "",
    suffix: "",
    nickname: "",
    org: "",
    department: "",
    title: "",
    phones: [],
    emails: [],
    urls: [],
    addresses: [],
    bday: "",
    note: "",
  };
}

export interface ParseResult {
  contacts: Contact[];
  warnings: string[];
  versions: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* Low-level property parsing                                          */
/* ------------------------------------------------------------------ */

export interface RawProperty {
  group: string;
  name: string;
  params: Record<string, string[]>;
  value: string;
}

const BARE_ENCODINGS = ["QUOTED-PRINTABLE", "BASE64", "8BIT", "7BIT", "B"];

/** Splits on a separator outside double quotes. */
function splitOutsideQuotes(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (ch === sep && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** RFC 6868 caret decoding for 4.0 parameter values. */
const caretDecode = (s: string) => s.replace(/\^(\^|n|')/g, (_, c: string) => (c === "n" ? "\n" : c === "'" ? '"' : "^"));

/** Parses one unfolded content line. Returns null for lines without a colon. */
export function parseLine(line: string): RawProperty | null {
  let q = false;
  let idx = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') q = !q;
    else if (ch === ":" && !q) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;
  const head = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const parts = splitOutsideQuotes(head, ";");
  const nameFull = parts[0].trim();
  const dot = nameFull.lastIndexOf(".");
  const group = dot >= 0 ? nameFull.slice(0, dot) : "";
  const name = (dot >= 0 ? nameFull.slice(dot + 1) : nameFull).toUpperCase();
  const params: Record<string, string[]> = {};
  const add = (k: string, v: string[]) => {
    params[k] = (params[k] ?? []).concat(v);
  };
  for (const p of parts.slice(1)) {
    const t = p.trim();
    if (!t) continue;
    const eq = t.indexOf("=");
    if (eq < 0) {
      // vCard 2.1 bare parameter: an encoding, a charset-less type like WORK, or PREF.
      const up = t.toUpperCase();
      if (BARE_ENCODINGS.includes(up)) add("ENCODING", [up]);
      else add("TYPE", [t]);
      continue;
    }
    const key = t.slice(0, eq).trim().toUpperCase();
    const raw = t.slice(eq + 1).trim();
    const values = splitOutsideQuotes(raw, ",").map((v) => caretDecode(v.trim().replace(/^"|"$/g, "")));
    add(key, values.filter((v) => v !== ""));
  }
  return { group, name, params, value };
}

/** Converts a JS string with =XX escapes into bytes; other chars are UTF-8 encoded. */
function qpToBytes(s: string): Uint8Array {
  const out: number[] = [];
  const enc = new TextEncoder();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "=" && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      out.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 128) out.push(code);
    else {
      // Pass through already-decoded characters (including surrogate pairs) as UTF-8.
      const cp = s.codePointAt(i) ?? code;
      const str = String.fromCodePoint(cp);
      enc.encode(str).forEach((b) => out.push(b));
      if (cp > 0xffff) i++;
    }
  }
  return new Uint8Array(out);
}

/** Decodes a quoted-printable value (soft line breaks already joined) using the given charset. */
export function decodeQuotedPrintable(s: string, charset = "utf-8"): string {
  const bytes = qpToBytes(s.replace(/=\r?\n/g, ""));
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset.toLowerCase());
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  return decoder.decode(bytes);
}

/** Splits a value on an unescaped separator, keeping escapes for unescapeText. */
export function splitEscaped(value: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "\\" && i + 1 < value.length) {
      cur += ch + value[i + 1];
      i++;
      continue;
    }
    if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Resolves backslash escapes: \n \N \, \; \\ \: (unknown escapes keep the backslash). */
export function unescapeText(s: string): string {
  return s.replace(/\\([nN,;:\\])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

/** Escapes a text value for vCard 3.0. */
export function escapeText(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/* ------------------------------------------------------------------ */
/* Unfolding                                                           */
/* ------------------------------------------------------------------ */

const isQpHead = (line: string) => {
  const colon = line.indexOf(":");
  return colon > 0 && /QUOTED-PRINTABLE/i.test(line.slice(0, colon));
};

/**
 * Joins physical lines into logical content lines. Version aware: in 2.1 a fold
 * keeps the whitespace, in 3.0/4.0 one leading space or tab is removed.
 */
export function unfoldLines(text: string): string[] {
  const physical = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
  const out: string[] = [];
  let version = "";
  let cur: string | null = null;
  let qpOpen = false;
  const flush = () => {
    if (cur === null) return;
    out.push(cur);
    const m = /^VERSION:\s*(\S+)/i.exec(cur);
    if (m) version = m[1];
    if (/^BEGIN:VCARD/i.test(cur)) version = "";
    cur = null;
  };
  for (const raw of physical) {
    if (cur !== null && qpOpen) {
      // Quoted-printable soft line break: the "=" was removed, append the next line verbatim.
      cur += raw;
      qpOpen = cur.endsWith("=") && isQpHead(cur);
      if (qpOpen) cur = cur.slice(0, -1);
      continue;
    }
    if (cur !== null && /^[ \t]/.test(raw)) {
      cur += version === "2.1" ? raw : raw.slice(1);
      qpOpen = cur.endsWith("=") && isQpHead(cur);
      if (qpOpen) cur = cur.slice(0, -1);
      continue;
    }
    flush();
    if (raw.trim() === "") continue;
    cur = raw;
    qpOpen = cur.endsWith("=") && isQpHead(cur);
    if (qpOpen) cur = cur.slice(0, -1);
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */

const NOISE_TYPES = new Set(["pref", "internet", "x400", "voice", "text", "uri", "aol", "applelink", "attmail", "cis", "eworld", "ibmmail", "mcimail", "powershare", "prodigy", "tlx"]);

function decodedValue(p: RawProperty): string {
  const enc = (p.params.ENCODING ?? [])[0]?.toUpperCase();
  if (enc === "QUOTED-PRINTABLE") {
    const charset = (p.params.CHARSET ?? [])[0] ?? "utf-8";
    return decodeQuotedPrintable(p.value, charset).replace(/\r\n?/g, "\n");
  }
  return p.value;
}

function typesOf(p: RawProperty): { types: string[]; pref: boolean } {
  const all = (p.params.TYPE ?? []).flatMap((t) => t.split(",")).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const pref = all.includes("pref") || (p.params.PREF ?? []).length > 0;
  const types: string[] = [];
  for (const t of all) if (t !== "pref" && !types.includes(t)) types.push(t);
  return { types, pref };
}

const cleanLabel = (s: string) => s.replace(/^_\$!</, "").replace(/>!\$_$/, "").trim().toLowerCase();

/** Parses any number of vCards from text. Never throws. */
export function parseVcards(text: string): ParseResult {
  const lines = unfoldLines(text);
  const contacts: Contact[] = [];
  const warnings: string[] = [];
  const versions: Record<string, number> = {};
  let props: RawProperty[] | null = null;
  let depth = 0;
  let skipped = 0;

  const finish = (list: RawProperty[]) => {
    const c = buildContact(list);
    versions[c.version] = (versions[c.version] ?? 0) + 1;
    contacts.push(c);
  };

  for (const line of lines) {
    const p = parseLine(line);
    if (!p) {
      if (props) skipped++;
      continue;
    }
    if (p.name === "BEGIN" && /^vcard$/i.test(p.value.trim())) {
      if (props) {
        depth++; // nested card (2.1 AGENT); ignore its content
        continue;
      }
      props = [];
      depth = 0;
      continue;
    }
    if (p.name === "END" && /^vcard$/i.test(p.value.trim())) {
      if (depth > 0) {
        depth--;
        continue;
      }
      if (props) finish(props);
      props = null;
      continue;
    }
    if (props && depth === 0) props.push(p);
  }
  if (props && props.length) {
    finish(props);
    warnings.push("The last card had no END:VCARD line; it was read anyway.");
  }
  if (skipped) warnings.push(`${skipped} line${skipped === 1 ? "" : "s"} without a property name ${skipped === 1 ? "was" : "were"} skipped.`);
  return { contacts, warnings, versions };
}

function normalizeBday(v: string): string {
  const s = v.trim();
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = /^(\d{4}-\d{2}-\d{2})T/.exec(s);
  return t ? t[1] : s;
}

function buildContact(props: RawProperty[]): Contact {
  const c = emptyContact("");
  const labels = new Map<string, string>();
  for (const p of props) if (p.group && p.name === "X-ABLABEL") labels.set(p.group.toLowerCase(), cleanLabel(unescapeText(decodedValue(p))));
  const labelFor = (p: RawProperty) => (p.group ? labels.get(p.group.toLowerCase()) : undefined);

  for (const p of props) {
    const raw = decodedValue(p);
    const text = () => unescapeText(raw).trim();
    switch (p.name) {
      case "VERSION":
        c.version = raw.trim();
        break;
      case "FN":
        c.fn = text();
        break;
      case "N": {
        const [family = "", given = "", middle = "", prefix = "", suffix = ""] = splitEscaped(raw, ";").map((x) => unescapeText(x).trim());
        Object.assign(c, { family, given, middle, prefix, suffix });
        break;
      }
      case "NICKNAME":
        c.nickname = text();
        break;
      case "ORG": {
        const [org = "", ...units] = splitEscaped(raw, ";").map((x) => unescapeText(x).trim());
        c.org = org;
        c.department = units.filter(Boolean).join(", ");
        break;
      }
      case "TITLE":
        c.title = text();
        break;
      case "TEL":
      case "EMAIL":
      case "URL": {
        let value = text();
        if (p.name === "TEL") value = value.replace(/^tel:/i, "");
        if (p.name === "EMAIL") value = value.replace(/^mailto:/i, "");
        if (!value) break;
        const t: TypedValue = { value, ...typesOf(p) };
        const label = labelFor(p);
        if (label) t.label = label;
        (p.name === "TEL" ? c.phones : p.name === "EMAIL" ? c.emails : c.urls).push(t);
        break;
      }
      case "ADR": {
        const [poBox = "", extended = "", street = "", city = "", region = "", postalCode = "", country = ""] = splitEscaped(raw, ";").map((x) =>
          unescapeText(x).trim(),
        );
        if (![poBox, extended, street, city, region, postalCode, country].some(Boolean)) break;
        const a: Address = { ...typesOf(p), poBox, extended, street, city, region, postalCode, country };
        const label = labelFor(p);
        if (label) a.label = label;
        c.addresses.push(a);
        break;
      }
      case "BDAY":
        c.bday = normalizeBday(text());
        break;
      case "NOTE":
        c.note = c.note ? `${c.note}\n${text()}` : text();
        break;
      default:
        break;
    }
  }
  if (!c.version) c.version = "unknown";
  if (!c.fn) c.fn = [c.prefix, c.given, c.middle, c.family, c.suffix].filter(Boolean).join(" ") || c.org;
  // Preferred values first, otherwise keep file order.
  const byPref = <T extends { pref: boolean }>(xs: T[]) => xs.map((x, i) => [x, i] as const).sort((a, b) => Number(b[0].pref) - Number(a[0].pref) || a[1] - b[1]).map((x) => x[0]);
  c.phones = byPref(c.phones);
  c.emails = byPref(c.emails);
  c.addresses = byPref(c.addresses);
  return c;
}

/** Human type label: custom label, else meaningful TYPE values joined with "/". */
export function typeLabel(t: { types: string[]; label?: string }): string {
  if (t.label) return t.label;
  return t.types.filter((x) => !NOISE_TYPES.has(x)).join("/");
}

/* ------------------------------------------------------------------ */
/* vCard → table                                                       */
/* ------------------------------------------------------------------ */

export type ColumnId =
  | "fn"
  | "given"
  | "family"
  | "middle"
  | "prefix"
  | "suffix"
  | "nickname"
  | "org"
  | "department"
  | "title"
  | "phones"
  | "emails"
  | "urls"
  | "addresses"
  | "bday"
  | "note"
  | "version";

export const COLUMNS: { id: ColumnId; label: string; default: boolean }[] = [
  { id: "fn", label: "Full name", default: true },
  { id: "given", label: "First name", default: true },
  { id: "family", label: "Last name", default: true },
  { id: "middle", label: "Middle name", default: false },
  { id: "prefix", label: "Prefix", default: false },
  { id: "suffix", label: "Suffix", default: false },
  { id: "nickname", label: "Nickname", default: false },
  { id: "org", label: "Organization", default: true },
  { id: "department", label: "Department", default: false },
  { id: "title", label: "Job title", default: true },
  { id: "phones", label: "Phones", default: true },
  { id: "emails", label: "Emails", default: true },
  { id: "urls", label: "Websites", default: false },
  { id: "addresses", label: "Addresses", default: false },
  { id: "bday", label: "Birthday", default: false },
  { id: "note", label: "Note", default: false },
  { id: "version", label: "vCard version", default: false },
];

/** numbered: Phone 1, Phone 1 type…; typed: Phone (work)…; joined: one cell per kind. */
export type MultiMode = "numbered" | "typed" | "joined";

const ADR_PARTS = [
  ["street", "street"],
  ["city", "city"],
  ["region", "region"],
  ["postal code", "postalCode"],
  ["country", "country"],
] as const;

const streetOf = (a: Address) => [a.poBox, a.extended, a.street].filter(Boolean).join(", ");
const adrPart = (a: Address, key: (typeof ADR_PARTS)[number][1]) => (key === "street" ? streetOf(a) : a[key]);

export function formatAddress(a: Address): string {
  const cityLine = [a.city, [a.region, a.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [streetOf(a), cityLine, a.country].filter(Boolean).join(", ");
}

type Getter = (c: Contact) => string;

/** Builds headers + rows for the selected columns. */
export function contactsToTable(contacts: Contact[], columns: ColumnId[], mode: MultiMode): { headers: string[]; rows: string[][] } {
  const cols: { header: string; get: Getter }[] = [];
  const simple: Partial<Record<ColumnId, Getter>> = {
    fn: (c) => c.fn,
    given: (c) => c.given,
    family: (c) => c.family,
    middle: (c) => c.middle,
    prefix: (c) => c.prefix,
    suffix: (c) => c.suffix,
    nickname: (c) => c.nickname,
    org: (c) => c.org,
    department: (c) => c.department,
    title: (c) => c.title,
    bday: (c) => c.bday,
    note: (c) => c.note,
    version: (c) => c.version,
  };
  const listKinds: Record<"phones" | "emails" | "urls", { list: (c: Contact) => TypedValue[]; name: string }> = {
    phones: { list: (c) => c.phones, name: "Phone" },
    emails: { list: (c) => c.emails, name: "Email" },
    urls: { list: (c) => c.urls, name: "Website" },
  };

  for (const def of COLUMNS) {
    if (!columns.includes(def.id)) continue;
    const g = simple[def.id];
    if (g) {
      cols.push({ header: def.label, get: g });
      continue;
    }
    if (def.id === "addresses") {
      if (mode === "joined") {
        cols.push({ header: "Addresses", get: (c) => c.addresses.map((a) => withType(formatAddress(a), typeLabel(a))).join(" | ") });
      } else if (mode === "numbered") {
        const n = Math.max(0, ...contacts.map((c) => c.addresses.length));
        for (let i = 0; i < n; i++) {
          cols.push({ header: `Address ${i + 1} type`, get: (c) => (c.addresses[i] ? typeLabel(c.addresses[i]) : "") });
          for (const [lab, key] of ADR_PARTS) cols.push({ header: `Address ${i + 1} ${lab}`, get: (c) => (c.addresses[i] ? adrPart(c.addresses[i], key) : "") });
        }
      } else {
        for (const slot of typedSlots(contacts.map((c) => c.addresses))) {
          const base = slot.label ? `Address (${slot.label})${slot.n > 1 ? ` ${slot.n}` : ""}` : `Address${slot.n > 1 ? ` ${slot.n}` : ""}`;
          for (const [lab, key] of ADR_PARTS)
            cols.push({ header: `${base} ${lab}`, get: (c) => { const a = pickTyped(c.addresses, slot); return a ? adrPart(a, key) : ""; } });
        }
      }
      continue;
    }
    const kind = listKinds[def.id as "phones" | "emails" | "urls"];
    if (mode === "joined") {
      cols.push({ header: def.label, get: (c) => kind.list(c).map((t) => withType(t.value, typeLabel(t))).join("; ") });
    } else if (mode === "numbered") {
      const n = Math.max(0, ...contacts.map((c) => kind.list(c).length));
      for (let i = 0; i < n; i++) {
        cols.push({ header: `${kind.name} ${i + 1}`, get: (c) => kind.list(c)[i]?.value ?? "" });
        cols.push({ header: `${kind.name} ${i + 1} type`, get: (c) => { const t = kind.list(c)[i]; return t ? typeLabel(t) : ""; } });
      }
    } else {
      for (const slot of typedSlots(contacts.map(kind.list))) {
        const header = slot.label ? `${kind.name} (${slot.label})${slot.n > 1 ? ` ${slot.n}` : ""}` : `${kind.name}${slot.n > 1 ? ` ${slot.n}` : ""}`;
        cols.push({ header, get: (c) => pickTyped(kind.list(c), slot)?.value ?? "" });
      }
    }
  }
  return { headers: cols.map((c) => c.header), rows: contacts.map((c) => cols.map((col) => col.get(c))) };
}

const withType = (v: string, t: string) => (t ? `${v} (${t})` : v);

interface Slot {
  label: string;
  /** 1 for the first value with this label, 2 for the second… */
  n: number;
}

function typedSlots(lists: { types: string[]; label?: string }[][]): Slot[] {
  const max = new Map<string, number>();
  for (const list of lists) {
    const counts = new Map<string, number>();
    for (const t of list) {
      const l = typeLabel(t);
      counts.set(l, (counts.get(l) ?? 0) + 1);
    }
    counts.forEach((n, l) => max.set(l, Math.max(max.get(l) ?? 0, n)));
  }
  const slots: Slot[] = [];
  max.forEach((n, label) => {
    for (let i = 1; i <= n; i++) slots.push({ label, n: i });
  });
  return slots;
}

function pickTyped<T extends { types: string[]; label?: string }>(list: T[], slot: Slot): T | undefined {
  return list.filter((t) => typeLabel(t) === slot.label)[slot.n - 1];
}

/* ------------------------------------------------------------------ */
/* Table → vCard 3.0                                                   */
/* ------------------------------------------------------------------ */

export type FieldId =
  | "ignore"
  | "fn"
  | "given"
  | "family"
  | "middle"
  | "prefix"
  | "suffix"
  | "nickname"
  | "org"
  | "department"
  | "title"
  | "phone"
  | "phoneType"
  | "email"
  | "emailType"
  | "url"
  | "street"
  | "city"
  | "region"
  | "postalCode"
  | "country"
  | "adrType"
  | "bday"
  | "note";

export const FIELD_OPTIONS: { value: FieldId; label: string }[] = [
  { value: "ignore", label: "Ignore" },
  { value: "fn", label: "Full name" },
  { value: "given", label: "First name" },
  { value: "family", label: "Last name" },
  { value: "middle", label: "Middle name" },
  { value: "prefix", label: "Prefix" },
  { value: "suffix", label: "Suffix" },
  { value: "nickname", label: "Nickname" },
  { value: "org", label: "Organization" },
  { value: "department", label: "Department" },
  { value: "title", label: "Job title" },
  { value: "phone", label: "Phone" },
  { value: "phoneType", label: "Phone type" },
  { value: "email", label: "Email" },
  { value: "emailType", label: "Email type" },
  { value: "url", label: "Website" },
  { value: "street", label: "Address street" },
  { value: "city", label: "Address city" },
  { value: "region", label: "Address region or state" },
  { value: "postalCode", label: "Address postal code" },
  { value: "country", label: "Address country" },
  { value: "adrType", label: "Address type" },
  { value: "bday", label: "Birthday" },
  { value: "note", label: "Note" },
];

/** Fields that take a type (work, home…) from the mapping. */
export const TYPED_FIELDS: FieldId[] = ["phone", "email", "url", "street", "city", "region", "postalCode", "country"];

export const TYPE_OPTIONS = [
  { value: "", label: "No type" },
  { value: "work", label: "Work" },
  { value: "home", label: "Home" },
  { value: "cell", label: "Mobile" },
  { value: "fax", label: "Fax" },
  { value: "work/fax", label: "Work fax" },
  { value: "home/fax", label: "Home fax" },
  { value: "pager", label: "Pager" },
] as const;

export interface ColumnMapping {
  field: FieldId;
  /** Normalized type, e.g. "work", "cell", "work/fax", or "". */
  type: string;
  /** Columns sharing a slot (and kind) describe the same phone/email/address. */
  slot: string;
}

const norm = (h: string) =>
  h
    .toLowerCase()
    .replace(/e-mail/g, "email")
    .replace(/[_\-–—:./()#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Maps free-text type labels ("Mobile", "* Work", "business fax") to vCard types. */
export function normalizeType(text: string): string {
  const words = text.toLowerCase().replace(/^\*\s*/, "").split(/[\s,/;]+/).filter(Boolean);
  const out: string[] = [];
  const push = (t: string) => {
    if (!out.includes(t)) out.push(t);
  };
  for (const w of words) {
    if (/^(mobile|cell|cellular|iphone|handy)$/.test(w)) push("cell");
    else if (/^(work|business|office|company)$/.test(w)) push("work");
    else if (/^(home|personal|private)$/.test(w)) push("home");
    else if (w === "fax") push("fax");
    else if (w === "pager") push("pager");
  }
  return out.join("/");
}

/** Detects the mapping for one header. `all` lets context decide (Outlook "Title" vs "Job Title"). */
export function detectColumn(header: string, all: string[] = []): ColumnMapping {
  const h = norm(header);
  const num = /\b(\d+)\b/.exec(h)?.[1] ?? "";
  const typeWord = normalizeType(h.replace(/\b(phone|telephone|tel|number|email|address|street|city|web|page|value)\b/g, " "));
  const slot = `${typeWord}${num}` || "main";
  const m = (field: FieldId, type = typeWord): ColumnMapping => ({ field, type, slot });
  const hasJobTitle = all.some((x) => /job title/.test(norm(x)));
  const isTypeCol = /\b(type|label)\b/.test(h);

  if (/^(full name|name|display name|formatted name|fn|contact name)$/.test(h)) return m("fn", "");
  if (/^(first name|given name|first|forename)$/.test(h)) return m("given", "");
  if (/^(last name|family name|surname|last)$/.test(h)) return m("family", "");
  if (/^(middle name|additional names?|middle)$/.test(h)) return m("middle", "");
  if (/^(prefix|name prefix|honorific prefix|salutation)$/.test(h) || (h === "title" && hasJobTitle)) return m("prefix", "");
  if (/^(suffix|name suffix|honorific suffix)$/.test(h)) return m("suffix", "");
  if (/^(nickname|nick name)$/.test(h)) return m("nickname", "");
  if (/^(company|company name|organization|organisation|org|organization( \d+)? name|organization name)$/.test(h)) return m("org", "");
  if (/department/.test(h)) return m("department", "");
  if (/^(job title|title|position|role|organization( \d+)? title|organization title)$/.test(h)) return m("title", "");
  if (/^(birthday|bday|date of birth|dob|birth date)$/.test(h)) return m("bday", "");
  if (/^(note|notes|comment|comments)$/.test(h)) return m("note", "");
  if (/vcard version/.test(h)) return m("ignore", "");

  if (/\bemails?\b/.test(h)) return isTypeCol ? m("emailType", "") : /display name/.test(h) ? m("ignore", "") : m("email");
  if (/\b(phones?|telephones?|tel|mobile|cell|fax|pager)\b/.test(h)) return isTypeCol ? m("phoneType", "") : m("phone");
  if (/\b(web ?pages?|websites?|web site|urls?|homepage|home page)\b/.test(h)) return isTypeCol ? m("ignore", "") : m("url");

  if (/\baddress(es)?\b.*\b(type|label)\b/.test(h)) return m("adrType", "");
  if (/formatted|po box|pobox|extended/.test(h)) return m("ignore", "");
  if (/\b(street|address line ?\d?|address|addresses)\b/.test(h) && !/\b(city|region|state|postal|zip|country)\b/.test(h)) {
    // "Business Street 2" or "Address line 2" is a second street line of the same address.
    const extraLine = /\b(street|address line) ?[2-9]\b/.test(h);
    return extraLine ? { field: "street", type: typeWord, slot: typeWord || "main" } : m("street");
  }
  if (/\b(city|locality|town)\b/.test(h)) return m("city");
  if (/\b(state|region|province|county)\b/.test(h)) return m("region");
  if (/\b(postal|zip|postcode|post code)\b/.test(h)) return m("postalCode");
  if (/\bcountry\b/.test(h)) return m("country");
  return m("ignore", "");
}

export function detectColumns(headers: string[]): ColumnMapping[] {
  return headers.map((h) => detectColumn(h, headers));
}

/** Splits multi-value cells ("a ::: b" Google style or "a; b" from our joined export). */
function splitMulti(cell: string): { value: string; type: string }[] {
  return cell
    .split(/\s*(?::::|;)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(.*\S)\s*\(([^()]+)\)$/.exec(s);
      // Only treat a trailing "(…)" as a type when it is a known type word, so "(555)" stays.
      if (m && normalizeType(m[2])) return { value: m[1], type: normalizeType(m[2]) };
      return { value: s, type: "" };
    });
}

/** Normalizes a birthday to YYYY-MM-DD when it is recognizable; slashed dates are read as month/day/year. */
export function normalizeCsvDate(v: string): string {
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s);
  if (m) {
    let mo = Number(m[1]);
    let d = Number(m[2]);
    if (mo > 12 && d <= 12) [mo, d] = [d, mo];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return s;
}

const typesFrom = (t: string) => t.split("/").filter(Boolean);

/** Converts one CSV row to a contact using the mapping. Returns null when the row has no usable data. */
export function rowToContact(row: string[], mapping: ColumnMapping[]): Contact | null {
  const c = emptyContact("3.0");
  type Multi = { kind: "phone" | "email" | "url"; items: { value: string; type: string }[]; slotType: string };
  const multi = new Map<string, Multi>();
  type Adr = { parts: Partial<Record<"street" | "city" | "region" | "postalCode" | "country", string>>; type: string; slotType: string };
  const adrs = new Map<string, Adr>();
  const getMulti = (kind: Multi["kind"], slot: string) => {
    const key = `${kind}|${slot}`;
    let e = multi.get(key);
    if (!e) multi.set(key, (e = { kind, items: [], slotType: "" }));
    return e;
  };
  const getAdr = (slot: string) => {
    let e = adrs.get(slot);
    if (!e) adrs.set(slot, (e = { parts: {}, type: "", slotType: "" }));
    return e;
  };

  mapping.forEach((mp, i) => {
    const cell = (row[i] ?? "").trim();
    if (!cell || mp.field === "ignore") return;
    switch (mp.field) {
      case "fn":
      case "given":
      case "family":
      case "middle":
      case "prefix":
      case "suffix":
      case "nickname":
      case "org":
      case "department":
      case "title":
        c[mp.field] = c[mp.field] ? `${c[mp.field]} ${cell}` : cell;
        break;
      case "note":
        c.note = c.note ? `${c.note}\n${cell}` : cell;
        break;
      case "bday":
        c.bday = normalizeCsvDate(cell);
        break;
      case "phone":
      case "email":
      case "url": {
        const e = getMulti(mp.field, mp.slot);
        for (const it of splitMulti(cell)) e.items.push({ value: it.value, type: it.type || mp.type });
        break;
      }
      case "phoneType":
        getMulti("phone", mp.slot).slotType = normalizeType(cell);
        break;
      case "emailType":
        getMulti("email", mp.slot).slotType = normalizeType(cell);
        break;
      case "adrType":
        getAdr(mp.slot).slotType = normalizeType(cell);
        break;
      default: {
        const e = getAdr(mp.slot);
        const k = mp.field;
        e.parts[k] = e.parts[k] ? `${e.parts[k]}, ${cell}` : cell;
        if (!e.type && mp.type) e.type = mp.type;
      }
    }
  });

  multi.forEach((e) => {
    for (const it of e.items) {
      const tv: TypedValue = { value: it.value, types: typesFrom(it.type || e.slotType), pref: false };
      (e.kind === "phone" ? c.phones : e.kind === "email" ? c.emails : c.urls).push(tv);
    }
  });
  adrs.forEach((e) => {
    const p = e.parts;
    if (![p.street, p.city, p.region, p.postalCode, p.country].some(Boolean)) return;
    c.addresses.push({
      types: typesFrom(e.slotType || e.type),
      pref: false,
      poBox: "",
      extended: "",
      street: p.street ?? "",
      city: p.city ?? "",
      region: p.region ?? "",
      postalCode: p.postalCode ?? "",
      country: p.country ?? "",
    });
  });

  if (!c.fn) c.fn = [c.prefix, c.given, c.middle, c.family, c.suffix].filter(Boolean).join(" ");
  if (!c.given && !c.family && c.fn && c.fn !== c.org) {
    const parts = c.fn.split(/\s+/);
    if (parts.length > 1) {
      c.family = parts[parts.length - 1];
      c.given = parts.slice(0, -1).join(" ");
    } else c.given = parts[0];
  }
  if (!c.fn) c.fn = c.org || c.emails[0]?.value || c.phones[0]?.value || "";
  return c.fn ? c : null;
}

/* ------------------------------------------------------------------ */
/* Serializer (vCard 3.0)                                              */
/* ------------------------------------------------------------------ */

function utf8Len(cp: number) {
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/** Folds a content line at 75 octets (UTF-8) without splitting a character. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = utf8Len(ch.codePointAt(0) ?? 0);
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
      limit = 74; // the leading space of a continuation line counts toward 75
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const typeParam = (types: string[], extra: string[] = []) => {
  const all = [...extra, ...types].map((t) => t.toUpperCase()).filter((t, i, a) => /^[A-Z0-9-]+$/.test(t) && a.indexOf(t) === i);
  return all.length ? `;TYPE=${all.join(",")}` : "";
};

/** Serializes one contact as vCard 3.0 with CRLF line endings and folding. */
export function serializeContact(c: Contact): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  const e = escapeText;
  lines.push(`N:${[c.family, c.given, c.middle, c.prefix, c.suffix].map(e).join(";")}`);
  lines.push(`FN:${e(c.fn)}`);
  if (c.nickname) lines.push(`NICKNAME:${e(c.nickname)}`);
  if (c.org || c.department) lines.push(`ORG:${[c.org, c.department].filter((x, i) => i === 0 || x).map(e).join(";")}`);
  if (c.title) lines.push(`TITLE:${e(c.title)}`);
  for (const t of c.phones) lines.push(`TEL${typeParam(t.types, t.pref ? ["pref"] : [])}:${e(t.value)}`);
  for (const t of c.emails) lines.push(`EMAIL${typeParam(t.types, ["internet", ...(t.pref ? ["pref"] : [])])}:${e(t.value)}`);
  for (const a of c.addresses)
    lines.push(`ADR${typeParam(a.types, a.pref ? ["pref"] : [])}:${[a.poBox, a.extended, a.street, a.city, a.region, a.postalCode, a.country].map(e).join(";")}`);
  for (const t of c.urls) lines.push(`URL${typeParam(t.types)}:${t.value.replace(/\r?\n/g, "")}`);
  if (c.bday) lines.push(`BDAY:${c.bday.replace(/[\r\n;,]/g, "")}`);
  if (c.note) lines.push(`NOTE:${e(c.note)}`);
  lines.push("END:VCARD");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function serializeContacts(contacts: Contact[]): string {
  return contacts.map(serializeContact).join("");
}

/* ------------------------------------------------------------------ */
/* Sample                                                              */
/* ------------------------------------------------------------------ */

export const SAMPLE_VCF = [
  "BEGIN:VCARD",
  "VERSION:2.1",
  "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Mart=C3=ADnez;Jos=C3=A9;;;",
  "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jos=C3=A9 Mart=C3=ADnez",
  "ORG:Fábrica Norte;Ventas",
  "TEL;WORK;VOICE:+34 91 555 0101",
  "TEL;CELL:+34 600 555 102",
  "EMAIL;INTERNET;PREF:jose@fabricanorte.example",
  "ADR;WORK;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:;;Calle de Alcal=C3=A1 12;Madr=",
  "id;;28014;Espa=C3=B1a",
  "NOTE;ENCODING=QUOTED-PRINTABLE:Prefers calls before noon.=0D=0ASpeaks Spanish and=",
  " English.",
  "END:VCARD",
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Okafor;Grace;A.;Dr.;",
  "FN:Dr. Grace A. Okafor",
  "ORG:Okafor\\, Lee & Partners;Research",
  "TITLE:Principal investigator",
  "TEL;TYPE=WORK,VOICE:+1 415 555 0142",
  "TEL;TYPE=CELL,PREF:+1 415 555 0199",
  "item1.EMAIL;TYPE=INTERNET:grace@okaforlee.example",
  "item1.X-ABLabel:lab",
  "EMAIL;TYPE=INTERNET,HOME:grace.okafor@mail.example",
  "ADR;TYPE=WORK:;Suite 400;500 Market St;San Francisco;CA;94105;USA",
  "URL:https://okaforlee.example",
  "BDAY:1984-03-09",
  "NOTE:Met at the 2025 lab tour. Ask about the grant\\; follow up in May.\\nPrefers ema",
  " il.",
  "END:VCARD",
  "BEGIN:VCARD",
  "VERSION:4.0",
  "FN:Mei Lin",
  "N:Lin;Mei;;;",
  "ORG:Harbor Studio",
  'TEL;VALUE=uri;TYPE="work,voice";PREF=1:tel:+44-20-7946-0958',
  'TEL;TYPE="cell":tel:+44-7700-900123',
  "EMAIL;TYPE=work:mei@harbor.example",
  "URL;TYPE=work:https://harbor.example",
  "END:VCARD",
  "",
].join("\r\n");
