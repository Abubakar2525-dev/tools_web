"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Btn,
  CellInput,
  CellSelect,
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  PrivacyNote,
  ResetBtn,
  Segmented,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  uid,
  usePersistentState,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

const INPUT_KINDS = [
  { value: "documents", label: "Documents or wiki pages" },
  { value: "messages", label: "Emails, chats or tickets" },
  { value: "structured", label: "Database or spreadsheet" },
  { value: "images", label: "Images, scans or PDFs" },
  { value: "apis", label: "App or API data" },
  { value: "other", label: "Other" },
] as const;
type InputKind = (typeof INPUT_KINDS)[number]["value"];

const ACCESS = [
  { value: "read", label: "Read only" },
  { value: "write", label: "Read and write" },
] as const;
type Access = (typeof ACCESS)[number]["value"];

const OUTPUT_KINDS = [
  { key: "answers", label: "Answers to questions", hint: "People ask, the system answers from your content." },
  { key: "extraction", label: "Structured data extraction", hint: "Pull fields out of documents into a fixed format." },
  { key: "actions", label: "Actions in other systems", hint: "Create tickets, update records, send messages." },
  { key: "content", label: "Drafted content", hint: "Replies, summaries, reports for a person to finish." },
  { key: "classification", label: "Classification or routing", hint: "Tag, prioritize or send items to the right queue." },
] as const;
type OutputKind = (typeof OUTPUT_KINDS)[number]["key"];

const CONSTRAINTS = [
  { key: "privacy", label: "Privacy", hint: "Personal or sensitive data is involved." },
  { key: "compliance", label: "Compliance", hint: "Regulated industry, audits or data residency rules." },
  { key: "latency", label: "Latency", hint: "Answers are needed in a few seconds or less." },
  { key: "budget", label: "Budget", hint: "Running costs per task must stay low." },
] as const;
type ConstraintKey = (typeof CONSTRAINTS)[number]["key"];

type Risk = "" | "low" | "medium" | "high";
type Review = "" | "yes" | "no";

type InputEntry = { id: string; text: string; kind: InputKind };
type IntegrationEntry = { id: string; text: string; access: Access };

type Plan = {
  name: string;
  problem: string;
  users: string;
  current: string;
  goal: string;
  metric: string;
  inputs: InputEntry[];
  outputKinds: Record<OutputKind, boolean>;
  outputs: string;
  integrations: IntegrationEntry[];
  constraints: Record<ConstraintKey, boolean>;
  constraintNotes: string;
  risk: Risk;
  riskNotes: string;
  review: Review;
};

const INITIAL: Plan = {
  name: "",
  problem: "",
  users: "",
  current: "",
  goal: "",
  metric: "",
  inputs: [],
  outputKinds: { answers: false, extraction: false, actions: false, content: false, classification: false },
  outputs: "",
  integrations: [],
  constraints: { privacy: false, compliance: false, latency: false, budget: false },
  constraintNotes: "",
  risk: "",
  riskNotes: "",
  review: "",
};

const EXAMPLE: Plan = {
  name: "Support answer assistant",
  problem:
    "Support agents spend a large part of each ticket searching the help center and old tickets for the right answer, and answers vary between agents.",
  users: "Tier 1 support agents (about 25 people), later customers through the help widget",
  current: "Agents search the help center and Slack by hand, then write replies from scratch in the helpdesk.",
  goal: "Cut time to first reply and make answers consistent with current policy.",
  metric: "Median handle time down 30%, with at least 85% of drafted replies sent with minor or no edits.",
  inputs: [
    { id: "ex-in-1", text: "Help center articles (about 400)", kind: "documents" },
    { id: "ex-in-2", text: "Resolved tickets from the last 12 months", kind: "messages" },
    { id: "ex-in-3", text: "Plan and billing data per customer", kind: "structured" },
  ],
  outputKinds: { answers: true, extraction: false, actions: true, content: true, classification: false },
  outputs: "A drafted reply with cited sources, plus a suggested ticket tag and priority.",
  integrations: [
    { id: "ex-int-1", text: "Helpdesk (Zendesk)", access: "write" },
    { id: "ex-int-2", text: "Billing system", access: "read" },
  ],
  constraints: { privacy: true, compliance: false, latency: true, budget: false },
  constraintNotes: "Customer emails contain personal data. Drafts should appear within 5 seconds.",
  risk: "medium",
  riskNotes: "A wrong refund policy answer could cost money and trust.",
  review: "yes",
};

