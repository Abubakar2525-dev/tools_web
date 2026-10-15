# SEO and content plan

## Keyword map (one primary intent per page)

These keywords were chosen for **relevance and search intent**. Search volume and difficulty were not measured, because no keyword tool was available while the site was built. Check them in Google Search Console, Ahrefs/Semrush or Google Keyword Planner before investing further, and re-map pages as real query data comes in.

| URL | Primary intent | Secondary terms used naturally |
|---|---|---|
| `/` | AI engineering services | custom AI development company, production-ready AI applications, AI system integration |
| `/services` | AI engineering services (overview) | enterprise AI solutions, AI development services |
| `/services/ai-application-development` | AI application development | LLM application development, custom AI development |
| `/services/ai-agent-development` | AI agent development services | agentic workflows, AI agents with human approval |
| `/services/rag-development` | RAG development services | RAG application development, retrieval-augmented generation |
| `/services/llm-integration` | LLM integration services | large language model integration, LLM engineering |
| `/services/ai-workflow-automation` | AI workflow automation | AI process automation, document automation |
| `/services/data-engineering-for-ai` | data engineering for AI | AI data pipelines, data readiness |
| `/services/custom-software-development` | custom software development | web application development, internal tools |
| `/services/ai-deployment-and-monitoring` | LLM monitoring and deployment | LLMOps, AI observability, LLM evaluation |
| `/projects` | AI reference architectures | RAG architecture example, AI agent architecture |
| `/tools` | free online developer tools | json formatter online, sql query formatter, regex tester |
| `/tools/*` | One tool intent per page (see `primaryKeyword` in `src/content/tools-engineering.ts`) | |
| `/student-tools` | free student tools | writing, citation, STEM, grade, productivity and developer tools |
| `/student-tools/category/*` | One student subject per page | 15 verified subject categories |
| `/student-tools/*` | One tool intent per page (see `src/content/student-reference.json`) | 177 reference-aligned tools plus original utilities |
| `/student-tools/resources` | AI / software engineering learning roadmap | study guides, project ideas for students, interview prep |
| `/articles/*` | One long-tail informational query per article (see `primaryKeyword` in each article file) | |

The source of truth for each page's target is the `primaryKeyword` / `secondaryKeywords` field in `src/content/services.ts` and `src/content/articles/*.ts`.

## Technical SEO already in place

- Static generation for every content route, with real HTTP 404s for unknown slugs (`src/proxy.ts`) and `noindex` on 404 pages.
- A unique `<title>`, meta description, canonical URL, Open Graph and Twitter tags on every page (`src/lib/seo.ts`).
- A generated Open Graph image per service, project and article (`opengraph-image.tsx`).
- JSON-LD: Organization and WebSite (site-wide), BreadcrumbList, Service, FAQPage, BlogPosting, ItemList and CollectionPage. It uses only real data: no ratings, reviews or invented addresses.
- `sitemap.xml` (49 URLs) and `robots.txt`. Robots blocks all crawlers unless `NEXT_PUBLIC_SITE_ENV=production`, so preview deployments stay out of the index.
- One H1 per page, sequential headings, breadcrumbs on inner pages and crawlable `<a href>` navigation (dropdowns are progressive enhancements over real links).

## Editorial plan (next 12 articles)

Each article should answer one practical question, include working code or a concrete checklist, and link to one relevant service page.

| # | Working title | Category | Target query (to validate) |
|---|---|---|---|
| 1 | Chunking strategies for RAG: structure-aware vs fixed-size | RAG | RAG chunking strategy |
| 2 | Permission-aware retrieval: carrying ACLs into your vector index | RAG | RAG access control |
| 3 | Building a golden dataset from support tickets | LLM Engineering | LLM evaluation dataset |
| 4 | When to fine-tune and when to improve retrieval | LLM Engineering | fine-tuning vs RAG |
| 5 | Structured outputs in production: schemas, retries and validation | LLM Engineering | LLM structured output |
| 6 | Human-in-the-loop approval queues for AI agents | Agents | human in the loop AI agent |
| 7 | MCP servers for internal tools: a security checklist | Agents | MCP server security |
| 8 | Tracing LLM applications with OpenTelemetry | Production | LLM observability OpenTelemetry |
| 9 | Regression-testing prompts in CI | Production | prompt regression testing |
| 10 | Extracting tables from PDFs for AI pipelines | Data | PDF table extraction for LLM |
| 11 | Estimating the cost of an LLM feature before you build it | LLM Engineering | LLM cost estimation |
| 12 | Choosing between hosted and open-weight models | LLM Engineering | open-weight vs API LLM |

To publish one, add a file in `src/content/articles/`, register it in `src/content/articles/index.ts`, and the listing page, sitemap, OG image, reading time, table of contents and JSON-LD all update automatically.

## What only you can supply

Rankings depend on authority and real proof as much as on technical SEO. The biggest gains will come from adding:

1. Real client case studies (with permission) using `kind: "client"` in `src/content/projects.ts`.
2. Real team profiles with genuine credentials on `/about`.
3. A verified business email, profiles in `site.social`, and a Google Business Profile if you serve a local market.
