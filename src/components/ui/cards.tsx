import Link from "next/link";
import type { Article, Project, Service } from "@/content/types";
import { formatDate, readingTime } from "@/content/articles";
import { Icon } from "./Icon";
import { ProjectVisual } from "./ProjectVisual";

export function ReferenceBadge({ kind }: { kind: Project["kind"] }) {
  if (kind === "client") return null;
  return (
    <span className="chip !h-6 !text-[0.75rem]" title="A representative scenario showing our approach, not a completed client engagement.">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
      Reference build
    </span>
  );
}

export function ProjectCard({
  project,
  size = "md",
  headingLevel = "h3",
}: {
  project: Project;
  size?: "lg" | "md";
  headingLevel?: "h2" | "h3";
}) {
  const H = headingLevel;
  return (
    <article className="card card-interactive group relative flex h-full flex-col overflow-hidden">
      <div className={`overflow-hidden border-b border-line ${size === "lg" ? "aspect-[16/9] lg:aspect-auto lg:min-h-[320px] lg:flex-1" : "aspect-[16/8]"}`}>
        <ProjectVisual
          kind={project.visual}
          className="h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.025] motion-reduce:transition-none"
        />
      </div>
      <div className={`flex flex-col p-6 sm:p-7 ${size === "lg" ? "" : "flex-1"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <ReferenceBadge kind={project.kind} />
          <span className="text-[0.8125rem] text-muted">{project.sector}</span>
        </div>
        <H className={`${size === "lg" ? "h3 sm:text-[1.75rem]" : "h3"} mt-4`}>
          <Link href={`/projects/${project.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {project.title}
          </Link>
        </H>
        <p className="mt-3 text-[0.975rem] text-ink-2">{project.summary}</p>
        <p className="arrow-link mt-auto pt-6 text-ink" aria-hidden="true">
          Read the build <Icon name="arrow" size={16} />
        </p>
      </div>
    </article>
  );
}

export function ArticleCard({
  article,
  variant = "default",
  headingLevel = "h3",
}: {
  article: Article;
  variant?: "default" | "row";
  headingLevel?: "h2" | "h3";
}) {
  const H = headingLevel;
  const meta = (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
      <span className="font-medium text-accent-strong">{article.category}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
      <span aria-hidden="true">·</span>
      <span>{readingTime(article)} min read</span>
    </p>
  );

  if (variant === "row") {
    return (
      <article className="group relative grid gap-2 py-6 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-8">
        <div>
          {meta}
          <H className="mt-2 font-display text-[1.25rem] leading-snug tracking-[-0.02em]">
            <Link
              href={`/articles/${article.slug}`}
              className="bg-[linear-gradient(var(--accent),var(--accent))] bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_1.5px] after:absolute after:inset-0 after:content-[''] motion-reduce:transition-none"
            >
              {article.title}
            </Link>
          </H>
        </div>
        <Icon name="arrow" size={20} className="mt-7 hidden text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink sm:block" />
      </article>
    );
  }

  return (
    <article className="card card-interactive group relative flex h-full flex-col p-6 sm:p-7">
      {meta}
      <H className="h3 mt-4">
        <Link href={`/articles/${article.slug}`} className="after:absolute after:inset-0 after:content-['']">
          {article.title}
        </Link>
      </H>
      <p className="mt-3 line-clamp-3 text-[0.975rem] text-ink-2">{article.description}</p>
      <p className="arrow-link mt-auto pt-6 text-ink" aria-hidden="true">
        Read article <Icon name="arrow" size={16} />
      </p>
    </article>
  );
}

export function ServiceRow({ service, index }: { service: Service; index: number }) {
  return (
    <li data-reveal style={{ "--i": index % 4 } as React.CSSProperties}>
      <Link
        href={`/services/${service.slug}`}
        className="group grid grid-cols-[auto_1fr_auto] items-start gap-5 rounded-xl px-3 py-6 transition-colors duration-200 hover:bg-surface sm:gap-7 sm:px-5"
      >
        <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-surface text-ink-2 shadow-[0_0_0_1px_var(--line)] transition-colors duration-200 group-hover:bg-ink group-hover:text-accent-night">
          <Icon name={service.icon} size={22} />
        </span>
        <span>
          <span className="block font-display text-[1.3rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[1.45rem]">
            {service.title}
          </span>
          <span className="mt-2 block max-w-[58ch] text-[0.975rem] text-ink-2">{service.summary}</span>
        </span>
        <Icon
          name="arrow"
          size={20}
          className="mt-2 text-muted transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-ink"
        />
      </Link>
    </li>
  );
}
