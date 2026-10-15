"use client";

import { useState } from "react";
import { Checkbox, TextField } from "@/components/tools/kit";
import { embedUnicodeFonts, getPdfLib } from "@/components/tools/engines/pdf";
import { ProcessTool } from "./process";
import { ColorInput, NumInput, rangeOrError } from "./shared";
import { loadForEdit } from "./lib/write";
import { SLOT_LABELS, type Slot, stampPageText } from "./lib/stamp";
import { fillTokens, isoDate } from "./lib/text";

const SLOTS: Slot[] = ["tl", "tc", "tr", "bl", "bc", "br"];

export default function Tool() {
  const [texts, setTexts] = useState<Record<Slot, string>>({ tl: "", tc: "", tr: "{date}", bl: "", bc: "", br: "Page {page} of {total}" });
  const [size, setSize] = useState(9);
  const [margin, setMargin] = useState(24);
  const [color, setColor] = useState("#444444");
  const [skipFirst, setSkipFirst] = useState(false);
  const [pages, setPages] = useState("");

  const key = JSON.stringify({ texts, size, margin, color, skipFirst, pages });
  const any = SLOTS.some((s) => texts[s].trim());

  return (
    <ProcessTool
      suffix="header-footer"
      actionLabel="Add header and footer"
      doneMessage="Header and footer added."
      settingsKey={key}
      validate={({ numPages }) => {
        if (!any) return "Fill in at least one header or footer field.";
        return rangeOrError(pages, numPages).error;
      }}
      process={async (source, { numPages }) => {
        const L = await getPdfLib();
        const doc = await loadForEdit(L, source.bytes);
        const { regular } = await embedUnicodeFonts(doc);
        const r = rangeOrError(pages, numPages);
        if (!r.pages) throw new Error(r.error);
        const date = isoDate(new Date());
        const entries = new Map<number, Partial<Record<Slot, string>>>();
        for (const p of r.pages) {
          if (skipFirst && p === 1) continue;
          const slots: Partial<Record<Slot, string>> = {};
          for (const s of SLOTS) if (texts[s].trim()) slots[s] = fillTokens(texts[s], { page: p, total: numPages, date });
          entries.set(p - 1, slots);
        }
        stampPageText(L, doc, entries, { size, margin, color, font: regular });
        return doc.save();
      }}
      settings={() => (
        <section aria-label="Header and footer settings" className="space-y-4">
          <p className="text-[0.8125rem] text-muted">Tokens: {"{page}"} page number, {"{total}"} page count, {"{date}"} today ({isoDate(new Date())}).</p>
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-ink">Header</legend>
            {SLOTS.slice(0, 3).map((s) => (
              <TextField key={s} label={SLOT_LABELS[s]} optional value={texts[s]} onChange={(e) => setTexts((t) => ({ ...t, [s]: e.target.value }))} />
            ))}
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-ink">Footer</legend>
            {SLOTS.slice(3).map((s) => (
              <TextField key={s} label={SLOT_LABELS[s]} optional value={texts[s]} onChange={(e) => setTexts((t) => ({ ...t, [s]: e.target.value }))} />
            ))}
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <NumInput key={`fs${size}`} label="Font size" suffix="pt" value={size} min={5} max={48} onCommit={setSize} />
            <NumInput key={`m${margin}`} label="Edge distance" suffix="pt" value={margin} min={0} max={300} onCommit={setMargin} />
          </div>
          <ColorInput label="Color" value={color} onChange={setColor} />
          <Checkbox label="Skip the first page" checked={skipFirst} onChange={setSkipFirst} />
          <TextField label="Pages" optional placeholder="All pages" hint="Examples: 2-10, 12" value={pages} onChange={(e) => setPages(e.target.value)} />
        </section>
      )}
    />
  );
}
