/**
 * IPv4 and IPv6 subnet math using BigInt (constructed with BigInt(), not
 * literals, because the project targets ES2017).
 */

const B0 = BigInt(0);
const B1 = BigInt(1);
const B8 = BigInt(8);
const B16 = BigInt(16);
const B255 = BigInt(255);
const BFFFF = BigInt(0xffff);

export type Family = 4 | 6;

export interface Parsed {
  family: Family;
  value: bigint;
}

export const bits = (f: Family) => (f === 4 ? 32 : 128);

export function parseIPv4(s: string): bigint | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
  if (!m) return null;
  let v = B0;
  for (let i = 1; i <= 4; i++) {
    if (m[i].length > 1 && m[i].startsWith("0")) return null; // leading zeros are ambiguous (octal)
    const n = Number(m[i]);
    if (n > 255) return null;
    v = (v << B8) | BigInt(n);
  }
  return v;
}

export function parseIPv6(raw: string): bigint | null {
  let s = raw.trim().toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  if (!s || /[^0-9a-f:.]/.test(s)) return null;
  // embedded IPv4 in the last 32 bits
  let tailV4: bigint | null = null;
  const lastColon = s.lastIndexOf(":");
  if (s.includes(".")) {
    tailV4 = parseIPv4(s.slice(lastColon + 1));
    if (tailV4 === null) return null;
    s = s.slice(0, lastColon + 1) + "0:0";
  }
  const dbl = s.split("::");
  if (dbl.length > 2) return null;
  const head = dbl[0] ? dbl[0].split(":") : [];
  const tail = dbl.length === 2 && dbl[1] ? dbl[1].split(":") : [];
  if ([...head, ...tail].some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  let groups: string[];
  if (dbl.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;
    groups = [...head, ...Array(fill).fill("0"), ...tail];
  } else groups = head;
  if (groups.length !== 8) return null;
  let v = B0;
  for (const g of groups) v = (v << B16) | BigInt(parseInt(g, 16));
  if (tailV4 !== null) v = (v & ~((B1 << BigInt(32)) - B1)) | tailV4;
  return v;
}

export function formatIPv4(v: bigint): string {
  const parts: number[] = [];
  for (let i = 3; i >= 0; i--) parts.push(Number((v >> BigInt(i * 8)) & B255));
  return parts.join(".");
}

/** RFC 5952 canonical text: lowercase, no leading zeros, longest zero run (≥ 2 groups) as "::". */
export function formatIPv6(v: bigint): string {
  const g: number[] = [];
  for (let i = 7; i >= 0; i--) g.push(Number((v >> BigInt(i * 16)) & BFFFF));
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bestLen) {
      bestStart = i;
      bestLen = j - i;
    }
    i = j;
  }
  const hex = g.map((x) => x.toString(16));
  if (bestLen < 2) return hex.join(":");
  const left = hex.slice(0, bestStart).join(":");
  const right = hex.slice(bestStart + bestLen).join(":");
  return `${left}::${right}`;
}

export function expandIPv6(v: bigint): string {
  const g: string[] = [];
  for (let i = 7; i >= 0; i--) g.push(Number((v >> BigInt(i * 16)) & BFFFF).toString(16).padStart(4, "0"));
  return g.join(":");
}

export const formatIP = (f: Family, v: bigint) => (f === 4 ? formatIPv4(v) : formatIPv6(v));

export function maskOf(f: Family, prefix: number): bigint {
  const total = bits(f);
  if (prefix === 0) return B0;
  const all = (B1 << BigInt(total)) - B1;
  return (all << BigInt(total - prefix)) & all;
}

/** Returns prefix length of a contiguous dotted mask, or null. */
export function prefixFromMask(mask: string): number | null {
  const v = parseIPv4(mask);
  if (v === null) return null;
  for (let p = 0; p <= 32; p++) if (maskOf(4, p) === v) return p;
  return null;
}

export interface ParsedCidr {
  family: Family;
  address: bigint;
  prefix: number;
}

/**
 * Accepts "10.0.0.5/24", "10.0.0.5 255.255.255.0", "2001:db8::1/48", or a
 * bare address (treated as a single host).
 */
