"use client";

/**
 * Item editor shell used by add-text, add-image, sign, add-links and annotate.
 * Holds the PDF, the placed items (with undo), selection, the inspector and
 * the export step. Tools supply how new items are created and edited.
 */

import { useCallback, useMemo, useState } from "react";
import { Btn, Notice, PrivacyNote, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { embedUnicodeFonts, getPdfLib } from "@/components/tools/engines/pdf";
import {
  PageCanvas,
  type CanvasMode,
  type CreateGeom,
  type ExistingTextSpan,
  type OverlayItem,
} from "./PageCanvas";
import { normRotation, type PageGeom, type Rect } from "./lib/geometry";
import {
  LINE_HEIGHT,
  NOTE_PAD,
  applyItems,
  loadForEdit,
  noteLayout,
  wrapLines,
  type Item,
  type StoredImage,
} from "./lib/write";
import {
  DocStatus,
  NumInput,
  OVERLAY_FONT,
  PdfPicker,
  ResultBar,
  measureText,
  outName,
  useHistory,
  useOverlayFont,
  usePdfDoc,
  type PdfSource,
} from "./shared";

/* ------------------------------------------------------------------ */
/* Item geometry and visuals                                           */
/* ------------------------------------------------------------------ */

export function itemBox(it: Item): Rect {
  switch (it.kind) {
    case "text": {
      const lines = it.text.split("\n");
      const measured = Math.max(
        ...lines.map((l) =>
          measureText(l || " ", it.size, it.bold, it.fontFamily, it.italic),
        ),
        it.size * 0.5,
      );
      const w = it.w ?? measured;
      return { x: it.x, y: it.y, w, h: lines.length * it.size * LINE_HEIGHT };
    }
    case "note": {
      const { h } = noteLayout(it, (s) => measureText(s, it.size));
      return { x: it.x, y: it.y, w: it.w, h };
    }
    case "arrow": {
      const pad = 6 + it.strokeWidth * 2;
      const x = Math.min(it.x1, it.x2) - pad;
      const y = Math.min(it.y1, it.y2) - pad;
      return {
        x,
        y,
        w: Math.abs(it.x2 - it.x1) + pad * 2,
        h: Math.abs(it.y2 - it.y1) + pad * 2,
      };
    }
    case "path": {
      const pad = 4 + it.strokeWidth;
      const xs = it.points.map((point) => point.x);
      const ys = it.points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        x: minX - pad,
        y: minY - pad,
        w: Math.max(1, maxX - minX) + pad * 2,
        h: Math.max(1, maxY - minY) + pad * 2,
      };
    }
    default:
      return { x: it.x, y: it.y, w: it.w, h: it.h };
  }
}

export function itemLabel(it: Item): string {
  const short = (s: string) => (s.length > 32 ? `${s.slice(0, 32)}…` : s);
  switch (it.kind) {
    case "text":
      return `Text "${short(it.text.replace(/\n/g, " ")) || "empty"}" on page ${it.page}`;
    case "replace-text":
      return `Replacement for "${short(it.originalText)}" on page ${it.page}`;
    case "image":
      return `${it.label} on page ${it.page}`;
    case "rect":
      return `${it.style === "highlight" ? "Highlight" : it.style === "whiteout" ? "Whiteout" : it.style === "ellipse" ? "Ellipse" : it.style === "strike" ? "Strikethrough" : "Rectangle"} on page ${it.page}`;
    case "arrow":
      return `Arrow on page ${it.page}`;
    case "path":
      return `Pen stroke on page ${it.page}`;
    case "note":
      return `Comment "${short(it.text.replace(/\n/g, " "))}" on page ${it.page}`;
    case "link":
      return `Link to ${it.target.type === "url" ? it.target.url || "(no address yet)" : `page ${it.target.page}`} on page ${it.page}`;
  }
}

export function moveItem(it: Item, dx: number, dy: number): Item {
  if (it.kind === "arrow")
    return {
      ...it,
      x1: it.x1 + dx,
      y1: it.y1 + dy,
      x2: it.x2 + dx,
      y2: it.y2 + dy,
    };
  if (it.kind === "path")
    return {
      ...it,
      points: it.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    };
  return { ...it, x: it.x + dx, y: it.y + dy };
}

