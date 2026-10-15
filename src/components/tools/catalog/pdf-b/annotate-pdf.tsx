"use client";

import { useState } from "react";
import { Segmented, TextArea, uid } from "@/components/tools/kit";
import { ItemEditor } from "./editor";
import { ColorInput, NumInput, RangeInput } from "./shared";
import type { ArrowItem, Item, NoteItem, RectItem } from "./lib/write";

type Tool = "highlight" | "box" | "arrow" | "note";

const DEFAULT_COLORS: Record<Tool, string> = {
  highlight: "#ffd400",
  box: "#d62828",
  arrow: "#d62828",
  note: "#222222",
};

const HINTS: Record<Tool, string> = {
  highlight: "Drag across the text to highlight it. A single click adds a standard-size highlight.",
  box: "Drag to draw a box around something. A single click adds a standard-size box.",
  arrow: "Drag from the tail to the point of the arrow. A single click adds a short arrow pointing at the spot.",
  note: "Click where the comment should appear. Type the comment on the right first.",
};

export default function Tool() {
  const [tool, setTool] = useState<Tool>("highlight");
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [opacity, setOpacity] = useState(0.35);
  const [stroke, setStroke] = useState(2);
  const [note, setNote] = useState("Please check this.");
  const [noteSize, setNoteSize] = useState(10);
  const color = colors[tool];

  return (
    <ItemEditor
      suffix="annotated"
      mode={tool === "arrow" ? "line" : tool === "note" ? "point" : "rect"}
      addLabel="Add at page center"
      hint={HINTS[tool]}
      blockedReason={tool === "note" && !note.trim() ? "Type the comment text in the panel on the right first." : null}
      createItem={(g) => {
        const base = { id: uid(), page: g.page };
        if (tool === "highlight" || tool === "box") {
          const r =
            g.kind === "rect" ? { x: g.x, y: g.y, w: g.w, h: g.h } : g.kind === "point" ? { x: g.x - 60, y: g.y - 9, w: 120, h: 18 } : null;
          if (!r) return null;
          const item: RectItem = { ...base, kind: "rect", ...r, style: tool, color, opacity: tool === "highlight" ? opacity : 1, strokeWidth: stroke };
          return item;
        }
        if (tool === "arrow") {
          const l = g.kind === "line" ? g : g.kind === "point" ? { x1: g.x - 60, y1: g.y + 30, x2: g.x, y2: g.y } : null;
          if (!l) return null;
          const item: ArrowItem = { ...base, kind: "arrow", x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, color, strokeWidth: stroke };
          return item;
        }
        if (g.kind !== "point") return null;
        const item: NoteItem = { ...base, kind: "note", x: g.x, y: g.y, w: 160, text: note, size: noteSize, color };
        return item;
      }}
      settings={
        <section aria-label="Annotation tool" className="space-y-4">
          <Segmented
            label="Annotation type"
            value={tool}
            onChange={setTool}
            options={[
              { value: "highlight", label: "Highlight" },
              { value: "box", label: "Box" },
              { value: "arrow", label: "Arrow" },
              { value: "note", label: "Comment" },
            ]}
          />
          <ColorInput label="Color" value={color} onChange={(v) => setColors((c) => ({ ...c, [tool]: v }))} />
          {tool === "highlight" && (
            <RangeInput label="Opacity" min={0.1} max={0.8} step={0.05} value={opacity} onChange={setOpacity} format={(v) => `${Math.round(v * 100)}%`} />
          )}
          {(tool === "box" || tool === "arrow") && (
            <RangeInput label="Line width" min={0.5} max={8} step={0.5} value={stroke} onChange={setStroke} format={(v) => `${v} pt`} />
          )}
          {tool === "note" && (
            <>
              <TextArea label="Comment text" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              <NumInput key={`ns${noteSize}`} label="Text size" suffix="pt" value={noteSize} min={6} max={36} onCommit={setNoteSize} />
            </>
          )}
        </section>
      }
      inspector={(it: Item, onChange) => {
        switch (it.kind) {
          case "rect":
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumInput key={`w${it.id}${it.w}`} label="Width" suffix="pt" value={it.w} min={2} max={5000} onCommit={(v) => onChange({ ...it, w: v })} />
                  <NumInput key={`h${it.id}${it.h}`} label="Height" suffix="pt" value={it.h} min={2} max={5000} onCommit={(v) => onChange({ ...it, h: v })} />
                </div>
                <ColorInput label="Color" value={it.color} onChange={(v) => onChange({ ...it, color: v })} />
                {it.style === "highlight" ? (
                  <RangeInput label="Opacity" min={0.1} max={0.8} step={0.05} value={it.opacity} onChange={(v) => onChange({ ...it, opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
                ) : (
                  <RangeInput label="Line width" min={0.5} max={8} step={0.5} value={it.strokeWidth} onChange={(v) => onChange({ ...it, strokeWidth: v })} format={(v) => `${v} pt`} />
                )}
              </div>
            );
          case "arrow":
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumInput key={`x1${it.id}${it.x1}`} label="Tail X" suffix="pt" value={it.x1} onCommit={(v) => onChange({ ...it, x1: v })} />
                  <NumInput key={`y1${it.id}${it.y1}`} label="Tail Y" suffix="pt" value={it.y1} onCommit={(v) => onChange({ ...it, y1: v })} />
                  <NumInput key={`x2${it.id}${it.x2}`} label="Point X" suffix="pt" value={it.x2} onCommit={(v) => onChange({ ...it, x2: v })} />
                  <NumInput key={`y2${it.id}${it.y2}`} label="Point Y" suffix="pt" value={it.y2} onCommit={(v) => onChange({ ...it, y2: v })} />
                </div>
                <ColorInput label="Color" value={it.color} onChange={(v) => onChange({ ...it, color: v })} />
                <RangeInput label="Line width" min={0.5} max={8} step={0.5} value={it.strokeWidth} onChange={(v) => onChange({ ...it, strokeWidth: v })} format={(v) => `${v} pt`} />
              </div>
            );
          case "note":
            return (
              <div className="space-y-3">
                <TextArea label="Comment" value={it.text} onChange={(e) => onChange({ ...it, text: e.target.value })} rows={3} />
                <div className="grid grid-cols-2 gap-3">
                  <NumInput key={`nw${it.id}${it.w}`} label="Box width" suffix="pt" value={it.w} min={40} max={2000} onCommit={(v) => onChange({ ...it, w: v })} />
                  <NumInput key={`nsz${it.id}${it.size}`} label="Text size" suffix="pt" value={it.size} min={6} max={36} onCommit={(v) => onChange({ ...it, size: v })} />
                </div>
              </div>
            );
          default:
            return null;
        }
      }}
      validate={(items) => (items.some((i) => i.kind === "note" && !i.text.trim()) ? "A comment is empty. Type text or remove it." : null)}
      doneMessage={(n) => `Flattened ${n} annotation${n === 1 ? "" : "s"} into the pages.`}
    />
  );
}