export function parseCidr(input: string): ParsedCidr | { error: string } {
  const s = input.trim();
  if (!s) return { error: "Enter an address, for example 192.168.1.10/24 or 2001:db8::/48." };
  let addr = s;
  let pre: string | null = null;
  let maskStr: string | null = null;
  if (s.includes("/")) {
    const [a, p, ...rest] = s.split("/");
    if (rest.length) return { error: "Use only one slash, as in 10.0.0.0/8." };
    addr = a.trim();
    pre = p.trim();
  } else if (/\s+/.test(s)) {
    const [a, m] = s.split(/\s+/);
    addr = a;
    maskStr = m;
  }
  const v4 = parseIPv4(addr);
  const family: Family | null = v4 !== null ? 4 : parseIPv6(addr) !== null ? 6 : null;
  if (family === null) {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(addr)) return { error: "Each IPv4 octet must be 0 to 255, without leading zeros." };
    return { error: `"${addr}" is not a valid IPv4 or IPv6 address.` };
  }
  const address = family === 4 ? (v4 as bigint) : (parseIPv6(addr) as bigint);
  let prefix = bits(family);
  if (pre !== null) {
    if (!/^\d{1,3}$/.test(pre)) {
      if (family === 4) {
        const p = prefixFromMask(pre);
        if (p === null) return { error: "The prefix must be a number like /24 or a contiguous mask like 255.255.255.0." };
        prefix = p;
      } else return { error: "The IPv6 prefix must be a number from 0 to 128." };
    } else {
      prefix = Number(pre);
      if (prefix > bits(family)) return { error: `The prefix must be between 0 and ${bits(family)} for IPv${family}.` };
    }
  } else if (maskStr !== null) {
    if (family !== 4) return { error: "Dotted masks only apply to IPv4. Use /prefix for IPv6." };
    const p = prefixFromMask(maskStr);
    if (p === null) return { error: "That subnet mask is not contiguous (for example 255.255.255.0 is valid, 255.0.255.0 is not)." };
    prefix = p;
  }
  return { family, address, prefix };
}

export interface SubnetInfo {
  family: Family;
  prefix: number;
  address: bigint;
  network: bigint;
  last: bigint;
  /** Broadcast (IPv4 only, prefixes up to /30). */
  broadcast: bigint | null;
  firstHost: bigint;
  lastHost: bigint;
  total: bigint;
  usable: bigint;
  mask: bigint;
  wildcard: bigint;
}