function normalize(p: Partial<Plan> | null | undefined): Plan {
  const v = p ?? {};
  return {
    ...INITIAL,
    ...v,
    inputs: Array.isArray(v.inputs) ? v.inputs : [],
    integrations: Array.isArray(v.integrations) ? v.integrations : [],
    outputKinds: { ...INITIAL.outputKinds, ...(v.outputKinds ?? {}) },
    constraints: { ...INITIAL.constraints, ...(v.constraints ?? {}) },
  };
}

/* ------------------------------------------------------------------ */
/* Plan generation (simple rules, no AI)                               */
/* ------------------------------------------------------------------ */

type Section = {
  title: string;
  paras?: string[];
  bullets?: string[];
  steps?: { title: string; text: string }[];
};

const label = <T extends { value: string; label: string }>(list: readonly T[], v: string) =>
  list.find((x) => x.value === v)?.label ?? v;

function buildPlan(p: Plan): { title: string; sections: Section[] } {
  const t = (s: string) => s.trim();
  const inputs = p.inputs.filter((x) => t(x.text));
  const integrations = p.integrations.filter((x) => t(x.text));
  const kinds = new Set(inputs.map((x) => x.kind));
  const outs = p.outputKinds;
  const hasDocs = kinds.has("documents") || kinds.has("messages") || kinds.has("images");
  const writes = integrations.some((x) => x.access === "write");
  const activeConstraints = CONSTRAINTS.filter((c) => p.constraints[c.key]);

  /* Summary */
  const summary: string[] = [];
  summary.push(t(p.problem) ? `**Problem.** ${t(p.problem)}` : "**Problem.** Not described yet.");
  if (t(p.users)) summary.push(`**Users.** ${t(p.users)}`);
  if (t(p.current)) summary.push(`**Today.** ${t(p.current)}`);

  /* Goals */
  const goals: string[] = [];
  goals.push(t(p.goal) ? `Goal: ${t(p.goal)}` : "Goal: not set yet.");
  goals.push(t(p.metric) ? `Success metric: ${t(p.metric)}` : "Success metric: not set yet. Pick one number you can measure before and after.");
  if (p.risk) goals.push(`Error tolerance: ${p.risk} risk if the AI is wrong${t(p.riskNotes) ? ` (${t(p.riskNotes)})` : ""}.`);
  goals.push(p.review === "yes" ? "A person reviews outputs before they take effect." : p.review === "no" ? "Outputs take effect without a person reviewing them." : "Human review: not decided yet.");

  /* Inputs, outputs, integrations */
  const inputBullets = inputs.length
    ? inputs.map((x) => `${t(x.text)} (${label(INPUT_KINDS, x.kind).toLowerCase()})`)
    : ["No data sources listed yet."];

  const outputBullets: string[] = OUTPUT_KINDS.filter((o) => outs[o.key]).map((o) => o.label);
  if (t(p.outputs)) outputBullets.push(`Details: ${t(p.outputs)}`);
  if (!outputBullets.length) outputBullets.push("No outputs described yet.");

  const integrationBullets = integrations.length
    ? integrations.map((x) => `${t(x.text)} (${label(ACCESS, x.access).toLowerCase()})`)
    : ["No integrations listed. The first version can run as a standalone tool."];

  const constraintBullets: string[] = activeConstraints.map((c) => c.label);
  if (t(p.constraintNotes)) constraintBullets.push(`Notes: ${t(p.constraintNotes)}`);

  /* Suggested approach */
  const approach: string[] = [];
  if (outs.answers && hasDocs) {
    approach.push(
      "**Retrieval-augmented generation (RAG).** Index your documents, retrieve the most relevant passages for each question and have the model answer only from them, with citations. Start with a small, well-maintained slice of content.",
    );
  } else if (outs.answers && kinds.has("structured")) {
    approach.push(
      "**Question answering over structured data.** Translate questions into safe, read-only queries against a curated view of your data, and show the query alongside the answer.",
    );
  } else if (outs.answers) {
    approach.push("**Grounded question answering.** Decide which source of truth answers come from before choosing a model; ungrounded answers are hard to trust.");
  }
  if (outs.actions || writes) {
    approach.push(
      "**Agent with approval checkpoints.** Give the model a small set of narrowly scoped tools, log every call and require a person to approve anything that writes to another system until error rates are proven low.",
    );
  }
  if (outs.extraction) {
    approach.push(
      `**Extraction workflow with validation.** Define a strict output schema, validate every field (types, formats, allowed values) and route failures to a review queue.${kinds.has("images") ? " Add an OCR or document-parsing step for scans and PDFs." : ""}`,
    );
  }
  if (outs.classification) {
    approach.push("**Classifier with confidence thresholds.** Auto-apply only high-confidence labels and send the rest to a person. Track accuracy per label.");
  }
  if (outs.content) {
    approach.push("**Drafting with templates.** Generate drafts from approved templates and tone guidelines, and keep a person as the final editor.");
  }
  if (p.risk === "high" || (p.risk === "medium" && p.review !== "no")) {
    approach.push(
      `**Human in the loop and evaluations.** Build a test set of real examples with expected outputs before launch, run it on every change, and ${p.risk === "high" ? "keep human approval on every output" : "spot-check a sample of outputs each week"}.`,
    );
  }
  if (p.constraints.privacy || p.constraints.compliance) {
    approach.push("**Data handling.** Redact or minimize personal data before it reaches the model, confirm where data is processed and stored, and check vendor data retention terms.");
  }
  if (p.constraints.latency) approach.push("**Speed.** Stream responses, cache frequent results and test smaller, faster models for simple steps.");
  if (p.constraints.budget) approach.push("**Cost.** Estimate cost per task early, route easy cases to cheaper models and cap usage per user.");
  if (!approach.length) {
    approach.push("Not enough detail for a specific pattern yet. Describe the inputs and pick at least one output type to get a suggestion. A safe default is a narrow prototype on one data source with one clear output.");
  }

  /* Implementation steps */
  const steps = [
    {
      title: "Discovery (1 to 2 weeks)",
      text: `Confirm the problem with ${t(p.users) || "the people who will use it"}, collect 30 to 50 real examples, ${inputs.length ? "check access to each data source" : "identify the data sources"} and agree on how the success metric is measured.`,
    },
    {
      title: "Prototype (2 to 3 weeks)",
      text: `Build the smallest end-to-end version${outs.answers && hasDocs ? " (ingest a subset of documents, retrieve, answer with citations)" : ""}${outs.actions || writes ? " with all write actions behind an approval step" : ""}. Keep it outside production systems.`,
    },
    {
      title: "Evaluation (1 to 2 weeks)",
      text: "Score the prototype against the example set: accuracy, failure types, latency and cost per task. Decide what score is good enough to pilot.",
    },
    {
      title: "Pilot (3 to 6 weeks)",
      text: `Release to a small group${p.review !== "no" ? " with human review on" : ""}, track the success metric against the baseline and collect feedback on every bad output.`,
    },
    {
      title: "Rollout",
      text: "Expand in stages, add monitoring and alerts for quality drift, document ownership and set a regular review of the evaluation set.",
    },
  ];

  /* Risks and open questions */
  const risks: string[] = [];
  if (!t(p.problem)) risks.push("The problem statement is missing. Without it, scope will drift.");
  if (!t(p.users)) risks.push("Who uses this? The users aren't defined.");
  if (!t(p.current)) risks.push("The current process isn't described, so there's no baseline to compare against.");
  if (!t(p.metric)) risks.push("No success metric. How will you know the pilot worked?");
  if (!inputs.length) risks.push("No data sources listed. Where does the model get its information?");
  if (!OUTPUT_KINDS.some((o) => outs[o.key]) && !t(p.outputs)) risks.push("The outputs are undefined. What exactly should the system produce?");
  if (!p.risk) risks.push("The cost of a wrong answer hasn't been assessed.");
  if (!p.review) risks.push("It isn't decided whether a person reviews outputs.");
  if (p.risk === "high" && p.review === "no") risks.push("High error risk with no human review is a red flag. Add review, at least during the pilot.");
  if (writes && p.review === "no") risks.push("The system writes to other systems without review. Limit permissions and add approvals or undo paths.");
  if (hasDocs && outs.answers) risks.push("Is the content current and owned? Retrieval quality depends on clean, up-to-date documents.");
  if (kinds.has("images")) risks.push("Scans and images need reliable text extraction. Test OCR quality on real samples early.");
  if (p.constraints.privacy && !t(p.constraintNotes)) risks.push("Privacy is flagged but not described. Which data is sensitive, and who may see it?");
  if (p.constraints.compliance) risks.push("Which regulations apply, and who signs off before launch?");
  if (!integrations.length && (outs.actions || outs.classification)) risks.push("Actions or routing need an integration, but none are listed.");
  if (!risks.length) risks.push("No obvious gaps. Pressure-test the plan with the people who own the data and the process.");

  const sections: Section[] = [
    { title: "Summary", paras: summary },
    { title: "Goals and success metrics", bullets: goals },
    { title: "Inputs", bullets: inputBullets },
    { title: "Outputs", bullets: outputBullets },
    { title: "Integrations", bullets: integrationBullets },
  ];
  if (constraintBullets.length) sections.push({ title: "Constraints", bullets: constraintBullets });
  sections.push(
    { title: "Suggested approach", paras: ["Suggestions come from simple rules based on your answers, not from an AI model.", ...approach] },
    { title: "Implementation steps", steps },
    { title: "Risks and open questions", bullets: risks },
  );

  return { title: t(p.name) || "AI use-case plan", sections };
}

