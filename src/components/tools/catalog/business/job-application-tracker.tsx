"use client";

import { useMemo, useRef, useState } from "react";
import {
  Btn,
  CellSelect,
  EmptyState,
  Notice,
  PrivacyNote,
  Segmented,
  SelectField,
  StatGrid,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  fmt,
  usePersistentState,
} from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import {
  SORTS,
  STATUSES,
  STATUS_LABEL,
  emptyDraft,
  filterJobs,
  formatDate,
  isFollowUpDue,
  jobStats,
  jobsToCsv,
  newJobId,
  normalizeJobs,
  parseJobsCsv,
  sampleJobs,
  sortJobs,
  todayIso,
  validateDraft,
  type Job,
  type JobDraft,
  type JobStatus,
  type SortKey,
} from "./lib/jobs";

const STATUS_TINT: Record<JobStatus, string> = {
  saved: "bg-sunken text-ink-2",
  applied: "bg-[color-mix(in_oklch,oklch(0.6_0.12_250)_14%,transparent)] text-ink",
  interview: "bg-[color-mix(in_oklch,oklch(0.75_0.15_75)_20%,transparent)] text-ink",
  offer: "bg-accent-soft text-ink",
  rejected: "bg-[color-mix(in_oklch,var(--danger)_10%,transparent)] text-ink",
};

