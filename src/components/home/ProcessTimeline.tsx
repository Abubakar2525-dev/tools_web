"use client";

import { useEffect, useRef } from "react";
import type { TitledText } from "@/content/types";

/**
 * Five-step process. A rail fills as the section scrolls through the
 * viewport and each step lights up when the fill reaches it. The rail is
 * driven by one rAF-throttled scroll listener writing a single CSS variable,
 * so React never re-renders during scroll. Normal scrolling is untouched.
 */
export function ProcessTimeline({ steps }: { steps: TitledText[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--p", "1");
      el.querySelectorAll(".process-step").forEach((n) => n.classList.add("lit"));
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the list top hits 80% of the viewport, 1 when its bottom hits 55%.
      const start = vh * 0.8;
      const end = vh * 0.55;
      const p = Math.min(1, Math.max(0, (start - r.top) / (r.height + start - end)));
      el.style.setProperty("--p", p.toFixed(3));
      const lit = Math.min(steps.length, Math.floor(p * steps.length + 0.35));
      el.querySelectorAll(".process-step").forEach((n, i) => n.classList.toggle("lit", i < lit));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [steps.length]);

  return (
    <div ref={ref} className="process relative">
      <span aria-hidden="true" className="process-rail" />
      <ol className="grid gap-10 lg:grid-cols-5 lg:gap-6">
      {steps.map((s, i) => (
        <li key={s.title} className="process-step relative pl-12 lg:pl-0 lg:pt-14" data-index={i + 1}>
          <span aria-hidden="true" className="process-dot">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="h3 text-night-ink">{s.title}</h3>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-night-muted">{s.body}</p>
        </li>
      ))}
      </ol>
      <style>{`
        .process{--p:0}
        .process-rail{position:absolute;left:15px;top:8px;bottom:8px;width:1px;background:var(--night-line);overflow:hidden}
        .process-rail::after{content:"";position:absolute;inset:0;background:var(--accent-on-night);transform-origin:top;transform:scaleY(var(--p))}
        @media (min-width:1024px){
          .process-rail{left:0;right:0;top:15px;bottom:auto;width:auto;height:1px}
          .process-rail::after{transform-origin:left;transform:scaleX(var(--p))}
        }
        .process-dot{position:absolute;left:0;top:0;display:grid;place-items:center;width:31px;height:31px;border-radius:999px;background:var(--night);box-shadow:inset 0 0 0 1px var(--night-line);font:500 11px var(--font-geist-mono);color:var(--night-muted);transition:background-color 300ms var(--ease-out),color 300ms var(--ease-out),box-shadow 300ms var(--ease-out)}
        .process-step.lit .process-dot{background:var(--accent-on-night);color:var(--night);box-shadow:none}
      `}</style>
    </div>
  );
}
