"use client";

import { useState } from "react";
import { Btn, TextField } from "@/components/tools/kit";
import { parsePageRanges } from "@/components/tools/engines/pdf";
import { evenPages, formatRanges, oddPages } from "./lib/layout";

/** Page-number selection with quick picks and a typed range. Pages are 1-based. */
export function usePageSelection() {
  const [sel, setSel] = useState<ReadonlySet<number>>(new Set());
  const toggle = (p: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  return { sel, setSel, toggle };
}

export function SelectionTools({
  pageCount,
  selected,
  onChange,
  rangeLabel = "Select pages by number",
}: {
  pageCount: number;
  selected: ReadonlySet<number>;
  onChange: (s: ReadonlySet<number>) => void;
  rangeLabel?: string;
}) {
  const [range, setRange] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const all = Array.from({ length: pageCount }, (_, i) => i + 1);
  const apply = () => {
    if (!range.trim()) {
      setErr("Type pages such as 1-3, 5, 8-.");
      return;
    }
    const r = parsePageRanges(range, pageCount);
    if (typeof r === "string") {
      setErr(r);
      return;
    }
    setErr(null);
    onChange(new Set(r));
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          label={rangeLabel}
          hint={`Ranges like 1-3, 5, 8- (this PDF has ${pageCount} pages).`}
          value={range}
          error={err}
          onChange={(e) => setRange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          className="min-w-0 flex-1 basis-60"
          placeholder="e.g. 1-3, 7"
        />
        <Btn variant="ghost" onClick={apply} className="mb-[1px] h-11">
          Apply
        </Btn>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick selection">
        <Btn variant="subtle" onClick={() => onChange(new Set(all))}>
          All
        </Btn>
        <Btn variant="subtle" onClick={() => onChange(new Set())}>
          None
        </Btn>
        <Btn variant="subtle" onClick={() => onChange(new Set(oddPages(pageCount)))}>
          Odd
        </Btn>
        <Btn variant="subtle" onClick={() => onChange(new Set(evenPages(pageCount)))}>
          Even
        </Btn>
        <Btn variant="subtle" onClick={() => onChange(new Set(all.filter((p) => !selected.has(p))))}>
          Invert
        </Btn>
        <span className="text-sm text-muted" aria-live="polite">
          {selected.size === 0 ? "No pages selected" : `${selected.size} selected: ${formatRanges([...selected])}`}
        </span>
      </div>
    </div>
  );
}
