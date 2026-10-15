/**
 * Time zone helpers built only on Intl.DateTimeFormat (no tz database is
 * bundled; the browser's ICU data is the source of truth). Offsets are
 * computed by formatting an instant in the zone and comparing the wall-clock
 * reading with UTC, which makes every conversion DST-aware.
 */

export type Wall = { y: number; m: number; d: number; h: number; mi: number; s: number };

const FALLBACK_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Cairo",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

let zoneCache: string[] | null = null;

/** All IANA zones the browser knows, with UTC first. */
export function listTimeZones(): string[] {
  if (zoneCache) return zoneCache;
  let zones: string[] = [];
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    zones = intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : [];
  } catch {
    zones = [];
  }
  if (zones.length === 0) zones = FALLBACK_ZONES.slice(1);
  zoneCache = ["UTC", ...zones.filter((z) => z !== "UTC" && z !== "Etc/UTC")];
  return zoneCache;
}

export function isValidZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Search keywords for zones whose IANA name does not mention the country or common name. */
export const ZONE_KEYWORDS: Record<string, string> = {
  UTC: "utc gmt coordinated universal zulu",
  "America/New_York": "eastern et est edt usa us new york nyc washington boston miami",
  "America/Chicago": "central ct cst cdt usa us chicago dallas houston",
  "America/Denver": "mountain mt mst mdt usa us denver",
  "America/Phoenix": "arizona mst usa us phoenix",
  "America/Los_Angeles": "pacific pt pst pdt usa us california los angeles san francisco seattle",
  "America/Anchorage": "alaska akst usa",
  "Pacific/Honolulu": "hawaii hst usa",
  "America/Toronto": "canada eastern toronto ottawa",
  "America/Vancouver": "canada pacific vancouver",
  "America/Mexico_City": "mexico cdmx",
  "America/Sao_Paulo": "brazil brasilia",
  "America/Argentina/Buenos_Aires": "argentina",
  "America/Bogota": "colombia",
  "America/Lima": "peru",
  "America/Santiago": "chile",
  "Europe/London": "uk united kingdom britain england gmt bst",
  "Europe/Dublin": "ireland",
  "Europe/Paris": "france cet cest",
  "Europe/Berlin": "germany cet cest",
  "Europe/Madrid": "spain",
  "Europe/Rome": "italy",
  "Europe/Amsterdam": "netherlands holland",
  "Europe/Stockholm": "sweden",
  "Europe/Warsaw": "poland",
  "Europe/Istanbul": "turkey turkiye",
  "Europe/Moscow": "russia msk",
  "Europe/Kiev": "ukraine kyiv",
  "Europe/Kyiv": "ukraine kiev",
  "Africa/Cairo": "egypt",
  "Africa/Lagos": "nigeria wat",
  "Africa/Johannesburg": "south africa sast",
  "Africa/Nairobi": "kenya eat",
  "Asia/Dubai": "uae emirates gst abu dhabi",
  "Asia/Riyadh": "saudi arabia",
  "Asia/Tehran": "iran",
  "Asia/Karachi": "pakistan pkt lahore islamabad",
  "Asia/Kolkata": "india ist mumbai delhi bangalore calcutta",
  "Asia/Calcutta": "india ist mumbai delhi bangalore kolkata",
  "Asia/Dhaka": "bangladesh",
  "Asia/Kathmandu": "nepal",
  "Asia/Katmandu": "nepal kathmandu",
  "Asia/Bangkok": "thailand",
  "Asia/Jakarta": "indonesia wib",
  "Asia/Ho_Chi_Minh": "vietnam saigon",
  "Asia/Saigon": "vietnam ho chi minh",
  "Asia/Singapore": "singapore sgt",
  "Asia/Kuala_Lumpur": "malaysia",
  "Asia/Manila": "philippines",
  "Asia/Shanghai": "china beijing cst",
  "Asia/Hong_Kong": "hong kong hkt",
  "Asia/Taipei": "taiwan",
  "Asia/Seoul": "korea kst",
  "Asia/Tokyo": "japan jst",
  "Australia/Sydney": "australia aest aedt melbourne canberra",
  "Australia/Perth": "australia awst western",
  "Australia/Brisbane": "australia queensland",
  "Australia/Adelaide": "australia acst central",
  "Pacific/Auckland": "new zealand nzst nzdt",
};

