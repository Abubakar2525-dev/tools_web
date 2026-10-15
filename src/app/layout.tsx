import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header, type MegaMenu, type MenuLink } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RevealObserver } from "@/components/motion/RevealObserver";
import { JsonLd } from "@/components/ui/primitives";
import { site } from "@/content/site";
import { serviceNavigationGroups } from "@/content/services";
import { projects } from "@/content/projects";
import { catalog, toolsInCategory } from "@/content/catalog";
import { categories, categoryGroups, categoryHref } from "@/content/catalog/categories";
import {
  studentCategories,
  studentCategoryGroups,
  studentCategoryHref,
  studentToolsInCategory,
} from "@/content/student-catalog";
import { organizationLd, websiteLd } from "@/lib/seo";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | AI engineering and custom AI development`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: { siteName: site.name, locale: site.locale, type: "website" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#f8faf9",
  colorScheme: "light",
};

const servicesMenu: MegaMenu = {
  label: "Services",
  href: "/services",
  groups: serviceNavigationGroups.map((group) => ({
    title: group.title,
    items: group.services.map((service) => ({
      label: service.navLabel,
      href: `/services/${service.slug}`,
      description: service.summary,
      icon: service.icon,
    })),
  })),
  footer: { text: "Not sure which fits? We’ll help scope it.", cta: "All services", href: "/services" },
};

const toolsMenu: MegaMenu = {
  label: "Tools",
  href: "/tools",
  groups: categoryGroups.map((g) => ({
    title: g,
    items: categories
      .filter((c) => c.group === g)
      .map((c) => ({ label: c.name, href: categoryHref(c.slug), description: `${toolsInCategory(c.slug).length} tools`, icon: c.icon })),
  })),
  featured: {
    title: `${catalog.length} free tools`,
    body: "PDF, image, text, developer, finance and more. Search them all in one place.",
    points: ["Processed on your device", "No sign-up", "Clear network disclosures"],
    cta: "Explore all tools",
    href: "/tools",
  },
};

const studentMenu: MegaMenu = {
  label: "Student tools",
  href: "/student-tools",
  groups: studentCategoryGroups.map((group) => ({
    title: group,
    items: studentCategories
      .filter((category) => category.group === group)
      .map((category) => ({
        label: category.shortName,
        href: studentCategoryHref(category.slug),
        description: `${studentToolsInCategory(category.slug).length} tools · ${category.description}`,
        icon: category.icon,
      })),
  })),
  featured: {
    title: "177 tools across 15 subjects",
    body: "Writing, research, STEM, grades, planning, careers and coding in one searchable student directory.",
    points: ["Runs in your browser", "Works great on mobile", "Free roadmaps and guides"],
    cta: "Explore all student tools",
    href: "/student-tools",
  },
};

const projectLinks: MenuLink[] = projects.map((p) => ({
  label: p.title,
  href: `/projects/${p.slug}`,
  description: p.sector,
}));

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${bricolage.variable}`}>
      <head>
        {/* Enables reveal-on-scroll styles only when JS runs; content stays visible otherwise. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header services={servicesMenu} projects={projectLinks} tools={toolsMenu} studentTools={studentMenu} />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer />
        <RevealObserver />
        <JsonLd data={[organizationLd(), websiteLd()]} />
      </body>
    </html>
  );
}