function StatusBadge({ status }: { status: JobStatus }) {
  const s = STATUSES.find((x) => x.id === status) ?? STATUSES[0];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium ${STATUS_TINT[status]}`}>
      <span aria-hidden="true">{s.symbol}</span>
      {s.label}
    </span>
  );
}

const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s.id, label: s.label }));

type ImportState = { kind: "error"; msg: string } | { kind: "done"; added: number; skipped: { row: number; reason: string }[]; warnings: string[] };

export default function Tool() {
  const [stored, setStored] = usePersistentState<Job[]>("job-application-tracker", []);
  const jobs = useMemo(() => normalizeJobs(stored), [stored]);
  const [today] = useState(todayIso);

  const [draft, setDraft] = useState<JobDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<"list" | "board">("list");
  const [undo, setUndo] = useState<{ msg: string; jobs: Job[] } | null>(null);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [announce, setAnnounce] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const errors = validateDraft(draft);
  const shown = submitted ? errors : { link: errors.link };
  const stats = useMemo(() => jobStats(jobs, today), [jobs, today]);
  const visible = useMemo(() => sortJobs(filterJobs(jobs, statusFilter, query), sort), [jobs, statusFilter, query, sort]);

  const commit = (next: Job[], undoMsg?: string) => {
    setUndo(undoMsg ? { msg: undoMsg, jobs } : null);
    setStored(next);
  };

  const setField = <K extends keyof JobDraft>(k: K, v: JobDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const resetForm = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setSubmitted(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) {
      const firstInvalid = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
      firstInvalid?.focus();
      return;
    }
    const clean: JobDraft = {
      ...draft,
      company: draft.company.trim(),
      role: draft.role.trim(),
      location: draft.location.trim(),
      link: draft.link.trim(),
    };
    const now = Date.now();
    if (editingId) {
      commit(jobs.map((j) => (j.id === editingId ? { ...j, ...clean, updated: now } : j)));
      setAnnounce(`Saved changes to ${clean.role} at ${clean.company}.`);
    } else {
      commit([{ id: newJobId(), ...clean, updated: now }, ...jobs]);
      setAnnounce(`Added ${clean.role} at ${clean.company}.`);
    }
    resetForm();
  };

  const startEdit = (j: Job) => {
    const { id, updated, ...rest } = j;
    void updated;
    setDraft(rest);
    setEditingId(id);
    setSubmitted(false);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  };

  const remove = (j: Job) => {
    commit(
      jobs.filter((x) => x.id !== j.id),
      `Deleted ${j.role} at ${j.company}.`,
    );
    if (editingId === j.id) resetForm();
    setAnnounce(`Deleted ${j.role} at ${j.company}. Use Undo to restore it.`);
  };

  const changeStatus = (j: Job, s: JobStatus) => {
    commit(jobs.map((x) => (x.id === j.id ? { ...x, status: s, updated: Date.now() } : x)));
    setAnnounce(`${j.company} moved to ${STATUS_LABEL[s]}.`);
  };

  const importCsv = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setImportState({ kind: "error", msg: "That file is larger than 2 MB." });
      return;
    }
    const res = parseJobsCsv(await file.text());
    if (res.error) {
      setImportState({ kind: "error", msg: res.error });
      return;
    }
    if (res.jobs.length) {
      commit(importMode === "replace" ? res.jobs : [...res.jobs, ...jobs], `Imported ${res.jobs.length} from ${file.name}.`);
    }
    setImportState({ kind: "done", added: res.jobs.length, skipped: res.skipped, warnings: res.warnings });
  };

  const rate = stats.responseRate;

  const card = (j: Job, compact = false) => {
    const due = isFollowUpDue(j, today);
    return (
      <li key={j.id} className="min-w-0 rounded-xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words font-semibold text-ink">{j.role}</h3>
            <p className="break-words text-sm text-ink-2">
              {j.company}
              {j.location ? ` · ${j.location}` : ""}
            </p>
          </div>
          {!compact && <StatusBadge status={j.status} />}
        </div>
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {j.applied && (
            <div className="flex gap-1.5">
              <dt className="text-muted">Applied:</dt>
              <dd className="text-ink">{formatDate(j.applied)}</dd>
            </div>
          )}
          {j.followUp && (
            <div className="flex flex-wrap gap-1.5">
              <dt className="text-muted">Follow up:</dt>
              <dd className={due ? "font-medium text-danger" : "text-ink"}>
                {formatDate(j.followUp)}
                {due && (
                  <span className="ml-1 inline-flex items-center gap-1">
                    <Icon name="alert" size={14} />
                    due
                  </span>
                )}
              </dd>
            </div>
          )}
          {j.salary && (
            <div className="flex gap-1.5">
              <dt className="text-muted">Salary:</dt>
              <dd className="break-words text-ink">{j.salary}</dd>
            </div>
          )}
        </dl>
        {j.nextStep && (
          <p className="mt-2 break-words text-sm text-ink">
            <span className="text-muted">Next step: </span>
            {j.nextStep}
          </p>
        )}
        {j.notes && !compact && <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-ink-2">{j.notes}</p>}
        {j.link && (
          <a href={j.link} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-flex min-h-10 items-center gap-1 text-sm">
            Job posting
            <Icon name="external" size={14} />
            <span className="sr-only">for {j.role} at {j.company} (opens in a new tab)</span>
          </a>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CellSelect
            label={`Status for ${j.role} at ${j.company}`}
            className="min-w-[9.5rem] flex-1"
            value={j.status}
            options={STATUS_OPTIONS}
            onChange={(e) => changeStatus(j, e.target.value as JobStatus)}
          />
          <Btn variant="ghost" icon="pen" onClick={() => startEdit(j)} aria-label={`Edit ${j.role} at ${j.company}`}>
            Edit
          </Btn>
          <Btn variant="danger" icon="trash" onClick={() => remove(j)} aria-label={`Delete ${j.role} at ${j.company}`}>
            Delete
          </Btn>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <ToolPanel
        title={editingId ? "Edit application" : "Add an application"}
        actions={
          jobs.length === 0 ? (
            <Btn
              variant="ghost"
              icon="list"
              onClick={() => {
                commit(sampleJobs());
                setAnnounce("Loaded four sample applications.");
              }}
            >
              Load sample
            </Btn>
          ) : undefined
        }
      >
        <form ref={formRef} onSubmit={submit} noValidate className="scroll-mt-24 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Company" value={draft.company} error={shown.company} onChange={(e) => setField("company", e.target.value)} />
            <TextField label="Role" placeholder="Marketing intern" value={draft.role} error={shown.role} onChange={(e) => setField("role", e.target.value)} />
            <TextField label="Location" optional placeholder="Remote, city or hybrid" value={draft.location} onChange={(e) => setField("location", e.target.value)} />
            <TextField
              label="Job posting link"
              optional
              type="url"
              inputMode="url"
              placeholder="https://"
              value={draft.link}
              error={shown.link}
              onChange={(e) => setField("link", e.target.value)}
            />
            <SelectField
              label="Status"
              value={draft.status}
              options={STATUS_OPTIONS}
              hint={STATUSES.find((s) => s.id === draft.status)?.hint}
              onChange={(e) => setField("status", e.target.value as JobStatus)}
            />
            <TextField label="Salary" optional placeholder="$60,000 or $25/hour" value={draft.salary} onChange={(e) => setField("salary", e.target.value)} />
            <TextField label="Date applied" optional type="date" value={draft.applied} error={shown.applied} onChange={(e) => setField("applied", e.target.value)} />
            <TextField
              label="Follow-up date"
              optional
              type="date"
              value={draft.followUp}
              error={shown.followUp}
              onChange={(e) => setField("followUp", e.target.value)}
            />
            <TextField
              className="sm:col-span-2"
              label="Next step"
              optional
              placeholder="Send a thank-you email"
              value={draft.nextStep}
              onChange={(e) => setField("nextStep", e.target.value)}
            />
            <TextArea
              className="sm:col-span-2"
              label="Notes"
              optional
              rows={3}
              value={draft.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-sm">
              <Icon name={editingId ? "check" : "plus"} size={16} />
              {editingId ? "Save changes" : "Add application"}
            </button>
            {(editingId || draft.company || draft.role) && (
              <Btn variant="subtle" onClick={resetForm}>
                {editingId ? "Cancel editing" : "Clear form"}
              </Btn>
            )}
          </div>
        </form>
      </ToolPanel>

      {undo && (
        <Notice tone="info">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{undo.msg}</span>
            <Btn
              variant="ghost"
              icon="reset"
              onClick={() => {
                setStored(undo.jobs);
                setUndo(null);
                setAnnounce("Change undone.");
              }}
            >
              Undo
            </Btn>
            <Btn variant="subtle" onClick={() => setUndo(null)}>
              Dismiss
            </Btn>
          </span>
        </Notice>
      )}

      <ToolPanel title="Pipeline overview">
        <StatGrid
          items={[
            { label: "Total tracked", value: stats.total },
            ...STATUSES.map((s) => ({ label: s.label, value: stats.counts[s.id] })),
            { label: "Response rate", value: rate === null ? "n/a" : `${fmt(rate * 100, 1)}%` },
            { label: "Follow-ups due", value: stats.dueFollowUps },
          ]}
        />
        <p className="mt-3 text-[0.8125rem] text-muted">
          Response rate = (Interview + Offer) ÷ (Applied + Interview + Offer + Rejected)
          {stats.appliedOrLater > 0 ? ` = ${stats.responses} ÷ ${stats.appliedOrLater}` : ""}. Saved roles are left out
          because you have not applied yet, and a rejection counts as no positive response. Follow-ups due counts open
          applications whose follow-up date is today or earlier.
        </p>
      </ToolPanel>

      <ToolPanel
        title={`Applications (${visible.length}${visible.length !== jobs.length ? ` of ${jobs.length}` : ""})`}
        actions={
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List" },
              { value: "board", label: "Pipeline" },
            ]}
          />
        }
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <TextField label="Search" type="search" placeholder="Company, role, notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <SelectField
            label="Status"
            value={statusFilter}
            options={[{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS]}
            onChange={(e) => setStatusFilter(e.target.value as JobStatus | "all")}
          />
          <SelectField label="Sort by" value={sort} options={SORTS} onChange={(e) => setSort(e.target.value as SortKey)} />
        </div>

        {jobs.length === 0 ? (
          <EmptyState icon="briefcase" title="No applications yet">
            Add your first role above, import a CSV, or load the sample to see how it works.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState icon="search" title="Nothing matches">
            Try a different search or status filter.
          </EmptyState>
        ) : view === "list" ? (
          <ul className="grid gap-3 md:grid-cols-2">{visible.map((j) => card(j))}</ul>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {STATUSES.map((s) => {
              const col = visible.filter((j) => j.status === s.id);
              return (
                <section key={s.id} aria-label={`${s.label}: ${col.length}`} className="min-w-0 rounded-xl bg-sunken/70 p-3">
                  <h3 className="mb-3 flex items-center justify-between gap-2 px-1 text-sm font-semibold text-ink">
                    <StatusBadge status={s.id} />
                    <span className="tabular-nums text-muted">{col.length}</span>
                  </h3>
                  {col.length ? (
                    <ul className="space-y-3">{col.map((j) => card(j, true))}</ul>
                  ) : (
                    <p className="px-1 pb-1 text-sm text-muted">None</p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </ToolPanel>

      <ToolPanel title="Import and export">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Btn
              icon="download"
              disabled={!jobs.length}
              onClick={() => downloadFile(`job-applications-${today}.csv`, `﻿${jobsToCsv(sortJobs(jobs, sort))}`, "text/csv")}
            >
              Export CSV
            </Btn>
            <label className="btn btn-sm btn-ghost cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
              <Icon name="upload" size={16} />
              Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  void importCsv(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <Btn
              variant="danger"
              icon="trash"
              disabled={!jobs.length}
              onClick={() => {
                commit([], `Deleted all ${jobs.length} applications.`);
                resetForm();
              }}
            >
              Delete all
            </Btn>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-ink" aria-hidden="true">
              Imported rows
            </span>
            <Segmented
              label="Imported rows"
              value={importMode}
              onChange={setImportMode}
              options={[
                { value: "append", label: "Add to my list" },
                { value: "replace", label: "Replace my list" },
              ]}
            />
          </div>
          <p className="text-[0.8125rem] text-muted">
            Required columns: Company and Role. Optional: Location, Link, Status, Date applied, Follow-up date, Next step,
            Salary, Notes. Dates can be YYYY-MM-DD or M/D/YYYY. Row numbers in the report count the header as row 1 and
            ignore blank lines.
          </p>
          {importState?.kind === "error" && (
            <Notice tone="error" title="Import failed">
              {importState.msg}
            </Notice>
          )}
          {importState?.kind === "done" && (
            <Notice tone={importState.added ? "success" : "warning"} title={`Imported ${importState.added} ${importState.added === 1 ? "row" : "rows"}`}>
              {importState.skipped.length > 0 && (
                <>
                  <p>Skipped {importState.skipped.length}:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {importState.skipped.slice(0, 20).map((s) => (
                      <li key={s.row}>
                        Row {s.row}: {s.reason}
                      </li>
                    ))}
                    {importState.skipped.length > 20 && <li>…and {importState.skipped.length - 20} more</li>}
                  </ul>
                </>
              )}
              {importState.warnings.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {importState.warnings.slice(0, 20).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {importState.warnings.length > 20 && <li>…and {importState.warnings.length - 20} more notes</li>}
                </ul>
              )}
              {!importState.skipped.length && !importState.warnings.length && <p>Every row was read without problems.</p>}
            </Notice>
          )}
        </div>
      </ToolPanel>

      <PrivacyNote stored />
    </div>
  );
}
