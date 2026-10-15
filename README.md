# Nuvella Promo Code: AI engineering studio website

A marketing site for an AI engineering and software studio. The UI is built with Next.js 16 (App Router, Cache Components), React 19, TypeScript and Tailwind CSS v4. A small FastAPI service owns server-side contact validation and delivery. The site has no UI or animation libraries; motion is CSS plus one small IntersectionObserver.

> **"Nuvella Promo Code" is a placeholder brand.** Replace the name, URL and contact details in `src/content/site.ts` before launch.

## Run it

Install the web and API dependencies (Python 3.11 or newer is required):

```bash
npm install
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r backend/requirements.txt
```

Run the two processes in separate terminals:

```bash
npm run dev:api    # FastAPI on http://localhost:8000
npm run dev:web    # Next.js on http://localhost:3000
```

The visible website and form URL remain unchanged. Next.js accepts `/api/contact` and forwards it to FastAPI over `PYTHON_API_URL`.

Production checks and processes:

```bash
npm run build      # Next.js production build and type-check
npm run lint
npm run test:api   # Python validation tests
npm run start      # Next.js production server
npm run start:api  # FastAPI production process
```

The API can also run as a container:

```bash
docker build -t backendz-api backend
docker run --env-file .env.local -p 8000:8000 backendz-api
```

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for canonicals, sitemap, OG and JSON-LD. **Required in production.** |
| `NEXT_PUBLIC_SITE_ENV` | Set to `production` only on the live site. Any other value serves `Disallow: /`. |
| `PYTHON_API_URL` | Internal FastAPI origin used by the Next.js contact proxy. Defaults to `http://127.0.0.1:8000`. |
| `CONTACT_WEBHOOK_URL` | Receives contact-form inquiries as JSON (Slack, Zapier, Make, CRM). |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | Optional email delivery through Resend. |

If no delivery channel is configured, the contact form tells the visitor that the message was **not** sent. It never shows a fake success.

## Where things live

```
src/content/        All copy and data (edit here, not in components)
  site.ts           Brand, URL, contact, nav            ← EDIT ME before launch
  home.ts           Commitments, process, tech, principles, FAQs
  services.ts       8 service pages (SEO fields, FAQs, stack)
  projects.ts       4 reference builds (illustrative, labelled as such)
  articles/         6 articles + index (reading time, TOC)
  tools-engineering.ts, tools-student.ts   Tool page content (SEO, how-to, FAQs)
  student-resources.ts                    Roadmaps, guides, curated external links
  tools.ts          Tool index, sections and helpers
src/app/            Routes, metadata, sitemap, robots, OG images, API proxy
src/components/     Layout (header/footer), UI primitives, home, articles, contact
src/components/tools/  kit.tsx (shared tool UI + localStorage hook), registry.tsx,
                       engineering/*.tsx and student/*.tsx (one client component per tool)
src/lib/            SEO helpers + JSON-LD builders, contact validation, OG renderer
src/proxy.ts        Returns real 404s for unknown slugs
backend/app/        FastAPI endpoint, validation, rate limiting and delivery
backend/tests/      Python backend tests
docs/SEO-AND-CONTENT.md  Keyword map, technical SEO notes, editorial plan
```

## Engineering tools and student tools

- `/tools`: 10 developer utilities (prompt builder, JSON, regex, SQL, tokens, API requests, Markdown, Base64, AI use-case planner, RAG readiness checklist).
- `/student-tools`: 177 reference-aligned student tools across 15 categories, backed by the tested browser engines in `/tools`, plus four original student utilities and `/student-tools/resources`.
- `src/content/student-reference.json` is the verified route-to-engine map. `docs/STUDENT-TOOLS-INVENTORY.md` records every student route and its working engine.
- Every tool runs entirely in the browser. Planners save to `localStorage` only (keys prefixed `stratum:`). Nothing is sent to a server, and no tool calls an AI model.
- To add a tool, add its content entry to `src/content/tools-*.ts`, build the component in `src/components/tools/<kind>/<slug>.tsx` using `kit.tsx`, and register it in `registry.tsx`. The directory, sitemap, OG image, JSON-LD and 404 handling update automatically.

## Design system

- **Tokens** are in `src/app/globals.css` (`:root`, mapped into Tailwind via `@theme`): faintly cool neutrals, charcoal "night" bands and one jade accent. Components use semantic tokens only.
- **Type**: Bricolage Grotesque for display, Geist for body, Geist Mono for technical labels, all loaded through `next/font`.
- **Signature visual**: the hero "strata" diagram (`src/components/home/StrataDiagram.tsx`), a request trace descending through the five layers of a production AI system. The logo mark uses the same layers.
- **Motion**: CSS entrances, reveal-on-scroll (`data-reveal`), SVG trace and stroke drawing, a scroll-linked process rail and reading progress, and native `<details>` accordions. Everything respects `prefers-reduced-motion`, and content stays visible without JavaScript.

## Originality and asset record

All copy, illustrations, icons, the logo and the diagrams were created for this project. No images, text or code were copied from the reference site. Third-party assets:

| Asset | Source | License |
|---|---|---|
| Bricolage Grotesque | Google Fonts via `next/font` | SIL Open Font License 1.1 |
| Geist, Geist Mono | Google Fonts via `next/font` | SIL Open Font License 1.1 |

There is no stock photography. Do a final rights review before launch, especially of the brand name.

## Placeholders to replace before launch

- `src/content/site.ts`: brand name, legal name, URL, email and social accounts (hidden while `null`).
- `src/content/home.ts`: the commitments and technology list. Keep only what is true for your business.
- `src/app/about/page.tsx`: add real founding details and team members when ready.
- `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`: template text. Have them reviewed for your jurisdiction.
- `src/content/projects.ts`: replace or add real client work with `kind: "client"` once you have permission to publish it.
