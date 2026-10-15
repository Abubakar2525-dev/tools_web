"use client";

/**
 * Accessible page-thumbnail grid shared by the pdf-a tools.
 * - Thumbnails render lazily (IntersectionObserver) through a small queue so
 *   large documents fill in progressively without blocking the page.
 * - Selection is a toggle button per page (aria-pressed), not color alone.
 * - Reordering uses Move earlier / Move later buttons; focus follows the page.
 */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { renderPage } from "@/components/tools/engines/pdf";
import type { PdfJsDoc } from "./shared";

/* ------------------------------------------------------------------ */
/* Thumbnail cache + render queue                                      */
/* ------------------------------------------------------------------ */

const cache = new WeakMap<object, Map<string, Promise<string>>>();
let active = 0;
const waiting: (() => void)[] = [];
const MAX_ACTIVE = 2;

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_ACTIVE) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/** JPEG data URL of a page whose longer side is `size` CSS pixels (cached per document). */
export function thumbnailUrl(doc: PdfJsDoc, page: number, size = 220): Promise<string> {
  let m = cache.get(doc);
  if (!m) {
    m = new Map();
    cache.set(doc, m);
  }
  const k = `${page}@${size}`;
  let p = m.get(k);
  if (!p) {
    p = withSlot(async () => {
      const pg = await doc.getPage(page);
      const vp = pg.getViewport({ scale: 1 });
      const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
      const scale = (size * dpr) / Math.max(vp.width, vp.height);
      const canvas = await renderPage(doc, page, scale);
      const url = canvas.toDataURL("image/jpeg", 0.82);
      canvas.width = canvas.height = 0;
      return url;
    });
    p.catch(() => m?.delete(k));
    m.set(k, p);
  }
  return p;
}

export function PageThumb({
  doc,
  page,
  rotation = 0,
  dim = false,
  size = 220,
}: {
  doc: PdfJsDoc;
  page: number;
  /** Extra clockwise rotation to preview (degrees). */
  rotation?: number;
  dim?: boolean;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const k = `${page}@${size}`;
  const [res, setRes] = useState<{ k: string; doc: PdfJsDoc; src: string | null; failed: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const start = () =>
      thumbnailUrl(doc, page, size).then(
        (src) => alive && setRes({ k, doc, src, failed: false }),
        () => alive && setRes({ k, doc, src: null, failed: true }),
      );
    if (typeof IntersectionObserver === "undefined") {
      void start();
      return () => {
        alive = false;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void start();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [doc, page, size, k]);

  const cur = res && res.k === k && res.doc === doc ? res : null;
  return (
    <div ref={ref} className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-sunken">
      {cur?.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL rendered locally
        <img
          src={cur.src}
          alt=""
          draggable={false}
          className={`max-h-full max-w-full object-contain shadow-sm transition-transform duration-200 motion-reduce:transition-none ${dim ? "opacity-35" : ""}`}
          style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
        />
      ) : cur?.failed ? (
        <span className="px-2 text-center text-xs text-muted">Preview unavailable</span>
      ) : (
        <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-accent motion-reduce:animate-none" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grid                                                                */
/* ------------------------------------------------------------------ */

export type GridItem = {
  /** Stable id (survives reordering). */
  id: string;
  /** 1-based page number in the source document. */
  page: number;
  /** Extra clockwise rotation to preview. */
  rotation?: number;
  /** Optional short caption under the page label (e.g. "copy"). */
  note?: string;
};

export function PageGrid({
  doc,
  items,
  label,
  selected,
  onToggle,
  selectVerb = "Select",
  selectStyle = "keep",
  onMove,
  actions,
  showPosition = false,
}: {
  doc: PdfJsDoc;
  items: readonly GridItem[];
  /** Accessible name for the list, e.g. "Pages". */
  label: string;
  selected?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
  /** Verb used in the toggle label, e.g. "Select" or "Mark for deletion". */
  selectVerb?: string;
  /** "remove" dims selected pages and shows a trash badge. */
  selectStyle?: "keep" | "remove";
  onMove?: (index: number, delta: number) => void;
  actions?: (item: GridItem, index: number) => React.ReactNode;
  showPosition?: boolean;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const [announce, setAnnounce] = useState("");

  const move = (index: number, delta: number, item: GridItem, dir: "prev" | "next") => {
    const to = index + delta;
    if (!onMove || to < 0 || to >= items.length) return;
    onMove(index, delta);
    setAnnounce(`Page ${item.page} moved to position ${to + 1} of ${items.length}.`);
    requestAnimationFrame(() => {
      const root = listRef.current;
      if (!root) return;
      const target =
        root.querySelector<HTMLButtonElement>(`[data-move="${item.id}-${dir}"]:not(:disabled)`) ??
        root.querySelector<HTMLButtonElement>(`[data-move^="${item.id}-"]:not(:disabled)`);
      target?.focus();
    });
  };

  return (
    <div>
      <ol ref={listRef} aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((it, i) => {
          const isSel = selected?.has(it.id) ?? false;
          const removing = selectStyle === "remove" && isSel;
          const caption = `Page ${it.page}${it.note ? ` (${it.note})` : ""}`;
          const thumb = <PageThumb doc={doc} page={it.page} rotation={it.rotation} dim={removing} />;
          return (
            <li
              key={it.id}
              className={`flex flex-col gap-2 rounded-xl p-2 transition-shadow duration-150 ${
                isSel ? (removing ? "shadow-[0_0_0_2px_var(--danger)]" : "shadow-[0_0_0_2px_var(--accent)]") : "shadow-[0_0_0_1px_var(--line)]"
              }`}
            >
              {onToggle ? (
                <button
                  type="button"
                  aria-pressed={isSel}
                  aria-label={`${selectVerb} ${caption.toLowerCase()}`}
                  onClick={() => onToggle(it.id)}
                  className="relative block w-full cursor-pointer rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {thumb}
                  {isSel && (
                    <span
                      className={`absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                        removing ? "bg-danger" : "bg-accent-strong"
                      }`}
                    >
                      <Icon name={removing ? "trash" : "check"} size={12} />
                      {removing ? "Remove" : "Selected"}
                    </span>
                  )}
                </button>
              ) : (
                <div className="relative">
                  {thumb}
                  <span className="sr-only">{caption}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-1 px-0.5">
                <span className="truncate text-[0.8125rem] text-ink-2 tabular-nums" aria-hidden={onToggle ? true : undefined}>
                  {showPosition ? (
                    <>
                      <span className="font-medium text-ink">{i + 1}.</span> {caption}
                    </>
                  ) : (
                    caption
                  )}
                </span>
              </div>
              {(onMove || actions) && (
                <div className="flex flex-wrap items-center gap-1">
                  {onMove && (
                    <>
                      <button
                        type="button"
                        data-move={`${it.id}-prev`}
                        disabled={i === 0}
                        onClick={() => move(i, -1, it, "prev")}
                        className="grid h-10 w-10 place-items-center rounded-lg text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Icon name="arrow" size={16} className="rotate-180" />
                        <span className="sr-only">Move {caption.toLowerCase()} earlier</span>
                      </button>
                      <button
                        type="button"
                        data-move={`${it.id}-next`}
                        disabled={i === items.length - 1}
                        onClick={() => move(i, 1, it, "next")}
                        className="grid h-10 w-10 place-items-center rounded-lg text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Icon name="arrow" size={16} />
                        <span className="sr-only">Move {caption.toLowerCase()} later</span>
                      </button>
                    </>
                  )}
                  {actions?.(it, i)}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

/** Small square icon button used inside grid cards. */
export function TileBtn({ label, children, onClick, disabled }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-xs font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
