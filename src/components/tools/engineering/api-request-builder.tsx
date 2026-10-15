"use client";

import { useMemo, useState } from "react";
import {
  Btn,
  CellInput,
  CopyBtn,
  EmptyState,
  Notice,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SelectField,
  SplitGrid,
  TextArea,
  TextField,
  ToolPanel,
  uid,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Types and constants                                                 */
/* ------------------------------------------------------------------ */

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
type Method = (typeof METHODS)[number];

type AuthType = "none" | "bearer" | "basic";
type BodyType = "none" | "json" | "form" | "text";
type SnippetTab = "curl" | "fetch" | "python" | "httpie";

type Row = { id: string; key: string; value: string; enabled: boolean };

const AUTH_OPTIONS = [
  { value: "none", label: "No auth" },
  { value: "bearer", label: "Bearer token" },
  { value: "basic", label: "Basic (username and password)" },
] as const;

const BODY_OPTIONS = [
  { value: "none", label: "No body" },
  { value: "json", label: "JSON" },
  { value: "form", label: "Form (URL-encoded)" },
  { value: "text", label: "Raw text" },
] as const;

const TABS: readonly { value: SnippetTab; label: string }[] = [
  { value: "curl", label: "cURL" },
  { value: "fetch", label: "fetch" },
  { value: "python", label: "Python" },
  { value: "httpie", label: "HTTPie" },
];

const CONTENT_TYPES: Record<Exclude<BodyType, "none">, string> = {
  json: "application/json",
  form: "application/x-www-form-urlencoded",
  text: "text/plain; charset=utf-8",
};

/** RFC 9110 token characters allowed in a header name. */
const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

const newRow = (key = "", value = ""): Row => ({ id: uid(), key, value, enabled: true });

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** POSIX shell single-quote escaping: close, add an escaped quote, reopen. */
function sq(s: string) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Double-quoted string literal valid in both JavaScript and Python 3. */
function dq(s: string) {
  return JSON.stringify(s);
}

function utf8Base64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** encodeURIComponent, but keeps {{PLACEHOLDER}} markers readable. */
function enc(s: string) {
  return encodeURIComponent(s).replace(/%7B%7B([A-Za-z0-9_.-]+)%7D%7D/g, "{{$1}}");
}

function validateUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return "Enter a full URL, including https:// (for example https://api.example.com/v1/items).";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "Only http:// and https:// URLs are supported.";
  if (/\s/.test(s)) return "The URL contains spaces. Encode them as %20 or move them into a query parameter.";
  return null;
}

function buildUrl(raw: string, params: Row[]) {
  const s = raw.trim();
  const active = params.filter((p) => p.enabled && p.key.trim());
  if (!active.length) return s;
  const hashAt = s.indexOf("#");
  const base = hashAt >= 0 ? s.slice(0, hashAt) : s;
  const hash = hashAt >= 0 ? s.slice(hashAt) : "";
  const qs = active.map((p) => `${enc(p.key.trim())}=${enc(p.value)}`).join("&");
  const joiner = base.includes("?") ? (base.endsWith("?") || base.endsWith("&") ? "" : "&") : "?";
  return `${base}${joiner}${qs}${hash}`;
}

function indentLines(s: string, pad: string) {
  return s
    .split("\n")
    .map((l, i) => (i === 0 ? l : pad + l))
    .join("\n");
}

/** Converts a parsed JSON value to a Python literal. */
function toPy(v: unknown, depth = 0): string {
  const pad = "    ".repeat(depth + 1);
  const end = "    ".repeat(depth);
  if (v === null) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "None";
  if (typeof v === "string") return dq(v);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return `[\n${v.map((x) => pad + toPy(x, depth + 1)).join(",\n")},\n${end}]`;
  }
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    if (!entries.length) return "{}";
    return `{\n${entries.map(([k, x]) => `${pad}${dq(k)}: ${toPy(x, depth + 1)}`).join(",\n")},\n${end}}`;
  }
  return "None";
}

