"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, SelectField, TextField, ToolPanel, uid, usePersistentState } from "@/components/tools/kit";
import { buildUtmUrl, type UtmValues } from "./lib/web-url";

const EMPTY: UtmValues = { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "", utm_id: "" };

interface Preset {
  id: string;
  name: string;
  source: string;
  medium: string;
}

const BUILT_IN: Preset[] = [
  { id: "b-newsletter", name: "Email newsletter", source: "newsletter", medium: "email" },
  { id: "b-fb-paid", name: "Facebook ads", source: "facebook", medium: "paid_social" },
  { id: "b-fb-org", name: "Facebook post", source: "facebook", medium: "social" },
  { id: "b-ig", name: "Instagram bio or story", source: "instagram", medium: "social" },
  { id: "b-li", name: "LinkedIn post", source: "linkedin", medium: "social" },
  { id: "b-x", name: "X (Twitter) post", source: "x", medium: "social" },
  { id: "b-yt", name: "YouTube description", source: "youtube", medium: "video" },
  { id: "b-google-cpc", name: "Google Ads (manual tagging)", source: "google", medium: "cpc" },
  { id: "b-qr", name: "Printed QR code", source: "qr_code", medium: "offline" },
  { id: "b-partner", name: "Partner or affiliate site", source: "partner_name", medium: "referral" },
];

const FIELDS: { key: keyof UtmValues; label: string; hint: string; placeholder: string }[] = [
  { key: "utm_source", label: "Campaign source (utm_source)", hint: "Where the traffic comes from: newsletter, google, facebook.", placeholder: "newsletter" },
  { key: "utm_medium", label: "Campaign medium (utm_medium)", hint: "The channel type: email, cpc, social, referral.", placeholder: "email" },
  { key: "utm_campaign", label: "Campaign name (utm_campaign)", hint: "The promotion or initiative.", placeholder: "spring_sale" },
  { key: "utm_term", label: "Campaign term (utm_term)", hint: "Paid search keyword, if any.", placeholder: "running shoes" },
  { key: "utm_content", label: "Campaign content (utm_content)", hint: "Tells apart links in the same campaign: header_button, footer_link.", placeholder: "header_button" },
  { key: "utm_id", label: "Campaign ID (utm_id)", hint: "Used by GA4 for cost data imports.", placeholder: "abc.123" },
];

export default function Tool() {
  const [base, setBase] = useState("");
  const [values, setValues] = useState<UtmValues>(EMPTY);
  const [lowercase, setLowercase] = useState(true);
  const [spaces, setSpaces] = useState<"-" | "_" | "%20" | "+">("_");
  const [presetId, setPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [saved, setSaved] = usePersistentState<Preset[]>("utm-builder", []);
  const custom = Array.isArray(saved) ? saved.filter((p) => p && typeof p.id === "string") : [];
  const all = [...BUILT_IN, ...custom];

  const touched = base.trim() !== "" || Object.values(values).some((v) => v.trim());
  const res = touched ? buildUtmUrl(base, values, { lowercase, spaces }) : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title="Campaign details"
          actions={
            <ResetBtn
              onClick={() => {
                setBase("");
                setValues(EMPTY);
                setPresetId("");
              }}
            />
          }
        >
          <div className="space-y-4">
            <TextField label="Page URL" placeholder="https://example.com/landing" inputMode="url" value={base} onChange={(e) => setBase(e.target.value)} error={res?.error === "This is not a valid URL." || res?.error === "Use an http or https URL." ? res.error : null} />
            <SelectField
              label="Preset"
              hint="Fills source and medium with common conventions."
              value={presetId}
              onChange={(e) => {
                setPresetId(e.target.value);
                const p = all.find((x) => x.id === e.target.value);
                if (p) setValues((v) => ({ ...v, utm_source: p.source, utm_medium: p.medium }));
              }}
              options={[
                { value: "", label: "Choose a preset…" },
                ...BUILT_IN.map((p) => ({ value: p.id, label: `${p.name} (${p.source} / ${p.medium})` })),
                ...custom.map((p) => ({ value: p.id, label: `Saved: ${p.name} (${p.source} / ${p.medium})` })),
              ]}
            />
            {FIELDS.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                optional={f.key !== "utm_source"}
                hint={f.hint}
                placeholder={f.placeholder}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                error={f.key === "utm_source" && res?.error?.startsWith("Campaign source") ? res.error : null}
              />
            ))}
            <div className="grid gap-4 sm:grid-cols-2">
              <Checkbox label="Convert to lowercase" checked={lowercase} onChange={setLowercase} hint="Avoids “Email” and “email” being counted separately." />
              <SelectField
                label="Replace spaces with"
                value={spaces}
                onChange={(e) => setSpaces(e.target.value as typeof spaces)}
                options={[
                  { value: "_", label: "Underscore _" },
                  { value: "-", label: "Hyphen -" },
                  { value: "%20", label: "Keep spaces (%20)" },
                  { value: "+", label: "Keep spaces (+)" },
                ]}
              />
            </div>
          </div>
        </ToolPanel>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          <ToolPanel title="Tagged URL" actions={<CopyBtn text={res?.url ?? ""} />}>
            {!res ? (
              <EmptyState icon="link" title="No URL yet">
                Enter the page URL and at least a campaign source.
              </EmptyState>
            ) : res.error && !res.url ? (
              <Notice tone="error">{res.error}</Notice>
            ) : (
              <div className="space-y-4">
                <p className="break-all rounded-lg bg-sunken p-4 font-mono text-[0.9rem] text-ink" aria-live="polite">
                  {res.url}
                </p>
                <p className="text-[0.8125rem] text-muted">{res.url.length} characters. Existing query parameters and #fragments are kept; old utm_ values are replaced.</p>
                {res.warnings.length > 0 && (
                  <Notice tone="warning">
                    <ul className="list-disc space-y-1 pl-4">
                      {res.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
              </div>
            )}
          </ToolPanel>
          <ToolPanel title="Save as preset">
            <div className="space-y-3">
              <TextField label="Preset name" placeholder="Partner newsletter" value={presetName} onChange={(e) => setPresetName(e.target.value)} hint="Saves the current source and medium in this browser." />
              <div className="flex flex-wrap gap-2">
                <Btn
                  icon="plus"
                  disabled={!presetName.trim() || !values.utm_source.trim()}
                  onClick={() => {
                    setSaved((list) => [...(Array.isArray(list) ? list : []), { id: uid(), name: presetName.trim(), source: values.utm_source.trim(), medium: values.utm_medium.trim() }]);
                    setPresetName("");
                  }}
                >
                  Save preset
                </Btn>
              </div>
              {custom.length > 0 && (
                <ul className="divide-y divide-line">
                  {custom.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 break-words">
                        {p.name} <span className="text-muted">({p.source} / {p.medium || "no medium"})</span>
                      </span>
                      <Btn variant="danger" icon="trash" aria-label={`Delete preset ${p.name}`} onClick={() => setSaved((list) => (Array.isArray(list) ? list : []).filter((x) => x.id !== p.id))} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ToolPanel>
        </div>
      </div>
      <PrivacyNote stored />
    </div>
  );
}
