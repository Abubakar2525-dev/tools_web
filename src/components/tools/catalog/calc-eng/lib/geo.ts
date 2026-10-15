/**
 * Geodesy helpers on WGS84: coordinate parsing (DD, DMS, DDM), formatting,
 * UTM forward/inverse (Krüger series to n^6, after Karney 2011), haversine,
 * Vincenty inverse, bearings, midpoint and destination point.
 * Pure functions, no React.
 */

export const WGS84 = { a: 6378137, f: 1 / 298.257223563 };
/** IUGG mean Earth radius R1 in meters. */
export const MEAN_RADIUS = 6371008.8;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
export const wrap360 = (d: number) => ((d % 360) + 360) % 360;
export const wrap180 = (d: number) => {
  const x = wrap360(d + 180) - 180;
  return x === -180 && d > 0 ? 180 : x;
};

export type LatLon = { lat: number; lon: number };

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

type Tok = { kind: "num"; text: string; value: number } | { kind: "hem"; text: string };

function tokenize(input: string): Tok[] | string {
  // Normalize degree/minute/second symbols and separators to spaces.
  const s = input
    .replace(/[°º˚∘]/g, " ")
    .replace(/(\d)\s*[dD](?![a-zA-Z])/g, "$1 ")
    .replace(/['′’‘`]{2}|["″”“]/g, " ")
    .replace(/['′’‘`]/g, " ")
    .replace(/[;,/|]/g, " , ")
    .replace(/\b(north|south|east|west)\b/gi, (m) => m[0])
    .trim();
  const toks: Tok[] = [];
  const re = /([-+−]?\d+(?:\.\d*)?|[-+−]?\.\d+)|([NSEWnsew])|(,)|(\S)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[1]) {
      const t = m[1].replace("−", "-");
      toks.push({ kind: "num", text: t, value: Number(t) });
    } else if (m[2]) toks.push({ kind: "hem", text: m[2].toUpperCase() });
    else if (m[3]) toks.push({ kind: "num", text: ",", value: NaN });
    else return `Unexpected character "${m[4]}".`;
  }
  return toks;
}

type Part = { nums: Tok[]; hem: string | null };

function partToDegrees(p: Part, label: string): number | string {
  const nums = p.nums.filter((t) => t.kind === "num") as Extract<Tok, { kind: "num" }>[];
  if (nums.length < 1 || nums.length > 3) return `Could not read the ${label}: expected degrees, optional minutes and seconds.`;
  const negative = nums[0].text.startsWith("-");
  if (nums.slice(1).some((n) => n.text.startsWith("-") || n.text.startsWith("+")))
    return `Only the degrees of the ${label} may carry a sign.`;
  const [d, m = 0, s = 0] = nums.map((n) => Math.abs(n.value));
  if (nums.length >= 2 && !Number.isInteger(d)) return `The ${label} has decimal degrees and minutes; use one or the other.`;
  if (nums.length === 3 && !Number.isInteger(m)) return `The ${label} has decimal minutes and seconds; use one or the other.`;
  if (m >= 60) return `Minutes in the ${label} must be less than 60.`;
  if (s >= 60) return `Seconds in the ${label} must be less than 60.`;
  let deg = d + m / 60 + s / 3600;
  if (negative) deg = -deg;
  if (p.hem) {
    if (negative) return `The ${label} has both a minus sign and a hemisphere letter.`;
    if (p.hem === "S" || p.hem === "W") deg = -deg;
  }
  return deg;
}

/**
 * Parses a coordinate pair in DD, DDM or DMS, with signs or N/S/E/W letters
 * (prefix or suffix), with or without symbols. Order is latitude, longitude
 * unless hemisphere letters say otherwise.
 */
export function parseLatLon(input: string): LatLon | string {
  if (!input.trim()) return "Enter a coordinate.";
  const toks = tokenize(input);
  if (typeof toks === "string") return toks;
  const hems = toks.filter((t) => t.kind === "hem");
  let parts: Part[] = [];
  const nums = () => toks.filter((t) => t.kind === "num" && t.text !== ",");

  if (hems.length === 2) {
    const prefix = toks[0].kind === "hem";
    let cur: Part = { nums: [], hem: null };
    for (const t of toks) {
      if (t.kind === "num" && t.text === ",") continue;
      if (t.kind === "hem") {
        if (prefix) {
          if (cur.hem || cur.nums.length) parts.push(cur);
          cur = { nums: [], hem: t.text };
        } else {
          cur.hem = t.text;
          parts.push(cur);
          cur = { nums: [], hem: null };
        }
      } else cur.nums.push(t);
    }
    if (prefix) parts.push(cur);
    else if (cur.nums.length) return "Found numbers after the last hemisphere letter.";
  } else if (hems.length === 0) {
    const commaIdx = toks.findIndex((t) => t.kind === "num" && t.text === ",");
    const all = nums();
    if (commaIdx >= 0 && toks.filter((t) => t.kind === "num" && t.text === ",").length === 1) {
      parts = [
        { nums: toks.slice(0, commaIdx), hem: null },
        { nums: toks.slice(commaIdx + 1), hem: null },
      ];
    } else if (all.length === 2 || all.length === 4 || all.length === 6) {
      const k = all.length / 2;
      parts = [
        { nums: all.slice(0, k), hem: null },
        { nums: all.slice(k), hem: null },
      ];
    } else return "Could not split this into latitude and longitude. Separate them with a comma.";
  } else return "Use a hemisphere letter on both values or on neither.";

  if (parts.length !== 2) return "Expected exactly two values: latitude and longitude.";
  let latPart = parts[0];
  let lonPart = parts[1];
  if (latPart.hem && lonPart.hem) {
    const isLat = (h: string) => h === "N" || h === "S";
    if (isLat(latPart.hem) === isLat(lonPart.hem)) return "One value needs N/S and the other E/W.";
    if (!isLat(latPart.hem)) [latPart, lonPart] = [lonPart, latPart];
  }
  const lat = partToDegrees(latPart, "latitude");
  if (typeof lat === "string") return lat;
  const lon = partToDegrees(lonPart, "longitude");
  if (typeof lon === "string") return lon;
  if (Math.abs(lat) > 90) return "Latitude must be between -90 and 90 degrees.";
  if (Math.abs(lon) > 180) return "Longitude must be between -180 and 180 degrees.";
  return { lat, lon };
}

/** Parses one angle such as `45`, `45° 30'`, `N 12 30 15`, `-12.5`. */
export function parseAngle(input: string, kind: "lat" | "lon" | "any" = "any"): number | string {
  const toks = tokenize(input);
  if (typeof toks === "string") return toks;
  const hems = toks.filter((t) => t.kind === "hem");
  if (hems.length > 1) return "Use at most one hemisphere letter.";
  const hem = hems[0]?.text ?? null;
  if (hem && kind === "lat" && !(hem === "N" || hem === "S")) return "Latitude takes N or S.";
  if (hem && kind === "lon" && !(hem === "E" || hem === "W")) return "Longitude takes E or W.";
  const v = partToDegrees({ nums: toks.filter((t) => t.kind === "num" && t.text !== ","), hem }, kind === "lat" ? "latitude" : kind === "lon" ? "longitude" : "angle");
  if (typeof v === "string") return v;
  if (kind === "lat" && Math.abs(v) > 90) return "Latitude must be between -90 and 90 degrees.";
  if (kind === "lon" && Math.abs(v) > 180) return "Longitude must be between -180 and 180 degrees.";
  return v;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Degrees, minutes, seconds with hemisphere letter, e.g. 40° 42′ 46.08″ N. */
export function formatDMS(deg: number, axis: "lat" | "lon", secDecimals = 2): string {
  const hem = axis === "lat" ? (deg < 0 ? "S" : "N") : deg < 0 ? "W" : "E";
  const scale = 10 ** secDecimals;
  let totalSec = Math.round(Math.abs(deg) * 3600 * scale) / scale;
  const d = Math.floor(totalSec / 3600 + 1e-12);
  totalSec -= d * 3600;
  const m = Math.floor(totalSec / 60 + 1e-12);
  const s = Math.max(0, totalSec - m * 60);
  return `${d}° ${String(m).padStart(2, "0")}′ ${s.toFixed(secDecimals).padStart(secDecimals ? secDecimals + 3 : 2, "0")}″ ${hem}`;
}

/** Degrees and decimal minutes, e.g. 40° 42.7680′ N. */
export function formatDDM(deg: number, axis: "lat" | "lon", minDecimals = 4): string {
  const hem = axis === "lat" ? (deg < 0 ? "S" : "N") : deg < 0 ? "W" : "E";
  const scale = 10 ** minDecimals;
  const totalMin = Math.round(Math.abs(deg) * 60 * scale) / scale;
  const d = Math.floor(totalMin / 60 + 1e-12);
  const m = Math.max(0, totalMin - d * 60);
  return `${d}° ${m.toFixed(minDecimals).padStart(minDecimals + 3, "0")}′ ${hem}`;
}

export const formatDD = (deg: number, decimals = 6) => deg.toFixed(decimals);

/* ------------------------------------------------------------------ */
/* UTM                                                                 */
/* ------------------------------------------------------------------ */

const K0 = 0.9996;
const BANDS = "CDEFGHJKLMNPQRSTUVWX";

export type Utm = { zone: number; band: string; hemisphere: "N" | "S"; easting: number; northing: number; convergence: number; scale: number };

function series() {
  const { a, f } = WGS84;
  const e = Math.sqrt(f * (2 - f));
  const n = f / (2 - f);
  const n2 = n * n,
    n3 = n2 * n,
    n4 = n3 * n,
    n5 = n4 * n,
    n6 = n5 * n;
  const A = (a / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
  const alpha = [
    0,
    n / 2 - (2 / 3) * n2 + (5 / 16) * n3 + (41 / 180) * n4 - (127 / 288) * n5 + (7891 / 37800) * n6,
    (13 / 48) * n2 - (3 / 5) * n3 + (557 / 1440) * n4 + (281 / 630) * n5 - (1983433 / 1935360) * n6,
    (61 / 240) * n3 - (103 / 140) * n4 + (15061 / 26880) * n5 + (167603 / 181440) * n6,
    (49561 / 161280) * n4 - (179 / 168) * n5 + (6601661 / 7257600) * n6,
    (34729 / 80640) * n5 - (3418889 / 1995840) * n6,
    (212378941 / 319334400) * n6,
  ];
  const beta = [
    0,
    n / 2 - (2 / 3) * n2 + (37 / 96) * n3 - (1 / 360) * n4 - (81 / 512) * n5 + (96199 / 604800) * n6,
    (1 / 48) * n2 + (1 / 15) * n3 - (437 / 1440) * n4 + (46 / 105) * n5 - (1118711 / 3870720) * n6,
    (17 / 480) * n3 - (37 / 840) * n4 - (209 / 4480) * n5 + (5569 / 90720) * n6,
    (4397 / 161280) * n4 - (11 / 504) * n5 - (830251 / 7257600) * n6,
    (4583 / 161280) * n5 - (108847 / 3991680) * n6,
    (20648693 / 638668800) * n6,
  ];
  return { e, A, alpha, beta };
}
const S = series();

/** Standard UTM zone including the Norway (32V) and Svalbard (31X-37X) exceptions. */
export function utmZone(lat: number, lon: number): number {
  let zone = Math.floor((wrap180(lon) + 180) / 6) + 1;
  if (zone > 60) zone = 60;
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) zone = 32;
  if (lat >= 72 && lat <= 84 && lon >= 0 && lon < 42) {
    if (lon < 9) zone = 31;
    else if (lon < 21) zone = 33;
    else if (lon < 33) zone = 35;
    else zone = 37;
  }
  return zone;
}

export function utmBand(lat: number): string {
  if (lat >= 72) return "X";
  return BANDS[Math.floor((lat + 80) / 8)];
}

/** Forward projection. `forceZone` lets you project into a neighbouring zone. */
export function toUtm(lat: number, lon: number, forceZone?: number): Utm | string {
  if (lat < -80 || lat > 84) return "UTM covers latitudes from 80° S to 84° N. Polar areas use UPS, which this tool does not convert.";
  const zone = forceZone ?? utmZone(lat, lon);
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const φ = toRad(lat);
  const λ = toRad(wrap180(lon - lon0));
  const { e, A, alpha } = S;
  const cosλ = Math.cos(λ),
    sinλ = Math.sin(λ),
    tanλ = Math.tan(λ);
  const τ = Math.tan(φ);
  const σ = Math.sinh(e * Math.atanh((e * τ) / Math.sqrt(1 + τ * τ)));
  const τp = τ * Math.sqrt(1 + σ * σ) - σ * Math.sqrt(1 + τ * τ);
  const ξp = Math.atan2(τp, cosλ);
  const ηp = Math.asinh(sinλ / Math.sqrt(τp * τp + cosλ * cosλ));
  let ξ = ξp,
    η = ηp;
  let pp = 1,
    qp = 0;
  for (let j = 1; j <= 6; j++) {
    ξ += alpha[j] * Math.sin(2 * j * ξp) * Math.cosh(2 * j * ηp);
    η += alpha[j] * Math.cos(2 * j * ξp) * Math.sinh(2 * j * ηp);
    pp += 2 * j * alpha[j] * Math.cos(2 * j * ξp) * Math.cosh(2 * j * ηp);
    qp += 2 * j * alpha[j] * Math.sin(2 * j * ξp) * Math.sinh(2 * j * ηp);
  }
  const x = K0 * A * η;
  let y = K0 * A * ξ;
  // Convergence and point scale
  const γp = Math.atan((τp / Math.sqrt(1 + τp * τp)) * tanλ);
  const γpp = Math.atan2(qp, pp);
  const γ = γp + γpp;
  const sinφ = Math.sin(φ);
  const kp = (Math.sqrt(1 - e * e * sinφ * sinφ) * Math.sqrt(1 + τ * τ)) / Math.sqrt(τp * τp + cosλ * cosλ);
  const kpp = (A / WGS84.a) * Math.sqrt(pp * pp + qp * qp);
  const k = K0 * kp * kpp;
  const hemisphere = lat >= 0 ? "N" : "S";
  if (hemisphere === "S") y += 10000000;
  return { zone, band: utmBand(lat), hemisphere, easting: x + 500000, northing: y, convergence: toDeg(γ), scale: k };
}

/** Inverse projection. */
export function fromUtm(zone: number, hemisphere: "N" | "S", easting: number, northing: number): LatLon | string {
  if (!Number.isInteger(zone) || zone < 1 || zone > 60) return "Zone must be a whole number from 1 to 60.";
  if (easting < 100000 || easting > 900000) return "Easting is normally between 100,000 and 900,000 m (about 167,000 to 833,000 within a zone).";
  if (northing < 0 || northing > 10000000) return "Northing must be between 0 and 10,000,000 m.";
  const { e, A, beta } = S;
  const x = easting - 500000;
  const y = hemisphere === "S" ? northing - 10000000 : northing;
  const ξ = y / (K0 * A);
  const η = x / (K0 * A);
  let ξp = ξ,
    ηp = η;
  for (let j = 1; j <= 6; j++) {
    ξp -= beta[j] * Math.sin(2 * j * ξ) * Math.cosh(2 * j * η);
    ηp -= beta[j] * Math.cos(2 * j * ξ) * Math.sinh(2 * j * η);
  }
  const sinhηp = Math.sinh(ηp);
  const sinξp = Math.sin(ξp),
    cosξp = Math.cos(ξp);
  const τp = sinξp / Math.sqrt(sinhηp * sinhηp + cosξp * cosξp);
  let τi = τp;
  for (let iter = 0; iter < 20; iter++) {
    const σi = Math.sinh(e * Math.atanh((e * τi) / Math.sqrt(1 + τi * τi)));
    const τip = τi * Math.sqrt(1 + σi * σi) - σi * Math.sqrt(1 + τi * τi);
    const δ = ((τp - τip) / Math.sqrt(1 + τip * τip)) * ((1 + (1 - e * e) * τi * τi) / ((1 - e * e) * Math.sqrt(1 + τi * τi)));
    τi += δ;
    if (Math.abs(δ) < 1e-13) break;
  }
  const φ = Math.atan(τi);
  const λ = Math.atan2(sinhηp, cosξp);
  const lon0 = (zone - 1) * 6 - 180 + 3;
  return { lat: toDeg(φ), lon: wrap180(toDeg(λ) + lon0) };
}

/** Parses "18T 585628 4511322", "18 N 585628 4511322", "zone 33 south 500000 4649776". */
export function parseUtm(input: string): { zone: number; hemisphere: "N" | "S"; band: string | null; easting: number; northing: number } | string {
  const s = input
    .trim()
    .replace(/,/g, " ")
    .replace(/\bzone\b/gi, " ")
    .replace(/\b(m|mE|mN)\b/g, " ");
  const m = /^(\d{1,2})\s*([a-zA-Z]+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/.exec(s.replace(/\s+/g, " ").trim());
  if (!m) return "Use the form: zone and band, easting, northing (for example 18T 585628 4511322).";
  const zone = Number(m[1]);
  const word = (m[2] ?? "").toLowerCase();
  let hemisphere: "N" | "S";
  let band: string | null = null;
  if (word === "north") hemisphere = "N";
  else if (word === "south") hemisphere = "S";
  else if (word.length === 1 && BANDS.includes(word.toUpperCase())) {
    band = word.toUpperCase();
    hemisphere = band >= "N" ? "N" : "S";
  } else if (word === "") return "Add a latitude band letter (C to X) or the word north/south after the zone.";
  else return `"${m[2]}" is not a latitude band (C to X, without I and O).`;
  return { zone, hemisphere, band, easting: Number(m[3]), northing: Number(m[4]) };
}

/* ------------------------------------------------------------------ */
/* Distances and bearings                                              */
/* ------------------------------------------------------------------ */

/** Great-circle distance in meters on a sphere of radius R. */
export function haversine(p1: LatLon, p2: LatLon, R = MEAN_RADIUS): number {
  const φ1 = toRad(p1.lat),
    φ2 = toRad(p2.lat);
  const Δφ = φ2 - φ1;
  const Δλ = toRad(p2.lon - p1.lon);
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type VincentyResult =
  | { ok: true; distance: number; initialBearing: number; finalBearing: number; iterations: number }
  | { ok: false; reason: string };

/** Vincenty inverse on the WGS84 ellipsoid. Fails to converge for nearly antipodal points. */
export function vincentyInverse(p1: LatLon, p2: LatLon): VincentyResult {
  const { a, f } = WGS84;
  const b = a * (1 - f);
  const L = toRad(p2.lon - p1.lon);
  const U1 = Math.atan((1 - f) * Math.tan(toRad(p1.lat)));
  const U2 = Math.atan((1 - f) * Math.tan(toRad(p2.lat)));
  const sinU1 = Math.sin(U1),
    cosU1 = Math.cos(U1),
    sinU2 = Math.sin(U2),
    cosU2 = Math.cos(U2);
  let λ = L;
  let sinλ = 0,
    cosλ = 0,
    sinσ = 0,
    cosσ = 0,
    σ = 0,
    cos2α = 0,
    cos2σm = 0;
  let iter = 0;
  let converged = false;
  if (p1.lat === p2.lat && p1.lon === p2.lon) return { ok: true, distance: 0, initialBearing: NaN, finalBearing: NaN, iterations: 0 };
  while (iter++ < 200) {
    sinλ = Math.sin(λ);
    cosλ = Math.cos(λ);
    const sinSqσ = (cosU2 * sinλ) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) ** 2;
    if (sinSqσ === 0) return { ok: true, distance: 0, initialBearing: NaN, finalBearing: NaN, iterations: iter };
    sinσ = Math.sqrt(sinSqσ);
    cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
    σ = Math.atan2(sinσ, cosσ);
    const sinα = (cosU1 * cosU2 * sinλ) / sinσ;
    cos2α = 1 - sinα * sinα;
    cos2σm = cos2α !== 0 ? cosσ - (2 * sinU1 * sinU2) / cos2α : 0;
    const C = (f / 16) * cos2α * (4 + f * (4 - 3 * cos2α));
    const λp = λ;
    λ = L + (1 - C) * f * sinα * (σ + C * sinσ * (cos2σm + C * cosσ * (-1 + 2 * cos2σm * cos2σm)));
    if (Math.abs(λ) > Math.PI + 1e-9 && Math.abs(L) <= Math.PI) {
      return { ok: false, reason: "The points are nearly antipodal, so Vincenty's method does not converge." };
    }
    if (Math.abs(λ - λp) < 1e-12) {
      converged = true;
      break;
    }
  }
  if (!converged) return { ok: false, reason: "The points are nearly antipodal, so Vincenty's method does not converge." };
  const uSq = (cos2α * (a * a - b * b)) / (b * b);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const Δσ =
    B *
    sinσ *
    (cos2σm + (B / 4) * (cosσ * (-1 + 2 * cos2σm * cos2σm) - (B / 6) * cos2σm * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σm * cos2σm)));
  const s = b * A * (σ - Δσ);
  const α1 = Math.atan2(cosU2 * sinλ, cosU1 * sinU2 - sinU1 * cosU2 * cosλ);
  const α2 = Math.atan2(cosU1 * sinλ, -sinU1 * cosU2 + cosU1 * sinU2 * cosλ);
  return { ok: true, distance: s, initialBearing: wrap360(toDeg(α1)), finalBearing: wrap360(toDeg(α2)), iterations: iter };
}

/** Initial great-circle bearing (forward azimuth) from p1 to p2, degrees from true north. */
export function initialBearing(p1: LatLon, p2: LatLon): number {
  const φ1 = toRad(p1.lat),
    φ2 = toRad(p2.lat);
  const Δλ = toRad(p2.lon - p1.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return wrap360(toDeg(Math.atan2(y, x)));
}

/** Bearing on arrival at p2 when following the great circle from p1. */
export function finalBearing(p1: LatLon, p2: LatLon): number {
  return wrap360(initialBearing(p2, p1) + 180);
}

export function midpoint(p1: LatLon, p2: LatLon): LatLon {
  const φ1 = toRad(p1.lat),
    φ2 = toRad(p2.lat),
    λ1 = toRad(p1.lon);
  const Δλ = toRad(p2.lon - p1.lon);
  const Bx = Math.cos(φ2) * Math.cos(Δλ);
  const By = Math.cos(φ2) * Math.sin(Δλ);
  const φm = Math.atan2(Math.sin(φ1) + Math.sin(φ2), Math.sqrt((Math.cos(φ1) + Bx) ** 2 + By * By));
  const λm = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);
  return { lat: toDeg(φm), lon: wrap180(toDeg(λm)) };
}

/** Destination along a great circle on a sphere. */
export function destination(p: LatLon, bearingDeg: number, distance: number, R = MEAN_RADIUS): LatLon {
  const δ = distance / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(p.lat),
    λ1 = toRad(p.lon);
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(Math.max(-1, Math.min(1, sinφ2)));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * sinφ2);
  return { lat: toDeg(φ2), lon: wrap180(toDeg(λ2)) };
}

const POINTS16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compassPoint = (deg: number) => POINTS16[Math.round(wrap360(deg) / 22.5) % 16];
