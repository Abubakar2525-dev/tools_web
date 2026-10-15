import type { ToolMeta } from "./tool-types";

export const engineeringTools: ToolMeta[] = [
  {
    slug: "prompt-builder",
    kind: "engineering",
    name: "AI prompt builder",
    category: "AI Engineering",
    icon: "prompt",
    summary:
      "Assemble role, task, context, constraints, and examples into a clearly delimited prompt you can copy anywhere.",
    h1: "AI prompt builder with structured fields",
    metaTitle: "AI prompt builder: structured prompt template",
    metaDescription:
      "Build clear, structured prompts from role, task, context, constraints, output format, and examples. Runs in your browser and never calls a model. Free to use.",
    primaryKeyword: "ai prompt builder",
    intro:
      "Fill in the parts of a good prompt one field at a time and get a clean, delimited prompt ready to paste into any model or codebase. Nothing is sent to an AI model; the tool only assembles your text.",
    instructions: [
      "Describe the **role** and the **task** in plain sentences. These are the only fields you really need to start.",
      "Add context, input data, constraints, tone, and audience where they apply. Leave a field empty to omit its section.",
      "Choose an output format and add one or two few-shot examples if you want consistent structure.",
      "Review the quality hints and approximate length, then copy the assembled prompt.",
    ],
    howItWorks: [
      "Each field becomes its own labeled section, and longer content such as input data and examples is wrapped in delimiters like `<input>` tags. Clear boundaries make it easier for a model to tell your instructions apart from the material it should work on, and easier for you to swap the data later in code.",
      "The quality hints are simple checks on what you entered: a missing task, an output format that is not specified, constraints phrased only as negatives, or examples that are absent when you asked for a strict format. They are prompts for you to think, not scores of how well a model will respond.",
      "The length shown is an approximation based on character count. The builder runs entirely in your browser and does not call, test, or grade the prompt against any model.",
    ],
    example: {
      title: "From fields to a delimited prompt",
      body: "A role, a task, one constraint, and a JSON output format produce a prompt with separate sections that a model can follow and a developer can template.",
      input:
        "Role: support analyst\nTask: classify the ticket by urgency\nConstraint: use only the ticket text\nOutput format: JSON with keys urgency and reason",
      output:
        "You are a support analyst.\n\n## Task\nClassify the ticket by urgency.\n\n## Constraints\n- Use only the ticket text.\n\n## Output format\nReturn JSON with the keys `urgency` and `reason`.\n\n<input>\n{{ticket_text}}\n</input>",
    },
    faqs: [
      {
        q: "Does this tool generate prompts with AI?",
        a: "No. It arranges the text you write into a consistent structure and adds hints about missing pieces. You decide every word, and nothing is sent to a model or a server.",
      },
      {
        q: "Do I need to fill in every field?",
        a: "No. Empty fields are left out of the final prompt. A clear role and task is often enough for simple jobs; add constraints, format, and examples when you need repeatable output.",
      },
      {
        q: "Why wrap input data in delimiters?",
        a: "Delimiters separate instructions from content, which helps a model avoid treating pasted text as new instructions. It is one useful layer against prompt injection, but not a complete defense on its own.",
      },
      {
        q: "Will the same prompt work across different models?",
        a: "A well-structured prompt usually transfers reasonably well, but models differ in how they follow formats and constraints. Test the prompt on the model you plan to ship with and adjust from real outputs.",
      },
    ],
    related: ["token-estimator", "ai-use-case-planner", "json-formatter"],
    learnMore: [
      { label: "Prompt injection defense checklist", href: "/articles/prompt-injection-defense-checklist" },
      { label: "LLM integration services", href: "/services/llm-integration" },
    ],
  },
  {
    slug: "json-formatter",
    kind: "engineering",
    name: "JSON formatter and validator",
    category: "Data and APIs",
    icon: "braces",
    summary:
      "Format, minify, sort keys, and validate JSON with exact line and column errors, all in your browser.",
    h1: "JSON formatter and validator online",
    metaTitle: "JSON formatter and validator online",
    metaDescription:
      "Format, minify, and validate JSON with line and column errors, key sorting, and size and depth stats. Runs in your browser, so data stays on your device.",
    primaryKeyword: "json formatter online",
    intro:
      "Paste JSON to pretty-print it, minify it, or sort its keys, and see precisely where invalid input breaks. Everything runs locally in your browser.",
    instructions: [
      "Paste JSON into the input panel or type it directly.",
      "Choose an indent of 2 spaces, 4 spaces, or tabs, then select **Format**, or select **Minify** to strip whitespace.",
      "Turn on key sorting to order object keys alphabetically at every level.",
      "If the input is invalid, use the reported line and column to find the problem, then copy or download the result.",
    ],
    howItWorks: [
      "Validation uses the browser's native `JSON.parse`, which follows the JSON specification strictly: no trailing commas, no comments, and only double-quoted strings. When parsing fails, the error position is converted into a line and column so you can jump to the exact spot.",
      "Formatting and minifying use `JSON.stringify` with your chosen indent. Key sorting walks the parsed value recursively and rebuilds each object with its keys in order, while arrays keep their original order because position in an array carries meaning.",
      "Stats are computed from the parsed structure: byte size of the output, total number of keys, and maximum nesting depth. Very large numbers beyond JavaScript's safe integer range may lose precision when parsed, which is a limit of `JSON.parse` itself.",
    ],
    example: {
      title: "Minified to formatted",
      body: "A compact API response becomes readable with a 2-space indent.",
      input: '{"id":7,"name":"Ada","tags":["math","code"],"active":true}',
      output:
        '{\n  "id": 7,\n  "name": "Ada",\n  "tags": [\n    "math",\n    "code"\n  ],\n  "active": true\n}',
    },
    faqs: [
      {
        q: "Is my JSON uploaded anywhere?",
        a: "No. Parsing, formatting, and stats all happen in your browser tab. You can disconnect from the network after the page loads and the tool keeps working.",
      },
      {
        q: "Why does valid-looking JSON fail validation?",
        a: "The most common causes are trailing commas, single quotes, unquoted keys, and comments. Those are allowed in JavaScript object literals and in formats like JSON5, but not in standard JSON.",
      },
      {
        q: "Does sorting keys change my data?",
        a: "It changes only the order of keys inside objects, which JSON treats as unordered. Array order is preserved, so the meaning of the data stays the same.",
      },
      {
        q: "Can it handle very large files?",
        a: "It handles typical API payloads and config files comfortably. Multi-megabyte documents depend on your device's memory and may feel slow, since the whole document is parsed and re-rendered at once.",
      },
    ],
    related: ["api-request-builder", "base64-encoder-decoder", "sql-formatter"],
    learnMore: [
      { label: "Data engineering for AI", href: "/services/data-engineering-for-ai" },
    ],
  },
  {
    slug: "regex-tester",
    kind: "engineering",
    name: "Regex tester",
    category: "Testing and Validation",
    icon: "regex",
    summary:
      "Test JavaScript regular expressions with live match highlighting, capture groups, replace preview, and a cheat sheet.",
    h1: "Regex tester for JavaScript patterns",
    metaTitle: "Regex tester: live JavaScript regex matching",
    metaDescription:
      "Test JavaScript regex with flags g, i, m, s, u, and y, live highlighted matches, named capture groups, and a replace preview. Runs locally in your browser.",
    primaryKeyword: "regex tester",
    intro:
      "Write a pattern, paste sample text, and watch matches and capture groups update as you type. The tester uses your browser's JavaScript regex engine.",
    instructions: [
      "Enter your pattern without surrounding slashes and toggle the flags you need.",
      "Paste test text into the sample area to see every match highlighted.",
      "Open a match to inspect its numbered and named capture groups.",
      "Add a replacement string such as `$1` or `$<name>` to preview the replaced output.",
    ],
    howItWorks: [
      "Your pattern is compiled with the browser's built-in `RegExp` constructor, so results match what the same pattern does in JavaScript and TypeScript code. Matches are collected with `matchAll`, which returns each match's index and groups, and those positions drive the highlighting.",
      "Flags change engine behavior: `g` finds all matches, `i` ignores case, `m` makes `^` and `$` match at line breaks, `s` lets `.` match newlines, `u` enables full Unicode handling, and `y` anchors each match at the current position. The replace preview uses `String.prototype.replace` with the same substitution syntax as your code.",
      "This is the ECMAScript flavor. PCRE, Python's `re`, and other engines differ in details such as possessive quantifiers, inline flag syntax, lookbehind support, and how `\\w` treats Unicode, so verify patterns in the engine you will actually run.",
    ],
    example: {
      title: "Named groups for email parts",
      body: "With the `g` flag, the pattern finds both addresses and splits each into user and domain groups.",
      input:
        "Pattern: (?<user>[\\w.+-]+)@(?<domain>[\\w-]+\\.[\\w.]+)\nText: Contact ana@example.com or ops.team@stratum.dev",
      output:
        "Match 1: ana@example.com  user=ana  domain=example.com\nMatch 2: ops.team@stratum.dev  user=ops.team  domain=stratum.dev",
    },
    faqs: [
      {
        q: "Will a pattern tested here work in Python or PHP?",
        a: "Often, but not always. Basic syntax is shared, while named group syntax, lookbehind rules, and flag handling vary between engines. Treat this tool as authoritative for JavaScript and re-test elsewhere.",
      },
      {
        q: "Why does my pattern only find one match?",
        a: "Without the `g` flag, JavaScript stops after the first match. Turn on `g` to find every occurrence in the text.",
      },
      {
        q: "Can a regex freeze the page?",
        a: "Patterns with nested quantifiers, such as `(a+)+$`, can trigger catastrophic backtracking on certain inputs. If the page slows down, simplify the pattern or make quantifiers more specific; the same pattern would be a risk in production code too.",
      },
      {
        q: "Is my test text stored?",
        a: "No. Patterns and sample text stay in your browser and are not sent to a server.",
      },
    ],
    related: ["json-formatter", "markdown-previewer", "token-estimator"],
  },
  {
    slug: "sql-formatter",
    kind: "engineering",
    name: "SQL query formatter",
    category: "Developer Utilities",
    icon: "table",
    summary:
      "Format SQL for PostgreSQL, MySQL, T-SQL, SQLite, BigQuery, Snowflake, and standard SQL with consistent keyword case.",
    h1: "SQL query formatter for common dialects",
    metaTitle: "SQL query formatter for 7 dialects",
    metaDescription:
      "Format SQL queries for PostgreSQL, MySQL, T-SQL, SQLite, BigQuery, Snowflake, or standard SQL, with keyword case and indent options. Runs in your browser.",
    primaryKeyword: "sql query formatter",
    intro:
      "Turn a one-line or inconsistently written query into readable, consistently indented SQL. Pick your dialect, keyword case, and indent width.",
    instructions: [
      "Paste your query into the input panel.",
      "Select the dialect that matches your database.",
      "Choose keyword case (upper, lower, or preserve) and an indent width.",
      "Copy the formatted query back into your editor or migration file.",
    ],
    howItWorks: [
      "Formatting uses the open-source `sql-formatter` library, which tokenizes the query according to the selected dialect and then lays it out with line breaks before major clauses and indentation for column lists, joins, and subqueries.",
      "Choosing the right dialect matters because databases differ in identifier quoting, operators, and reserved words. For example, BigQuery uses backticks for identifiers and PostgreSQL supports `::` casts, and the tokenizer needs to recognize these to avoid splitting them incorrectly.",
      "The formatter only rearranges whitespace and keyword case. It does not check whether tables or columns exist, validate syntax against a live database, or run the query.",
    ],
    example: {
      title: "One line to readable clauses",
      body: "A short query formatted with uppercase keywords and a 2-space indent.",
      input: "select id, name from users where active = 1 order by name",
      output: "SELECT\n  id,\n  name\nFROM\n  users\nWHERE\n  active = 1\nORDER BY\n  name",
    },
    faqs: [
      {
        q: "Does the formatter validate or execute my SQL?",
        a: "No. It reformats text and never connects to a database. A query can format cleanly and still fail when run, so test it against your database as usual.",
      },
      {
        q: "What happens if I pick the wrong dialect?",
        a: "Most simple queries format fine under any dialect, but dialect-specific syntax such as quoted identifiers, casts, or procedural blocks may be split oddly or rejected. Switch to the matching dialect if the output looks wrong.",
      },
      {
        q: "Is it safe to paste production queries?",
        a: "Formatting happens in your browser, and the query is not sent to a server. Still, avoid pasting real credentials or personal data into any tool you do not need to.",
      },
      {
        q: "Will formatting change what the query does?",
        a: "It should not. The formatter changes whitespace and keyword case only. String literals and identifiers are left as written, though you should review output for unusual syntax the library may not fully support.",
      },
    ],
    related: ["json-formatter", "regex-tester", "api-request-builder"],
    learnMore: [
      { label: "Data engineering for AI", href: "/services/data-engineering-for-ai" },
    ],
  },
  {
    slug: "token-estimator",
    kind: "engineering",
    name: "Text and token estimator",
    category: "Text and Content",
    icon: "token",
    summary:
      "Count words, characters, and bytes, and get an approximate token range with context-window fit and optional cost.",
    h1: "Text and token estimator for LLM prompts",
    metaTitle: "Token counter estimate for LLM prompts",
    metaDescription:
      "Count words, characters, and bytes, and estimate an approximate token range for LLM prompts, with context-window fit and optional cost. Runs in your browser.",
    primaryKeyword: "token counter estimate",
    intro:
      "Paste text to see its size in words, characters, sentences, paragraphs, and bytes, plus an approximate token range for planning prompts and budgets.",
    instructions: [
      "Paste or type the text you want to measure.",
      "Read the counts and the estimated token range.",
      "Pick a context-window size to see how much of it the text would use.",
      "Optionally enter a price per million tokens to get a rough cost estimate.",
    ],
    howItWorks: [
      "Exact token counts depend on each model's tokenizer, which this tool does not run. Instead it uses two common rules of thumb for English text: about four characters per token, and about 1.33 tokens per word. Showing both as a range is more honest than a single number.",
      "The heuristics work reasonably for ordinary English prose. Code, JSON, URLs, numbers, and non-Latin scripts usually produce more tokens per character, so expect the true count to land above the range for that kind of content.",
      "Context-window fit compares the upper estimate with the window size you choose, and the cost estimate multiplies that estimate by the price you enter. Both are planning aids; use your provider's tokenizer or usage reports for billing-grade numbers.",
    ],
    example: {
      title: "Estimating a support article",
      body: "Both heuristics are applied to the same text, and the result is shown as a range.",
      input: "1,200 characters, 210 words of English prose",
      output: "1,200 ÷ 4 = 300 tokens\n210 × 1.33 ≈ 279 tokens\nEstimated range: about 279 to 300 tokens",
    },
    faqs: [
      {
        q: "Why not show an exact token count?",
        a: "Every model family uses its own tokenizer, and the same text can produce noticeably different counts across them. A transparent range avoids implying precision the tool does not have.",
      },
      {
        q: "When are the estimates least reliable?",
        a: "Source code, structured data, long numbers, emoji, and languages such as Chinese, Japanese, or Arabic tend to tokenize differently from English prose. Treat the range as a lower bound for that content.",
      },
      {
        q: "Does the estimate include the model's response?",
        a: "No. It measures only the text you paste. When checking context-window fit, leave room for system instructions, retrieved context, and the output you expect back.",
      },
      {
        q: "Is my text sent anywhere?",
        a: "No. Counting happens in your browser, and the text is not uploaded or stored on a server.",
      },
    ],
    related: ["prompt-builder", "markdown-previewer", "rag-readiness-checklist"],
    learnMore: [
      { label: "Reducing LLM latency and cost", href: "/articles/reducing-llm-latency-and-cost" },
    ],
  },
  {
    slug: "api-request-builder",
    kind: "engineering",
    name: "API request builder",
    category: "Data and APIs",
    icon: "api",
    summary:
      "Build an HTTP request once and copy it as cURL, JavaScript fetch, Python requests, or HTTPie.",
    h1: "API request builder and code snippet generator",
    metaTitle: "API request builder: cURL, fetch, Python",
    metaDescription:
      "Build HTTP requests with method, query params, headers, auth, and body, then copy cURL, fetch, Python requests, or HTTPie snippets. Runs in your browser.",
    primaryKeyword: "api request builder",
    intro:
      "Describe a request with forms instead of hand-escaping a shell command, then copy equivalent code in four common formats. The builder writes code; it does not send the request.",
    instructions: [
      "Choose the HTTP method and enter the URL.",
      "Add query parameters and headers as key and value rows.",
      "Use the auth helper for a bearer token or basic credentials.",
      "Pick a body type (JSON, form, or raw), then copy the snippet for cURL, fetch, Python requests, or HTTPie.",
    ],
    howItWorks: [
      "The builder keeps one structured description of the request and renders it into each target format. Query parameters are URL-encoded and appended to the URL, and headers are emitted in the syntax each tool expects.",
      "The auth helper adds an `Authorization` header: `Bearer <token>` for tokens, or `Basic` followed by the Base64 encoding of `user:password` for basic auth. For JSON bodies it sets `Content-Type: application/json` and serializes the body; form bodies are URL-encoded.",
      "Shell snippets quote values so spaces and special characters survive copy and paste. Because nothing is sent from the page, there are no CORS limits on what you can build, and no responses to inspect.",
    ],
    example: {
      title: "A JSON POST with a bearer token",
      body: "The same request rendered as a cURL command.",
      input:
        "POST https://api.example.com/v1/notes\nAuth: Bearer sk_test_123\nBody (JSON): {\"title\":\"Draft\"}",
      output:
        "curl -X POST 'https://api.example.com/v1/notes' \\\n  -H 'Authorization: Bearer sk_test_123' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"title\":\"Draft\"}'",
    },
    faqs: [
      {
        q: "Does this tool send my request?",
        a: "No. It only generates code. Run the snippet in your terminal, script, or application to make the actual call.",
      },
      {
        q: "Are my API keys stored?",
        a: "The builder runs in your browser and does not upload what you enter. Generated snippets contain your token in plain text, so avoid pasting them into shared documents or committing them to source control.",
      },
      {
        q: "Why use HTTPie as well as cURL?",
        a: "HTTPie has a shorter syntax that many people find easier to read and edit by hand. cURL is installed almost everywhere, so it is the safer choice for documentation and bug reports.",
      },
      {
        q: "Will the fetch snippet work in a browser?",
        a: "It will run, but the target server must allow cross-origin requests from your page. In Node.js, where fetch is built in on recent versions, CORS does not apply.",
      },
    ],
    related: ["json-formatter", "base64-encoder-decoder", "sql-formatter"],
    learnMore: [
      { label: "LLM integration services", href: "/services/llm-integration" },
      { label: "Custom software development", href: "/services/custom-software-development" },
    ],
  },
  {
    slug: "markdown-previewer",
    kind: "engineering",
    name: "Markdown previewer",
    category: "Text and Content",
    icon: "markdown",
    summary:
      "Write Markdown with a live preview, GitHub-style tables and task lists, word count, and a locally saved draft.",
    h1: "Markdown previewer with live rendering",
    metaTitle: "Markdown previewer with live rendering",
    metaDescription:
      "Preview Markdown live with GitHub-style tables, task lists, and fenced code, plus word count and reading time. Drafts save locally in your browser. Free to use.",
    primaryKeyword: "markdown previewer",
    intro:
      "Write or paste Markdown on one side and see the rendered result on the other as you type. Your draft is saved in this browser so it survives a refresh.",
    instructions: [
      "Type or paste Markdown into the editor.",
      "Check the live preview for headings, tables, task lists, and code blocks.",
      "Use the word count and reading time to gauge length.",
      "Download the draft as a `.md` file when you are done.",
    ],
    howItWorks: [
      "The editor parses Markdown into HTML on each change, with GitHub Flavored Markdown features such as pipe tables, `- [ ]` task lists, strikethrough, and fenced code blocks with a language label.",
      "Rendering is defensive. Links are restricted to safe protocols so `javascript:` URLs cannot run, and remote images are not loaded, which keeps a pasted document from contacting third-party servers.",
      "The draft is stored in your browser's local storage, so it stays on this device and is cleared if you clear site data. Reading time is estimated from the word count at a typical reading pace.",
    ],
    example: {
      title: "A task list and a table",
      body: "GitHub-style syntax rendered in the preview.",
      input:
        "## Launch\n\n- [x] Write docs\n- [ ] Tag release\n\n| Env | Status |\n| --- | --- |\n| staging | ready |",
      output:
        "A level-2 heading \"Launch\", a checklist with one checked and one unchecked item, and a two-column table with one row: staging, ready.",
    },
    faqs: [
      {
        q: "Why are my images not showing?",
        a: "Remote images are intentionally not loaded, so previewing a document does not make requests to outside servers. The image syntax is still kept in your Markdown and will render wherever you publish it.",
      },
      {
        q: "Will the preview match GitHub exactly?",
        a: "It supports the common GitHub Flavored Markdown features, but GitHub adds its own extras such as mentions, issue references, and diagram blocks. Expect small differences in styling and in those extensions.",
      },
      {
        q: "Where is my draft saved?",
        a: "In your browser's local storage on this device. It is not uploaded, so it will not appear on another device or in another browser.",
      },
      {
        q: "Why does a link in my preview not open?",
        a: "Links are limited to safe protocols such as `https:` and `mailto:`, so a `javascript:` URL in pasted content cannot run. Check that the link has a full, valid address.",
      },
    ],
    related: ["token-estimator", "regex-tester", "json-formatter"],
  },
  {
    slug: "base64-encoder-decoder",
    kind: "engineering",
    name: "Base64 encoder and decoder",
    category: "Developer Utilities",
    icon: "binary",
    summary:
      "Encode and decode Base64 with UTF-8 support, a URL-safe option, and file to data URI conversion.",
    h1: "Base64 encoder and decoder with UTF-8",
    metaTitle: "Base64 decode and encode, UTF-8 safe",
    metaDescription:
      "Encode or decode Base64 with full UTF-8 support, a URL-safe variant, missing-padding tolerance, and file to data URI conversion up to 5 MB, all in your browser.",
    primaryKeyword: "base64 decode",
    intro:
      "Convert text to Base64 and back without breaking accented letters or emoji, or turn a small file into a data URI. Everything happens locally.",
    instructions: [
      "Choose **Encode** or **Decode**, then paste your text.",
      "Turn on URL-safe mode if the value goes into a URL, a filename, or a JWT-style token.",
      "Use **Swap** to move the output into the input and reverse direction.",
      "To embed a file, drop one up to 5 MB to get a data URI you can copy.",
    ],
    howItWorks: [
      "Base64 encodes bytes, not characters, so text is first converted to UTF-8 bytes with `TextEncoder` and decoded back with `TextDecoder`. This avoids the classic `btoa` error on characters outside Latin-1, such as `é` or emoji.",
      "The URL-safe variant replaces `+` with `-` and `/` with `_`, and usually drops the trailing `=` padding. When decoding, the tool accepts either alphabet and restores missing padding before converting.",
      "For files, the browser reads the bytes locally and produces a `data:` URI with the file's MIME type. Base64 output is about a third larger than the original, which is why large files are better served as normal assets.",
    ],
    example: {
      title: "UTF-8 text to Base64",
      body: "The accented `é` becomes two bytes in UTF-8 (`C3 A9`), and the six bytes encode to eight Base64 characters.",
      input: "héllo",
      output: "aMOpbGxv",
    },
    faqs: [
      {
        q: "Is Base64 a form of encryption?",
        a: "No. Base64 is a reversible encoding that anyone can decode. Never use it to protect passwords, tokens, or personal data.",
      },
      {
        q: "Why does my decoded text look garbled?",
        a: "The original bytes may not be UTF-8 text, for example an image or a file in another encoding. It may also be a URL-safe string decoded as standard Base64; this tool accepts both alphabets, but other tools may not.",
      },
      {
        q: "When should I use the URL-safe variant?",
        a: "Use it when the encoded value appears in URLs, query strings, cookies, or filenames, where `+`, `/`, and `=` can be misread or need escaping. JWTs use this variant without padding.",
      },
      {
        q: "Are my files uploaded?",
        a: "No. Files are read by your browser and converted on your device. The 5 MB limit keeps the page responsive, since the output is held in memory as text.",
      },
    ],
    related: ["json-formatter", "api-request-builder", "regex-tester"],
  },
  {
    slug: "ai-use-case-planner",
    kind: "engineering",
    name: "AI use-case planner",
    category: "AI Engineering",
    icon: "compass",
    summary:
      "Answer guided questions and get a structured AI use-case plan with approach, phases, risks, and open questions.",
    h1: "AI use-case planner and project template",
    metaTitle: "AI use case template and planner",
    metaDescription:
      "Turn an AI idea into a structured plan: goals and metrics, inputs, outputs, integrations, a suggested approach, phases, and risks. Runs in your browser.",
    primaryKeyword: "ai use case template",
    intro:
      "Work through a short guided form about the problem, users, data, and constraints, and get a plan you can share with your team. The plan is built from your answers using fixed rules, not generated by a model.",
    instructions: [
      "Describe the problem, the people affected, and what success looks like.",
      "List the inputs available, the outputs you need, and the systems it must connect to.",
      "Answer the questions about data sources, actions, and risk tolerance.",
      "Review the plan, then download it as Markdown. Your answers are saved in this browser.",
    ],
    howItWorks: [
      "Your answers fill a consistent plan structure: summary, goals and success metrics, inputs, outputs, integrations, suggested approach, phased implementation steps, and risks and open questions.",
      "The suggested approach comes from simple, transparent rules. For example, answers that depend on a large body of internal documents point toward retrieval-augmented generation, pulling fields out of forms or emails points toward an extraction workflow, and multi-step tasks that call other systems point toward an agent with tightly scoped tools. It is a starting hypothesis, not a technical assessment.",
      "Risks and open questions are added based on gaps in your answers, such as no success metric, unclear data ownership, or actions taken without human review. The planner runs in your browser and stores drafts in local storage.",
    ],
    example: {
      title: "Internal policy assistant",
      body: "A team wants staff to ask questions about HR and IT policies.",
      input:
        "Problem: staff wait days for policy answers\nInputs: 300 policy PDFs in SharePoint\nOutput: answers with links to the source section\nActions: none, read-only",
      output:
        "Suggested approach: retrieval-augmented generation with citations\nPhase 1: index a pilot set of policies and build an evaluation set of real questions\nRisk: outdated documents in the index\nOpen question: who owns policy updates?",
    },
    faqs: [
      {
        q: "Does the planner use AI to write the plan?",
        a: "No. It applies fixed rules to your answers and fills a template. That makes the output predictable and easy to audit, but it means the plan is only as specific as what you enter.",
      },
      {
        q: "How accurate is the suggested approach?",
        a: "It is a reasonable first guess for common patterns. Real projects often combine approaches, and data quality, latency, and security requirements can change the right answer, so treat it as input to a technical review.",
      },
      {
        q: "Who should fill this in?",
        a: "Ideally the person who owns the business problem, with input from someone who knows the data and systems involved. The open questions section is designed to be taken into that conversation.",
      },
      {
        q: "Is my plan shared with anyone?",
        a: "No. Answers are stored in your browser's local storage and the Markdown file is generated on your device. Clearing site data removes the saved draft.",
      },
    ],
    related: ["rag-readiness-checklist", "prompt-builder", "token-estimator"],
    learnMore: [
      { label: "Data readiness for AI", href: "/articles/data-readiness-for-ai" },
      { label: "AI application development", href: "/services/ai-application-development" },
    ],
  },
  {
    slug: "rag-readiness-checklist",
    kind: "engineering",
    name: "RAG readiness checklist",
    category: "AI Engineering",
    icon: "checklist",
    summary:
      "Score your readiness for retrieval-augmented generation across six areas and get prioritized gaps with next steps.",
    h1: "RAG readiness checklist and self-assessment",
    metaTitle: "RAG readiness checklist and score",
    metaDescription:
      "Assess RAG readiness across sources, retrieval, security, evaluation, operations, and ownership. Get area scores, prioritized gaps, and a Markdown export.",
    primaryKeyword: "rag readiness checklist",
    intro:
      "Answer about two dozen questions on your documents, access rules, evaluation, and ownership to see where a retrieval-augmented generation project is ready and where it is likely to stall.",
    instructions: [
      "Work through each of the six areas and answer every item with Yes, Partly, No, or Not sure.",
      "Review the score for each area and the overall readiness band.",
      "Read the prioritized gaps, which list the weakest high-impact items first with a suggested next step.",
      "Export the results as Markdown to share with your team.",
    ],
    howItWorks: [
      "The checklist covers six areas: sources and content, retrieval requirements, access and security, evaluation, operations and deployment, and ownership. Items are weighted by their likely impact, so a missing permission model counts for more than a minor documentation gap.",
      "Answers map to credit: Yes earns full credit, Partly earns partial credit, and No earns none. Not sure is treated as a gap, because an unknown needs someone to confirm it. Area scores and the overall score are weighted averages, and the overall score falls into a readiness band.",
      "Gaps are sorted by weight and answer, so the items most likely to cause trouble appear first. The assessment runs in your browser, and the export is generated on your device.",
    ],
    example: {
      title: "A team with good content but no evaluation plan",
      body: "Strong answers on sources do not offset an untested system.",
      input:
        "Sources and content: mostly Yes\nAccess and security: Partly on document-level permissions\nEvaluation: No test set, Not sure who reviews answers",
      output:
        "Lowest area: evaluation\nTop gap: no evaluation set of real questions\nNext step: collect 50 to 100 real user questions with expected sources before choosing a retrieval setup",
    },
    faqs: [
      {
        q: "Why does Not sure lower my score?",
        a: "Unknowns are where RAG projects usually get stuck, such as unclear permissions or no agreed definition of a good answer. Scoring them as gaps makes sure someone confirms them before launch.",
      },
      {
        q: "Is a high score a guarantee of success?",
        a: "No. The checklist reflects preparation, not system quality. You still need to measure retrieval and answer quality on real questions once you build something.",
      },
      {
        q: "Why is evaluation part of readiness?",
        a: "Without a test set of realistic questions and expected sources, you cannot tell whether a change to chunking, embeddings, or prompts made things better or worse. Planning evaluation early saves rework later.",
      },
      {
        q: "Are my answers stored or shared?",
        a: "No. The assessment runs in your browser and the Markdown export is created on your device. Nothing is sent to a server.",
      },
    ],
    related: ["ai-use-case-planner", "prompt-builder", "token-estimator"],
    learnMore: [
      { label: "Evaluating RAG before launch", href: "/articles/evaluating-rag-before-launch" },
      { label: "RAG development services", href: "/services/rag-development" },
    ],
  },
];
