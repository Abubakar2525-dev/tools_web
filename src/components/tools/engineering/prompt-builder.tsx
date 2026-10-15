"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Btn,
  CopyBtn,
  EmptyState,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  SelectField,
  SplitGrid,
  StatGrid,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  fmt,
} from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";

/* ------------------------------------------------------------------ */
/* Types and helpers                                                   */
/* ------------------------------------------------------------------ */

type OutputFormat = "none" | "plain" | "bullets" | "json" | "table" | "steps";

type Constraint = { id: number; text: string };
type Example = { id: number; input: string; output: string };

type PromptState = {
  role: string;
  task: string;
  context: string;
  audience: string;
  inputData: string;
  tone: string;
  format: OutputFormat;
  fields: string;
  constraints: Constraint[];
  examples: Example[];
};

let idCounter = 0;
const nextId = () => {
  idCounter += 1;
  return idCounter;
};

const EMPTY: PromptState = {
  role: "",
  task: "",
  context: "",
  audience: "",
  inputData: "",
  tone: "",
  format: "none",
  fields: "",
  constraints: [],
  examples: [],
};

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "none", label: "Not specified" },
  { value: "plain", label: "Plain text" },
  { value: "bullets", label: "Bullet list" },
  { value: "json", label: "JSON with named fields" },
  { value: "table", label: "Markdown table" },
  { value: "steps", label: "Step-by-step" },
];

const TONE_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "neutral and precise", label: "Neutral and precise" },
  { value: "friendly and approachable", label: "Friendly and approachable" },
  { value: "formal and professional", label: "Formal and professional" },
  { value: "concise and direct", label: "Concise and direct" },
  { value: "encouraging and supportive", label: "Encouraging and supportive" },
  { value: "technical and detailed", label: "Technical and detailed" },
];