function toMarkdown(plan: { title: string; sections: Section[] }) {
  const out: string[] = [`# ${plan.title}`, ""];
  for (const s of plan.sections) {
    out.push(`## ${s.title}`, "");
    s.paras?.forEach((p) => out.push(p, ""));
    if (s.bullets) {
      s.bullets.forEach((b) => out.push(`- ${b}`));
      out.push("");
    }
    if (s.steps) {
      s.steps.forEach((st, i) => out.push(`${i + 1}. **${st.title}.** ${st.text}`));
      out.push("");
    }
  }
  return out.join("\n").trim() + "\n";
}

/** Renders the tiny **bold** subset used in generated plan text. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [stored, setStored, clear] = usePersistentState<Plan>("ai-use-case-plan", INITIAL);
  const plan = useMemo(() => normalize(stored), [stored]);
  const update = (patch: Partial<Plan>) => setStored((prev) => ({ ...normalize(prev), ...patch }));

  const generated = useMemo(() => buildPlan(plan), [plan]);
  const markdown = useMemo(() => toMarkdown(generated), [generated]);

  const filled = [plan.problem, plan.users, plan.goal, plan.metric].filter((s) => s.trim()).length;
  const hasStarted =
    filled > 0 || plan.inputs.some((x) => x.text.trim()) || OUTPUT_KINDS.some((o) => plan.outputKinds[o.key]) || plan.outputs.trim() !== "";

  const fileName = `${(plan.name.trim() || "ai-use-case-plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ai-use-case-plan"}.md`;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ToolPanel
        title="Describe the use case"
        actions={
          <>
            <Btn variant="ghost" icon="compass" onClick={() => setStored(EXAMPLE)}>
              Load example
            </Btn>
            <ResetBtn onClick={clear} />
          </>
        }
      >
        <div className="space-y-6">
          <TextField label="Project name" optional value={plan.name} placeholder="Support answer assistant" onChange={(e) => update({ name: e.target.value })} />
          <TextArea
            label="Problem statement"
            hint="What is slow, costly or error-prone today?"
            value={plan.problem}
            onChange={(e) => update({ problem: e.target.value })}
          />
          <TextField label="Users" hint="Who uses the result, and roughly how many?" value={plan.users} onChange={(e) => update({ users: e.target.value })} />
          <TextArea label="Current process" hint="How is the work done now, step by step?" value={plan.current} onChange={(e) => update({ current: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Goal" value={plan.goal} onChange={(e) => update({ goal: e.target.value })} />
            <TextField label="Success metric" hint="One measurable number." value={plan.metric} onChange={(e) => update({ metric: e.target.value })} />
          </div>

          {/* Inputs */}
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium text-ink">Inputs (data sources)</legend>
            <p className="mt-1 text-[0.8125rem] text-muted">List each source and its type. The type drives the suggested approach.</p>
            {plan.inputs.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No data sources yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {plan.inputs.map((it, i) => (
                  <li key={it.id} className="grid gap-2 rounded-lg bg-sunken p-2 sm:grid-cols-[minmax(0,1fr)_13rem_auto] sm:bg-transparent sm:p-0">
                    <CellInput
                      label={`Data source ${i + 1}`}
                      value={it.text}
                      placeholder="Help center articles"
                      onChange={(e) => update({ inputs: plan.inputs.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)) })}
                    />
                    <div className="flex gap-2">
                      <CellSelect
                        label={`Data source ${i + 1} type`}
                        options={INPUT_KINDS}
                        value={it.kind}
                        className="flex-1"
                        onChange={(e) =>
                          update({ inputs: plan.inputs.map((x) => (x.id === it.id ? { ...x, kind: e.target.value as InputKind } : x)) })
                        }
                      />
                      <Btn
                        variant="subtle"
                        icon="trash"
                        aria-label={`Remove data source ${i + 1}`}
                        className="!px-2.5 sm:hidden"
                        onClick={() => update({ inputs: plan.inputs.filter((x) => x.id !== it.id) })}
                      />
                    </div>
                    <Btn
                      variant="subtle"
                      icon="trash"
                      aria-label={`Remove data source ${i + 1}`}
                      className="hidden !px-2.5 sm:inline-flex"
                      onClick={() => update({ inputs: plan.inputs.filter((x) => x.id !== it.id) })}
                    />
                  </li>
                ))}
              </ul>
            )}
            <Btn
              variant="ghost"
              icon="plus"
              className="mt-3"
              onClick={() => update({ inputs: [...plan.inputs, { id: uid(), text: "", kind: "documents" }] })}
            >
              Add data source
            </Btn>
          </fieldset>

          {/* Outputs */}
          <fieldset>
            <legend className="text-sm font-medium text-ink">Outputs</legend>
            <p className="mt-1 text-[0.8125rem] text-muted">What should the system produce? Pick all that apply.</p>
            <div className="mt-3 space-y-3">
              {OUTPUT_KINDS.map((o) => (
                <Checkbox
                  key={o.key}
                  label={o.label}
                  hint={o.hint}
                  checked={plan.outputKinds[o.key]}
                  onChange={(v) => update({ outputKinds: { ...plan.outputKinds, [o.key]: v } })}
                />
              ))}
            </div>
          </fieldset>
          <TextArea label="Output details" optional value={plan.outputs} placeholder="Format, length, where it shows up" onChange={(e) => update({ outputs: e.target.value })} />

          {/* Integrations */}
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium text-ink">Integrations</legend>
            <p className="mt-1 text-[0.8125rem] text-muted">Systems the solution reads from or writes to.</p>
            {plan.integrations.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No integrations yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {plan.integrations.map((it, i) => (
                  <li key={it.id} className="grid gap-2 rounded-lg bg-sunken p-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:bg-transparent sm:p-0">
                    <CellInput
                      label={`Integration ${i + 1}`}
                      value={it.text}
                      placeholder="CRM, helpdesk, ERP"
                      onChange={(e) =>
                        update({ integrations: plan.integrations.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)) })
                      }
                    />
                    <div className="flex gap-2">
                      <CellSelect
                        label={`Integration ${i + 1} access`}
                        options={ACCESS}
                        value={it.access}
                        className="flex-1"
                        onChange={(e) =>
                          update({
                            integrations: plan.integrations.map((x) => (x.id === it.id ? { ...x, access: e.target.value as Access } : x)),
                          })
                        }
                      />
                      <Btn
                        variant="subtle"
                        icon="trash"
                        aria-label={`Remove integration ${i + 1}`}
                        className="!px-2.5 sm:hidden"
                        onClick={() => update({ integrations: plan.integrations.filter((x) => x.id !== it.id) })}
                      />
                    </div>
                    <Btn
                      variant="subtle"
                      icon="trash"
                      aria-label={`Remove integration ${i + 1}`}
                      className="hidden !px-2.5 sm:inline-flex"
                      onClick={() => update({ integrations: plan.integrations.filter((x) => x.id !== it.id) })}
                    />
                  </li>
                ))}
              </ul>
            )}
            <Btn
              variant="ghost"
              icon="plus"
              className="mt-3"
              onClick={() => update({ integrations: [...plan.integrations, { id: uid(), text: "", access: "read" }] })}
            >
              Add integration
            </Btn>
          </fieldset>

          {/* Constraints */}
          <fieldset>
            <legend className="text-sm font-medium text-ink">Constraints</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {CONSTRAINTS.map((c) => (
                <Checkbox
                  key={c.key}
                  label={c.label}
                  hint={c.hint}
                  checked={plan.constraints[c.key]}
                  onChange={(v) => update({ constraints: { ...plan.constraints, [c.key]: v } })}
                />
              ))}
            </div>
          </fieldset>
          <TextArea label="Constraint notes" optional value={plan.constraintNotes} onChange={(e) => update({ constraintNotes: e.target.value })} />

          {/* Risk */}
          <div>
            <p className="text-sm font-medium text-ink">
              Risk of errors
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">What happens if the AI is wrong? Low: minor annoyance. High: money, safety or legal exposure.</p>
            <div className="mt-2">
              <Segmented<Risk>
                label="Risk of errors"
                value={plan.risk}
                onChange={(v) => update({ risk: v })}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
              />
            </div>
          </div>
          <TextField
            label="What could go wrong?"
            optional
            value={plan.riskNotes}
            placeholder="A wrong refund answer costs money"
            onChange={(e) => update({ riskNotes: e.target.value })}
          />
          <div>
            <p className="text-sm font-medium text-ink">Human review needed?</p>
            <p className="mt-1 text-[0.8125rem] text-muted">Does a person check outputs before they reach customers or other systems?</p>
            <div className="mt-2">
              <Segmented<Review>
                label="Human review needed"
                value={plan.review}
                onChange={(v) => update({ review: v })}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
              />
            </div>
          </div>

          <PrivacyNote stored />
        </div>
      </ToolPanel>

      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <ToolPanel
          title="Your plan"
          actions={
            <>
              <CopyBtn text={hasStarted ? markdown : ""} label="Copy Markdown" />
              <Btn variant="ghost" icon="download" disabled={!hasStarted} onClick={() => downloadFile(fileName, markdown, "text/markdown")}>
                Download .md
              </Btn>
            </>
          }
        >
          {!hasStarted ? (
            <EmptyState icon="compass" title="Your plan builds as you type">
              Start with the problem statement, or load the example to see a finished plan.
            </EmptyState>
          ) : (
            <div className="space-y-5">
              {filled < 4 && (
                <Notice tone="info">
                  {4 - filled} of the core fields (problem, users, goal, metric) {4 - filled === 1 ? "is" : "are"} still empty. Gaps show up under
                  risks and open questions.
                </Notice>
              )}
              <article aria-label="Generated plan" className="max-h-none space-y-6 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-2" tabIndex={0}>
                <p className="font-display text-[1.35rem] font-semibold tracking-[-0.02em] text-ink">{generated.title}</p>
                {generated.sections.map((s) => (
                  <section key={s.title} className="space-y-2.5">
                    <h3 className="text-[1.05rem] text-ink">{s.title}</h3>
                    {s.paras?.map((p, i) => (
                      <p
                        key={i}
                        className={`text-[0.95rem] leading-relaxed ${s.title === "Suggested approach" && i === 0 ? "text-[0.8125rem] text-muted" : "text-ink-2"}`}
                      >
                        <Rich text={p} />
                      </p>
                    ))}
                    {s.bullets && (
                      <ul className="space-y-1.5 text-[0.95rem] leading-relaxed text-ink-2">
                        {s.bullets.map((b, i) => (
                          <li key={i} className="flex gap-2.5">
                            <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-[2px] bg-accent" />
                            <span>
                              <Rich text={b} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.steps && (
                      <ol className="space-y-2.5 text-[0.95rem] leading-relaxed text-ink-2">
                        {s.steps.map((st, i) => (
                          <li key={st.title} className="flex gap-3">
                            <span aria-hidden="true" className="font-mono text-[0.85rem] text-muted">
                              {i + 1}.
                            </span>
                            <span>
                              <strong className="font-semibold text-ink">{st.title}.</strong> {st.text}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                ))}
              </article>
            </div>
          )}
          <p className="mt-6 border-t border-line pt-4 text-sm text-ink-2">
            Want a second opinion on the plan?{" "}
            <Link href="/contact" className="link font-medium">
              Talk to our engineers
            </Link>
          </p>
        </ToolPanel>
      </div>
    </div>
  );
}
