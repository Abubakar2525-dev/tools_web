import type { Faq, IconName, TitledText } from "./types";

/**
 * Homepage + shared marketing content.
 * EDIT ME: the commitments and technology list describe how the studio works.
 * Keep them only if they are true for your business.
 */

export const commitments: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "gauge",
    title: "Evaluated, not eyeballed",
    body: "Every model-facing feature ships with a test set and a measurable quality bar.",
  },
  {
    icon: "layers",
    title: "Model-agnostic",
    body: "Hosted APIs or open-weight models, chosen per task on cost, latency and quality.",
  },
  {
    icon: "shield",
    title: "Your infrastructure",
    body: "Deployed to your cloud account or private network, with least-privilege access.",
  },
  {
    icon: "code",
    title: "You own the code",
    body: "Readable repositories, documentation and a handover your team can run with.",
  },
];

export const process: TitledText[] = [
  {
    title: "Discover the problem",
    body: "We map the workflow, the data it depends on and what a measurable improvement looks like, before choosing any model.",
  },
  {
    title: "Design the solution",
    body: "A short architecture document: components, data flow, failure modes, cost envelope and how quality will be evaluated.",
  },
  {
    title: "Engineer the system",
    body: "Small, reviewable increments in your repository, with a working slice in front of real users as early as possible.",
  },
  {
    title: "Test and validate",
    body: "Golden datasets, regression evals and adversarial cases. Releases are gated on the numbers, not on a demo.",
  },
  {
    title: "Deploy and improve",
    body: "Tracing, cost dashboards and feedback loops go live with the feature, so the next iteration is driven by evidence.",
  },
];

export const techCategories: { title: string; items: string[] }[] = [
  { title: "Models", items: ["OpenAI API", "Anthropic Claude", "Google Gemini", "Llama & Mistral (open-weight)", "Embedding models", "Cross-encoder rerankers"] },
  { title: "Orchestration", items: ["Python", "TypeScript", "LangGraph", "Pydantic", "Structured outputs", "Model Context Protocol"] },
  { title: "Retrieval & data", items: ["PostgreSQL + pgvector", "Qdrant", "OpenSearch", "dbt", "Airflow", "Document parsing pipelines"] },
  { title: "Applications", items: ["Next.js", "React", "FastAPI", "Node.js", "REST & GraphQL APIs", "Webhooks & queues"] },
  { title: "Infrastructure", items: ["Docker", "Kubernetes", "Terraform", "AWS", "Azure", "Google Cloud"] },
  { title: "Quality & observability", items: ["Eval harnesses", "OpenTelemetry", "Langfuse", "Prometheus & Grafana", "CI regression gates", "Cost tracking"] },
];

export const principles: TitledText[] = [
  {
    title: "Start with the workflow, not the model",
    body: "The most useful AI features are usually narrow. We look for the step where people lose the most time and design around it.",
  },
  {
    title: "Make failure visible",
    body: "Citations, confidence thresholds, human checkpoints and traces. When the system is unsure, it says so instead of guessing.",
  },
  {
    title: "Security is part of the design",
    body: "Permissions flow through to retrieval, tools run with least privilege, and untrusted content never gets to issue instructions.",
  },
  {
    title: "Built to be maintained",
    body: "Plain, typed code, sensible dependencies and documentation. Your team should be able to change it without us.",
  },
];

export const homeFaqs: Faq[] = [
  {
    q: "We have an idea but no AI team. Where do we start?",
    a: "Start with a short discovery: we look at the workflow, the data available and what success would be worth. You get a written recommendation, including when AI is not the right tool, before any build commitment.",
  },
  {
    q: "How long does a typical project take?",
    a: "It depends on scope, data readiness and integrations. A focused first release is often a matter of weeks rather than months, and we agree milestones up front so progress is visible throughout.",
  },
  {
    q: "Which models do you use? Are we locked in?",
    a: "We choose per task on quality, latency, cost and data-handling requirements, and we keep model calls behind a thin interface. Switching providers or moving to an open-weight model later is a configuration and evaluation exercise, not a rewrite.",
  },
  {
    q: "How do you handle data security and privacy?",
    a: "We work inside your environment wherever possible, apply least-privilege access, respect existing document permissions in retrieval and avoid sending sensitive data to providers that retain it. We are happy to work within your security review process.",
  },
  {
    q: "Can you integrate with our existing systems?",
    a: "Yes. Most of our work is integration: CRMs, help desks, document stores, data warehouses and internal APIs. We prefer connecting to what you already run over introducing new platforms.",
  },
  {
    q: "What happens after launch?",
    a: "You can take the system in-house with full documentation and a handover, or keep us on for monitoring, evaluation and iteration. Either way, tracing and cost dashboards ship with the feature.",
  },
];
