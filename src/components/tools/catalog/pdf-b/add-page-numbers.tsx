"use client";

import { useState } from "react";
import { Checkbox, SelectField, TextField } from "@/components/tools/kit";
import { embedUnicodeFonts, getPdfLib } from "@/components/tools/engines/pdf";
import { ProcessTool } from "./process";
import { ColorInput, NumInput } from "./shared";
import { loadForEdit } from "./lib/write";
import { SLOT_LABELS, type Slot, stampPageText } from "./lib/stamp";
import { fillTokens, isoDate, pageNumberPlan } from "./lib/text";

const PRESETS = [
  { value: "{n}", label: "1, 2, 3" },
  { value: "Page {n}", label: "Page 1" },
  { value: "Page {n} of {total}", label: "Page 1 of 10" },
  { value: "{n} / {total}", label: "1 / 10" },
  { value: "- {n} -", label: "- 1 -" },
];

export default function Tool() {
  const [format, setFormat] = useState("Page {n} of {total}");
  const [slot, setSlot] = useState<Slot>("bc");
  const [start, setStart] = useState(1);
  const [size, setSize] = useState(10);
  const [margin, setMargin] = useState(28);
  const [color, setColor] = useState("#333333");
  const [skipFirst, setSkipFirst] = useState(false);

  const key = JSON.stringify({ format, slot, start, size, margin, color, skipFirst });
  const sample = (numPages: number) => {
    const plan = pageNumberPlan(Math.max(1, numPages), start, skipFirst);
    const first = plan.numbers.find((n) => n !== null) ?? start;
    return fillTokens(format, { page: first, total: plan.total, date: isoDate(new Date()) });
  };

  return (
    <ProcessTool
      suffix="numbered"
      actionLabel="Add page numbers"
      doneMessage="Page numbers added."
      settingsKey={key}
      validate={({ numPages }) => {
        if (!format.trim()) return "Enter a number format, for example Page {n}.";
        if (skipFirst && numPages < 2) return "This PDF has one page, so skipping the first page would leave nothing to number.";
        return null;
      }}
      process={async (source, { numPages }) => {
        const L = await getPdfLib();
        const doc = await loadForEdit(L, source.bytes);
        const { regular } = await embedUnicodeFonts(doc);
        const plan = pageNumberPlan(numPages, start, skipFirst);
        const date = isoDate(new Date());
        const entries = new Map<number, Partial<Record<Slot, string>>>();
        plan.numbers.forEach((n, i) => {
          if (n !== null) entries.set(i, { [slot]: fillTokens(format, { page: n, total: plan.total, date }) });
        });
        stampPageText(L, doc, entries, { size, margin, color, font: regular });
        return doc.save();
      }}
      settings={({ numPages }) => (
        <section aria-label="Page number settings" className="space-y-4">
          <SelectField label="Preset" value={PRESETS.some((p) => p.value === format) ? format : ""} onChange={(e) => e.target.value && setFormat(e.target.value)} options={[{ value: "", label: "Custom" }, ...PRESETS]} />
          <TextField
            label="Format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            hint="Tokens: {n} page number, {total} last number, {date} today."
          />
          <p className="text-sm text-ink-2">
            First label: <span className="font-medium text-ink">{sample(numPages)}</span>
          </p>
          <SelectField
            label="Position"
            value={slot}
            onChange={(e) => setSlot(e.target.value as Slot)}
            options={(Object.keys(SLOT_LABELS) as Slot[]).map((s) => ({ value: s, label: SLOT_LABELS[s] }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumInput key={`st${start}`} label="Start at" value={start} min={0} max={100000} onCommit={(v) => setStart(Math.round(v))} />
            <NumInput key={`fs${size}`} label="Font size" suffix="pt" value={size} min={5} max={72} onCommit={setSize} />
            <NumInput key={`m${margin}`} label="Edge distance" suffix="pt" value={margin} min={0} max={300} onCommit={setMargin} />
            <ColorInput label="Color" value={color} onChange={setColor} />
          </div>
          <Checkbox label="Skip the first page (cover)" checked={skipFirst} onChange={setSkipFirst} hint="The second page gets the start number." />
        </section>
      )}
    />
  );
}
