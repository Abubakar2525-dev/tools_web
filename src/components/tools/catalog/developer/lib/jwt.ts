/** JWT decoding helpers (no verification) and claim formatting. */

export function base64UrlDecode(seg: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(seg)) throw new Error("contains characters outside base64url (A-Z, a-z, 0-9, - and _)");
  const b64 = seg.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((seg.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown> | null;
  /** Raw payload text when it is not JSON (rare, for example JWS with a text payload). */
  payloadText: string;
  signatureBytes: number;
  parts: [string, string, string];
}

export function decodeJwt(token: string): DecodedJwt {
  const t = token.trim().replace(/^Bearer\s+/i, "");
  const parts = t.split(".");
  if (parts.length === 5) throw new Error("This looks like an encrypted JWT (JWE, five parts). Its payload cannot be read without the decryption key.");
  if (parts.length !== 3) throw new Error(`A JWT has three parts separated by dots; this has ${parts.length}.`);
  const dec = new TextDecoder("utf-8", { fatal: false });
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(dec.decode(base64UrlDecode(parts[0]))) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`The header is not valid base64url JSON: ${e instanceof Error ? e.message : String(e)}.`);
  }
  if (!header || typeof header !== "object" || Array.isArray(header)) throw new Error("The header must be a JSON object.");
  let payloadText: string;
  try {
    payloadText = dec.decode(base64UrlDecode(parts[1]));
  } catch (e) {
    throw new Error(`The payload is not valid base64url: ${e instanceof Error ? e.message : String(e)}.`);
  }
  let payload: Record<string, unknown> | null = null;
  try {
    const p: unknown = JSON.parse(payloadText);
    if (p && typeof p === "object" && !Array.isArray(p)) payload = p as Record<string, unknown>;
  } catch {
    payload = null;
  }
  let signatureBytes = 0;
  try {
    signatureBytes = base64UrlDecode(parts[2]).length;
  } catch {
    throw new Error("The signature part is not valid base64url.");
  }
  return { header, payload, payloadText, signatureBytes, parts: parts as [string, string, string] };
}

export function relativeTime(target: number, now: number): string {
  const diff = target - now;
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [365 * 24 * 3600, "year"],
    [30 * 24 * 3600, "month"],
    [24 * 3600, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  for (const [secs, name] of units) {
    if (abs >= secs || secs === 1) {
      const n = Math.floor(abs / secs);
      const label = `${n} ${name}${n === 1 ? "" : "s"}`;
      return diff >= 0 ? `in ${label}` : `${label} ago`;
    }
  }
  return "now";
}

export const CLAIM_NAMES: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expires",
  nbf: "Not before",
  iat: "Issued at",
  jti: "JWT ID",
  azp: "Authorized party",
  scope: "Scope",
  nonce: "Nonce",
  auth_time: "Authentication time",
  sid: "Session ID",
};

export const TIME_CLAIMS = ["exp", "nbf", "iat", "auth_time"];

export interface TimeStatus {
  expired: boolean;
  notYetValid: boolean;
}

export function timeStatus(payload: Record<string, unknown> | null, nowSec: number, leeway = 0): TimeStatus {
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  const nbf = typeof payload?.nbf === "number" ? payload.nbf : null;
  return { expired: exp !== null && nowSec > exp + leeway, notYetValid: nbf !== null && nowSec + leeway < nbf };
}
