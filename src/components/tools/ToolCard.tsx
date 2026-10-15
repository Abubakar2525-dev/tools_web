import Link from "next/link";
import { Icon, type AnyIcon } from "@/components/ui/Icon";

export type ToolCardData = {
  href: string;
  name: string;
  summary: string;
  category: string;
  icon: AnyIcon;
  /** "Open tool" by default; resources use "Open guide". */
  cta?: string;
};

export function ToolCard({ tool, headingLevel = "h2" }: { tool: ToolCardData; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <article className="card card-interactive group relative flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-sunken text-ink-2 transition-colors duration-200 group-hover:bg-ink group-hover:text-accent-night">
          <Icon name={tool.icon} size={24} className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 motion-reduce:transition-none" />
        </span>
        <span className="chip !h-6 !text-[0.75rem]">{tool.category}</span>
      </div>
      <H className="mt-6 font-display text-[1.25rem] font-semibold leading-snug tracking-[-0.02em]">
        <Link href={tool.href} className="after:absolute after:inset-0 after:rounded-[var(--radius-lg)] after:content-['']">
          {tool.name}
        </Link>
      </H>
      <p className="mt-2 text-[0.95rem] text-ink-2">{tool.summary}</p>
      <p className="arrow-link mt-auto pt-6 text-ink" aria-hidden="true">
        {tool.cta ?? "Open tool"} <Icon name="arrow" size={16} />
      </p>
    </article>
  );
}
