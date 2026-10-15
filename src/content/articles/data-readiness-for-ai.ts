import type { Article } from "../types";

export const article: Article = {
  slug: "data-readiness-for-ai",
  title: "Is your data ready for AI? A practical readiness audit",
  metaTitle: "AI data readiness: a practical audit",
  description:
    "A practical AI data readiness audit: inventory sources and owners, carry permissions into retrieval, check quality and PII, and build an evaluation set first.",
  category: "Data",
  publishedAt: "2026-10-12",
  author: { name: "Nuvella Promo Code Team", role: "Editorial team" },
  primaryKeyword: "AI data readiness",
  relatedServices: ["data-engineering-for-ai", "rag-development"],
  body: [
    {
      type: "p",
      text: "When an AI project stalls, the model is rarely the reason. More often the assistant gives a confident answer from a policy that was superseded last year, can't read the tables in the documents that matter, or shows someone a file they were never meant to see. These are data problems, and they are much cheaper to find before you build than after.",
    },
    {
      type: "p",
      text: "\"Is our data ready for AI?\" has no general answer. Data is ready or not ready for a specific use case. This article describes the audit we run before committing to a build: what to look at, in what order, and how to turn the findings into a short list of things to fix first.",
    },
    { type: "h2", text: "Start from the use case, not the data lake", id: "start-from-the-use-case" },
    {
      type: "p",
      text: "A readiness audit that begins with \"let's catalogue everything we have\" tends to run for months and conclude that the data is messy, which everyone already knew. Begin instead with one concrete use case and work backwards.",
    },
    {
      type: "ul",
      items: [
        "**Who is asking, and what do they need?** For example, support agents need accurate answers about warranty terms for a specific product and region.",
        "**What would a correct answer draw on?** Name the actual documents, tables or systems a skilled human would consult.",
        "**What does wrong look like, and how costly is it?** A wrong internal summary is an annoyance. A wrong answer about a refund entitlement is a liability.",
      ],
    },
    {
      type: "p",
      text: "This scopes the audit to a few sources instead of the whole estate, and it gives you criteria for judging quality. Data is \"good enough\" relative to the cost of a wrong answer.",
    },
    { type: "h2", text: "Inventory sources, owners and access", id: "inventory-and-access" },
    { type: "h3", text: "Know where the data lives and who owns it", id: "sources-and-owners" },
    {
      type: "p",
      text: "For each source the use case depends on, record the system, the format, the rough volume, how it is updated, and a **named owner**: a person who can say which version is authoritative and who will notice when something changes. Sources without an owner are a warning sign. They tend to be stale, and nobody will fix them when the AI surfaces their problems.",
    },
    { type: "h3", text: "Permissions must flow through to retrieval", id: "permissions" },
    {
      type: "p",
      text: "This is the item most often missed and the most damaging to get wrong. If a SharePoint folder is restricted to the finance team, an assistant built on top of it must apply the same restriction at query time. Indexing everything into one vector store with a service account and filtering nothing is how internal assistants leak salary data.",
    },
    {
      type: "p",
      text: "Check whether each source exposes its access control lists in a form you can sync, how often they change, and how quickly a revoked permission needs to take effect. Plan to store permission metadata alongside every indexed chunk and filter on it in the retrieval query, not after generation. If a source cannot provide usable permissions, that is a finding in itself.",
    },
    { type: "h2", text: "Check quality where it actually hurts", id: "quality-checks" },
    {
      type: "p",
      text: "Generic data quality scores are not very useful here. Focus on the failure modes that produce wrong answers.",
    },
    {
      type: "ul",
      items: [
        "**Freshness.** When was each document last updated, and how does that compare with how often the underlying facts change? A pricing sheet untouched for two years is suspect.",
        "**Duplication.** The same content copied across drives, wikis and email attachments inflates retrieval results and crowds out other relevant material.",
        "**Conflicting versions.** `Policy_v3_FINAL.docx` and `Policy_v4_draft.docx` both in the index, with different answers. The model has no way to know which one wins unless you tell it.",
        "**Orphaned and test content.** Templates, sample data and abandoned drafts that look authoritative to a retriever.",
      ],
    },
    {
      type: "p",
      text: "Most of this can be measured cheaply from document metadata before any parsing. A query like the one below, run against a metadata export, gives a quick picture of staleness and exact duplicates per source.",
    },
    {
      type: "code",
      lang: "sql",
      caption: "Freshness and exact-duplicate profile per source (PostgreSQL)",
      code: `-- documents(id, source, path, title, content_hash, modified_at, owner)
WITH dupes AS (
  SELECT content_hash, COUNT(*) AS copies
  FROM documents
  GROUP BY content_hash
  HAVING COUNT(*) > 1
)
SELECT
  d.source,
  COUNT(*)                                             AS total_docs,
  COUNT(*) FILTER (WHERE d.modified_at < NOW() - INTERVAL '18 months')
                                                       AS stale_docs,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE d.modified_at < NOW() - INTERVAL '18 months'
  ) / COUNT(*), 1)                                     AS stale_pct,
  COUNT(*) FILTER (WHERE x.content_hash IS NOT NULL)   AS docs_with_duplicates,
  COUNT(*) FILTER (WHERE d.owner IS NULL)              AS unowned_docs,
  MAX(d.modified_at)                                   AS most_recent_update
FROM documents d
LEFT JOIN dupes x ON x.content_hash = d.content_hash
GROUP BY d.source
ORDER BY stale_pct DESC;`,
    },
    {
      type: "p",
      text: "Exact hashes only catch identical files. For near-duplicates such as the same policy saved as Word and PDF, compare normalized text or use similarity hashing on a sample. The 18-month threshold is a placeholder; set it per source based on how quickly that content goes out of date.",
    },
    { type: "h2", text: "Unstructured content, PII and retention", id: "unstructured-pii-retention" },
    { type: "h3", text: "Can you actually read the documents?", id: "unstructured-content" },
    {
      type: "p",
      text: "Pick 20 to 30 representative documents and run them through your intended parsing pipeline, then read the output. Common problems include tables flattened into meaningless runs of numbers, multi-column layouts read across columns, headers and footers repeated on every chunk, and scanned PDFs with no text layer at all. Scanned documents need OCR, and OCR quality on low-resolution scans, stamps and handwriting varies widely. Tables often need dedicated extraction. These findings shape both the parsing approach and how you combine search methods, which we discuss in [hybrid retrieval for business documents](/articles/hybrid-retrieval-for-business-documents).",
    },
    { type: "h3", text: "Personal data and retention rules", id: "pii-and-retention" },
    {
      type: "p",
      text: "Identify which sources contain personal or sensitive data, what your legal basis is for processing it in this new way, and which retention rules apply. If a record must be deleted after a set period, its chunks and embeddings must be deleted too, so your indexing pipeline needs to support deletion by source document. Decide whether PII should be redacted before indexing, restricted by permissions, or excluded entirely, and involve your privacy or legal team early rather than at launch review.",
    },
    { type: "h2", text: "Build the evaluation set early", id: "evaluation-set" },
    {
      type: "p",
      text: "The single most useful output of a readiness audit is a labelled evaluation set: realistic questions paired with correct answers and the source documents that support them. Aim for something like 50 to 150 examples to start, written or reviewed by the people who will use the system, and weighted toward the questions that are hard or costly to get wrong.",
    },
    {
      type: "p",
      text: "Building it is itself a readiness test. If domain experts cannot agree on the correct answer, or cannot find a source that supports it, the AI will not do better. Those gaps tell you exactly which content to fix. The same set later becomes your regression suite; see [evaluating RAG before launch](/articles/evaluating-rag-before-launch) for how to use it.",
    },
    {
      type: "callout",
      title: "A quick test",
      text: "Ask an expert to answer ten real questions using only the sources you plan to index, and time them. If they struggle to find answers or find conflicting ones, fix the content before building retrieval.",
    },
    { type: "h2", text: "Score it, then fix what matters first", id: "scoring-and-priorities" },
    {
      type: "p",
      text: "Score each source from 0 to 2 on each dimension below (0 = blocking, 1 = workable with effort, 2 = ready). The point is not the total but where the zeros are.",
    },
    {
      type: "ul",
      items: [
        "**Ownership:** a named owner who can confirm authoritative versions.",
        "**Access control:** permissions are available, syncable and enforceable at retrieval time.",
        "**Freshness:** update frequency matches how quickly the facts change.",
        "**Consistency:** duplicates and conflicting versions are low or resolvable.",
        "**Parseability:** text, tables and scans extract into usable form.",
        "**Compliance:** PII, legal basis and retention are understood and supportable.",
        "**Evaluability:** experts can write questions and verified answers from this source.",
      ],
    },
    {
      type: "p",
      text: "Fix in this order: anything scoring zero on access control or compliance, because those are risks rather than quality issues; then ownership and conflicting versions, which cause confident wrong answers; then parsing, which limits coverage. Freshness problems in a small number of high-traffic documents are often worth fixing by hand rather than with tooling.",
    },
    { type: "h2", text: "What to do next", id: "what-to-do-next" },
    {
      type: "p",
      text: "Choose one use case, list the five to ten sources it depends on, and run the metadata profile and the parsing sample this week. You will have a clear picture of readiness in days rather than months. If you want help running the audit or building the pipelines that come out of it, see our [data engineering for AI](/services/data-engineering-for-ai) service or [get in touch](/contact).",
    },
  ],
};
