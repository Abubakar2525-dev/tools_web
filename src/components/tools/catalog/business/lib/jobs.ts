/**
 * Job and internship application tracker: model, filters, stats and CSV in/out.
 * Pure TypeScript so it can be unit tested.
 */

import { parseCsvObjects, toCsv } from "./csv";

export type JobStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

export const STATUSES: { id: JobStatus; label: string; symbol: string; hint: string }[] = [
  { id: "saved", label: "Saved", symbol: "○", hint: "Found the posting, not applied yet" },
  { id: "applied", label: "Applied", symbol: "→", hint: "Application sent" },
  { id: "interview", label: "Interview", symbol: "◆", hint: "Screening or interview stage" },
  { id: "offer", label: "Offer", symbol: "✓", hint: "Offer received" },
  { id: "rejected", label: "Rejected", symbol: "×", hint: "Closed or declined" },
];
export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label])) as Record<JobStatus, string>;
export const isStatus = (s: unknown): s is JobStatus => typeof s === "string" && STATUSES.some((x) => x.id === s);

export interface Job {
  id: string;
  company: string;
  role: string;
  location: string;
  link: string;
  status: JobStatus;
  /** YYYY-MM-DD or "". */
  applied: string;
  /** Follow-up or next-step date, YYYY-MM-DD or "". */
  followUp: string;
  nextStep: string;
  salary: string;
  notes: string;
  /** Epoch ms, for "recently updated" sorting. */
  updated: number;
}
export type JobDraft = Omit<Job, "id" | "updated">;

export const emptyDraft = (): JobDraft => ({
  company: "",
  role: "",
  location: "",
  link: "",
  status: "saved",
  applied: "",
  followUp: "",
  nextStep: "",
  salary: "",
  notes: "",
});

