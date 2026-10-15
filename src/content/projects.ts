import type { Project } from "./types";

/**
 * All projects below are illustrative reference builds. They describe how the
 * studio would approach a representative problem; they are not client work and
 * contain no achieved results.
 */
export const projects: Project[] = [
  {
    slug: "support-knowledge-assistant",
    title: "Support knowledge assistant with cited answers",
    kind: "illustrative",
    sector: "B2B software support",
    metaTitle: "Support knowledge assistant (RAG)",
    metaDescription:
      "An illustrative reference build: a RAG assistant that answers support questions from docs, resolved tickets and release notes, with citations on every answer.",
    summary:
      "A retrieval-augmented assistant that drafts cited answers for support agents from product docs, past tickets and release notes.",
    challenge:
      "Support knowledge in a growing software company is spread across a docs site, years of resolved tickets and release notes that change every sprint. Agents spend much of each ticket searching, and the answer they find is often written for an older version of the product. A generic chatbot makes this worse, because a confident answer about the wrong version is harder to catch than no answer at all.",
    solution: [
      "Ingest docs, resolved tickets and release notes into a single index, with each chunk tagged by source, product area and the product version it applies to.",
      "Use hybrid retrieval (vector similarity plus keyword search) followed by a reranker, and filter by the customer's product version before anything reaches the model.",
      "Generate answers only from retrieved passages, with inline citations the agent can open. When retrieval support is too thin, the assistant says so and suggests an escalation path instead of guessing.",
      "Run the assistant inside the help desk as a draft panel, so agents edit and send rather than copy and paste, and their edits feed back into the evaluation set.",
    ],
    architecture: [
      { label: "Source sync", detail: "Scheduled connectors pull docs, closed tickets and release notes" },
      { label: "Chunk and tag", detail: "Structure-aware chunking with source, product area and version metadata" },
      { label: "Hybrid index", detail: "Embeddings and BM25 stored together in Postgres with pgvector" },
      { label: "Retrieve and rerank", detail: "Version-filtered hybrid search, then a cross-encoder reranks candidates" },
      { label: "Grounded generation", detail: "Model drafts an answer citing passage IDs, or declines" },
      { label: "Agent review", detail: "Draft appears in the help desk; edits are logged for evaluation" },
    ],
    stack: [
      "Python",
      "FastAPI",
      "PostgreSQL with pgvector",
      "OpenAI embeddings",
      "Cohere Rerank",
      "Anthropic Claude API",
      "Zendesk API",
      "Langfuse",
    ],
    phases: [
      {
        title: "Corpus audit",
        body: "Inventory sources, remove stale or duplicate content, and agree on how product versions are represented in metadata.",
      },
      {
        title: "Retrieval baseline",
        body: "Build the index and measure retrieval quality against a labeled set of real support questions before any generation work starts.",
      },
      {
        title: "Grounded drafting",
        body: "Add citation-constrained generation and the decline path, then review drafts with senior agents to tune tone and thresholds.",
      },
      {
        title: "Help desk rollout",
        body: "Ship the draft panel to a small group of agents, monitor citation accuracy and edit rates, and widen access in stages.",
      },
    ],
    outcomes: [
      {
        title: "Grounded answers by default",
        body: "Every draft cites the passages it relies on; drafts without sufficient retrieval support fall back to a handoff message.",
      },
      {
        title: "Version-correct guidance",
        body: "Success is measured by whether cited passages match the customer's product version, checked on a held-out question set.",
      },
      {
        title: "Measurable agent effort",
        body: "Agent edits to each draft are logged, so the team can track how much rewriting answers need as the corpus changes.",
      },
    ],
    services: ["rag-development", "ai-application-development"],
    visual: "pipeline",
  },
  {
    slug: "contract-review-agent",
    title: "Vendor contract review agent with redlines",
    kind: "illustrative",
    sector: "Legal operations",
    metaTitle: "Contract review agent with human approval",
    metaDescription:
      "An illustrative reference build: an agent that checks vendor contracts against a legal playbook, flags deviations and drafts redlines for human approval.",
    summary:
      "An agent that compares incoming vendor contracts with a negotiation playbook, flags deviations and drafts redlines that a lawyer must approve.",
    challenge:
      "In-house legal teams review a steady stream of vendor agreements that are mostly standard but occasionally contain a clause that matters a great deal. Reviewers apply a playbook from memory, so consistency depends on who picks up the contract. Any automation here has to be conservative: a missed indemnity clause costs far more than a slow review.",
    solution: [
      "Encode the playbook as structured positions per clause type (preferred, acceptable fallback, and escalate), maintained by the legal team rather than buried in a prompt.",
      "Parse each contract into clauses, classify them, and have the agent compare each one to the playbook using tool calls for clause lookup and precedent search.",
      "Draft redlines in the document's own format with a short rationale per change, citing the playbook position that drives it.",
      "Route every review to a named lawyer. Nothing is sent to the counterparty until a human approves, edits or rejects each proposed change.",
    ],
    architecture: [
      { label: "Contract intake", detail: "DOCX or PDF arrives from email or the contract management system" },
      { label: "Clause parsing", detail: "Layout-aware parsing splits the document into numbered, typed clauses" },
      { label: "Playbook lookup", detail: "Agent tool fetches the matching playbook position for each clause" },
      { label: "Deviation analysis", detail: "Model compares clause text with position and assigns a risk level" },
      { label: "Redline drafting", detail: "Tracked changes generated with rationale and playbook reference" },
      { label: "Lawyer approval", detail: "Reviewer accepts, edits or rejects each change before release" },
    ],
    stack: [
      "Python",
      "LangGraph",
      "Anthropic Claude API",
      "Unstructured",
      "python-docx",
      "PostgreSQL",
      "Next.js",
      "OpenTelemetry",
    ],
    phases: [
      {
        title: "Playbook modeling",
        body: "Work with the legal team to turn the existing playbook into structured clause positions with clear escalation rules.",
      },
      {
        title: "Clause analysis",
        body: "Build parsing and classification, then test deviation detection against a set of past contracts the team has already reviewed.",
      },
      {
        title: "Redlines and review",
        body: "Add redline generation and the approval interface, with every agent step visible to the reviewer.",
      },
      {
        title: "Supervised operation",
        body: "Run the agent alongside normal review on low-risk contract types first, comparing its flags with the lawyer's own findings.",
      },
    ],
    outcomes: [
      {
        title: "No unreviewed output",
        body: "The design target is zero redlines leaving the system without a recorded human decision on each change.",
      },
      {
        title: "Conservative flagging",
        body: "Evaluation prioritizes recall on high-risk clauses: a missed deviation counts as a failure, an unnecessary flag does not.",
      },
      {
        title: "Traceable reasoning",
        body: "Each proposed change links to the clause text, the playbook position and the agent steps that produced it.",
      },
    ],
    services: ["ai-agent-development", "llm-integration"],
    visual: "agent",
  },
  {
    slug: "invoice-intake-automation",
    title: "Invoice and purchase order intake workflow",
    kind: "illustrative",
    sector: "Finance operations",
    metaTitle: "Invoice intake and extraction workflow",
    metaDescription:
      "An illustrative reference build: emailed invoices and POs are classified, extracted, validated against the ERP and posted, with exceptions sent to a queue.",
    summary:
      "A document workflow that classifies emailed invoices and purchase orders, extracts validated fields and posts clean records to the ERP.",
    challenge:
      "Accounts payable teams receive invoices and purchase orders as email attachments in dozens of layouts, then key the same fields into the ERP by hand. Template-based OCR breaks whenever a supplier changes its format. The goal is not to remove people from the process but to reserve their time for documents that genuinely need judgment.",
    solution: [
      "Watch a shared mailbox, split attachments into individual documents and classify each as invoice, purchase order, credit note or other.",
      "Extract header and line-item fields into a strict schema using a vision-capable model with structured output, so every field has a type and a source location on the page.",
      "Validate extracted data against the ERP: supplier exists, PO number matches, totals reconcile with line items and tax, and the invoice is not a duplicate.",
      "Post documents that pass every check automatically, and send the rest to an exception queue that shows the failed rule next to the original page.",
    ],
    architecture: [
      { label: "Mailbox watcher", detail: "Microsoft Graph subscription captures new messages and attachments" },
      { label: "Classify documents", detail: "Pages split and labeled by document type before extraction" },
      { label: "Structured extraction", detail: "Model returns schema-validated fields with page coordinates" },
      { label: "Business validation", detail: "Supplier, PO match, totals, tax and duplicate checks against ERP" },
      { label: "ERP posting", detail: "Clean documents posted through the ERP API with an audit record" },
      { label: "Exception queue", detail: "Failed checks routed to reviewers with the reason highlighted" },
    ],
    stack: [
      "Python",
      "Temporal",
      "Microsoft Graph API",
      "Azure AI Document Intelligence",
      "OpenAI API (structured outputs)",
      "Pydantic",
      "PostgreSQL",
      "Amazon S3",
    ],
    phases: [
      {
        title: "Document sampling",
        body: "Collect a representative sample of supplier documents and label the fields that matter for posting.",
      },
      {
        title: "Extraction and validation",
        body: "Build the extraction schema and validation rules, measuring field-level accuracy on the labeled sample.",
      },
      {
        title: "Exception workflow",
        body: "Design the reviewer queue so corrections are fast and every correction is stored as new evaluation data.",
      },
      {
        title: "Staged automation",
        body: "Start with all documents going to review, then enable automatic posting per supplier once its extraction is reliable.",
      },
    ],
    outcomes: [
      {
        title: "Validated before posting",
        body: "No record reaches the ERP without passing every business rule; anything uncertain goes to a person.",
      },
      {
        title: "Field-level accuracy tracking",
        body: "Success is measured per field and per supplier, so automation can be enabled or paused where the data supports it.",
      },
      {
        title: "Durable, replayable runs",
        body: "Each document's workflow is durable and auditable, so failed steps retry safely and any posting can be traced back to its source page.",
      },
    ],
    services: ["ai-workflow-automation", "data-engineering-for-ai"],
    visual: "graph",
  },
  {
    slug: "llm-evaluation-console",
    title: "LLM evaluation and observability console",
    kind: "illustrative",
    sector: "Internal platform engineering",
    metaTitle: "LLM evaluation and observability console",
    metaDescription:
      "An illustrative reference build: an internal console for test sets, regression evals on prompt and model changes, request tracing and LLM cost dashboards.",
    summary:
      "An internal console where teams running several LLM features manage test sets, run regression evals, inspect traces and track cost.",
    challenge:
      "Once a company ships more than a couple of LLM features, prompt and model changes start going out without anyone knowing what they broke. Each team keeps its own spreadsheet of test cases, traces live in different tools, and nobody can say which feature drives the monthly model bill. The missing piece is a shared, boring routine for checking changes before they ship.",
    solution: [
      "Store versioned test sets per feature, including expected behaviors, reference answers where they exist and tags for known edge cases.",
      "Run regression evals automatically in CI whenever a prompt, model or retrieval config changes, combining deterministic checks with model-graded rubrics that are themselves spot-checked by people.",
      "Collect traces from every feature through OpenTelemetry, so a failing eval case links straight to the full request: inputs, retrieved context, tool calls and output.",
      "Attribute token usage and cost to feature, team and model, with budgets and alerts instead of a single surprise invoice.",
    ],
    architecture: [
      { label: "SDK instrumentation", detail: "Services emit OpenTelemetry spans for each model and tool call" },
      { label: "Trace collector", detail: "Collector enriches spans with feature, team and prompt version" },
      { label: "Trace store", detail: "ClickHouse holds traces, token counts and cost per request" },
      { label: "Eval runner", detail: "CI job replays test sets against candidate prompt or model" },
      { label: "Comparison report", detail: "Scores diffed against the baseline, regressions block the merge" },
      { label: "Console UI", detail: "Teams browse traces, test sets, eval history and cost dashboards" },
    ],
    stack: [
      "TypeScript",
      "Next.js",
      "Python",
      "OpenTelemetry",
      "ClickHouse",
      "PostgreSQL",
      "GitHub Actions",
      "Docker",
    ],
    phases: [
      {
        title: "Feature inventory",
        body: "List every LLM feature, its owner, its models and how it is currently tested, then agree on a shared trace schema.",
      },
      {
        title: "Tracing first",
        body: "Instrument the highest-traffic feature end to end so the console is useful before any eval work lands.",
      },
      {
        title: "Regression evals",
        body: "Build test sets with each team and wire eval runs into CI, starting as advisory checks before they block merges.",
      },
      {
        title: "Cost and rollout",
        body: "Add cost attribution and budgets, then onboard the remaining features using the patterns from the first one.",
      },
    ],
    outcomes: [
      {
        title: "Every change evaluated",
        body: "The target is that no prompt, model or retrieval change merges without an eval run compared against the current baseline.",
      },
      {
        title: "One trace per request",
        body: "Any production response can be opened as a single trace showing inputs, context, tool calls, output and cost.",
      },
      {
        title: "Cost owned by features",
        body: "Spend is attributed to a feature and team, with alert thresholds set as explicit design parameters per budget.",
      },
    ],
    services: ["ai-deployment-and-monitoring", "custom-software-development"],
    visual: "console",
  },
];

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
