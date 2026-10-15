import type { Article } from "../types";

export const article: Article = {
  slug: "designing-ai-agents-that-fail-safely",
  title: "Designing AI agents that fail safely",
  description:
    "AI agent design for production: typed tool contracts, side-effect classes, budgets, human approval for irreversible steps, traces, and when not to use an agent.",
  category: "Agents",
  publishedAt: "2026-10-12",
  author: { name: "Nuvella Promo Code Team", role: "Editorial team" },
  primaryKeyword: "AI agent design",
  relatedServices: ["ai-agent-development", "ai-workflow-automation"],
  body: [
    {
      type: "p",
      text: "Every agent fails eventually. The model misreads a tool result, loops on the same call, picks the wrong customer record or confidently invents an argument. You cannot prompt your way out of that. What you can control is what happens next: whether the failure is caught, contained and handed to a person, or whether it quietly sends an email, issues a refund or deletes a row.",
    },
    {
      type: "p",
      text: "Good **AI agent design** starts from that assumption. Treat the model as a capable but unreliable planner, and put the safety in the code around it. This article covers the controls we put in place before an agent touches a real system.",
    },
    {
      type: "h2",
      text: "Give tools narrow, typed contracts",
      id: "narrow-tool-contracts",
    },
    {
      type: "p",
      text: "The tool interface is the main boundary between the model and your systems, so design it as you would a public API for an untrusted caller. A tool called `run_sql` or `call_api` hands the model your entire attack surface. A tool called `get_order_status` that takes one validated order ID hands it almost nothing.",
    },
    {
      type: "ul",
      items: [
        "**One job per tool.** Prefer several small tools over one flexible one. They are easier to describe, test and permission.",
        "**Strict input schemas.** Use enums instead of free strings, regex patterns for IDs, and numeric bounds on amounts and counts. Reject anything that does not parse rather than trying to repair it.",
        "**Scoped credentials.** Each tool runs with the minimum permissions it needs, ideally on behalf of the end user rather than a shared service account.",
        "**Useful errors.** Return short, structured error messages the model can act on, such as \"order not found\" instead of a stack trace.",
      ],
    },
    {
      type: "h2",
      text: "Classify every side effect",
      id: "side-effect-classification",
    },
    {
      type: "p",
      text: "Not all tool calls carry the same risk, and your runtime should know the difference without asking the model. We tag every tool with one of three effect classes:",
    },
    {
      type: "ul",
      items: [
        "**Read**: no state changes. Safe to retry and safe to run automatically.",
        "**Write**: changes state but can be undone or corrected, such as drafting a reply, updating a ticket field or creating a calendar hold.",
        "**Irreversible**: cannot be cleanly undone, such as sending an external email, moving money, deleting data or posting publicly.",
      ],
    },
    {
      type: "p",
      text: "Write and irreversible tools must be **idempotent**. Require an idempotency key in the arguments and have the backing service ignore repeats. Agents retry, orchestrators restart and networks time out; without idempotency, a single confused loop can issue the same refund three times.",
    },
    {
      type: "code",
      lang: "typescript",
      caption: "A typed tool with an effect class, plus a policy guard that runs before every call.",
      code: `import { z } from "zod";

type Effect = "read" | "write" | "irreversible";

interface RunContext {
  runId: string;
  stepsUsed: number;
  costUsd: number;
  startedAt: number;
  approvedKeys: Set<string>; // idempotency keys a human has approved
}

interface Tool<S extends z.ZodTypeAny> {
  name: string;
  effect: Effect;
  input: S;
  run: (args: z.infer<S>, ctx: RunContext) => Promise<unknown>;
}

const defineTool = <S extends z.ZodTypeAny>(tool: Tool<S>) => tool;

export const issueRefund = defineTool({
  name: "issue_refund",
  effect: "irreversible",
  input: z.object({
    orderId: z.string().regex(/^ORD-\\d{8}$/),
    amountCents: z.number().int().positive().max(50_000),
    reason: z.enum(["damaged", "not_delivered", "duplicate_charge"]),
    idempotencyKey: z.string().uuid(),
  }),
  run: async (args) => payments.refund(args), // payments: your billing client
});

const LIMITS = { maxSteps: 25, maxCostUsd: 1.5, maxMs: 120_000 };

type Verdict =
  | { allow: true; args: unknown }
  | { allow: false; reason: string; escalate: boolean };

export function guard(
  tool: Tool<z.ZodTypeAny>,
  rawArgs: unknown,
  ctx: RunContext
): Verdict {
  if (ctx.stepsUsed >= LIMITS.maxSteps)
    return { allow: false, reason: "step budget exhausted", escalate: true };
  if (ctx.costUsd >= LIMITS.maxCostUsd)
    return { allow: false, reason: "cost budget exhausted", escalate: true };
  if (Date.now() - ctx.startedAt >= LIMITS.maxMs)
    return { allow: false, reason: "time budget exhausted", escalate: true };

  const parsed = tool.input.safeParse(rawArgs);
  if (!parsed.success)
    return { allow: false, reason: parsed.error.message, escalate: false };

  if (tool.effect === "irreversible") {
    const key = (parsed.data as { idempotencyKey?: string }).idempotencyKey;
    if (!key || !ctx.approvedKeys.has(key))
      return { allow: false, reason: "awaiting human approval", escalate: true };
  }
  return { allow: true, args: parsed.data };
}`,
    },
    {
      type: "p",
      text: "The guard lives in the orchestrator, not the prompt. The model never decides whether its own call is allowed. A validation failure goes back to the model as feedback so it can correct itself; a budget or approval failure stops the run and escalates.",
    },
    {
      type: "h2",
      text: "Budgets and human checkpoints",
      id: "budgets-and-human-checkpoints",
    },
    {
      type: "h3",
      text: "Step, time and cost budgets",
      id: "step-time-cost-budgets",
    },
    {
      type: "p",
      text: "An agent stuck in a loop looks exactly like an agent working hard, right up until the bill arrives. Set hard limits on the number of steps, wall-clock time and token spend per run, and enforce them outside the model. Size the limits from observed traces of successful runs plus a reasonable margin, not from guesswork. Also detect repetition directly: the same tool called with the same arguments twice in a row is almost always a sign of a stuck plan.",
    },
    {
      type: "h3",
      text: "Approval for irreversible actions",
      id: "approval-for-irreversible-actions",
    },
    {
      type: "p",
      text: "For irreversible tools, the agent proposes and a person disposes. The run pauses, persists its state, and presents the reviewer with the exact action, its arguments and the evidence the agent used to justify it. Approval releases that one idempotency key; it does not grant blanket permission for the rest of the run. Make the approval screen fast to read. If reviewers have to dig through a transcript, they will start approving without looking.",
    },
    {
      type: "callout",
      title: "Practical takeaway",
      text: "List every tool your agent can call and tag each as read, write or irreversible. Any irreversible tool without an idempotency key and a human approval step is the first thing to fix, before any prompt tuning.",
    },
    {
      type: "h2",
      text: "Trace everything, and plan the fallback",
      id: "traces-fallbacks-escalation",
    },
    {
      type: "p",
      text: "When an agent does something odd, \"the model decided to\" is not an acceptable incident report. Record a structured trace for every run: each model call with its inputs and outputs, each tool call with arguments, result, latency and effect class, every guard decision, and the final outcome. Tie it all to a run ID that also appears in the logs of downstream systems. These traces are what you debug from, what you build evaluation sets from, and what you show an auditor.",
    },
    {
      type: "p",
      text: "Then decide in advance what happens when things go wrong:",
    },
    {
      type: "ul",
      items: [
        "**Retry** transient tool errors with backoff, relying on idempotency to make that safe.",
        "**Degrade** to a narrower mode, for example drafting a response for a person to send instead of sending it.",
        "**Escalate** to a human queue with the trace attached and a one-line summary of where the agent got stuck.",
        "**Stop cleanly**, leaving no half-finished writes. Where a multi-step write can fail midway, design compensating actions up front.",
      ],
    },
    {
      type: "h2",
      text: "Know when not to build an agent",
      id: "when-not-to-use-an-agent",
    },
    {
      type: "p",
      text: "Many processes described as needing an agent are really fixed workflows with one or two judgment calls inside them. If you can draw the steps as a flowchart that rarely changes, build the flowchart in code and call a model only at the points that need language understanding: classifying a request, extracting fields, drafting text. That design is cheaper, faster, easier to test and far easier to explain when something breaks.",
    },
    {
      type: "p",
      text: "Agents earn their place when the path genuinely varies from case to case and the set of useful actions is too large to enumerate. Even then, a hybrid often works best: a deterministic workflow that hands a bounded sub-task to an agent with a small toolset. Our [AI workflow automation](/services/ai-workflow-automation) work frequently starts with an agent proposal and ends with a simpler, more reliable workflow.",
    },
    {
      type: "h2",
      text: "What to do next",
      id: "what-to-do-next",
    },
    {
      type: "p",
      text: "Audit an agent you already have, or one you are planning. Write down its tools and their effect classes, its budgets, where a human approves actions and what it does when it gets stuck. Any blank in that list is a failure mode you have not designed yet. If the agent processes untrusted content such as emails or web pages, pair this with our [prompt injection defense checklist](/articles/prompt-injection-defense-checklist). And if you want a second pair of eyes on the design, our [AI agent development](/services/ai-agent-development) team is happy to review it.",
    },
  ],
};
