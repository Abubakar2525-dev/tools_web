"use client";

/**
 * Accessible time zone combobox (WAI-ARIA 1.2 combobox with listbox popup).
 * Type to filter IANA zones by city, region, country or abbreviation; arrow
 * keys move, Enter picks, Escape closes.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { inputCls } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { useNow } from "./hooks";
import { formatOffset, listTimeZones, offsetMinutes, searchZones } from "./lib/tz";

const MAX_SHOWN = 80;

export function ZonePicker({
  label,
  value,
  onChange,
  hint,
  className = "",
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (tz: string) => void;
  hint?: string;
  className?: string;
  hideLabel?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const now = useNow(60_000);

  const results = useMemo(() => (open ? searchZones(query ?? "", listTimeZones()) : []), [open, query]);
  const limited = Boolean(query) && results.length > MAX_SHOWN;
  const shown = limited ? results.slice(0, MAX_SHOWN) : results;
  const activeIndex = Math.min(active, Math.max(0, shown.length - 1));

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const openList = () => {
    setOpen(true);
    if (query === null) setActive(Math.max(0, listTimeZones().indexOf(value)));
  };

  const pick = (tz: string) => {
    onChange(tz);
    setQuery(null);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      else setActive(Math.min(activeIndex + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      if (open && shown[activeIndex]) {
        e.preventDefault();
        pick(shown[activeIndex]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setQuery(null);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
      setQuery(null);
    }
  };

  return (
    <div className={className}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm font-medium text-ink"}>
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[0.8125rem] text-muted">
          {hint}
        </p>
      )}
      <div className={`relative ${hideLabel ? "" : "mt-2"}`}>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-activedescendant={open && shown[activeIndex] ? `${id}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className={`${inputCls} h-11 pr-10`}
          value={query ?? value}
          placeholder="Search city, country or zone"
          onFocus={(e) => e.currentTarget.select()}
          onClick={() => !open && openList()}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
            setQuery(null);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Show ${label} options`}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (open ? setOpen(false) : openList())}
        >
          <Icon name="chevron" size={18} />
        </button>
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={`${label} options`}
          hidden={!open}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--line-strong),0_12px_32px_-12px_rgba(0,0,0,0.35)]"
        >
          {open && shown.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">No matching time zone.</li>}
          {shown.map((tz, i) => (
            <li
              key={tz}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => i !== activeIndex && setActive(i)}
              onClick={() => pick(tz)}
              className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${
                i === activeIndex ? "bg-accent-soft text-ink" : "text-ink-2"
              }`}
            >
              <span className="min-w-0 truncate">
                {tz.replace(/_/g, " ")}
                {tz === value && <span className="sr-only"> (current)</span>}
              </span>
              {now !== null && <span className="shrink-0 tabular-nums text-muted">{formatOffset(offsetMinutes(tz, now))}</span>}
            </li>
          ))}
          {limited && (
            <li className="px-3 py-2 text-[0.8125rem] text-muted">
              {results.length - MAX_SHOWN} more. Keep typing to narrow the list.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
