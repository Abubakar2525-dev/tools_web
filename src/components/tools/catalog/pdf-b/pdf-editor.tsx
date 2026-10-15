"use client";

import { useEffect, useRef, useState } from "react";
import {
  Checkbox,
  Notice,
  SelectField,
  TextArea,
  TextField,
  uid,
} from "@/components/tools/kit";
import { FileDrop } from "@/components/tools/engines/files";
import { Icon, type AnyIcon } from "@/components/ui/Icon";
import { ItemEditor } from "./editor";
import { fileToStoredImage } from "./images";
import { ColorInput, NumInput, RangeInput } from "./shared";
import { viewSize } from "./lib/geometry";
import type {
  ArrowItem,
  ImageItem,
  Item,
  LinkItem,
  PathItem,
  RectItem,
  StoredImage,
  TextItem,
} from "./lib/write";

type EditorTool =
  | "edit"
  | "select"
  | "text"
  | "image"
  | "signature"
  | "link"
  | "whiteout"
  | "pen"
  | "highlight"
  | "strike"
  | "box"
  | "ellipse"
  | "arrow"
  | "check";
type TextAlign = "left" | "center" | "right";
type FontFamily = "sans" | "serif" | "mono";

const TOOLS: { value: EditorTool; label: string; icon: AnyIcon }[] = [
  { value: "edit", label: "Edit text", icon: "text" },
  { value: "select", label: "Select", icon: "checklist" },
  { value: "text", label: "Add text", icon: "plus" },
  { value: "image", label: "Image", icon: "image" },
  { value: "signature", label: "Signature", icon: "signature" },
  { value: "link", label: "Link", icon: "link" },
  { value: "whiteout", label: "Whiteout", icon: "eraser" },
  { value: "pen", label: "Draw", icon: "pen" },
  { value: "highlight", label: "Highlight", icon: "palette" },
  { value: "strike", label: "Strike", icon: "text" },
  { value: "box", label: "Rectangle", icon: "square" },
  { value: "ellipse", label: "Ellipse", icon: "circle" },
  { value: "arrow", label: "Arrow", icon: "arrow" },
  { value: "check", label: "Checkmark", icon: "check" },
];

const HINTS: Record<EditorTool, string> = {
  edit: "Click selectable text already in the PDF, then edit and format it in the Selected item panel.",
  select:
    "Select an item to move, resize, edit or remove it. Arrow keys nudge the selected item.",
  text: "Click where the new text should start, then resize its text box for alignment.",
  image:
    "Upload an image, then click the page to place it. Drag and resize after placing.",
  signature:
    "Upload a transparent signature image, then click the page to place and resize it.",
  link: "Drag over text or an image to make that area clickable.",
  whiteout:
    "Drag over content to cover it. Whiteout visually hides content; it does not securely redact it.",
  pen: "Draw freehand with a mouse, pen or finger.",
  highlight: "Drag across an area to add a translucent highlight.",
  strike: "Drag across text to add a strikethrough line.",
  box: "Drag to draw a rectangle.",
  ellipse: "Drag to draw an ellipse or circle.",
  arrow: "Drag from the arrow tail to its point.",
  check: "Click to place a checkmark.",
};

interface UploadedImage {
  id: string;
  name: string;
  url: string;
  data: StoredImage;
}

function ToolButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: AnyIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[0.7rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active ? "bg-accent text-white" : "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-accent-soft hover:text-ink"}`}
    >
      <Icon name={icon} size={19} />
      <span>{label}</span>
    </button>
  );
}

function AlignButtons({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (value: TextAlign) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[0.8125rem] font-medium text-ink-2">Alignment</p>
      <div
        className="grid grid-cols-3 gap-1"
        role="group"
        aria-label="Text alignment"
      >
        {(["left", "center", "right"] as const).map((a) => (
          <button
            key={a}
            type="button"
            title={`${a} align`}
            aria-label={`${a} align`}
            aria-pressed={value === a}
            onClick={() => onChange(a)}
            className={`grid h-10 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-accent ${value === a ? "bg-accent text-white" : "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-accent-soft"}`}
          >
            <Icon name={`align-${a}` as AnyIcon} size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

function StyleToggles({
  bold,
  italic,
  underline,
  onBold,
  onItalic,
  onUnderline,
}: {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  onBold: (v: boolean) => void;
  onItalic: (v: boolean) => void;
  onUnderline: (v: boolean) => void;
}) {
  const opts = [
    { label: "Bold", short: "B", value: bold, set: onBold, cls: "font-bold" },
    {
      label: "Italic",
      short: "I",
      value: italic,
      set: onItalic,
      cls: "italic",
    },
    {
      label: "Underline",
      short: "U",
      value: underline,
      set: onUnderline,
      cls: "underline",
    },
  ];
  return (
    <div>
      <p className="mb-1 text-[0.8125rem] font-medium text-ink-2">Style</p>
      <div className="grid grid-cols-3 gap-1">
        {opts.map((o) => (
          <button
            key={o.label}
            type="button"
            title={o.label}
            aria-label={o.label}
            aria-pressed={o.value}
            onClick={() => o.set(!o.value)}
            className={`h-10 rounded-lg text-base ${o.cls} focus-visible:outline-2 focus-visible:outline-accent ${o.value ? "bg-accent text-white" : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-accent-soft"}`}
          >
            {o.short}
          </button>
        ))}
      </div>
    </div>
  );
}

