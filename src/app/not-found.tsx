import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Container } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const suggestions = [
  { label: "Services", href: "/services" },
  { label: "Projects", href: "/projects" },
  { label: "Articles", href: "/articles" },
  { label: "Contact", href: "/contact" },
];

export default function NotFound() {
  return (
    <Container className="grid min-h-[70vh] place-items-center py-24">
      <div className="max-w-xl text-center">
        <p className="font-mono text-sm text-accent-strong">404 · no route matched</p>
        <h1 className="display mt-5 !text-[clamp(2.4rem,1.6rem+3vw,3.75rem)]">This page isn&rsquo;t in the stack.</h1>
        <p className="lead mx-auto mt-5 max-w-[42ch]">
          The link may be outdated or mistyped. Try one of these instead.
        </p>
        <ul className="mt-8 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="chip !h-10 !px-4 !text-[0.95rem] transition-colors hover:text-ink">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
        <ButtonLink href="/" className="mt-10" arrow>
          Back to home
        </ButtonLink>
      </div>
    </Container>
  );
}
