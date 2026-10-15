/**
 * Global brand + business configuration.
 *
 * EDIT ME: "Nuvella Promo Code" is a placeholder brand. Replace name, url and contact
 * details with real, verified business information before launch. Fields set
 * to `null` are intentionally hidden in the UI until real values exist; we
 * never display invented addresses, phone numbers, emails or social accounts.
 */
export const site = {
  name: "Nuvella Promo Code",
  legalName: "Nuvella Promo Code", // EDIT ME: registered company name
  tagline: "AI engineering studio",
  description:
    "Nuvella Promo Code designs and engineers production AI systems: LLM applications, AI agents, RAG and the data and infrastructure underneath them.",
  /** Canonical origin. Set NEXT_PUBLIC_SITE_URL in production. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.example.com").replace(/\/$/, ""),
  locale: "en_US",
  contact: {
    email: null as string | null, // EDIT ME: e.g. "hello@yourdomain.com"
    phone: null as string | null,
    address: null as string | null,
  },
  social: {
    github: null as string | null,
    linkedin: null as string | null,
    x: null as string | null,
  },
  primaryCta: { label: "Discuss your project", href: "/contact" },
} as const;

export type NavItem = { label: string; href: string };

export const mainNav: NavItem[] = [
  { label: "Services", href: "/services" },
  { label: "Projects", href: "/projects" },
  { label: "Articles", href: "/articles" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];
