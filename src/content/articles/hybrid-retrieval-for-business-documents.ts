import type { Article } from "../types";

export const article: Article = {
  slug: "hybrid-retrieval-for-business-documents",
  title: "Why hybrid retrieval beats pure vector search for business documents",
  metaTitle: "Hybrid retrieval vs pure vector search for RAG",
  description:
    "Embeddings miss part numbers, codes and acronyms. How BM25, dense retrieval, rank fusion, reranking and structure-aware chunking make hybrid search RAG work.",
  category: "RAG",
  publishedAt: "2026-10-12",
  author: { name: "Nuvella Promo Code Team", role: "Editorial team" },
  primaryKeyword: "hybrid search RAG",
  relatedServices: ["rag-development", "data-engineering-for-ai"],
  body: [
    {
      type: "p",
      text: "Vector search is the default first step in almost every RAG tutorial, and for good reason: embeddings are very good at matching meaning when the wording differs. Ask \"how do I get my money back\" and a decent embedding model will find the refund policy even though the word \"refund\" never appeared in the question.",
    },
    {
      type: "p",
      text: "Business documents, though, are full of things that are not really language. Part numbers, contract IDs, error codes, SKUs, people's names, internal project codenames and three-letter acronyms that mean something different in every company. This is where pure vector search quietly fails, and where **hybrid search RAG**, combining lexical and semantic retrieval, earns its extra complexity.",
    },
    {
      type: "h2",
      text: "Where embeddings fall short",
      id: "where-embeddings-fail",
    },
    {
      type: "p",
      text: "Embedding models compress text into a fixed-size vector that captures general meaning. That compression is lossy in exactly the places business users care about:",
    },
    {
      type: "ul",
      items: [
        "**Identifiers**: `PN-40817-B` and `PN-40871-B` are very different parts but look almost identical to an embedding model. A query for one often returns the other, or a vaguely related datasheet.",
        "**Codes and error strings**: `ERR_SYNC_409` carries precise meaning that general-purpose models were never trained to preserve.",
        "**Names**: people, suppliers and products with uncommon names get pulled toward more common neighbours in vector space.",
        "**Acronyms**: \"CPA\" might be a cost per acquisition, a certified accountant or an internal Customer Priority Agreement. The embedding picks whichever sense dominated its training data.",
        "**Exact phrases**: legal and policy questions often hinge on a specific clause wording that semantic similarity smooths over.",
      ],
    },
    {
      type: "p",
      text: "The failure is subtle because the system still returns something plausible. Users see a confident answer about the wrong part number, and nothing in the logs looks broken.",
    },
    {
      type: "h2",
      text: "Combine BM25 with dense retrieval",
      id: "bm25-plus-dense-retrieval",
    },
    {
      type: "p",
      text: "BM25 is a decades-old lexical ranking function that scores documents by term overlap, weighted so that rare terms count more. It is exactly the wrong tool for paraphrased questions and exactly the right tool for identifiers, because a rare token like a part number gets a very high weight. Dense retrieval has the opposite profile. Running both and merging the results covers each method's blind spots.",
    },
    {
      type: "p",
      text: "In practice, most search engines and several vector databases can now run both in one query. If yours cannot, run them in parallel and merge in application code. Two details matter more than the choice of engine:",
    },
    {
      type: "ul",
      items: [
        "**Tokenisation for codes.** Default analyzers may split `PN-40817-B` into fragments. Index identifiers in a separate keyword field as well as the main text field so exact matches stay exact.",
        "**Retrieve wide, then narrow.** Pull a generous candidate set from each retriever (for example 30 to 50 each) and let fusion and reranking choose the final few.",
      ],
    },
    {
      type: "h2",
      text: "Merge results with reciprocal rank fusion",
      id: "reciprocal-rank-fusion",
    },
    {
      type: "p",
      text: "BM25 scores and cosine similarities live on different scales, so adding them directly is meaningless and normalising them is fragile. Reciprocal rank fusion (RRF) sidesteps the problem by ignoring scores entirely and using only rank positions. Each document gets `1 / (k + rank)` from each list it appears in, and those contributions are summed. A document that ranks reasonably well in both lists beats one that ranks first in only one.",
    },
    {
      type: "code",
      lang: "python",
      caption: "Reciprocal rank fusion over any number of ranked lists.",
      code: `from collections import defaultdict


def reciprocal_rank_fusion(
    rankings: list[list[str]], k: int = 60
) -> list[tuple[str, float]]:
    """Fuse ranked lists of document IDs. Higher fused score is better."""
    scores: dict[str, float] = defaultdict(float)
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] += 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda item: item[1], reverse=True)


bm25_hits = ["doc_part_40817", "doc_price_list", "doc_returns"]
dense_hits = ["doc_returns", "doc_part_40817", "doc_warranty"]

for doc_id, score in reciprocal_rank_fusion([bm25_hits, dense_hits]):
    print(f"{doc_id:<16} {score:.4f}")`,
    },
    {
      type: "p",
      text: "The constant `k = 60` comes from the original RRF paper and works well as a default; it dampens the advantage of the very top positions so one retriever cannot dominate. You can also weight lists differently by multiplying each contribution, which helps when one retriever is clearly stronger for your corpus.",
    },
    {
      type: "h2",
      text: "Rerank, filter and respect permissions",
      id: "reranking-filters-permissions",
    },
    {
      type: "h3",
      text: "Cross-encoder reranking",
      id: "cross-encoder-reranking",
    },
    {
      type: "p",
      text: "Both BM25 and dense retrieval score the query and document independently. A cross-encoder reads the query and each candidate together, which makes it much better at judging true relevance and much slower. That trade-off is why it belongs at the end of the pipeline: rerank the 30 to 50 fused candidates and keep the top handful for the prompt. In our experience this step often fixes more ordering problems than any amount of embedding-model shopping.",
    },
    {
      type: "h3",
      text: "Metadata filters and access control",
      id: "metadata-and-access-control",
    },
    {
      type: "p",
      text: "Many \"retrieval quality\" complaints are really filtering problems. A question about the current travel policy should not surface the 2019 version, and a question about a specific region's pricing should not mix in other regions. Store fields such as document type, effective date, region, product line and status, and apply them as filters before ranking.",
    },
    {
      type: "p",
      text: "Permissions must be enforced the same way: as a filter inside the retrieval query, based on the requesting user's identity. Never retrieve everything and ask the model to ignore what the user should not see. If a chunk reaches the prompt, assume it can reach the user.",
    },
    {
      type: "callout",
      title: "Practical takeaway",
      text: "If your users search for anything with a code, number or proper name in it, add BM25 alongside your vector index and fuse with RRF before you try a bigger embedding model. It is usually the cheapest meaningful improvement available.",
    },
    {
      type: "h2",
      text: "Chunk along the document's own structure",
      id: "structure-aware-chunking",
    },
    {
      type: "p",
      text: "Hybrid retrieval cannot find an answer that was split in half during ingestion. Fixed-size chunking, say every 500 tokens, cuts tables in the middle, separates a heading from the paragraph it describes and strands a clause from its exceptions. Business documents almost always have structure worth keeping:",
    },
    {
      type: "ul",
      items: [
        "Split on headings and sections first, and only fall back to size limits for very long sections.",
        "Keep tables whole, or split by row while repeating the header row in each chunk.",
        "Prepend a short breadcrumb (document title and section path) to each chunk so both BM25 and embeddings see the context.",
        "Store parent document IDs so you can expand a matched chunk to its surrounding section when the answer needs it.",
      ],
    },
    {
      type: "p",
      text: "This is often the least glamorous part of the project and the one with the biggest payoff. Our [data engineering for AI](/services/data-engineering-for-ai) work is largely about getting parsing and chunking right for messy real-world sources.",
    },
    {
      type: "h2",
      text: "Measure the change before you ship it",
      id: "measuring-the-change",
    },
    {
      type: "p",
      text: "Hybrid retrieval adds moving parts, so prove it helps on your data. Build a labelled question set that deliberately includes identifier lookups, acronyms and names alongside ordinary questions. Then compare configurations on recall@k and MRR, broken down by question type:",
    },
    {
      type: "ol",
      items: [
        "Dense retrieval only (your baseline).",
        "BM25 only, to see how much lexical matching alone gets you.",
        "Hybrid with RRF.",
        "Hybrid with RRF plus cross-encoder reranking.",
      ],
    },
    {
      type: "p",
      text: "Look at the segments, not just the average. A typical pattern is that hybrid barely moves the score on conversational questions and sharply improves exact lookups. Also track latency at each stage, since reranking adds a measurable cost per query. Our guide to [evaluating a RAG system before launch](/articles/evaluating-rag-before-launch) covers building that test set in detail.",
    },
    {
      type: "h2",
      text: "What to do next",
      id: "what-to-do-next",
    },
    {
      type: "p",
      text: "Pull twenty real queries from your logs that contain a code, number or name, and check where the correct document lands in your current vector search results. If it is missing or buried, you have your case for hybrid retrieval. Add a lexical index, fuse with RRF, rerank the top candidates, and measure each step. If you would rather have a team that has done this before set it up, talk to us about [RAG development](/services/rag-development).",
    },
  ],
};
