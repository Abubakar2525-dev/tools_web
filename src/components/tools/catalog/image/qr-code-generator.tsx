"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Btn, Checkbox, CopyBtn, Notice, OutputBlock, PrivacyNote, SelectField, TextArea, TextField, ToolPanel, downloadFile } from "@/components/tools/kit";
import { downloadBlob } from "@/components/tools/engines/files";
import { ColorField, RangeField, dataUrlToBlob, errMsg } from "./shared";
import { EMAIL_RE, mailtoPayload, normalizePhone, qrColorWarning, smsPayload, telPayload, vcardPayload, wifiPayload, type VCardInput, type WifiAuth } from "./lib/qr";

type Kind = "url" | "text" | "wifi" | "email" | "phone" | "sms" | "vcard";
type Ecc = "L" | "M" | "Q" | "H";

const KINDS: { value: Kind; label: string }[] = [
  { value: "url", label: "Website link" },
  { value: "text", label: "Plain text" },
  { value: "wifi", label: "Wi-Fi network" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "sms", label: "Text message (SMS)" },
  { value: "vcard", label: "Contact card (vCard)" },
];

const EMPTY_CARD: VCardInput = { firstName: "", lastName: "", org: "", title: "", mobile: "", workPhone: "", email: "", url: "", street: "", city: "", region: "", postcode: "", country: "", note: "" };

