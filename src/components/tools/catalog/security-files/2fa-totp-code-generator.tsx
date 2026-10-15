"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, Segmented, SelectField, TextField, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { base32Error, normalizeBase32, toBase32 } from "./lib/encoding";
import { randomBytes } from "./lib/random";
import { MonoValue, errorText } from "./shared";

type OtpAuth = typeof import("otpauth");
type Algo = "SHA1" | "SHA256" | "SHA512";
type Settings = { algorithm: Algo; digits: string; period: string };

const ALGOS = [
  { value: "SHA1", label: "SHA-1 (most apps)" },
  { value: "SHA256", label: "SHA-256" },
  { value: "SHA512", label: "SHA-512" },
];
const DIGITS = ["6", "7", "8"];
const PERIODS = [
  { value: "30", label: "30 seconds" },
  { value: "60", label: "60 seconds" },
  { value: "15", label: "15 seconds" },
];

let libPromise: Promise<OtpAuth> | null = null;
const loadLib = () => (libPromise ??= import("otpauth"));

function SettingsFields({ value, onChange }: { value: Settings; onChange: (s: Settings) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SelectField label="Algorithm" options={ALGOS} value={value.algorithm} onChange={(e) => onChange({ ...value, algorithm: e.target.value as Algo })} />
      <SelectField label="Digits" options={DIGITS} value={value.digits} onChange={(e) => onChange({ ...value, digits: e.target.value })} />
      <SelectField label="Period" options={PERIODS} value={value.period} onChange={(e) => onChange({ ...value, period: e.target.value })} />
    </div>
  );
}

const group = (code: string) => (code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code);

