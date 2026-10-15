"use client";

import { useState } from "react";
import { Checkbox, TextArea, uid } from "@/components/tools/kit";
import { ItemEditor } from "./editor";
import { ColorInput, NumInput } from "./shared";
import type { Item, TextItem } from "./lib/write";

export default function Tool() {
  const [text, setText] = useState("Your text here");
  const [size, setSize] = useState(14);
  const [color, setColor] = useState("#111111");
  const [bold, setBold] = useState(false);

  return (
    <ItemEditor
      suffix="text"
      mode="point"
      addLabel="Add at page center"
      hint="Click the page where the text should start. Drag text to move it; select it to edit."
      blockedReason={text.trim() ? null : "Type the text to place in the panel on the right first."}
      createItem={(g) => {
        if (g.kind !== "point") return null;
        const item: TextItem = { kind: "text", id: uid(), page: g.page, x: g.x, y: g.y - size * 0.6, text, size, color, bold };
        return item;
      }}
      settings={
        <section aria-label="New text" className="space-y-4">
          <TextArea label="Text to place" hint="New lines are kept." value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <NumInput key={`s${size}`} label="Font size" suffix="pt" value={size} min={4} max={200} onCommit={setSize} />
            <ColorInput label="Color" value={color} onChange={setColor} />
          </div>
          <Checkbox label="Bold" checked={bold} onChange={setBold} />
        </section>
      }
      inspector={(it: Item, onChange) =>
        it.kind === "text" ? (
          <div className="space-y-3">
            <TextArea label="Text" value={it.text} onChange={(e) => onChange({ ...it, text: e.target.value })} rows={3} />
            <div className="grid grid-cols-2 gap-3">
              <NumInput key={`fs${it.id}${it.size}`} label="Size" suffix="pt" value={it.size} min={4} max={200} onCommit={(v) => onChange({ ...it, size: v })} />
              <ColorInput label="Color" value={it.color} onChange={(v) => onChange({ ...it, color: v })} />
            </div>
            <Checkbox label="Bold" checked={it.bold} onChange={(v) => onChange({ ...it, bold: v })} />
          </div>
        ) : null
      }
      validate={(items) => (items.some((it) => it.kind === "text" && !it.text.trim()) ? "One of the text items is empty. Type something or remove it." : null)}
      doneMessage={(n) => `Added ${n} text item${n === 1 ? "" : "s"}.`}
    />
  );
}
