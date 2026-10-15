"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Btn,
  CellInput,
  CellSelect,
  Checkbox,
  CopyBtn,
  Notice,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SelectField,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  inputCls,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import {
  DEFAULT_SIGNATURE,
  SIGNATURE_TEMPLATES,
  SOCIAL_NETWORKS,
  buildSignatureDocument,
  buildSignatureHtml,
  isHex,
  signaturePlainText,
  validateSignature,
  type SignatureData,
  type SignatureTemplate,
} from "./lib/signature";

const MAX_SOCIALS = 6;
const IMAGE_WIDTHS = ["48", "64", "80", "96", "120", "160"];

function normalize(raw: Partial<SignatureData> | null | undefined): SignatureData {
  const d = { ...DEFAULT_SIGNATURE, ...(raw ?? {}) };
  if (!Array.isArray(d.socials)) d.socials = [];
  if (!SIGNATURE_TEMPLATES.some((t) => t.value === d.template)) d.template = "side";
  return d;
}

type CopyState = { tone: "success" | "warning" | "error"; text: string } | null;

export default function Tool() {
  const [raw, setRaw, clear] = usePersistentState<SignatureData>("email-signature-generator", DEFAULT_SIGNATURE);
  const d = useMemo(() => normalize(raw), [raw]);
  const deferred = useDeferredValue(d);
  const errors = useMemo(() => validateSignature(d), [d]);
  const html = useMemo(() => buildSignatureHtml(deferred), [deferred]);
  const doc = useMemo(() => buildSignatureDocument(deferred), [deferred]);
  const plain = useMemo(() => signaturePlainText(deferred), [deferred]);
  const [copy, setCopy] = useState<CopyState>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const set = <K extends keyof SignatureData>(k: K, v: SignatureData[K]) => setRaw((prev) => ({ ...normalize(prev), [k]: v }));
  const setSocial = (id: string, patch: Partial<SignatureData["socials"][number]>) =>
    set(
      "socials",
      d.socials.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );

  const flash = (s: CopyState) => {
    setCopy(s);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopy(null), 5000);
  };

  const copyRich = async () => {
    const fragment = buildSignatureHtml(d);
    const text = signaturePlainText(d);
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      flash({
        tone: "warning",
        text: "This browser can't copy formatted HTML. Select the signature in the preview, copy it with Ctrl or Cmd + C, or use Copy HTML source.",
      });
      return;
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([fragment], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      flash({ tone: "success", text: "Signature copied. Paste it into your email app's signature settings." });
    } catch {
      flash({ tone: "error", text: "Copying was blocked by the browser. Try again, or use Copy HTML source." });
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ToolPanel title="Your details" actions={<ResetBtn label="Reset to sample" onClick={clear} />}>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Name" value={d.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={80} />
              <TextField label="Job title" optional value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={80} />
              <TextField label="Company" optional value={d.company} onChange={(e) => set("company", e.target.value)} maxLength={80} />
              <TextField label="Phone" optional type="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} maxLength={40} />
              <TextField label="Mobile" optional type="tel" value={d.mobile} onChange={(e) => set("mobile", e.target.value)} error={errors.mobile} maxLength={40} />
              <TextField label="Email" optional type="email" value={d.email} onChange={(e) => set("email", e.target.value)} error={errors.email} maxLength={100} />
              <TextField label="Website" optional value={d.website} onChange={(e) => set("website", e.target.value)} error={errors.website} maxLength={200} />
              <TextField label="Address" optional value={d.address} onChange={(e) => set("address", e.target.value)} maxLength={160} />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ink">Social and profile links</legend>
              {d.socials.length === 0 && <p className="text-sm text-muted">No links yet.</p>}
              <ul className="space-y-2">
                {d.socials.map((s, i) => (
                  <li key={s.id}>
                    <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                      <CellSelect
                        label={`Network for link ${i + 1}`}
                        className="w-full sm:w-40"
                        value={s.network}
                        onChange={(e) => setSocial(s.id, { network: e.target.value })}
                        options={SOCIAL_NETWORKS}
                      />
                      <CellInput
                        label={`URL for link ${i + 1}`}
                        className="min-w-0 flex-1"
                        placeholder="https://"
                        value={s.url}
                        invalid={Boolean(errors[`social-${s.id}`])}
                        onChange={(e) => setSocial(s.id, { url: e.target.value })}
                        maxLength={300}
                      />
                      <Btn
                        variant="subtle"
                        icon="trash"
                        className="!h-10 !min-w-10"
                        onClick={() => set("socials", d.socials.filter((x) => x.id !== s.id))}
                      >
                        <span className="sr-only">Remove link {i + 1}</span>
                      </Btn>
                    </div>
                    {errors[`social-${s.id}`] && (
                      <p className="mt-1 text-sm text-danger" role="alert">
                        {errors[`social-${s.id}`]}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <Btn
                variant="ghost"
                icon="plus"
                disabled={d.socials.length >= MAX_SOCIALS}
                onClick={() => set("socials", [...d.socials, { id: uid(), network: "LinkedIn", url: "" }])}
              >
                Add link
              </Btn>
            </fieldset>

            <div className="space-y-4">
              <TextField
                label="Logo or photo URL"
                optional
                hint="A link to an image that is already online (https://…). Email apps load it from that address."
                placeholder="https://example.com/logo.png"
                value={d.imageUrl}
                onChange={(e) => set("imageUrl", e.target.value)}
                error={errors.imageUrl}
                maxLength={500}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Image width"
                  value={String(d.imageWidth)}
                  onChange={(e) => set("imageWidth", Number(e.target.value))}
                  options={IMAGE_WIDTHS.map((w) => ({ value: w, label: `${w} px` }))}
                />
                <div className="sm:pt-8">
                  <Checkbox label="Round crop (for square photos)" checked={d.imageRound} onChange={(v) => set("imageRound", v)} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-ink" aria-hidden="true">
                  Template
                </p>
                <Segmented<SignatureTemplate> label="Template" value={d.template} onChange={(v) => set("template", v)} options={SIGNATURE_TEMPLATES} />
              </div>
              <div>
                <label htmlFor="sig-accent" className="text-sm font-medium text-ink">
                  Accent color
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Accent color picker"
                    value={isHex(d.accent) ? d.accent : "#1f6f5c"}
                    onChange={(e) => set("accent", e.target.value)}
                    className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
                  />
                  <input
                    id="sig-accent"
                    className={`${inputCls} h-11 max-w-[160px] font-mono`}
                    value={d.accent}
                    spellCheck={false}
                    aria-invalid={errors.accent ? true : undefined}
                    aria-describedby={errors.accent ? "sig-accent-err" : undefined}
                    onChange={(e) => set("accent", e.target.value.trim())}
                    maxLength={7}
                  />
                </div>
                {errors.accent && (
                  <p id="sig-accent-err" className="mt-2 text-sm text-danger" role="alert">
                    {errors.accent}
                  </p>
                )}
              </div>
              <TextArea
                label="Disclaimer"
                optional
                hint="Small print shown under the signature, such as a confidentiality note."
                value={d.disclaimer}
                onChange={(e) => set("disclaimer", e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
        </ToolPanel>

        <ToolPanel title="Preview">
          <div className="space-y-4">
            <iframe
              title="Email signature preview"
              sandbox=""
              srcDoc={doc}
              className="h-[300px] w-full rounded-lg bg-white shadow-[0_0_0_1px_var(--line)]"
            />
            <details className="text-sm text-ink-2">
              <summary className="cursor-pointer py-2 font-medium text-ink">Text version of the signature</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-sunken p-3 font-sans">{plain}</pre>
            </details>
            {errorCount > 0 && (
              <Notice tone="warning">
                {errorCount === 1 ? "One field needs attention." : `${errorCount} fields need attention.`} Invalid links are left out of the
                signature until they are fixed.
              </Notice>
            )}
            <div className="flex flex-wrap gap-2">
              <Btn icon="copy" onClick={copyRich}>
                Copy signature
              </Btn>
              <CopyBtn text={html} label="Copy HTML source" />
              <Btn variant="ghost" icon="download" onClick={() => downloadFile("email-signature.html", buildSignatureDocument(d), "text/html")}>
                Download .html
              </Btn>
            </div>
            <div aria-live="polite">{copy && <Notice tone={copy.tone}>{copy.text}</Notice>}</div>
            <p className="text-[0.8125rem] text-muted">
              Paste into Gmail (Settings, Signature), Outlook (Signatures) or Apple Mail (Signatures). Some apps change spacing slightly;
              send yourself a test email before using it.
            </p>
          </div>
        </ToolPanel>
      </div>
      <PrivacyNote stored />
    </div>
  );
}