let seq = 0;
export const newJobId = () => `j${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** Null when empty or a valid http(s) URL, otherwise an error message. */
export function linkError(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/\s/.test(v)) return "Links cannot contain spaces.";
  if (!/^https?:\/\//i.test(v)) return "Start the link with https:// or http://.";
  try {
    const u = new URL(v);
    if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname.includes(".")) return "This is not a valid web address.";
  } catch {
    return "This is not a valid web address.";
  }
  return null;
}

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(s: string): boolean {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Accepts YYYY-MM-DD, YYYY/MM/DD or US M/D/YYYY. Returns ISO or null. */
export function toIsoDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : null;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : null;
  }
  return null;
}

export interface DraftErrors {
  company?: string;
  role?: string;
  link?: string;
  applied?: string;
  followUp?: string;
}

export function validateDraft(d: JobDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.company.trim()) e.company = "Add the company or organization.";
  if (!d.role.trim()) e.role = "Add the role or internship title.";
  const le = linkError(d.link);
  if (le) e.link = le;
  if (d.applied && !isIsoDate(d.applied)) e.applied = "Use a valid date.";
  if (d.followUp && !isIsoDate(d.followUp)) e.followUp = "Use a valid date.";
  return e;
}

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");

/** Cleans stored data so a corrupted entry cannot break the UI. */
export function normalizeJobs(input: unknown): Job[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: Job[] = [];
  for (const o of input) {
    if (!isObj(o)) continue;
    let id = typeof o.id === "string" && o.id && o.id.length <= 64 ? o.id : newJobId();
    if (seen.has(id)) id = newJobId();
    seen.add(id);
    const applied = str(o.applied, 10);
    const followUp = str(o.followUp, 10);
    out.push({
      id,
      company: str(o.company, 200),
      role: str(o.role, 200),
      location: str(o.location, 200),
      link: str(o.link),
      status: isStatus(o.status) ? o.status : "saved",
      applied: isIsoDate(applied) ? applied : "",
      followUp: isIsoDate(followUp) ? followUp : "",
      nextStep: str(o.nextStep, 500),
      salary: str(o.salary, 200),
      notes: str(o.notes, 5000),
      updated: typeof o.updated === "number" && Number.isFinite(o.updated) ? o.updated : 0,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Filter, sort, stats                                                 */
/* ------------------------------------------------------------------ */

export type SortKey = "updated" | "applied" | "followUp" | "company" | "status";

export const SORTS: { value: SortKey; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "followUp", label: "Follow-up date (soonest first)" },
  { value: "applied", label: "Date applied (newest first)" },
  { value: "company", label: "Company (A to Z)" },
  { value: "status", label: "Status (pipeline order)" },
];

export function filterJobs(jobs: readonly Job[], status: JobStatus | "all", query: string): Job[] {
  const q = query.trim().toLowerCase();
  return jobs.filter((j) => {
    if (status !== "all" && j.status !== status) return false;
    if (!q) return true;
    return [j.company, j.role, j.location, j.notes, j.salary, j.nextStep].some((f) => f.toLowerCase().includes(q));
  });
}

const statusIndex = (s: JobStatus) => STATUSES.findIndex((x) => x.id === s);

export function sortJobs(jobs: readonly Job[], key: SortKey): Job[] {
  const byCompany = (a: Job, b: Job) => a.company.localeCompare(b.company, undefined, { sensitivity: "base" }) || a.role.localeCompare(b.role);
  const arr = jobs.slice();
  switch (key) {
    case "company":
      return arr.sort(byCompany);
    case "status":
      return arr.sort((a, b) => statusIndex(a.status) - statusIndex(b.status) || byCompany(a, b));
    case "applied":
      // Newest first, undated last.
      return arr.sort((a, b) => (a.applied && b.applied ? b.applied.localeCompare(a.applied) : a.applied ? -1 : b.applied ? 1 : byCompany(a, b)));
    case "followUp":
      // Soonest first, undated last.
      return arr.sort((a, b) => (a.followUp && b.followUp ? a.followUp.localeCompare(b.followUp) : a.followUp ? -1 : b.followUp ? 1 : byCompany(a, b)));
    default:
      return arr.sort((a, b) => b.updated - a.updated);
  }
}

export interface JobStats {
  total: number;
  counts: Record<JobStatus, number>;
  /** applied + interview + offer + rejected */
  appliedOrLater: number;
  /** interview + offer */
  responses: number;
  /** responses / appliedOrLater, or null when nothing has been applied to. */
  responseRate: number | null;
  /** Follow-up dates on or before today for open applications. */
  dueFollowUps: number;
}

export function jobStats(jobs: readonly Job[], today: string): JobStats {
  const counts: Record<JobStatus, number> = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
  let due = 0;
  for (const j of jobs) {
    counts[j.status]++;
    if (isFollowUpDue(j, today)) due++;
  }
  const appliedOrLater = counts.applied + counts.interview + counts.offer + counts.rejected;
  const responses = counts.interview + counts.offer;
  return {
    total: jobs.length,
    counts,
    appliedOrLater,
    responses,
    responseRate: appliedOrLater ? responses / appliedOrLater : null,
    dueFollowUps: due,
  };
}

export const isFollowUpDue = (j: Job, today: string) =>
  !!j.followUp && j.followUp <= today && j.status !== "offer" && j.status !== "rejected";

/** Local date as YYYY-MM-DD. */
export function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-03-05" → "Mar 5, 2026" without timezone shifts. */
export function formatDate(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

type Field = keyof JobDraft;
export const CSV_COLUMNS: { field: Field; header: string; aliases: string[] }[] = [
  { field: "company", header: "Company", aliases: ["company", "organization", "organisation", "employer"] },
  { field: "role", header: "Role", aliases: ["role", "position", "title", "job title", "job"] },
  { field: "location", header: "Location", aliases: ["location", "city"] },
  { field: "link", header: "Link", aliases: ["link", "url", "posting", "job link", "posting url"] },
  { field: "status", header: "Status", aliases: ["status", "stage"] },
  { field: "applied", header: "Date applied", aliases: ["date applied", "applied", "applied on", "application date"] },
  { field: "followUp", header: "Follow-up date", aliases: ["follow-up date", "follow up date", "follow-up", "follow up", "next date"] },
  { field: "nextStep", header: "Next step", aliases: ["next step", "next steps", "next action"] },
  { field: "salary", header: "Salary", aliases: ["salary", "pay", "compensation"] },
  { field: "notes", header: "Notes", aliases: ["notes", "note", "comments"] },
];

export function jobsToCsv(jobs: readonly Job[]): string {
  const rows: string[][] = [CSV_COLUMNS.map((c) => c.header)];
  for (const j of jobs) rows.push(CSV_COLUMNS.map((c) => (c.field === "status" ? STATUS_LABEL[j.status] : j[c.field])));
  return toCsv(rows);
}

export interface CsvImportResult {
  jobs: Job[];
  skipped: { row: number; reason: string }[];
  warnings: string[];
  error?: string;
}

/** Undoes the formula guard ("'=…") added by csvEscape on export. */
const unguard = (s: string) => (/^'[=@]/.test(s) ? s.slice(1) : s);

const normHeader = (h: string) => h.trim().toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");

export function parseJobsCsv(text: string, now = Date.now()): CsvImportResult {
  const { headers, records } = parseCsvObjects(text);
  const res: CsvImportResult = { jobs: [], skipped: [], warnings: [] };
  if (!headers.length) return { ...res, error: "The file is empty." };
  const map = new Map<Field, string>();
  for (const col of CSV_COLUMNS) {
    const h = headers.find((x) => col.aliases.includes(normHeader(x)));
    if (h !== undefined) map.set(col.field, h);
  }
  const missing = (["company", "role"] as Field[]).filter((f) => !map.has(f));
  if (missing.length) {
    return {
      ...res,
      error: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing
        .map((f) => CSV_COLUMNS.find((c) => c.field === f)?.header)
        .join(", ")}. Found: ${headers.filter(Boolean).join(", ") || "no headers"}.`,
    };
  }
  const known = new Set(map.values());
  const ignored = headers.filter((h) => h && !known.has(h));
  if (ignored.length) res.warnings.push(`Ignored column${ignored.length > 1 ? "s" : ""}: ${ignored.join(", ")}.`);

  records.forEach((rec, i) => {
    const row = i + 2; // 1-based, header is row 1
    const get = (f: Field) => {
      const h = map.get(f);
      return h === undefined ? "" : unguard((rec[h] ?? "").trim());
    };
    const company = get("company");
    const role = get("role");
    if (!company && !role) {
      res.skipped.push({ row, reason: "no company or role" });
      return;
    }
    if (!company || !role) {
      res.skipped.push({ row, reason: !company ? "company is empty" : "role is empty" });
      return;
    }
    const rawStatus = get("status").toLowerCase();
    let status: JobStatus = "saved";
    if (rawStatus) {
      const found = STATUSES.find((s) => s.id === rawStatus || s.label.toLowerCase() === rawStatus);
      if (!found) {
        res.skipped.push({ row, reason: `unknown status "${get("status")}"` });
        return;
      }
      status = found.id;
    }
    const applied = toIsoDate(get("applied"));
    const followUp = toIsoDate(get("followUp"));
    if (applied === null) res.warnings.push(`Row ${row}: date applied "${get("applied")}" was not recognized and was left empty.`);
    if (followUp === null) res.warnings.push(`Row ${row}: follow-up date "${get("followUp")}" was not recognized and was left empty.`);
    let link = get("link");
    if (linkError(link)) {
      res.warnings.push(`Row ${row}: link "${link.slice(0, 60)}" is not an http(s) address and was left empty.`);
      link = "";
    }
    res.jobs.push({
      id: newJobId(),
      company: company.slice(0, 200),
      role: role.slice(0, 200),
      location: get("location").slice(0, 200),
      link,
      status,
      applied: applied ?? "",
      followUp: followUp ?? "",
      nextStep: get("nextStep").slice(0, 500),
      salary: get("salary").slice(0, 200),
      notes: get("notes").slice(0, 5000),
      updated: now - i,
    });
  });
  return res;
}

export function sampleJobs(now = Date.now()): Job[] {
  return [
    { id: newJobId(), company: "Harbor Analytics", role: "Data analyst intern", location: "Remote", link: "https://example.com/jobs/1", status: "interview", applied: "2026-09-02", followUp: "2026-10-14", nextStep: "Technical interview with the team lead", salary: "$28/hour", notes: "Prepare a SQL case study.", updated: now },
    { id: newJobId(), company: "Lumen Health", role: "Junior product analyst", location: "Chicago, IL", link: "", status: "applied", applied: "2026-09-20", followUp: "2026-10-04", nextStep: "Email the recruiter", salary: "", notes: "Referred by a classmate.", updated: now - 1 },
    { id: newJobId(), company: "Copperline", role: "Operations associate", location: "Austin, TX", link: "", status: "rejected", applied: "2026-08-15", followUp: "", nextStep: "", salary: "$55,000", notes: "", updated: now - 2 },
    { id: newJobId(), company: "Fieldnote", role: "Research assistant", location: "Hybrid", link: "", status: "saved", applied: "", followUp: "2026-10-20", nextStep: "Tailor resume before applying", salary: "", notes: "", updated: now - 3 },
  ];
}
