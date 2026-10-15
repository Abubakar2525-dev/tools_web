"use client";

/**
 * Shared building blocks for every interactive tool. Use these instead of
 * ad-hoc markup so all tools share spacing, focus, error and result styling.
 *
 * Privacy: tools run entirely in the browser. `usePersistentState` stores data
 * only in this browser's localStorage; nothing is sent to a server.
 */

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Icon, type AnyIcon } from "@/components/ui/Icon";

/* ------------------------------------------------------------------ */
/* Class strings                                                       */
/* ------------------------------------------------------------------ */

export const inputCls =
  "block w-full rounded-lg bg-surface px-3.5 text-[1rem] text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] outline-none transition-shadow duration-150 placeholder:text-muted/80 hover:shadow-[inset_0_0_0_1px_var(--muted)] focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--danger)] disabled:cursor-not-allowed disabled:opacity-60";

export const monoAreaCls = `${inputCls} min-h-[220px] resize-y py-3 font-mono text-[0.875rem] leading-relaxed`;

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/** Main tool surface. Put the whole tool inside one ToolPanel (or two side by side). */
export function ToolPanel({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card min-w-0 p-5 sm:p-7 ${className}`} aria-label={title}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="font-sans text-[1.0625rem] font-semibold tracking-normal">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Two-column (input | output) grid that stacks on mobile. */
export function SplitGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 lg:grid-cols-2">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

type FieldBase = {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  className?: string;
};

function FieldWrap({
  id,
  label,
  hint,
  error,
  optional,
  className = "",
  children,
}: FieldBase & { id: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[0.8125rem] text-muted">
          {hint}
        </p>
      )}
      <div className="mt-2">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-2 flex items-start gap-1.5 text-sm text-danger" role="alert">
          <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string | null) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

export function TextField({
  label,
  hint,
  error,
  optional,
  className,
  ...input
}: FieldBase & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <input
        id={id}
        className={`${inputCls} h-11`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...input}
      />
    </FieldWrap>
  );
}

/** Numeric input. Keeps the raw string so users can type freely; parse with parseNum(). */
export function NumberField(props: FieldBase & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "type">) {
  return <TextField inputMode="decimal" type="text" autoComplete="off" {...props} />;
}

export function TextArea({
  label,
  hint,
  error,
  optional,
  className,
  mono = false,
  ...area
}: FieldBase & { mono?: boolean } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <textarea
        id={id}
        spellCheck={mono ? false : undefined}
        className={mono ? monoAreaCls : `${inputCls} min-h-[140px] resize-y py-3 leading-relaxed`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...area}
      />
    </FieldWrap>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optional,
  className,
  options,
  ...select
}: FieldBase & {
  options: readonly (string | { value: string; label: string })[];
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className">) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <div className="relative">
        <select
          id={id}
          className={`${inputCls} h-11 appearance-none pr-10`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          {...select}
        >
          {options.map((o) => {
            const v = typeof o === "string" ? { value: o, label: o } : o;
            return (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            );
          })}
        </select>
        <Icon name="chevron" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </FieldWrap>
  );
}

/** Compact unlabeled-looking input for table rows; still requires an accessible label. */
export function CellInput({
  label,
  invalid,
  className = "",
  ...input
}: { label: string; invalid?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      aria-label={label}
      aria-invalid={invalid ? true : undefined}
      className={`${inputCls} h-10 px-2.5 text-[0.95rem] ${className}`}
      {...input}
    />
  );
}

export function CellSelect({
  label,
  options,
  className = "",
  ...select
}: {
  label: string;
  options: readonly (string | { value: string; label: string })[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select aria-label={label} className={`${inputCls} h-10 appearance-none pl-2.5 pr-8 text-[0.95rem]`} {...select}>
        {options.map((o) => {
          const v = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          );
        })}
      </select>
      <Icon name="chevron" size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

/** Segmented control (radio group) for modes. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-sunken p-1">
        {options.map((o) => (
          <label key={o.value} className="relative">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="inline-flex h-9 cursor-pointer items-center rounded-lg px-3.5 text-sm font-medium text-ink-2 transition-[background-color,color,box-shadow] duration-150 hover:text-ink peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--accent)]"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <div>
        <label htmlFor={id} className="cursor-pointer text-[0.95rem] text-ink">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-[0.8125rem] text-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function Btn({
  variant = "primary",
  icon,
  children,
  className = "",
  ...btn
}: {
  variant?: "primary" | "ghost" | "subtle" | "danger";
  icon?: AnyIcon;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v =
    variant === "ghost"
      ? "btn-ghost"
      : variant === "subtle"
        ? "btn-ghost !shadow-none hover:!bg-sunken"
        : variant === "danger"
          ? "btn-ghost !text-danger"
          : "";
  return (
    <button type="button" className={`btn btn-sm ${v} disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...btn}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function CopyBtn({ text, label = "Copy", disabled }: { text: string; label?: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return (
    <Btn
      variant="ghost"
      icon={state === "done" ? "check" : "copy"}
      disabled={disabled || !text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("error");
        }
        timer.current = window.setTimeout(() => setState("idle"), 1600);
      }}
    >
      <span aria-live="polite">{state === "done" ? "Copied" : state === "error" ? "Copy failed" : label}</span>
    </Btn>
  );
}

