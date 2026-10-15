import type { Service } from "./types";
import { businessServices } from "./business-services";

const coreServices: Service[] = [
  {
    slug: "ai-application-development",
    title: "AI application development",
    navLabel: "AI applications",
    group: "Build",
    icon: "app",
    metaTitle: "AI application development for real products",
    metaDescription:
      "AI application development from first prototype to production: product-grade interfaces, measured model behavior and code your own team can maintain.",
    primaryKeyword: "AI application development",
    secondaryKeywords: [
      "AI app development company",
      "LLM application development",
      "generative AI product development",
      "build an AI-powered application",
    ],
    h1: "AI application development that holds up with real users",
    summary:
      "Product-grade applications built around language models, with evaluation, sensible fallbacks and an architecture your engineers can own.",
    intro:
      "Getting a model to produce a good answer in a notebook is the easy part. The work is in everything around it: interfaces that set expectations, handling for slow or wrong responses, and a way to tell whether a change made things better. We build that whole application, not just the prompt.",
    problems: [
      {
        title: "The demo works, the product doesn't",
        body: "A prototype that impressed in a meeting falls apart on messy inputs, long sessions or concurrent users. Nobody planned for timeouts, partial answers or empty states.",
      },
      {
        title: "Quality is judged by gut feel",
        body: "Prompt and model changes ship because a few manual tries looked fine. Without a repeatable test set, regressions surface through customer complaints.",
      },
      {
        title: "Model calls scattered through the codebase",
        body: "Provider SDK calls live in route handlers and UI components, so swapping a model or adding logging means touching dozens of files.",
      },
      {
        title: "No idea what a user costs",
        body: "Token usage grows with adoption, but nobody can say which features drive spend or whether pricing covers it.",
      },
    ],
    deliverables: [
      "Production web application with streaming responses and error states",
      "Isolated model layer with typed inputs and outputs",
      "Evaluation suite built from realistic user scenarios",
      "Per-feature cost and latency tracking",
      "Architecture notes and a walkthrough for your engineers",
    ],
    approach: [
      {
        title: "Frame the use case",
        body: "We pin down who the user is, what a good result looks like for them and where the model should not be trusted. This becomes the first draft of the evaluation set.",
      },
      {
        title: "Ship a thin slice",
        body: "One end-to-end path goes live in a staging environment early, so design and engineering decisions are made against real behavior rather than assumptions.",
      },
      {
        title: "Measure and harden",
        body: "We expand test coverage, add fallbacks for failures and slow responses, and tune prompts or model choice against the evaluation results.",
      },
      {
        title: "Launch and hand over",
        body: "Release goes out behind feature flags with monitoring in place. Your team gets documentation and paired sessions so they can extend it confidently.",
      },
    ],
    stack: [
      "TypeScript",
      "Next.js",
      "Python",
      "FastAPI",
      "PostgreSQL",
      "Vercel AI SDK",
      "OpenAI API",
      "Anthropic Claude API",
      "Langfuse",
      "Docker",
    ],
    integrations: [
      "Auth providers (Auth0, Clerk, Okta)",
      "Stripe",
      "Product analytics (PostHog, Segment)",
      "Slack",
      "Postgres / data warehouses",
    ],
    faqs: [
      {
        q: "Can you take over a prototype we already built?",
        a: "Yes, and that is a common starting point. We review what exists, keep the parts that are sound and restructure the rest so it can be tested and monitored. Sometimes a partial rewrite is cheaper than patching, and we will say so plainly.",
      },
      {
        q: "Which model provider should we use?",
        a: "It depends on the task, your data constraints and your budget. We usually test two or three candidates against your evaluation set and design the model layer so switching later is a configuration change rather than a rebuild.",
      },
      {
        q: "How long does a first release take?",
        a: "That typically depends on scope, integrations and how settled the product requirements are. A focused first release with one core workflow often takes a few weeks, with further features added in short cycles after that.",
      },
      {
        q: "Will the application ever give wrong answers?",
        a: "Language models can be wrong, and no amount of engineering removes that entirely. What we can do is reduce how often it happens, make uncertainty visible to users and design the product so mistakes are easy to catch and correct.",
      },
    ],
    relatedProjects: ["support-knowledge-assistant", "llm-evaluation-console"],
    relatedArticles: [
      "reducing-llm-latency-and-cost",
      "prompt-injection-defense-checklist",
    ],
  },
  {
    slug: "ai-agent-development",
    title: "AI agent development",
    navLabel: "AI agents",
    group: "Build",
    icon: "agent",
    metaTitle: "AI agent development with guardrails",
    metaDescription:
      "AI agent development services for multi-step business tasks, with scoped tool access, human approval points and full traces of every decision an agent makes.",
    primaryKeyword: "AI agent development services",
    secondaryKeywords: [
      "custom AI agents for business",
      "LLM agent development",
      "agentic workflow engineering",
      "tool-using AI agents",
    ],
    h1: "AI agent development with clear limits and human oversight",
    summary:
      "Agents that plan and act across your tools, with narrow permissions, approval checkpoints and traces you can actually read.",
    intro:
      "An agent is a model that decides which action to take next, which makes it powerful and also harder to predict. We build agents for tasks where that flexibility earns its keep, and we constrain them carefully everywhere else. Every agent we ship can explain what it did and stop when it should.",
    problems: [
      {
        title: "Agents that loop or wander",
        body: "Open-ended agents can repeat the same tool call, chase irrelevant leads or run up large bills on a single request. Without step limits and clear exit conditions, behavior is hard to bound.",
      },
      {
        title: "Broad access, weak control",
        body: "Giving an agent a general API key to your CRM or ticketing system means any mistake or injected instruction can write real data.",
      },
      {
        title: "Failures nobody can explain",
        body: "When a ten-step run goes wrong, teams often have only the final output to inspect. Debugging becomes guesswork.",
      },
      {
        title: "Unclear role for people",
        body: "It is rarely obvious which decisions an agent should make alone and which need a person to confirm, so teams either over-trust or abandon the tool.",
      },
    ],
    deliverables: [
      "Agent runtime with explicit state, step limits and retries",
      "Purpose-built tools with least-privilege credentials",
      "Approval steps for irreversible or high-impact actions",
      "Run traces covering prompts, tool calls and outcomes",
      "Adversarial test scenarios, including prompt injection cases",
    ],
    approach: [
      {
        title: "Map the task",
        body: "We break the job into decisions and actions, then mark which ones need judgment from a model and which are better handled by ordinary code.",
      },
      {
        title: "Design tools and permissions",
        body: "Each tool does one thing with the narrowest access possible. Destructive or external actions are routed through confirmation by default.",
      },
      {
        title: "Build with checkpoints",
        body: "The agent runs as an explicit state graph, so runs can pause for review, resume after failure and be replayed during debugging.",
      },
      {
        title: "Test the failure modes",
        body: "We run the agent against ambiguous requests, broken tools and hostile content before release, then tighten limits based on what we observe.",
      },
    ],
    stack: [
      "Python",
      "LangGraph",
      "Anthropic Claude API",
      "OpenAI API",
      "Model Context Protocol (MCP)",
      "Temporal",
      "PostgreSQL",
      "Langfuse",
      "Docker",
    ],
    integrations: [
      "Salesforce",
      "HubSpot",
      "Jira",
      "Google Workspace / Microsoft 365",
      "Slack",
      "Internal REST APIs",
    ],
    faqs: [
      {
        q: "Do we actually need an agent, or would a workflow do?",
        a: "Often a fixed workflow with one or two model calls is cheaper, faster and easier to trust. We recommend an agent only when the sequence of steps genuinely varies from case to case, and we will tell you if a simpler design fits better.",
      },
      {
        q: "How do you stop an agent from taking harmful actions?",
        a: "Through layered limits: scoped credentials, tool-level validation, step and spend caps, and human approval for anything irreversible. These controls reduce risk substantially, but they work best alongside monitoring rather than as a one-time setup.",
      },
      {
        q: "Can agents work with our internal systems?",
        a: "Yes, through tools we write against your APIs or databases, or through MCP servers where that suits your environment. We prefer read-only access first and add write actions once behavior has been observed in practice.",
      },
      {
        q: "What does it take to get a first agent running?",
        a: "Timing typically depends on how many systems the agent touches and how well defined the task is. A focused first agent covering one task often takes a few weeks, followed by a supervised pilot before wider rollout.",
      },
    ],
    relatedProjects: ["contract-review-agent", "invoice-intake-automation"],
    relatedArticles: [
      "designing-ai-agents-that-fail-safely",
      "prompt-injection-defense-checklist",
    ],
  },
  {
    slug: "rag-development",
    title: "Retrieval-augmented generation (RAG)",
    navLabel: "RAG systems",
    group: "Build",
    icon: "rag",
    metaTitle: "RAG development services for your documents",
    metaDescription:
      "RAG development services that answer from your own documents with citations, hybrid search and evaluation against real questions before anything launches.",
    primaryKeyword: "RAG development services",
    secondaryKeywords: [
      "retrieval-augmented generation",
      "enterprise RAG system",
      "document question answering",
      "knowledge base chatbot development",
    ],
    h1: "RAG development grounded in your own documents",
    summary:
      "Question answering over your internal knowledge, with tuned retrieval, cited sources and measured accuracy before launch.",
    intro:
      "Most RAG problems are retrieval problems: the right passage never reaches the model, so the answer is vague or invented. We focus first on getting the right content in front of the model, then on making answers traceable to their sources. Grounding reduces hallucination considerably, though it does not eliminate it, so we design for verification too.",
    problems: [
      {
        title: "Answers with no visible source",
        body: "Users cannot tell whether a response came from policy documents or the model's general knowledge, so they either ignore it or trust it blindly.",
      },
      {
        title: "Search misses the obvious document",
        body: "Pure vector search struggles with product codes, names and exact phrases. The answer exists in your corpus but never gets retrieved.",
      },
      {
        title: "Outdated and conflicting content",
        body: "Several versions of the same policy sit side by side, and the system has no way to prefer the current one.",
      },
      {
        title: "Permissions get flattened",
        body: "Indexing everything into one store can expose documents to people who could not open them in the original system.",
      },
    ],
    deliverables: [
      "Ingestion pipeline with document parsing and chunking tuned to your content",
      "Hybrid retrieval with keyword search, vectors and reranking",
      "Answer generation with inline citations",
      "Access control that mirrors source-system permissions",
      "Evaluation set and report covering retrieval and answer quality",
    ],
    approach: [
      {
        title: "Audit the corpus",
        body: "We look at what documents exist, how they are structured, how often they change and who is allowed to see them. This shapes parsing and chunking decisions.",
      },
      {
        title: "Get retrieval right",
        body: "Before writing generation prompts, we measure whether the correct passages come back for real questions, and tune indexing, filters and reranking until they do.",
      },
      {
        title: "Evaluate with real questions",
        body: "We collect questions from the people who will use the system and score both retrieval hit rate and answer faithfulness against them.",
      },
      {
        title: "Ship with citations",
        body: "Answers link back to source passages, low-confidence cases say so, and feedback from users flows into the next round of evaluation.",
      },
    ],
    stack: [
      "Python",
      "FastAPI",
      "PostgreSQL",
      "pgvector",
      "Qdrant",
      "OpenSearch",
      "Cohere Rerank",
      "OpenAI API",
      "Anthropic Claude API",
      "Ragas",
    ],
    integrations: [
      "SharePoint",
      "Confluence",
      "Google Drive",
      "Zendesk",
      "Notion",
      "Postgres / data warehouses",
    ],
    faqs: [
      {
        q: "Will RAG stop the model from making things up?",
        a: "It reduces fabrication by giving the model relevant text to work from, but it does not remove it. We add citations, faithfulness checks and clear fallback answers so that when the system is unsure, users can see that.",
      },
      {
        q: "Do we need a dedicated vector database?",
        a: "Not always. For many corpora, PostgreSQL with pgvector is enough and keeps your infrastructure simple. We move to a dedicated store like Qdrant when scale, filtering needs or latency targets justify it.",
      },
      {
        q: "How do you handle scanned PDFs and tables?",
        a: "Parsing quality matters a great deal here, so we test several extraction approaches on a sample of your documents. Tables and forms often need specific handling, and some content may need cleanup at the source to be reliable.",
      },
      {
        q: "How long until we have something usable?",
        a: "That typically depends on corpus size, document quality and how many source systems are involved. A focused first release over one well-defined collection often takes a few weeks, with more sources added once the evaluation looks healthy.",
      },
    ],
    relatedProjects: ["support-knowledge-assistant"],
    relatedArticles: [
      "evaluating-rag-before-launch",
      "hybrid-retrieval-for-business-documents",
    ],
  },
  {
    slug: "llm-integration",
    title: "LLM integration and engineering",
    navLabel: "LLM integration",
    group: "Integrate",
    icon: "llm",
    metaTitle: "LLM integration services for existing products",
    metaDescription:
      "LLM integration services that add language model features to your existing product, with structured outputs, provider flexibility and controlled data flows.",
    primaryKeyword: "LLM integration services",
    secondaryKeywords: [
      "integrate LLM into existing software",
      "OpenAI API integration",
      "Claude API integration",
      "LLM engineering consulting",
    ],
    h1: "LLM integration services that fit your existing stack",
    summary:
      "Language model features added to the software you already run, with typed outputs, provider abstraction and careful data handling.",
    intro:
      "You may not need a new application at all. Often the right move is a well-placed model call inside a product or internal system you already have: classifying tickets, drafting replies, extracting fields from text. We engineer those integrations so they behave like any other dependency, with contracts, tests and observability.",
    problems: [
      {
        title: "Locked into one provider by accident",
        body: "Code written directly against a single vendor's SDK makes it painful to compare models, negotiate pricing or respond to an outage.",
      },
      {
        title: "Free text breaks downstream code",
        body: "Model responses that are almost JSON, or that change shape between calls, cause brittle parsing and silent data errors.",
      },
      {
        title: "Latency and cost surprises",
        body: "A feature that felt fast in testing adds seconds to a critical path in production, and the monthly invoice arrives larger than anyone forecast.",
      },
      {
        title: "Sensitive data crossing boundaries",
        body: "Customer records and internal notes get sent to external APIs without anyone deciding whether that is acceptable.",
      },
    ],
    deliverables: [
      "Provider-agnostic model gateway with routing and retries",
      "Schema-validated structured outputs",
      "Caching and batching where they reduce cost or latency",
      "Data redaction rules for sensitive fields",
      "Integration tests and a runbook for your team",
    ],
    approach: [
      {
        title: "Review integration points",
        body: "We trace where model output will flow in your system and what breaks if it is slow, malformed or wrong. That defines the reliability bar for each call.",
      },
      {
        title: "Define the contracts",
        body: "Inputs and outputs get explicit schemas, so the rest of your codebase treats the model like a typed service rather than a text generator.",
      },
      {
        title: "Build the gateway",
        body: "A thin layer handles provider selection, timeouts, retries, redaction and logging in one place instead of at every call site.",
      },
      {
        title: "Tune and document",
        body: "We compare models on your actual tasks, choose the cheapest one that meets quality needs, and write down why.",
      },
    ],
    stack: [
      "Python",
      "TypeScript",
      "OpenAI API",
      "Anthropic Claude API",
      "Azure OpenAI",
      "Amazon Bedrock",
      "LiteLLM",
      "Pydantic",
      "Redis",
      "OpenTelemetry",
    ],
    integrations: [
      "Salesforce",
      "Zendesk",
      "Slack",
      "Internal REST and GraphQL APIs",
      "Message queues (Kafka, SQS)",
      "Postgres / data warehouses",
    ],
    faqs: [
      {
        q: "Can you work inside our existing codebase?",
        a: "Yes. Most integration work happens in your repositories, following your conventions and review process. We keep the model-related code in a clearly bounded module so it stays easy to reason about after we leave.",
      },
      {
        q: "Can our data stay within our cloud account?",
        a: "In many cases, yes. Options such as Azure OpenAI, Amazon Bedrock or self-hosted open-weight models keep traffic within your cloud environment. Each comes with trade-offs in model choice and operations, which we lay out before you decide.",
      },
      {
        q: "How do you make outputs reliable enough for automation?",
        a: "We use structured output modes, validate every response against a schema and define what happens when validation fails. For decisions with real consequences, we also add confidence thresholds and route uncertain cases to a person.",
      },
      {
        q: "How quickly can a first integration go live?",
        a: "That typically depends on how many systems are involved and how strict your review and security processes are. A single well-scoped integration often takes a few weeks from design to production.",
      },
    ],
    relatedProjects: ["llm-evaluation-console"],
    relatedArticles: [
      "reducing-llm-latency-and-cost",
      "prompt-injection-defense-checklist",
    ],
  },
  {
    slug: "ai-workflow-automation",
    title: "AI workflow automation",
    navLabel: "Workflow automation",
    group: "Integrate",
    icon: "workflow",
    metaTitle: "AI workflow automation for operations teams",
    metaDescription:
      "AI workflow automation for document-heavy operations: intake, classification and routing, with review queues for exceptions and an audit trail for each step.",
    primaryKeyword: "AI workflow automation",
    secondaryKeywords: [
      "AI process automation",
      "intelligent document processing",
      "automate business workflows with AI",
      "human-in-the-loop automation",
    ],
    h1: "AI workflow automation that keeps people in control",
    summary:
      "Repetitive, judgment-light operations work handled by durable workflows, with exceptions routed to people and every decision logged.",
    intro:
      "Plenty of operational work sits between rigid rules and real expertise: reading an email to decide where it goes, pulling fields from an invoice, checking a form against policy. Models handle that middle ground well when the surrounding workflow is solid. We build the workflow first and place model steps only where they help.",
    problems: [
      {
        title: "Inbound documents triaged by hand",
        body: "Staff spend hours opening attachments, retyping fields and forwarding items to the right queue. The work is necessary but rarely needs their expertise.",
      },
      {
        title: "Rule-based automation hit its limit",
        body: "Existing scripts break whenever a supplier changes a template or a customer phrases a request differently.",
      },
      {
        title: "Decisions leave no trail",
        body: "When something goes wrong, nobody can reconstruct what the automation saw, what it decided and why.",
      },
      {
        title: "Exceptions disappear quietly",
        body: "Items that do not fit the happy path end up in a forgotten folder instead of in front of someone who can resolve them.",
      },
    ],
    deliverables: [
      "Durable workflows with retries and resumable steps",
      "Model-based extraction and classification with confidence scores",
      "Review queue for low-confidence and exception cases",
      "Step-level audit log for every processed item",
      "Operational dashboard showing volumes and backlog",
    ],
    approach: [
      {
        title: "Shadow the process",
        body: "We sit with the people doing the work today, collect real samples and note where decisions are routine and where they need context.",
      },
      {
        title: "Separate routine from judgment",
        body: "Deterministic steps stay in ordinary code. Model calls are reserved for reading unstructured input, and each one has a defined fallback.",
      },
      {
        title: "Build with review built in",
        body: "Thresholds decide what proceeds automatically and what goes to a person, and reviewers' corrections are captured for future evaluation.",
      },
      {
        title: "Run in parallel first",
        body: "The automation runs alongside the manual process for a period, so differences can be compared before anyone relies on it.",
      },
    ],
    stack: [
      "Python",
      "Temporal",
      "n8n",
      "FastAPI",
      "PostgreSQL",
      "AWS Textract",
      "OpenAI API",
      "Anthropic Claude API",
      "Docker",
    ],
    integrations: [
      "Email (Gmail, Outlook)",
      "ERP systems (NetSuite, SAP)",
      "Accounting tools (QuickBooks, Xero)",
      "Google Workspace / Microsoft 365",
      "Slack",
      "Postgres / data warehouses",
    ],
    faqs: [
      {
        q: "Which processes are good candidates for automation?",
        a: "High-volume tasks with clear inputs, a definable notion of correct and a tolerable cost of occasional errors tend to work well. Processes that change weekly or depend on unwritten context are usually better left manual or only partly automated.",
      },
      {
        q: "What happens when the model gets something wrong?",
        a: "Low-confidence results go to a review queue rather than straight through, and validation rules catch many errors before they reach other systems. Some mistakes will still pass, which is why we keep the audit trail and sample completed items for checking.",
      },
      {
        q: "Do you use low-code tools or custom code?",
        a: "Both, depending on the job. Tools like n8n suit simpler flows your team wants to edit directly, while Temporal and custom code fit long-running or high-volume processes that need stronger guarantees.",
      },
      {
        q: "How long does it take to automate one workflow?",
        a: "That typically depends on the number of systems involved, document variety and how much parallel running you want before switching over. A focused first workflow often takes a few weeks to build, plus a supervised parallel period.",
      },
    ],
    relatedProjects: ["invoice-intake-automation", "contract-review-agent"],
    relatedArticles: [
      "designing-ai-agents-that-fail-safely",
      "data-readiness-for-ai",
    ],
  },
  {
    slug: "data-engineering-for-ai",
    title: "Data engineering for AI",
    navLabel: "Data engineering",
    group: "Integrate",
    icon: "data",
    metaTitle: "Data engineering for AI and LLM systems",
    metaDescription:
      "Data engineering for AI: pipelines that collect, clean and version the documents and records your models depend on, with lineage, freshness and quality checks.",
    primaryKeyword: "data engineering for AI",
    secondaryKeywords: [
      "AI data pipelines",
      "data preparation for LLMs",
      "AI data readiness",
      "document ingestion pipeline",
    ],
    h1: "Data engineering for AI that models can rely on",
    summary:
      "Pipelines that gather, clean and govern the data behind your AI systems, so answers reflect current, permitted information.",
    intro:
      "Model quality is capped by the data it sees. If your knowledge sits in a dozen systems, half of it outdated, no prompt will fix that. We build the pipelines, models and checks that turn scattered records and documents into inputs an AI system can depend on.",
    problems: [
      {
        title: "Knowledge spread across systems",
        body: "Product details live in one tool, policies in another and customer history in a third, with no shared identifiers between them.",
      },
      {
        title: "No lineage or freshness signal",
        body: "Nobody can say when a record was last updated or which upstream source it came from, so stale data reaches users unnoticed.",
      },
      {
        title: "Formats models struggle with",
        body: "Scanned PDFs, spreadsheets with merged cells and slide decks need real parsing work before they are useful as model input.",
      },
      {
        title: "Personal data in the wrong place",
        body: "Copies of sensitive records end up in indexes and logs that were never reviewed for privacy or retention.",
      },
    ],
    deliverables: [
      "Data readiness assessment with prioritized gaps",
      "Ingestion and transformation pipelines with scheduling",
      "Document parsing and normalization for unstructured sources",
      "Automated quality, freshness and schema checks",
      "PII handling rules and documented lineage",
    ],
    approach: [
      {
        title: "Assess readiness",
        body: "We inventory sources, owners, update frequency and sensitivity, then rank which gaps actually block the AI use case you care about.",
      },
      {
        title: "Model and pipe",
        body: "Data is pulled into a clear set of tables and document stores, with transformations defined as versioned code rather than one-off scripts.",
      },
      {
        title: "Add quality gates",
        body: "Tests check for missing fields, duplicates, schema drift and stale sources, and failures block downstream jobs instead of passing bad data along.",
      },
      {
        title: "Operate and document",
        body: "Pipelines run on a scheduler with alerting, and your team receives lineage diagrams and ownership notes for each dataset.",
      },
    ],
    stack: [
      "Python",
      "dbt",
      "Airflow",
      "Dagster",
      "PostgreSQL",
      "Snowflake",
      "BigQuery",
      "Apache Spark",
      "Unstructured",
      "Great Expectations",
    ],
    integrations: [
      "Postgres / data warehouses",
      "Salesforce",
      "SharePoint",
      "Confluence",
      "Object storage (S3, GCS, Azure Blob)",
      "SaaS connectors via Fivetran or Airbyte",
    ],
    faqs: [
      {
        q: "Do we need a data warehouse before starting an AI project?",
        a: "Not necessarily. Many AI use cases can start from a small, well-defined set of sources. We help you decide whether a warehouse is worth it now or whether a narrower pipeline gets you to a useful first version sooner.",
      },
      {
        q: "Can you work with our existing data team?",
        a: "Yes, and we prefer to. We follow your existing tooling and conventions where they are sound, and focus on the parts specific to AI workloads, such as document parsing, chunking and embedding refresh.",
      },
      {
        q: "How do you handle personal or regulated data?",
        a: "We classify sensitive fields early, then decide per use case whether to exclude, mask or tokenize them. Retention and access rules are built into the pipelines, though final compliance decisions remain with your legal and security teams.",
      },
      {
        q: "How long does it take to make data AI-ready?",
        a: "That typically depends on the number of sources, their quality and how much cleanup must happen upstream. A focused pipeline feeding one use case often takes a few weeks, with broader coverage added incrementally.",
      },
    ],
    relatedProjects: ["support-knowledge-assistant", "invoice-intake-automation"],
    relatedArticles: [
      "data-readiness-for-ai",
      "hybrid-retrieval-for-business-documents",
    ],
  },
  {
    slug: "custom-software-development",
    title: "Custom software development",
    navLabel: "Custom software",
    group: "Build",
    icon: "code",
    metaTitle: "Custom software development for AI products",
    metaDescription:
      "Custom software development for teams building AI products: web platforms, internal tools and APIs designed for change, tested properly and documented well.",
    primaryKeyword: "custom software development",
    secondaryKeywords: [
      "custom web application development",
      "internal tools development",
      "software development partner",
      "API development services",
    ],
    h1: "Custom software development built to be maintained",
    summary:
      "Web platforms, internal tools and APIs engineered with the same care as the AI features they often sit beside.",
    intro:
      "An AI feature is usually a small part of a larger product: accounts, billing, permissions, admin screens and integrations make up most of the code. We build that surrounding software with the same discipline, so the whole system is something your team can extend rather than work around.",
    problems: [
      {
        title: "Internal tools that were outgrown",
        body: "Spreadsheets and quick scripts that once worked now block the team, but nobody has time to replace them properly.",
      },
      {
        title: "An AI feature with no product",
        body: "A working model capability needs authentication, roles, billing and an admin view before customers can use it.",
      },
      {
        title: "A legacy system holding things back",
        body: "Older software is too risky to change and too important to switch off, so every new initiative routes around it.",
      },
      {
        title: "A codebase nobody wants to touch",
        body: "Missing tests and unclear structure mean small changes take days and carry real risk of breaking something unrelated.",
      },
    ],
    deliverables: [
      "Production application with tests and CI pipeline",
      "Documented APIs with versioning",
      "Role-based access control and audit logging",
      "Infrastructure defined as code",
      "Architecture decision records and onboarding guide",
    ],
    approach: [
      {
        title: "Discovery and architecture",
        body: "We clarify requirements with the people who will use the system, then choose the simplest architecture that meets them, with decisions written down.",
      },
      {
        title: "Deliver in increments",
        body: "Work ships in small, reviewable pieces to a shared environment, so you see progress and can redirect priorities without waste.",
      },
      {
        title: "Build quality in",
        body: "Automated tests, code review and type checking run on every change. Performance and security checks happen during development, not after.",
      },
      {
        title: "Hand over properly",
        body: "Your engineers get access to everything from day one, plus walkthroughs and documentation so ownership transfers without a cliff.",
      },
    ],
    stack: [
      "TypeScript",
      "Next.js",
      "React",
      "Node.js",
      "Python",
      "FastAPI",
      "PostgreSQL",
      "Redis",
      "Docker",
      "GitHub Actions",
    ],
    integrations: [
      "Stripe",
      "Auth providers (Auth0, Okta, Microsoft Entra ID)",
      "Salesforce",
      "HubSpot",
      "Internal REST APIs",
      "Postgres / data warehouses",
    ],
    faqs: [
      {
        q: "Do you only build software that involves AI?",
        a: "No. Much of our work is conventional software that supports or sits near AI features, and some projects have no model component at all. We bring the same engineering standards either way.",
      },
      {
        q: "Who owns the code?",
        a: "You do. Code lives in your repositories from the start, and we work under your accounts for hosting and third-party services wherever possible, so there is nothing to transfer at the end.",
      },
      {
        q: "Can you modernize a legacy system without a full rewrite?",
        a: "Usually, yes. We tend to wrap the old system with a clean API, then replace parts of it gradually behind that interface. A full rewrite is sometimes justified, but it carries more risk and we only recommend it with clear reasons.",
      },
      {
        q: "How long does a typical build take?",
        a: "That typically depends on scope, integrations and how decisions get made on your side. A focused first release often takes a few weeks to a couple of months, and we prefer to plan in short phases rather than one long estimate.",
      },
    ],
    relatedProjects: ["llm-evaluation-console", "invoice-intake-automation"],
    relatedArticles: ["reducing-llm-latency-and-cost"],
  },
  {
    slug: "ai-deployment-and-monitoring",
    title: "AI deployment, monitoring and optimization",
    navLabel: "Deployment & LLMOps",
    group: "Operate",
    icon: "deploy",
    metaTitle: "LLM monitoring and deployment for production",
    metaDescription:
      "LLM monitoring and deployment for systems already in use: tracing, evaluation gates in CI, cost and latency tuning, and safer rollouts when models change.",
    primaryKeyword: "LLM monitoring and deployment",
    secondaryKeywords: [
      "LLMOps",
      "LLM observability",
      "AI model deployment",
      "LLM cost optimization",
    ],
    h1: "LLM monitoring and deployment that catches regressions early",
    summary:
      "Tracing, evaluation gates and infrastructure tuning for AI systems in production, so quality, latency and spend stay visible.",
    intro:
      "Once an AI feature is live, the hard questions change: is quality slipping, why did spend jump last week, is it safe to move to a newer model? We set up the infrastructure and feedback loops to answer those questions with data. The goal is a system your team can change confidently.",
    problems: [
      {
        title: "Quality drifts without anyone noticing",
        body: "Shifts in user behavior, upstream data or provider models degrade answers gradually, and nothing alerts the team.",
      },
      {
        title: "Spend outpaces usage",
        body: "Long prompts, missing caches and oversized models for simple tasks drive costs up faster than traffic.",
      },
      {
        title: "Model upgrades feel risky",
        body: "A new model version promises improvements, but there is no way to check whether it breaks existing behavior before switching.",
      },
      {
        title: "Failures with no context",
        body: "Errors show up as generic 500s or vague user reports, without the prompt, retrieved context or tool calls that led to them.",
      },
    ],
    deliverables: [
      "End-to-end tracing of prompts, retrieval and tool calls",
      "Evaluation gate in CI that blocks quality regressions",
      "Dashboards for latency, error rate and cost per feature",
      "Staged rollout and rollback process for model changes",
      "Optimization report with prioritized cost and latency fixes",
    ],
    approach: [
      {
        title: "Instrument everything",
        body: "We add tracing across model calls, retrieval and tools, with sensitive fields redacted, so every response can be inspected after the fact.",
      },
      {
        title: "Build the eval gate",
        body: "A curated test set runs on each change to prompts, models or retrieval settings, and results are compared against the current baseline.",
      },
      {
        title: "Harden the infrastructure",
        body: "Deployments become reproducible, with health checks, rate limiting, provider failover and staged rollouts for risky changes.",
      },
      {
        title: "Optimize with evidence",
        body: "Using real traces, we find where caching, smaller models, shorter prompts or batching cut cost or latency without hurting measured quality.",
      },
    ],
    stack: [
      "Docker",
      "Kubernetes",
      "Terraform",
      "OpenTelemetry",
      "Langfuse",
      "Prometheus",
      "Grafana",
      "vLLM",
      "GitHub Actions",
      "Redis",
    ],
    integrations: [
      "AWS, Azure and Google Cloud",
      "Datadog",
      "PagerDuty",
      "Slack",
      "GitHub / GitLab CI",
      "Postgres / data warehouses",
    ],
    faqs: [
      {
        q: "Can you work on a system someone else built?",
        a: "Yes, this is often where operations work starts. We begin with instrumentation, since it shows how the system actually behaves, and then prioritize fixes based on what the traces reveal.",
      },
      {
        q: "How do you measure quality in production?",
        a: "Through a mix of signals: offline evaluation on curated test sets, sampled human review, user feedback and automated checks such as model-graded scoring. No single metric is sufficient, so we combine them and watch for changes over time.",
      },
      {
        q: "Should we self-host open-weight models?",
        a: "Sometimes it makes sense for data control, predictable cost at high volume or latency. It also adds GPU capacity planning and operational load, so we compare it against hosted APIs on your actual workload before recommending it.",
      },
      {
        q: "How soon will we see results?",
        a: "That typically depends on how instrumented the system already is and how many services are involved. Basic tracing and dashboards often land within a few weeks, while evaluation gates and optimization continue iteratively from there.",
      },
    ],
    relatedProjects: ["llm-evaluation-console"],
    relatedArticles: [
      "reducing-llm-latency-and-cost",
      "evaluating-rag-before-launch",
    ],
  },
];

