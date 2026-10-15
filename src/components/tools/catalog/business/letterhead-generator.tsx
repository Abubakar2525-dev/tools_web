"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Notice, PrivacyNote, Segmented, SelectField, TextArea, TextField, ToolPanel, usePersistentState } from "@/components/tools/kit";
import { FileDrop, Spinner, downloadBlob } from "@/components/tools/engines/files";
import { LAYOUTS, blankLetterhead, contactLines, normalizeLetterhead, type Letterhead, type LetterLayout } from "./lib/letterhead";
import { logoToDataUrl } from "./shared/logo";

const SAMPLE: Partial<Letterhead> = {
  company: "Harbor & Pine Architects",
  tagline: "Residential and civic design",
  address: "41 Wharf Street\nSavannah, GA 31401",
  phone: "+1 555 0142",
  email: "studio@example.com",
  website: "www.example.com",
  registration: "Licensed in Georgia and South Carolina",
  footer: "Harbor & Pine Architects LLC",
  body: "October 12, 2026\n\nMs. Dana Ortiz\nCity Planning Office\n2 East Bay Street\nSavannah, GA 31401\n\nRe: Library annex, design review submission\n\nDear Ms. Ortiz,\n\nPlease find enclosed our revised drawings for the library annex. The updated plans address the setback comments from the September review and add the requested bicycle parking along the east elevation.\n\nWe would welcome a short meeting to walk through the changes before the next committee date.\n\nSincerely,\n\n\nMorgan Hale\nPrincipal",
};