function splitFields(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatInstruction(format: OutputFormat, fieldsRaw: string): string | null {
  const fields = splitFields(fieldsRaw);
  switch (format) {
    case "plain":
      return "Respond in plain prose. Do not use Markdown, headings or lists.";
    case "bullets":
      return "Respond as a concise bulleted list. Keep one idea per bullet and avoid an introduction.";
    case "json":
      return fields.length
        ? `Respond with valid JSON only, with no prose and no code fences. Use exactly these top-level fields: ${fields
            .map((f) => `"${f}"`)
            .join(", ")}. Use null when a value is unknown.`
        : "Respond with valid JSON only, with no prose and no code fences.";
    case "table":
      return fields.length
        ? `Respond with a Markdown table using these columns, in order: ${fields.join(", ")}. Add no text outside the table.`
        : "Respond with a Markdown table. Add no text outside the table.";
    case "steps":
      return "Respond with numbered steps. Start each step with an action verb and keep each step to one or two sentences.";
    default:
      return null;
  }
}

function section(tag: string, body: string) {
  return `<${tag}>\n${body.trim()}\n</${tag}>`;
}

function assemble(s: PromptState): { text: string; count: number } {
  const parts: string[] = [];
  const role = s.role.trim();
  if (role) parts.push(section("role", /^you\b/i.test(role) ? role : `You are ${role}.`.replace(/\.\.$/, ".")));
  if (s.task.trim()) parts.push(section("task", s.task));
  if (s.context.trim()) parts.push(section("context", s.context));
  if (s.audience.trim()) parts.push(section("audience", `Write for: ${s.audience.trim()}`));
  const constraints = s.constraints.map((c) => c.text.trim()).filter(Boolean);
  if (constraints.length) parts.push(section("constraints", constraints.map((c) => `- ${c}`).join("\n")));
  if (s.tone) parts.push(section("tone", `Use a ${s.tone} tone.`));
  const examples = s.examples.filter((e) => e.input.trim() || e.output.trim());
  if (examples.length) {
    const body = examples
      .map(
        (e, i) =>
          `<example index="${i + 1}">\n<example_input>\n${e.input.trim()}\n</example_input>\n<example_output>\n${e.output.trim()}\n</example_output>\n</example>`,
      )
      .join("\n");
    parts.push(section("examples", body));
  }
  const fmtLine = formatInstruction(s.format, s.fields);
  if (fmtLine) parts.push(section("output_format", fmtLine));
  if (s.inputData.trim()) parts.push(section("input_data", s.inputData));
  return { text: parts.join("\n\n"), count: parts.length };
}

type Check = { id: string; ok: boolean; level: "required" | "recommended" | "tip"; text: string };

const VAGUE_WORDS = /^(help|write|do|make|fix|improve|explain)(\s+(it|this|that|something|stuff|me))?\.?$/i;

function checklist(s: PromptState): Check[] {
  const task = s.task.trim();
  const words = task ? task.split(/\s+/).length : 0;
  const constraints = s.constraints.filter((c) => c.text.trim()).length;
  const halfExamples = s.examples.some((e) => Boolean(e.input.trim()) !== Boolean(e.output.trim()));
  const needsFields = (s.format === "json" || s.format === "table") && splitFields(s.fields).length === 0;
  return [
    { id: "task", ok: Boolean(task), level: "required", text: "Describe the task the model should perform." },
    {
      id: "specific",
      ok: words >= 8 && !VAGUE_WORDS.test(task),
      level: "recommended",
      text: words === 0
        ? "Make the task specific: say what to produce, from what, and why."
        : `Task is ${words} word${words === 1 ? "" : "s"}. Aim for at least 8 that name the deliverable and goal.`,
    },
    { id: "format", ok: s.format !== "none", level: "recommended", text: "Choose an output format so results are consistent." },
    {
      id: "fields",
      ok: !needsFields,
      level: "recommended",
      text: s.format === "table" ? "List the table columns you expect." : "List the JSON fields you expect.",
    },
    { id: "constraints", ok: constraints > 0, level: "recommended", text: "Add at least one constraint (length, scope, things to avoid)." },
    { id: "context", ok: Boolean(s.context.trim()), level: "tip", text: "Add context: background, goal or where the output will be used." },
    { id: "role", ok: Boolean(s.role.trim()), level: "tip", text: "Set a role to anchor expertise and vocabulary." },
    { id: "examples", ok: !halfExamples, level: "recommended", text: "Each example needs both an input and an output." },
  ];
}

const SAMPLE: Omit<PromptState, "constraints" | "examples"> & { constraints: string[]; examples: [string, string][] } = {
  role: "a senior support engineer who writes clear, empathetic customer replies",
  task: "Draft a reply to the customer email below that explains why their data export failed and gives them the steps to retry it successfully.",
  context:
    "We run a SaaS analytics product. Exports over 2 GB time out on the free plan. Paid plans support up to 20 GB. The customer is on the free plan.",
  audience: "a non-technical small business owner",
  inputData:
    "Hi, I tried to export my dashboard data three times today and it keeps failing with no explanation. I need this for a board meeting tomorrow. What is going on?",
  tone: "friendly and approachable",
  format: "json",
  fields: "subject, reply_body, suggested_next_step",
  constraints: [
    "Keep reply_body under 150 words.",
    "Do not promise refunds or discounts.",
    "Offer a workaround that works on the free plan before mentioning upgrades.",
  ],
  examples: [],
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [s, setS] = useState<PromptState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const deferred = useDeferredValue(s);

  const { text: prompt, count: sectionCount } = useMemo(() => assemble(deferred), [deferred]);
  const checks = useMemo(() => checklist(deferred), [deferred]);
  const chars = prompt.length;
  const approxTokens = Math.ceil(chars / 4);
  const taskMissing = !s.task.trim();
  const openChecks = checks.filter((c) => !c.ok);
  const otherFilled = Boolean(s.role.trim() || s.context.trim() || s.inputData.trim() || s.audience.trim());

  const set = <K extends keyof PromptState>(key: K, value: PromptState[K]) => {
    setLoaded(false);
    setS((prev) => ({ ...prev, [key]: value }));
  };

  const loadExample = () => {
    setS({
      ...SAMPLE,
      constraints: SAMPLE.constraints.map((text) => ({ id: nextId(), text })),
      examples: SAMPLE.examples.map(([input, output]) => ({ id: nextId(), input, output })),
    });
    setLoaded(true);
  };

  const reset = () => {
    setS(EMPTY);
    setLoaded(false);
  };

  const updateConstraint = (id: number, text: string) =>
    set(
      "constraints",
      s.constraints.map((c) => (c.id === id ? { ...c, text } : c)),
    );
  const updateExample = (id: number, patch: Partial<Example>) =>
    set(
      "examples",
      s.examples.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );

  const needsFields = s.format === "json" || s.format === "table";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Prompt builder"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={loadExample}>
              Load example
            </Btn>
            <ResetBtn onClick={reset} />
          </>
        }
      >
        <div className="mb-5">
          <Notice tone="info">
            This tool structures your prompt into clearly labeled sections. It does not call or send anything to an AI
            model. Copy the result into the model or API you use.
          </Notice>
        </div>
        {loaded && (
          <div className="mb-5">
            <Notice tone="success">Example loaded. Edit any field to make it your own.</Notice>
          </div>
        )}

        <SplitGrid>
          <form className="min-w-0 space-y-5" onSubmit={(e) => e.preventDefault()} aria-label="Prompt fields">
            <TextField
              label="Role or persona"
              optional
              hint='Who the model should act as, for example "a senior data analyst".'
              value={s.role}
              onChange={(e) => set("role", e.target.value)}
              autoComplete="off"
            />
            <TextArea
              label="Task"
              hint="What the model should do. Name the deliverable and the goal."
              value={s.task}
              onChange={(e) => set("task", e.target.value)}
              required
              aria-required="true"
              error={taskMissing && otherFilled ? "Add a task. It is the only required field." : null}
            />
            <TextArea
              label="Context"
              optional
              hint="Background facts, goals or limits the model cannot guess."
              value={s.context}
              onChange={(e) => set("context", e.target.value)}
            />
            <TextField
              label="Audience"
              optional
              hint="Who will read the output."
              value={s.audience}
              onChange={(e) => set("audience", e.target.value)}
              autoComplete="off"
            />
            <TextArea
              label="Input data"
              optional
              mono
              hint="Text, records or code the model should work on. Placed last in the prompt."
              value={s.inputData}
              onChange={(e) => set("inputData", e.target.value)}
            />

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ink">
                Constraints <span className="font-normal text-muted">(optional)</span>
              </legend>
              <p className="text-[0.8125rem] text-muted">Rules such as length limits, scope or things to avoid.</p>
              {s.constraints.map((c, i) => (
                <div key={c.id} className="flex items-end gap-2">
                  <TextField
                    className="min-w-0 flex-1"
                    label={`Constraint ${i + 1}`}
                    value={c.text}
                    onChange={(e) => updateConstraint(c.id, e.target.value)}
                    autoComplete="off"
                  />
                  <Btn
                    variant="subtle"
                    icon="trash"
                    aria-label={`Remove constraint ${i + 1}`}
                    onClick={() => set("constraints", s.constraints.filter((x) => x.id !== c.id))}
                  />
                </div>
              ))}
              <Btn
                variant="ghost"
                icon="plus"
                onClick={() => set("constraints", [...s.constraints, { id: nextId(), text: "" }])}
              >
                Add constraint
              </Btn>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="Output format"
                options={FORMAT_OPTIONS}
                value={s.format}
                onChange={(e) => set("format", e.target.value as OutputFormat)}
              />
              <SelectField
                label="Tone"
                optional
                options={TONE_OPTIONS}
                value={s.tone}
                onChange={(e) => set("tone", e.target.value)}
              />
            </div>
            {needsFields && (
              <TextField
                label={s.format === "json" ? "JSON fields" : "Table columns"}
                hint="Separate with commas."
                placeholder={s.format === "json" ? "title, summary, tags" : "Name, Role, Start date"}
                value={s.fields}
                onChange={(e) => set("fields", e.target.value)}
                autoComplete="off"
              />
            )}

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ink">
                Examples <span className="font-normal text-muted">(optional)</span>
              </legend>
              <p className="text-[0.8125rem] text-muted">
                Input and output pairs that show the model what good looks like.
              </p>
              {s.examples.map((ex, i) => (
                <div key={ex.id} className="space-y-3 rounded-xl bg-sunken p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">Example {i + 1}</p>
                    <Btn
                      variant="subtle"
                      icon="trash"
                      onClick={() => set("examples", s.examples.filter((x) => x.id !== ex.id))}
                    >
                      Remove<span className="sr-only"> example {i + 1}</span>
                    </Btn>
                  </div>
                  <TextArea
                    label={`Example ${i + 1} input`}
                    value={ex.input}
                    onChange={(e) => updateExample(ex.id, { input: e.target.value })}
                    rows={3}
                  />
                  <TextArea
                    label={`Example ${i + 1} output`}
                    value={ex.output}
                    onChange={(e) => updateExample(ex.id, { output: e.target.value })}
                    rows={3}
                  />
                </div>
              ))}
              <Btn
                variant="ghost"
                icon="plus"
                onClick={() => set("examples", [...s.examples, { id: nextId(), input: "", output: "" }])}
              >
                Add example
              </Btn>
            </fieldset>
          </form>

          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-sans text-base font-semibold tracking-normal">Assembled prompt</h3>
              <div className="flex flex-wrap gap-2">
                <CopyBtn text={prompt} label="Copy prompt" disabled={taskMissing} />
                <Btn
                  variant="ghost"
                  icon="download"
                  disabled={!prompt}
                  onClick={() => downloadFile("prompt.txt", prompt)}
                >
                  Download
                </Btn>
              </div>
            </div>

            {prompt ? (
              <OutputBlock label="Assembled prompt">
                <span className="whitespace-pre-wrap break-words">{prompt}</span>
              </OutputBlock>
            ) : (
              <EmptyState icon="prompt" title="Your prompt will appear here">
                Start with the task, or load the example to see how sections fit together.
              </EmptyState>
            )}

            <StatGrid
              items={[
                { label: "Characters", value: fmt(chars, 0) },
                { label: "Tokens (approx.)", value: `~${fmt(approxTokens, 0)}` },
                { label: "Sections", value: sectionCount },
              ]}
            />
            <p className="text-[0.8125rem] text-muted">
              Token count is approximate (characters divided by 4). Real counts vary by model.
            </p>

            <section aria-labelledby="pb-checks">
              <h3 id="pb-checks" className="font-sans text-base font-semibold tracking-normal">
                Quality checklist
              </h3>
              <p className="mt-1 text-[0.8125rem] text-muted" aria-live="polite">
                {openChecks.length === 0
                  ? "All checks pass. Your prompt is well structured."
                  : `${openChecks.length} suggestion${openChecks.length === 1 ? "" : "s"} to review.`}
              </p>
              <ul className="mt-3 space-y-2">
                {checks.map((c) => (
                  <li key={c.id} className="flex items-start gap-2.5 text-sm">
                    <Icon
                      name={c.ok ? "check" : c.level === "tip" ? "info" : "alert"}
                      size={18}
                      className={`mt-0.5 shrink-0 ${c.ok ? "text-accent-strong" : c.level === "required" ? "text-danger" : "text-muted"}`}
                    />
                    <span className={c.ok ? "text-muted" : "text-ink"}>
                      <span className="font-medium">
                        {c.ok ? "Done: " : c.level === "required" ? "Required: " : c.level === "tip" ? "Tip: " : "Suggested: "}
                      </span>
                      {c.text}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
