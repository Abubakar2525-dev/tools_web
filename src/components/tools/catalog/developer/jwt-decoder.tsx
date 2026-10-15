"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, OutputBlock, PrivacyNote, ResetBtn, SplitGrid, TextArea, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { CLAIM_NAMES, TIME_CLAIMS, base64UrlDecode, decodeJwt, relativeTime, timeStatus } from "./lib/jwt";
import { errorMessage, useNow, useRunGuard } from "./shared";

// Example token signed with HS256 and the secret "stratum-demo-secret". Its exp is in 2036.
const SAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzQyIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2MDI2NDAwMCwiZXhwIjoyMDgyNzU4NDAwfQ.yfywxPzXpv3SDqqAbw9gRyHkV8E_CgDsFcbBr_hmQho";

type Verify = { kind: "ok"; alg: string } | { kind: "fail"; message: string } | null;

const SYMMETRIC = /^HS(256|384|512)$/;
const ASYMMETRIC = /^(RS|PS|ES)(256|384|512)$|^EdDSA$|^ES256K$|^Ed25519$/;

async function verifySignature(token: string, alg: string, keyText: string, secretIsB64: boolean, kid: unknown): Promise<string> {
  const jose = await import("jose");
  let key: Uint8Array | CryptoKey;
  const k = keyText.trim();
  if (SYMMETRIC.test(alg)) {
    if (!k) throw new Error("Enter the shared secret.");
    key = secretIsB64 ? base64UrlDecode(k.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")) : new TextEncoder().encode(k);
  } else if (ASYMMETRIC.test(alg)) {
    if (!k) throw new Error("Paste the public key (PEM, X.509 certificate, JWK or JWKS).");
    if (k.includes("PRIVATE KEY")) throw new Error("That is a private key. Verification needs only the public key; never paste private keys into web pages.");
    if (k.startsWith("-----BEGIN CERTIFICATE")) key = await jose.importX509(k, alg);
    else if (k.startsWith("-----BEGIN")) key = await jose.importSPKI(k, alg);
    else {
      let jwk: unknown;
      try {
        jwk = JSON.parse(k);
      } catch {
        throw new Error("The key is not PEM and not valid JSON (JWK).");
      }
      const set = jwk && typeof jwk === "object" && Array.isArray((jwk as { keys?: unknown }).keys) ? ((jwk as { keys: Record<string, unknown>[] }).keys) : [jwk as Record<string, unknown>];
      const pick = set.find((x) => kid !== undefined && x.kid === kid) ?? (set.length === 1 ? set[0] : set.find((x) => x.alg === alg));
      if (!pick) throw new Error("No key in the JWKS matches this token's kid or alg.");
      if ("d" in pick) throw new Error("This JWK contains a private part (d). Use the public key only.");
      const imported = await jose.importJWK(pick as Parameters<typeof jose.importJWK>[0], alg);
      key = imported as CryptoKey | Uint8Array;
    }
  } else {
    throw new Error(alg === "none" ? 'The token uses alg "none": it has no signature and must never be trusted.' : `Algorithm ${alg} is not supported here.`);
  }
  const res = await jose.compactVerify(token, key, { algorithms: [alg] });
  return res.protectedHeader.alg;
}

function fmtTime(sec: number, now: number | null) {
  const d = new Date(sec * 1000);
  if (Number.isNaN(d.getTime())) return String(sec);
  return `${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" })} (${d.toISOString()})${now !== null ? `, ${relativeTime(sec, Math.floor(now / 1000))}` : ""}`;
}

export default function Tool() {
  const [token, setToken] = useState("");
  const [keyText, setKeyText] = useState("");
  const [b64, setB64] = useState(false);
  const [verify, setVerify] = useState<Verify>(null);
  const [busy, setBusy] = useState(false);
  const guard = useRunGuard();
  const now = useNow(1000);
  const dToken = useDeferredValue(token);

  const decoded = useMemo(() => {
    if (!dToken.trim()) return null;
    try {
      return { ok: true as const, value: decodeJwt(dToken) };
    } catch (e) {
      return { ok: false as const, message: errorMessage(e) };
    }
  }, [dToken]);

  const alg = decoded?.ok ? String(decoded.value.header.alg ?? "") : "";
  const status = decoded?.ok && now !== null ? timeStatus(decoded.value.payload, Math.floor(now / 1000)) : null;

  const runVerify = async () => {
    if (!decoded?.ok) return;
    const token0 = guard.start();
    setBusy(true);
    try {
      const a = await verifySignature(token.trim().replace(/^Bearer\s+/i, ""), alg, keyText, b64, decoded.value.header.kid);
      if (guard.isCurrent(token0)) setVerify({ kind: "ok", alg: a });
    } catch (e) {
      if (!guard.isCurrent(token0)) return;
      const code = (e as { code?: string }).code;
      setVerify({ kind: "fail", message: code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ? "Signature does not match. The key is wrong or the token was altered." : errorMessage(e) });
    } finally {
      if (guard.isCurrent(token0)) setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Notice tone="warning" title="Decoding is not verification">
        Anyone can read a JWT&apos;s header and payload. Only a successful signature check below shows the token was issued by the key holder. Avoid pasting live production tokens or secrets into any website.
      </Notice>
      <SplitGrid>
        <ToolPanel
          title="Token"
          actions={
            <>
              <Btn
                variant="ghost"
                icon="token"
                onClick={() => {
                  setToken(SAMPLE);
                  setKeyText("stratum-demo-secret");
                  setB64(false);
                  setVerify(null);
                }}
              >
                Load sample
              </Btn>
              <ResetBtn
                onClick={() => {
                  setToken("");
                  setKeyText("");
                  setVerify(null);
                }}
              />
            </>
          }
        >
          <div className="space-y-4">
            <TextArea
              label="JWT"
              mono
              rows={7}
              placeholder="eyJhbGciOi..."
              value={token}
              error={decoded && !decoded.ok ? decoded.message : null}
              hint='A "Bearer " prefix is ignored.'
              onChange={(e) => {
                setToken(e.target.value);
                setVerify(null);
              }}
            />
            {decoded?.ok && (
              <div className="space-y-3 border-t border-line pt-4">
                <p className="text-sm font-medium text-ink">Verify signature ({alg || "no alg"})</p>
                <TextArea
                  label={SYMMETRIC.test(alg) ? "Shared secret" : "Public key"}
                  mono
                  rows={SYMMETRIC.test(alg) ? 2 : 6}
                  hint={SYMMETRIC.test(alg) ? "The HMAC secret the issuer used." : "PEM (-----BEGIN PUBLIC KEY-----), X.509 certificate, JWK or JWKS JSON."}
                  value={keyText}
                  onChange={(e) => {
                    setKeyText(e.target.value);
                    setVerify(null);
                  }}
                />
                {SYMMETRIC.test(alg) && <Checkbox label="Secret is base64 or base64url encoded" checked={b64} onChange={setB64} />}
                <div className="flex flex-wrap items-center gap-3">
                  <Btn icon="shield" onClick={() => void runVerify()} disabled={busy}>
                    Verify signature
                  </Btn>
                  {busy && <Spinner label="Verifying" />}
                </div>
                {verify?.kind === "ok" && (
                  <Notice tone="success" title="Signature verified">
                    The {verify.alg} signature matches this key.{status?.expired ? " Note: the token is expired, so a server should still reject it." : ""}
                  </Notice>
                )}
                {verify?.kind === "fail" && (
                  <Notice tone="error" title="Not verified">
                    {verify.message}
                  </Notice>
                )}
              </div>
            )}
          </div>
        </ToolPanel>
        <ToolPanel title="Decoded (unverified)">
          {!decoded ? (
            <EmptyState icon="token" title="Paste a token">
              The header and payload are decoded as you type.
            </EmptyState>
          ) : !decoded.ok ? (
            <Notice tone="error">{decoded.message}</Notice>
          ) : (
            <div className="space-y-4">
              {status && (status.expired || status.notYetValid) ? (
                <Notice tone="error">{status.expired ? "Expired: the exp time has passed." : "Not valid yet: the nbf time is in the future."}</Notice>
              ) : decoded.value.payload && "exp" in decoded.value.payload ? (
                <Notice tone="success">Within its validity window right now.</Notice>
              ) : (
                <Notice>No exp claim: this token never expires on its own.</Notice>
              )}
              {alg === "none" && <Notice tone="error">alg is &quot;none&quot;: the token is unsigned and must not be trusted.</Notice>}
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Header</p>
                <OutputBlock label="Header JSON">
                  <code>{JSON.stringify(decoded.value.header, null, 2)}</code>
                </OutputBlock>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Payload</p>
                <OutputBlock label="Payload JSON">
                  <code>{decoded.value.payload ? JSON.stringify(decoded.value.payload, null, 2) : decoded.value.payloadText}</code>
                </OutputBlock>
              </div>
              {decoded.value.payload && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[0.875rem]">
                    <caption className="mb-2 text-left text-sm font-medium text-ink">Claims</caption>
                    <tbody>
                      {Object.entries(decoded.value.payload).map(([k, v]) => (
                        <tr key={k} className="border-t border-line align-top">
                          <th scope="row" className="py-2 pr-4 font-mono font-normal">
                            {k}
                            {CLAIM_NAMES[k] && <span className="block font-sans text-[0.75rem] text-muted">{CLAIM_NAMES[k]}</span>}
                          </th>
                          <td className="break-all py-2">{TIME_CLAIMS.includes(k) && typeof v === "number" ? fmtTime(v, now) : typeof v === "string" ? v : JSON.stringify(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[0.8125rem] text-muted">Signature: {decoded.value.signatureBytes} bytes{decoded.value.signatureBytes === 0 ? " (empty)" : ""}.</p>
            </div>
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