type Built = {
  url: string;
  method: Method;
  headers: [string, string][];
  body: string | null;
  bodyType: BodyType;
  json: unknown;
};

function curlSnippet(b: Built) {
  const parts: string[] = [];
  if (b.method === "HEAD") parts.push(`curl --head ${sq(b.url)}`);
  else if (b.method === "GET") parts.push(`curl ${sq(b.url)}`);
  else parts.push(`curl -X ${b.method} ${sq(b.url)}`);
  for (const [k, v] of b.headers) parts.push(`-H ${sq(v === "" ? `${k};` : `${k}: ${v}`)}`);
  if (b.body !== null) parts.push(`--data-raw ${sq(b.body)}`);
  return parts.join(" \\\n  ");
}

function fetchSnippet(b: Built) {
  const lines: string[] = [];
  lines.push(`const response = await fetch(${dq(b.url)}, {`);
  lines.push(`  method: ${dq(b.method)},`);
  if (b.headers.length) {
    const names = b.headers.map(([k]) => k.toLowerCase());
    const hasDupes = new Set(names).size !== names.length;
    if (hasDupes) {
      lines.push("  headers: [");
      for (const [k, v] of b.headers) lines.push(`    [${dq(k)}, ${dq(v)}],`);
      lines.push("  ],");
    } else {
      lines.push("  headers: {");
      for (const [k, v] of b.headers) lines.push(`    ${dq(k)}: ${dq(v)},`);
      lines.push("  },");
    }
  }
  if (b.body !== null) {
    if (b.bodyType === "json") {
      lines.push(`  body: JSON.stringify(${indentLines(JSON.stringify(b.json, null, 2), "  ")}),`);
    } else {
      lines.push(`  body: ${dq(b.body)},`);
    }
  }
  lines.push("});");
  lines.push("");
  lines.push("console.log(response.status, response.statusText);");
  if (b.method !== "HEAD") lines.push("console.log(await response.text());");
  return lines.join("\n");
}

function pythonSnippet(b: Built) {
  const lines: string[] = ["import requests", "", `url = ${dq(b.url)}`];
  if (b.headers.length) {
    lines.push("headers = {");
    for (const [k, v] of b.headers) lines.push(`    ${dq(k)}: ${dq(v)},`);
    lines.push("}");
  }
  let bodyArg = "";
  if (b.body !== null) {
    if (b.bodyType === "json") {
      lines.push(`payload = ${toPy(b.json)}`);
      bodyArg = ", json=payload";
    } else {
      lines.push(`payload = ${dq(b.body)}`);
      bodyArg = ', data=payload.encode("utf-8")';
    }
  }
  lines.push("");
  lines.push(
    `response = requests.request(${dq(b.method)}, url${b.headers.length ? ", headers=headers" : ""}${bodyArg}, timeout=30)`,
  );
  lines.push("print(response.status_code)");
  if (b.method !== "HEAD") lines.push("print(response.text)");
  return lines.join("\n");
}

function httpieSnippet(b: Built) {
  const parts: string[] = [];
  const first = b.body !== null ? `http --raw ${sq(b.body)} ${b.method} ${sq(b.url)}` : `http ${b.method} ${sq(b.url)}`;
  parts.push(first);
  for (const [k, v] of b.headers) {
    // HTTPie uses backslash to escape separators inside items.
    const value = v.replace(/\\/g, "\\\\");
    parts.push(sq(v === "" ? `${k};` : `${k}:${value}`));
  }
  return parts.join(" \\\n  ");
}

/* ------------------------------------------------------------------ */
/* Key/value table                                                     */
/* ------------------------------------------------------------------ */