export default function Tool() {
  const [kind, setKind] = useState<Kind>("url");
  const [url, setUrl] = useState("https://example.com");
  const [text, setText] = useState("");
  const [wifi, setWifi] = useState({ ssid: "", password: "", auth: "WPA" as WifiAuth, hidden: false });
  const [mail, setMail] = useState({ to: "", subject: "", body: "" });
  const [phone, setPhone] = useState("");
  const [sms, setSms] = useState({ phone: "", message: "" });
  const [card, setCard] = useState<VCardInput>(EMPTY_CARD);
  const [ecc, setEcc] = useState<Ecc>("M");
  const [fg, setFg] = useState("#111111");
  const [bg, setBg] = useState("#ffffff");
  const [margin, setMargin] = useState(4);
  const [size, setSize] = useState(512);

  let payload = "";
  let err: string | null = null;
  if (kind === "url") {
    const u = url.trim();
    if (!u) err = "Enter a link.";
    else {
      const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
      try {
        const parsed = new URL(withScheme);
        if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") err = "This does not look like a full web address.";
        payload = withScheme;
      } catch {
        err = "This is not a valid web address.";
      }
    }
  } else if (kind === "text") {
    if (!text.trim()) err = "Enter some text.";
    payload = text;
  } else if (kind === "wifi") {
    if (!wifi.ssid) err = "Enter the network name (SSID).";
    else if (wifi.auth === "WPA" && wifi.password.length < 8) err = "WPA passwords are at least 8 characters.";
    else if (wifi.auth === "WEP" && !wifi.password) err = "Enter the WEP key.";
    payload = wifiPayload(wifi);
  } else if (kind === "email") {
    if (!EMAIL_RE.test(mail.to.trim())) err = "Enter a valid email address.";
    payload = mailtoPayload(mail);
  } else if (kind === "phone") {
    const n = normalizePhone(phone);
    if (!n) err = "Enter a phone number using digits, spaces, dashes or a leading +.";
    payload = telPayload(n ?? "");
  } else if (kind === "sms") {
    const n = normalizePhone(sms.phone);
    if (!n) err = "Enter a phone number using digits, spaces, dashes or a leading +.";
    payload = smsPayload(n ?? "", sms.message);
  } else {
    if (!card.firstName.trim() && !card.lastName.trim() && !card.org.trim()) err = "Enter at least a name or an organization.";
    else if (card.email.trim() && !EMAIL_RE.test(card.email.trim())) err = "The email address is not valid.";
    payload = vcardPayload(card);
  }

  let version: number | null = null;
  if (!err && payload) {
    try {
      version = QRCode.create(payload, { errorCorrectionLevel: ecc }).version;
    } catch {
      err = "Too much data for one QR code at this error correction level. Shorten the content or choose a lower level.";
    }
  }

  const key = JSON.stringify([payload, ecc, fg, bg, margin, size]);
  const [render, setRender] = useState<{ key: string; png: string; svg: string } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  useEffect(() => {
    if (err || !payload) return;
    let alive = true;
    const opts = { errorCorrectionLevel: ecc, margin, color: { dark: fg, light: bg } };
    Promise.all([QRCode.toDataURL(payload, { ...opts, width: size }), QRCode.toString(payload, { ...opts, type: "svg" })])
      .then(([png, svg]) => {
        if (alive) {
          setRender({ key, png, svg });
          setRenderError(null);
        }
      })
      .catch((e) => alive && setRenderError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [err, payload, ecc, fg, bg, margin, size, key]);
  const current = !err && render && render.key === key ? render : null;
  const colorWarn = qrColorWarning(fg, bg);

  const set = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, k: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setter((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <ToolPanel title="QR code generator">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <SelectField label="Content type" value={kind} onChange={(e) => setKind(e.target.value as Kind)} options={KINDS} />
            {kind === "url" && <TextField label="Web address" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page" hint="https:// is added if you leave it out." inputMode="url" />}
            {kind === "text" && <TextArea label="Text" value={text} onChange={(e) => setText(e.target.value)} rows={5} />}
            {kind === "wifi" && (
              <>
                <TextField label="Network name (SSID)" value={wifi.ssid} onChange={set(setWifi, "ssid")} autoComplete="off" />
                <SelectField
                  label="Security"
                  value={wifi.auth}
                  onChange={(e) => setWifi((p) => ({ ...p, auth: e.target.value as WifiAuth }))}
                  options={[
                    { value: "WPA", label: "WPA, WPA2 or WPA3" },
                    { value: "WEP", label: "WEP (legacy)" },
                    { value: "nopass", label: "None (open network)" },
                  ]}
                />
                {wifi.auth !== "nopass" && <TextField label="Password" value={wifi.password} onChange={set(setWifi, "password")} autoComplete="off" spellCheck={false} />}
                <Checkbox label="Hidden network" checked={wifi.hidden} onChange={(v) => setWifi((p) => ({ ...p, hidden: v }))} />
                <p className="text-[0.8125rem] text-muted">Special characters ( \ ; , : &quot; ) are escaped automatically. Anyone who sees the code can read the password.</p>
              </>
            )}
            {kind === "email" && (
              <>
                <TextField label="To" type="email" value={mail.to} onChange={set(setMail, "to")} />
                <TextField label="Subject" optional value={mail.subject} onChange={set(setMail, "subject")} />
                <TextArea label="Message" optional value={mail.body} onChange={set(setMail, "body")} rows={3} />
              </>
            )}
            {kind === "phone" && <TextField label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 010 9999" hint="Include the country code for international use." />}
            {kind === "sms" && (
              <>
                <TextField label="Phone number" type="tel" value={sms.phone} onChange={set(setSms, "phone")} />
                <TextArea label="Message" optional value={sms.message} onChange={set(setSms, "message")} rows={3} />
              </>
            )}
            {kind === "vcard" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["firstName", "First name"],
                    ["lastName", "Last name"],
                    ["org", "Organization"],
                    ["title", "Job title"],
                    ["mobile", "Mobile phone"],
                    ["workPhone", "Work phone"],
                    ["email", "Email"],
                    ["url", "Website"],
                    ["street", "Street"],
                    ["city", "City"],
                    ["region", "State or region"],
                    ["postcode", "Postal code"],
                    ["country", "Country"],
                  ] as [keyof VCardInput, string][]
                ).map(([k, label]) => (
                  <TextField key={k} label={label} value={card[k]} onChange={set(setCard, k)} />
                ))}
                <TextArea className="sm:col-span-2" label="Note" optional value={card.note} onChange={set(setCard, "note")} rows={2} />
              </div>
            )}
            {err && (
              <p className="text-sm text-danger" role="alert">
                {err}
              </p>
            )}
            <SelectField
              label="Error correction"
              value={ecc}
              onChange={(e) => setEcc(e.target.value as Ecc)}
              options={[
                { value: "L", label: "Low (7%): smallest code" },
                { value: "M", label: "Medium (15%): recommended" },
                { value: "Q", label: "Quartile (25%)" },
                { value: "H", label: "High (30%): survives damage or a logo overlay" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Code color" value={fg} onChange={setFg} />
              <ColorField label="Background" value={bg} onChange={setBg} />
            </div>
            {colorWarn && <Notice tone="warning">{colorWarn}</Notice>}
            <RangeField label="Quiet zone (margin)" value={margin} onChange={setMargin} min={0} max={10} unit=" modules" hint={margin < 4 ? "The standard asks for 4 modules; smaller margins can fail on busy backgrounds." : undefined} />
            <RangeField label="PNG size" value={size} onChange={setSize} min={128} max={2048} step={32} unit=" px" />
          </div>
          <div className="min-w-0 space-y-4">
            <div className="grid min-h-[280px] place-items-center rounded-xl bg-sunken p-4">
              {current ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.png} alt={`QR code for: ${payload.slice(0, 120)}`} className="h-auto w-full max-w-[320px]" style={{ imageRendering: "pixelated" }} />
              ) : (
                <p className="text-sm text-muted">{err ? "Fix the content to see the code." : "Generating…"}</p>
              )}
            </div>
            {renderError && <Notice tone="error">{renderError}</Notice>}
            {current && (
              <>
                <p className="text-sm text-ink-2">
                  Version {version} ({version ? 17 + version * 4 : 0} × {version ? 17 + version * 4 : 0} modules), {payload.length} characters.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Btn
                    icon="download"
                    onClick={() => downloadBlob(dataUrlToBlob(current.png), "qr-code.png")}
                  >
                    PNG
                  </Btn>
                  <Btn variant="ghost" icon="download" onClick={() => downloadFile("qr-code.svg", current.svg, "image/svg+xml")}>
                    SVG
                  </Btn>
                  <CopyBtn text={payload} label="Copy encoded text" />
                </div>
                <p className="text-[0.8125rem] text-muted">Test the code with your phone camera before printing it.</p>
                <OutputBlock label="Encoded content">
                  <code className="whitespace-pre-wrap break-all">{payload}</code>
                </OutputBlock>
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