const FONT_OPTIONS = [
  { value: "sans", label: "Sans serif" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Monospace" },
];

export default function Tool() {
  const [tool, setTool] = useState<EditorTool>("edit");
  const [text, setText] = useState("Your text here");
  const [textSize, setTextSize] = useState(14);
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans");
  const [align, setAlign] = useState<TextAlign>("left");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [color, setColor] = useState("#153d35");
  const [fillColor, setFillColor] = useState("#ffffff");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacity, setOpacity] = useState(0.35);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [upload, setUpload] = useState<UploadedImage | null>(null);
  const [imageWidth, setImageWidth] = useState(160);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => urls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );

  async function addImage(files: File[]) {
    const file = files[0];
    if (!file) return;
    setUploadError(null);
    try {
      const data = await fileToStoredImage(file);
      const url = URL.createObjectURL(data.blob);
      urls.current.push(url);
      setUpload({
        id: uid(),
        name: file.name,
        url,
        data: {
          bytes: data.bytes,
          type: data.type,
          width: data.width,
          height: data.height,
        },
      });
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "The image could not be read.",
      );
    }
  }

  const mode =
    tool === "edit"
      ? "existing-text"
      : tool === "select"
        ? "none"
        : tool === "pen"
          ? "path"
          : tool === "arrow"
            ? "line"
            : [
                  "highlight",
                  "strike",
                  "box",
                  "ellipse",
                  "whiteout",
                  "link",
                ].includes(tool)
              ? "rect"
              : "point";
  const needsImage = tool === "image" || tool === "signature";
  const blockedReason =
    needsImage && !upload
      ? `Upload ${tool === "signature" ? "a signature" : "an image"} first.`
      : tool === "text" && !text.trim()
        ? "Type the text to place first."
        : null;
  const images = new Map(upload ? [[upload.id, upload.data]] : []);
  const imageUrls = upload ? { [upload.id]: upload.url } : {};

  return (
    <ItemEditor
      suffix="edited"
      mode={mode}
      allowPageRotation
      hint={HINTS[tool]}
      blockedReason={blockedReason}
      images={images}
      imageUrls={imageUrls}
      createFromExistingText={(span) => ({
        id: uid(),
        page: span.page,
        kind: "replace-text",
        x: span.x,
        y: span.y,
        w: span.w,
        h: span.h,
        text: span.text,
        originalText: span.text,
        size: Math.max(4, Math.min(200, span.size)),
        color: span.color,
        background: span.background,
        bold: span.bold,
        italic: span.italic,
        underline: false,
        align: "left",
        fontFamily: span.fontFamily,
      })}
      createItem={(g, geom) => {
        const base = { id: uid(), page: g.page };
        if (tool === "text" && g.kind === "point")
          return {
            ...base,
            kind: "text",
            x: g.x,
            y: g.y - textSize * 0.6,
            w: 180,
            text,
            size: textSize,
            color,
            bold,
            italic,
            underline,
            align,
            fontFamily,
          } as TextItem;
        if (tool === "check" && g.kind === "point")
          return {
            ...base,
            kind: "text",
            x: g.x,
            y: g.y - textSize,
            w: textSize * 1.4,
            text: "✓",
            size: Math.max(16, textSize),
            color,
            bold: true,
            fontFamily: "sans",
            align: "left",
          } as TextItem;
        if (needsImage && g.kind === "point" && upload) {
          const page = viewSize(geom);
          const w = Math.min(imageWidth, page.w * 0.85);
          const h = (w * upload.data.height) / upload.data.width;
          return {
            ...base,
            kind: "image",
            x: g.x - w / 2,
            y: g.y - h / 2,
            w,
            h,
            imageId: upload.id,
            label: tool === "signature" ? "Signature" : upload.name,
          } as ImageItem;
        }
        if (tool === "pen" && g.kind === "path")
          return {
            ...base,
            kind: "path",
            points: g.points,
            color,
            strokeWidth,
            opacity: 1,
          } as PathItem;
        if (tool === "arrow" && g.kind === "line")
          return {
            ...base,
            kind: "arrow",
            x1: g.x1,
            y1: g.y1,
            x2: g.x2,
            y2: g.y2,
            color,
            strokeWidth,
          } as ArrowItem;
        if (tool === "link" && g.kind === "rect")
          return {
            ...base,
            kind: "link",
            x: g.x,
            y: g.y,
            w: Math.max(8, g.w),
            h: Math.max(8, g.h),
            target: { type: "url", url: linkUrl },
            border: false,
          } as LinkItem;
        if (
          ["highlight", "strike", "box", "ellipse", "whiteout"].includes(
            tool,
          ) &&
          g.kind === "rect"
        )
          return {
            ...base,
            kind: "rect",
            x: g.x,
            y: g.y,
            w: Math.max(3, g.w),
            h: Math.max(3, g.h),
            style: tool as RectItem["style"],
            color: tool === "whiteout" ? fillColor : color,
            opacity: tool === "highlight" ? opacity : 1,
            strokeWidth,
          } as RectItem;
        return null;
      }}
      settings={
        <section aria-label="PDF editor controls" className="space-y-4">
          <div>
            <p className="mb-2 text-[0.8125rem] font-semibold text-ink">
              Editing tools
            </p>
            <div
              className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3"
              role="toolbar"
              aria-label="PDF editing tools"
            >
              {TOOLS.map((o) => (
                <ToolButton
                  key={o.value}
                  {...o}
                  active={tool === o.value}
                  onClick={() => setTool(o.value)}
                />
              ))}
            </div>
          </div>
          {tool === "text" && (
            <div className="space-y-3 rounded-xl bg-sunken p-3">
              <TextArea
                label="Text"
                hint="New lines are preserved."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Font"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as FontFamily)}
                  options={FONT_OPTIONS}
                />
                <NumInput
                  key={textSize}
                  label="Size"
                  suffix="pt"
                  value={textSize}
                  min={4}
                  max={200}
                  onCommit={setTextSize}
                />
              </div>
              <ColorInput
                label="Text color"
                value={color}
                onChange={setColor}
              />
              <div className="grid grid-cols-2 gap-3">
                <StyleToggles
                  bold={bold}
                  italic={italic}
                  underline={underline}
                  onBold={setBold}
                  onItalic={setItalic}
                  onUnderline={setUnderline}
                />
                <AlignButtons value={align} onChange={setAlign} />
              </div>
            </div>
          )}
          {needsImage && (
            <div className="space-y-3 rounded-xl bg-sunken p-3">
              <FileDrop
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                maxFiles={1}
                maxSizeMB={25}
                compact
                label={
                  tool === "signature"
                    ? "Upload signature image"
                    : "Upload image"
                }
                allowPaste
                onFiles={addImage}
              />
              {uploadError && <Notice tone="error">{uploadError}</Notice>}
              {upload && (
                <div className="rounded-lg bg-white p-2 shadow-[inset_0_0_0_1px_var(--line)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img
                    src={upload.url}
                    alt={upload.name}
                    className="mx-auto max-h-24 max-w-full object-contain"
                  />
                </div>
              )}
              <RangeInput
                label="Width when placed"
                min={30}
                max={500}
                step={5}
                value={imageWidth}
                onChange={setImageWidth}
                format={(v) => `${v} pt`}
              />
            </div>
          )}
          {tool === "link" && (
            <TextField
              label="Link address"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              inputMode="url"
            />
          )}
          {tool === "whiteout" && (
            <>
              <ColorInput
                label="Cover color"
                value={fillColor}
                onChange={setFillColor}
              />
              <Notice tone="warning">
                Whiteout only covers content visually. Use the Redact PDF tool
                when sensitive data must be removed.
              </Notice>
            </>
          )}
          {[
            "pen",
            "highlight",
            "strike",
            "box",
            "ellipse",
            "arrow",
            "check",
          ].includes(tool) && (
            <div className="space-y-3">
              <ColorInput
                label={tool === "highlight" ? "Highlight color" : "Color"}
                value={color}
                onChange={setColor}
              />
              {!(["highlight", "check"] as EditorTool[]).includes(tool) && (
                <RangeInput
                  label="Line width"
                  min={0.5}
                  max={12}
                  step={0.5}
                  value={strokeWidth}
                  onChange={setStrokeWidth}
                  format={(v) => `${v} pt`}
                />
              )}
              {tool === "highlight" && (
                <RangeInput
                  label="Opacity"
                  min={0.1}
                  max={0.8}
                  step={0.05}
                  value={opacity}
                  onChange={setOpacity}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              )}
            </div>
          )}
        </section>
      }
      inspector={(item: Item, onChange, { numPages }) => {
        if (item.kind === "replace-text" || item.kind === "text")
          return (
            <div className="space-y-3">
              <TextArea
                label={
                  item.kind === "replace-text" ? "Replacement text" : "Text"
                }
                hint={
                  item.kind === "replace-text"
                    ? `Original: ${item.originalText}. Position, size, color and the closest font style were detected. Embedded PDF fonts cannot always be reused, so check the preview and adjust if needed.`
                    : "Resize the box on the page to control alignment width."
                }
                value={item.text}
                onChange={(e) => onChange({ ...item, text: e.target.value })}
                rows={3}
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Font"
                  value={item.fontFamily ?? "sans"}
                  onChange={(e) =>
                    onChange({
                      ...item,
                      fontFamily: e.target.value as FontFamily,
                    })
                  }
                  options={FONT_OPTIONS}
                />
                <NumInput
                  key={`${item.id}-${item.size}`}
                  label="Size"
                  suffix="pt"
                  value={item.size}
                  min={4}
                  max={200}
                  onCommit={(v) => onChange({ ...item, size: v })}
                />
              </div>
              <ColorInput
                label="Text color"
                value={item.color}
                onChange={(v) => onChange({ ...item, color: v })}
              />
              {item.kind === "replace-text" && (
                <ColorInput
                  label="Background behind original"
                  value={item.background}
                  onChange={(v) => onChange({ ...item, background: v })}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <StyleToggles
                  bold={item.bold}
                  italic={!!item.italic}
                  underline={!!item.underline}
                  onBold={(v) => onChange({ ...item, bold: v })}
                  onItalic={(v) => onChange({ ...item, italic: v })}
                  onUnderline={(v) => onChange({ ...item, underline: v })}
                />
                <AlignButtons
                  value={item.align ?? "left"}
                  onChange={(v) => onChange({ ...item, align: v })}
                />
              </div>
            </div>
          );
        if (item.kind === "image")
          return (
            <div className="grid grid-cols-2 gap-3">
              <NumInput
                key={`iw${item.id}${item.w}`}
                label="Width"
                suffix="pt"
                value={item.w}
                min={8}
                max={5000}
                onCommit={(v) =>
                  onChange({ ...item, w: v, h: (v * item.h) / item.w })
                }
              />
              <NumInput
                key={`ih${item.id}${item.h}`}
                label="Height"
                suffix="pt"
                value={item.h}
                min={8}
                max={5000}
                onCommit={(v) =>
                  onChange({ ...item, h: v, w: (v * item.w) / item.h })
                }
              />
            </div>
          );
        if (item.kind === "link")
          return (
            <div className="space-y-3">
              <TextField
                label="Address"
                value={item.target.type === "url" ? item.target.url : ""}
                onChange={(e) =>
                  onChange({
                    ...item,
                    target: { type: "url", url: e.target.value },
                  })
                }
              />
              <Checkbox
                label="Visible border"
                checked={item.border}
                onChange={(v) => onChange({ ...item, border: v })}
              />
              <NumInput
                key={`lp${item.id}`}
                label="Internal page (0 for URL)"
                value={item.target.type === "page" ? item.target.page : 0}
                min={0}
                max={numPages}
                onCommit={(v) =>
                  onChange(
                    v > 0
                      ? {
                          ...item,
                          target: { type: "page", page: Math.round(v) },
                        }
                      : { ...item, target: { type: "url", url: linkUrl } },
                  )
                }
              />
            </div>
          );
        if (item.kind === "path" || item.kind === "arrow")
          return (
            <div className="space-y-3">
              <ColorInput
                label="Color"
                value={item.color}
                onChange={(v) => onChange({ ...item, color: v })}
              />
              <RangeInput
                label="Line width"
                min={0.5}
                max={12}
                step={0.5}
                value={item.strokeWidth}
                onChange={(v) => onChange({ ...item, strokeWidth: v })}
                format={(v) => `${v} pt`}
              />
            </div>
          );
        if (item.kind === "rect")
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <NumInput
                  key={`rw${item.id}${item.w}`}
                  label="Width"
                  suffix="pt"
                  value={item.w}
                  min={2}
                  max={5000}
                  onCommit={(v) => onChange({ ...item, w: v })}
                />
                <NumInput
                  key={`rh${item.id}${item.h}`}
                  label="Height"
                  suffix="pt"
                  value={item.h}
                  min={2}
                  max={5000}
                  onCommit={(v) => onChange({ ...item, h: v })}
                />
              </div>
              <ColorInput
                label={item.style === "whiteout" ? "Cover color" : "Color"}
                value={item.color}
                onChange={(v) => onChange({ ...item, color: v })}
              />
              {item.style === "highlight" ? (
                <RangeInput
                  label="Opacity"
                  min={0.1}
                  max={0.8}
                  step={0.05}
                  value={item.opacity}
                  onChange={(v) => onChange({ ...item, opacity: v })}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              ) : (
                item.style !== "whiteout" && (
                  <RangeInput
                    label="Line width"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={item.strokeWidth}
                    onChange={(v) => onChange({ ...item, strokeWidth: v })}
                    format={(v) => `${v} pt`}
                  />
                )
              )}
            </div>
          );
        return null;
      }}
      validate={(items) =>
        items.some(
          (i) =>
            (i.kind === "text" || i.kind === "replace-text") && !i.text.trim(),
        )
          ? "A text item is empty. Type something or remove it."
          : items.some(
                (i) =>
                  i.kind === "link" &&
                  i.target.type === "url" &&
                  !/^(https?:\/\/|mailto:|tel:)/i.test(i.target.url),
              )
            ? "A link needs a complete http(s), mailto, or tel address."
            : null
      }
      doneMessage={(count) =>
        `Saved ${count} edit${count === 1 ? "" : "s"} into the PDF.`
      }
    />
  );
}