function KeyValueTable({
  title,
  rows,
  onChange,
  noun,
  emptyText,
  keyPlaceholder,
  valuePlaceholder,
  keyError,
}: {
  title: string;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  noun: string;
  emptyText: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  keyError?: (key: string) => string | null;
}) {
  const update = (id: string, patch: Partial<Row>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const errors = rows
    .map((r, i) => {
      const e = keyError?.(r.key);
      return e ? `${noun} ${i + 1}: ${e}` : null;
    })
    .filter((e): e is string => Boolean(e));

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-ink">{title}</legend>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r, i) => {
            const invalid = Boolean(keyError?.(r.key));
            return (
              <li
                key={r.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-sunken p-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:bg-transparent sm:p-0"
              >
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => update(r.id, { enabled: e.target.checked })}
                  aria-label={`Include ${noun.toLowerCase()} ${i + 1}`}
                  className="col-start-1 row-start-1 h-[18px] w-[18px] cursor-pointer accent-[var(--accent)]"
                />
                <CellInput
                  label={`${noun} ${i + 1} name`}
                  value={r.key}
                  invalid={invalid}
                  placeholder={keyPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => update(r.id, { key: e.target.value })}
                  className={`col-start-2 row-start-1 font-mono ${r.enabled ? "" : "opacity-60"}`}
                />
                <CellInput
                  label={`${noun} ${i + 1} value`}
                  value={r.value}
                  placeholder={valuePlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => update(r.id, { value: e.target.value })}
                  className={`col-start-2 row-start-2 font-mono sm:col-start-3 sm:row-start-1 ${r.enabled ? "" : "opacity-60"}`}
                />
                <Btn
                  variant="subtle"
                  icon="trash"
                  aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`}
                  onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                  className="col-start-3 row-start-1 !px-2.5 sm:col-start-4"
                />
              </li>
            );
          })}
        </ul>
      )}
      {errors.length > 0 && (
        <div role="alert" className="mt-2 space-y-1 text-sm text-danger">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      <Btn variant="ghost" icon="plus" className="mt-3" onClick={() => onChange([...rows, newRow()])}>
        Add {noun.toLowerCase()}
      </Btn>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

type State = {
  method: Method;
  url: string;
  params: Row[];
  headers: Row[];
  auth: AuthType;
  token: string;
  username: string;
  password: string;
  bodyType: BodyType;
  json: string;
  text: string;
  form: Row[];
};

const EMPTY: State = {
  method: "GET",
  url: "",
  params: [],
  headers: [],
  auth: "none",
  token: "",
  username: "",
  password: "",
  bodyType: "none",
  json: "",
  text: "",
  form: [],
};

function exampleState(): State {
  return {
    method: "POST",
    url: "https://api.example.com/v1/orders",
    params: [newRow("dry_run", "true")],
    headers: [newRow("Accept", "application/json"), newRow("X-Request-Id", "{{REQUEST_ID}}")],
    auth: "bearer",
    token: "{{API_TOKEN}}",
    username: "",
    password: "",
    bodyType: "json",
    json: JSON.stringify(
      { customer_id: "cus_1042", items: [{ sku: "LAMP-01", quantity: 2 }], note: "Leave at the front desk, it's fragile" },
      null,
      2,
    ),
    text: "",
    form: [],
  };
}

export default function Tool() {
  const [s, setS] = useState<State>(EMPTY);
  const [tab, setTab] = useState<SnippetTab>("curl");
  const set = <K extends keyof State>(key: K, value: State[K]) => setS((prev) => ({ ...prev, [key]: value }));

  const urlError = validateUrl(s.url);
  const bodyAllowed = s.method !== "GET" && s.method !== "HEAD";

  const jsonResult = useMemo((): { ok: true; value: unknown } | { ok: false; error: string } | null => {
    if (s.bodyType !== "json" || !s.json.trim()) return null;
    try {
      return { ok: true, value: JSON.parse(s.json) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON." };
    }
  }, [s.bodyType, s.json]);

  const headerKeyError = (k: string) => {
    if (!k.trim()) return null;
    return HEADER_NAME_RE.test(k.trim()) ? null : "header names can only use letters, digits and - _ . ! # $ % & ' * + ^ ` | ~";
  };

  const built = useMemo((): Built | null => {
    if (!s.url.trim() || urlError) return null;
    const headers: [string, string][] = s.headers
      .filter((h) => h.enabled && h.key.trim() && HEADER_NAME_RE.test(h.key.trim()))
      .map((h) => [h.key.trim(), h.value]);

    if (s.auth === "bearer") headers.push(["Authorization", `Bearer ${s.token.trim() || "{{API_TOKEN}}"}`]);
    if (s.auth === "basic") {
      headers.push(["Authorization", `Basic ${utf8Base64(`${s.username}:${s.password}`)}`]);
    }

    let body: string | null = null;
    let json: unknown = null;
    if (bodyAllowed && s.bodyType !== "none") {
      if (s.bodyType === "json") {
        if (jsonResult?.ok) {
          json = jsonResult.value;
          body = JSON.stringify(jsonResult.value);
        }
      } else if (s.bodyType === "form") {
        const fields = s.form.filter((f) => f.enabled && f.key.trim());
        if (fields.length) body = fields.map((f) => `${enc(f.key.trim())}=${enc(f.value)}`).join("&");
      } else if (s.text) {
        body = s.text;
      }
      if (body !== null && !headers.some(([k]) => k.toLowerCase() === "content-type")) {
        headers.push(["Content-Type", CONTENT_TYPES[s.bodyType]]);
      }
    }

    return { url: buildUrl(s.url, s.params), method: s.method, headers, body, bodyType: s.bodyType, json };
  }, [s, urlError, bodyAllowed, jsonResult]);

  const snippet = useMemo(() => {
    if (!built) return "";
    if (tab === "curl") return curlSnippet(built);
    if (tab === "fetch") return fetchSnippet(built);
    if (tab === "python") return pythonSnippet(built);
    return httpieSnippet(built);
  }, [built, tab]);

  const manualAuthHeader = s.headers.some((h) => h.enabled && h.key.trim().toLowerCase() === "authorization");
  const looksLikeRealSecret =
    (s.auth === "bearer" && s.token.trim() !== "" && !/\{\{.+\}\}|\$\{?[A-Z_]+/.test(s.token)) ||
    (s.auth === "basic" && s.password !== "" && !/\{\{.+\}\}|\$\{?[A-Z_]+/.test(s.password));

  return (
    <div className="space-y-5">
      <Notice tone="info" title="This builder writes code, it doesn't send requests">
        Requests from a web page are often blocked by CORS, and sending them from here would route your tokens through
        the page. Copy a snippet and run it in your terminal or app instead, so secrets stay on your machine.
      </Notice>

      <SplitGrid>
        <ToolPanel
          title="Request"
          actions={
            <>
              <Btn variant="ghost" icon="api" onClick={() => setS(exampleState())}>
                Load example
              </Btn>
              <ResetBtn onClick={() => setS(EMPTY)} />
            </>
          }
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <SelectField
                label="Method"
                value={s.method}
                options={METHODS}
                onChange={(e) => set("method", e.target.value as Method)}
              />
              <TextField
                label="URL"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://api.example.com/v1/items"
                value={s.url}
                error={urlError}
                onChange={(e) => set("url", e.target.value)}
              />
            </div>

            <KeyValueTable
              title="Query parameters"
              noun="Parameter"
              rows={s.params}
              onChange={(rows) => set("params", rows)}
              emptyText="No query parameters. Values are URL-encoded for you."
              keyPlaceholder="name"
              valuePlaceholder="value"
            />

            <KeyValueTable
              title="Headers"
              noun="Header"
              rows={s.headers}
              onChange={(rows) => set("headers", rows)}
              emptyText="No custom headers."
              keyPlaceholder="Header-Name"
              valuePlaceholder="value"
              keyError={headerKeyError}
            />

            <div className="space-y-4">
              <SelectField
                label="Authentication"
                hint="Adds an Authorization header to every snippet."
                value={s.auth}
                options={AUTH_OPTIONS}
                onChange={(e) => set("auth", e.target.value as AuthType)}
              />
              {s.auth === "bearer" && (
                <TextField
                  label="Token"
                  hint="Use a placeholder such as {{API_TOKEN}} and swap in the real value where you run the code."
                  value={s.token}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="{{API_TOKEN}}"
                  onChange={(e) => set("token", e.target.value)}
                />
              )}
              {s.auth === "basic" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Username"
                    value={s.username}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="{{API_USER}}"
                    onChange={(e) => set("username", e.target.value)}
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={s.password}
                    autoComplete="off"
                    placeholder="{{API_PASSWORD}}"
                    onChange={(e) => set("password", e.target.value)}
                  />
                </div>
              )}
              {s.auth !== "none" && (
                <Notice tone="warning" title={looksLikeRealSecret ? "That looks like a real secret" : "Keep secrets out of shared code"}>
                  Credentials stay in this browser tab and are never saved or sent anywhere, but they are written into
                  the snippets in plain text. Prefer placeholders like {"{{API_TOKEN}}"} and load real values from an
                  environment variable or secret manager.
                  {s.auth === "basic" && " Basic auth is only Base64-encoded, not encrypted, so always use https."}
                </Notice>
              )}
              {s.auth !== "none" && manualAuthHeader && (
                <Notice tone="warning">
                  You also added an Authorization header manually. The request will carry two, which most servers reject.
                </Notice>
              )}
            </div>

            <div className="space-y-4">
              <SelectField
                label="Body"
                value={s.bodyType}
                options={BODY_OPTIONS}
                onChange={(e) => set("bodyType", e.target.value as BodyType)}
              />
              {!bodyAllowed && s.bodyType !== "none" && (
                <Notice tone="warning">
                  {s.method} requests don&apos;t carry a body in browsers or most servers, so it is left out of the
                  snippets. Switch the method to POST, PUT or PATCH to send it.
                </Notice>
              )}
              {s.bodyType === "json" && (
                <TextArea
                  label="JSON body"
                  mono
                  value={s.json}
                  placeholder={'{\n  "name": "value"\n}'}
                  error={jsonResult && !jsonResult.ok ? `Invalid JSON: ${jsonResult.error}` : null}
                  hint={jsonResult?.ok ? "Valid JSON." : undefined}
                  onChange={(e) => set("json", e.target.value)}
                />
              )}
              {s.bodyType === "text" && (
                <TextArea
                  label="Raw text body"
                  mono
                  value={s.text}
                  placeholder="Plain text payload"
                  onChange={(e) => set("text", e.target.value)}
                />
              )}
              {s.bodyType === "form" && (
                <KeyValueTable
                  title="Form fields"
                  noun="Field"
                  rows={s.form}
                  onChange={(rows) => set("form", rows)}
                  emptyText="No form fields yet."
                  keyPlaceholder="field"
                  valuePlaceholder="value"
                />
              )}
            </div>
          </div>
        </ToolPanel>

        <ToolPanel title="Code" actions={<CopyBtn text={snippet} label="Copy code" />}>
          <div className="space-y-4">
            <Segmented label="Snippet language" value={tab} onChange={setTab} options={TABS} />
            {!s.url.trim() ? (
              <EmptyState icon="api" title="Add a URL to generate code">
                Pick a method, enter an http or https URL, then add parameters, headers and a body as needed.
              </EmptyState>
            ) : urlError ? (
              <Notice tone="error" title="Fix the URL to see code">
                {urlError}
              </Notice>
            ) : (
              <>
                {jsonResult && !jsonResult.ok && bodyAllowed && (
                  <Notice tone="warning">The JSON body is invalid, so it is left out until you fix it.</Notice>
                )}
                <OutputBlock label={`${TABS.find((t) => t.value === tab)?.label ?? ""} snippet`}>{snippet}</OutputBlock>
                {built && (
                  <p className="break-all text-[0.8125rem] text-muted">
                    Final URL: <code className="inline-code">{built.url}</code>
                  </p>
                )}
              </>
            )}
            <PrivacyNote />
          </div>
        </ToolPanel>
      </SplitGrid>
    </div>
  );
}
