"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, NumberField, OutputBlock, PrivacyNote, ResetBtn, SelectField, SplitGrid, TextArea, TextField, ToolPanel, parseNum } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { base64UrlDecode, base64UrlEncode } from "./lib/jwt";
import { errorMessage, parseJson, useRunGuard } from "./shared";

const ALGS = ["HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "ES256", "ES384", "EdDSA"] as const;
type Alg = (typeof ALGS)[number];
const isHmac = (a: Alg) => a.startsWith("HS");

const DEFAULT_PAYLOAD = `{
  "sub": "user_123",
  "name": "Test User",
  "role": "editor"
}`;

type Out = { kind: "ok"; token: string; header: string; payload: string } | { kind: "error"; message: string };

export default function Tool() {
  const [alg, setAlg] = useState<Alg>("HS256");
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [kid, setKid] = useState("");
  const [secret, setSecret] = useState("");
  const [secretB64, setSecretB64] = useState(false);
  const [privPem, setPrivPem] = useState("");
  const [pubPem, setPubPem] = useState("");
  const [pubJwk, setPubJwk] = useState("");
  const [addIat, setAddIat] = useState(true);
  const [expOn, setExpOn] = useState(true);
  const [expAmount, setExpAmount] = useState("1");
  const [expUnit, setExpUnit] = useState("h");
  const [addJti, setAddJti] = useState(false);
  const [out, setOut] = useState<Out | null>(null);
  const [busy, setBusy] = useState<"sign" | "keys" | null>(null);
  const guard = useRunGuard();

  const expNum = parseNum(expAmount);
  const expErr = expOn && (expNum === null || expNum <= 0) ? "Enter a positive number." : null;
  const payloadCheck = parseJson(payload);
  const payloadErr = !payloadCheck.ok
    ? `Invalid JSON${payloadCheck.line ? ` at line ${payloadCheck.line}` : ""}: ${payloadCheck.message}`
    : payloadCheck.value === null || typeof payloadCheck.value !== "object" || Array.isArray(payloadCheck.value)
      ? "The payload must be a JSON object."
      : null;

  const genSecret = () => {
    const bytes = new Uint8Array(alg === "HS512" ? 64 : alg === "HS384" ? 48 : 32);
    crypto.getRandomValues(bytes);
    setSecret(base64UrlEncode(bytes));
    setSecretB64(true);
  };

  const genKeys = async () => {
    const t = guard.start();
    setBusy("keys");
    try {
      const jose = await import("jose");
      const kp = await jose.generateKeyPair(alg, { extractable: true, ...(alg.startsWith("RS") || alg.startsWith("PS") ? { modulusLength: 2048 } : {}) });
      const [priv, pub, jwk] = await Promise.all([jose.exportPKCS8(kp.privateKey), jose.exportSPKI(kp.publicKey), jose.exportJWK(kp.publicKey)]);
      if (!guard.isCurrent(t)) return;
      setPrivPem(priv);
      setPubPem(pub);
      setPubJwk(JSON.stringify({ ...jwk, alg, use: "sig", ...(kid ? { kid } : {}) }, null, 2));
    } catch (e) {
      if (guard.isCurrent(t)) setOut({ kind: "error", message: `Key generation failed: ${errorMessage(e)}` });
    } finally {
      if (guard.isCurrent(t)) setBusy(null);
    }
  };

  const sign = async () => {
    if (payloadErr || expErr || !payloadCheck.ok) return;
    const t = guard.start();
    setBusy("sign");
    try {
      const jose = await import("jose");
      const claims = { ...(payloadCheck.value as Record<string, unknown>) };
      const nowSec = Math.floor(Date.now() / 1000);
      if (addIat) claims.iat = nowSec;
      if (expOn && expNum !== null) {
        const mult = expUnit === "m" ? 60 : expUnit === "h" ? 3600 : 86400;
        claims.exp = nowSec + Math.round(expNum * mult);
      }
      if (addJti) claims.jti = crypto.randomUUID();
      const header: { alg: string; typ: string; kid?: string } = { alg, typ: "JWT" };
      if (kid.trim()) header.kid = kid.trim();
      let key: Uint8Array | CryptoKey;
      if (isHmac(alg)) {
        if (!secret) throw new Error("Enter a secret or generate one.");
        key = secretB64 ? base64UrlDecode(secret.trim().replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")) : new TextEncoder().encode(secret);
        const minBytes = Number(alg.slice(2)) / 8;
        if (key.length < minBytes) throw new Error(`${alg} needs a secret of at least ${minBytes} bytes (${minBytes * 8} bits). Generate one or use a longer secret.`);
      } else {
        if (!privPem.trim()) throw new Error("Generate a key pair or paste a PKCS#8 private key (-----BEGIN PRIVATE KEY-----).");
        key = await jose.importPKCS8(privPem.trim(), alg);
      }
      const token = await new jose.SignJWT(claims).setProtectedHeader(header).sign(key);
      if (guard.isCurrent(t)) setOut({ kind: "ok", token, header: JSON.stringify(header, null, 2), payload: JSON.stringify(claims, null, 2) });
    } catch (e) {
      if (guard.isCurrent(t)) setOut({ kind: "error", message: errorMessage(e) });
    } finally {
      if (guard.isCurrent(t)) setBusy(null);
    }
  };

  const reset = () => {
    setPayload(DEFAULT_PAYLOAD);
    setSecret("");
    setPrivPem("");
    setPubPem("");
    setPubJwk("");
    setKid("");
    setOut(null);
  };

  return (
    <div className="space-y-5">
      <Notice tone="warning" title="For testing only">
        Keys and secrets are generated and used only in this tab, but do not paste production signing keys into any website. Tokens made here are for development and tests.
      </Notice>
      <SplitGrid>
        <ToolPanel title="Header and payload" actions={<ResetBtn onClick={reset} />}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Algorithm"
                value={alg}
                onChange={(e) => {
                  setAlg(e.target.value as Alg);
                  setPrivPem("");
                  setPubPem("");
                  setPubJwk("");
                  setOut(null);
                }}
                options={ALGS.map((a) => ({ value: a, label: a }))}
              />
              <TextField label="Key ID (kid)" optional value={kid} onChange={(e) => setKid(e.target.value)} />
            </div>
            <TextArea label="Payload (JSON object)" mono rows={8} value={payload} error={payloadErr} onChange={(e) => setPayload(e.target.value)} />
            <div className="space-y-3">
              <Checkbox label="Add iat (issued at) = now" checked={addIat} onChange={setAddIat} />
              <Checkbox label="Add exp (expires after)" checked={expOn} onChange={setExpOn} />
              {expOn && (
                <div className="grid grid-cols-2 gap-3 pl-7">
                  <NumberField label="Amount" value={expAmount} error={expErr} onChange={(e) => setExpAmount(e.target.value)} />
                  <SelectField
                    label="Unit"
                    value={expUnit}
                    onChange={(e) => setExpUnit(e.target.value)}
                    options={[
                      { value: "m", label: "minutes" },
                      { value: "h", label: "hours" },
                      { value: "d", label: "days" },
                    ]}
                  />
                </div>
              )}
              <Checkbox label="Add jti (random unique ID)" checked={addJti} onChange={setAddJti} />
            </div>
          </div>
        </ToolPanel>
        <ToolPanel title="Signing key">
          <div className="space-y-4">
            {isHmac(alg) ? (
              <>
                <TextArea label="Secret" mono rows={3} value={secret} onChange={(e) => setSecret(e.target.value)} hint={`At least ${Number(alg.slice(2)) / 8} bytes for ${alg}.`} />
                <Checkbox label="Secret is base64url encoded" checked={secretB64} onChange={setSecretB64} />
                <Btn variant="ghost" icon="spark" onClick={genSecret}>
                  Generate random secret
                </Btn>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Btn variant="ghost" icon="spark" onClick={() => void genKeys()} disabled={busy !== null}>
                    Generate {alg} key pair
                  </Btn>
                  {busy === "keys" && <Spinner label="Generating keys" />}
                </div>
                <TextArea label="Private key (PKCS#8 PEM)" mono rows={6} value={privPem} onChange={(e) => setPrivPem(e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----" />
                {pubPem && (
                  <>
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">Public key (SPKI PEM)</p>
                        <CopyBtn text={pubPem} />
                      </div>
                      <OutputBlock label="Public key PEM">
                        <code>{pubPem}</code>
                      </OutputBlock>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">Public JWK</p>
                        <CopyBtn text={pubJwk} />
                      </div>
                      <OutputBlock label="Public JWK">
                        <code>{pubJwk}</code>
                      </OutputBlock>
                    </div>
                  </>
                )}
              </>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Btn icon="token" onClick={() => void sign()} disabled={busy !== null || !!payloadErr || !!expErr}>
                Sign token
              </Btn>
              {busy === "sign" && <Spinner label="Signing" />}
            </div>
          </div>
        </ToolPanel>
      </SplitGrid>
      <ToolPanel title="Signed JWT">
        {!out ? (
          <EmptyState icon="token" title="No token yet">
            Set the payload and key, then press Sign token.
          </EmptyState>
        ) : out.kind === "error" ? (
          <Notice tone="error">{out.message}</Notice>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <CopyBtn text={out.token} label="Copy token" />
            </div>
            <OutputBlock label="JWT">
              <code className="break-all whitespace-pre-wrap">{out.token}</code>
            </OutputBlock>
            <SplitGrid>
              <OutputBlock label="Header">
                <code>{out.header}</code>
              </OutputBlock>
              <OutputBlock label="Payload">
                <code>{out.payload}</code>
              </OutputBlock>
            </SplitGrid>
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