export const services: Service[] = [...coreServices, ...businessServices];

const navigationGroupDefinitions = [
  {
    title: "Build",
    blurb: "Digital products, websites and AI systems designed and engineered end to end.",
    slugs: [
      "ai-application-development",
      "ai-agent-development",
      "custom-software-development",
      "web-development",
      "wordpress-development",
      "ecommerce-development",
      "mobile-app-development",
      "rag-development",
      "llm-integration",
    ],
  },
  {
    title: "Grow",
    blurb: "Search, marketing and conversion work grounded in useful content and measurable behavior.",
    slugs: [
      "seo-services",
      "digital-marketing",
      "conversion-rate-optimization",
      "content-strategy-and-analytics",
    ],
  },
  {
    title: "Operate",
    blurb: "Maintenance, performance, security and infrastructure for dependable production systems.",
    slugs: [
      "website-maintenance-and-support",
      "website-speed-optimization",
      "security-and-technical-support",
      "cloud-and-infrastructure",
      "ai-workflow-automation",
      "data-engineering-for-ai",
      "ai-deployment-and-monitoring",
    ],
  },
] as const;

export const serviceNavigationGroups = navigationGroupDefinitions.map((group) => ({
  title: group.title,
  blurb: group.blurb,
  services: group.slugs.map((slug) => services.find((service) => service.slug === slug)!),
}));

export function getService(slug: string) {
  return services.find((s) => s.slug === slug);
}
