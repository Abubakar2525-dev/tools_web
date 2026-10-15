import Link from "next/link";
import { Logo } from "./Logo";
import { site } from "@/content/site";
import { getService } from "@/content/services";

const footerServices = [
  "ai-application-development",
  "web-development",
  "wordpress-development",
  "seo-services",
  "ecommerce-development",
].flatMap((slug) => {
  const service = getService(slug);
  return service ? [service] : [];
});

export function Footer() {
  const contactLinks = [
    site.contact.email && { label: site.contact.email, href: `mailto:${site.contact.email}` },
    site.social.github && { label: "GitHub", href: site.social.github },
    site.social.linkedin && { label: "LinkedIn", href: site.social.linkedin },
    site.social.x && { label: "X", href: site.social.x },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="bg-bg pt-4">
      <footer
        className="overflow-hidden bg-night text-night-muted"
        style={{ borderRadius: "50px 50px 0 0" }}
      >
        <div className="mx-auto max-w-[1240px] px-5 pb-10 pt-20 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Logo onNight />
            <p className="mt-5 text-[0.95rem] leading-relaxed">{site.description}</p>
            <Link href="/contact" className="btn btn-light btn-sm mt-7">
              {site.primaryCta.label}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            <FooterCol title="Studio">
              <FooterLink href="/about">About</FooterLink>
              <FooterLink href="/projects">Projects</FooterLink>
              <FooterLink href="/articles">Articles</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
            </FooterCol>
            <FooterCol title="Services" className="sm:col-span-2" listClassName="grid gap-x-8 sm:grid-cols-2 sm:space-y-0 sm:gap-y-2.5">
              {footerServices.map((s) => (
                <FooterLink key={s.slug} href={`/services/${s.slug}`}>
                  {s.navLabel}
                </FooterLink>
              ))}
            </FooterCol>
            <FooterCol title="Free tools">
              <FooterLink href="/tools">Tools</FooterLink>
              <FooterLink href="/tools/json-formatter">JSON formatter</FooterLink>
              <FooterLink href="/tools/prompt-builder">AI prompt builder</FooterLink>
              <FooterLink href="/student-tools">Student tools</FooterLink>
              <FooterLink href="/student-tools/gpa-calculator">GPA calculator</FooterLink>
              <FooterLink href="/student-tools/resources">Learning resources</FooterLink>
            </FooterCol>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-night-line pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 sm:gap-1.5">
            <p>© {site.legalName}. Independent AI engineering studio.</p>
            <p className="text-[0.85rem]">
              Designed by{" "}
              <a
                href="https://abubakar.dev"
                target="_blank"
                rel="noopener"
                className="underline underline-offset-4 transition-colors hover:text-night-ink"
              >
                Abubakar.dev
              </a>
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {contactLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="transition-colors hover:text-night-ink" rel="noopener">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/privacy" className="transition-colors hover:text-night-ink">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="transition-colors hover:text-night-ink">
                Terms
              </Link>
            </li>
            <li>
              <a href="/sitemap.xml" className="transition-colors hover:text-night-ink">
                Sitemap
              </a>
            </li>
          </ul>
        </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  title,
  children,
  className = "",
  listClassName = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  listClassName?: string;
}) {
  return (
    <div className={className}>
      <h2 className="font-sans text-sm font-medium tracking-normal text-night-ink">{title}</h2>
      <ul className={`mt-4 space-y-2.5 text-[0.9rem] ${listClassName}`}>{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li className="list-none">
      <Link href={href} className="transition-colors duration-150 hover:text-night-ink">
        {children}
      </Link>
    </li>
  );
}