export function subnetInfo(p: ParsedCidr): SubnetInfo {
  const total = bits(p.family);
  const mask = maskOf(p.family, p.prefix);
  const all = (B1 << BigInt(total)) - B1;
  const wildcard = all ^ mask;
  const network = p.address & mask;
  const last = network | wildcard;
  const size = B1 << BigInt(total - p.prefix);
  let firstHost = network;
  let lastHost = last;
  let usable = size;
  let broadcast: bigint | null = null;
  if (p.family === 4) {
    if (p.prefix <= 30) {
      broadcast = last;
      firstHost = network + B1;
      lastHost = last - B1;
      usable = size - BigInt(2);
    }
    // /31 (RFC 3021 point-to-point) and /32 use every address
  }
  return { family: p.family, prefix: p.prefix, address: p.address, network, last, broadcast, firstHost, lastHost, total: size, usable, mask, wildcard };
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

const V4_RANGES: [string, number, string][] = [
  ["0.0.0.0", 8, "\"This network\" (RFC 791), not routable"],
  ["10.0.0.0", 8, "Private network (RFC 1918)"],
  ["100.64.0.0", 10, "Shared address space for carrier-grade NAT (RFC 6598)"],
  ["127.0.0.0", 8, "Loopback (RFC 1122)"],
  ["169.254.0.0", 16, "Link-local (RFC 3927)"],
  ["172.16.0.0", 12, "Private network (RFC 1918)"],
  ["192.0.0.0", 24, "IETF protocol assignments (RFC 6890)"],
  ["192.0.2.0", 24, "Documentation, TEST-NET-1 (RFC 5737)"],
  ["192.88.99.0", 24, "Former 6to4 relay anycast (RFC 7526, deprecated)"],
  ["192.168.0.0", 16, "Private network (RFC 1918)"],
  ["198.18.0.0", 15, "Benchmark testing (RFC 2544)"],
  ["198.51.100.0", 24, "Documentation, TEST-NET-2 (RFC 5737)"],
  ["203.0.113.0", 24, "Documentation, TEST-NET-3 (RFC 5737)"],
  ["224.0.0.0", 4, "Multicast (RFC 5771)"],
  ["255.255.255.255", 32, "Limited broadcast (RFC 919)"],
  ["240.0.0.0", 4, "Reserved for future use (RFC 1112)"],
];

const V6_RANGES: [string, number, string][] = [
  ["::", 128, "Unspecified address (RFC 4291)"],
  ["::1", 128, "Loopback (RFC 4291)"],
  ["::ffff:0:0", 96, "IPv4-mapped address (RFC 4291)"],
  ["64:ff9b::", 96, "IPv4/IPv6 translation, NAT64 (RFC 6052)"],
  ["64:ff9b:1::", 48, "Local-use IPv4/IPv6 translation (RFC 8215)"],
  ["100::", 64, "Discard-only prefix (RFC 6666)"],
  ["2001::", 32, "Teredo tunneling (RFC 4380)"],
  ["2001:db8::", 32, "Documentation (RFC 3849)"],
  ["2001:10::", 28, "Deprecated ORCHID (RFC 4843)"],
  ["2001:20::", 28, "ORCHIDv2 (RFC 7343)"],
  ["2002::", 16, "6to4 (RFC 3056)"],
  ["3fff::", 20, "Documentation (RFC 9637)"],
  ["fc00::", 7, "Unique local address, private (RFC 4193)"],
  ["fe80::", 10, "Link-local unicast (RFC 4291)"],
  ["ff00::", 8, "Multicast (RFC 4291)"],
  ["2000::", 3, "Global unicast (RFC 4291)"],
];

export function classify(f: Family, v: bigint): string {
  const list = f === 4 ? V4_RANGES : V6_RANGES;
  // most specific first
  const sorted = [...list].sort((a, b) => b[1] - a[1]);
  for (const [base, prefix, label] of sorted) {
    const b = f === 4 ? parseIPv4(base) : parseIPv6(base);
    if (b === null) continue;
    const m = maskOf(f, prefix);
    if ((v & m) === (b & m)) return label;
  }
  return f === 4 ? "Public (globally routable unicast)" : "Not in a special-purpose block";
}

export function ipv4Class(v: bigint): string {
  const first = Number(v >> BigInt(24));
  if (first < 128) return "A";
  if (first < 192) return "B";
  if (first < 224) return "C";
  if (first < 240) return "D (multicast)";
  return "E (reserved)";
}

/* ------------------------------------------------------------------ */
/* Splitting                                                           */
/* ------------------------------------------------------------------ */

export function splitSubnet(info: SubnetInfo, newPrefix: number, limit = 1024): { network: bigint; last: bigint }[] {
  const total = bits(info.family);
  if (newPrefix < info.prefix || newPrefix > total) return [];
  const size = B1 << BigInt(total - newPrefix);
  const count = B1 << BigInt(newPrefix - info.prefix);
  const out: { network: bigint; last: bigint }[] = [];
  for (let i = B0; i < count && out.length < limit; i++) {
    const n = info.network + i * size;
    out.push({ network: n, last: n + size - B1 });
  }
  return out;
}

/** Smallest prefix that yields at least `n` subnets. */
export function prefixForCount(base: number, n: number): number {
  let extra = 0;
  while (2 ** extra < n) extra++;
  return base + extra;
}

/** Formats a BigInt with thousands separators (works for 2^128). */
export function groupDigits(v: bigint): string {
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function toBinary(f: Family, v: bigint): string {
  const total = bits(f);
  const s = v.toString(2).padStart(total, "0");
  const size = f === 4 ? 8 : 16;
  const parts: string[] = [];
  for (let i = 0; i < total; i += size) parts.push(s.slice(i, i + size));
  return parts.join(f === 4 ? "." : ":");
}
