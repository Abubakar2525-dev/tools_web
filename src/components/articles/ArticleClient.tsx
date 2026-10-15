"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/** Table of contents with scroll-spy. Links work without JS; JS adds the active marker. */
export function Toc({ items }: { items: { id: string; text: string }[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const heads = items.map((i) => document.getElementById(i.id)).filter((x): x is HTMLElement => !!x);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-labelledby="toc-title">
      <p id="toc-title" className="text-sm font-medium text-ink">
        On this page
      </p>
      <ol className="mt-4 space-y-1 border-l border-line">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={active === i.id ? "location" : undefined}
              className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-[0.875rem] leading-snug text-muted transition-colors duration-150 hover:text-ink aria-[current=location]:border-accent aria-[current=location]:text-ink"
            >
              {i.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function CopyButton({ text, label = "Copy code" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("error");
        }
        window.setTimeout(() => setState("idle"), 1800);
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-night-muted transition-colors hover:bg-night-2 hover:text-night-ink"
    >
      <Icon name={state === "done" ? "check" : "layers"} size={14} />
      <span aria-live="polite">{state === "done" ? "Copied" : state === "error" ? "Copy failed" : label}</span>
    </button>
  );
}

export function ShareLinks({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const linkCls =
    "inline-flex h-10 items-center rounded-lg px-3.5 text-sm text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors hover:bg-surface hover:text-ink";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a className={linkCls} href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`} target="_blank" rel="noopener noreferrer">
        Share on LinkedIn
      </a>
      <a className={linkCls} href={`https://x.com/intent/post?url=${enc(url)}&text=${enc(title)}`} target="_blank" rel="noopener noreferrer">
        Share on X
      </a>
      <button
        type="button"
        className={linkCls}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          } catch {
            /* clipboard unavailable: leave state unchanged */
          }
        }}
      >
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
    </div>
  );
}
