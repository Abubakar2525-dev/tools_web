import type { Article } from "../types";

export const article: Article = {
  slug: "reducing-llm-latency-and-cost",
  title: "Reducing LLM latency and cost without hurting quality",
  metaTitle: "Reducing LLM latency and cost safely",
  description:
    "A practical playbook for LLM cost optimization: measure per feature, stream, cache prompts, route to smaller models and guard quality with evals as you cut.",
  category: "LLM Engineering",
  publishedAt: "2026-10-12",
  author: { name: "Nuvella Promo Code Team", role: "Editorial team" },
  primaryKeyword: "LLM cost optimization",
  relatedServices: ["llm-integration", "ai-deployment-and-monitoring"],
  body: [
    {
      type: "p",
      text: "Most LLM features ship slower and more expensive than they need to be. That is usually fine at launch, when the priority is proving the feature works. It stops being fine when usage grows, the monthly bill becomes a line item someone asks about, and users start noticing the spinner.",
    },
    {
      type: "p",
      text: "The good news is that the biggest savings rarely require a clever trick. They come from knowing where tokens and milliseconds actually go, then applying a handful of well-understood techniques in the right order. The bad news is that every one of those techniques can quietly degrade quality if you apply it blind. Here is the order we use, and how to keep quality honest while you cut.",
    },
    { type: "h2", text: "Measure before you optimize", id: "measure-first" },
    {
      type: "p",
      text: "You cannot reduce what you cannot attribute. A single total on the provider invoice tells you nothing about which feature, prompt or customer is driving spend. Before changing anything, instrument every model call with enough metadata to slice the numbers later.",
    },
    {
      type: "ul",
      items: [
        "**Per-feature token accounting.** Tag each call with the feature, prompt version and model. Record input, cached input and output tokens separately, because they are priced differently and respond to different fixes.",
        "**Latency percentiles, not averages.** Track p50 and p95 for time to first token and total time. The p95 is where users lose patience, and it often has a different cause from the median (long contexts, retries, tool loops).",
        "**Cost per successful task.** This is the metric that matters. A cheap call that fails and gets retried twice, or produces an answer the user rejects, is not cheap. Divide total spend for a feature by the number of tasks that actually succeeded.",
      ],
    },
    {
      type: "p",
      text: "In our experience, one or two features usually account for most of the spend, and within them a small number of prompts dominate. That tells you where to focus.",
    },
    { type: "h2", text: "Make it feel fast, then make it fast", id: "perceived-latency" },
    {
      type: "p",
      text: "Perceived latency and actual latency are different problems. For any user-facing generation, **stream the response**. Time to first token matters more to how fast a feature feels than total generation time, and streaming turns a five-second wait into a response that starts almost immediately.",
    },
    {
      type: "p",
      text: "Streaming does not help when the output is consumed by code rather than a person, or when you must validate the whole response before showing it. In those cases, look at what you can show early: a progress state that reflects real steps, partial results from earlier pipeline stages, or a fast summary while the detailed answer completes. Also check that you are not running sequential calls that could run in parallel. Independent retrieval and classification steps are often chained for no good reason.",
    },
    { type: "h2", text: "Structure prompts for caching", id: "prompt-caching" },
    {
      type: "p",
      text: "Most major providers now offer some form of prompt caching, where a repeated prefix is billed at a reduced rate and processed faster. The catch is that it only works on an exact prefix match. Any variable content near the top of the prompt breaks the cache for everything after it.",
    },
    {
      type: "ol",
      items: [
        "Put the **static content first**: system instructions, tool definitions, few-shot examples and long reference material that rarely changes.",
        "Put **semi-static content next**, such as per-tenant configuration or a user profile that changes rarely within a session.",
        "Put **dynamic content last**: retrieved chunks, the conversation turn, timestamps and request IDs.",
      ],
    },
    {
      type: "p",
      text: "A common mistake is injecting the current date or a trace ID into the system prompt. It looks harmless and silently defeats caching on every call. Once the prompt is restructured, check the cached-token field in your telemetry to confirm hits are actually happening.",
    },
    { type: "h2", text: "Route to the smallest model that works", id: "model-routing" },
    {
      type: "p",
      text: "Many requests do not need your most capable model. Classification, extraction from clean text, short rewrites and simple lookups are often handled well by a model that is several times cheaper and faster. The trick is deciding which requests those are without a human in the loop.",
    },
    {
      type: "p",
      text: "Two patterns work well. A **router** picks a model up front based on cheap signals such as task type, input length or a lightweight classifier. A **cascade** tries the small model first and escalates to the larger one when the result looks unreliable. Cascades are easier to get right because the escalation signal is grounded in the actual output.",
    },
    {
      type: "code",
      lang: "python",
      caption: "A minimal two-tier cascade with schema validation and a confidence check",
      code: `from dataclasses import dataclass
from pydantic import BaseModel, ValidationError


class TicketLabel(BaseModel):
    category: str
    confidence: float  # model's self-reported 0-1 score
    reason: str


ALLOWED = {"billing", "bug", "feature_request", "account", "other"}


@dataclass
class Result:
    label: TicketLabel
    model: str
    escalated: bool


def try_model(client, model: str, ticket: str) -> TicketLabel | None:
    raw = client.complete_json(model=model, prompt=build_prompt(ticket))
    try:
        label = TicketLabel.model_validate_json(raw)
    except ValidationError:
        return None
    if label.category not in ALLOWED:
        return None
    return label


def classify(client, ticket: str, threshold: float = 0.8) -> Result:
    small = try_model(client, "small-model", ticket)
    if small is not None and small.confidence >= threshold:
        return Result(small, "small-model", escalated=False)

    large = try_model(client, "large-model", ticket)
    if large is None:
        raise RuntimeError("Both tiers failed validation")
    return Result(large, "large-model", escalated=True)`,
    },
    {
      type: "p",
      text: "Self-reported confidence is a weak signal on its own, so treat the threshold as something you tune against an evaluation set, not a number you trust. Stronger escalation signals include schema validation failures, disagreement between two cheap samples, retrieval scores below a floor, or a verifier check. Log the escalation rate: if it creeps above roughly half, the cascade is adding latency without saving much.",
    },
    { type: "h2", text: "Cut tokens and retries", id: "cut-tokens-and-retries" },
    { type: "h3", text: "Trim the context", id: "trim-context" },
    {
      type: "p",
      text: "Long contexts cost money on every call and slow down time to first token. Audit what you send. Retrieval pipelines often pass ten chunks when the answer is reliably in the top three, and chat features often resend the entire history when a rolling summary plus the last few turns would do. Strip boilerplate, HTML and duplicated headers from retrieved documents before they reach the prompt. If you are unsure how many chunks you need, measure answer quality at different cut-offs; our guide to [evaluating RAG before launch](/articles/evaluating-rag-before-launch) covers how.",
    },
    { type: "h3", text: "Use structured outputs to stop retry loops", id: "structured-outputs" },
    {
      type: "p",
      text: "Free-form output parsed with regular expressions is a hidden cost centre. Every parse failure triggers a retry, which doubles cost and latency for that request and inflates your p95. Use the provider's structured output or JSON schema mode where available, keep schemas small, and validate on receipt. Asking for concise output also helps, since output tokens are typically priced higher than input tokens and generated more slowly.",
    },
    { type: "h3", text: "Batch what is not interactive", id: "batching" },
    {
      type: "p",
      text: "Nightly enrichment, backfills, document classification and evaluation runs do not need real-time responses. Several providers offer batch APIs at a meaningful discount in exchange for slower turnaround. Moving offline workloads there is often the single easiest saving available.",
    },
    { type: "h3", text: "Be careful with semantic caching", id: "semantic-caching" },
    {
      type: "p",
      text: "Semantic caching returns a stored answer when a new query is similar enough to an old one. It can work for narrow FAQ-style traffic but is risky elsewhere. Two questions can be close in embedding space and need different answers (\"cancel my order\" versus \"don't cancel my order\"), cached answers go stale when source data changes, and a shared cache can leak one user's answer to another if permissions differ. If you use it, scope the cache per tenant and permission set, set short expiry, and keep a high similarity threshold.",
    },
    {
      type: "callout",
      title: "The practical order",
      text: "Instrument first, then restructure prompts for caching and move offline jobs to batch. Those two changes carry little quality risk. Only then try routing, context trimming and caching of answers, each one behind an evaluation gate.",
    },
    { type: "h2", text: "Guard quality while you cut", id: "guard-quality" },
    {
      type: "p",
      text: "Every optimization above is a change to model behaviour, even if it does not feel like one. A shorter context drops a fact the model needed. A smaller model handles the common case but fumbles edge cases. A reordered prompt shifts emphasis. Without a regression check you will find out from users.",
    },
    {
      type: "ul",
      items: [
        "Keep a **labelled evaluation set** per feature, weighted toward the hard and high-stakes cases, and run it on every prompt or routing change.",
        "Compare **cost per successful task** before and after, not raw cost. A change that cuts spend but lowers the success rate can be a net loss.",
        "Roll out behind a flag and watch production signals (user corrections, thumbs down, escalations to humans) for a few days before calling it done.",
      ],
    },
    { type: "h2", text: "What to do next", id: "what-to-do-next" },
    {
      type: "p",
      text: "Pick the most expensive feature, add per-call tagging this week, and get a baseline for cost per successful task and p95 latency. From there, the prompt caching and batching changes are usually a few days of work. If you want help designing the routing and monitoring layer, see our [LLM integration](/services/llm-integration) and [deployment and monitoring](/services/ai-deployment-and-monitoring) services, or [get in touch](/contact).",
    },
  ],
};
