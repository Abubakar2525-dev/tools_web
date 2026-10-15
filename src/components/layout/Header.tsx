"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Logo } from "./Logo";
import { Icon, type AnyIcon } from "@/components/ui/Icon";
import { site } from "@/content/site";

export type MenuLink = { label: string; href: string; description?: string; icon?: AnyIcon; group?: string };
export type MenuGroup = { title: string; items: MenuLink[] };

/** A mega menu: columns of grouped links plus a featured column or footer CTA. */
export type MegaMenu = {
  label: string;
  href: string;
  groups: MenuGroup[];
  /** Dark featured column (tools menus). */
  featured?: { title: string; body: string; points?: string[]; cta: string; href: string };
  /** Light footer bar (services menu). */
  footer?: { text: string; cta: string; href: string };
};

type MenuId = "services" | "projects" | "tools" | "student";

type Props = {
  services: MegaMenu;
  projects: MenuLink[];
  tools: MegaMenu;
  studentTools: MegaMenu;
};

const plainLinks = [
  { label: "Articles", href: "/articles" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function Header({ services, projects, tools, studentTools }: Props) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<null | MenuId>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus on route change.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(null);
    setMobileOpen(false);
  }

  // Escape + click-outside for desktop menus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const trigger = document.getElementById(`trigger-${open}`);
        setOpen(null);
        trigger?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // Lock page scroll behind the mobile sheet.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const megaItem = (id: MenuId, menu: MegaMenu) => (
    <DropdownItem id={id} label={menu.label} href={menu.href} active={isActive(menu.href)} open={open === id} setOpen={setOpen} mega>
      <MegaPanel menu={menu} />
    </DropdownItem>
  );

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-200 ${
          scrolled || mobileOpen || open
            ? "bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] shadow-[0_1px_0_var(--line)] backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        {/* `relative`: mega panels position against this content-width container. */}
        <div className="relative mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-6 px-5 sm:px-8">
          <Logo />

          <nav ref={navRef} aria-label="Primary" className="hidden xl:block">
            <ul className="flex items-center gap-0.5">
              {megaItem("services", services)}
              <DropdownItem
                id="projects"
                label="Projects"
                href="/projects"
                active={isActive("/projects")}
                open={open === "projects"}
                setOpen={setOpen}
              >
                <ProjectsPanel items={projects} />
              </DropdownItem>
              {megaItem("tools", tools)}
              {megaItem("student", studentTools)}
              {plainLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className="nav-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Link href={site.primaryCta.href} className="btn btn-sm hidden sm:inline-flex">
              {site.primaryCta.label}
            </Link>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-sunken xl:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
              <Icon name={mobileOpen ? "close" : "menu"} size={22} />
            </button>
          </div>
        </div>

        <style>{`
          .nav-link{display:inline-flex;align-items:center;gap:4px;height:40px;padding:0 10px;border-radius:8px;font-size:.95rem;font-weight:500;color:var(--ink-2);transition:color var(--dur-1) var(--ease-out),background-color var(--dur-1) var(--ease-out);position:relative;white-space:nowrap}
          .nav-link:hover,.nav-link[aria-expanded="true"]{color:var(--ink);background:color-mix(in oklch,var(--ink) 5%,transparent)}
          .nav-link[aria-current="page"]{color:var(--ink)}
          .nav-link[aria-current="page"]::after{content:"";position:absolute;left:10px;right:10px;bottom:4px;height:2px;border-radius:2px;background:var(--accent)}
          .dropdown{opacity:0;transform:translateY(-6px);pointer-events:none;visibility:hidden;transition:opacity 150ms var(--ease-exit),transform 150ms var(--ease-exit),visibility 0s linear 150ms}
          .dropdown[data-open="true"]{opacity:1;transform:none;pointer-events:auto;visibility:visible;transition:opacity 200ms var(--ease-out),transform 220ms var(--ease-out),visibility 0s}
          @media (prefers-reduced-motion: reduce){.dropdown,.dropdown[data-open="true"]{transform:none;transition:opacity 1ms,visibility 0s}}
          .mobile-sheet{opacity:0;visibility:hidden;transform:translateY(-8px);transition:opacity 160ms var(--ease-exit),transform 160ms var(--ease-exit),visibility 0s linear 160ms}
          .mobile-sheet[data-open="true"]{opacity:1;visibility:visible;transform:none;transition:opacity 220ms var(--ease-out),transform 220ms var(--ease-out),visibility 0s}
        `}</style>
      </header>
      {/* Outside <header>: its backdrop-filter would otherwise trap this fixed sheet. */}
      <MobileNav
        open={mobileOpen}
        sections={[services, tools, studentTools]}
        isActive={isActive}
        onNavigate={() => setMobileOpen(false)}
      />
    </>
  );
}

