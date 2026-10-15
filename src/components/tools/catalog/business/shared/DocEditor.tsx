"use client";

/**
 * Shared editor for invoices, receipts, quotations, purchase orders and
 * expense reports. Draft is saved locally, totals are exact (integer minor
 * units), the preview mirrors the PDF and the PDF is built with pdf-lib.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Btn,
  CellInput,
  CellSelect,
  Checkbox,
  Notice,
  PrivacyNote,
  Segmented,
  SelectField,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  usePersistentState,
} from "@/components/tools/kit";
import { FileDrop, Spinner, downloadBlob } from "@/components/tools/engines/files";
import { Icon } from "@/components/ui/Icon";
import {
  EXPENSE_CATEGORIES,
  KINDS,
  addDaysIso,
  blankDoc,
  computeTotals,
  emptyItem,
  formatDate,
  formatRate,
  incrementDocNumber,
  itemsCsvRows,
  localTodayIso,
  normalizeDoc,
  parseDocJson,
  type BizDoc,
  type DocKind,
  type LineItem,
  type Party,
  type Totals,
} from "../lib/bizdoc";
import { CURRENCIES, LOCALES, formatMoney, formatScaled } from "../lib/money";
import { toCsv } from "../lib/csv";
import { logoToDataUrl } from "./logo";

const SAMPLE_ITEMS: Record<DocKind, Omit<LineItem, "id">[]> = {
  invoice: [
    { description: "Website redesign: discovery and wireframes", qty: "1", unitPrice: "1800", taxRate: "10", discount: "", date: "", category: "" },
    { description: "Front-end development (hours)", qty: "24", unitPrice: "85", taxRate: "10", discount: "", date: "", category: "" },
    { description: "Hosting setup", qty: "1", unitPrice: "150", taxRate: "0", discount: "", date: "", category: "" },
  ],
  receipt: [
    { description: "Annual maintenance plan", qty: "1", unitPrice: "480", taxRate: "8", discount: "", date: "", category: "" },
    { description: "Replacement filter cartridge", qty: "2", unitPrice: "24.5", taxRate: "8", discount: "", date: "", category: "" },
  ],
  quote: [
    { description: "Brand identity package (logo, palette, type)", qty: "1", unitPrice: "2400", taxRate: "20", discount: "", date: "", category: "" },
    { description: "Business card design", qty: "1", unitPrice: "300", taxRate: "20", discount: "", date: "", category: "" },
    { description: "Print-ready file preparation (hours)", qty: "3", unitPrice: "60", taxRate: "20", discount: "10", date: "", category: "" },
  ],
  po: [
    { description: "Ergonomic office chair, model C-200", qty: "12", unitPrice: "219", taxRate: "", discount: "5", date: "", category: "" },
    { description: "Height-adjustable desk 160 x 80 cm", qty: "12", unitPrice: "389", taxRate: "", discount: "5", date: "", category: "" },
    { description: "Monitor arm, dual", qty: "12", unitPrice: "74.9", taxRate: "", discount: "", date: "", category: "" },
  ],
  expense: [
    { description: "Return train ticket to client site", qty: "1", unitPrice: "128.4", taxRate: "", discount: "", date: "", category: "Travel" },
    { description: "Hotel, 2 nights", qty: "1", unitPrice: "312", taxRate: "10", discount: "", date: "", category: "Lodging" },
    { description: "Team lunch with client", qty: "1", unitPrice: "86.75", taxRate: "10", discount: "", date: "", category: "Client entertainment" },
    { description: "Taxi from station", qty: "1", unitPrice: "23.1", taxRate: "", discount: "", date: "", category: "Transport" },
  ],
};

function sampleDoc(kind: DocKind, base: BizDoc): BizDoc {
  const today = localTodayIso();
  const k = KINDS[kind];
  const from: Party =
    kind === "expense"
      ? { name: "Jordan Lee", company: "Sales department", address: "", email: "jordan.lee@example.com", phone: "", taxId: "" }
      : {
          name: "Avery Studio LLC",
          company: "",
          address: "120 Market Street, Suite 4\nSpringfield, IL 62701",
          email: "billing@example.com",
          phone: "+1 555 0100",
          taxId: "",
        };
  const to: Party =
    kind === "po"
      ? { name: "Northwind Office Supply", company: "", address: "88 Commerce Way\nDayton, OH 45402", email: "orders@example.net", phone: "+1 555 0177", taxId: "" }
      : kind === "expense"
        ? { name: "Finance team", company: "Avery Studio LLC", address: "", email: "finance@example.com", phone: "", taxId: "" }
        : { name: "Riley Chen", company: "Bluebird Bakery", address: "9 Harbor Road\nPortland, ME 04101", email: "riley@example.org", phone: "", taxId: "" };
  return {
    ...base,
    kind,
    title: k.title,
    issueDate: today,
    secondDate: k.secondDays ? addDaysIso(today, k.secondDays) : "",
    from,
    to,
    shipTo: kind === "po" ? { name: "Avery Studio LLC, receiving", company: "", address: "120 Market Street, Dock B\nSpringfield, IL 62701", email: "", phone: "", taxId: "" } : base.shipTo,
    reference: kind === "expense" ? "Client workshop, Boston" : kind === "po" ? "Q-2291" : "",
    items: SAMPLE_ITEMS[kind].map((it, i) => ({ ...it, id: `s${i}`, date: kind === "expense" ? addDaysIso(today, -3 + Math.min(i, 2)) : "" })),
    notes: kind === "invoice" ? "Thank you for your business." : kind === "expense" ? "Receipts attached for every line." : base.notes,
    terms:
      kind === "invoice"
        ? "Payment due within 14 days by bank transfer. Please quote the invoice number."
        : kind === "quote"
          ? "Prices valid until the date above. 50% deposit on acceptance, balance on delivery."
          : kind === "po"
            ? "Deliver to the ship-to address between 9:00 and 16:00. Payment net 30 after delivery and a correct invoice."
            : kind === "expense"
              ? "I certify that these expenses were incurred for business purposes."
              : base.terms,
    shipping: kind === "po" ? "120" : "",
    amountPaid: kind === "expense" ? "200" : "",
  };
}

const safeName = (s: string, fallback: string) => (s.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || fallback).slice(0, 80);

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function PartyFields({ label, value, onChange, nameLabel = "Name" }: { label: string; value: Party; onChange: (p: Party) => void; nameLabel?: string }) {
  const set = (k: keyof Party, v: string) => onChange({ ...value, [k]: v });
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-2 text-sm font-semibold text-ink">{label}</legend>
      <TextField label={nameLabel} value={value.name} onChange={(e) => set("name", e.target.value)} />
      <TextField label="Company or department" optional value={value.company} onChange={(e) => set("company", e.target.value)} />
      <TextArea label="Address" optional value={value.address} onChange={(e) => set("address", e.target.value)} className="[&_textarea]:min-h-[84px]" />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Email" optional type="email" value={value.email} onChange={(e) => set("email", e.target.value)} />
        <TextField label="Phone" optional type="tel" value={value.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <TextField label="Tax ID (VAT, GST, EIN)" optional value={value.taxId} onChange={(e) => set("taxId", e.target.value)} />
    </fieldset>
  );
}

function Preview({ doc, t }: { doc: BizDoc; t: Totals }) {
  const k = KINDS[doc.kind];
  const m = (v: number) => formatMoney(v, doc.currency, doc.locale);
  const hasDisc = doc.items.some((it) => it.discount.trim() && it.discount.trim() !== "0");
  const hasTax = t.lines.some((l) => l.rate);
  const parties: [string, Party][] = [
    [k.fromLabel, doc.from],
    [k.toLabel, doc.to],
  ];
  if (k.shipToLabel && (doc.shipTo.name.trim() || doc.shipTo.address.trim())) parties.push([k.shipToLabel, doc.shipTo]);
  const title = doc.title.trim() || k.title;
  const accent = /^#[0-9a-f]{6}$/i.test(doc.accent) ? doc.accent : "#1f6f5c";
  const sigs = doc.showSignatures ? doc.signatures.map((s) => s.trim()).filter(Boolean) : [];
  return (
    <div className="overflow-x-auto rounded-lg bg-white text-[#1e2124] shadow-[0_0_0_1px_var(--line)]">
      <div className="min-w-[520px] p-6 text-[12px] leading-snug" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-h-[1px]">
            {doc.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
              <img src={doc.logo} alt="Logo" className="max-h-[54px] max-w-[150px] object-contain" />
            )}
          </div>
          <div className="text-right">
            <p className="text-[22px] font-bold" style={{ color: accent }}>
              {title}
            </p>
            <dl className="mt-1 space-y-0.5">
              {doc.number.trim() && (
                <div>
                  <dt className="inline text-[#6b6f73]">No. </dt>
                  <dd className="inline font-semibold">{doc.number}</dd>
                </div>
              )}
              {doc.issueDate && (
                <div>
                  <dt className="inline text-[#6b6f73]">{k.issueLabel} </dt>
                  <dd className="inline font-semibold">{formatDate(doc.issueDate, doc.locale)}</dd>
                </div>
              )}
              {k.secondLabel && doc.secondDate && (
                <div>
                  <dt className="inline text-[#6b6f73]">{k.secondLabel} </dt>
                  <dd className="inline font-semibold">{formatDate(doc.secondDate, doc.locale)}</dd>
                </div>
              )}
              {doc.reference.trim() && (
                <div>
                  <dt className="inline text-[#6b6f73]">{k.referenceLabel} </dt>
                  <dd className="inline font-semibold">{doc.reference}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="mt-5 grid gap-4" style={{ gridTemplateColumns: `repeat(${parties.length}, minmax(0, 1fr))` }}>
          {parties.map(([label, p]) => (
            <div key={label} className="min-w-0 break-words">
              <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: accent }}>
                {label}
              </p>
              {p.name && <p className="font-semibold">{p.name}</p>}
              {p.company && <p>{p.company}</p>}
              {p.address && <p className="whitespace-pre-line">{p.address}</p>}
              {p.email && <p className="text-[#6b6f73]">{p.email}</p>}
              {p.phone && <p className="text-[#6b6f73]">{p.phone}</p>}
              {p.taxId && <p className="text-[#6b6f73]">Tax ID: {p.taxId}</p>}
              {!p.name && !p.company && !p.address && <p className="text-[#9a9ea2]">Not filled in</p>}
            </div>
          ))}
        </div>

        <table className="mt-5 w-full border-collapse text-left">
          <thead>
            <tr style={{ background: accent, color: "#fff" }}>
              {k.expense ? (
                <>
                  <th scope="col" className="px-2 py-1.5 font-semibold">Date</th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">Category</th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">Description</th>
                </>
              ) : (
                <>
                  <th scope="col" className="px-2 py-1.5 font-semibold">Description</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-semibold">Qty</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-semibold">Unit price</th>
                  {hasDisc && <th scope="col" className="px-2 py-1.5 text-right font-semibold">Disc.</th>}
                </>
              )}
              {hasTax && <th scope="col" className="px-2 py-1.5 text-right font-semibold">Tax</th>}
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((it, i) => {
              const l = t.lines[i];
              return (
                <tr key={it.id} className="border-b border-[#e3e5e7] align-top">
                  {k.expense ? (
                    <>
                      <td className="whitespace-nowrap px-2 py-1.5">{it.date ? formatDate(it.date, doc.locale) : ""}</td>
                      <td className="px-2 py-1.5">{it.category}</td>
                      <td className="whitespace-pre-line px-2 py-1.5">{it.description || "-"}</td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-pre-line px-2 py-1.5">{it.description || "-"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{l.qty !== null ? formatScaled(l.qty, 3, doc.locale) : "?"}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{l.unit !== null ? m(l.unit) : "?"}</td>
                      {hasDisc && <td className="px-2 py-1.5 text-right">{it.discount.trim() && !l.errors.discount ? `${it.discount.replace(/%$/, "")}%` : ""}</td>}
                    </>
                  )}
                  {hasTax && <td className="px-2 py-1.5 text-right">{l.rate ? formatRate(l.rate) : ""}</td>}
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums">{m(l.net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[160px]">
            {k.expense && t.byCategory.length > 0 && (
              <>
                <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: accent }}>
                  By category
                </p>
                <dl>
                  {t.byCategory.map((c) => (
                    <div key={c.category} className="flex justify-between gap-6">
                      <dt className="text-[#6b6f73]">{c.category}</dt>
                      <dd className="tabular-nums">{m(c.amount)}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
          <dl className="ml-auto w-full max-w-[280px] space-y-1">
            <div className="flex justify-between gap-4">
              <dt className="text-[#6b6f73]">{doc.pricesIncludeTax ? "Subtotal (incl. tax)" : "Subtotal"}</dt>
              <dd className="tabular-nums">{m(t.subtotal)}</dd>
            </div>
            {t.discount !== 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-[#6b6f73]">Discount</dt>
                <dd className="tabular-nums">{m(-t.discount)}</dd>
              </div>
            )}
            {t.taxes.map((x) => (
              <div key={x.rate} className="flex justify-between gap-4">
                <dt className="text-[#6b6f73]">
                  {doc.pricesIncludeTax ? "Includes tax" : "Tax"} {formatRate(x.rate)} on {m(x.base)}
                </dt>
                <dd className="tabular-nums">{m(x.tax)}</dd>
              </div>
            ))}
            {t.shipping !== 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-[#6b6f73]">Shipping</dt>
                <dd className="tabular-nums">{m(t.shipping)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 px-2 py-1.5 text-[13px] font-bold" style={{ background: accent, color: "#fff" }}>
              <dt>Total</dt>
              <dd className="tabular-nums">{m(t.total)}</dd>
            </div>
            {(t.paid !== 0 || doc.kind === "receipt") && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6b6f73]">{k.paidLabel}</dt>
                  <dd className="tabular-nums">{m(doc.kind === "receipt" ? t.paid : -t.paid)}</dd>
                </div>
                {(doc.kind !== "receipt" || t.balance !== 0) && (
                  <div className="flex justify-between gap-4 font-semibold">
                    <dt>{k.balanceLabel}</dt>
                    <dd className="tabular-nums">{m(t.balance)}</dd>
                  </div>
                )}
              </>
            )}
            {doc.kind === "receipt" && doc.paymentMethod.trim() && <p className="text-right text-[#6b6f73]">Payment method: {doc.paymentMethod}</p>}
          </dl>
        </div>

        {doc.notes.trim() && (
          <div className="mt-4">
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              Notes
            </p>
            <p className="whitespace-pre-line">{doc.notes}</p>
          </div>
        )}
        {doc.terms.trim() && (
          <div className="mt-3">
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              {doc.kind === "quote" ? "Terms and conditions" : doc.kind === "expense" ? "Declaration" : "Terms"}
            </p>
            <p className="whitespace-pre-line">{doc.terms}</p>
          </div>
        )}
        {sigs.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8">
            {sigs.map((s, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-[5] border-t border-[#1e2124] pt-1 text-[10px] text-[#6b6f73]">{s}</div>
                <div className="flex-[2] border-t border-[#1e2124] pt-1 text-[10px] text-[#6b6f73]">Date</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export function DocEditor({ kind, storageKey }: { kind: DocKind; storageKey: string }) {
  const k = KINDS[kind];
  const [initial] = useState(() => blankDoc(kind));
  const [stored, setStored] = usePersistentState<BizDoc>(storageKey, initial);
  const doc = useMemo(() => normalizeDoc(stored, kind), [stored, kind]);
  const t = useMemo(() => computeTotals(doc), [doc]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ label: string; doc: BizDoc } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const update = (patch: Partial<BizDoc>) => setStored((prev) => ({ ...normalizeDoc(prev, kind), ...patch }));
  const setItem = (id: string, patch: Partial<LineItem>) =>
    setStored((prev) => {
      const d = normalizeDoc(prev, kind);
      return { ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) };
    });
  const moveItem = (index: number, dir: -1 | 1) =>
    setStored((prev) => {
      const d = normalizeDoc(prev, kind);
      const j = index + dir;
      if (j < 0 || j >= d.items.length) return d;
      const items = [...d.items];
      [items[index], items[j]] = [items[j], items[index]];
      return { ...d, items };
    });
  const removeItem = (id: string) =>
    setStored((prev) => {
      const d = normalizeDoc(prev, kind);
      return { ...d, items: d.items.filter((it) => it.id !== id) };
    });
  const addItem = () =>
    setStored((prev) => {
      const d = normalizeDoc(prev, kind);
      const last = d.items[d.items.length - 1];
      return { ...d, items: [...d.items, { ...emptyItem(kind), taxRate: last?.taxRate ?? "", date: kind === "expense" ? last?.date ?? "" : "" }] };
    });

  const replaceWithUndo = (label: string, next: BizDoc) => {
    setUndo({ label, doc });
    setStored(next);
    setError(null);
  };

  const newDocument = () => {
    const today = localTodayIso();
    const fresh = blankDoc(kind);
    replaceWithUndo("New document started.", {
      ...fresh,
      number: incrementDocNumber(doc.number || fresh.number),
      title: doc.title,
      issueDate: today,
      secondDate: k.secondDays ? addDaysIso(today, k.secondDays) : "",
      currency: doc.currency,
      locale: doc.locale,
      from: doc.from,
      to: kind === "expense" ? doc.to : fresh.to,
      notes: doc.notes,
      terms: doc.terms,
      logo: doc.logo,
      accent: doc.accent,
      pageSize: doc.pageSize,
      pricesIncludeTax: doc.pricesIncludeTax,
      paymentMethod: doc.paymentMethod,
      showSignatures: doc.showSignatures,
      signatures: doc.signatures,
    });
  };

  const exportPdf = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const { embedUnicodeFonts } = await import("@/components/tools/engines/pdf");
      const { renderBizDocPdf } = await import("../lib/docPdf");
      const pdf = await PDFDocument.create();
      const fonts = await embedUnicodeFonts(pdf);
      const res = await renderBizDocPdf(pdf, fonts, doc, t);
      const bytes = await pdf.save();
      if (!alive.current) return;
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${safeName(doc.number, kind)}.pdf`);
      setInfo(
        `PDF ready: ${res.pages} page${res.pages === 1 ? "" : "s"}.` +
          (res.replacedChars.length ? ` The PDF font has no glyphs for ${res.replacedChars.slice(0, 8).join(" ")}, so they appear as "?".` : ""),
      );
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? `Could not create the PDF: ${e.message}` : "Could not create the PDF.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is larger than 5 MB, so it is not a draft exported from this tool.");
      return;
    }
    const res = parseDocJson(await file.text(), kind);
    if (typeof res === "string") setError(res);
    else replaceWithUndo(`Imported ${file.name}.`, res);
  };

  const onLogo = async (files: File[]) => {
    setLogoError(null);
    try {
      const url = await logoToDataUrl(files[0]);
      if (alive.current) update({ logo: url });
    } catch (e) {
      if (alive.current) setLogoError(e instanceof Error ? e.message : "Could not read that image.");
    }
  };

  const m = (v: number) => formatMoney(v, doc.currency, doc.locale);
  const sectionCls = "space-y-4";

  return (
    <div className="space-y-5">
      <ToolPanel
        title={`${k.title} details`}
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => replaceWithUndo("Example loaded.", sampleDoc(kind, { ...blankDoc(kind), number: doc.number, logo: doc.logo, accent: doc.accent, currency: doc.currency, locale: doc.locale, pageSize: doc.pageSize }))}>
              Load example
            </Btn>
            <Btn variant="ghost" icon="plus" onClick={newDocument}>
              New {k.title.toLowerCase()}
            </Btn>
            <Btn variant="subtle" icon="reset" onClick={() => replaceWithUndo("Draft cleared.", blankDoc(kind))}>
              Clear
            </Btn>
          </>
        }
      >
        {undo && (
          <div className="mb-5">
            <Notice tone="success">
              <span className="mr-2">{undo.label}</span>
              <button
                type="button"
                className="inline-flex min-h-10 items-center font-medium text-accent-strong underline underline-offset-2"
                onClick={() => {
                  setStored(undo.doc);
                  setUndo(null);
                }}
              >
                Undo
              </button>
            </Notice>
          </div>
        )}
        <div className={sectionCls}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Document title" value={doc.title} onChange={(e) => update({ title: e.target.value })} />
            <TextField
              label="Number"
              hint="New documents continue the sequence (INV-0042 → INV-0043)."
              value={doc.number}
              onChange={(e) => update({ number: e.target.value })}
            />
            <div>
              <TextField label={k.issueLabel} type="date" value={doc.issueDate} onChange={(e) => update({ issueDate: e.target.value })} />
              <button type="button" className="mt-1 min-h-10 text-sm text-accent-strong underline underline-offset-2" onClick={() => update({ issueDate: localTodayIso() })}>
                Set to today
              </button>
            </div>
            {k.secondLabel && (
              <div>
                <TextField label={k.secondLabel} type="date" value={doc.secondDate} onChange={(e) => update({ secondDate: e.target.value })} />
                {k.secondDays && (
                  <button
                    type="button"
                    className="mt-1 min-h-10 text-sm text-accent-strong underline underline-offset-2"
                    onClick={() => update({ secondDate: addDaysIso(doc.issueDate || localTodayIso(), k.secondDays as number) })}
                  >
                    {k.secondDays} days after {k.issueLabel.toLowerCase()}
                  </button>
                )}
              </div>
            )}
            <TextField label={k.referenceLabel} optional value={doc.reference} onChange={(e) => update({ reference: e.target.value })} />
            <SelectField
              label="Currency"
              value={doc.currency}
              onChange={(e) => update({ currency: e.target.value })}
              options={CURRENCIES.map((c) => {
                let name: string = c;
                try {
                  name = new Intl.DisplayNames(["en"], { type: "currency" }).of(c) ?? c;
                } catch {
                  /* older browsers */
                }
                return { value: c, label: `${c}: ${name}` };
              })}
            />
            <SelectField label="Number format" value={doc.locale} onChange={(e) => update({ locale: e.target.value })} options={LOCALES.map((l) => ({ value: l.value, label: l.label }))} />
            <div>
              <p className="text-sm font-medium text-ink">Paper size</p>
              <div className="mt-2">
                <Segmented
                  label="Paper size"
                  value={doc.pageSize}
                  onChange={(v) => update({ pageSize: v })}
                  options={[
                    { value: "a4", label: "A4" },
                    { value: "letter", label: "US Letter" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${storageKey}-accent`} className="text-sm font-medium text-ink">
                Accent color
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id={`${storageKey}-accent`}
                  type="color"
                  value={doc.accent}
                  onChange={(e) => update({ accent: e.target.value })}
                  className="h-11 w-16 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
                />
                <span className="font-mono text-sm text-ink-2">{doc.accent}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Logo (optional)</p>
              <div className="mt-2">
                {doc.logo ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                    <img src={doc.logo} alt="Current logo" className="h-12 max-w-[140px] rounded bg-white object-contain p-1 shadow-[0_0_0_1px_var(--line)]" />
                    <Btn variant="danger" icon="trash" onClick={() => update({ logo: null })}>
                      Remove logo
                    </Btn>
                  </div>
                ) : (
                  <FileDrop compact accept="image/png,image/jpeg,.png,.jpg,.jpeg" maxSizeMB={5} label="Choose a PNG or JPG logo" hint="Up to 5 MB. Scaled to 600 px and embedded." onFiles={onLogo} />
                )}
                {logoError && (
                  <div className="mt-2">
                    <Notice tone="error">{logoError}</Notice>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Parties">
        <div className={`grid gap-6 ${k.shipToLabel ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <PartyFields label={k.fromLabel} value={doc.from} onChange={(p) => update({ from: p })} />
          <PartyFields label={k.toLabel} value={doc.to} onChange={(p) => update({ to: p })} />
          {k.shipToLabel && <PartyFields label={`${k.shipToLabel} (optional)`} value={doc.shipTo} onChange={(p) => update({ shipTo: p })} />}
        </div>
      </ToolPanel>

      <ToolPanel
        title={k.expense ? "Expenses" : "Line items"}
        actions={
          <Btn variant="ghost" icon="plus" onClick={addItem}>
            Add {k.expense ? "expense" : "item"}
          </Btn>
        }
      >
        <ol className="space-y-3">
          {doc.items.map((it, i) => {
            const l = t.lines[i];
            const n = i + 1;
            const errs = Object.values(l.errors).filter(Boolean);
            return (
              <li key={it.id} className="rounded-xl bg-sunken p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  {k.expense && (
                    <>
                      <CellInput label={`Expense ${n} date`} type="date" value={it.date} onChange={(e) => setItem(it.id, { date: e.target.value })} className="col-span-1 sm:col-span-2" />
                      <CellSelect
                        label={`Expense ${n} category`}
                        value={it.category}
                        onChange={(e) => setItem(it.id, { category: e.target.value })}
                        options={[...new Set<string>([...EXPENSE_CATEGORIES, it.category].filter(Boolean))]}
                        className="col-span-1 sm:col-span-2"
                      />
                    </>
                  )}
                  <CellInput
                    label={`${k.expense ? "Expense" : "Item"} ${n} description`}
                    placeholder="Description"
                    value={it.description}
                    onChange={(e) => setItem(it.id, { description: e.target.value })}
                    className={`col-span-2 ${k.expense ? "sm:col-span-2" : "sm:col-span-6"}`}
                  />
                  {!k.expense && (
                    <label className="col-span-1 text-xs text-muted">
                      Qty
                      <CellInput label={`Item ${n} quantity`} inputMode="decimal" value={it.qty} invalid={!!l.errors.qty} onChange={(e) => setItem(it.id, { qty: e.target.value })} />
                    </label>
                  )}
                  <label className={`text-xs text-muted ${k.expense ? "col-span-1 sm:col-span-2" : "col-span-1 sm:col-span-2"}`}>
                    {k.expense ? "Amount" : "Unit price"}
                    <CellInput
                      label={`${k.expense ? "Expense" : "Item"} ${n} ${k.expense ? "amount" : "unit price"}`}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={it.unitPrice}
                      invalid={!!l.errors.unitPrice}
                      onChange={(e) => setItem(it.id, { unitPrice: e.target.value })}
                    />
                  </label>
                  {!k.expense && (
                    <label className="col-span-1 text-xs text-muted">
                      Disc. %
                      <CellInput label={`Item ${n} discount percent`} inputMode="decimal" placeholder="0" value={it.discount} invalid={!!l.errors.discount} onChange={(e) => setItem(it.id, { discount: e.target.value })} />
                    </label>
                  )}
                  <label className="col-span-1 text-xs text-muted">
                    Tax %
                    <CellInput label={`${k.expense ? "Expense" : "Item"} ${n} tax percent`} inputMode="decimal" placeholder="0" value={it.taxRate} invalid={!!l.errors.taxRate} onChange={(e) => setItem(it.id, { taxRate: e.target.value })} />
                  </label>
                  <div className={`flex items-end justify-between gap-2 ${k.expense ? "col-span-2 sm:col-span-3" : "col-span-2 sm:col-span-1"}`}>
                    <p className="pb-2 text-sm font-semibold tabular-nums text-ink">
                      <span className="sr-only">Line {n} amount: </span>
                      {m(l.net)}
                    </p>
                  </div>
                  <div className={`col-span-2 flex items-end justify-end gap-1 ${k.expense ? "sm:col-span-3" : "sm:col-span-6"}`}>
                    <button type="button" aria-label={`Move line ${n} up`} disabled={i === 0} onClick={() => moveItem(i, -1)} className="grid h-10 w-10 place-items-center rounded-lg text-ink-2 hover:bg-surface disabled:opacity-40">
                      <Icon name="chevron" size={18} className="rotate-180" />
                    </button>
                    <button type="button" aria-label={`Move line ${n} down`} disabled={i === doc.items.length - 1} onClick={() => moveItem(i, 1)} className="grid h-10 w-10 place-items-center rounded-lg text-ink-2 hover:bg-surface disabled:opacity-40">
                      <Icon name="chevron" size={18} />
                    </button>
                    <button type="button" aria-label={`Remove line ${n}`} onClick={() => removeItem(it.id)} className="grid h-10 w-10 place-items-center rounded-lg text-danger hover:bg-surface">
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </div>
                {errs.length > 0 && (
                  <p className="mt-2 text-sm text-danger" role="alert">
                    Line {n}: {errs.join(". ")}.
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        {doc.items.length === 0 && <p className="text-sm text-muted">No lines yet. Add one to start.</p>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {!k.expense && (
            <>
              <div>
                <p className="text-sm font-medium text-ink">Discount on the whole document</p>
                <div className="mt-2 flex gap-2">
                  <CellSelect
                    label="Discount type"
                    value={doc.discountType}
                    onChange={(e) => update({ discountType: e.target.value === "amount" ? "amount" : "percent" })}
                    options={[
                      { value: "percent", label: "%" },
                      { value: "amount", label: doc.currency },
                    ]}
                    className="w-24 shrink-0"
                  />
                  <CellInput label="Discount value" inputMode="decimal" placeholder="0" value={doc.discountValue} invalid={!!t.fieldErrors.discount} onChange={(e) => update({ discountValue: e.target.value })} />
                </div>
                {t.fieldErrors.discount && <p className="mt-1 text-sm text-danger">{t.fieldErrors.discount}</p>}
              </div>
              <TextField label="Shipping" optional inputMode="decimal" placeholder="0.00" value={doc.shipping} error={t.fieldErrors.shipping} onChange={(e) => update({ shipping: e.target.value })} />
            </>
          )}
          {kind === "receipt" ? (
            <div className="space-y-3">
              <Checkbox label="Paid in full" checked={doc.paidInFull} onChange={(v) => update({ paidInFull: v })} />
              {!doc.paidInFull && <TextField label="Amount paid" inputMode="decimal" value={doc.amountPaid} error={t.fieldErrors.paid} onChange={(e) => update({ amountPaid: e.target.value })} />}
            </div>
          ) : (
            <TextField label={k.paidLabel} optional inputMode="decimal" placeholder="0.00" value={doc.amountPaid} error={t.fieldErrors.paid} onChange={(e) => update({ amountPaid: e.target.value })} />
          )}
          {k.showPaymentMethod && (
            <TextField label="Payment method" optional placeholder="Cash, card, bank transfer…" value={doc.paymentMethod} onChange={(e) => update({ paymentMethod: e.target.value })} />
          )}
          <div className="sm:col-span-2">
            <Checkbox
              label={k.expense ? "Amounts include tax" : "Prices include tax"}
              hint={doc.pricesIncludeTax ? "Tax is worked out from the amounts and shown as included." : "Tax is added on top of the prices."}
              checked={doc.pricesIncludeTax}
              onChange={(v) => update({ pricesIncludeTax: v })}
            />
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Notes, terms and signatures">
        <div className="grid gap-4 md:grid-cols-2">
          <TextArea label="Notes" optional placeholder={k.notesPlaceholder} value={doc.notes} onChange={(e) => update({ notes: e.target.value })} />
          <TextArea label={kind === "expense" ? "Declaration" : "Terms"} optional placeholder={k.termsPlaceholder} value={doc.terms} onChange={(e) => update({ terms: e.target.value })} />
        </div>
        <div className="mt-4 space-y-3">
          <Checkbox label="Add signature lines" checked={doc.showSignatures} onChange={(v) => update({ showSignatures: v })} />
          {doc.showSignatures && (
            <TextField
              label="Signature line labels"
              hint="Separate up to four labels with commas."
              value={doc.signatures.join(", ")}
              onChange={(e) => update({ signatures: e.target.value.split(",").map((s) => s.trimStart()).slice(0, 4) })}
            />
          )}
        </div>
      </ToolPanel>

      <ToolPanel
        title="Preview and export"
        actions={
          <>
            <Btn icon="download" onClick={exportPdf} disabled={busy}>
              {busy ? "Building PDF…" : "Download PDF"}
            </Btn>
            <Btn
              variant="ghost"
              icon="table"
              onClick={() => downloadFile(`${safeName(doc.number, kind)}.csv`, toCsv(itemsCsvRows(doc, t)), "text/csv")}
            >
              CSV
            </Btn>
            <Btn variant="ghost" icon="braces" onClick={() => downloadFile(`${safeName(doc.number, kind)}.json`, JSON.stringify(doc, null, 2), "application/json")}>
              Export JSON
            </Btn>
            <Btn variant="ghost" icon="upload" onClick={() => importRef.current?.click()}>
              Import JSON
            </Btn>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                void onImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </>
        }
      >
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line shadow-[0_0_0_1px_var(--line)] sm:grid-cols-3" aria-live="polite">
            <div className="bg-surface px-4 py-3">
              <dt className="text-[0.8125rem] text-muted">Total</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{m(t.total)}</dd>
            </div>
            <div className="bg-surface px-4 py-3">
              <dt className="text-[0.8125rem] text-muted">Tax</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{m(t.taxTotal)}</dd>
            </div>
            <div className="bg-surface px-4 py-3">
              <dt className="text-[0.8125rem] text-muted">{k.balanceLabel}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{m(t.balance)}</dd>
            </div>
          </dl>
          {busy && <Spinner label="Building the PDF" />}
          {error && <Notice tone="error">{error}</Notice>}
          {info && <Notice tone="success">{info}</Notice>}
          {t.errors.map((e) => (
            <Notice key={e} tone="warning">
              {e}
            </Notice>
          ))}
          <Preview doc={doc} t={t} />
          <PrivacyNote stored />
        </div>
      </ToolPanel>
    </div>
  );
}
