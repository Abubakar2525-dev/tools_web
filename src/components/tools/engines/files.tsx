"use client";

/**
 * File input + processing helpers shared by PDF, image, audio and file tools.
 * Everything here works locally in the browser.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "../kit";
import { createFileAcceptMatcher } from "./file-accept";

/* ------------------------------------------------------------------ */
/* FileDrop                                                            */
/* ------------------------------------------------------------------ */

export function FileDrop({
  onFiles,
  accept,
  multiple = false,
  maxSizeMB = 100,
  maxFiles = 50,
  label,
  hint,
  validate,
  allowPaste = false,
  allowFolders = false,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  /** Same syntax as <input accept>, e.g. "application/pdf,.pdf" or "image/*". */
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  maxFiles?: number;
  /** Main line, e.g. "Choose a PDF or drop it here". */
  label?: string;
  hint?: string;
  /** Extra per-file check; return an error string to reject. */
  validate?: (f: File) => string | null;
  /** Accept images pasted with Ctrl/Cmd+V. */
  allowPaste?: boolean;
  /** Adds a "Choose folder" button (webkitdirectory); files keep webkitRelativePath. */
  allowFolders?: boolean;
  compact?: boolean;
}) {
  const inputId = useId();
  const folderRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const accepts = useMemo(() => createFileAcceptMatcher(accept), [accept]);

  const handle = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      const files = Array.from(list);
      const errs: string[] = [];
      let rejected = 0;
      const ok: File[] = [];
      const reject = (message: string) => {
        rejected++;
        if (errs.length < 6) errs.push(message);
      };
      for (const f of files) {
        if (!accepts(f)) reject(`${f.name}: this file type isn't supported here.`);
        else if (f.size > maxSizeMB * 1024 * 1024) reject(`${f.name}: larger than the ${maxSizeMB} MB limit.`);
        else {
          const e = validate?.(f);
          if (e) reject(`${f.name}: ${e}`);
          else ok.push(f);
        }
      }
      const limited = multiple ? ok.slice(0, maxFiles) : ok.slice(0, 1);
      if (multiple && ok.length > maxFiles) errs.push(`Only the first ${maxFiles} files were added.`);
      if (!multiple && ok.length > 1) errs.push("Only one file can be used here; the first was added.");
      if (rejected > 6) errs.push(`${rejected - 6} more files were rejected.`);
      setErrors(errs);
      if (limited.length) onFiles(limited);
    },
    [accepts, maxSizeMB, maxFiles, multiple, onFiles, validate],
  );

  useEffect(() => {
    if (!allowPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.files ?? []);
      if (items.length) handle(items);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [allowPaste, handle]);

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-colors duration-150 ${
          compact ? "py-6" : "py-12"
        } ${drag ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:border-muted hover:bg-sunken"}`}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-sunken text-ink-2">
          <Icon name="upload" size={22} />
        </span>
        <span className="mt-3 font-medium text-ink">{label ?? (multiple ? "Choose files or drop them here" : "Choose a file or drop it here")}</span>
        <span className="mt-1 text-sm text-muted">
          {hint ?? `Up to ${maxSizeMB} MB${multiple ? ` each, ${maxFiles} files max` : ""}.`}
          {allowPaste ? " You can also paste an image." : ""}
        </span>
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {allowFolders && (
        <div className="mt-2 text-center">
          <button type="button" className="link text-sm" onClick={() => folderRef.current?.click()}>
            Or choose a whole folder
          </button>
          <input
            ref={(el) => {
              folderRef.current = el;
              if (el) el.setAttribute("webkitdirectory", "");
            }}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              handle(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {errors.length > 0 && (
        <div className="mt-3">
          <Notice tone="error">
            <ul className="space-y-1">
              {errors.map((er) => (
                <li key={er}>{er}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}
    </div>
  );
}

/** A compact row describing a chosen file, with a remove action. */
export function FileChip({ file, onRemove, extra }: { file: File; onRemove?: () => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-sunken px-3 py-2.5 text-sm">
      <Icon name="file" size={18} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-ink" title={file.name}>
        {file.name}
      </span>
      <span className="shrink-0 tabular-nums text-muted">{formatBytes(file.size)}</span>
      {extra}
      {onRemove && (
        <button type="button" onClick={onRemove} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
          <Icon name="close" size={16} />
          <span className="sr-only">Remove {file.name}</span>
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export function Spinner({ label = "Working" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-2" role="status">
      <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent motion-reduce:animate-none" />
      {label}…
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div>
      <div className="flex justify-between text-sm text-ink-2">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

export const baseName = (name: string) => name.replace(/\.[^./\\]+$/, "");
export const extOf = (name: string) => (name.match(/\.([^./\\]+)$/)?.[1] ?? "").toLowerCase();
export const withExt = (name: string, ext: string) => `${baseName(name)}.${ext.replace(/^\./, "")}`;

/** Makes names unique within a batch: "a.png", "a (2).png", … */
export function uniqueNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const k = n.toLowerCase();
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    return c === 1 ? n : `${baseName(n)} (${c})${extOf(n) ? `.${extOf(n)}` : ""}`;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Builds a ZIP in the browser (fflate is loaded on demand). */
export async function zipFiles(entries: { name: string; data: Blob | Uint8Array | string }[], level: 0 | 1 | 6 | 9 = 6) {
  const { zip } = await import("fflate");
  const names = uniqueNames(entries.map((e) => e.name));
  const encoded = new Array<Uint8Array>(entries.length);
  const encoder = new TextEncoder();
  const totalBytes = entries.reduce((sum, entry) => {
    const data = entry.data;
    if (typeof data === "string") return sum + data.length;
    return sum + (data instanceof Uint8Array ? data.byteLength : data.size);
  }, 0);
  const hardwareConcurrency = typeof navigator === "undefined" ? 4 : (navigator.hardwareConcurrency || 4);
  const readConcurrency = totalBytes > 512 * 1024 * 1024 ? 2 : totalBytes > 128 * 1024 * 1024 ? 4 : Math.min(8, hardwareConcurrency);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(readConcurrency, entries.length) }, async () => {
      while (cursor < entries.length) {
        const index = cursor++;
        const data = entries[index].data;
        encoded[index] =
          typeof data === "string"
            ? encoder.encode(data)
            : data instanceof Uint8Array
              ? data
              : new Uint8Array(await data.arrayBuffer());
      }
    }),
  );

  const input: Record<string, Uint8Array> = {};
  for (let i = 0; i < entries.length; i++) {
    input[names[i]] = encoded[i];
  }
  return new Promise<Blob>((resolve, reject) =>
    zip(input, { level }, (err, out) => (err ? reject(err) : resolve(new Blob([out as BlobPart], { type: "application/zip" })))),
  );
}

export async function fileToBytes(f: Blob) {
  return new Uint8Array(await f.arrayBuffer());
}

export function fileToDataURL(f: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Could not read the file."));
    r.readAsDataURL(f);
  });
}

/** Decodes an image file into a bitmap (respects EXIF orientation in modern browsers). */
export async function loadImage(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image could not be decoded by your browser. Try PNG, JPG or WebP.");
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas, type = "image/png", quality?: number): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    (canvas as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error("This browser cannot export that format."))), type, quality),
  );
}

/** True if the browser can encode the given image MIME type via canvas. */
export function canEncode(type: string) {
  if (typeof document === "undefined") return false;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  return c.toDataURL(type).startsWith(`data:${type}`);
}

const noopSubscribe = () => () => {};

/**
 * Hydration-safe version of canEncode for use during render: returns false on
 * the server and during hydration, then the real browser capability.
 */
export function useCanEncode(type: string) {
  return useSyncExternalStore(
    noopSubscribe,
    () => canEncode(type),
    () => false,
  );
}

/** Object URL that is revoked automatically when it changes or unmounts. */
export function useObjectUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing an external resource (object URL) to state
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [blob]);
  return blob ? url : null;
}

/**
 * Shifts headings in sanitized preview HTML down one level (h1→h2 … h5→h6) so
 * user content never adds a second <h1> to the page.
 */
export function demoteHeadings(html: string) {
  return html.replace(/<(\/?)h([1-6])(\s|>)/gi, (_m, slash: string, level: string, tail: string) => `<${slash}h${Math.min(6, Number(level) + 1)}${tail}`);
}