function DropdownItem({
  id,
  label,
  href,
  active,
  open,
  setOpen,
  mega = false,
  children,
}: {
  id: MenuId;
  label: string;
  href: string;
  active: boolean;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<null | MenuId>>;
  /** Mega panels span the content width; small dropdowns anchor to their item. */
  mega?: boolean;
  children: React.ReactNode;
}) {
  const panelId = useId();
  const closeTimer = useRef<number | null>(null);
  // True while the panel is open only because the pointer is hovering it.
  const openedByHover = useRef(false);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen((cur) => (cur === id ? null : cur)), 140);
  }, [cancelClose, setOpen, id]);

  return (
    <li
      className={mega ? "static" : "relative"}
      onPointerEnter={(e) => {
        // Hover intent only for mouse/pen; touch uses the toggle button.
        if (e.pointerType === "touch") return;
        cancelClose();
        if (!open) openedByHover.current = true;
        setOpen(id);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") scheduleClose();
      }}
      onFocus={(e) => {
        // Keyboard focus on the trigger opens the menu; mouse clicks don't count.
        const el = e.target as HTMLElement;
        if (el === e.currentTarget.querySelector("a") && el.matches(":focus-visible")) {
          openedByHover.current = false;
          setOpen(id);
        }
      }}
      onBlur={(e) => {
        // Close once focus leaves the trigger and its panel entirely.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen((cur) => (cur === id ? null : cur));
      }}
    >
      <div className="flex items-center">
        <Link href={href} aria-current={active ? "page" : undefined} className="nav-link !pr-1">
          {label}
        </Link>
        <button
          type="button"
          id={`trigger-${id}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            // A click after a hover-open pins the menu instead of closing it.
            if (open && openedByHover.current) {
              openedByHover.current = false;
              return;
            }
            openedByHover.current = false;
            setOpen(open ? null : id);
          }}
          className="nav-link !px-1.5"
        >
          <span className="sr-only">{open ? `Hide ${label} menu` : `Show ${label} menu`}</span>
          <Icon name="chevron" size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div
        id={panelId}
        data-open={open}
        // The transparent top padding bridges the gap between trigger and panel,
        // so moving the pointer down never leaves the item (no flicker).
        className={`dropdown absolute ${mega ? "inset-x-5 top-[calc(100%-14px)] pt-[22px] sm:inset-x-8" : "left-0 top-full pt-2.5"}`}
        onFocus={cancelClose}
      >
        {children}
      </div>
    </li>
  );
}

function MenuItemLink({ item, compact = false }: { item: MenuLink; compact?: boolean }) {
  return (
    <Link href={item.href} className="group/item flex gap-3 rounded-lg p-2 transition-colors duration-150 hover:bg-sunken">
      {item.icon && (
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sunken text-ink-2 transition-colors duration-150 group-hover/item:bg-accent-soft group-hover/item:text-accent-strong">
          <Icon name={item.icon} size={18} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[0.925rem] font-medium leading-snug text-ink">{item.label}</span>
        {item.description && (
          <span className={`mt-0.5 text-[0.8125rem] leading-snug text-muted ${compact ? "line-clamp-1" : "line-clamp-2"}`}>
            {item.description}
          </span>
        )}
      </span>
    </Link>
  );
}

function MegaPanel({ menu }: { menu: MegaMenu }) {
  const cols = menu.groups.length + (menu.featured ? 1 : 0);
  const compact = menu.groups.reduce((n, g) => n + g.items.length, 0) > 8;
  return (
    <div className="card max-h-[calc(100dvh-96px)] overflow-y-auto p-3 shadow-lg">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {menu.groups.map((g) => (
          <div key={g.title} className="p-2">
            <p className="kicker px-2 pb-2">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => (
                <li key={i.href}>
                  <MenuItemLink item={i} compact={compact} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {menu.featured && (
          <div className="p-2">
            <div className="flex h-full flex-col rounded-[12px] bg-night p-5 text-night-ink">
              <p className="font-display text-[1.15rem] font-semibold leading-snug tracking-[-0.015em]">{menu.featured.title}</p>
              <p className="mt-2 text-sm text-night-muted">{menu.featured.body}</p>
              {menu.featured.points && (
                <ul className="mb-auto mt-4 space-y-2 text-sm text-night-muted">
                  {menu.featured.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <Icon name="check" size={15} className="shrink-0 text-accent-night" />
                      {p}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={menu.featured.href}
                className="group/cta mt-6 inline-flex items-center justify-between gap-2 whitespace-nowrap rounded-lg bg-night-2 px-4 py-3 text-sm font-medium text-night-ink shadow-[inset_0_0_0_1px_var(--night-line)] transition-colors hover:bg-[color-mix(in_oklch,var(--night-2)_70%,var(--accent-on-night))] hover:text-white"
              >
                {menu.featured.cta}
                <Icon name="arrow" size={16} className="transition-transform duration-200 group-hover/cta:translate-x-0.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
      {menu.footer && (
        <div className="mt-1 flex items-center justify-between rounded-[10px] bg-sunken px-4 py-3">
          <p className="text-sm text-ink-2">{menu.footer.text}</p>
          <Link href={menu.footer.href} className="arrow-link text-sm text-ink">
            {menu.footer.cta} <Icon name="arrow" size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}

function ProjectsPanel({ items }: { items: MenuLink[] }) {
  return (
    <div className="card w-[420px] p-3 shadow-lg">
      <p className="kicker px-2 pb-2 pt-1">Reference builds</p>
      <ul className="space-y-0.5">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="block rounded-lg p-2 transition-colors duration-150 hover:bg-sunken">
              <span className="block text-[0.925rem] font-medium text-ink">{i.label}</span>
              {i.description && <span className="mt-0.5 line-clamp-1 text-[0.8125rem] text-muted">{i.description}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/projects" className="arrow-link mt-1 flex w-full justify-between rounded-[10px] bg-sunken px-4 py-3 text-sm text-ink">
        View all projects <Icon name="arrow" size={16} />
      </Link>
    </div>
  );
}

function MobileSection({
  menu,
  isActive,
  onNavigate,
}: {
  menu: MegaMenu;
  isActive: (href: string) => boolean;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const cta = menu.featured ?? menu.footer;
  return (
    <li>
      <div className="flex items-center justify-between">
        <Link
          href={menu.href}
          onClick={onNavigate}
          className="flex-1 py-4 font-display text-2xl font-semibold tracking-tight aria-[current=page]:text-accent-strong"
          aria-current={isActive(menu.href) ? "page" : undefined}
        >
          {menu.label}
        </Link>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
          className="grid h-11 w-11 place-items-center rounded-lg hover:bg-sunken"
        >
          <span className="sr-only">{expanded ? `Hide ${menu.label} links` : `Show ${menu.label} links`}</span>
          <Icon name="chevron" size={20} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div id={listId} hidden={!expanded} className="pb-5">
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {menu.groups.map((g) => (
            <div key={g.title}>
              <p className="kicker px-2 pb-1.5">{g.title}</p>
              <ul>
                {g.items.map((s) => (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      onClick={onNavigate}
                      aria-current={isActive(s.href) ? "page" : undefined}
                      className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-ink-2 hover:bg-sunken aria-[current=page]:text-ink"
                    >
                      {s.icon && <Icon name={s.icon} size={18} className="shrink-0 text-muted" />}
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {cta && (
          <Link href={cta.href} onClick={onNavigate} className="arrow-link mt-4 flex justify-between rounded-[10px] bg-sunken px-4 py-3 text-sm text-ink">
            {cta.cta} <Icon name="arrow" size={16} />
          </Link>
        )}
      </div>
    </li>
  );
}

function MobileNav({
  open,
  sections,
  isActive,
  onNavigate,
}: {
  open: boolean;
  sections: MegaMenu[];
  isActive: (href: string) => boolean;
  onNavigate: () => void;
}) {
  const [services, tools, student] = sections;
  const simple = (label: string, href: string) => (
    <li key={href}>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={isActive(href) ? "page" : undefined}
        className="flex items-center justify-between py-4 font-display text-2xl font-semibold tracking-tight aria-[current=page]:text-accent-strong"
      >
        {label}
        <Icon name="arrow" size={18} className="text-muted" />
      </Link>
    </li>
  );
  return (
    <div
      id="mobile-nav"
      data-open={open}
      inert={!open}
      className="mobile-sheet fixed inset-x-0 bottom-0 top-[72px] z-40 overflow-y-auto overscroll-contain bg-bg px-5 pb-10 pt-4 sm:px-8 xl:hidden"
    >
      <nav aria-label="Mobile">
        <ul className="divide-y divide-line border-y border-line">
          <MobileSection menu={services} isActive={isActive} onNavigate={onNavigate} />
          {simple("Projects", "/projects")}
          <MobileSection menu={tools} isActive={isActive} onNavigate={onNavigate} />
          <MobileSection menu={student} isActive={isActive} onNavigate={onNavigate} />
          {plainLinks.map((l) => simple(l.label, l.href))}
        </ul>
      </nav>
      <Link href={site.primaryCta.href} onClick={onNavigate} className="btn mt-8 w-full">
        {site.primaryCta.label}
        <span className="btn-arrow">
          <Icon name="arrow" size={14} strokeWidth={2} />
        </span>
      </Link>
    </div>
  );
}