function resizeItem(it: Item, dw: number, dh: number): Item {
  switch (it.kind) {
    case "image": {
      const w = Math.max(8, it.w + dw);
      return { ...it, w, h: (w * it.h) / it.w };
    }
    case "rect":
    case "link":
      return { ...it, w: Math.max(4, it.w + dw), h: Math.max(4, it.h + dh) };
    case "text":
      return { ...it, w: Math.max(20, (it.w ?? itemBox(it).w) + dw) };
    case "replace-text":
      return { ...it, w: Math.max(8, it.w + dw), h: Math.max(4, it.h + dh) };
    case "note":
      return { ...it, w: Math.max(40, it.w + dw) };
    case "path": {
      const box = itemBox(it);
      const nextW = Math.max(12, box.w + dw);
      const nextH = Math.max(12, box.h + dh);
      const sx = nextW / box.w;
      const sy = nextH / box.h;
      return {
        ...it,
        points: it.points.map((point) => ({
          x: box.x + (point.x - box.x) * sx,
          y: box.y + (point.y - box.y) * sy,
        })),
      };
    }
    default:
      return it;
  }
}

function ItemVisual({
  it,
  scale,
  imageUrls,
}: {
  it: Item;
  scale: number;
  imageUrls: Record<string, string>;
}) {
  switch (it.kind) {
    case "text":
      return (
        <span
          className="pointer-events-none block h-full w-full whitespace-pre"
          style={{
            fontFamily:
              it.fontFamily === "serif"
                ? "Georgia, serif"
                : it.fontFamily === "mono"
                  ? "ui-monospace, monospace"
                  : `${OVERLAY_FONT}, sans-serif`,
            fontWeight: it.bold ? 700 : 400,
            fontStyle: it.italic ? "italic" : "normal",
            textDecoration: it.underline ? "underline" : "none",
            textAlign: it.align ?? "left",
            fontSize: it.size * scale,
            lineHeight: LINE_HEIGHT,
            color: it.color,
          }}
        >
          {it.text || " "}
        </span>
      );
    case "replace-text":
      return (
        <span
          className="pointer-events-none relative block h-full w-full overflow-visible"
          style={{ background: it.background }}
        >
          <span
            className="absolute left-px top-0 whitespace-pre"
            style={{
              fontFamily:
                it.fontFamily === "serif"
                  ? "Georgia, serif"
                  : it.fontFamily === "mono"
                    ? "ui-monospace, monospace"
                    : `${OVERLAY_FONT}, sans-serif`,
              fontWeight: it.bold ? 700 : 400,
              fontStyle: it.italic ? "italic" : "normal",
              textDecoration: it.underline ? "underline" : "none",
              textAlign: it.align ?? "left",
              fontSize: it.size * scale,
              lineHeight: LINE_HEIGHT,
              color: it.color,
              width: "100%",
            }}
          >
            {it.text || " "}
          </span>
        </span>
      );
    case "image":
      return imageUrls[it.imageId] ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img
          src={imageUrls[it.imageId]}
          alt=""
          className="pointer-events-none h-full w-full select-none"
          draggable={false}
        />
      ) : null;
    case "rect":
      return it.style === "highlight" ? (
        <span
          className="pointer-events-none block h-full w-full"
          style={{
            background: it.color,
            opacity: it.opacity,
            mixBlendMode: "multiply",
          }}
        />
      ) : it.style === "whiteout" ? (
        <span
          className="pointer-events-none block h-full w-full"
          style={{ background: it.color }}
        />
      ) : it.style === "strike" ? (
        <span
          className="pointer-events-none absolute left-0 top-1/2 block w-full"
          style={{
            borderTop: `${Math.max(1, it.strokeWidth * scale)}px solid ${it.color}`,
            opacity: it.opacity,
          }}
        />
      ) : it.style === "ellipse" ? (
        <span
          className="pointer-events-none block h-full w-full rounded-[50%]"
          style={{
            background: it.fillColor ?? "transparent",
            boxShadow: `inset 0 0 0 ${Math.max(1, it.strokeWidth * scale)}px ${it.color}`,
            opacity: it.opacity,
          }}
        />
      ) : (
        <span
          className="pointer-events-none block h-full w-full"
          style={{
            background: it.fillColor ?? "transparent",
            boxShadow: `inset 0 0 0 ${Math.max(1, it.strokeWidth * scale)}px ${it.color}`,
            opacity: it.opacity,
          }}
        />
      );
    case "arrow": {
      const b = itemBox(it);
      const x1 = (it.x1 - b.x) * scale;
      const y1 = (it.y1 - b.y) * scale;
      const x2 = (it.x2 - b.x) * scale;
      const y2 = (it.y2 - b.y) * scale;
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const hs = Math.max(8, it.strokeWidth * 4) * scale;
      const sp = Math.PI / 7;
      const p1 = `${x2 - hs * Math.cos(ang - sp)},${y2 - hs * Math.sin(ang - sp)}`;
      const p2 = `${x2 - hs * Math.cos(ang + sp)},${y2 - hs * Math.sin(ang + sp)}`;
      return (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <g
            stroke={it.color}
            strokeWidth={Math.max(1, it.strokeWidth * scale)}
            strokeLinecap="round"
            fill="none"
          >
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            <polyline points={`${p1} ${x2},${y2} ${p2}`} />
          </g>
        </svg>
      );
    }
    case "path": {
      const box = itemBox(it);
      const points = it.points
        .map(
          (point) =>
            `${(point.x - box.x) * scale},${(point.y - box.y) * scale}`,
        )
        .join(" ");
      return (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <polyline
            points={points}
            fill="none"
            stroke={it.color}
            strokeOpacity={it.opacity}
            strokeWidth={Math.max(1, it.strokeWidth * scale)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    case "note": {
      const lines = wrapLines(it.text, Math.max(20, it.w - NOTE_PAD * 2), (s) =>
        measureText(s, it.size),
      );
      return (
        <span
          className="pointer-events-none block h-full w-full"
          style={{
            background: "#fff6c2",
            boxShadow: "inset 0 0 0 0.75px #b08d00",
            padding: NOTE_PAD * scale,
            fontFamily: `${OVERLAY_FONT}, sans-serif`,
            fontSize: it.size * scale,
            lineHeight: LINE_HEIGHT,
            color: it.color,
            whiteSpace: "pre",
          }}
        >
          {lines.join("\n")}
        </span>
      );
    }
    case "link":
      return (
        <span
          className="pointer-events-none flex h-full w-full items-start overflow-hidden"
          style={{
            background: "rgb(37 99 235 / 0.12)",
            boxShadow: "inset 0 0 0 1.5px rgb(37 99 235)",
          }}
        >
          <span className="truncate bg-[rgb(37_99_235)] px-1 text-[11px] leading-4 text-white">
            {it.target.type === "url"
              ? it.target.url || "No address"
              : `Page ${it.target.page}`}
          </span>
        </span>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export interface EditorProps {
  suffix: string;
  mode: CanvasMode;
  addLabel?: string;
  /** Hint under the canvas toolbar describing what a click does. */
  hint: string;
  createItem: (
    g: CreateGeom,
    geom: PageGeom,
    source: PdfSource,
  ) => Item | Item[] | null;
  createFromExistingText?: (span: ExistingTextSpan) => Item | null;
  inspector?: (
    it: Item,
    onChange: (next: Item) => void,
    ctx: { numPages: number },
  ) => React.ReactNode;
  /** Final transformation of items before writing (e.g. URL normalisation). */
  prepare?: (items: Item[]) => Item[];
  /** Tool settings shown above the item inspector. */
  settings?: React.ReactNode;
  /** Blocks placing items until settings are ready (e.g. no image chosen yet). */
  blockedReason?: string | null;
  images?: Map<string, StoredImage>;
  imageUrls?: Record<string, string>;
  validate?: (items: Item[]) => string | null;
  doneMessage: (count: number) => string;
  /** Called when a new PDF is chosen or removed (tools can reset their own state). */
  onSourceChange?: (s: PdfSource | null) => void;
  /** Enables clockwise page rotation. Pages with placed items must be cleared before rotating. */
  allowPageRotation?: boolean;
}

export function ItemEditor(props: EditorProps) {
  const {
    suffix,
    mode,
    addLabel,
    hint,
    createItem,
    createFromExistingText,
    inspector,
    settings,
    blockedReason,
    images,
    imageUrls = {},
    validate,
    prepare,
    doneMessage,
    onSourceChange,
    allowPageRotation = false,
  } = props;
  const [source, setSource] = useState<PdfSource | null>(null);
  const [page, setPage] = useState(1);
  const history = useHistory<Item[]>([]);
  const items = history.value;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>(
    {},
  );
  const [result, setResult] = useState<{
    bytes: Uint8Array;
    changeCount: number;
  } | null>(null);
  const fontReady = useOverlayFont();
  const { doc, error: docError, loading } = usePdfDoc(source?.bytes ?? null);

  const changeSource = useCallback(
    (s: PdfSource | null) => {
      setSource(s);
      setPage(1);
      history.reset([]);
      setSelectedId(null);
      setPageRotations({});
      setResult(null);
      setError(null);
      onSourceChange?.(s);
    },
    [history, onSourceChange],
  );

  const overlayItems: OverlayItem[] = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        page: it.page,
        box: itemBox(it),
        label: itemLabel(it),
        resizable:
          it.kind === "image" ||
          it.kind === "rect" ||
          it.kind === "link" ||
          it.kind === "note" ||
          it.kind === "path" ||
          it.kind === "text" ||
          it.kind === "replace-text",
        movable: it.kind !== "replace-text",
      })),
    // fontReady changes text measurements once the overlay font loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, fontReady],
  );

  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  const update = (next: Item) => {
    setResult(null);
    history.set((list) => list.map((it) => (it.id === next.id ? next : it)));
  };
  const remove = (id: string) => {
    setResult(null);
    history.set((list) => list.filter((it) => it.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const onCreate = (g: CreateGeom, geom: PageGeom) => {
    if (!source || blockedReason) return;
    const made = createItem(g, geom, source);
    if (!made) return;
    setResult(null);
    const list = Array.isArray(made) ? made : [made];
    history.set((cur) => [...cur, ...list]);
    setSelectedId(list[0].id);
  };

  const onExistingText = (span: ExistingTextSpan) => {
    if (!createFromExistingText) return;
    const made = createFromExistingText(span);
    if (!made) return;
    setResult(null);
    history.set((current) => [...current, made]);
    setSelectedId(made.id);
  };

  const validation = validate ? validate(items) : null;
  const hasChanges = items.length > 0 || Object.keys(pageRotations).length > 0;

  const undo = () => {
    setResult(null);
    history.undo();
  };
  const redo = () => {
    setResult(null);
    history.redo();
  };

  async function exportPdf() {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const L = await getPdfLib();
      const pdf = await loadForEdit(L, source.bytes);
      for (const [pageNumber, offset] of Object.entries(pageRotations)) {
        const target = pdf.getPages()[Number(pageNumber) - 1];
        if (target)
          target.setRotation(
            L.degrees(normRotation(target.getRotation().angle + offset)),
          );
      }
      const needsFont = items.some(
        (it) =>
          it.kind === "text" ||
          it.kind === "replace-text" ||
          it.kind === "note",
      );
      const fonts = needsFont
        ? {
            ...(await embedUnicodeFonts(pdf)),
            sansItalic: await pdf.embedFont(L.StandardFonts.HelveticaOblique),
            sansBoldItalic: await pdf.embedFont(
              L.StandardFonts.HelveticaBoldOblique,
            ),
            serif: await pdf.embedFont(L.StandardFonts.TimesRoman),
            serifBold: await pdf.embedFont(L.StandardFonts.TimesRomanBold),
            serifItalic: await pdf.embedFont(L.StandardFonts.TimesRomanItalic),
            serifBoldItalic: await pdf.embedFont(
              L.StandardFonts.TimesRomanBoldItalic,
            ),
            mono: await pdf.embedFont(L.StandardFonts.Courier),
            monoBold: await pdf.embedFont(L.StandardFonts.CourierBold),
            monoItalic: await pdf.embedFont(L.StandardFonts.CourierOblique),
            monoBoldItalic: await pdf.embedFont(
              L.StandardFonts.CourierBoldOblique,
            ),
          }
        : {
            regular: await pdf.embedFont(L.StandardFonts.Helvetica),
            bold: await pdf.embedFont(L.StandardFonts.HelveticaBold),
          };
      await applyItems(L, pdf, prepare ? prepare(items) : items, fonts, images);
      const bytes = await pdf.save();
      setSource((current) => (current ? { ...current, bytes } : current));
      history.reset([]);
      setSelectedId(null);
      setPageRotations({});
      setResult({ bytes, changeCount: items.length });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong while saving the PDF.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolPanel title={source ? undefined : "Choose a PDF"}>
      <div className="space-y-5">
        <PdfPicker source={source} onChange={changeSource} />
        <DocStatus loading={loading} error={docError} />
        {doc && source && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-3">
              <p className="text-sm text-ink-2">{blockedReason ?? hint}</p>
              <PageCanvas
                doc={doc}
                page={page}
                onPageChange={setPage}
                mode={blockedReason ? "none" : mode}
                onCreate={onCreate}
                items={overlayItems}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(id, dx, dy) => {
                  const it = byId.get(id);
                  if (it) update(moveItem(it, dx, dy));
                }}
                onResize={(id, dw, dh) => {
                  const it = byId.get(id);
                  if (it) update(resizeItem(it, dw, dh));
                }}
                onDelete={remove}
                onExistingText={onExistingText}
                renderItem={(id, scale) => {
                  const it = byId.get(id);
                  return it ? (
                    <ItemVisual it={it} scale={scale} imageUrls={imageUrls} />
                  ) : null;
                }}
                onUndo={undo}
                canUndo={history.canUndo}
                onRedo={redo}
                canRedo={history.canRedo}
                addLabel={blockedReason ? undefined : addLabel}
                rotationOffset={pageRotations[page] ?? 0}
                onRotate={
                  allowPageRotation
                    ? () => {
                        setPageRotations((rotations) => ({
                          ...rotations,
                          [page]: normRotation((rotations[page] ?? 0) + 90),
                        }));
                        setResult(null);
                      }
                    : undefined
                }
                rotateDisabled={items.some((item) => item.page === page)}
              />
            </div>
            <div className="space-y-5">
              {settings}
              {selected && (
                <section
                  aria-label="Selected item"
                  className="space-y-3 rounded-xl bg-sunken p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink">
                      Selected item
                    </h3>
                    <Btn
                      variant="danger"
                      icon="trash"
                      onClick={() => remove(selected.id)}
                    >
                      Remove
                    </Btn>
                  </div>
                  {selected.kind !== "arrow" &&
                    selected.kind !== "path" &&
                    selected.kind !== "replace-text" && (
                      <div className="grid grid-cols-2 gap-3">
                        <NumInput
                          key={`x${selected.id}${selected.x}`}
                          label="X"
                          suffix="pt"
                          value={selected.x}
                          onCommit={(v) => update({ ...selected, x: v })}
                        />
                        <NumInput
                          key={`y${selected.id}${selected.y}`}
                          label="Y"
                          suffix="pt"
                          value={selected.y}
                          onCommit={(v) => update({ ...selected, y: v })}
                        />
                      </div>
                    )}
                  {inspector?.(selected, update, { numPages: doc.numPages })}
                </section>
              )}
              <section aria-label="Placed items" className="space-y-2">
                <h3 className="text-sm font-semibold text-ink">
                  Placed items ({items.length})
                </h3>
                {items.length === 0 ? (
                  <p className="text-sm text-muted">Nothing placed yet.</p>
                ) : (
                  <ul className="max-h-56 space-y-1 overflow-auto">
                    {items.map((it) => (
                      <li key={it.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPage(it.page);
                            setSelectedId(it.id);
                          }}
                          className={`min-h-10 min-w-0 flex-1 truncate rounded-md px-2 text-left text-sm hover:bg-sunken ${it.id === selectedId ? "bg-accent-soft text-ink" : "text-ink-2"}`}
                        >
                          {itemLabel(it)}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(it.id)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted hover:bg-sunken hover:text-danger"
                          aria-label={`Remove ${itemLabel(it)}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {validation && <Notice tone="warning">{validation}</Notice>}
              <Btn
                icon="download"
                onClick={exportPdf}
                disabled={busy || !hasChanges || !!validation}
                className="w-full justify-center"
              >
                {busy ? "Updating…" : "Update PDF"}
              </Btn>
              {busy && <Spinner label="Writing PDF" />}
              {error && <Notice tone="error">{error}</Notice>}
              {result && (
                <ResultBar
                  bytes={result.bytes}
                  name={outName(source, suffix)}
                  message={`${doneMessage(result.changeCount)} The preview now shows the updated PDF.`}
                  downloadLabel="Download PDF"
                />
              )}
            </div>
          </div>
        )}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}