export default function Tool() {
  const [tab, setTab] = useState<"codes" | "create">("codes");
  const [lib, setLib] = useState<OtpAuth | null>(null);
  const [libError, setLibError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  // Code generator state
  const [secret, setSecret] = useState("");
  const [settings, setSettings] = useState<Settings>({ algorithm: "SHA1", digits: "6", period: "30" });
  const [uriError, setUriError] = useState<string | null>(null);

  // Secret creator state
  const [issuer, setIssuer] = useState("");
  const [account, setAccount] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [newSettings, setNewSettings] = useState<Settings>({ algorithm: "SHA1", digits: "6", period: "30" });
  const [qr, setQr] = useState<{ uri: string; url: string } | null>(null);

  useEffect(() => {
    let alive = true;
    loadLib()
      .then((m) => alive && setLib(m))
      .catch((e) => alive && setLibError(errorText(e, "The one-time code library could not load.")));
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const secretError = secret ? base32Error(secret) : null;
  const hardError = secretError && !secretError.startsWith("This secret is shorter") ? secretError : null;
  const period = Number(settings.period);

  let codes: { prev: string; cur: string; next: string } | null = null;
  if (lib && now && secret && !hardError) {
    try {
      const s = lib.Secret.fromBase32(normalizeBase32(secret));
      const g = (ts: number) => lib.TOTP.generate({ secret: s, algorithm: settings.algorithm, digits: Number(settings.digits), period, timestamp: ts });
      codes = { prev: g(now - period * 1000), cur: g(now), next: g(now + period * 1000) };
    } catch {
      codes = null;
    }
  }
  const remaining = now ? period - (Math.floor(now / 1000) % period) : period;

  const onSecretInput = (v: string) => {
    setUriError(null);
    if (lib && v.trim().toLowerCase().startsWith("otpauth://")) {
      try {
        const otp = lib.URI.parse(v.trim());
        if (!(otp instanceof lib.TOTP)) throw new Error("This is an HOTP (counter-based) link. Only time-based TOTP is supported here.");
        setSecret(otp.secret.base32);
        setSettings({ algorithm: otp.algorithm as Algo, digits: String(otp.digits), period: String(otp.period) });
        return;
      } catch (e) {
        setUriError(errorText(e, "This otpauth:// link could not be read."));
      }
    }
    setSecret(v);
  };

  const uri =
    lib && newSecret
      ? new lib.TOTP({
          issuer: issuer.trim() || undefined,
          label: account.trim() || "account",
          secret: lib.Secret.fromBase32(newSecret),
          algorithm: newSettings.algorithm,
          digits: Number(newSettings.digits),
          period: Number(newSettings.period),
        }).toString()
      : "";

  useEffect(() => {
    if (!uri) return;
    let alive = true;
    QRCode.toDataURL(uri, { margin: 2, width: 240, errorCorrectionLevel: "M" })
      .then((url) => alive && setQr({ uri, url }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [uri]);

  const qrUrl = qr && qr.uri === uri ? qr.url : null;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="2FA / TOTP code generator"
        actions={
          <Segmented
            label="Mode"
            value={tab}
            onChange={setTab}
            options={[
              { value: "codes", label: "Show codes" },
              { value: "create", label: "Create a secret" },
            ]}
          />
        }
      >
        <div className="mb-5">
          <Notice tone="warning">
            A TOTP secret is as sensitive as a password. Do not paste secrets for production or personal accounts on a shared or untrusted
            device. Nothing is stored or sent, but anyone watching this screen can copy it.
          </Notice>
        </div>
        {libError && <Notice tone="error">{libError}</Notice>}
        {tab === "codes" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <TextField
                label="Secret key (Base32) or otpauth:// link"
                hint="Spaces, dashes and lowercase letters are fine."
                value={secret}
                onChange={(e) => onSecretInput(e.target.value)}
                error={uriError ?? hardError}
                autoComplete="off"
                spellCheck={false}
                placeholder="JBSW Y3DP EHPK 3PXP"
              />
              {secretError && !hardError && <Notice tone="info">{secretError}</Notice>}
              <SettingsFields value={settings} onChange={setSettings} />
              <p className="text-[0.8125rem] text-muted">Most services use SHA-1, 6 digits and 30 seconds. Change these only if the service says so.</p>
            </div>
            <div className="min-w-0 space-y-4">
              {!secret ? (
                <EmptyState icon="timer" title="Enter a secret to see codes">
                  Paste the setup key shown under the QR code when you enabled two-factor authentication.
                </EmptyState>
              ) : hardError ? (
                <EmptyState icon="alert" title="Fix the secret to see codes" />
              ) : !codes ? (
                <Spinner label="Preparing" />
              ) : (
                <>
                  <div className="rounded-xl bg-accent-soft p-5">
                    <p className="text-sm text-ink-2">Current code</p>
                    <p className="mt-1 font-mono text-[2.5rem] font-semibold leading-none tracking-[0.08em] text-ink tabular-nums">{group(codes.cur)}</p>
                    <div className="mt-4 flex items-center gap-3">
                      <div
                        className="h-2 flex-1 overflow-hidden rounded-full bg-surface"
                        role="progressbar"
                        aria-label="Time left for this code"
                        aria-valuemin={0}
                        aria-valuemax={period}
                        aria-valuenow={remaining}
                      >
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(remaining / period) * 100}%` }} />
                      </div>
                      <span className="w-20 text-right text-sm tabular-nums text-ink-2">{remaining}s left</span>
                    </div>
                  </div>
                  <CopyBtn text={codes.cur} label="Copy code" />
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-sunken px-3 py-2">
                      <dt className="text-muted">Previous</dt>
                      <dd className="font-mono tabular-nums text-ink">{group(codes.prev)}</dd>
                    </div>
                    <div className="rounded-lg bg-sunken px-3 py-2">
                      <dt className="text-muted">Next</dt>
                      <dd className="font-mono tabular-nums text-ink">{group(codes.next)}</dd>
                    </div>
                  </dl>
                  <p className="text-[0.8125rem] text-muted">
                    Codes depend on this device&apos;s clock. If they are rejected, check that your clock is set automatically.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <TextField label="Issuer (service name)" optional value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Example Co" />
              <TextField label="Account name" optional value={account} onChange={(e) => setAccount(e.target.value)} placeholder="ada@example.com" />
              <SettingsFields value={newSettings} onChange={setNewSettings} />
              <Btn icon="lock" onClick={() => setNewSecret(toBase32(randomBytes(newSettings.algorithm === "SHA512" ? 64 : newSettings.algorithm === "SHA256" ? 32 : 20)))}>
                {newSecret ? "Generate a new secret" : "Generate secret"}
              </Btn>
              <p className="text-[0.8125rem] text-muted">
                The secret is {newSettings.algorithm === "SHA512" ? 512 : newSettings.algorithm === "SHA256" ? 256 : 160} random bits, matching the hash size as RFC 4226 recommends.
              </p>
            </div>
            <div className="min-w-0 space-y-4">
              {!newSecret ? (
                <EmptyState icon="qr" title="No secret yet">
                  Useful for testing your own 2FA setup flow or for apps that ask you to supply a secret.
                </EmptyState>
              ) : (
                <>
                  <div>
                    <p className="mb-1 text-sm font-medium text-ink">Secret (Base32)</p>
                    <div className="flex items-center gap-2">
                      <MonoValue>{newSecret}</MonoValue>
                      <CopyBtn text={newSecret} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-ink">otpauth:// link</p>
                    <div className="flex items-center gap-2">
                      <MonoValue>{uri}</MonoValue>
                      <CopyBtn text={uri} />
                    </div>
                  </div>
                  {qrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL generated locally
                    <img src={qrUrl} width={240} height={240} alt={`QR code for the otpauth link: ${uri}`} className="rounded-lg bg-white" />
                  ) : (
                    <Spinner label="Drawing QR code" />
                  )}
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      setSecret(newSecret);
                      setSettings(newSettings);
                      setTab("codes");
                    }}
                  >
                    Show codes for this secret
                  </Btn>
                </>
              )}
            </div>
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
