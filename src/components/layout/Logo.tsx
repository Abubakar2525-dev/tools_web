import Link from "next/link";
import { site } from "@/content/site";

/** Mark: a monogram "N" — two stems joined by a diagonal in the accent colour. */
export function LogoMark({ size = 28, onNight = false }: { size?: number; onNight?: boolean }) {
  const stem = onNight ? "var(--night)" : "var(--surface)";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill={onNight ? "var(--night-ink)" : "var(--ink)"} />
      <path d="M10.5 23V9M21.5 9v14" stroke={stem} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M10.5 9l11 14" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ onNight = false }: { onNight?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 rounded-md"
      aria-label={`${site.name} home`}
    >
      <LogoMark onNight={onNight} />
      <span
        className={`font-display text-[1.2rem] font-semibold tracking-[-0.03em] ${onNight ? "text-night-ink" : "text-ink"}`}
      >
        {site.name}
      </span>
    </Link>
  );
}
