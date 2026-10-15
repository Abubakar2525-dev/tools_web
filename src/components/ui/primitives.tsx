import Link from "next/link";
import { Fragment } from "react";
import { Icon } from "./Icon";
import { breadcrumbLd, faqLd } from "@/lib/seo";
import type { Faq } from "@/content/types";

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe here; escape "<" to avoid </script> breakouts.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Renders `code`, **bold** and [text](href) inside content strings. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("`")) return <code key={i} className="inline-code">{p.slice(1, -1)}</code>;
        if (p.startsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (m) {
          const [, label, href] = m;
          return href.startsWith("/") ? (
            <Link key={i} href={href} className="link">
              {label}
            </Link>
          ) : (
            <a key={i} href={href} className="link" target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  arrow = false,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "light";
  arrow?: boolean;
  className?: string;
}) {
  const v = variant === "ghost" ? "btn-ghost" : variant === "light" ? "btn-light" : "";
  return (
    <Link href={href} className={`btn ${v} ${className}`}>
      {children}
      {arrow && (
        <span className="btn-arrow">
          <Icon name="arrow" size={14} strokeWidth={2} />
        </span>
      )}
    </Link>
  );
}

export function SectionHeader({
  title,
  intro,
  kicker,
  as: As = "h2",
  className = "",
  align = "left",
}: {
  title: React.ReactNode;
  intro?: React.ReactNode;
  kicker?: string;
  as?: "h1" | "h2";
  className?: string;
  align?: "left" | "split";
}) {
  if (align === "split") {
    return (
      <div className={`grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16 ${className}`}>
        <div data-reveal>
          {kicker && <p className="kicker mb-4">{kicker}</p>}
          <As className="h2 max-w-[18ch]">{title}</As>
        </div>
        {intro && (
          <p data-reveal style={{ "--i": 1 } as React.CSSProperties} className="lead max-w-[46ch]">
            {intro}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className={`max-w-[46rem] ${className}`} data-reveal>
      {kicker && <p className="kicker mb-4">{kicker}</p>}
      <As className="h2">{title}</As>
      {intro && <p className="lead mt-5 max-w-[52ch]">{intro}</p>}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  const all = [{ name: "Home", path: "/" }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((it, i) => {
            const last = i === all.length - 1;
            return (
              <li key={it.path} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="text-ink-2">
                    {it.name}
                  </span>
                ) : (
                  <>
                    <Link href={it.path} className="transition-colors hover:text-ink">
                      {it.name}
                    </Link>
                    <span aria-hidden="true" className="text-line-strong">
                      /
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbLd(all)} />
    </>
  );
}

export function FaqList({ faqs, withSchema = true }: { faqs: Faq[]; withSchema?: boolean }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {faqs.map((f, i) => (
        <details key={f.q} className="faq group" data-reveal style={{ "--i": i } as React.CSSProperties}>
          <summary className="flex min-h-[64px] items-center justify-between gap-6 py-5 text-left">
            <h3 className="font-sans text-[1.0625rem] font-medium leading-snug tracking-normal text-ink">{f.q}</h3>
            <span className="faq-icon grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors group-hover:text-accent-strong">
              <Icon name="plus" size={16} />
            </span>
          </summary>
          <p className="max-w-[62ch] pb-6 pr-12 text-ink-2">
            <RichText text={f.a} />
          </p>
        </details>
      ))}
      {withSchema && <JsonLd data={faqLd(faqs)} />}
    </div>
  );
}

/** Closing CTA band, shared across pages. */
export function CtaBand({
  title = "Have an AI idea worth building?",
  body = "Let's turn your technical challenge into a practical, production-ready solution.",
  cta = "Start a conversation",
  href = "/contact",
}: {
  title?: string;
  body?: string;
  cta?: string;
  href?: string;
}) {
  return (
    <section aria-labelledby="cta-title" className="px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="relative overflow-hidden rounded-[22px] bg-night text-night-ink">
        <CtaStrata />
        <Container className="relative py-20 sm:py-28">
          <div className="max-w-[40rem]" data-reveal>
            <h2 id="cta-title" className="h2 text-night-ink">
              {title}
            </h2>
            <p className="lead mt-5 !text-night-muted">{body}</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink href={href} variant="light" arrow>
                {cta}
              </ButtonLink>
              {href === "/contact" && (
                <p className="text-sm text-night-muted">A short call to understand the problem. No obligation.</p>
              )}
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}

function CtaStrata() {
  return (
    <svg
      aria-hidden="true"
      className="drift absolute -right-24 top-1/2 hidden h-[520px] w-[720px] -translate-y-1/2 md:block"
      viewBox="0 0 720 520"
      fill="none"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M${80 + i * 24} ${120 + i * 56} L${360 + i * 24} ${40 + i * 56} L${700} ${120 + i * 56} L${420 + i * 24} ${200 + i * 56} Z`}
          stroke={i === 4 ? "var(--accent-on-night)" : "var(--night-line)"}
          strokeWidth={i === 4 ? 1.5 : 1}
          fill={i === 4 ? "color-mix(in oklch, var(--accent-on-night) 8%, transparent)" : "none"}
        />
      ))}
    </svg>
  );
}