/** Human label for a zone id: "New York (America)". */
export function zoneCity(tz: string): string {
  if (tz === "UTC") return "UTC";
  const parts = tz.split("/");
  return parts[parts.length - 1].replace(/_/g, " ");
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function wallFormatter(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      era: "short",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

/** Wall-clock reading of instant `epoch` (ms) in zone `tz`. */
export function wallTime(tz: string, epoch: number): Wall {
  const parts = wallFormatter(tz).formatToParts(new Date(epoch));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const era = parts.find((p) => p.type === "era")?.value ?? "AD";
  let y = get("year");
  if (/^B/i.test(era)) y = 1 - y;
  let h = get("hour");
  if (h === 24) h = 0;
  return { y, m: get("month"), d: get("day"), h, mi: get("minute"), s: get("second") };
}

/** UTC ms for a wall reading, treating it as if it were UTC (handles years 0-99). */
export function wallToUtcMs(w: Wall, ms = 0): number {
  const dt = new Date(Date.UTC(2000, 0, 1, w.h, w.mi, w.s, ms));
  dt.setUTCFullYear(w.y, w.m - 1, w.d);
  return dt.getTime();
}

/** Offset of `tz` from UTC at instant `epoch`, in minutes (east positive). */
export function offsetMinutes(tz: string, epoch: number): number {
  const whole = Math.floor(epoch / 1000) * 1000;
  return Math.round((wallToUtcMs(wallTime(tz, whole)) - whole) / 60000);
}

export type ZonedResult = {
  epoch: number;
  /** exact: one match. overlap: the wall time happens twice (clocks fell back). gap: it never happens (clocks sprang forward). */
  kind: "exact" | "overlap" | "gap";
  /** For overlaps, the later instant. */
  alternate?: number;
};

/**
 * Instant at which the wall clock in `tz` reads `w`. Ambiguous times resolve
 * to the earlier instant; nonexistent times are moved forward by the length
 * of the gap (2:30 on a spring-forward night becomes 3:30), matching how
 * browsers and Temporal's "compatible" option behave.
 */
export function zonedToEpoch(tz: string, w: Wall): ZonedResult {
  const local = wallToUtcMs(w);
  const DAY = 86_400_000;
  const offsets = Array.from(
    new Set([offsetMinutes(tz, local - DAY), offsetMinutes(tz, local), offsetMinutes(tz, local + DAY)]),
  );
  const matches: number[] = [];
  for (const o of offsets) {
    const e = local - o * 60000;
    const back = wallTime(tz, e);
    if (back.y === w.y && back.m === w.m && back.d === w.d && back.h === w.h && back.mi === w.mi && back.s === w.s) {
      if (!matches.includes(e)) matches.push(e);
    }
  }
  matches.sort((a, b) => a - b);
  if (matches.length === 1) return { epoch: matches[0], kind: "exact" };
  if (matches.length > 1) return { epoch: matches[0], kind: "overlap", alternate: matches[matches.length - 1] };
  // Gap: use the offset in force before the transition.
  const before = offsetMinutes(tz, local - DAY);
  return { epoch: local - before * 60000, kind: "gap" };
}

export function formatOffset(min: number): string {
  if (min === 0) return "UTC+00:00";
  const sign = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

/** Short zone name such as "EDT" or "GMT+9", as the browser's locale data provides it. */
export function zoneAbbrev(tz: string, epoch: number, locale = "en-US"): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(epoch));
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function zoneLongName(tz: string, epoch: number): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" }).formatToParts(new Date(epoch));
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** "+5 h 30 min", "-3 h", "same time". */
export function describeDiff(minutes: number): string {
  if (minutes === 0) return "same time";
  const sign = minutes > 0 ? "+" : "-";
  const a = Math.abs(minutes);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${h ? `${h} h` : ""}${h && m ? " " : ""}${m ? `${m} min` : ""}`;
}

/** Ranked search over zone ids and keywords. Every query word must match. */
export function searchZones(query: string, zones: string[] = listTimeZones()): string[] {
  const words = query.toLowerCase().replace(/[_/,]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return zones;
  const scored: { z: string; score: number }[] = [];
  for (const z of zones) {
    const id = z.toLowerCase().replace(/[_/]/g, " ");
    const hay = `${id} ${ZONE_KEYWORDS[z] ?? ""}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const city = zoneCity(z).toLowerCase();
    const kw = (ZONE_KEYWORDS[z] ?? "").split(" ");
    let score = 3;
    if (kw.includes(words[0]) || city === query.trim().toLowerCase()) score = -1;
    else if (city.startsWith(words[0])) score = 0;
    else if (id.split(" ").some((p) => p.startsWith(words[0]))) score = 1;
    else if (kw.some((p) => p.startsWith(words[0]))) score = 2;
    scored.push({ z, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.z.localeCompare(b.z)).map((s) => s.z);
}

const p2 = (n: number) => String(n).padStart(2, "0");

export function formatWallTime(w: Wall, hour12 = false, seconds = false): string {
  const sec = seconds ? `:${p2(w.s)}` : "";
  if (!hour12) return `${p2(w.h)}:${p2(w.mi)}${sec}`;
  const h = w.h % 12 || 12;
  return `${h}:${p2(w.mi)}${sec} ${w.h < 12 ? "AM" : "PM"}`;
}
