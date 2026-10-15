"use client";

import { useState } from "react";
import { Checkbox, Segmented, TextField, uid } from "@/components/tools/kit";
import { ItemEditor } from "./editor";
import { NumInput } from "./shared";
import { normalizeUrl } from "./lib/text";
import type { Item, LinkItem } from "./lib/write";

function urlError(it: LinkItem) {
  if (it.target.type !== "url") return null;
  const r = normalizeUrl(it.target.url);
  return "error" in r ? r.error : null;
}

export default function Tool() {
  const [border, setBorder] = useState(false);

  return (
    <ItemEditor
      suffix="links"
      mode="rect"
      addLabel="Add link area at center"
      hint="Drag a rectangle over the text or image that should be clickable, then enter the address on the right. A single click makes a standard-size area."
      createItem={(g) => {
        const base = { kind: "link" as const, id: uid(), page: g.page, target: { type: "url" as const, url: "" }, border };
        if (g.kind === "rect") return { ...base, x: g.x, y: g.y, w: Math.max(g.w, 8), h: Math.max(g.h, 8) };
        if (g.kind === "point") return { ...base, x: g.x - 80, y: g.y - 10, w: 160, h: 20 };
        return null;
      }}
      settings={
        <section aria-label="Link options" className="space-y-3">
          <Checkbox label="Show a thin border around new links" checked={border} onChange={setBorder} hint="Off by default: most readers show a hand cursor on hover instead." />
        </section>
      }
      inspector={(it: Item, onChange, { numPages }) => {
        if (it.kind !== "link") return null;
        const err = urlError(it);
        return (
          <div className="space-y-3">
            <Segmented
              label="Link target"
              value={it.target.type}
              onChange={(t) => onChange({ ...it, target: t === "url" ? { type: "url", url: "" } : { type: "page", page: 1 } })}
              options={[
                { value: "url", label: "Web address" },
                { value: "page", label: "Page in this PDF" },
              ]}
            />
            {it.target.type === "url" ? (
              <TextField
                label="Address"
                placeholder="https://example.com"
                value={it.target.url}
                inputMode="url"
                autoComplete="url"
                error={it.target.url ? err : null}
                hint="Web pages, mailto: or tel: links."
                onChange={(e) => onChange({ ...it, target: { type: "url", url: e.target.value } })}
              />
            ) : (
              <NumInput
                key={`tp${it.id}${it.target.page}`}
                label="Go to page"
                value={it.target.page}
                min={1}
                max={numPages}
                onCommit={(v) => onChange({ ...it, target: { type: "page", page: Math.round(v) } })}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <NumInput key={`lw${it.id}${it.w}`} label="Width" suffix="pt" value={it.w} min={4} max={5000} onCommit={(v) => onChange({ ...it, w: v })} />
              <NumInput key={`lh${it.id}${it.h}`} label="Height" suffix="pt" value={it.h} min={4} max={5000} onCommit={(v) => onChange({ ...it, h: v })} />
            </div>
            <Checkbox label="Visible border" checked={it.border} onChange={(v) => onChange({ ...it, border: v })} />
          </div>
        );
      }}
      validate={(items) => {
        const links = items.filter((i): i is LinkItem => i.kind === "link");
        const bad = links.filter((l) => urlError(l));
        return bad.length ? `${bad.length} link${bad.length === 1 ? " needs" : "s need"} a valid address. Select ${bad.length === 1 ? "it" : "each one"} and fill in the Address field.` : null;
      }}
      prepare={(items) =>
        items.map((it) => {
          if (it.kind !== "link" || it.target.type !== "url") return it;
          const r = normalizeUrl(it.target.url);
          return "url" in r ? { ...it, target: { type: "url", url: r.url } } : it;
        })
      }
      doneMessage={(n) => `Added ${n} clickable link${n === 1 ? "" : "s"}.`}
    />
  );
}
