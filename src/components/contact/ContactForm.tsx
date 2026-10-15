"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { budgetOptions, validateContact, type ContactPayload, type FieldErrors } from "@/lib/contact";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; name: string }
  | { kind: "error"; message: string };

const empty: ContactPayload = { name: "", email: "", company: "", service: "", budget: "", details: "", website: "" };
const order: (keyof ContactPayload)[] = ["name", "email", "company", "service", "budget", "details"];

export function ContactForm({ serviceOptions, fallbackEmail }: { serviceOptions: readonly string[]; fallbackEmail: string | null }) {
  const [values, setValues] = useState<ContactPayload>(empty);
  const [touched, setTouched] = useState<Partial<Record<keyof ContactPayload, boolean>>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const revalidate = (next: ContactPayload, t = touched) => {
    const { errors: e } = validateContact(next, serviceOptions);
    // Only surface errors for fields the user has finished with.
    setErrors(Object.fromEntries(Object.entries(e).filter(([k]) => t[k as keyof ContactPayload])) as FieldErrors);
  };

  const set = (k: keyof ContactPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const next = { ...values, [k]: e.target.value };
    setValues(next);
    if (touched[k]) revalidate(next);
  };
  const blur = (k: keyof ContactPayload) => () => {
    const t = { ...touched, [k]: true };
    setTouched(t);
    revalidate(values, t);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const allTouched = Object.fromEntries(order.map((k) => [k, true]));
    setTouched(allTouched);
    const { errors: e2, ok } = validateContact(values, serviceOptions);
    setErrors(e2);
    if (!ok) {
      const first = order.find((k) => e2[k]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; errors?: FieldErrors };
      if (res.ok && json.ok) {
        setStatus({ kind: "success", name: values.name.split(" ")[0] });
        setValues(empty);
        setTouched({});
      } else if (json.errors) {
        setErrors(json.errors);
        setStatus({ kind: "error", message: "Please fix the highlighted fields." });
      } else {
        setStatus({ kind: "error", message: json.message ?? "Something went wrong and your message was not sent." });
      }
    } catch {
      setStatus({ kind: "error", message: "Network error: your message was not sent. Check your connection and try again." });
    }
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  if (status.kind === "success") {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="card p-8 outline-none sm:p-10">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-strong">
          <Icon name="check" size={24} />
        </span>
        <h2 className="h3 mt-6">Thanks{status.name ? `, ${status.name}` : ""}. Your message is in.</h2>
        <p className="mt-3 text-ink-2">
          We read every inquiry and will reply to the email you provided. In the meantime, you might find our{" "}
          <Link href="/articles" className="link">
            engineering notes
          </Link>{" "}
          useful.
        </p>
        <button type="button" className="btn btn-ghost btn-sm mt-8" onClick={() => setStatus({ kind: "idle" })}>
          Send another message
        </button>
      </div>
    );
  }

  const field = "mt-2 block w-full rounded-lg bg-surface px-3.5 text-[1rem] text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] outline-none transition-shadow duration-150 placeholder:text-muted/80 hover:shadow-[inset_0_0_0_1px_var(--muted)] focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--danger)]";
  const err = (k: keyof ContactPayload) =>
    errors[k] ? (
      <p id={`${k}-error`} className="mt-2 flex items-start gap-1.5 text-sm text-danger">
        <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
        {errors[k]}
      </p>
    ) : null;
  const a11y = (k: keyof ContactPayload, hint?: string) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": [errors[k] ? `${k}-error` : null, hint].filter(Boolean).join(" ") || undefined,
  });

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="card p-6 sm:p-9" aria-describedby="form-note">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input id="name" name="name" autoComplete="name" required value={values.name} onChange={set("name")} onBlur={blur("name")} className={`${field} h-12`} {...a11y("name")} />
          {err("name")}
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Work email
          </label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required value={values.email} onChange={set("email")} onBlur={blur("email")} className={`${field} h-12`} {...a11y("email")} />
          {err("email")}
        </div>
        <div>
          <label htmlFor="company" className="text-sm font-medium">
            Company <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="company" name="company" autoComplete="organization" value={values.company} onChange={set("company")} onBlur={blur("company")} className={`${field} h-12`} />
        </div>
        <div>
          <label htmlFor="service" className="text-sm font-medium">
            Service interest
          </label>
          <div className="relative">
            <select id="service" name="service" required value={values.service} onChange={set("service")} onBlur={blur("service")} className={`${field} h-12 appearance-none pr-10`} {...a11y("service")}>
              <option value="" disabled>
                Choose one
              </option>
              {serviceOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={18} className="pointer-events-none absolute right-3 top-[calc(50%+4px)] -translate-y-1/2 text-muted" />
          </div>
          {err("service")}
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">
            Budget <span className="font-normal text-muted">(optional)</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {budgetOptions.map((b) => (
              <label key={b} className="relative">
                <input type="radio" name="budget" value={b} checked={values.budget === b} onChange={set("budget")} className="peer sr-only" />
                <span className="inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-sm text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[background-color,color,box-shadow] duration-150 hover:text-ink peer-checked:bg-ink peer-checked:text-surface peer-checked:shadow-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                  {b}
                </span>
              </label>
            ))}
          </div>
          {err("budget")}
        </fieldset>
        <div className="sm:col-span-2">
          <label htmlFor="details" className="text-sm font-medium">
            Project details
          </label>
          <p id="details-hint" className="mt-1 text-sm text-muted">
            What problem are you solving, who is it for, and what constraints should we know about (data, timeline,
            compliance)?
          </p>
          <textarea id="details" name="details" rows={6} required value={values.details} onChange={set("details")} onBlur={blur("details")} className={`${field} min-h-[160px] resize-y py-3 leading-relaxed`} {...a11y("details", "details-hint")} />
          {err("details")}
        </div>
        {/* Honeypot: hidden from people and assistive tech. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
        </div>
      </div>

      <div ref={statusRef} tabIndex={-1} className="outline-none">
        {status.kind === "error" && (
          <div role="alert" className="mt-6 rounded-lg bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] px-4 py-3 text-sm text-ink">
            <p className="font-medium text-danger">{status.message}</p>
            {fallbackEmail && (
              <p className="mt-1 text-ink-2">
                You can also email us at{" "}
                <a href={`mailto:${fallbackEmail}`} className="link">
                  {fallbackEmail}
                </a>
                .
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p id="form-note" className="text-sm text-muted">
          We use your details only to reply. See our{" "}
          <Link href="/privacy" className="link">
            privacy policy
          </Link>
          .
        </p>
        <button type="submit" className="btn shrink-0 disabled:cursor-wait disabled:opacity-70" disabled={status.kind === "submitting"} aria-busy={status.kind === "submitting"}>
          {status.kind === "submitting" ? (
            <>
              <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-surface/30 border-t-surface" />
              Sending…
            </>
          ) : (
            <>
              Send inquiry
              <span className="btn-arrow">
                <Icon name="arrow" size={14} strokeWidth={2} />
              </span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
