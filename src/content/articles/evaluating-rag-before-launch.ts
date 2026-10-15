import type { Article } from "../types";

export const article: Article = {
  slug: "evaluating-rag-before-launch",
  title: "How to evaluate a RAG system before it reaches users",
  metaTitle: "How to evaluate a RAG system before launch",
  description:
    "A RAG evaluation playbook: build a golden set from real queries, score retrieval and generation separately, calibrate LLM judges and gate releases in CI.",
  category: "RAG",
  publishedAt: "2026-10-12",
  author: { name: "Nuvella Promo Code Team", role: "Editorial team" },
  primaryKeyword: "RAG evaluation",
  relatedServices: ["rag-development", "ai-deployment-and-monitoring"],
  body: [
    {
      type: "p",
      text: "Most retrieval-augmented generation projects are judged the same way in their first month: someone on the team types ten questions into a demo, likes eight of the answers, and declares it ready. That is not evaluation. It is a vibe check with a sample size too small to tell you anything, run by people who already know what the documents say.",
    },
    {
      type: "p",
      text: "A useful **RAG evaluation** process answers three questions with numbers you can track over time. Is the retriever finding the right material? Is the model using that material faithfully? And did the last change make either of those worse? This article walks through how we set that up before a system reaches real users, and what we keep running after it does.",
    },
    {
      type: "h2",
      text: "Start with a golden set built from real questions",
      id: "golden-set-from-real-queries",
    },
    {
      type: "p",
      text: "Everything downstream depends on the quality of your test questions. Synthetic questions generated from your own documents are tempting because they are cheap, but they share vocabulary with the source text, which makes retrieval look far better than it will be in production. Real users paraphrase, misspell, ask about two things at once and use internal shorthand nobody wrote down.",
    },
    {
      type: "p",
      text: "Pull questions from wherever they already exist: support tickets, internal chat channels, search logs, sales call notes. Then label them. For each question, a domain expert records which documents or chunks contain the answer and writes a short reference answer. Aim for coverage rather than volume at first:",
    },
    {
      type: "ul",
      items: [
        "**Common questions** that make up the bulk of expected traffic.",
        "**Hard lookups** involving codes, product names, dates or numbers.",
        "**Multi-hop questions** that need two or more sources combined.",
        "**Unanswerable questions** where the correct behaviour is to say the documents do not cover it.",
        "**Permission-sensitive questions** where the right answer depends on who is asking.",
      ],
    },
    {
      type: "p",
      text: "A set of 150 to 300 well-labelled questions is usually enough to separate a good configuration from a bad one. Version it alongside your code, and treat changes to it with the same care as changes to a test suite.",
    },
    {
      type: "h2",
      text: "Measure retrieval and generation separately",
      id: "retrieval-vs-generation-metrics",
    },
    {
      type: "p",
      text: "When an answer is wrong, you need to know whether the retriever missed the evidence or the model ignored it. Blending the two into a single \"answer quality\" score hides that, and you end up tuning prompts to fix what is really a chunking problem.",
    },
    {
      type: "h3",
      text: "Retrieval metrics",
      id: "retrieval-metrics",
    },
    {
      type: "ul",
      items: [
        "**Recall@k**: of the chunks a human marked as relevant, what fraction appear in the top k results? This is the metric that matters most, because the model cannot use evidence it never sees.",
        "**MRR (mean reciprocal rank)**: how high does the first relevant chunk appear? Useful when you pass few chunks to the model or when position affects how much attention a chunk gets.",
        "**Context precision**: of the chunks you retrieved, how many were actually relevant? Low precision means you are padding the prompt with noise, which costs tokens and can distract the model.",
      ],
    },
    {
      type: "p",
      text: "These are cheap to compute once you have labelled relevant IDs, and they run in seconds, which makes them ideal for fast iteration on chunking, embeddings and hybrid search settings.",
    },
    {
      type: "code",
      lang: "python",
      caption: "Recall@k and MRR over a labelled question set.",
      code: `from dataclasses import dataclass


@dataclass
class Example:
    question: str
    relevant_ids: set[str]    # chunk IDs a human marked as containing the answer
    retrieved_ids: list[str]  # ranked IDs returned by the retriever


def recall_at_k(ex: Example, k: int) -> float:
    hits = ex.relevant_ids.intersection(ex.retrieved_ids[:k])
    return len(hits) / len(ex.relevant_ids)


def reciprocal_rank(ex: Example) -> float:
    for rank, chunk_id in enumerate(ex.retrieved_ids, start=1):
        if chunk_id in ex.relevant_ids:
            return 1.0 / rank
    return 0.0


def evaluate(examples: list[Example], k: int = 5) -> dict[str, float]:
    # Unanswerable questions have no relevant IDs; score them separately.
    scored = [e for e in examples if e.relevant_ids]
    n = len(scored)
    return {
        f"recall@{k}": sum(recall_at_k(e, k) for e in scored) / n,
        "mrr": sum(reciprocal_rank(e) for e in scored) / n,
        "n": n,
    }


examples = [
    Example("What is the warranty on the X200?", {"c12"}, ["c40", "c12", "c7"]),
    Example("How do I reset a locked account?", {"c3", "c9"}, ["c3", "c88", "c9"]),
]
print(evaluate(examples, k=3))  # {'recall@3': 1.0, 'mrr': 0.75, 'n': 2}`,
    },
    {
      type: "h3",
      text: "Generation metrics",
      id: "generation-metrics",
    },
    {
      type: "ul",
      items: [
        "**Faithfulness (groundedness)**: is every claim in the answer supported by the retrieved context? This is your hallucination metric.",
        "**Answer relevance**: does the answer actually address the question that was asked, rather than a nearby one?",
        "**Correct refusal**: for unanswerable questions, does the system decline instead of improvising?",
      ],
    },
    {
      type: "h2",
      text: "Use LLM judges, but calibrate them against people",
      id: "calibrating-llm-as-judge",
    },
    {
      type: "p",
      text: "Generation metrics are hard to compute with string matching, so most teams use a second model as a judge. That works, with one condition: you have to check that the judge agrees with humans on your data before you trust its scores.",
    },
    {
      type: "ol",
      items: [
        "Have two domain experts independently grade 50 to 100 answers on faithfulness and relevance using a short written rubric.",
        "Measure how often they agree with each other. If humans disagree a lot, the rubric is ambiguous, and no judge will fix that.",
        "Run the LLM judge on the same answers and compare. Look at the disagreements one by one; they usually reveal a rubric gap or a judge prompt that is too lenient.",
        "Prefer binary or three-level judgments with a required justification over 1-10 scales, which drift and cluster in the middle.",
        "Re-run the calibration whenever you change the judge model or prompt.",
      ],
    },
    {
      type: "p",
      text: "In our experience, a judge that checks claims one at a time against the context (\"extract each factual claim, then mark each supported or unsupported\") is noticeably more reliable than one asked for a single holistic score.",
    },
    {
      type: "h2",
      text: "Turn the metrics into regression gates",
      id: "regression-gates-in-ci",
    },
    {
      type: "p",
      text: "Evaluation pays off when it runs automatically. Wire the retrieval metrics into CI on every pull request that touches chunking, embeddings, retrieval code or prompts. Run the slower, judge-based generation suite nightly or on release branches. Then set thresholds that block a merge:",
    },
    {
      type: "ul",
      items: [
        "A hard floor on recall@k and faithfulness that the system must never drop below.",
        "A maximum allowed regression relative to the main branch, so small slides do not accumulate unnoticed.",
        "Per-segment checks, because an average can improve while a critical slice (hard lookups, permission-sensitive questions) gets worse.",
      ],
    },
    {
      type: "p",
      text: "Store every run's per-question results, not just the averages. When a gate fails, the first thing anyone wants is the list of questions that flipped from pass to fail.",
    },
    {
      type: "callout",
      title: "Practical takeaway",
      text: "Before tuning anything, label 150 real questions with relevant chunk IDs and compute recall@5. If it is low, no amount of prompt work will save the system. Fix retrieval first, then move on to faithfulness.",
    },
    {
      type: "h2",
      text: "What good enough to launch looks like",
      id: "good-enough-to-launch",
    },
    {
      type: "p",
      text: "There is no universal threshold, because the cost of a wrong answer varies wildly. An internal search helper can tolerate occasional misses; a tool that answers policy or compliance questions cannot. Agree on launch criteria with the business owner before you see the numbers, so the bar does not move to fit the results. A reasonable launch checklist usually includes:",
    },
    {
      type: "ul",
      items: [
        "Retrieval recall at a level the team has agreed is acceptable, with no critical segment far below the average.",
        "Faithfulness high enough that unsupported claims are rare, and every remaining failure reviewed by a person.",
        "Reliable refusal on unanswerable and out-of-scope questions.",
        "Citations that point to the source, so users can verify answers themselves.",
        "A feedback mechanism in the interface, and a named owner who reads what comes in.",
      ],
    },
    {
      type: "h2",
      text: "Keep evaluating after launch",
      id: "monitoring-after-launch",
    },
    {
      type: "p",
      text: "Production traffic will contain questions your golden set never anticipated, and your documents will change underneath you. Treat launch as the point where your evaluation data gets much better, not the point where evaluation stops.",
    },
    {
      type: "ul",
      items: [
        "Sample a small percentage of live answers each day and run the faithfulness judge on them.",
        "Track retrieval signals that need no labels, such as top-result similarity scores and how often no chunk clears your relevance threshold.",
        "Route thumbs-down feedback and low-confidence answers into a review queue, and promote the useful ones into the golden set.",
        "Re-run the full suite whenever the corpus is re-indexed or a model version changes.",
      ],
    },
    {
      type: "p",
      text: "We cover the operational side of this, including tracing, alerting and drift checks, on our [deployment and monitoring](/services/ai-deployment-and-monitoring) page.",
    },
    {
      type: "h2",
      text: "What to do next",
      id: "what-to-do-next",
    },
    {
      type: "p",
      text: "If you have a RAG prototype and no evaluation set, start this week: export a few hundred real questions, label the relevant sources for the first 150, and compute recall@5. That single number will tell you where to spend the next month. If retrieval turns out to be the weak link, our article on [hybrid retrieval for business documents](/articles/hybrid-retrieval-for-business-documents) is a good next read. And if you want help building the harness itself, our [RAG development](/services/rag-development) team does this as a standard part of every engagement.",
    },
  ],
};