export function ResetBtn({ onClick, label = "Reset" }: { onClick: () => void; label?: string }) {
  return (
    <Btn variant="subtle" icon="reset" onClick={onClick}>
      {label}
    </Btn>
  );
}

/** Triggers a client-side file download (e.g. .ics, .json, .md). */
export function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

/** Highlighted result. Announced politely to screen readers when it changes. */
export function ResultCard({
  label,
  value,
  detail,
  tone = "accent",
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: "accent" | "neutral";
}) {
  return (
    <div
      className={`rounded-xl p-5 ${tone === "accent" ? "bg-accent-soft" : "bg-sunken"}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-1 font-display text-[2.25rem] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
        {value}
      </p>
      {detail && <div className="mt-2 text-sm text-ink-2">{detail}</div>}
    </div>
  );
}

/** Row of small stats (label / value). */
export function StatGrid({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line shadow-[0_0_0_1px_var(--line)] sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="bg-surface px-4 py-3">
          <dt className="text-[0.8125rem] text-muted">{it.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "error" | "success" | "warning";
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-sunken text-ink-2",
    error: "bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] text-ink",
    success: "bg-accent-soft text-ink",
    warning: "bg-[color-mix(in_oklch,oklch(0.75_0.15_75)_14%,transparent)] text-ink",
  }[tone];
  const icon: AnyIcon = tone === "error" ? "alert" : tone === "success" ? "check" : tone === "warning" ? "alert" : "info";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-lg px-4 py-3 text-sm ${styles}`}>
      <Icon name={icon} size={18} className={`mt-px shrink-0 ${tone === "error" ? "text-danger" : "text-accent-strong"}`} />
      <div>
        {title && <p className="font-medium text-ink">{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon = "info", title, children }: { icon?: AnyIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <Icon name={icon} size={24} className="mx-auto text-muted" />
      <p className="mt-3 font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Read-only code/output block with horizontal scroll. */
export function OutputBlock({ children, label = "Output" }: { children: React.ReactNode; label?: string }) {
  return (
    <pre
      tabIndex={0}
      aria-label={label}
      className="max-h-[480px] min-h-[220px] overflow-auto rounded-lg bg-night p-4 font-mono text-[0.85rem] leading-relaxed text-night-ink"
    >
      {children}
    </pre>
  );
}

/** Local-only privacy note shown under tools that hold user data. */
export function PrivacyNote({ stored = false }: { stored?: boolean }) {
  return (
    <p className="flex items-start gap-2 text-[0.8125rem] text-muted">
      <Icon name="shield" size={16} className="mt-px shrink-0 text-accent" />
      {stored
        ? "Runs in your browser. Entries are saved only in this browser's local storage and are never sent to our servers."
        : "Runs entirely in your browser. Nothing you enter is sent to our servers."}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Parses a user-typed number. Returns null for empty/invalid input. Accepts "1,234.5". */
export function parseNum(raw: string): number | null {
  const s = raw.trim().replace(/,/g, "");
  if (s === "" || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Rounds for display without floating-point noise (e.g. 3.6699999 → "3.67"). */
export function fmt(n: number, digits = 2) {
  return (Math.round((n + Number.EPSILON) * 10 ** digits) / 10 ** digits).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

/* ------------------------------------------------------------------ */
/* Persistent state (localStorage), hydration-safe                     */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Like useState, but persisted to localStorage under `stratum:<key>`.
 * Server render and first client render use `initial`; stored data appears
 * right after hydration. Storage failures (private mode, quota) fall back to
 * in-memory state silently.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const storageKey = `stratum:${key}`;
  // Captured once; later changes to the argument are ignored, like useState.
  const [initialValue] = useState(initial);
  const [memory, setMemory] = useState<T | undefined>(undefined);

  const raw = useSyncExternalStore(
    subscribe,
    () => safeRead(storageKey),
    () => null,
  );

  let value: T = initialValue;
  if (memory !== undefined) value = memory;
  else if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initialValue;
    }
  }

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prevRaw = safeRead(storageKey);
      let prev: T = initialValue;
      if (prevRaw !== null) {
        try {
          prev = JSON.parse(prevRaw) as T;
        } catch {
          /* keep initial */
        }
      }
      setMemory((m) => {
        const base = m !== undefined ? m : prev;
        const resolved = typeof next === "function" ? (next as (p: T) => T)(base) : next;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(resolved));
          emit();
        } catch {
          /* storage unavailable: keep in memory */
        }
        return resolved;
      });
    },
    [storageKey, initialValue],
  );

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setMemory(initialValue);
    emit();
  }, [storageKey, initialValue]);

  return [value, setValue, clear] as const;
}