export default function Tool() {
  const [initial] = useState(blankLetterhead);
  const [stored, setStored] = usePersistentState<Letterhead>("letterhead-generator", initial);
  const l = useMemo(() => normalizeLetterhead(stored), [stored]);
  const update = (patch: Partial<Letterhead>) => setStored((p) => ({ ...normalizeLetterhead(p), ...patch }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [undo, setUndo] = useState<Letterhead | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const exportPdf = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const { embedUnicodeFonts } = await import("@/components/tools/engines/pdf");
      const { renderLetterheadPdf } = await import("./lib/letterhead");
      const pdf = await PDFDocument.create();
      const fonts = await embedUnicodeFonts(pdf);
      const res = await renderLetterheadPdf(pdf, fonts, l);
      const bytes = await pdf.save();
      if (!alive.current) return;
      const name = (l.company.trim().replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "letterhead").slice(0, 60);
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${name}-letter.pdf`);
      setInfo(
        `PDF ready: ${res.pages} page${res.pages === 1 ? "" : "s"}.` +
          (res.replacedChars.length ? ` These characters are not in the PDF font and show as "?": ${res.replacedChars.slice(0, 8).join(" ")}.` : ""),
      );
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? `Could not create the PDF: ${e.message}` : "Could not create the PDF.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const accent = l.accent;
  const contacts = contactLines(l);
  const sidebar = l.layout === "sidebar";

  const header = (
    <>
      {l.layout === "classic" && (
        <div className="flex items-start justify-between gap-4 border-b-2 pb-3" style={{ borderColor: accent }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <div>{l.logo && <img src={l.logo} alt="Logo" className="max-h-14 max-w-[150px] object-contain" />}</div>
          <div className="text-right">
            {l.company && <p className="text-[15px] font-bold" style={{ color: accent }}>{l.company}</p>}
            {l.tagline && <p className="text-[#666]">{l.tagline}</p>}
            {contacts.map((c) => (
              <p key={c} className="text-[10px] text-[#666]">{c}</p>
            ))}
          </div>
        </div>
      )}
      {l.layout === "centered" && (
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          {l.logo && <img src={l.logo} alt="Logo" className="mx-auto max-h-14 max-w-[150px] object-contain" />}
          {l.company && <p className="mt-1 text-[16px] font-bold" style={{ color: accent }}>{l.company}</p>}
          {l.tagline && <p className="text-[#666]">{l.tagline}</p>}
          <p className="text-[10px] text-[#666]">{contacts.join("  ·  ")}</p>
          <div className="mx-auto mt-2 h-0.5 w-20" style={{ background: accent }} />
        </div>
      )}
      {l.layout === "band" && (
        <div className="-mx-6 -mt-6 flex items-center justify-between gap-4 px-6 py-5 text-white" style={{ background: accent }}>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
            {l.logo && <img src={l.logo} alt="Logo" className="max-h-12 max-w-[110px] rounded bg-white object-contain p-1" />}
            <div>
              {l.company && <p className="text-[16px] font-bold">{l.company}</p>}
              {l.tagline && <p>{l.tagline}</p>}
            </div>
          </div>
          <div className="text-right text-[10px]">
            {contacts.map((c) => (
              <p key={c}>{c}</p>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title="Company details"
          actions={
            <>
              <Btn variant="ghost" icon="spark" onClick={() => { setUndo(l); setStored({ ...l, ...SAMPLE }); }}>
                Load example
              </Btn>
              <Btn variant="subtle" icon="reset" onClick={() => { setUndo(l); setStored(blankLetterhead()); }}>
                Clear
              </Btn>
            </>
          }
        >
          {undo && (
            <div className="mb-4">
              <Notice tone="success">
                Changes applied.{" "}
                <button type="button" className="min-h-10 font-medium text-accent-strong underline underline-offset-2" onClick={() => { setStored(undo); setUndo(null); }}>
                  Undo
                </button>
              </Notice>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Company name" value={l.company} onChange={(e) => update({ company: e.target.value })} />
            <TextField label="Tagline" optional value={l.tagline} onChange={(e) => update({ tagline: e.target.value })} />
            <TextArea label="Address" optional value={l.address} onChange={(e) => update({ address: e.target.value })} className="sm:col-span-2 [&_textarea]:min-h-[84px]" />
            <TextField label="Phone" optional type="tel" value={l.phone} onChange={(e) => update({ phone: e.target.value })} />
            <TextField label="Email" optional type="email" value={l.email} onChange={(e) => update({ email: e.target.value })} />
            <TextField label="Website" optional value={l.website} onChange={(e) => update({ website: e.target.value })} />
            <TextField label="Registration or tax line" optional hint="Shown in the footer." value={l.registration} onChange={(e) => update({ registration: e.target.value })} />
            <TextField label="Footer text" optional className="sm:col-span-2" value={l.footer} onChange={(e) => update({ footer: e.target.value })} />
          </div>
        </ToolPanel>

        <ToolPanel title="Design">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-ink">Layout</p>
              <div className="mt-2">
                <Segmented<LetterLayout> label="Layout" value={l.layout} onChange={(v) => update({ layout: v })} options={LAYOUTS} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-ink">Paper size</p>
                <div className="mt-2">
                  <Segmented
                    label="Paper size"
                    value={l.pageSize}
                    onChange={(v) => update({ pageSize: v })}
                    options={[
                      { value: "a4", label: "A4" },
                      { value: "letter", label: "US Letter" },
                    ]}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="lh-accent" className="text-sm font-medium text-ink">
                  Accent color
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input id="lh-accent" type="color" value={l.accent} onChange={(e) => update({ accent: e.target.value })} className="h-11 w-16 cursor-pointer rounded-lg border border-line-strong bg-surface p-1" />
                  <span className="font-mono text-sm text-ink-2">{l.accent}</span>
                </div>
              </div>
              <SelectField
                label="Body text size"
                value={String(l.fontSize)}
                onChange={(e) => update({ fontSize: Number(e.target.value) })}
                options={["9.5", "10", "10.5", "11", "12"].map((v) => ({ value: v, label: `${v} pt` }))}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Logo (optional)</p>
              <div className="mt-2">
                {l.logo ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                    <img src={l.logo} alt="Current logo" className="h-12 max-w-[140px] rounded bg-white object-contain p-1 shadow-[0_0_0_1px_var(--line)]" />
                    <Btn variant="danger" icon="trash" onClick={() => update({ logo: null })}>
                      Remove logo
                    </Btn>
                  </div>
                ) : (
                  <FileDrop
                    compact
                    accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                    maxSizeMB={5}
                    label="Choose a PNG or JPG logo"
                    hint="Up to 5 MB. Scaled down and embedded in the PDF."
                    onFiles={async (files) => {
                      setError(null);
                      try {
                        const url = await logoToDataUrl(files[0]);
                        if (alive.current) update({ logo: url });
                      } catch (e) {
                        if (alive.current) setError(e instanceof Error ? e.message : "Could not read that image.");
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </ToolPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title="Letter body">
          <TextArea
            label="Body text"
            hint="Type or paste the letter. Blank lines start new paragraphs; long letters continue on extra pages with a compact header."
            value={l.body}
            onChange={(e) => update({ body: e.target.value })}
            className="[&_textarea]:min-h-[360px]"
          />
        </ToolPanel>

        <ToolPanel
          title="Preview"
          actions={
            <Btn icon="download" onClick={exportPdf} disabled={busy}>
              {busy ? "Building PDF…" : "Download PDF"}
            </Btn>
          }
        >
          <div className="space-y-4">
            {busy && <Spinner label="Building the PDF" />}
            {error && <Notice tone="error">{error}</Notice>}
            {info && <Notice tone="success">{info}</Notice>}
            <div className="overflow-x-auto rounded-lg bg-white text-[#1e2124] shadow-[0_0_0_1px_var(--line)]">
              <div className={`flex min-h-[520px] min-w-[420px] text-[11px] leading-snug ${sidebar ? "" : "flex-col"}`} style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
                {sidebar && (
                  <div className="w-[30%] shrink-0 space-y-2 p-4 text-[10px] text-white" style={{ background: accent }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                    {l.logo && <img src={l.logo} alt="Logo" className="max-h-14 max-w-full rounded bg-white object-contain p-1" />}
                    {l.company && <p className="text-[13px] font-bold">{l.company}</p>}
                    {l.tagline && <p>{l.tagline}</p>}
                    <div>{contactLines(l, false).map((c) => <p key={c}>{c}</p>)}</div>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  {header}
                  <div className="mt-6 flex-1 whitespace-pre-wrap break-words" style={{ fontSize: `${l.fontSize + 0.5}px` }}>
                    {l.body || <span className="text-[#999]">Your letter text appears here.</span>}
                  </div>
                  {(l.footer || l.registration) && (
                    <div className="mt-6 border-t border-[#ddd] pt-2 text-[9px] text-[#666]">
                      {l.footer && <p>{l.footer}</p>}
                      {l.registration && <p>{l.registration}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[0.8125rem] text-muted">The preview is a scaled approximation; page breaks are decided when the PDF is built.</p>
            <PrivacyNote stored />
          </div>
        </ToolPanel>
      </div>
    </div>
  );
}
